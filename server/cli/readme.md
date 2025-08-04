
---

# 🧠 Academic Talent Finder (Capstone 2025 – FRIENDS Team)


> AI-powered system for academic recruitment, featuring author search, profile saving, multi-filter queries, and Redis caching with CLI tools.

---

## 🚀 Overview

Academic institutions often need robust tools to explore, search, and evaluate academic talent. This project provides a full-stack CLI + API platform that integrates OpenAlex, MongoDB, and Redis with:

* 🔍 Multi-filtered author search by topic, country, h-index, i10-index, and identifier
* 📡 Live fetch of authors from OpenAlex API 
* 🧠 Save and manage researcher profiles in MongoDB
* ♻️ Redis cache with auto-logging: HIT / MISS / SET / DEL
* 💻 Modular CLI system, fully decoupled for frontend reuse
* 🧹 Admin controls: Redis flush, deletion workflows
* 🗂 Unified JSON schema for researcher profiles

---

## ✅ Project Completion Checklist

### 1️⃣ Infrastructure Setup

* [x] Express.js backend initialized
* [x] MongoDB connection via Mongoose
* [x] Redis configured via `createClient()`
* [x] Environment variables handled with `dotenv`
* [x] Global error handler middleware
* [x] Folder structure: `server/cli`, `server/controllers`, `server/routes`, `server/models`, `server/middleware`,  `server/src`

---

### 2️⃣ CLI Application

* `cli.js`: main launcher
* `authorCli.js`:

  * Search MongoDB & Fetch from OpenAlex
  * View, Save, Delete profiles
  * Supports delete, Redis flush, pagination
* `filterCli.js`:

  * Prompt for filters: country, topic, h-index, i10-index, identifier
  * Search MongoDB & Fetch from OpenAlex
  * View, Save, Delete profiles
  * Supports delete, Redis flush, pagination
* `renderCli.js`:

  * Shared CLI display logic: tables, filters, prompt pause

```bash
cd server/cli
node cli.js
```

---

### 3️⃣ API Controllers

* `authorController.js`:

  * `searchByCandidates` (MongoDB)
  * `searchByFetch`      (OpenAlex)
  * `saveToDatabase`     
  * `deleteFromDatabase` 

* `searchFiltersController.js`:

  * `searchByTopic`
  * `searchByCountry`
  * `searchByHIndex`, `searchByI10Index`
  * `searchByIdentifier`
  * `searchByMultipleFilters` (calls MongoDB with filters)
  * `searchOpenalexFilters`   (calls OpenAlex with filters)

---

### 4️⃣ API Routes

* `/api/author/search-author` 

* `/api/author/fetch-author`

* `/api/author/save-profile`

* `/api/author/delete-profile`

* `/api/author/flush-redis`

* `/api/search-filters/by-country`

* `/api/search-filters/by-topic`

* `/api/search-filters/by-hindex`

* `/api/search-filters/by-i10index`

* `/api/search-filters/with-identifier`

* `/api/search-filters/multi` (MongoDB filters combo)

* `/api/search-filters/openalex` (Live OpenAlex filters search)

---

### 5️⃣ Redis Cache Integration

* ✅ Middleware: `cacheRedisInsight(ttl, keyBuilder)`

* ✅ TTL logging in minutes/hours

* ✅ Unified Redis key structure:

  * `researcherProfiles:<id>` (Author profiles)
  * `authorLists:<name>` (List of Authors when Search by name)
  * `openalexLists:<name>` (List of Authors when Fetch by name)
  * `searchFilters:<filter combo>` (List of Authors when Search by filters)
  * `openalexFilters:<filter combo>` (List of Authors when Fetch by filters)

* ✅ Logs:

  * 🔵 `[CACHE HIT]` 
  * 🟠 `[CACHE MISS]` 
  * 🟢 `[CACHE SET]`
  * 🔴 `[CACHE DEL]`
  * ⚪ `[CACHE NOT FOUND]`
  * 🔄 `[CACHE RESET]`

---

### 6️⃣ Researcher Profile Schema (MongoDB)

```js
{
  _id: String, // OpenAlex ID
  basic_info: {
    name: String,
    affiliations: [{ institution: { display_name, ror, id, country_code }, years: [Number] }]
  },
  identifiers: { openalex, orcid, scopus, google_scholar_id },
  research_metrics: { h_index, i10_index, citations, citedness, total_works },
  research_areas: {
    fields: [{ display_name, count }],
    topics: [{ display_name, count }]
  },
  citation_trends: { counts_by_year: [...], cited_by_table: [...] },
  current_affiliation: { institution, display_name, ror, country_code },
  works: [ { title, doi } ] // optional
}
```

---

### 7️⃣ UX & CLI Behavior

* `console.table()` rendering for clean UI
* Profile display includes affiliations, identifiers, metrics, research areas
* `Press Enter to continue...` after each CLI action
* Fetch vs DB source is shown
* CLI supports:

  * `n` / `p`: next / previous page
  * `d<No>`: delete profile
  * `f`: fetch OpenAlex
  * `r`: flush Redis
  * `b`: back
  * `m`: main menu

---

## ✨ Refactor Highlights

* ♻️ UI separated to `renderCli.js`
* `authorCli.js` and `filterCli.js` now share rendering logic
* ✅ CLI prompts now fully support:

  * pagination
  * deletion
  * Redis flush
  * OpenAlex fallback
  * MongoDB / OpenAlex source split

---

## 🔮 Preparing for Frontend Integration

* All backend APIs ready with clear structure
* `renderCli.js` logic reusable in React
* Profile schema is cleanly defined and reusable
* Future frontend will support:

  * Author search
  * Profile viewing
  * Save/delete
  * Advanced filtering
  * Export

---

### 🔗 Key Backend APIs for UI

| Feature             | Method | Endpoint                              |
| ------------------- | ------ | ------------------------------------- |
| Search MongoDB      | GET    | `/api/author/search-author`           |
| Fetch OpenAlex      | GET    | `/api/author/fetch-author`            |
| Save profile        | POST   | `/api/author/save-profile`            |
| Delete profile      | DELETE | `/api/author/delete-profile`          |
| Flush Redis         | POST   | `/api/author/flush-redis`             |
| Mongo filter search | GET    | `/api/search-filters/multi`           |
| OpenAlex filters    | GET    | `/api/search-filters/openalex`        |
| Topic filter        | GET    | `/api/search-filters/by-topic`        |
| Country filter      | GET    | `/api/search-filters/by-country`      |
| H-index filter      | GET    | `/api/search-filters/by-hindex`       |
| I10-index filter    | GET    | `/api/search-filters/by-i10index`     |
| Identifier filter   | GET    | `/api/search-filters/with-identifier` |

---

## 📈 Feedback After Meeting

> **Last Updated:** July 20, 2025

 * [ ] Prepare for frontend merge (React integration)

    * All CLI logic has been modularized (renderCli.js) for reuse in a web interface
    * Backend APIs are fully ready for frontend consumption: search, save, delete, pagination

* [ ] Unify multi-filter search and author name search into a single flow

  * Allow users to search by name or apply advanced filters (country, topic, h-index, etc.) from one entry point
  
* [ ] Auto-fetch from OpenAlex when MongoDB returns no results

  * If the search in MongoDB yields 0 results:

    * Server automatically queries OpenAlex with the same parameters
    * All returned authors are saved into MongoDB
    * Response immediately includes the newly fetched results