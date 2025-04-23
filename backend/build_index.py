# build_index.py (Using OpenAI text-embedding-3-small with Recursive Splitter)

import os
import json
import re
import numpy as np
import faiss
from openai import OpenAI
from tqdm import tqdm
import logging
import time
from dotenv import load_dotenv
import tiktoken # <--- Import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter # <--- Import Langchain Splitter

load_dotenv()

# --- Logging Setup ---
logging.basicConfig(format='%(asctime)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S',
                    level=logging.INFO)

# --- Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "..", "assets")
INPUT_JSON_PATH = os.path.join(ASSETS_DIR, "hadiths.json")
OUTPUT_INDEX_PATH = os.path.join(BASE_DIR, "hadith_index_openai_small_recursive.faiss") # <-- New index name
OUTPUT_MAPPING_PATH = os.path.join(BASE_DIR, "index_mapping_openai_small_recursive.json") # <-- New mapping name

OPENAI_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
# Chunking parameters - NOW IN TOKENS using tiktoken
TARGET_CHUNK_TOKENS = 256  # Target size in tokens (adjust as needed)
CHUNK_OVERLAP_TOKENS = 50  # Overlap in tokens (adjust as needed)
API_BATCH_SIZE = 200 # Batch size for OpenAI API
DELAY_BETWEEN_BATCHES = 1 # Seconds delay

# --- Tiktoken Length Function ---
def tiktoken_len(text):
    # Initialize tokenizer for the specified model
    # It's good practice to handle potential errors if model name is invalid
    try:
        tokenizer = tiktoken.encoding_for_model(OPENAI_MODEL)
    except KeyError:
        logging.warning(f"Model {OPENAI_MODEL} not found for tiktoken. Using cl100k_base.")
        tokenizer = tiktoken.get_encoding("cl100k_base") # Fallback
    return len(tokenizer.encode(text))

# --- Initialize Text Splitter ---
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=TARGET_CHUNK_TOKENS,
    chunk_overlap=CHUNK_OVERLAP_TOKENS,
    length_function=tiktoken_len, # Use token length function
    # Common separators, try splitting by paragraphs first, then sentences, etc.
    separators=["\n\n", "\n", ". ", "? ", "! ", "؟ ", "، ", ",", " ", ""],
    add_start_index=False, # Don't need start index metadata for this use case
)

# --- Consistent Normalization Function ---
# (Keep normalize_arabic_text and standardize_collection functions as before)
def normalize_arabic_text(text):
    """Applies normalization to Arabic text."""
    if not text: return ""
    normalized = re.sub(r'[\u064B-\u065F\u0670]', '', text)
    normalized = re.sub(r'[أإآا]', 'ا', normalized)
    normalized = re.sub(r'[يى]', 'ي', normalized)
    normalized = re.sub(r'ة', 'ه', normalized)
    normalized = normalized.replace('ـ', '')
    return normalized.strip()

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


# --- Initialize OpenAI Client ---
# (Keep OpenAI client initialization as before)
logging.info("Initializing OpenAI client...")
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable not set.")
client = OpenAI(api_key=api_key)
logging.info(f"Using OpenAI model: {OPENAI_MODEL} with dimension {EMBEDDING_DIM}")


# --- Load Data ---
# (Keep data loading as before)
logging.info(f"Loading hadiths from {INPUT_JSON_PATH}")
if not os.path.exists(INPUT_JSON_PATH):
     raise FileNotFoundError(f"Hadiths JSON not found: {os.path.abspath(INPUT_JSON_PATH)}")
with open(INPUT_JSON_PATH, 'r', encoding='utf-8') as f:
    all_hadiths = json.load(f)

# --- Prepare Chunks and Mapping using Recursive Splitter ---
chunks_to_embed = []
mapping_data = []
vector_index_counter = 0

logging.info("Preparing text chunks and mapping using RecursiveCharacterTextSplitter...")
for hadith in tqdm(all_hadiths):
    hadith_id = hadith.get("id")
    arabic_text = hadith.get("arabic")
    english_info = hadith.get("english")
    collection_title = hadith.get("title", "unknown")
    std_collection = standardize_collection(collection_title)

    if not hadith_id: continue

    full_content_parts = []
    # Optional: Prepend context
    # full_content_parts.append(f"Book: {collection_title}")

    normalized_arabic = normalize_arabic_text(arabic_text) if arabic_text else ""
    if normalized_arabic:
         full_content_parts.append(f"Arabic Text: {normalized_arabic}")

    english_text = english_info.get("text") if isinstance(english_info, dict) else ""
    if english_text:
        full_content_parts.append(f"English Text: {english_text}")

    full_content = "\n".join(full_content_parts)

    if not full_content: continue

    # --- Use Langchain Splitter ---
    text_chunks = text_splitter.split_text(full_content)
    # -----------------------------

    for chunk_index, chunk in enumerate(text_chunks):
        chunks_to_embed.append(chunk)
        mapping_data.append({
            "vector_index": vector_index_counter,
            "parent_hadith_id": hadith_id,
            "chunk_index": chunk_index,
            "collection": std_collection
        })
        vector_index_counter += 1

logging.info(f"Prepared {len(chunks_to_embed)} text chunks for embedding.")

# --- Compute Embeddings for Chunks ---
# (Embedding computation loop remains the same as previous version)
all_embeddings = []
logging.info(f"Computing embeddings in batches of {API_BATCH_SIZE}...")

for i in tqdm(range(0, len(chunks_to_embed), API_BATCH_SIZE)):
    batch_texts = chunks_to_embed[i:i+API_BATCH_SIZE]
    if not batch_texts: continue
    try:
        response = client.embeddings.create(
            input=batch_texts,
            model=OPENAI_MODEL,
        )
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)
        logging.debug(f"Processed batch {i//API_BATCH_SIZE + 1}, sleeping for {DELAY_BETWEEN_BATCHES}s")
        time.sleep(DELAY_BETWEEN_BATCHES)
    except Exception as e:
        logging.error(f"Error processing batch starting at index {i}: {e}")
        raise RuntimeError(f"Failed to get embeddings from OpenAI: {e}")

if len(all_embeddings) != len(chunks_to_embed):
     raise RuntimeError(f"Mismatch in chunks and embeddings: {len(chunks_to_embed)} chunks vs {len(all_embeddings)} embeddings")

all_embeddings_np = np.array(all_embeddings, dtype=np.float32)
logging.info(f"Embeddings computed. Array shape: {all_embeddings_np.shape}")

# --- Normalize Embeddings (Optional but safe) ---
logging.info("Normalizing embeddings (L2 normalization)...")
faiss.normalize_L2(all_embeddings_np)

# --- Build the FAISS Index for Chunks ---
logging.info(f"Creating FAISS index (IndexFlatIP) with dimension {EMBEDDING_DIM}...")
index = faiss.IndexFlatIP(EMBEDDING_DIM)
index.add(all_embeddings_np)
logging.info(f"FAISS index created; total chunk vectors indexed: {index.ntotal}")

# --- Save the FAISS Index and the New Mapping ---
logging.info(f"Saving FAISS index to {OUTPUT_INDEX_PATH}")
faiss.write_index(index, OUTPUT_INDEX_PATH)

logging.info(f"Saving mapping to {OUTPUT_MAPPING_PATH}")
final_mapping = {item['vector_index']: {
                    'parent_hadith_id': item['parent_hadith_id'],
                    'chunk_index': item['chunk_index'],
                    'collection': item['collection']
                 } for item in mapping_data}
with open(OUTPUT_MAPPING_PATH, 'w', encoding='utf-8') as f:
    json.dump(final_mapping, f, ensure_ascii=False, indent=2)

logging.info("Index building complete.")