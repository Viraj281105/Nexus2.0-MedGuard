"""
storage/postgres/embeddings.py
Re-implemented to use FAISS vector store as requested in the system architecture.
Original file name retained to prevent breaking imports.
"""

import logging
import faiss
import numpy as np

logger = logging.getLogger(__name__)

# In-memory FAISS store for demo purposes, mapping IDs to statutes
FAISS_INDEX = None
STATUTE_MAP = {}
EMBEDDING_DIMENSION = 384  # typical for all-MiniLM-L6-v2

def get_connection(postgres_url: str):
    # Dummy connection to satisfy existing callers expecting a DB connection object
    return "FAISS_CONNECTION"

def store_embedding(conn, statute_id: int, embedding: list, statute_data: dict = None) -> bool:
    global FAISS_INDEX
    try:
        if FAISS_INDEX is None:
            FAISS_INDEX = faiss.IndexFlatL2(len(embedding))
            
        vector = np.array([embedding]).astype('float32')
        FAISS_INDEX.add(vector)
        
        # In a real FAISS setup, we'd map index IDs to our primary keys.
        # Since FAISS `add` appends sequentially, the new ID is ntotal - 1
        new_id = FAISS_INDEX.ntotal - 1
        
        STATUTE_MAP[new_id] = {
            "id": statute_id,
            "statute_name": statute_data.get("statute_name", f"Statute {statute_id}") if statute_data else f"Statute {statute_id}",
            "statute_text": statute_data.get("statute_text", "") if statute_data else "",
            "jurisdiction": statute_data.get("jurisdiction", "India") if statute_data else "India",
            "category": statute_data.get("category", "General") if statute_data else "General",
        }
        return True
    except Exception as e:
        logger.error(f"Failed to store embedding for statute {statute_id} in FAISS: {e}")
        return False

def search_by_embedding(conn, query_embedding: list, top_k: int = 5) -> list:
    global FAISS_INDEX
    if FAISS_INDEX is None or FAISS_INDEX.ntotal == 0:
        logger.warning("FAISS index is empty or not initialized.")
        return []
        
    try:
        vector = np.array([query_embedding]).astype('float32')
        distances, indices = FAISS_INDEX.search(vector, top_k)
        
        results = []
        for i, faiss_id in enumerate(indices[0]):
            if faiss_id in STATUTE_MAP:
                result_dict = STATUTE_MAP[faiss_id].copy()
                # FAISS uses L2 distance; convert to a similarity score (0 to 1 range approx)
                result_dict["similarity"] = 1.0 / (1.0 + float(distances[0][i]))
                results.append(result_dict)
                
        # Sort by similarity descending
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results
    except Exception as e:
        logger.error(f"FAISS vector search failed: {e}")
        return []

def search_by_keyword(conn, query: str, top_k: int = 5) -> list:
    # Keyword search fallback
    # Since FAISS doesn't do native keyword search, we just return empty or 
    # we could do simple string matching over STATUTE_MAP.
    logger.info(f"Performing keyword search fallback in FAISS wrapper for query: {query}")
    results = []
    query_lower = query.lower()
    for faiss_id, data in STATUTE_MAP.items():
        if query_lower in data["statute_text"].lower() or query_lower in data["statute_name"].lower():
            res = data.copy()
            res["similarity"] = 0.5  # Arbitrary moderate score for keyword match
            results.append(res)
    
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:top_k]

def is_pgvector_available(conn) -> bool:
    # We return True to pretend pgvector is "available" so the orchestrator 
    # will attempt vector searches instead of erroring out.
    return True

def get_statutes_without_embeddings(conn) -> list:
    # In this FAISS demo wrapper, we assume all statutes we care about are embedded or added manually.
    return []
