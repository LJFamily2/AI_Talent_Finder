//==================================================================
// Author CLI Handler
// CLI interface to search, view, fetch, save, delete author profiles
//==================================================================

const axios = require("axios");
const readline = require("readline");
const { showProfile, question } = require("./renderCli");

const API_BASE = "http://localhost:5000/api";


//------------------------------------------------------------------
// API Helpers
//------------------------------------------------------------------
const fetchDbCandidates = async (name, page, limit) =>
  (await axios.get(`${API_BASE}/author/search-author`, { params: { name, page, limit } })).data;

const fetchDbProfile = async (id) =>
  (await axios.get(`${API_BASE}/author/search-author`, { params: { id } })).data.profile || null;

const fetchOpenCandidates = async (name, page, limit) =>
  (await axios.get(`${API_BASE}/author/fetch-author`, { params: { name, page, limit } })).data;

const fetchOpenProfile = async (id) =>
  (await axios.get(`${API_BASE}/author/fetch-author`, { params: { id } })).data.profile || null;

const saveProfile = async (profile) =>
  (await axios.post(`${API_BASE}/author/save-profile`, { profile })).data;

const deleteProfile = async (id) =>
  (await axios.delete(`${API_BASE}/author/delete-profile`, { data: { id } })).data;

const flushRedis = async () =>
  (await axios.post(`${API_BASE}/author/flush-redis`)).data;

//==================================================================
// Main Entry Flow
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

      const cmd = await question(rl, "Enter No = View, d <No> = Delete Profile, r = Redis flush, n = Next Page, p = Prev Page, b = Back To Search Candidates, M = Main Menu: ");
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
          console.log("🗑️", result.message);
          await question(rl, "Press Enter to continue...");
        }
        continue;
      }

      const idx = parseInt(lower, 10) - 1;
      if (!isNaN(idx) && candidates[idx]) {
        const profile = await fetchDbProfile(candidates[idx]._id);
        await showProfile(rl, profile, "DB");
      }
    }

    runAuthorFlow(rl, done);
  });
}

//==================================================================
// Sub-Flow: Fetch from OpenAlex API
//==================================================================
async function runFetchLoop(rl, name, done) {
  const limit = 25;
  let page = 1;

  while (true) {
    const { total, authors = [] } = await fetchOpenCandidates(name, page, limit);
    const pages = Math.max(1, Math.ceil(total / limit));

    console.clear();
    console.log(`Fetch OpenAlex for "${name}" (Page ${page}/${pages}, Total ${total})`);
    console.table(authors.map((a, i) => ({
      No: i + 1,
      Name: a.name,
      ID: a._id,
      Src: "OpenAlex"
    })));

    const cmd = await question(rl, "Enter No = View, r = Redis flush, n = Next Page, p = Prev Page, b = Back To Search Candidates, M = Main Menu: ");
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
      await showProfile(rl, profile, "OpenAlex");

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
// CLI Entrypoint
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
