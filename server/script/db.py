# db.py
from pymongo import MongoClient
from typing import Dict, Any, List, Optional
from pymongo.results import UpdateResult, InsertManyResult
import config

# MongoDB client
client = MongoClient(config.DB_URI)
db = client[config.DB_NAME]

def get_collection(collection_name: str):
    """Return a MongoDB collection object."""
    return db[collection_name]

# ---------- Insert / Upsert ----------
def upsert_document(collection_name: str, filter_query: Dict[str, Any], update_data: Dict[str, Any]) -> UpdateResult:
    """
    Upsert a single document into a collection.
    - filter_query: dict to match the document
    - update_data: dict with fields to update
    """
    collection = get_collection(collection_name)
    result = collection.update_one(filter_query, {"$set": update_data}, upsert=True)
    return result

def upsert_document_new(
    collection_name: str,
    filter_query: Dict[str, Any],
    update_data: Dict[str, Any],
    insert_defaults: Optional[Dict[str, Any]] = None
) -> UpdateResult:
    """
    Upsert a single document into a collection.
    - filter_query: dict to match the document
    - update_data: dict with fields to update (always applied)
    - insert_defaults: dict with fields to apply ONLY when inserting
    """
    collection = get_collection(collection_name)
    update_doc = {"$set": update_data}
    if insert_defaults:
        update_doc["$setOnInsert"] = insert_defaults
    return collection.update_one(filter_query, update_doc, upsert=True)


def insert_many_documents(collection_name: str, documents: List[Dict[str, Any]]) -> Optional[InsertManyResult]:
    """
    Insert many documents into a collection.
    - Skips if documents list is empty
    """
    if not documents:
        return None
    collection = get_collection(collection_name)
    result = collection.insert_many(documents, ordered=False)
    return result.inserted_ids

# ---------- Query ----------
def find_document(
    collection_name: str,
    filter_query: Dict[str, Any],
    projection: Optional[Dict[str, int]] = None
) -> Optional[Dict[str, Any]]:
    """
    Find a single document in a collection.
    - projection controls which fields are returned (like SQL SELECT columns).
      Example: {"_id": 1, "display_name": 1}
    """
    collection = get_collection(collection_name)
    if projection:
        return collection.find_one(filter_query, projection)
    return collection.find_one(filter_query)


def find_documents(
    collection_name: str,
    filter_query: Dict[str, Any],
    limit: int = 0,
    projection: Optional[Dict[str, int]] = None
) -> List[Dict[str, Any]]:
    """
    Find multiple documents in a collection.
    - limit = 0 means no limit
    - projection controls which fields are returned (like SQL SELECT columns).
      Example: {"_id": 1, "sync_status.researchers_count": 1}
    """
    collection = get_collection(collection_name)
    if projection:
        cursor = collection.find(filter_query, projection)
    else:
        cursor = collection.find(filter_query)

    if limit > 0:
        cursor = cursor.limit(limit)

    return list(cursor)

def count_documents(collection_name: str, filter_query: dict = None) -> int:
    """
    Count documents in a collection.
    """
    if filter_query is None:
        filter_query = {}
    return db[collection_name].count_documents(filter_query)