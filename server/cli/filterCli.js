// filterCli.js — Unified "Search Filters" CLI flow (DB-first ➜ OpenAlex)
const inquirer = require('inquirer');
const axios = require('axios');
const {
  searchFilters,
  openAlexSearch,
  cleanParams,
  BASE_URL,
  // 👇 thêm import flushRedis từ api.cli.js
  flushRedis,
} = require('./api.cli');
const { renderAuthorsTable } = require('./renderCli');
const { handleError } = require('./errors.cli');

function parseCsv(val) {
  return (val || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function askFilters() {
  const answers = await inquirer.prompt([
    { name: 'id', message: 'ID (exact, bỏ trống nếu không):' },
    { name: 'name', message: 'Tên (regex an toàn, bỏ trống nếu không):' },
    { name: 'country', message: 'Country (CSV, ví dụ: US,JP,DE):' },
    { name: 'topic', message: 'Topic/Field (CSV):' },
    { name: 'affiliation', message: 'Affiliation display_name (regex an toàn):' },
    { name: 'year_from', message: 'Year from:' },
    { name: 'year_to', message: 'Year to:' },
    { name: 'hindex', message: 'h-index tối thiểu (bỏ trống nếu không):' },
    { name: 'i10index', message: 'i10-index tối thiểu (bỏ trống nếu không):' },
    { name: 'op', message: 'Operator cho metrics:' }
  ]);

  // sanitize số
  const page  = parseInt(answers.page, 10) || 1;
  const limit = parseInt(answers.limit, 10) || 20;
  const year_from = answers.year_from ? parseInt(answers.year_from, 10) : undefined;
  const year_to   = answers.year_to ? parseInt(answers.year_to, 10) : undefined;
  const hindex    = answers.hindex ? parseInt(answers.hindex, 10) : undefined;
  const i10index  = answers.i10index ? parseInt(answers.i10index, 10) : undefined;

  const params = cleanParams({
    id: answers.id,
    name: answers.name,
    country: parseCsv(answers.country).join(','), // server OR across CSV
    topic: parseCsv(answers.topic).join(','),
    affiliation: answers.affiliation,             // ✅ đúng key controller
    year_from,
    year_to,
    hindex,
    i10index,
    op: answers.op,
    page,
    limit
  });

  return params;
}

// ───────────────────────────────────────────────────────────
// Helpers: fetch/render single profile
// ───────────────────────────────────────────────────────────
async function fetchDbProfileById(id) {
  const res = await axios.get(`${BASE_URL}/api/search-filters/search`, { params: { id } });
  // BE returns { profile: {...} }
  return res.data?.profile || res.data?.data || res.data;
}

async function fetchOpenAlexProfileById(id) {
  const res = await axios.get(`${BASE_URL}/api/search-filters/openalex`, { params: { id } });
  // BE returns { profile: {...} }
  return res.data?.profile || res.data?.data || res.data;
}

async function saveProfileToDb(profile) {
  const res = await axios.post(`${BASE_URL}/api/author/save-profile`, { profile });
  return res.data?.profile || res.data;
}

async function deleteProfileInDb(id) {
  const res = await axios.delete(`${BASE_URL}/api/author/delete-profile`, { data: { id } });
  return res.data;
}

function printProfile(profile) {
  if (!profile) return console.log('⚠ Không tìm thấy profile.');

  const p = profile.profile || profile; // phòng trường hợp lồng
  console.log('===== PROFILE DETAIL =====');
  console.log(`ID: ${p._id || p.id || ''}`);
  console.log(`Name: ${p.basic_info?.name || ''}`);
  const ca = p.current_affiliation || p.currentAffiliation || {};
  console.log(`Current affiliation: ${ca.display_name || ''} (${ca.country_code || ''})`);

  // Affiliations (history)
  if (Array.isArray(p.basic_info?.affiliations)) {
    console.log('Affiliations:');
    p.basic_info.affiliations.forEach((a, i) => {
      const inst = a.institution || {};
      const years = Array.isArray(a.years) ? a.years.join(', ') : '';
      console.log(`  ${i + 1}. ${inst.display_name || ''} [${inst.country_code || ''}] (years: ${years})`);
    });
  }

  // Identifiers
  if (p.identifiers) {
    console.log('Identifiers:');
    Object.entries(p.identifiers).forEach(([k, v]) => {
      if (v) console.log(`  - ${k}: ${v}`);
    });
  }

  // Metrics
  const m = p.research_metrics || p.metrics || {};
  console.log('Metrics:');
  console.log(`  h-index: ${m.h_index ?? m.h ?? '—'}`);
  console.log(`  i10-index: ${m.i10_index ?? m.i10 ?? '—'}`);
  if (m.total_works != null) console.log(`  total_works: ${m.total_works}`);
  if (m.total_citations != null) console.log(`  total_citations: ${m.total_citations}`);

  // Research areas
  const areas = p.research_areas || {};
  if (Array.isArray(areas.topics) || Array.isArray(areas.fields)) {
    console.log('Research areas:');
    if (Array.isArray(areas.topics) && areas.topics.length) {
      console.log('  Topics:');
      areas.topics.forEach(t => console.log(`    - ${t.display_name || t}`));
    }
    if (Array.isArray(areas.fields) && areas.fields.length) {
      console.log('  Fields:');
      areas.fields.forEach(f => console.log(`    - ${f.display_name || f}`));
    }
  }

  // Citation trends (optional)
  const counts = p.citation_trends?.counts_by_year;
  if (Array.isArray(counts) && counts.length) {
    console.log('Counts by year (top 5):');
    counts.slice(0, 5).forEach(c => console.log(`  ${c.year}: ${c.works_count || c.cited_by_count || ''}`));
  }
  console.log('===========================');
}

async function promptIndex(max, message = 'Chọn chỉ số (No) của hàng:') {
  const { idx } = await inquirer.prompt([{ name: 'idx', message }]);
  const n = parseInt(String(idx).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return n - 1; // convert to 0-based
}

async function openAlexMenu(state) {
  while (true) {
    try {
      const data = await openAlexSearch({ name: state.name, page: state.page, per_page: state.limit });
      renderAuthorsTable(data);

      const answer = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Chọn thao tác (OpenAlex):',
        choices: [
          { name: '👁️  View profile', value: 'view' },
          { name: '💾 Save profile', value: 'save' },
          { name: '➡️  Next page', value: 'next' },
          { name: '⬅️  Prev page', value: 'prev' },
          { name: '📚 Back to database', value: 'back_db' },
          { name: '↩️  Back to search filters', value: 'back' },
          { name: '🏠  Main menu', value: 'home' }
        ]
      }]);

      if (answer.action === 'next') { state.page = Math.min(data.pages, state.page + 1); continue; }
      if (answer.action === 'prev') { state.page = Math.max(1, state.page - 1); continue; }

      if (answer.action === 'view') {
        if (!data.items.length) { console.log('📭 Không có kết quả.'); continue; }
        const idx = await promptIndex(data.items.length, 'Nhập No để xem chi tiết:');
        if (idx == null) { console.log('⚠ Chỉ số không hợp lệ.'); continue; }
        const chosen = data.items[idx];
        try {
          const full = await fetchOpenAlexProfileById(chosen.id);
          printProfile(full);
        } catch (e) {
          handleError(e);
        }
        continue;
      }

      if (answer.action === 'save') {
        if (!data.items.length) { console.log('📭 Không có kết quả.'); continue; }
        const idx = await promptIndex(data.items.length, 'Nhập No để SAVE vào DB:');
        if (idx == null) { console.log('⚠ Chỉ số không hợp lệ.'); continue; }
        const chosen = data.items[idx];
        try {
          const full = await fetchOpenAlexProfileById(chosen.id);
          const saved = await saveProfileToDb(full);
          console.log('✅ Đã lưu vào DB:', saved?._id || saved?.id || chosen.id);
        } catch (e) {
          handleError(e);
        }
        continue;
      }

      return answer.action;
    } catch (err) {
      handleError(err);
      return 'back';
    }
  }
}

async function runFilterFlow() {
  try {
    const params = await askFilters();

    // DB-first
    let dbData = await searchFilters(params); // 👈 đổi const -> let để có thể refresh sau flush
    renderAuthorsTable(dbData);

    // Nếu có kết quả DB → cho thao tác (thêm View/Delete/Flush)
    if (dbData.total > 0 && dbData.items.length > 0) {
      let currentPage = dbData.page;
      while (true) {
        const resp = await inquirer.prompt([{
          type: 'list',
          name: 'next',
          message: 'Chọn thao tác:',
          choices: [
            { name: '👁️  View profile', value: 'view' },
            { name: '🗑️  Delete profile', value: 'delete' },
            // 👇 thêm option Flush Redis cache ngay trong menu Search DB
            { name: '🧹  Flush Redis cache', value: 'flush_redis' },
            { name: '➡️  Next page', value: 'next' },
            { name: '⬅️  Prev page', value: 'prev' },
            { name: '↩️  Back to search filters', value: 'back' },
            { name: '🏠  Main menu', value: 'home' }
          ]
        }]);

        if (resp.next === 'view') {
          const idx = await promptIndex(dbData.items.length, 'Nhập No để xem chi tiết:');
          if (idx == null) { console.log('⚠ Chỉ số không hợp lệ.'); continue; }
          const chosen = dbData.items[idx];
          try {
            const full = await fetchDbProfileById(chosen.id || chosen._id);
            printProfile(full);
          } catch (e) { handleError(e); }
          continue;
        }

        if (resp.next === 'delete') {
          const idx = await promptIndex(dbData.items.length, 'Nhập No để DELETE khỏi DB:');
          if (idx == null) { console.log('⚠ Chỉ số không hợp lệ.'); continue; }
          const chosen = dbData.items[idx];
          const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', default: false, message: `Xóa tác giả ID=${chosen.id || chosen._id}?` }]);
          if (!confirm) { console.log('❎ Hủy xóa.'); continue; }
          try {
            await deleteProfileInDb(chosen.id || chosen._id);
            console.log('✅ Đã xóa khỏi DB.');
            // (tuỳ chọn) reload lại dữ liệu trang hiện tại sau khi xóa
            dbData = await searchFilters({ ...params, page: currentPage });
            renderAuthorsTable(dbData);
          } catch (e) { handleError(e); }
          continue;
        }

        if (resp.next === 'flush_redis') {
          try {
            const result = await flushRedis();
            if (result && result.ok) {
              console.log('✅  Đã flush Redis cache thành công.');
              if (result.scope) console.log(`Scope: ${result.scope}`);
              if (result.db != null) console.log(`DB: ${result.db}`);
              if (result.detail) console.log(result.detail);
            } else {
              console.log('⚠️  Flush Redis trả về trạng thái không thành công.');
              if (result && result.detail) console.log(result.detail);
            }
          } catch (e) {
            handleError(e, 'Flush Redis thất bại');
          }
          // Sau khi flush, reload lại dữ liệu trang hiện tại (giữ nguyên query/page/limit)
          try {
            dbData = await searchFilters({ ...params, page: currentPage });
            renderAuthorsTable(dbData);
          } catch (e) {
            handleError(e);
          }
          continue;
        }

        if (resp.next === 'next' || resp.next === 'prev') {
          // Trả về cho caller xử lý phân trang như hiện trạng
          return resp.next;
        }
        // back | home
        return resp.next;
      }
    }

    // Fallback OpenAlex nếu không có DB và có name
    if (!params.name) {
      console.log('📭 Database: không có kết quả. Không thể fallback OpenAlex vì thiếu tên.');
      const resp = await inquirer.prompt([{
        type: 'list', name: 'next', message: 'Chọn thao tác:',
        choices: [
          { name: '↩️  Back to search filters', value: 'back' },
          { name: '🏠  Main menu', value: 'home' }
        ]
      }]);
      return resp.next;
    }

    console.log('⏳ Loading OpenAlex... (fallback)');
    const action = await openAlexMenu({ name: params.name, page: 1, limit: params.limit || 20 });

    if (action === 'back_db') {
      // Quay lại bảng DB (dù DB rỗng, vẫn render để giữ flow nhất quán)
      renderAuthorsTable(dbData);
      const resp = await inquirer.prompt([{
        type: 'list', name: 'next', message: 'Chọn thao tác:',
        choices: [
          { name: '↩️  Back to search filters', value: 'back' },
          { name: '🏠  Main menu', value: 'home' }
        ]
      }]);
      return resp.next;
    }

    return action; // 'back' | 'home' | 'next' | 'prev'
  } catch (err) {
    handleError(err);
    return 'home';
  }
}

module.exports = { runFilterFlow };
