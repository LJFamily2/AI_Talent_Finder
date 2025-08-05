//==================================================================
// Author CLI Handler
// Provides interactive CLI for searching, viewing, deleting, and saving author profiles
// using Inquirer for all user input with grouped actions and OpenAlex fallback
//==================================================================

const inquirer = require('inquirer');
const axios    = require('axios');
const { showProfile, renderList } = require('./renderCli');

const API_BASE = 'http://localhost:5000/api';
const LIMIT    = 20;

//-------------------------------
// API Helpers
//-------------------------------
/**
 * Search authors in local DB by name
 */
async function fetchDbCandidates(name, page, limit) {
  const res = await axios.get(`${API_BASE}/author/search-author`, {
    params: { name, page, limit }
  });
  return res.data; // { total, candidates: [] }
}

/**
 * Retrieve a single author profile from DB
 */
async function fetchDbProfile(id) {
  const res = await axios.get(`${API_BASE}/author/search-author`, {
    params: { id }
  });
  return res.data.profile;
}

/**
 * Delete an author profile from DB by ID
 */
async function deleteProfile(id) {
  const res = await axios.delete(`${API_BASE}/author/delete-profile`, {
    data: { id }
  });
  return res.data;
}

/**
 * Flush Redis cache for authors
 */
async function flushRedis() {
  const res = await axios.post(`${API_BASE}/author/flush-redis`);
  return res.data;
}

/**
 * Fetch authors from OpenAlex by name
 */
async function fetchOpenCandidates(name, page, limit) {
  const res = await axios.get(`${API_BASE}/author/fetch-author`, {
    params: { name, page, limit }
  });
  return res.data; // { total, authors: [] }
}

/**
 * Retrieve a single author profile from OpenAlex
 */
async function fetchOpenProfile(id) {
  const res = await axios.get(`${API_BASE}/author/fetch-author`, {
    params: { id }
  });
  return res.data.profile;
}

/**
 * Save a profile (from OpenAlex) into local DB
 */
async function saveProfile(profile) {
  const res = await axios.post(`${API_BASE}/author/save-profile`, profile);
  return res.data;
}

//==================================================================
// Main Flow: Author Search & Manage Profiles
//==================================================================
async function runAuthorFlow(done) {
  let name = '';
  let page = 1;
  let candidates = [];
  let total = 0;

  // Step 1: Prompt for author name
  async function askName() {
    const { inputName } = await inquirer.prompt([
      { type: 'input', name: 'inputName', message: 'Enter author name to search:' }
    ]);
    name = inputName.trim();
    page = 1;
    return runSearch();
  }

  // Step 2: Search local DB
  async function runSearch() {
    // Fetch from DB
    ({ total, candidates } = await fetchDbCandidates(name, page, LIMIT));
    const pages = Math.max(1, Math.ceil(total / LIMIT));

    console.clear();
    console.log(`DB Search Results for "${name}" (Page ${page}/${pages}, Total ${total})`);
    renderList(candidates, page, total, 'DB');

    // Build menu choices
    const choices = [
      { name: '👁️   View profiles', value: 'view_all' },
      { name: '🗑️   Del profiles',  value: 'delete_all' },
    ];
    if (total === 0) {
      choices.push({ name: '🌐 Fetch from OpenAlex', value: 'openalex' });
    }
    choices.push(
      new inquirer.Separator(),
      { name: '▶️   Next Page',      value: 'next' },
      { name: '◀️   Prev Page',      value: 'prev' },
      { name: '↩️   Back to Search', value: 'back' },
      { name: '🏠  Main Menu',       value: 'menu' },
      { name: '🧹  Flush Redis',     value: 'flush' },
    );
    if (total === 0) {
      choices.push({ name: '🌐  Fetch from OpenAlex', value: 'openalex' });
    }
    choices.push(
      new inquirer.Separator(),
      { name: '▶️   Next Page',      value: 'next' },
      { name: '◀️   Prev Page',      value: 'prev' },
      { name: '↩️   Back to Search', value: 'back' },
      { name: '🏠  Main Menu',      value: 'menu' }
    );

    const { action } = await inquirer.prompt([
      { type: 'list', name: 'action', message: 'Select action:', choices }
    ]);

    // Handle view_all
    if (action === 'view_all') {
      const { idx } = await inquirer.prompt([
        { type: 'input', name: 'idx',
          message: 'Enter number for view profile:',
          validate: v => {
            const n = parseInt(v, 10);
            return (n >= 1 && n <= candidates.length) || 'Invalid selection';
          }
        }
      ]);
      const i = parseInt(idx, 10) - 1;
      const profile = await fetchDbProfile(candidates[i]._id);
      await showProfile(profile, 'DB');
      return runSearch();
    }

    // Handle delete_all
    if (action === 'delete_all') {
      const { idx } = await inquirer.prompt([
        { type: 'input', name: 'idx',
          message: 'Enter number to delete profile:',
          validate: v => {
            const n = parseInt(v, 10);
            return (n >= 1 && n <= candidates.length) || 'Invalid selection';
          }
        }
      ]);
      const i = parseInt(idx, 10) - 1;
      const result = await deleteProfile(candidates[i]._id);
      console.log('🗑️ ', result.message);
      return runSearch();
    }

    // Fetch from OpenAlex if chosen
    if (action === 'openalex') return runOpenAlex();

    // Pagination actions
    if (action === 'next' && page < pages) {
      page++;
      return runSearch();
    }
    if (action === 'prev' && page > 1) {
      page--;
      return runSearch();
    }

        // Handle flush Redis action
    if (action === 'flush') {
      const result = await flushRedis();
      console.log('🧹 ', result.message || 'Redis cache flushed.');
      return runSearch();
    }

    // Navigation
    if (action === 'back') return askName();
    if (action === 'menu') return done();

    return runSearch();
  }

  // Step 3: OpenAlex fallback
  async function runOpenAlex() {
    const { total: oTotal, authors } = await fetchOpenCandidates(name, page, LIMIT);
    const pages = Math.max(1, Math.ceil(oTotal / LIMIT));

    console.clear();
    console.log(`OpenAlex Results for "${name}" (Page ${page}/${pages}, Total ${oTotal})`);
    renderList(authors, page, oTotal, 'OpenAlex');

    // Build menu choices
    const choices = [
      { name: '👁️  View profiles', value: 'view_all' },
      { name: '💾  Save all to DB', value: 'save_all' },
      new inquirer.Separator(),
      { name: '↩️  Back to DB Search', value: 'db'   },
      { name: '🏠  Main Menu',          value: 'menu' }
    ];

    const { action } = await inquirer.prompt([
      { type: 'list', name: 'action', message: 'Select action:', choices }
    ]);

    // View from OpenAlex
    if (action === 'view_all') {
      const { idx } = await inquirer.prompt([
        { type: 'input', name: 'idx',
          message: 'Enter number for view profile:',
          validate: v => {
            const n = parseInt(v, 10);
            return (n >= 1 && n <= authors.length) || 'Invalid selection';
          }
        }
      ]);
      const i = parseInt(idx, 10) - 1;
      const profile = await fetchOpenProfile(authors[i]._id);
      await showProfile(profile, 'OpenAlex');
      return runOpenAlex();
    }

    // Save all to DB
    if (action === 'save_all') {
      for (const prof of authors) {
        const res = await saveProfile(prof);
        console.log('💾 ', res.message);
      }
      return runOpenAlex();
    }

    // Back to DB search
    if (action === 'db') return runSearch();

    // Main Menu
    if (action === 'menu') return done();

    return runOpenAlex();
  }

  // Kick off the flow
  await askName();
}

//-------------------------------
// Export for CLI use
//-------------------------------
module.exports = { runAuthorFlow };