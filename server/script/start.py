import json
from time import sleep
from typing import List
import requests
from db import find_documents, count_documents

from populate import fetch_authors_for_topic, strip_openalex_id, upsert_topic
import config

KEYWORDS_FILE = "keywords.json"  # JSON format: ["artificial intelligence", "machine learning", ...]

def load_keywords() -> List[str]:
    """Load keywords from JSON file."""
    with open(KEYWORDS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def format_keyword(keyword: str) -> str:
    """Convert keyword into API-friendly format: lowercase, spaces -> '+'."""
    return "+".join(keyword.lower().split())

def fetch_topics_for_keyword(keyword: str, global_counter: dict) -> List[dict]:
    """
    Fetch topics from OpenAlex for a given keyword.
    - Upserts new topics (and their fields) only if capacity allows (Option A).
    - Skips topics that already have >= MAX_PER_TOPIC researchers.
    - Returns list of topic IDs that still need author fetching.
    """
    formatted = format_keyword(keyword)
    url = f"{config.OPENALEX_BASE}/topics"
    params = {"filter": f"display_name.search:{formatted}", "api_key": config.API_KEY}

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        topics = data.get("results", []) or []
        print(f"✅ Fetched {len(topics)} topics for keyword '{keyword}'")
        
        # Extract needed fields (id, display_name, field["display_name"])
        all_topics = [
            {
                "id": strip_openalex_id(t.get("id", "")),
                "display_name": t.get("display_name", ""),
                "field_name": (t.get("field") or {}).get("display_name", "")
            }
            for t in topics
        ]
        all_topics_names = [t["display_name"] for t in all_topics]

        # Get existing topics from DB (with researcher counts)
        existing = find_documents(
            config.COL_TOPICS,
            {"display_name": {"$in": all_topics_names}},
            projection={"display_name": 1, "sync_status.researchers_count": 1}
        )
        existing_map = {doc["display_name"]: doc for doc in existing}

        fetch_topics = []

        # capacity checks
        total_in_db = count_documents(config.COL_RESEARCHERS)
        session_remaining = config.SESSION_LIMIT - global_counter.get("inserted", 0)

        # Process topics one by one
        for topic in all_topics:
            topic_name = topic["display_name"]
            oa_id = topic["id"]
            existing_doc = existing_map.get(topic_name)

            if existing_doc:
                rc = existing_doc.get("sync_status", {}).get("researchers_count", 0)
                if rc >= config.MAX_PER_TOPIC:
                    print(f"⏭️ Skipping {topic_name} (already has {rc} researchers)")
                    continue
                else:
                    print(f"➡️ Topic {topic_name} has {rc} researchers, needs more")
                    fetch_topics.append({"display_name": topic_name, "oa_id": oa_id})
            else:
                # Topic does not exist → check capacity before upserting
                if total_in_db >= config.MAX_AUTHORS or session_remaining <= 0:
                    print(f"⏸️ Skipping new topic {topic_name} due to capacity limits")
                    continue

                # safe to upsert topic and schedule for fetching
                print(f"🆕 Adding new topic {topic_name}")
                upsert_topic(topic, skip_check=True)   # make sure this handles field too
                fetch_topics.append({"display_name": topic_name, "oa_id": oa_id})

        print(f"📌 {len(fetch_topics)} topics need author fetching")
        return fetch_topics

    except Exception as e:
        print(f"❌ Error fetching topics for '{keyword}': {e}")
        return []

def main():
    global_counter = {"inserted": 0}
    keywords = load_keywords()

    for kw in keywords:
        fetch_topics = fetch_topics_for_keyword(kw, global_counter)
        for topic in fetch_topics:
            fetch_authors_for_topic(topic, global_counter)
            sleep(1)  # be polite to API

    # Slug backfill removed; slugs are now created at insert time in populate.py

if __name__ == "__main__":
    main()
