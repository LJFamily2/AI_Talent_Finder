// server/cli/filterCli.js
const axios = require("axios");
const readline = require("readline");

const API_BASE = "http://localhost:5000/api";

// Utility function to prompt user input
function question(rl, prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
}

async function fetchProfiles(params) {
  const res = await axios.get(`${API_BASE}/search-filters/multi`, { params });
  return res.data;
}

async function fetchOpenProfiles(params) {
  const res = await axios.get(`${API_BASE}/search-filters/openalex`, { params });
  return res.data;
}

async function fetchProfileById(id) {
  const res = await axios.get(`${API_BASE}/author/search-author`, { params: { id } });
  return res.data.profile || null;
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

// Main CLI entry for multi-filter workflow
function runFilterFlow(rl, done) {
  let page = 1, limit = 25;
  const filters = {
    country: "", topic: "", hindex: "", hOp: "eq",
    i10index: "", i10Op: "eq", identifier: ""
  };
  let lastList = [];

  // Ask user to fill filter options
  function askFilters() {
    console.clear();
    console.log("┌────────────────────────────────────────────────────────────────┐");
    console.log("│                      Multi-Filter Search                       │");
    console.log("├────────────────────────────────────────────────────────────────┤");
    console.log("│ (enter 'b' to return to main menu)                             │");
    console.log("└────────────────────────────────────────────────────────────────┘");
    rl.question("Country (or empty): ", c => {
      if (c.trim().toLowerCase() === "b") return done();
      filters.country = c.trim();
      rl.question("Topic   (or empty): ", t => {
        filters.topic = t.trim();
        rl.question("h-index (or empty): ", hi => {
          filters.hindex = hi.trim();
          rl.question("h-op [eq/gte/lte]: ", hop => {
            filters.hOp = ["eq", "gte", "lte"].includes(hop.trim()) ? hop.trim() : "eq";
            rl.question("i10-index (or empty): ", i10 => {
              filters.i10index = i10.trim();
              rl.question("i10-op [eq/gte/lte]: ", i10op => {
                filters.i10Op = ["eq", "gte", "lte"].includes(i10op.trim()) ? i10op.trim() : "eq";
                rl.question("Identifier (or empty): ", idt => {
                  filters.identifier = idt.trim();
                  page = 1;
                  listDbPage();
                });
              });
            });
          });
        });
      });
    });
  }

  // List MongoDB results
  async function listDbPage() {
    try {
      const params = { ...filters, op: filters.hOp, page, limit };
      const { total = 0, authors = [] } = await fetchProfiles(params);
      lastList = authors;
      const pages = Math.max(1, Math.ceil(total / limit));
      console.clear();
      console.log(`MongoDB Profiles (Page ${page}/${pages}, Total ${total})`);
      console.table(authors.map((a, i) => ({
        No: i + 1,
        Name: a.basic_info?.name || "(no name)",
        ID: a._id,
        Src: "DB"
      })));
      console.log("(No=view, d<No>=delete, f=fetch(OpenAlex), r=Redis flush, n=Next, p=Prev, b=Back, m=Menu)");
      rl.question("> ", async ans => {
        const cmd = ans.trim().toLowerCase();
        if (cmd === "m") return done();
        if (cmd === "b") return askFilters();
        if (cmd === "f") return listOpenAlexPage();
        if (cmd === "r") { await flushRedis(); console.log("🧹 Redis cache flushed."); return listDbPage(); }
        if (cmd === "n" && page < pages) { page++; return listDbPage(); }
        if (cmd === "p" && page > 1) { page--; return listDbPage(); }

        if (cmd.startsWith("d")) {
          const idx = parseInt(cmd.slice(1), 10) - 1;
          if (!isNaN(idx) && idx >= 0 && idx < lastList.length) {
            const target = lastList[idx];
            const { message } = await deleteProfile(target._id);
            console.log("🗑️", message);
          }
          return listDbPage();
        }

        const idx = parseInt(cmd, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < authors.length) {
          return viewProfile(authors[idx]._id, "DB", listDbPage);
        }

        listDbPage();
      });
    } catch (err) {
      console.error("Error fetching profiles:", err.message);
      askFilters();
    }
  }

  // List OpenAlex search results
  async function listOpenAlexPage() {
    try {
      const params = { ...filters, page, limit };
      const { total = 0, authors = [] } = await fetchOpenProfiles(params);
      const pages = Math.max(1, Math.ceil(total / limit));
      console.clear();
      console.log(`OpenAlex Profiles (Page ${page}/${pages}, Total ${total})`);
      console.table(authors.map((a, i) => ({
        No: i + 1,
        Name: a.basic_info?.name || "(no name)",
        ID: a._id,
        Src: "OpenAlex"
      })));
      console.log("(No=view, n=Next, p=Prev, b=Back to filters, m=Main menu)");
      rl.question("> ", async ans => {
        const cmd = ans.trim().toLowerCase();
        if (cmd === "m") return done();
        if (cmd === "b") return askFilters();
        if (cmd === "n" && page < pages) { page++; return listOpenAlexPage(); }
        if (cmd === "p" && page > 1)      { page--; return listOpenAlexPage(); }
        const idx = parseInt(cmd, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < authors.length) {
          const profile = await fetchOpenProfile(authors[idx]._id);
          await showAndMaybeSaveProfile(profile, listOpenAlexPage);
        } else {
          listOpenAlexPage();
        }
      });
    } catch (err) {
      console.error("Error fetching OpenAlex profiles:", err.message);
      askFilters();
    }
  }

  // View a profile by ID (either DB or OpenAlex)
  async function viewProfile(id, src, back) {
    try {
      const profile = await fetchProfileById(id);
      if (!profile) throw new Error("Profile not found");
      await showProfile(profile, src);
      back();
    } catch (err) {
      console.error("Error loading profile:", err.message);
      back();
    }
  }

  // View a profile and optionally save to MongoDB
  async function showAndMaybeSaveProfile(profile, back) {
  if (!profile) {
    console.log("❌ No profile found.");
    await question(rl, "Press Enter to continue...");
    return back();
  }

  await showProfile(profile, "OpenAlex");
  const yn = await question(rl, "Save this profile to MongoDB? (y/n): ");
  if (yn.toLowerCase() === "y") {
    const result = await saveProfile(profile);
    console.log("🟢", result.message);
  }
  await question(rl, "Press Enter to continue...");
  back();
}


  // Display full profile details
  async function showProfile(profile, src) {
    console.clear();
    console.log("┌────────────────────────────────────────────────────────────────┐");
    console.log(`│                      Author Profile (${src})                    │`);
    console.log("├────────────────────────────────────────────────────────────────┤");
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
    profile.research_areas.fields.forEach(f => console.log(` • ${f.display_name}`));
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
        ROR: profile.current_affiliation.ror
      }]);
    }
    await question(rl, "Press Enter to continue...");
  }

  askFilters();
}

module.exports = { runFilterFlow };

// Standalone execution support
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  runFilterFlow(rl, () => {
    console.log("Goodbye!");
    rl.close();
    process.exit(0);
  });
}