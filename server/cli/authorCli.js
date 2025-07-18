//==================================================================
// Author CLI Handler for Academic Talent Finder
// Handles DB and OpenAlex interactions via command-line interface
//==================================================================

const axios = require("axios");
const readline = require("readline");
const API_BASE = "http://localhost:5000/api";

//==================================================================
// Utility: Promisified readline question prompt
//==================================================================
function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
}

//==================================================================
// CLI Display: Render full profile in terminal view
//==================================================================
async function showProfile(profile, src) {
  console.clear();
  console.log(`┌────────────────────────────────────────────────────────────────┐`);
  console.log(`│                      Author Profile (${src})                    │`);
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
  .forEach(f =>
    console.log(` • ${f.display_name} (count: ${f.count || 0})`)
  );
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
  await question(readline.createInterface({ input: process.stdin, output: process.stdout }), "Press Enter to continue...");
}

//==================================================================
// API Request Helpers for DB and OpenAlex endpoints
//==================================================================
async function fetchDbCandidates(name, page, limit) {
  const res = await axios.get(`${API_BASE}/author/search-author`, { params: { name, page, limit } });
  return res.data;
}

async function fetchDbProfile(id) {
  const res = await axios.get(`${API_BASE}/author/search-author`, { params: { id } });
  return res.data.profile || null;
}

async function fetchOpenCandidates(name, page, limit) {
  const res = await axios.get(`${API_BASE}/author/fetch-author`, { params: { name, page, limit } });
  return res.data;
}

async function fetchOpenProfile(id) {
  const res = await axios.get(`${API_BASE}/author/fetch-author`, { params: { id } });
  return res.data.profile || null;
}

async function saveProfile(profile) {
  const res = await axios.post(`${API_BASE}/author/save-profile`, { profile });
  return res.data;
}

async function deleteProfile(id) {
  const res = await axios.delete(`${API_BASE}/author/delete-profile`, { data: { id } });
  return res.data;
}

async function flushRedis() {
  const res = await axios.post(`${API_BASE}/author/flush-redis`);
  return res.data;
}

//==================================================================
// Main Flow: Interactive CLI for DB Author Search & View
//==================================================================
function runAuthorFlow(rl, done) {
  const limit = 25;
  rl.question("Enter author name (or b=back, m=main menu): ", async input => {
    const name = input.trim();
    if (!name || name === "b") return runAuthorFlow(rl, done);
    if (name === "m") return done();

    let page = 1;
    let lastList = [];

    while (true) {
      const { total, candidates = [] } = await fetchDbCandidates(name, page, limit);
      const pages = Math.max(1, Math.ceil(total / limit));
      lastList = candidates;

      console.clear();
      console.log(`Search Candidates in DB for "${name}" (Page ${page}/${pages}, Total ${total})`);
      console.table(candidates.map((c, i) => ({
        No: i + 1,
        Name: c.name,
        ID: c._id,
        Src: "DB"
      })));

      const cmd = await question(rl, "Enter No=view, d<No>=delete, f=fetch(OpenAlex), r=Redis flush, n=next, p=prev, b=back, m=main: ");
      const lower = cmd.toLowerCase();

      if (lower === "m") return done();
      if (lower === "b") break;
      if (lower === "f") return runFetchLoop(rl, name, done);
      if (lower === "r") {
        await flushRedis();
        console.log("🧹 Redis cache flushed.");
        await question(rl, "Press Enter to continue...");
        continue;
      }
      if (lower === "n" && page < pages) { page++; continue; }
      if (lower === "p" && page > 1) { page--; continue; }

      if (lower.startsWith("d")) {
        const idx = parseInt(lower.slice(1), 10) - 1;
        if (!isNaN(idx) && lastList[idx]) {
          const result = await deleteProfile(lastList[idx]._id);
          console.log("🗑️ ", result.message);
          await question(rl, "Press Enter to continue...");
        }
        continue;
      }

      const idx = parseInt(lower, 10) - 1;
      if (!isNaN(idx) && candidates[idx]) {
        const profile = await fetchDbProfile(candidates[idx]._id);
        await showProfile(profile, "DB");
      }
    }

    runAuthorFlow(rl, done);
  });
}

//==================================================================
// Sub-Flow: Fetch from OpenAlex and prompt save
//==================================================================
async function runFetchLoop(rl, name, done) {
  const limit = 25;
  let page = 1;
  while (true) {
    const { total, authors = [] } = await fetchOpenCandidates(name, page, limit);
    const pages = Math.max(1, Math.ceil(total / limit));

    console.clear();
    console.log(`fetch OpenAlex for more DBs, by search for "${name}" (Page ${page}/${pages}, Total ${total})`);
    console.table(authors.map((a, i) => ({
      No: i + 1,
      Name: a.name,
      ID: a._id,
      Src: "OpenAlex"
    })));

    const cmd = await question(rl, "Enter No=view, r=Redis flush, n=next, p=prev, b=back, m=main: ");
    const lower = cmd.toLowerCase();

    if (lower === "m") return done();
    if (lower === "b") return runAuthorFlow(rl, done);
    if (lower === "r") {
        await flushRedis();
        console.log("🧹 Redis cache flushed.");
        await question(rl, "Press Enter to continue...");
        continue;
      }
    if (lower === "n" && page < pages) { page++; continue; }
    if (lower === "p" && page > 1) { page--; continue; }

    const idx = parseInt(lower, 10) - 1;
    if (!isNaN(idx) && authors[idx]) {
      const profile = await fetchOpenProfile(authors[idx]._id);
      await showProfile(profile, "OpenAlex");

      const yn = await question(rl, "Save this profile to MongoDB? (y/n): ");
      if (yn.toLowerCase() === "y") {
        const result = await saveProfile(profile);
        console.log("🟢", result.message);
        await question(rl, "Press Enter to continue...");
      }
    }
  }
}

//==================================================================
// CLI Entrypoint (if run directly)
//==================================================================
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  runAuthorFlow(rl, () => {
    console.log("Goodbye!");
    rl.close();
    process.exit(0);
  });
}

module.exports = { runAuthorFlow };