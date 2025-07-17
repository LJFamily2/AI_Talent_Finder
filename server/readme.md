# Academic Talent Finder

> **Last Updated:** July 18, 2025

A full-stack CLI + API platform for exploring, caching, and analyzing academic author profiles from MongoDB and OpenAlex.

---

## ✅ Project Completion Flow

### 1️⃣ Infrastructure Setup

- [x] Initialized Express app with routing
- [x] Connected to MongoDB via Mongoose
- [x] Connected to Redis via `createClient()` and `.connect()`
- [x] `.env` handled securely via `dotenv`
- [x] Global error handling middleware

---

### 2️⃣ CLI Application (Interactive Terminal UI)

- [x] `cli.js`: main menu with `Search Author` & `Multi-Filter Search`
- [x] `authorCli.js`: 
  - [x] Search DB by name
  - [x] Fetch from OpenAlex
  - [x] View formatted author profile
  - [x] Save profile to DB
  - [x] Delete profile from DB + Redis
  - [x] Redis flush support
- [x] `filterCli.js`: 
  - [x] Multi-filter prompt (country, topic, h-index, i10-index, identifier)
  - [x] Support OpenAlex and MongoDB searches
  - [x] View, delete, save profile
  - [x] Redis flush support

### 🛠 How to Run CLI
```bash
# Navigate to project root
cd server/cli

# Run CLI interactively
node cli.js
```

---

### 3️⃣ API Controllers

- [x] `authorController.js`
  - [x] Search MongoDB by name / ID
  - [x] Fetch from OpenAlex (by name / ID)
  - [x] Save profile to MongoDB
  - [x] Delete profile from MongoDB + Redis
- [x] `searchFiltersController.js`
  - [x] Search by:
    - [x] Country
    - [x] Topic
    - [x] H-Index
    - [x] i10-Index
    - [x] Identifier
    - [x] Combined Filters (Multi)
    - [x] OpenAlex Filters (Multi)

---

### 4️⃣ Routing

- [x] `authorRoutes.js`
  - [x] `/search-author`
  - [x] `/fetch-author`
  - [x] `/save-profile`
  - [x] `/delete-profile`
  - [x] `/flush-redis`
- [x] `searchFilters.js`
  - [x] `/by-country`, `/by-topic`, `/by-hindex`, `/by-i10index`, `/with-identifier`
  - [x] `/multi` (multi-filter from MongoDB)
  - [x] `/openalex` (multi-filter from OpenAlex)

---

### 5️⃣ Redis Cache Integration

- [x] Centralized middleware: `cacheRedisInsight`
  - [x] Auto-HIT / MISS / SET / DEL logging
  - [x] TTL configurable per route
- [x] Profile Cache Standardization:
  - [x] All `/fetch-author` responses wrapped as `{ profile: {...} }`
  - [x] All cached profiles follow Monica Dus format
- [x] Cache key strategy:
  - [x] `researcherProfiles:<id>`
  - [x] `authorLists:<lowercase-name>`
  - [x] `openalexLists:<lowercase-name>`
  - [x] `searchFilters:<filters...>`

---

### 6️⃣ UX Polishing

- [x] `Press Enter to continue...` after each view / action
- [x] Clear, bordered CLI displays
- [x] `console.table()` for affiliations, metrics, identifiers
- [x] Elegant fallback if profile is null

---

### 🎯 Optional / Stretch Goals

- [ ] Add pagination for citation trends
- [ ] Auto-detect duplicates when saving to DB
- [ ] Export selected profile to JSON file
- [ ] Add Scopus / Scholar support to multi-filter fetch
