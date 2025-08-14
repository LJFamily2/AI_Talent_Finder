// utils/queryHelpers.js
const opsMap = { eq: "$eq", gte: "$gte", lte: "$lte" };

/** Normalize all multi-value delimiters to commas (OR behavior). */
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

/** Safe case-insensitive regex from user text (supports quoted phrase). */
function toSafeRegex(s) {
  const raw = String(s).replace(/^"|"$/g, "");
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

/** Build numeric metric condition; skip only when truly missing/blank/NaN. */
function buildMetricCond(path, op, value) {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (raw === "") return undefined;          // don't swallow 0
  const num = Number(raw);
  if (Number.isNaN(num)) return undefined;
  const mongoOp = opsMap[op] || "$eq";
  return { [path]: { [mongoOp]: num } };
}

/** Quote a phrase for OpenAlex search= (keeps spaces intact) */
function quotePhrase(s) {
  if (s == null) return "";
  const raw = String(s).trim();
  if (!raw) return "";
  return `"${raw.replace(/"/g, '\\"')}"`;
}

module.exports = {
  normalizeToComma,
  parseMultiOr,
  toSafeRegex,
  buildMetricCond,
  quotePhrase,
};
