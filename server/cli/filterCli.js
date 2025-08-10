//==================================================================
// Filter CLI Handler
// Provides interactive CLI for search-filters searching,
// viewing, deleting, Redis-flushing profiles, and OpenAlex fallback
// using Inquirer with grouped actions for view and delete
//==================================================================

const inquirer = require('inquirer');
const axios    = require('axios');
const { showProfile, renderFilterHeader } = require('./renderCli');

const API_BASE = 'http://localhost:5000/api';
const LIMIT    = 20;

//-------------------------------
// API Helpers
//-------------------------------
async function fetchDbCandidates(filters) {
  const res = await axios.get(`${API_BASE}/search-filters/search`, { params: filters });
  return res.data; // { total, authors: [] }
}

async function fetchDbProfile(id) {
  const res = await axios.get(`${API_BASE}/author/search-author`, { params: { id } });
  return res.data.profile;
}

async function deleteProfile(id) {
  const res = await axios.delete(`${API_BASE}/author/delete-profile`, { data: { id } });
  return res.data;
}

async function flushRedis() {
  const res = await axios.post(`${API_BASE}/author/flush-redis`);
  return res.data;
}

async function fetchOpenCandidates(filters) {
  const res = await axios.get(`${API_BASE}/search-filters/openalex`, { params: filters });
  return res.data; // { total, authors: [] }
}

async function fetchOpenProfile(id) {
  const res = await axios.get(`${API_BASE}/author/fetch-author`, { params: { id } });
  return res.data.profile;
}

//==================================================================
// Main Flow: Multi-Filter Search & Manage Profiles
//==================================================================
async function runFilterFlow(done) {
  // Initialize filter state
  let filters = { country:'', topic:'', hindex:'', hOp:'eq', i10index:'', i10Op:'eq', identifier:'', affiliation:'', year_from:'', year_to:'', page:1 };
  let candidates = [];
  let total = 0;

  // Step 1: Ask filters
  async function askFilters() {
    filters.page = 1;
    const answers = await inquirer.prompt([
      { type:'input', name:'country', message:'Country code:', default:filters.country },
      { type:'input', name:'topic', message:'Topic keyword:', default:filters.topic },
      { type:'input', name:'hindex', message:'H-index:', default:filters.hindex },
      { type:'list',  name:'hOp',    message:'H-index op:', choices:['eq','gte','lte'], default:filters.hOp },
      { type:'input', name:'i10index', message:'i10-index:', default:filters.i10index },
      { type:'list',  name:'i10Op', message:'i10-index op:', choices:['eq','gte','lte'], default:filters.i10Op },
      { type:'list',  name:'identifier', message:'Identifier type:', choices:['','openalex'], default:filters.identifier },
      { type:'input', name:'affiliation', message:'Affiliation:', default:filters.affiliation },
      { type:'input', name:'year_from', message:'Year from:', default:filters.year_from },
      { type:'input', name:'year_to', message:'Year to:', default:filters.year_to }
    ]);
    Object.assign(filters, answers);
    return runSearch();
  }

  // Step 2: DB Search
  async function runSearch() {
    ({ total, authors: candidates } = await fetchDbCandidates(filters));
    const pages = Math.max(1, Math.ceil(total / LIMIT));

    console.clear();
    console.log(`Search Results (Page ${filters.page}/${pages}, Total ${total})`);
    console.log('Filters By:', renderFilterHeader(filters));
    console.table(candidates.map((a,i) => ({ No:i+1, Name:a.basic_info?.name||'(no name)', ID:a._id })));

    // Grouped actions
    const choices = [
      { name:'👁️   View profiles', value:'view_all' },
      { name:'🗑️   Del profiles',  value:'delete_all' }
    ];
    if (!candidates.length) {
      choices.push({ name:'🌐 OpenAlex fallback', value:'openalex' });
    }
    choices.push(
      new inquirer.Separator(),
      { name:'▶️   Next Page',      value:'next'  },
      { name:'◀️   Prev Page',      value:'prev'  },
      { name:'↩️   Back to Filters', value:'back'  },
      { name:'🏠  Main Menu',      value:'menu'  },
      { name:'🧹  Flush Redis',     value:'flush' },
    );

    const { action } = await inquirer.prompt([
      { type:'list', name:'action', message:'Select action:', choices }
    ]);

    if (action==='view_all') {
      const { idx } = await inquirer.prompt([{ type:'input', name:'idx', message:'Enter number to view:', validate:v=>{const n=parseInt(v);return n>=1&&n<=candidates.length||'Invalid';}}]);
      const prof=await fetchDbProfile(candidates[parseInt(idx)-1]._id);
      await showProfile(prof,'DB');
      return runSearch();
    }
    if (action==='delete_all') {
      const { idx } = await inquirer.prompt([{ type:'input', name:'idx', message:'Enter number to delete:', validate:v=>{const n=parseInt(v);return n>=1&&n<=candidates.length||'Invalid';}}]);
      const res=await deleteProfile(candidates[parseInt(idx)-1]._id);
      console.log('🗑️ ',res.message);
      return runSearch();
    }
    if (action==='flush') {
      const r=await flushRedis(); console.log('🧹',r.message||'Redis flushed'); return runSearch();
    }
    if (action==='next'&&filters.page<pages){filters.page++;return runSearch();}
    if (action==='prev'&&filters.page>1){filters.page--;return runSearch();}
    if (action==='openalex') return runOpenAlex();
    if (action==='back') { 
      filters = {
        country:'', topic:'', hindex:'', hOp:'eq',
        i10index:'', i10Op:'eq', identifier:'',
        affiliation:'', year_from:'', year_to:'',
        page: 1
      };
      return askFilters();
    }
    if (action==='menu') return done();
    return runSearch();
  }

  // Step 3: OpenAlex fallback
  async function runOpenAlex() {
    ({ total, authors: candidates } = await fetchOpenCandidates(filters));
    const pages = Math.max(1, Math.ceil(total / LIMIT));

    console.clear();
    console.log(`OpenAlex Results (Page ${filters.page}/${pages}, Total ${total})`);
    console.log('Filters By:', renderFilterHeader(filters));
    console.table(candidates.map((a,i)=>({No:i+1,Name:a.basic_info?.name||'(no name)',ID:a._id})));

    const choices=[
      { name:'👁️   View profiles', value:'view_all' },
      { name:'💾   Save all to DB',  value:'save_all' },
      new inquirer.Separator(),
      { name:'↩️   Back to DB Search', value:'db'   },
      { name:'🏠  Main Menu',         value:'menu' }
    ];
    const { action }=await inquirer.prompt([{type:'list',name:'action',message:'Select action:',choices}]);

    if(action==='view_all'){
      const { idx } = await inquirer.prompt([{ type:'input', name:'idx', message:'Enter number to view:', validate:v=>{const n=parseInt(v);return n>=1&&n<=candidates.length||'Invalid';}}]);
      const prof=await fetchOpenProfile(candidates[parseInt(idx)-1]._id);
      await showProfile(prof,'OpenAlex');
      return runOpenAlex();
    }
    if(action==='save_all'){
      for(const p of candidates){const r=await axios.post(`${API_BASE}/author/save-profile`,p);console.log('💾 ',r.data.message);}      
      return runOpenAlex();
    }
    if(action==='db') return runSearch();
    if(action==='menu') return done();
    return runOpenAlex();
  }

  // Start flow
  await askFilters();
}

module.exports={ runFilterFlow };