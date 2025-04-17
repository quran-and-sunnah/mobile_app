# Updated main.py (Load from best checkpoint path)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict 
import json
import os
import re
import sys
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import logging 

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # backend directory
TRAINING_DIR = os.path.join(BASE_DIR, "..", "training")
# *** Point to the BEST checkpoint directory identified from logs ***
CHECKPOINT_RELATIVE_PATH = os.path.join(TRAINING_DIR, "hadith-semantic-model-labse_checkpoints", "checkpoint-2367") # <-- Update step number
# *** Use absolute path for model loading ***
MODEL_ABSOLUTE_PATH = os.path.abspath(CHECKPOINT_RELATIVE_PATH)
INDEX_PATH = os.path.join(BASE_DIR, "hadith_index.faiss") 
MAPPING_PATH = os.path.join(BASE_DIR, "index_mapping.json") 
HADITHS_JSON_PATH = os.path.join(TRAINING_DIR, "hadiths.json") 

# --- FastAPI Initialization ---
app = FastAPI(title="Hadith Semantic Search API")

# --- Global Variables to Load at Startup ---
model: Optional[SentenceTransformer] = None
index: Optional[faiss.Index] = None
mapping: Optional[List[Dict]] = None 
hadith_lookup: Dict[str, Dict] = {} 

# --- Consistent Normalization Function ---
def normalize_arabic_text(text):
    """Applies normalization to Arabic text."""
    if not text: return ""
    normalized = re.sub(r'[\u064B-\u065F\u0670]', '', text)
    normalized = re.sub(r'[أإآا]', 'ا', normalized)
    normalized = re.sub(r'[يى]', 'ي', normalized)
    normalized = re.sub(r'ة', 'ه', normalized)
    normalized = normalized.replace('ـ', '')
    return normalized.strip()

# --- Load Resources at Startup ---
@app.on_event("startup")
def load_resources():
    global model, index, mapping, hadith_lookup
    logging.info("Loading resources at startup...")
    
    # Load Model using Absolute Path to Checkpoint
    logging.info(f"Attempting to load BEST CHECKPOINT model from absolute path: {MODEL_ABSOLUTE_PATH}")
    if os.path.exists(MODEL_ABSOLUTE_PATH):
        # *** Load using the absolute path to the checkpoint ***
        model = SentenceTransformer(MODEL_ABSOLUTE_PATH) 
    else:
        logging.error(f"Model checkpoint directory not found: {MODEL_ABSOLUTE_PATH}")
        raise RuntimeError(f"Trained model checkpoint not found at {MODEL_ABSOLUTE_PATH}")

    # Load FAISS Index
    if os.path.exists(INDEX_PATH):
        logging.info(f"Loading FAISS index from: {INDEX_PATH}")
        index = faiss.read_index(INDEX_PATH)
        logging.info(f"FAISS index loaded. Total vectors: {index.ntotal}")
    else:
        logging.error(f"FAISS index not found: {INDEX_PATH}")
        raise RuntimeError(f"FAISS index not found at {INDEX_PATH}")

    # Load Mapping
    if os.path.exists(MAPPING_PATH):
        logging.info(f"Loading index mapping from: {MAPPING_PATH}")
        with open(MAPPING_PATH, 'r', encoding='utf-8') as f:
            mapping = json.load(f)
        logging.info(f"Index mapping loaded. Total entries: {len(mapping)}")
    else:
        logging.error(f"Index mapping not found: {MAPPING_PATH}")
        raise RuntimeError(f"Index mapping not found at {MAPPING_PATH}")
        
    # Load Hadiths for Lookup
    if os.path.exists(HADITHS_JSON_PATH):
         logging.info(f"Loading hadith details from: {HADITHS_JSON_PATH}")
         with open(HADITHS_JSON_PATH, 'r', encoding='utf-8') as f:
              all_hadiths = json.load(f)
              hadith_lookup = {str(h["id"]): h for h in all_hadiths if "id" in h}
         logging.info(f"Hadith lookup table created with {len(hadith_lookup)} entries.")
    else:
         logging.warning(f"Hadiths JSON not found for lookup: {HADITHS_JSON_PATH}")
         
    logging.info("Resources loaded successfully.")

# --- Pydantic Models for API ---
class SearchRequest(BaseModel):
    query: str
    language: str 
    top_k: int = 10

class SearchResult(BaseModel):
    id: str 
    language: str
    collection: str
    text: Optional[str] = None 
    score: float

class SearchResponse(BaseModel):
    results: List[SearchResult]

# --- Search Endpoint ---
@app.post("/search", response_model=SearchResponse)
def search_hadiths(search_request: SearchRequest):
    global model, index, mapping, hadith_lookup
    
    if not model or not index or not mapping:
        raise HTTPException(status_code=503, detail="Resources not loaded or still loading.")
        
    try:
        query_text = search_request.query
        query_language = search_request.language.lower() 
        
        normalized_query = query_text
        if query_language == 'arabic':
            logging.info(f"Normalizing Arabic query: {query_text}")
            normalized_query = normalize_arabic_text(query_text)
            logging.info(f"Normalized query: {normalized_query}")
        
        logging.info("Encoding query...")
        query_embedding = model.encode([normalized_query], convert_to_numpy=True)
        
        logging.info("Normalizing query embedding...")
        faiss.normalize_L2(query_embedding)
        
        k = search_request.top_k * 3 
        logging.info(f"Searching index for top {k} results...")
        distances, indices = index.search(query_embedding.astype(np.float32), k)
        
        results = []
        seen_hadith_ids = set() 
        logging.info("Processing search results...")

        for i in range(len(indices[0])):
            idx = indices[0][i]
            score = distances[0][i]
            
            if idx < 0 or idx >= len(mapping):
                logging.warning(f"Invalid index {idx} found. Skipping.")
                continue

            entry = mapping[idx]
            hadith_id_str = str(entry["id"]) 

            if hadith_id_str in seen_hadith_ids:
                continue
            
            hadith_data = hadith_lookup.get(hadith_id_str)
            
            display_text = None
            display_collection = entry["collection"] 
            
            if hadith_data:
                 if entry["language"] == "arabic":
                     display_text = hadith_data.get("arabic")
                 elif entry["language"] == "english" and isinstance(hadith_data.get("english"), dict):
                     display_text = hadith_data["english"].get("text")
            else:
                 logging.warning(f"Hadith ID {hadith_id_str} not found in lookup table.")

            if hadith_id_str and entry["language"] and display_collection:
                results.append(SearchResult(
                    id=hadith_id_str, language=entry["language"], 
                    collection=display_collection, text=display_text, 
                    score=float(score)
                ))
                seen_hadith_ids.add(hadith_id_str) 

            if len(results) >= search_request.top_k:
                break
        
        logging.info(f"Returning {len(results)} unique results for query '{search_request.query}'.")
        
        return SearchResponse(results=results) 
        
    except Exception as e:
        logging.exception("An error occurred during search.") 
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 

# --- Health Check Endpoint ---
@app.get("/health")
def health_check():
    status = "healthy" if model and index and mapping else "unhealthy"
    return {"status": status}

# --- Main execution ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)