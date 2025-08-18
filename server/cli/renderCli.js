// renderCli.js — Small ASCII table renderers for DB & OpenAlex (wider cols + ellipsis)
function padCell(text = '', len = 10) {
  const s = String(text);
  if (s.length <= len) return s + ' '.repeat(len - s.length);
  if (len <= 1) return s.slice(0, len);
  return s.slice(0, Math.max(0, len - 1)) + '…';
}

function row(cols, widths) {
  return '│ ' + cols.map((c, i) => padCell(c, widths[i])).join(' │ ') + ' │';
}

function border(widths, type = 'top') {
  const total = widths.reduce((a, b) => a + b + 3, 1) + 1; // account for separators
  const horiz = '─'.repeat(total - 2);
  if (type === 'top') return '┌' + horiz + '┐';
  if (type === 'mid') return '├' + horiz + '┤';
  return '└' + horiz + '┘';
}

function renderAuthorsTable({ source, page, pages, items = [], total }) {
  // widened columns to avoid truncation of country/topic/fields/ID
  const widths = [4, 28, 36, 16, 32, 36, 4, 6, 28];

  console.log(border(widths, 'top'));
  console.log(row(
    ['No', 'Name', 'Current Affiliation', 'Identifiers', 'Topics (top3)', 'Fields (top5)', 'h', 'i10', 'ID'],
    widths
  ));
  console.log(row(
    ['', '', '(Country)', '', '', '', '', '', ''],
    widths
  ));

  if (!items.length) {
    console.log(border(widths, 'bottom'));
    console.log(`Source: ${String(source).toUpperCase()} | Page ${page}/${pages} | Rows: 0 | Total: ${total ?? 0}`);
    return;
  }

  items.forEach((it, idx) => {
    const no = (idx + 1).toString();
    const name = it.name || '';
    const aff = it.currentAffiliation
      ? `${it.currentAffiliation.display_name || '—'} (${it.currentAffiliation.country_code || '—'})`
      : '— (—)';

    const idents = [];
    if (it.identifiers?.orcid) idents.push('ORCID');
    if (it.identifiers?.scopus) idents.push('SCOPUS');
    if (it.identifiers?.mag) idents.push('MAG');
    const identifiers = idents.join('|') || '—';

    const topics = (it.topics || []).join(', ') || '—';
    const fields = (it.fields || []).join(', ') || '—';
    const h = it.h ?? '—';
    const i10 = it.i10 ?? '—';
    const id = it.id || '';

    console.log(row([no, name, aff, identifiers, topics, fields, String(h), String(i10), id], widths));
  });

  console.log(border(widths, 'bottom'));
  console.log(`Source: ${String(source).toUpperCase()} | Page ${page}/${pages} | Rows: ${items.length} | Total: ${total ?? items.length}`);
}

module.exports = { renderAuthorsTable };
