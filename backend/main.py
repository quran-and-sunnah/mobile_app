from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# --- Configuration Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.join(BASE_DIR, "..", "training")
MODEL_DIR = os.path.join(TRAINING_DIR, "hadith-semantic-model")
INDEX_PATH = os.path.join(BASE_DIR, "hadith_index.faiss")
MAPPING_PATH = os.path.join(BASE_DIR, "index_mapping.json")
HADITHS_JSON_PATH = os.path.join(TRAINING_DIR, "hadiths.json")

# --- FastAPI Initialization ---
app = FastAPI(title="Hadith Semantic Search API")

# --- Global Variables to Load at Startup ---
model = None
index = None
mapping = None
hadith_lookup = {}

# --- Pydantic Models ---
class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5  # default number of results

class SearchResult(BaseModel):
    id: str
    language: str
    collection: str
    text: str
    score: float

class SearchResponse(BaseModel):
    results: List[SearchResult]

# --- Startup Event: Load the Model, FAISS Index, and Mappings ---
@app.on_event("startup")
def startup_event():
    global model, index, mapping, hadith_lookup
    # Load the SentenceTransformer model
    print("Loading model...")
    model = SentenceTransformer(MODEL_DIR)
    # Load the FAISS index
    print("Loading FAISS index...")
    index = faiss.read_index(INDEX_PATH)
    # Load mapping file
    print("Loading index mapping...")
    with open(MAPPING_PATH, 'r', encoding='utf-8') as f:
        mapping = json.load(f)
    # Optionally, load the full hadith JSON to get complete text details
    print("Loading full hadith data...")
    with open(HADITHS_JSON_PATH, 'r', encoding='utf-8') as f:
        hadiths = json.load(f)
    # Create lookup dictionary: {hadith_id: hadith_data}
    hadith_lookup = { str(h["id"]): h for h in hadiths }
    print("Startup complete.")

# --- Semantic Search Endpoint ---
@app.post("/search", response_model=SearchResponse)
def semantic_search(search_request: SearchRequest):
    try:
        # Encode and normalize the query
        query_embedding = model.encode(search_request.query, convert_to_numpy=True).astype(np.float32)
        query_embedding = np.expand_dims(query_embedding, axis=0)
        faiss.normalize_L2(query_embedding)

        # Search the FAISS index for the top_k results
        top_k = search_request.top_k
        distances, indices = index.search(query_embedding, top_k)
        
        results = []
        for score, idx in zip(distances[0], indices[0]):
            # Retrieve mapping details for each hit
            if idx >= 0 and idx < len(mapping):
                entry = mapping[idx]
                # Find full hadith details by using the hadith id
                hadith_id = str(entry["id"])
                hadith = hadith_lookup.get(hadith_id, {})
                # Select text based on language preference from mapping entry
                text = hadith.get("arabic") if entry["language"] == "arabic" else (
                    hadith.get("english", {}).get("text") if isinstance(hadith.get("english"), dict) else hadith.get("english")
                )
                results.append(SearchResult(
                    id=hadith_id,
                    language=entry["language"],
                    collection=entry["collection"],
                    text=text,
                    score=float(score)  # cosine similarity score (already normalized)
                ))
        
        # Optionally, sort results by score in descending order
        results.sort(key=lambda x: x.score, reverse=True)
        return SearchResponse(results=results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Health Check Endpoint ---
@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
