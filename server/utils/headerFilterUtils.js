/**
 * Utility to filter headers based on publication pattern
 * Returns all headers unless any header matches publication pattern, in which case only those are returned.
 *
 * @param {Array} headers - Array of header objects { text, lineNumber, index }
 * @param {Object} classifier - Instance of SimpleHeaderClassifier
 * @param {Array} lines - Array of all lines from CV text
 * @returns {Array} Filtered header objects
 */
function getFilteredHeaders(headers, classifier, lines) {
  if (!Array.isArray(headers) || !classifier || !Array.isArray(lines)) {
    return headers;
  }
  const publicationHeaders = [];
  for (const header of headers) {
    const features = classifier.extractFeatures(
      header.text,
      header.index,
      lines.length
    );
    if (features.matchesPublicationPattern) {
      publicationHeaders.push(header);
    }
  }
  return publicationHeaders.length > 0 ? publicationHeaders : headers;
}

module.exports = {
  getFilteredHeaders,
};
