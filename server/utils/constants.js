/**
 * Constants for CV Processing
 *
 * This module contains shared constants used across the CV processing system.
 */

/**
 * Patterns for identifying academic publication sections in CVs
 * @constant {RegExp[]}
 */
const PUBLICATION_PATTERNS = [
  /^publications?$/i,
  /^policy publications?$/i,
  /^selected publications$/i,
  /^conference presentations$/i,
  /^journal (articles|publications)$/i,
  /^conference (papers|publications)$/i,
  /^peer[- ]?reviewed publications$/i,
  /^in-progress manuscripts$/i,
  /^policy-related publications$/i,
  /^workshop papers$/i,
  /^technical reports$/i,
  /^book chapters$/i,
  /^book reviews$/i,
  /^research publications$/i,
  /^published works$/i,
  /^scholarly publications$/i,
  /^papers$/i,
  /^articles$/i,
  /^conference articles$/i,
  /^experience$/i,
  /^conferences?$/i,
  /^White House Reports$/i,
  /^Policy-related Publications and Reports$/i,
  /^Workshop Papers and Technical Reports$/i,
  /^Thesis$/i,
  /^PATENTS$/i,
  /^journal articles$/i,
  /^publications? and presentations?$/i,
  /^authored publications?$/i,
  /^selected publications? and presentations?$/i,
  /^recent publications?$/i,
  /^refereed publications?$/i,
  /^conference proceedings?$/i,
  /^published abstracts?$/i,
  /^invited publications?$/i,
  /^works in (progress|preparation)$/i,
  /^academic publications?$/i,
  /^scientific publications?$/i,
];

module.exports = {
  PUBLICATION_PATTERNS,
};
