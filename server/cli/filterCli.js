//==================================================================
// Filter CLI Handler
// CLI flow to search researcher profiles via multi-filters
//==================================================================

const axios = require("axios");
const { showProfile, renderFilterHeader, question } = require("./renderCli");

const API_BASE = "http://localhost:5000/api";

//------------------------------------------------------------------
// Main Exported Flow
//------------------------------------------------------------------
function runFilterFlow(rl, done) {
  const limit = 25;
  let filters = {
    country: '',
    topic: '',
    hindex: '',
    hOp: 'eq',
    i10index: '',
    i10Op: 'eq',
    identifier: '',
    page: 1
  };

  let lastList = [];

  //==============================================================
  // Prompt Filters
  //==============================================================
  async function askFilters() {
    console.clear();
    console.log("┌────────────────────────────────────────────────────────────────┐");
    console.log("│                      Multi-Filter Search                       │");
    console.log("├────────────────────────────────────────────────────────────────┤");
    console.log("│ (enter 'b' at any time to return to main menu)                │");
    console.log("└────────────────────────────────────────────────────────────────┘");

    filters.country = await question(rl, "Country code (e.g. VN, ...): ");
    if (filters.country === "b") return done();
    filters.topic = await question(rl, "Research topics & fields keyword: ");
    filters.hindex = await question(rl, "H-index value: ");
    filters.hOp = await question(rl, "H-index operator (eq|gte|lte): ") || "eq";
    filters.i10index = await question(rl, "i10-index value: ");
    filters.i10Op = await question(rl, "i10-index operator (eq|gte|lte): ") || "eq";
    filters.identifier = await question(rl, "Specific identifier (OpenAlex, ORCID, Scopus, Google Scholar): ");

    filters.page = 1;
    await runSearch();
  }

  //==============================================================
  // MongoDB Search
  //==============================================================
  async function runSearch() {
    try {
      const res = await axios.get(`${API_BASE}/search-filters/multi`, { params: filters });
      const { total, authors = [] } = res.data;
      const pages = Math.max(1, Math.ceil(total / limit));
      lastList = authors;

      console.clear();
      console.log(`Search Candidates In DB By Filters (Page ${filters.page}/${pages}, Total ${total})`);
      console.log("Filters By:", renderFilterHeader(filters));
      console.table(authors.map((a, i) => ({
        No: i + 1,
        Name: a.basic_info?.name || "(no name)",
        ID: a._id,
        Src: "DB"
      })));

      const cmd = await question(rl, "Enter No = View, d <No> = Delete Profile, r = Redis flush, n = Next Page, p = Prev Page, b = Back To Search Filters, M = Main Menu: ");

      const lower = cmd.toLowerCase();

      if (lower === "m") return done();
      if (lower === "b") return askFilters();
      if (lower === "r") {
        await axios.post(`${API_BASE}/author/flush-redis`);
        console.log("🧹 Redis cache flushed.");
        await question(rl, "Press Enter to continue...");
        return runSearch();
      }
      if (lower === "f") return fetchOpenAlex();
      if (lower === "n" && filters.page < pages) { filters.page++; return runSearch(); }
      if (lower === "p" && filters.page > 1) { filters.page--; return runSearch(); }

      if (lower.startsWith("d")) {
        const idx = parseInt(lower.slice(1), 10) - 1;
        if (!isNaN(idx) && lastList[idx]) {
          const result = await axios.delete(`${API_BASE}/author/delete-profile`, {
            data: { id: lastList[idx]._id }
          });
          console.log("🗑️", result.data.message);
          await question(rl, "Press Enter to continue...");
          return runSearch();
        }
      }

      const idx = parseInt(lower, 10) - 1;
      if (!isNaN(idx) && authors[idx]) {
        const res = await axios.get(`${API_BASE}/author/search-author`, { params: { id: authors[idx]._id } });
        await showProfile(rl, res.data.profile, "DB");
        return runSearch();
      }

      return runSearch();
    } catch (err) {
      console.error("❌ Error:", err.message);
      await question(rl, "Press Enter to return...");
      return done();
    }
  }

  //==============================================================
  // Fetch from OpenAlex
  //==============================================================
  async function fetchOpenAlex() {
    try {
      const res = await axios.get(`${API_BASE}/search-filters/openalex`, { params: filters });
      const { total = 0, authors = [] } = res.data;
      const pages = Math.max(1, Math.ceil(total / limit));

      console.clear();
      console.log(`Search Candidates By Fetch OpenAlex (Page ${filters.page}/${pages}, Total ${total})`);
      console.log("Filters By:", renderFilterHeader(filters));
      console.table(authors.map((a, i) => ({
        No: i + 1,
        Name: a.basic_info?.name || "(no name)",
        ID: a._id,
        Src: "OpenAlex"
      })));

      const cmd = await question(rl, "Enter No = View, r = Redis flush, n = Next Page, p = Prev Page, b = Back To Search Filters, M = Main Menu: ");
      const lower = cmd.toLowerCase();

      if (lower === "m") return done();
      if (lower === "b") return runSearch();
      if (lower === "r") {
        await axios.post(`${API_BASE}/admin/flush-redis`);
        console.log("🧹 Redis cache flushed.");
        await question(rl, "Press Enter to continue...");
        return fetchOpenAlex();
      }
      if (lower === "n" && filters.page < pages) { filters.page++; return fetchOpenAlex(); }
      if (lower === "p" && filters.page > 1) { filters.page--; return fetchOpenAlex(); }

      const idx = parseInt(lower, 10) - 1;
      if (!isNaN(idx) && authors[idx]) {
        const full = await axios.get(`${API_BASE}/author/fetch-author`, { params: { id: authors[idx]._id } });
        await showProfile(rl, full.data.profile, "OpenAlex");

        const yn = await question(rl, "Save this profile to MongoDB? (y/n): ");
        if (yn.toLowerCase() === "y") {
          const result = await axios.post(`${API_BASE}/author/save-profile`, {
            profile: full.data.profile
          });
          console.log("🟢", result.data.message);
        }

        await question(rl, "Press Enter to continue...");
        return fetchOpenAlex();
      }

      return fetchOpenAlex();
    } catch (err) {
      console.error("❌ Error fetching OpenAlex:", err.message);
      await question(rl, "Press Enter to return...");
      return runSearch();
    }
  }

  askFilters();
}

//------------------------------------------------------------------
// Export for CLI use
//------------------------------------------------------------------
module.exports = { runFilterFlow };
