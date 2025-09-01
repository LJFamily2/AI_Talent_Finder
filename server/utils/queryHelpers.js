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
// Chấp nhận: ?a=1&a=2 | a=1|2 | a=1,2 | a=1 or 2 | a=1 và 2 | a=1 hoặc 2
function normalizeToComma(input = "") {
  if (!input || typeof input !== "string") return "";
  let s = input
    .replace(/\s+(or|and|hoặc|và)\s+/gi, ",")
    .replace(/[|/;&]/g, ",")
    .trim();
  s = s.replace(/,+/g, ",");
  s = s.replace(/\s*,\s*/g, ",");
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
/** Safe case-insensitive regex from user text (supports quoted phrase). */
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

// Helper to build numeric conditions
const buildComparison = (filter) => {
  const { operator, value } = filter;
  switch (operator) {
    case ">": return { $gt: value };
    case ">=": return { $gte: value };
    case "<": return { $lt: value };
    case "<=": return { $lte: value };
    case "=": return value;
    default: return value;
  }
};

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
  buildComparison,
  buildMetricCond,              // Mongo
  buildExternalMetricCond,      // OpenAlex

  // year-range
  parseYearBounds,
  inYearRange,

  // pagination & utils
  clampPageLimit,
  clamp,
  toNumberSafe,
  parseBool
};
