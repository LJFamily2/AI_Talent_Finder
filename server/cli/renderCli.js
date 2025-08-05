//==================================================================
// CLI Render Utilities
// Provides reusable CLI render functions for viewing profiles and lists
//==================================================================

//-------------------------------
// Dependencies
//-------------------------------
// Use Inquirer for all interactive input prompts
const inquirer = require('inquirer');

//-------------------------------
// Renderer: Pretty print full author profile
//-------------------------------
/**
 * Displays an author's profile in the terminal with formatted tables,
 * then waits for the user to press Enter before returning.
 *
 * @param {Object} profile - The author profile object from the database or API
 * @param {string} src - Source label (e.g., "DB" or "OpenAlex")
 */
async function showProfile(profile, src = 'DB') {
  // Clear the console for a clean view
  console.clear();

  // Print header
  console.log(`\n┌────────────────────────────────────────────────────────────────┐`);
  console.log(`│                      Author Profile (${src})                   │`);
  console.log(`├────────────────────────────────────────────────────────────────┤`);
  console.log(`ID:   ${profile._id}`);
  console.log(`Name: ${profile.basic_info?.name || '(no name)'}`);
  console.log("──────────────────────────────────────────────────────────────────");

  // Affiliations table
  console.log("Affiliations:");
  console.table(
    profile.basic_info.affiliations.map(a => ({
      Institution: a.institution.display_name,
      Country: a.institution.country_code || '(none)',
      ROR: a.institution.ror,
      Years: Array.isArray(a.years) ? a.years.join(', ') : '(none)'
    }))
  );

  // Identifiers table
  console.log("Identifiers:");
  console.table(
    Object.entries(profile.identifiers).map(([key, val]) => ({
      Identifier: key,
      Value: val || '(none)'
    }))
  );

  // Research metrics table
  console.log("Research Metrics:");
  console.table(
    Object.entries(profile.research_metrics).map(([metric, val]) => ({
      Metric: metric,
      Value: val
    }))
  );

  // Research areas fields
  console.log("Research Areas – Fields:");
  profile.research_areas.fields
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .forEach(f => console.log(` • ${f.display_name} (count: ${f.count || 0})`));

  // Research areas topics
  console.log("Research Areas – Topics:");
  profile.research_areas.topics.forEach(t =>
    console.log(` • ${t.display_name} (count: ${t.count})`)
  );

  // Works table (if any)
  if (Array.isArray(profile.works) && profile.works.length) {
    console.log("Works:");
    console.table(
      profile.works.map(w => ({
        Title: w.title || '(no title)',
        DOI: w.doi || '(none)'
      }))
    );
  }

  // Citation trends (if available)
  if (profile.citation_trends?.counts_by_year) {
    console.log("Citation Trends (counts_by_year):");
    console.table(profile.citation_trends.counts_by_year);
  }

  // Current affiliation (if provided)
  if (profile.current_affiliation) {
    console.log("Current Affiliation:");
    console.table([{
      Institution: profile.current_affiliation.display_name || profile.current_affiliation.institution,
      ROR: profile.current_affiliation.ror,
      Country: profile.current_affiliation.country_code || '(none)'
    }]);
  }

  // Pause: wait for user to press Enter via Inquirer
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue'
    }
  ]);
}

//-------------------------------
// Renderer: Print list of authors with pagination info
//-------------------------------
/**
 * Renders a table of author candidates with page and total count.
 *
 * @param {Array} list - Array of author candidate objects
 * @param {number} page - Current page number
 * @param {number} total - Total number of candidates
 * @param {string} src - Source label (e.g., "DB" or "OpenAlex")
 */
function renderList(list, page, total, src = 'DB') {
  const pages = Math.max(1, Math.ceil(total / 20));
  console.log(`Search Candidates from ${src} (Page ${page}/${pages}, Total ${total})`);
  console.table(
    list.map((p, i) => ({
      No: i + 1,
      Name: p.name || p.basic_info?.name || '(no name)',
      ID: p._id,
      Src: src
    }))
  );
}

//-------------------------------
// Renderer: Build description string from filter object
//-------------------------------
/**
 * Constructs a human-readable description from the active filters.
 *
 * @param {Object} filters - Filters object containing search criteria
 * @returns {string} - Description string summarizing filters
 */
function renderFilterHeader(filters = {}) {
  const desc = [];
  if (filters.country) desc.push(`country="${filters.country}"`);
  if (filters.topic) desc.push(`topic="${filters.topic}"`);
  if (filters.hindex) desc.push(`h-index="${filters.hindex}" (op: ${filters.hOp})`);
  if (filters.i10index) desc.push(`i10-index="${filters.i10index}" (op: ${filters.i10Op})`);
  if (filters.identifier) desc.push(`identifier="${filters.identifier}"`);
  if (filters.affiliation) desc.push(`affiliation="${filters.affiliation}"`);
  if (filters.current_affiliation) desc.push(`current="${filters.current_affiliation}"`);
  if (filters.year_from || filters.year_to)
    desc.push(`years="${filters.year_from || '?'} → ${filters.year_to || '?'}"`);
  return desc.join(', ');
}

//-------------------------------
// Module Exports
//-------------------------------
module.exports = {
  showProfile,
  renderList,
  renderFilterHeader
};