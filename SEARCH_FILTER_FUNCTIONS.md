# Academic Talent Finder API - Search Flow

This project provides search functionalities for researcher profiles, combining **MongoDB** (local database) with **OpenAlex API** (external source) and **Redis** caching.

## 🔍 Search Flow

1. **User sends a GET request** to `/api/search-filters/search` with query parameters.
2. **Redis Cache Check**

   * If the query result is cached → return cached data.
   * If not cached → proceed to DB search.
3. **MongoDB Search**

   * Search is performed using the filters from query params.
   * If matches are found → results are returned and cached.
   * If no matches are found → proceed to OpenAlex fallback.
4. **OpenAlex Fallback**

   * The same query parameters are transformed into OpenAlex API-compatible filters.
   * Data is fetched, mapped into our schema, and returned.
   * This result is cached in Redis.

## 📌 Search Fields (Query Parameters)

* `id` – exact match by ID.
* `name` – case-insensitive regex search.
* `country` – single or multiple values (OR logic).
* `topic` – research topics or fields (multiple allowed).
* `hindex` – numeric filter with operator.
* `i10index` – numeric filter with operator.
* `op` – global operator: eq, gt, gte, lt, lte.
* `op_hindex` – operator for H-index (overrides `op`).
* `op_i10` – operator for i10-index (overrides `op`).
* `identifier` – must exist: openalex, orcid, scopus, google\_scholar.
* `affiliation` – institution name (supports multi).
* `year_from` / `year_to` – affiliation year range.
* `page` / `limit` – pagination.

## 🌐 Related API Endpoints

### 1. **Database + Fallback Search**

```
GET /api/search-filters/search
```

* Searches MongoDB first, then falls back to OpenAlex if no results.

### 2. **Direct OpenAlex Search**

```
GET /api/search-filters/openalex
```

* Queries OpenAlex API directly without checking MongoDB.

### 3. **Profile Management APIs**

* `POST /api/author/save-profile` – Save or update a profile.
* `DELETE /api/author/delete-profile` – Remove a profile.
* `POST /api/author/flush-redis` – Flush all Redis cache.

## 🗄 Redis Cache Behavior

* **/search** results → TTL: 1800 seconds.
* **/openalex** results → TTL: 900 seconds.
* Cache keys are generated from query params.
* Cache entries for specific profiles are deleted when profiles are removed from DB.
