# main.py (Using OpenAI, Parent Doc Strategy, and SQLite Chapter Lookup)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
import os
import re
import sys
import numpy as np
import faiss
from openai import OpenAI
import logging
from dotenv import load_dotenv
import sqlite3 # <--- Import sqlite3

load_dotenv()

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.join(BASE_DIR, "..", "training")
ASSETS_DIR = os.path.join(BASE_DIR, "..", "assets") # Define assets directory
# Index/Mapping paths
INDEX_PATH = os.path.join(BASE_DIR, "hadith_index_openai_small_recursive.faiss")
MAPPING_PATH = os.path.join(BASE_DIR, "index_mapping_openai_small_recursive.json")
# Data paths
HADITHS_JSON_PATH = os.path.join(TRAINING_DIR, "hadiths.json")
DB_PATH = os.path.abspath(os.path.join(ASSETS_DIR, "database", "hadith_data.db")) # <-- Path to SQLite DB

OPENAI_MODEL = "text-embedding-3-small"

# --- FastAPI Initialization ---
app = FastAPI(title="Hadith Semantic Search API (Parent Doc Strategy + DB Lookup)")

# --- Global Variables ---
client: Optional[OpenAI] = None
index: Optional[faiss.Index] = None
mapping: Optional[Dict[str, Dict]] = None
hadith_lookup: Dict[str, Dict] = {}

# --- Consistent Normalization Function ---
# (Keep normalize_arabic_text as before)
def normalize_arabic_text(text):
    """Applies normalization to Arabic text."""
    if not text: return ""
    normalized = re.sub(r'[\u064B-\u065F\u0670]', '', text)
    normalized = re.sub(r'[أإآا]', 'ا', normalized)
    normalized = re.sub(r'[يى]', 'ي', normalized)
    normalized = re.sub(r'ة', 'ه', normalized)
    normalized = normalized.replace('ـ', '')
    return normalized.strip()

# --- Standardization Function (Ensure it's correct) ---
def standardize_collection(title: str) -> str:
    """ Converts a given title into a standardized collection id. """
    normalized_title = re.sub(r'[\s\-\'’]', '', title.lower())
    # Logging inside removed for brevity, assume it's fixed based on last check
    mapping = {
        "sahihalbukhari": "bukhari", "bukhari": "bukhari",
        "sahihmuslim": "muslim", "muslim": "muslim",
        "sunanabudawud": "abudawud", "sunanabidawud": "abudawud", "abudawud": "abudawud",
        "jamialtirmidhi": "tirmidhi", "tirmidhi": "tirmidhi",
        "sunanibnmajah": "ibnmajah", "ibnmajah": "ibnmajah",
        "sunanalnasai": "nasai", # <-- Ensure this key matches normalization output
        "annasai": "nasai",
        "muwattamalik": "malik", "malik": "malik",
        "musnadahmadibnhanbal": "ahmed", "ahmed": "ahmed",
        "sunanaddarimi": "darimi", "aldarimi": "darimi", "darimi": "darimi"
    }
    return mapping.get(normalized_title, normalized_title)

# --- Function to get Chapter Name from DB ---
def get_chapter_name(db_path: str, collection_id: str, chapter_id: int) -> Optional[str]:
    """Looks up the English chapter name from the SQLite database."""
    chapter_name = None
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Assuming your chapters table has columns 'collection_id' (TEXT), 'id' (INTEGER), 'english_name' (TEXT)
        cursor.execute(
            "SELECT english_name FROM chapters WHERE collection_id = ? AND id = ?",
            (collection_id, chapter_id)
        )
        row = cursor.fetchone()
        if row:
            chapter_name = row[0]
        else:
             logging.warning(f"DB Lookup: Chapter not found for {collection_id} / {chapter_id}")
    except sqlite3.Error as e:
        logging.error(f"Database error fetching chapter name for {collection_id}/{chapter_id}: {e}")
    except Exception as e:
         logging.error(f"Unexpected error fetching chapter name: {e}")
    finally:
        if conn:
            conn.close()
    return chapter_name

# --- Load Resources at Startup ---
@app.on_event("startup")
def load_resources():
    global client, index, mapping, hadith_lookup
    logging.info("Loading resources at startup...")

    # Initialize OpenAI Client (same as before)
    logging.info("Initializing OpenAI client...")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logging.error("OPENAI_API_KEY environment variable not set.")
    else:
        client = OpenAI(api_key=api_key)
        logging.info("OpenAI client initialized.")

    # Load FAISS Index (same as before)
    if os.path.exists(INDEX_PATH):
        logging.info(f"Loading FAISS index from: {INDEX_PATH}")
        index = faiss.read_index(INDEX_PATH)
        logging.info(f"FAISS index loaded. Total vectors: {index.ntotal}")
        if index.d != 1536:
             logging.warning(f"FAISS index dimension ({index.d}) doesn't match expected (1536).")
    else:
        logging.error(f"FAISS index not found: {INDEX_PATH}")

    # Load Mapping (same as before)
    if os.path.exists(MAPPING_PATH):
        logging.info(f"Loading index mapping from: {MAPPING_PATH}")
        with open(MAPPING_PATH, 'r', encoding='utf-8') as f:
            mapping_raw = json.load(f)
            mapping = {str(k): v for k, v in mapping_raw.items()}
        logging.info(f"Index mapping loaded. Total entries: {len(mapping)}")
    else:
        logging.error(f"Index mapping not found: {MAPPING_PATH}")

    # Load Hadiths for Full Text Lookup (same as before)
    if os.path.exists(HADITHS_JSON_PATH):
         logging.info(f"Loading hadith details from: {HADITHS_JSON_PATH}")
         with open(HADITHS_JSON_PATH, 'r', encoding='utf-8') as f:
             all_hadiths = json.load(f)
             hadith_lookup = {str(h["id"]): h for h in all_hadiths if "id" in h}
         logging.info(f"Hadith lookup table created with {len(hadith_lookup)} entries.")
    else:
         logging.warning(f"Hadiths JSON not found for lookup: {HADITHS_JSON_PATH}")

    # Check if DB exists
    if not os.path.exists(DB_PATH):
         logging.error(f"SQLite DB for chapter lookup not found at: {DB_PATH}")
    else:
         logging.info(f"SQLite DB found at: {DB_PATH}")


    logging.info("Resource loading process finished.")

# --- Pydantic Models for API (Ensure chapterName is here) ---
class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchResult(BaseModel):
    id: int
    idInBook: Optional[int] = None
    chapterId: Optional[int] = None
    chapterName: Optional[str] = None # Included here
    bookId: Optional[int] = None
    arabic: Optional[str] = None
    english: Optional[Dict] = None
    title: Optional[str] = None
    collectionId: Optional[str] = None
    retrieval_score: float

class SearchResponse(BaseModel):
    results: List[SearchResult]

# --- Search Endpoint (MODIFIED) ---
@app.post("/search", response_model=SearchResponse)
def search_hadiths(search_request: SearchRequest):
    global client, index, mapping, hadith_lookup

    # Check essential resources needed for AI search
    if not client or not index or not mapping or not hadith_lookup:
         missing = []
         if not client: missing.append("OpenAI client")
         if not index: missing.append("FAISS index")
         if not mapping: missing.append("Index mapping")
         if not hadith_lookup: missing.append("Hadith lookup data")
         error_detail = f"Resources not loaded: {', '.join(missing)}"
         logging.error(error_detail)
         raise HTTPException(status_code=503, detail=error_detail)

    try:
        query_text = search_request.query
        normalized_query = query_text
        if any('\u0600' <= char <= '\u06FF' for char in query_text):
             normalized_query = normalize_arabic_text(query_text)

        logging.info(f"Encoding query: '{normalized_query[:50]}...'")
        response = client.embeddings.create(input=normalized_query, model=OPENAI_MODEL)
        query_embedding = np.array(response.data[0].embedding, dtype=np.float32).reshape(1, -1)
        faiss.normalize_L2(query_embedding)

        k_chunks = search_request.top_k * 5 # Fetch more potential chunks
        logging.info(f"Searching index for top {k_chunks} relevant chunks...")
        distances, indices = index.search(query_embedding, k_chunks)

        retrieved_hadiths = []
        seen_parent_hadith_ids = set()
        logging.info("Processing search results...")

        for i in range(len(indices[0])):
            vector_idx = indices[0][i]
            if vector_idx == -1: continue

            score = distances[0][i]
            vector_idx_str = str(vector_idx)

            if vector_idx_str not in mapping:
                logging.warning(f"Vector index {vector_idx} not found in mapping. Skipping.")
                continue

            chunk_metadata = mapping[vector_idx_str]
            parent_hadith_id_str = str(chunk_metadata.get("parent_hadith_id"))

            if parent_hadith_id_str in seen_parent_hadith_ids:
                continue

            parent_hadith_data = hadith_lookup.get(parent_hadith_id_str)

            if parent_hadith_data:
                # Calculate collectionId (ensure function is correct)
                actual_title = parent_hadith_data.get("title", "")
                calculated_collection_id = standardize_collection(actual_title)
                logging.debug(f"Processing Hadith ID={parent_hadith_id_str}, Title='{actual_title}', Calculated CollectionId='{calculated_collection_id}'") # Use debug level

                # --- Fetch Chapter Name from DB ---
                retrieved_chapter_name = None
                parent_chapter_id = parent_hadith_data.get("chapterId")
                if calculated_collection_id and parent_chapter_id is not None:
                    retrieved_chapter_name = get_chapter_name(
                        DB_PATH,
                        calculated_collection_id,
                        int(parent_chapter_id) # Ensure chapterId is int for lookup
                    )
                else:
                     logging.warning(f"Missing collectionId or chapterId for Hadith {parent_hadith_id_str}, cannot fetch chapter name.")
                # ----------------------------------

                # Create the final result object
                try:
                    result_item = SearchResult(
                        **parent_hadith_data,
                        collectionId=calculated_collection_id,
                        chapterName=retrieved_chapter_name, # Add the chapter name here
                        retrieval_score=float(score)
                    )
                    retrieved_hadiths.append(result_item)
                    seen_parent_hadith_ids.add(parent_hadith_id_str)
                except Exception as pydantic_error: # Catch potential Pydantic validation errors
                    logging.error(f"Pydantic validation error for Hadith ID {parent_hadith_id_str}: {pydantic_error}")
                    logging.error(f"Data causing error: {parent_hadith_data}")
                    continue # Skip this hadith if data structure is wrong

            else:
                 logging.warning(f"Parent Hadith ID {parent_hadith_id_str} (from vector index {vector_idx}) not found in lookup.")

            if len(retrieved_hadiths) >= search_request.top_k:
                break

        logging.info(f"Returning {len(retrieved_hadiths)} unique Hadith results.")
        return SearchResponse(results=retrieved_hadiths)

    except Exception as e:
        logging.exception("An error occurred during search.")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# --- Health Check Endpoint (No DB check needed unless critical) ---
@app.get("/health")
def health_check():
    status_items = []
    if client: status_items.append("OpenAI client: OK")
    else: status_items.append("OpenAI client: Missing")
    if index: status_items.append("FAISS index: OK")
    else: status_items.append("FAISS index: Missing")
    if mapping: status_items.append("Mapping: OK")
    else: status_items.append("Mapping: Missing")
    if hadith_lookup: status_items.append("Hadith Lookup: OK")
    else: status_items.append("Hadith Lookup: Missing")
    # Optional: Check DB file existence
    if os.path.exists(DB_PATH): status_items.append("SQLite DB File: Found")
    else: status_items.append("SQLite DB File: Missing")

    # AI search can function without DB chapters, but lookup data is important
    is_healthy = client and index and mapping and hadith_lookup
    status = "healthy" if is_healthy else "partially unhealthy" # Adjust status logic

    return {"status": status, "details": status_items}

# --- Main execution ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)