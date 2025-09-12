import requests
import pymongo
from time import sleep
from urllib.parse import urlparse
from typing import List, Dict, Any

# -----------------------------
# Config
# -----------------------------

PER_PAGE = 200
MAX_AUTHORS = 65000  # <- change this to allow more later
REQUEST_TIMEOUT = 30
OPENALEX_BASE = "https://api.openalex.org"

MONGO_URI = "mongodb+srv://khai_user:StrongPassword123@cluster0.cg5qmur.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "ai_talent_finder"
COLLECTION_NAME = "researcherprofiles"
SYNC_COLLECTION = "sync_status"

# -----------------------------
# MongoDB setup
# -----------------------------
client = pymongo.MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]
sync_status = db[SYNC_COLLECTION]

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

def author_exists(author_id: str) -> bool:
    return collection.count_documents({"_id": author_id}, limit=1) > 0

def get_last_cursor(field_id: str) -> str:
    rec = sync_status.find_one({"field_id": field_id})
    return rec["cursor"] if rec and "cursor" in rec else "*"

def save_cursor(field_id: str, cursor_value: str, last_author_id: str = None):
    update = {"cursor": cursor_value}
    if last_author_id:
        update["last_author_id"] = last_author_id
    sync_status.update_one({"field_id": field_id}, {"$set": update}, upsert=True)

def print_last_checkpoint_info(field_name: str, field_id: str):
    rec = sync_status.find_one({"field_id": field_id})
    if rec:
        print(f"🔁 Last checkpoint for {field_name} ({field_id}):")
        print(f"   ➤ Cursor: {rec.get('cursor', '*')}")
        print(f"   ➤ Last Author ID: {rec.get('last_author_id', 'N/A')}")
    else:
        print(f"📦 No checkpoint found for {field_name} ({field_id}). Starting fresh.")

def fetch_json(url: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    r = requests.get(url, params=params or {}, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()

def fetch_author_detail(author_id_short: str) -> Dict[str, Any]:
    """Fetch full author object to access last_known_institutions (plural or singular)."""
    # author_id_short looks like 'A123...' (we ensure stripping earlier)
    url = f"{OPENALEX_BASE}/authors/{author_id_short}"
    try:
        return fetch_json(url)
    except Exception:
        return {}

# -----------------------------
# Map author -> profile doc
# -----------------------------
def map_author_to_profile(author: Dict[str, Any]) -> Dict[str, Any]:
    # Remove url prefixes from ids up front
    author_id_short = strip_openalex_id(author.get("id", ""))

    # ---------- basic_info.affiliations (keep full historical affiliations)
    affiliations: List[Dict[str, Any]] = []
    for aff in author.get("affiliations", []) or []:
        inst = aff.get("institution", {}) or {}
        years = aff.get("years", []) or []
        affiliations.append({
            "institution": {
                "display_name": inst.get("display_name", "") or "",
                "ror": inst.get("ror", "") or "",
                "id": strip_openalex_id(inst.get("id", "") or ""),
                "country_code": inst.get("country_code", "") or ""
            },
            "years": years
        })

    # ---------- current_affiliations from last_known_institutions
    # fetch detailed author (list endpoint may not include plural)
    detail = fetch_author_detail(author_id_short)
    # support both plural and singular, normalize to a list
    lkis = detail.get("last_known_institutions")
    if not lkis:
        lki_single = detail.get("last_known_institution")
        lkis = [lki_single] if lki_single else []

    current_affiliations: List[Dict[str, Any]] = []
    for inst in lkis or []:
        inst = inst or {}
        current_affiliations.append({
            "institution": strip_openalex_id(inst.get("id", "") or ""),
            "display_name": inst.get("display_name", "") or "",
            "ror": inst.get("ror", "") or "",
            "country_code": inst.get("country_code", "") or ""
        })

    # ---------- topics & fields (as in your original mapper)
    raw_topics = author.get("topics", []) or []
    topics = []
    fields_set = set()
    for topic in raw_topics:
        topics.append({
            "display_name": topic.get("display_name", "") or "",
            "count": topic.get("count", 0) or 0
        })
        field = topic.get("field", {}) or {}
        if field.get("display_name"):
            fields_set.add(field["display_name"])
    fields = [{"display_name": f} for f in sorted(fields_set)]

    # ---------- research metrics
    stats = author.get("summary_stats", {}) or {}
    profile = {
        "_id": author_id_short,  # stripped id
        "basic_info": {
            "name": author.get("display_name", "") or "",
            "affiliations": affiliations
        },
        "identifiers": {
            "openalex": author_id_short,  # stripped here too
            "orcid": author.get("orcid", "") or ""
        },
        "research_metrics": {
            "h_index": stats.get("h_index", 0) or 0,
            "i10_index": stats.get("i10_index", 0) or 0,
            "two_year_mean_citedness": stats.get("2yr_mean_citedness", 0) or 0,
            "total_citations": author.get("cited_by_count", 0) or 0,
            "total_works": author.get("works_count", 0) or 0
        },
        "research_areas": {
            "fields": fields,
            "topics": topics
        },
        "citation_trends": {
            "cited_by_table": author.get("counts_by_year", []) or [],
            "counts_by_year": author.get("counts_by_year", []) or []
        },
        # list of current institutions (from last_known_institutions)
        "current_affiliations": current_affiliations
    }
    return profile

# -----------------------------
# Field discovery (dynamic 26 top-level fields)
# -----------------------------
def load_top_level_fields() -> List[Dict[str, str]]:
    """
    Pull ALL top-level (level:0) concepts from OpenAlex dynamically.
    Returns list of dicts: {"name": <display_name>, "id": <concept_id_short>}
    We’ll prioritize 'Computer science' first.
    """
    url = f"{OPENALEX_BASE}/concepts"
    params = {"filter": "level:0", "per-page": 200, "sort": "display_name"}
    data = fetch_json(url, params)
    concepts = data.get("results", []) or []

    fields = []
    for c in concepts:
        fields.append({
            "name": c.get("display_name", "") or "",
            "id": strip_openalex_id(c.get("id", "") or "")
        })

    # Move "Computer science" to the front if present
    fields.sort(key=lambda x: (0 if x["name"].lower() == "computer science" else 1, x["name"].lower()))
    return fields

# -----------------------------
# Main fetch by cursor per field
# -----------------------------
def fetch_authors_for_field(field_name: str, concept_id_short: str, global_counter: Dict[str, int]):
    cursor = get_last_cursor(concept_id_short)
    page = 1

    while True:
        if global_counter["inserted"] >= MAX_AUTHORS:
            print(f"⛔ Reached MAX_AUTHORS ({MAX_AUTHORS}). Stopping.")
            return

        print(f"\n📄 {field_name} ({concept_id_short}) | Page {page}")
        url = f"{OPENALEX_BASE}/authors"
        params = {
            "filter": f"concepts.id:{concept_id_short}",
            "per-page": PER_PAGE,
            "cursor": cursor
        }

        try:
            data = fetch_json(url, params)
        except requests.HTTPError as e:
            print(f"❌ HTTP error: {e}")
            break
        except Exception as e:
            print(f"❌ Network error: {e}")
            break

        authors = data.get("results", []) or []
        if not authors:
            print(f"✅ Finished {field_name}. Total inserted so far: {global_counter['inserted']}")
            break

        new_docs = []
        for author in authors:
            if global_counter["inserted"] >= MAX_AUTHORS:
                break

            orcid = author.get("orcid", "") or ""
            author_id_short = strip_openalex_id(author.get("id", "") or "")
            if not orcid:
                continue  # keep your original ORCID-only rule
            if author_exists(author_id_short):
                continue

            mapped = map_author_to_profile(author)
            new_docs.append(mapped)

        if new_docs:
            try:
                collection.insert_many(new_docs, ordered=False)
                print(f"✅ Inserted {len(new_docs)} new authors.")
                global_counter["inserted"] += len(new_docs)
                last_id = new_docs[-1]["_id"]
                save_cursor(concept_id_short, data.get("meta", {}).get("next_cursor", ""), last_id)
            except pymongo.errors.BulkWriteError:
                print("⚠️ Some duplicates skipped.")
        else:
            print("ℹ️ No new authors on this page.")
            save_cursor(concept_id_short, data.get("meta", {}).get("next_cursor", ""))

        next_cursor = data.get("meta", {}).get("next_cursor")
        if not next_cursor:
            print(f"✅ Finished {field_name}. Total inserted so far: {global_counter['inserted']}")
            break

        cursor = next_cursor
        page += 1
        sleep(1.2)  # be polite

# -----------------------------
# Run all fields
# -----------------------------
def main():
    # discover all top-level fields dynamically (which covers the “26 fields” case)
    fields = load_top_level_fields()

    # Print the plan
    print("🗂  Top-level OpenAlex fields (Computer science prioritized):")
    for i, f in enumerate(fields, 1):
        print(f"  {i:>2}. {f['name']} ({f['id']})")

    global_counter = {"inserted": 0}

    for f in fields:
        field_name = f["name"]
        concept_id_short = f["id"]
        print(f"\n=== Syncing field: {field_name} ===")
        print_last_checkpoint_info(field_name, concept_id_short)
        fetch_authors_for_field(field_name, concept_id_short, global_counter)

        if global_counter["inserted"] >= MAX_AUTHORS:
            print(f"\n🎉 Reached the cap of {MAX_AUTHORS} authors. Stopping early.")
            break

    print(f"\n🎉 Done. Inserted {global_counter['inserted']} authors into '{COLLECTION_NAME}' collection.")

if __name__ == "__main__":
    main()
