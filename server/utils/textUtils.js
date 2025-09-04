/**
 * Normalize a title by removing special characters and standardizing spaces
 * This function provides a general normalization suitable for academic title matching
 */
const normalizeTitle = (str) => {
  if (!str) return "";
  return (
    str
      .toLowerCase()
      // Remove all special characters and convert to spaces
      .replace(/[^\w\s]/g, "")
      // Normalize spaces
      .replace(/\s+/g, " ")
      .trim()
  );
};

const getNGrams = (text, n = 2) => {
  const ngrams = [];
  for (let i = 0; i < text.length - n + 1; i++) {
    ngrams.push(text.slice(i, i + n));
  }
  return ngrams;
};

const getWordSimilarity = (str1, str2) => {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter((word) => words2.includes(word));
  return (2.0 * commonWords.length) / (words1.length + words2.length);
};

const normalizeText = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/['′´`]/g, "'")
    .replace(/[""″]/g, '"')
    .replace(/\s*[-/]\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

const getTitleSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;

  const normalizedStr1 = normalizeText(str1);
  const normalizedStr2 = normalizeText(str2);

  if (normalizedStr1 === normalizedStr2) return 100;

  const wordSim = getWordSimilarity(normalizedStr1, normalizedStr2) * 100;
  if (wordSim > 90) return wordSim;

  const ngrams1 = getNGrams(normalizedStr1);
  const ngrams2 = getNGrams(normalizedStr2);

  const freq1 = {};
  const freq2 = {};

  ngrams1.forEach((ng) => (freq1[ng] = (freq1[ng] || 0) + 1));
  ngrams2.forEach((ng) => (freq2[ng] = (freq2[ng] || 0) + 1));

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  Object.keys(freq1).forEach((ng) => {
    if (freq2[ng]) {
      dotProduct += freq1[ng] * freq2[ng];
    }
    magnitude1 += freq1[ng] * freq1[ng];
  });

  Object.keys(freq2).forEach((ng) => {
    magnitude2 += freq2[ng] * freq2[ng];
  });

  const similarity =
    (dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))) * 100;

  return wordSim * 0.6 + similarity * 0.4;
};

module.exports = {
  getNGrams,
  getWordSimilarity,
  normalizeText,
  getTitleSimilarity,
  normalizeTitle,
};
