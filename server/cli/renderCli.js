//==================================================================
// CLI Render Utilities
// Provides reusable CLI render functions for viewing profiles, lists
//==================================================================

//==================================================================
// Utility: Promisified readline wrapper for input prompt
//==================================================================
function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
}

//==================================================================
// Renderer: Pretty print full profile in terminal
//==================================================================

async function showProfile(rl, profile, src) {
  console.clear();
  console.log(`\n┌────────────────────────────────────────────────────────────────┐`);
  console.log(`│                      Author Profile (${src})                   │`);
  console.log(`├────────────────────────────────────────────────────────────────┤`);
  console.log(`ID:   ${profile._id}`);
  console.log(`Name: ${profile.basic_info?.name || "(no name)"}`);
  console.log("──────────────────────────────────────────────────────────────────");

  console.log("Affiliations:");
  console.table(profile.basic_info.affiliations.map(a => ({
    Institution: a.institution.display_name,
    Country: a.institution.country_code || "(none)",
    ROR: a.institution.ror,
    Years: Array.isArray(a.years) ? a.years.join(", ") : "(none)"
  })));

  console.log("Identifiers:");
  console.table(Object.entries(profile.identifiers).map(([key, val]) => ({
    Identifier: key,
    Value: val || "(none)"
  })));

  console.log("Research Metrics:");
  console.table(Object.entries(profile.research_metrics).map(([metric, val]) => ({
    Metric: metric,
    Value: val
  })));

  console.log("Research Areas – Fields:");
  profile.research_areas.fields
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .forEach(f => console.log(` • ${f.display_name} (count: ${f.count || 0})`));

  console.log("Research Areas – Topics:");
  profile.research_areas.topics.forEach(t =>
    console.log(` • ${t.display_name} (count: ${t.count})`)
  );

  if (Array.isArray(profile.works) && profile.works.length) {
    console.log("Works:");
    console.table(profile.works.map(w => ({
      Title: w.title || "(no title)",
      DOI: w.doi || "(none)"
    })));
  }

  if (profile.citation_trends?.counts_by_year) {
    console.log("Citation Trends (counts_by_year):");
    console.table(profile.citation_trends.counts_by_year);
  }

  if (profile.current_affiliation) {
    console.log("Current Affiliation:");
    console.table([{
      Institution: profile.current_affiliation.display_name || profile.current_affiliation.institution,
      ROR: profile.current_affiliation.ror,
      Country: profile.current_affiliation.country_code || "(none)"
    }]);
  }

  await question(rl, "Press Enter to continue...");
}

//==================================================================
// Renderer: Print list of authors with page info
//==================================================================
function renderList(list, page, total, src = "DB") {
  const pages = Math.max(1, Math.ceil(total / 25));
  console.log(`Search Candidates from ${src} (Page ${page}/${pages}, Total ${total})`);
  console.table(list.map((p, i) => ({
    No: i + 1,
    Name: p.name || p.basic_info?.name || "(no name)",
    ID: p._id,
    Src: src
  })));
}

//==================================================================
// Renderer: Build description string from filter object
//==================================================================
function renderFilterHeader(filters = {}) {
  const desc = [];
  if (filters.country) desc.push(`country="${filters.country}"`);
  if (filters.topic) desc.push(`topic="${filters.topic}"`);
  if (filters.hindex) desc.push(`h-index="${filters.hindex}" (op: ${filters.hOp})`);
  if (filters.i10index) desc.push(`i10-index="${filters.i10index}" (op: ${filters.i10Op})`);
  if (filters.identifier) desc.push(`identifier="${filters.identifier}"`);
  return desc.join(", ");
}

//==================================================================
// Exports
//==================================================================
module.exports = {
  question,
  showProfile,
  renderList,
  renderFilterHeader
};
