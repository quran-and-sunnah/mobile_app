# Updated build_index.py (Load from best checkpoint path)

import os
import json
import re
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import logging

# --- Logging Setup ---
logging.basicConfig(format='%(asctime)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S',
                    level=logging.INFO)

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # backend directory
TRAINING_DIR = os.path.join(BASE_DIR, "..", "training")
INPUT_JSON_PATH = os.path.join(TRAINING_DIR, "hadiths.json")
# *** Point to the BEST checkpoint directory identified from logs ***
CHECKPOINT_RELATIVE_PATH = os.path.join(TRAINING_DIR, "hadith-semantic-model-labse_checkpoints", "checkpoint-2367") # <-- Update step number
# *** Use absolute path for model loading ***
MODEL_ABSOLUTE_PATH = os.path.abspath(CHECKPOINT_RELATIVE_PATH) 
OUTPUT_INDEX_PATH = os.path.join(BASE_DIR, "hadith_index.faiss") 
OUTPUT_MAPPING_PATH = os.path.join(BASE_DIR, "index_mapping.json") 


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

# --- Helper function to standardize collection names ---
def standardize_collection(title: str) -> str:
    """ Converts a given title into a standardized collection id. """
    normalized_title = re.sub(r'[\s\-\'’]', '', title.lower())
    mapping = {
        "sahihalbukhari": "bukhari", "bukhari": "bukhari",
        "sahihmuslim": "muslim", "muslim": "muslim",
        "sunanabudawud": "abudawud", "sunanabidawud": "abudawud", "abudawud": "abudawud",
        "jamialtirmidhi": "tirmidhi", "tirmidhi": "tirmidhi",
        "sunanibnmajah": "ibnmajah", "ibnmajah": "ibnmajah",
        "sunanannasai": "nasai", "annasai": "nasai",
        "muwattamalik": "malik", "malik": "malik",
        "musnadahmad": "ahmed", "ahmed": "ahmed",
        "sunanaddarimi": "darimi", "aldarimi": "darimi", "darimi": "darimi"
    }
    return mapping.get(normalized_title, normalized_title)

# --- Load Model ---
logging.info(f"Attempting to load BEST CHECKPOINT model from absolute path: {MODEL_ABSOLUTE_PATH}")
if not os.path.exists(MODEL_ABSOLUTE_PATH):
     raise FileNotFoundError(f"Model checkpoint directory not found at calculated absolute path: {MODEL_ABSOLUTE_PATH}")
# *** Load using the absolute path to the checkpoint ***
model = SentenceTransformer(MODEL_ABSOLUTE_PATH, device='cuda') 
embedding_dim = model.get_sentence_embedding_dimension()
logging.info(f"Model loaded from checkpoint. Embedding dimension: {embedding_dim}")

# --- Load and Prepare Data ---
logging.info(f"Loading hadiths from {INPUT_JSON_PATH}")
if not os.path.exists(INPUT_JSON_PATH):
     raise FileNotFoundError(f"Hadiths JSON not found at calculated path: {os.path.abspath(INPUT_JSON_PATH)}")
with open(INPUT_JSON_PATH, 'r', encoding='utf-8') as f:
    all_hadiths = json.load(f)

texts_to_embed = [] 
mapping_data = [] 

logging.info("Preparing texts and mapping...")
for i, hadith in enumerate(tqdm(all_hadiths)):
    hadith_id = hadith.get("id")
    arabic_text = hadith.get("arabic")
    english_info = hadith.get("english")
    collection_title = hadith.get("title", "unknown") 
    std_collection = standardize_collection(collection_title)

    if arabic_text:
        normalized_arabic = normalize_arabic_text(arabic_text)
        if normalized_arabic: 
            texts_to_embed.append(normalized_arabic)
            mapping_data.append({
                "original_index": len(texts_to_embed) - 1, "id": hadith_id,
                "language": "arabic", "collection": std_collection
            })

    if isinstance(english_info, dict) and english_info.get("text"):
        english_text = english_info["text"]
        if english_text: 
            texts_to_embed.append(english_text)
            mapping_data.append({
                "original_index": len(texts_to_embed) - 1, "id": hadith_id,
                "language": "english", "collection": std_collection
            })

logging.info(f"Prepared {len(texts_to_embed)} texts for embedding.")

# --- Compute Embeddings ---
batch_size = 64 
all_embeddings = []
logging.info("Computing embeddings...")
all_embeddings = model.encode(texts_to_embed, batch_size=batch_size, convert_to_numpy=True, show_progress_bar=True)

all_embeddings = np.array(all_embeddings, dtype=np.float32)
logging.info(f"Embeddings computed. Array shape: {all_embeddings.shape}")

# --- Normalize Embeddings for Cosine Similarity ---
logging.info("Normalizing embeddings (L2 normalization)...")
faiss.normalize_L2(all_embeddings)

# --- Build the FAISS Index ---
logging.info("Creating FAISS index (IndexFlatIP for cosine similarity)...")
index = faiss.IndexFlatIP(embedding_dim) 
index.add(all_embeddings)
logging.info(f"FAISS index created; total vectors indexed: {index.ntotal}")

# --- Save the FAISS Index and the Mapping ---
logging.info(f"Saving FAISS index to {OUTPUT_INDEX_PATH}")
faiss.write_index(index, OUTPUT_INDEX_PATH)

logging.info(f"Saving mapping to {OUTPUT_MAPPING_PATH}")
with open(OUTPUT_MAPPING_PATH, 'w', encoding='utf-8') as f:
    json.dump(mapping_data, f, ensure_ascii=False, indent=2)

logging.info("Index building complete.")