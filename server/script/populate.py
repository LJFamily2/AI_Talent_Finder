import config
import requests
from time import sleep
from urllib.parse import urlparse
from typing import Tuple, List, Dict, Any, Optional
from datetime import datetime
from db import find_document, upsert_document, insert_many_documents, find_documents, count_documents, upsert_document_new, get_collection

# -----------------------------
# Helpers
# -----------------------------
def strip_openalex_id(value: str) -> str:
    """Turn 'https://openalex.org/A123' -> 'A123'. Safely handles already-short ids."""
    if not value:
        return value
    if value.startswith("http"):
        # usually ends with /Axxxx or /Ixxxx etc.
        path = urlparse(value).path
        return path.rsplit("/", 1)[-1] if "/" in path else path
    return value

# ----------------------------------
# Slug helpers
# ----------------------------------
def _generate_slug(name: str) -> str:
    """Generate URL-friendly slug from a name."""
    if not name:
        return ""
    import re
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    s = s.strip("-")
    return s

def _generate_unique_slug(name: str, col, reserved: Optional[set] = None) -> str:
    """Generate a slug unique across the collection and a reserved set."""
    base = _generate_slug(name)
    slug = base
    counter = 1
    while True:
        in_reserved = reserved is not None and slug in reserved
        exists = col.find_one({"slug": slug}, {"_id": 1}) is not None
        if not in_reserved and not exists:
            return slug
        slug = f"{base}-{counter}"
        counter += 1

#----------------------------------
def upsert_country(country_code: str) -> str:
    """
    Ensure that a country exists in the Country collection.
    If it exists, return its _id.
    If not, fetch its display_name from REST Countries API,
    insert a new one, and return its _id.
    """
    if not country_code:
        return None  # no country to upsert

    country_code = country_code.upper()  # normalize

    # Check if country already exists
    existing = find_document(config.COL_COUNTRIES, {"_id": country_code})
    if existing:
        return existing["_id"]

    # Fetch country name from REST Countries API
    display_name = country_code
    try:
        url = f"https://restcountries.com/v3.1/alpha/{country_code}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and len(data) > 0:
            display_name = data[0].get("name", {}).get("common", country_code)
    except Exception as e:
        print(f"⚠️ Could not fetch country name for {country_code}: {e}")

    # Insert or upsert new doc
    country_doc = {
        "_id": country_code,
        "display_name": display_name
    }
    upsert_document_new(config.COL_COUNTRIES,{"_id": country_code}, {}, country_doc)
    print(f"📝 Upserted country {country_code} ({display_name})")
    return country_code

def upsert_field(field_name: str) -> str:
    """
    Upsert a Field document by display_name.
    Returns the field _id for reference.
    """
    upsert_document_new(
        config.COL_FIELDS,
        {"display_name": field_name},
        {"display_name": field_name},  # always ensure name is set
    )

    # fetch the document
    inserted = find_document(config.COL_FIELDS, {"display_name": field_name})
    return inserted["_id"]

def upsert_topic(topic: Dict[str, Any], skip_check: bool = False) -> str:
    """
    Ensure a topic exists in the database.
    - Upserts the topic into COL_TOPICS if missing.
    - Ensures its associated field exists in COL_FIELDS.
    - Initializes sync_status if new.
    Returns the topic _id (short form).
    """
    display_name = topic.get("display_name", "")
    field_name = topic.get("field_name", "")

    # Ensure field exists
    field_id = None
    if field_name:
        field_id = upsert_field(field_name)

    # Upsert topic
    upsert_document_new(
        config.COL_TOPICS,
        {"display_name": display_name},
        {},
        {
            "display_name": display_name,
            "field_id": field_id,
            "sync_status": {
                "last_synced_date": None,
                "cursor": "*",
                "researchers_count": 0
            }
        }
    )

    # fetch and return id
    inserted = find_document(config.COL_TOPICS, {"display_name": display_name})
    return inserted["_id"] if inserted else None

def process_researcher_topics(topics: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    """
    Given a list of topic dicts from OpenAlex for a researcher,
    ensure all topics exist in the DB and return a list of topic _ids.
    Uses bulk insert for missing topics. If a topic already exists,
    increment its sync_status.researchers_count by 1.
    """
    topic_names = [t.get("display_name", "") for t in topics]

    # Step 1: batch check which topics already exist
    existing = find_documents(config.COL_TOPICS, {"display_name": {"$in": topic_names}})
    existing_names = {t["display_name"] for t in existing}
    existing_map = {doc["display_name"]: doc for doc in existing}

    final_topic_ids = []
    missing_docs = []
    search_tags = []
    added_fields = set()

    for topic in topics:
        display_name = topic.get("display_name", "")

        field_data = (topic.get("field") or {}).get("display_name", "")
        field_id = upsert_field(field_data)  # ensure field exists

        if field_id not in added_fields:
            search_tags.append(f"field:{field_id}")
            added_fields.add(field_id)

        if display_name in existing_names:
            # Topic already exists in DB -> increment researchers_count by 1
            existing_doc = existing_map[display_name]
            sync = existing_doc.get("sync_status", {}) or {}
            sync["researchers_count"] = sync.get("researchers_count", 0) + 1

            upsert_document_new(
                config.COL_TOPICS,
                {"_id": existing_doc["_id"]},  # match by Mongo _id
                {"sync_status": sync},
            )
            final_topic_ids.append(existing_doc["_id"])
            search_tags.append(f"topic:{existing_doc['_id']}")
            continue

        # Topic missing, prepare doc for bulk insert (count starts at 1)
        doc = {
            "display_name": display_name,
            "field_id": field_id,
            "sync_status": {
                "last_synced_date": None,
                "cursor": "*",
                "researchers_count": 1
            }
        }
        missing_docs.append(doc)

    # Step 2: bulk insert missing topics
    if missing_docs:
        inserted_ids = insert_many_documents(config.COL_TOPICS, missing_docs)
        final_topic_ids.extend(inserted_ids)

        for tid in inserted_ids:
            search_tags.append(f"topic:{tid}")

    return final_topic_ids, search_tags

# -----------------------------
# Map author -> profile doc
# -----------------------------

def map_author_to_profile(author: Dict[str, Any]) -> Dict[str, Any]:

    # search_tags vars
    search_tags: List[str] = []
    added_countries: set[str] = set()

    ror_to_id: dict[str, str] = {}

    # ---------- affiliations (keep full historical affiliations)
    affiliations: List[Dict[str, Any]] = []
    for aff in author.get("affiliations", []) or []:
        inst = aff.get("institution", {}) or {}
        years = aff.get("years", []) or []

        ror = inst.get("ror", "") or inst.get("display_name", "")
        if not ror:
            continue

        inst_id = ror_to_id.get(ror)
        country_id = None

        if not inst_id:
            existing_inst = find_document(config.COL_INSTITUTIONS, {"ror": ror})
            if existing_inst:
                inst_id = existing_inst["_id"]
                country_id = existing_inst.get("country_id")
            else:
                country_id = upsert_country(inst.get("country_code", "") or "")
                inst_doc = {
                    "display_name": inst.get("display_name", "") or "",
                    "ror": ror,
                    "country_id": country_id,
                }
                upsert_document_new(config.COL_INSTITUTIONS, {"ror": ror}, {}, inst_doc)
                inserted = find_document(config.COL_INSTITUTIONS, {"ror": ror})
                inst_id = inserted["_id"]

            ror_to_id[ror] = inst_id

        # Add affiliation
        affiliations.append({
            "institution": inst_id,
            "years": years
        })

        # Add search_tags
        search_tags.append(f"institution:{inst_id}")
        if country_id and country_id not in added_countries:
            search_tags.append(f"country:{country_id}")
            added_countries.add(country_id)

    # ---------- last_known_institutions
    last_known_institutions: List[str] = []
    for inst in author.get("last_known_institutions", []) or []:
        ror = inst.get("ror", "") or inst.get("display_name", "")
        if not ror:
            continue  # skip empty

        inst_id = ror_to_id.get(ror)
        if not inst_id:
            # fallback: insert or find in DB if not already cached
            existing_inst = find_document(config.COL_INSTITUTIONS, {"ror": ror})
            if existing_inst:
                inst_id = existing_inst["_id"]
            else:
                country_id = upsert_country(inst.get("country_code", "") or "")
                inst_doc = {
                    "display_name": inst.get("display_name", "") or "",
                    "ror": ror,
                    "country_id": country_id,
                }
                upsert_document_new(config.COL_INSTITUTIONS, {"ror": ror}, {}, inst_doc)
                inserted = find_document(config.COL_INSTITUTIONS, {"ror": ror})
                inst_id = inserted["_id"]

            ror_to_id[ror] = inst_id
        last_known_institutions.append(inst_id)

    # ---------- topics 
    topics, topics_fields_tags = process_researcher_topics(author.get("topics", []) or [])
    search_tags.extend(topics_fields_tags)

    # ---------- research metrics
    stats = author.get("summary_stats", {}) or {}

    # ---------- citation_trends
    citation_trends: List[Dict[str, Any]] = []
    for entry in author.get("counts_by_year", []) or []:
        citation_trends.append({
            "year": entry.get("year"),
            "works_count": entry.get("works_count"),
            "cited_by_count": entry.get("cited_by_count")
        })

    profile = {
        "name": author.get("display_name", "") or "",
        "affiliations": affiliations,
        "identifiers": {
            "openalex": author.get("id", "") or "",
            "orcid": author.get("orcid", "") or ""
        },
        "research_metrics": {
            "h_index": stats.get("h_index", 0) or 0,
            "i10_index": stats.get("i10_index", 0) or 0,
            "two_year_mean_citedness": stats.get("2yr_mean_citedness", 0) or 0,
            "total_citations": author.get("cited_by_count", 0) or 0,
            "total_works": author.get("works_count", 0) or 0
        },
        "topics": topics,
        "citation_trends": citation_trends,
        "last_known_affiliations": last_known_institutions,
        "search_tags": search_tags,
        "openalex_last_updated": datetime.fromisoformat(author.get("updated_date")) if author.get("updated_date") else None,
        # Align with Mongoose timestamps convention for compatibility
        "updatedAt": datetime.now(),
    }
    return profile

# -----------------------------
# Main fetch by cursor per field
# -----------------------------
def fetch_authors_for_topic(topic_obj: dict, global_counter: Dict[str, int]):
    """
    Fetch authors for a topic, handling multiple pages if needed.

    - Stops when:
        * DB cap reached (MAX_AUTHORS)
        * Session cap reached (SESSION_LIMIT)
        * Topic cap reached (MAX_PER_TOPIC)
        * No more authors available
    """
    display_name = topic_obj["display_name"]
    oa_id = topic_obj["oa_id"]

    total_in_db = count_documents(config.COL_RESEARCHERS)
    if total_in_db >= config.MAX_AUTHORS:
        print(f"⛔ DB already at MAX_AUTHORS ({config.MAX_AUTHORS}). Skipping '{display_name}'.")
        return

    if global_counter["inserted"] >= config.SESSION_LIMIT:
        print(f"⛔ Session cap ({config.SESSION_LIMIT}) reached. Skipping '{display_name}'.")
        return

    # Get topic record
    topic_record = find_document(config.COL_TOPICS, {"display_name": display_name}) or {}
    sync_status = topic_record.get("sync_status", {})
    current_count = sync_status.get("researchers_count", 0) or 0
    cursor = sync_status.get("cursor", "*")

    if current_count >= config.MAX_PER_TOPIC:
            print(f"⛔ Topic '{display_name}' already at MAX_PER_TOPIC ({config.MAX_PER_TOPIC}). Skipping.")
            return
    
    print(f"\n📄 Fetching authors for topic '{display_name}' (already {current_count}, cap {config.MAX_PER_TOPIC})")

    # Prepare collection handle and per-topic reserved slugs cache
    researchers_col = get_collection(config.COL_RESEARCHERS)
    reserved_slugs = set()

    while True:
        # re-check caps inside loop
        if global_counter["inserted"] >= config.SESSION_LIMIT:
            print("⚠️ Session cap hit mid-topic. Stopping.")
            break
        if total_in_db + global_counter["inserted"] >= config.MAX_AUTHORS:
            print("⚠️ DB cap hit mid-topic. Stopping.")
            break
        if current_count >= config.MAX_PER_TOPIC:
            print(f"⚠️ Topic '{display_name}' reached MAX_PER_TOPIC. Stopping.")
            break

        params = {
            "filter": f"topics.id:{oa_id}",
            "per-page": config.PER_PAGE,
            "api_key": config.API_KEY,
            "cursor": cursor,
        }

        try:
            response = requests.get(f"{config.OPENALEX_BASE}/authors", params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"❌ API error: {e}")
            break

        authors = data.get("results", []) or []
        if not authors:
            print(f"✅ No more authors for '{display_name}'.")
            break

        new_docs = []
        for author in authors:
            if global_counter["inserted"] >= config.SESSION_LIMIT:
                break
            if total_in_db + global_counter["inserted"] >= config.MAX_AUTHORS:
                break
            if current_count >= config.MAX_PER_TOPIC:
                break

            orcid = author.get("orcid") or ""
            if not orcid:
                continue

            if find_document(config.COL_RESEARCHERS, {"identifiers.orcid": orcid}):
                continue

            mapped = map_author_to_profile(author)
            # assign slug at insert-time for uniqueness and faster lookups
            nm = (mapped.get("name") or "").strip()
            if nm:
                try:
                    slug = _generate_unique_slug(nm, researchers_col, reserved=reserved_slugs)
                    if slug:
                        mapped["slug"] = slug
                        reserved_slugs.add(slug)
                except Exception as _slug_err:
                    # Non-blocking: if slug gen fails, skip slug and continue
                    pass
            new_docs.append(mapped)
            current_count += 1

        if new_docs:
            insert_many_documents(config.COL_RESEARCHERS, new_docs)
            global_counter["inserted"] += len(new_docs)
            print(f"✅ Inserted {len(new_docs)} new authors for topic '{display_name}'.")

        # Update cursor for next loop
        cursor = data.get("meta", {}).get("next_cursor")
        if not cursor:
            print(f"🏁 No next_cursor, finished topic {display_name}.")
            break

        # Save progress to DB
        upsert_document_new(
            config.COL_TOPICS,
            {"display_name": display_name},
            {
                "sync_status": {
                    "cursor": cursor,
                    "last_synced_date": datetime.now(),
                    "researchers_count": current_count,
                }
            },
            {}
        )

        sleep(1.2)  # avoid hammering API
