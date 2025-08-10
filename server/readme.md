# AI Talent Finder – Backend & CLI

## ✨ Key Features

* **Search authors** from **MongoDB** or **OpenAlex API**
* **Advanced filtering** by: country, topic, h-index, i10-index, identifier, affiliation, year range
* **OpenAlex fallback** when no results are found in MongoDB
* **Profile management**: view, save, delete authors
* **Redis caching** for faster queries
* **CLI test tool** simulating backend interface for developers
* **Pagination & sorting** support

---

## 🔗 Backend APIs

| Feature                        | Method | Endpoint                       | Description                        |
| ------------------------------ | ------ | ------------------------------ | ---------------------------------- |
| Search authors in MongoDB      | GET    | `/api/author/search-author`    | Search by name or ID               |
| Fetch from OpenAlex API        | GET    | `/api/author/fetch-author`     | Search by name or ID               |
| Save profile to DB             | POST   | `/api/author/save-profile`     | Save/upsert a profile              |
| Delete profile from DB         | DELETE | `/api/author/delete-profile`   | Delete by ID                       |
| Flush Redis cache              | POST   | `/api/author/flush-redis`      | Flush all Redis keys               |
| Multi-filter search (Mongo)    | GET    | `/api/search-filters/search`   | Filter by multiple criteria        |
| Multi-filter search (OpenAlex) | GET    | `/api/search-filters/openalex` | Filter data directly from OpenAlex |

---

## 🗄 File List & Main Functions

| File                           | Purpose                                                      | Main Functions                                                                                                 |
| ------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **server.js**                  | Express entry point, connects MongoDB + Redis, mounts routes | `app.use(...)` mount APIs, DB connections                                                                      |
| **authorRoute.js**             | Author API routes                                            | `GET /search-author`, `GET /fetch-author`, `POST /save-profile`, `DELETE /delete-profile`, `POST /flush-redis` |
| **authorController.js**        | Author API logic                                             | `searchByCandidates()`, `searchByFetch()`, `saveToDatabase()`, `deleteFromDatabase()`                          |
| **searchFiltersRoute.js**      | Multi-filter API routes                                      | `GET /search`, `GET /openalex`                                                                                 |
| **searchFiltersController.js** | Advanced filtering logic                                     | `searchFilters()` (Mongo), `searchOpenalexFilters()` (OpenAlex)                                                |
| **researcherProfileModel.js**  | Mongoose schema for author profiles                          | Defines `ResearcherProfileSchema`                                                                              |
| **cacheRedisInsight.js**       | Redis caching middleware                                     | `cacheRedisInsight()`, `deleteCacheKey()`, `flushAllCache()`                                                   |
| **cli.js**                     | CLI main menu                                                | `mainMenu()` to choose author search or filter search                                                          |
| **authorCli.js**               | CLI for author search and management                         | `runAuthorFlow()`                                                                                              |
| **filterCli.js**               | CLI for multi-filter search                                  | `runFilterFlow()`                                                                                              |
| **renderCli.js**               | CLI rendering utilities                                      | `showProfile()`, `renderList()`, `renderFilterHeader()`                                                        |

---
