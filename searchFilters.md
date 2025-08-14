# AI Talent Finder – Backend

## ✨ Key Features

* **Unified author search** via **MongoDB** (local DB) and **OpenAlex API** (external)
* **Automatic fallback** to OpenAlex when no results are found in MongoDB
* **Advanced filtering**: country, topic/field, h-index, i10-index, identifier, affiliation + year range
* **Profile management**: save, delete, and view author profiles
* **Redis caching** for search results and profiles
* **Pagination** with safe `limit` constraints

---

## 🔍 Search Flow

1. **Client request** to `/api/search-filters/search` or `/api/search-filters/openalex`
2. **Redis cache check**

   * If the key exists → return cached data
   * If not → query DB or call OpenAlex
3. **MongoDB search**

   * Filter by query parameters (id, name, country, topic, metrics, identifier, affiliation, year range)
   * If no results → automatically fallback to OpenAlex
4. **OpenAlex fetch**

   * Build query identical to DB search
   * Fetch data and map it to the system's schema
5. **Cache results** into Redis

---

## 📌 Backend APIs

| Feature                                | Method | Endpoint                       | Description                                                           |
| -------------------------------------- | ------ | ------------------------------ | --------------------------------------------------------------------- |
| Multi-filter search (Mongo + Fallback) | GET    | `/api/search-filters/search`   | Filter by multiple criteria, auto fallback to OpenAlex if DB is empty |
| Multi-filter search (OpenAlex only)    | GET    | `/api/search-filters/openalex` | Filter data directly from OpenAlex                                    |
| Save profile to DB                     | POST   | `/api/author/save-profile`     | Upsert profile into MongoDB                                           |
| Delete profile from DB                 | DELETE | `/api/author/delete-profile`   | Delete profile and clear cache                                        |
| Flush all Redis cache                  | POST   | `/api/author/flush-redis`      | Remove all keys from Redis                                            |

---

## 🗄 File Structure & Main Functions

| File                                       | Purpose / Main Functions                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **server.js**                              | Express entry point, connects MongoDB + Redis, mounts routes                                      |
| **routes/authorRoute.js**                  | CRUD profile routes: `save-profile`, `delete-profile`, `flush-redis`                              |
| **routes/searchFiltersRoute.js**           | Search routes: `/search` (Mongo+Fallback), `/openalex` (OpenAlex) + Redis cache middleware        |
| **controllers/searchFiltersController.js** | Search DB with multi-filters, fallback to OpenAlex when empty                                     |
| **controllers/authorController.js**        | Fetch & map data from OpenAlex, save/delete profiles, searchOpenalexFilters                       |
| **utils/queryHelpers.js**                  | Helpers for parsing queries: multi-value, safe regex, building filter conditions, quoting phrases |
| **middleware/cacheRedisInsight.js**        | Redis cache middleware: get/set, delete keys, flush all                                           |
| **models/researcherProfileModel.js**       | Mongoose schema for author profiles                                                               |

---

## 🧪 Example Requests (Postman)

### 1. Search DB + Fallback to OpenAlex

```http
GET http://localhost:5000/api/search-filters/search?name=Ahmad&country=US&topic=Physics&hindex=10&op_hindex=gte&page=1&limit=20
```

### 2. Search directly from OpenAlex

```http
GET http://localhost:5000/api/search-filters/openalex?country=EG,PK&topic=Computer Science|Mathematics&hindex=15&op=gte&page=1
```

### 3. Save profile

```http
POST http://localhost:5000/api/author/save-profile
Content-Type: application/json

{
  "profile": {
    "_id": "https://openalex.org/A123456789",
    "basic_info": { "name": "John Doe", "affiliations": [] },
    "identifiers": { "openalex": "...", "orcid": "" },
    "research_metrics": { "h_index": 10, "i10_index": 5 },
    "research_areas": { "fields": [], "topics": [] },
    "citation_trends": { "cited_by_table": [], "counts_by_year": [] },
    "current_affiliation": {}
  }
}
```

### 4. Delete profile

```http
DELETE http://localhost:5000/api/author/delete-profile
Content-Type: application/json

{ "id": "https://openalex.org/A123456789" }
```

### 5. Flush Redis

```http
POST http://localhost:5000/api/author/flush-redis
```
