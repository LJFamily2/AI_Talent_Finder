// utils/queryHelpers.js

//==============================
// Operators mapping (Unified)
//==============================
const MONGO_OPS_MAP = { eq: "$eq", gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte" };
const EXTERNAL_OPS_MAP = { eq: "", gt: ">", gte: ">=", lt: "<", lte: "<=" };

//==============================
// Basic utils
//==============================
function isBlank(v) {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function toNumberSafe(v) {
  if (isBlank(v)) return null;
  const n = Number(String(v).trim());
  return Number.isNaN(n) ? null : n;
}

function clamp(num, min, max, fallback = min) {
  const n = toNumberSafe(num);
  if (n === null) return fallback;
  return Math.min(Math.max(n, min), max);
}

function parseBool(input, defaultVal = false) {
  if (typeof input === "boolean") return input;
  if (input == null) return defaultVal;
  const s = String(input).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return defaultVal;
}

//==============================
// Multi-value normalize (OR)
//==============================
// Hỗ trợ: ?a=1&a=2 | a=1|2 | a=1,2 | a=1 or 2 | a=1 và 2 | a=1 hoặc 2
function normalizeToComma(input = "") {
  if (!input || typeof input !== "string") return "";
  let s = input
    .replace(/\s+(or|and|hoặc|và)\s+/gi, ",")
    .replace(/[|/;&]/g, ",")
    .trim();
  s = s.replace(/,+/g, ",").replace(/\s*,\s*/g, ",");
  return s;
}

/** Parse multi values as OR list; return array of trimmed strings. */
function parseMultiOr(input) {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return input.map(String).map(s => s.trim()).filter(Boolean);
  }
  const norm = normalizeToComma(String(input));
  if (!norm) return [];
  return norm.split(",").map(x => x.trim()).filter(Boolean);
}

//==============================
// Text helpers
//==============================
/** Safe, case-insensitive regex from user text (supports quoted phrase). */
function toSafeRegex(s) {
  const raw = String(s ?? "").replace(/^"|"$/g, "");
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

/** Quote a phrase for OpenAlex search= (keeps spaces intact) */
function quotePhrase(s) {
  if (s == null) return "";
  const raw = String(s).trim();
  if (!raw) return "";
  return `"${raw.replace(/"/g, '\\"')}"`;
}

/** Join phrases for OpenAlex search= (each item được quote) */
function buildSearchStringFromPhrases(arr) {
  const parts = (arr || [])
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .map(quotePhrase);
  return parts.join(" ").trim();
}

//==============================
// Operator helpers (unified)
//==============================
/** Normalize and choose operator: specific > global > default(eq) */
function chooseOp(specificOp, globalOp, defaultOp = "eq") {
  const allow = ["eq", "gt", "gte", "lt", "lte"];
  const pick = (v) => (allow.includes(String(v || "").toLowerCase()) ? String(v).toLowerCase() : null);
  return pick(specificOp) || pick(globalOp) || defaultOp;
}

/** Mongo: build numeric metric condition; skip only when truly missing/blank/NaN. */
function buildMetricCond(path, op, value) {
  const num = toNumberSafe(value);
  if (num === null) return undefined;
  const mongoOp = MONGO_OPS_MAP[String(op || "eq").toLowerCase()] || "$eq";
  return { [path]: { [mongoOp]: num } };
}

/** OpenAlex: build metric filter fragment: e.g. `summary_stats.h_index:>=10` */
function buildExternalMetricCond(field, op, value) {
  const num = toNumberSafe(value);
  if (num === null) return ""; // skip
  const sym = EXTERNAL_OPS_MAP[String(op || "eq").toLowerCase()] ?? "";
  return `${field}:${sym}${num}`;
}

//==============================
// Year-range helpers
//==============================
function parseYearBounds(from, to) {
  const yFrom = toNumberSafe(from);
  const yTo = toNumberSafe(to);
  return {
    from: Number.isInteger(yFrom) ? yFrom : null,
    to: Number.isInteger(yTo) ? yTo : null
  };
}

function inYearRange(years = [], from = null, to = null) {
  if (!Array.isArray(years) || years.length === 0) return false;
  if (from != null && to != null) return years.some(y => y >= from && y <= to);
  if (from != null) return years.some(y => y >= from);
  if (to != null) return years.some(y => y <= to);
  return true;
}

//==============================
// Pagination helpers
//==============================
/** Clamp page/limit; for DB: max 100, OA: max 200 (tùy nơi dùng) */
function clampPageLimit(page, limit, maxLimit, defaultLimit = 20) {
  const p = clamp(page, 1, Number.MAX_SAFE_INTEGER, 1);
  const l = clamp(limit, 1, maxLimit, defaultLimit);
  return { page: p, limit: l };
}

//==============================
// OpenAlex Author ID helpers (UNIFIED)
//==============================
/**
 * Chuẩn hóa Author ID về dạng `A123...` (uppercase).
 * - Chấp nhận: "A5035632164", "a5035632164",
 *              "https://openalex.org/A5035632164",
 *              "https://api.openalex.org/authors/A5035632164",
 *              "openalex.org/A5035632164", có/không slash cuối, query string...
 * - Nếu `strict: true` và không hợp lệ -> throw Error('INVALID_AUTHOR_ID')
 * - Nếu `strict: false` (mặc định) -> trả ""
 */
function normalizeAuthorId(raw, opts = { strict: false }) {
  if (raw == null) {
    if (opts.strict) throw new Error("INVALID_AUTHOR_ID");
    return "";
  }

  let s = String(raw).trim();
  if (!s) {
    if (opts.strict) throw new Error("INVALID_AUTHOR_ID");
    return "";
  }

  // 1) Cắt các prefix URL phổ biến để lấy tail
  //    Ví dụ: https://api.openalex.org/authors/A123?foo=1 -> "A123?foo=1"
  s = s
    .replace(/^https?:\/\//i, "")
    .replace(/^api\./i, "")
    .replace(/^openalex\.org\//i, "")
    .replace(/^authors\//i, "");

  // 2) Tách trước query/hash/fragment hoặc phần path tiếp theo
  //    Ví dụ: "A123?x=1" -> "A123"
  s = s.split(/[?#/]/)[0];

  // 3) Nếu sau khi cắt mà đã là A\d+ -> lấy luôn
  const direct = s.match(/^A\d+$/i);
  if (direct) return direct[0].toUpperCase();

  // 4) Fallback: Tìm token A\d+ nằm ở bất kỳ vị trí nào trong chuỗi ban đầu
  //    Dùng bản gốc upper để tăng độ match, nhưng vẫn đảm bảo lấy đúng nhóm A\d+
  const any = String(raw).toUpperCase().match(/A\d+/);
  if (any) return any[0];

  if (opts.strict) throw new Error("INVALID_AUTHOR_ID");
  return "";
}

/**
 * Đảm bảo document expose `_id` = A-id và không leak `id` dạng URL OpenAlex.
 * - Ưu tiên lấy từ `_id` > `id` > `identifiers.openalex`
 * - Nếu tìm được A-id hợp lệ -> set `_id` = A-id (uppercase)
 * - Nếu `id` là URL OpenAlex -> xóa để tránh client nhầm với `_id`
 */
function ensureAIdField(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const out = { ...doc };

  const candidate =
    out._id ||
    out.id ||
    (out.identifiers && (out.identifiers.openalex || out.identifiers.author || out.identifiers.id)) ||
    "";

  const norm = normalizeAuthorId(candidate);
  if (norm) out._id = norm;

  if (typeof out.id === "string" && /^https?:\/\/openalex\.org\/A/i.test(out.id)) {
    delete out.id;
  }
  return out;
}

//==============================
// Exports
//==============================
module.exports = {
  // maps
  MONGO_OPS_MAP,
  EXTERNAL_OPS_MAP,

  // multi-value
  normalizeToComma,
  parseMultiOr,

  // text
  toSafeRegex,
  quotePhrase,
  buildSearchStringFromPhrases,

  // operators & metrics
  chooseOp,
  buildMetricCond,              // Mongo
  buildExternalMetricCond,      // OpenAlex

  // year-range
  parseYearBounds,
  inYearRange,

  // pagination & utils
  clampPageLimit,
  clamp,
  toNumberSafe,
  parseBool,

  // id helpers
  normalizeAuthorId,
  ensureAIdField,
};
