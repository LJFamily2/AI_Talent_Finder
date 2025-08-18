// api.cli.js — All HTTP calls + normalizers (DB + OpenAlex)
const axios = require("axios");

const BASE_URL = (process.env.CLI_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

// ────────────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────────────
function cleanParams(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined || v === null) continue;
    if (typeof v === "number" && Number.isNaN(v)) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

// Chuẩn hoá ID người dùng nhập: Mongo ObjectId / AID / URL OpenAlex
function normalizeId(raw = "") {
  const s = String(raw || "").trim();
  if (!s) return null;

  const m = s.match(/openalex\.org\/(A\d+)/i);
  if (m) return { kind: "aid", value: m[1].toUpperCase() };

  if (/^A\d+$/i.test(s)) return { kind: "aid", value: s.toUpperCase() };

  // Mongo 24-hex
  if (/^[0-9a-fA-F]{24}$/.test(s)) return { kind: "mongo", value: s };

  return { kind: "unknown", value: s };
}

// ────────────────────────────────────────────────────────────────────────────────
/** Map one OpenAlex author to unified item */
function mapOpenAlexAuthor(a) {
  const id = a?.id
    ? String(a.id).replace("https://openalex.org/", "")
    : a?.ids?.openalex || a?.ids?.openalex_id || a?.id || "";

  const name =
    a?.display_name || (Array.isArray(a?.display_name_alternatives) ? a.display_name_alternatives[0] : "") || "";

  const inst = a?.last_known_institution || null;
  const currentAffiliation = inst
    ? { display_name: inst.display_name || "", country_code: inst.country_code || "" }
    : null;

  const identifiers = {
    orcid: a?.orcid || a?.ids?.orcid || null,
    scopus: a?.ids?.scopus || null,
    mag: a?.ids?.mag || null,
  };

  const topicsSrc = Array.isArray(a?.topics) ? a.topics : Array.isArray(a?.x_concepts) ? a.x_concepts : [];
  const topics = topicsSrc.map((t) => t?.display_name || t?.id || "").filter(Boolean).slice(0, 3);

  const fieldsSrc = Array.isArray(a?.fields) ? a.fields : Array.isArray(a?.x_concepts) ? a.x_concepts : [];
  const fields = fieldsSrc.map((f) => f?.display_name || f?.id || "").filter(Boolean).slice(0, 5);

  const h = a?.summary_stats?.h_index ?? a?.h_index ?? null;
  const i10 = a?.summary_stats?.i10_index ?? a?.i10_index ?? null;

  return { id, name, currentAffiliation, identifiers, topics, fields, h, i10 };
}

/** Map one DB doc → unified item for table */
function mapDbAuthor(it) {
  const id = it?._id || it?.id || "";
  const name = it?.basic_info?.name || it?.name || "";

  // current_affiliation nằm top-level (không phải basic_info)
  const ca = it?.current_affiliation || null;
  const currentAffiliation = ca
    ? { display_name: ca.display_name || "", country_code: ca.country_code || "" }
    : null;

  const identifiers = it?.identifiers || {};

  // research_areas.* là mảng object { display_name, count } → lấy tên
  const topics = Array.isArray(it?.research_areas?.topics)
    ? it.research_areas.topics.map((t) => t?.display_name).filter(Boolean).slice(0, 3)
    : Array.isArray(it?.topics)
    ? it.topics
    : [];

  const fields = Array.isArray(it?.research_areas?.fields)
    ? it.research_areas.fields.map((f) => f?.display_name).filter(Boolean).slice(0, 5)
    : Array.isArray(it?.fields)
    ? it.fields
    : [];

  const h = it?.research_metrics?.h_index ?? it?.metrics?.h_index ?? null;
  const i10 = it?.research_metrics?.i10_index ?? it?.metrics?.i10_index ?? null;

  return { id, name, currentAffiliation, identifiers, topics, fields, h, i10 };
}

// ────────────────────────────────────────────────────────────────────────────────
// Normalizers (list)
// ────────────────────────────────────────────────────────────────────────────────
function normalizeDbResponse(payloadIn) {
  // Một số controller trả { data: {...} }, số khác trả thẳng payload
  const payload =
    payloadIn?.data && payloadIn.items === undefined && payloadIn.results === undefined && payloadIn.authors === undefined
      ? payloadIn.data
      : payloadIn;

  // Ưu tiên "authors" (theo controller unified hiện tại)
  const rawArray = payload?.authors ?? payload?.items ?? payload?.results ?? [];
  const meta = payload?.meta || {};
  const page = payload?.page ?? meta?.page ?? 1;
  const limit = payload?.limit ?? meta?.per_page ?? 20;
  const total = payload?.total ?? meta?.total ?? meta?.count ?? rawArray.length;
  const pages = payload?.pages ?? (total && limit ? Math.ceil(total / limit) : 1);

  const items = rawArray.map(mapDbAuthor);
  return { source: "db", page, pages, limit, total, items };
}

function normalizeOpenAlexResponse(data) {
  const results = data?.results ?? [];
  const count = data?.meta?.count ?? results.length;
  const perPage = data?.meta?.per_page ?? 25;
  const page = data?.meta?.page ?? 1;
  const pages = Math.max(1, Math.ceil(count / perPage));

  const items = results.map(mapOpenAlexAuthor);
  return { source: "openalex", page, pages, limit: perPage, total: count, items };
}

// ────────────────────────────────────────────────────────────────────────────────
// Normalizer (single profile)
// ────────────────────────────────────────────────────────────────────────────────
function unwrapProfilePayload(payload) {
  // Accept: { profile }, { data: { profile } }, or direct profile / data
  if (!payload) return null;
  if (payload.profile) return payload.profile;
  if (payload.data && payload.data.profile) return payload.data.profile;
  if (payload.data) return payload.data; // đôi khi controller trả { success, data }
  return payload; // assume it's the profile itself
}

// ────────────────────────────────────────────────────────────────────────────────
//  API calls (lists)
// ────────────────────────────────────────────────────────────────────────────────
async function searchFilters(params) {
  const qp = cleanParams(params);
  const res = await axios.get(`${BASE_URL}/api/search-filters/search`, { params: qp });
  return normalizeDbResponse(res.data);
}

async function openAlexSearch({ name, page = 1, per_page = 25, ...rest }) {
  const qp = cleanParams({ search: name, per_page, page, ...rest });
  const res = await axios.get("https://api.openalex.org/authors", { params: qp });
  return normalizeOpenAlexResponse(res.data);
}

// ────────────────────────────────────────────────────────────────────────────────
/** API (single profile) */
// ────────────────────────────────────────────────────────────────────────────────
async function getDbProfileById(id) {
  // Controller unified hỗ trợ /search?id=...
  const res = await axios.get(`${BASE_URL}/api/search-filters/search`, { params: { id } });
  return unwrapProfilePayload(res.data);
}

async function getOpenAlexProfileById(id) {
  const res = await axios.get(`${BASE_URL}/api/search-filters/openalex`, { params: { id } });
  return unwrapProfilePayload(res.data);
}

// ────────────────────────────────────────────────────────────────────────────────
/** API (save / delete) */
// ────────────────────────────────────────────────────────────────────────────────
async function saveProfile(profileOrWrapper) {
  const body = profileOrWrapper?.profile ? profileOrWrapper : { profile: profileOrWrapper };
  const res = await axios.post(`${BASE_URL}/api/author/save-profile`, body);
  return unwrapProfilePayload(res.data) ?? res.data;
}

/**
 * Xoá hồ sơ trong DB theo Mongo _id hoặc OpenAlex AID.
 * Ưu tiên gọi kiểu path param: /api/author/delete-profile/:id
 * Nếu server cũ không khai báo :id? → fallback sang DELETE + body { id }.
 */
async function deleteProfile(idRaw) {
  const norm = normalizeId(idRaw);
  const id = norm?.value || idRaw;

  // Cách 1: path param
  const urlPath = `${BASE_URL}/api/author/delete-profile/${encodeURIComponent(id)}`;
  try {
    const r1 = await axios.delete(urlPath);
    return r1.data;
  } catch (e1) {
    // Nếu 404 hoặc route không tồn tại → thử Cách 2: body
    const status = e1?.response?.status;
    if (status && status !== 404) {
      // Những lỗi khác (400/500) thì bubble up
      throw e1;
    }
  }

  // Cách 2: body (axios.delete cần key "data")
  const urlBody = `${BASE_URL}/api/author/delete-profile`;
  const r2 = await axios.delete(urlBody, { data: { id } });
  return r2.data;
}

// ────────────────────────────────────────────────────────────────────────────────
// Admin ops — Flush Redis (for Search DB menu)
// ────────────────────────────────────────────────────────────────────────────────
async function flushRedis() {
  const flushPath = process.env.CLI_FLUSH_PATH || "/api/author/flush-redis";
  const url = `${BASE_URL}${flushPath}`;

  const headers = {};
  if (process.env.CLI_ADMIN_TOKEN) {
    headers["x-admin-token"] = process.env.CLI_ADMIN_TOKEN;
  }

  const res = await axios.post(url, {}, { headers });
  return res.data; // kỳ vọng { ok: true, ... }
}

module.exports = {
  BASE_URL,
  // lists
  searchFilters,
  openAlexSearch,
  normalizeDbResponse,
  normalizeOpenAlexResponse,
  mapOpenAlexAuthor,
  mapDbAuthor,
  cleanParams,
  // singles + CRUD
  getDbProfileById,
  getOpenAlexProfileById,
  saveProfile,
  deleteProfile,
  // admin
  flushRedis,
};
