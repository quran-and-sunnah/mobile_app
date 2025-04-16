import os
import json
import re
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

def standardize_collection(title: str) -> str:
    """
    Converts a given title into a standardized collection id.
    It lowercases the string, removes spaces, hyphens, and apostrophes,
    then returns a canonical id based on a mapping.
    """
    # Normalize the title: lowercase and remove spaces, hyphens, and apostrophes.
    normalized_title = re.sub(r'[\s\-\'’]', '', title.lower())
    
    # Prepare a mapping dictionary with keys normalized in the same manner.
    mapping = {
        re.sub(r'[\s\-\'’]', '', "Bukhari".lower()): "bukhari",
        re.sub(r'[\s\-\'’]', '', "Sahih Muslim".lower()): "muslim",
        re.sub(r'[\s\-\'’]', '', "Muslim".lower()): "muslim",
        re.sub(r'[\s\-\'’]', '', "Abu Dawud".lower()): "abudawud",
        re.sub(r'[\s\-\'’]', '', "Sunan Abu Dawud".lower()): "abudawud",
        re.sub(r'[\s\-\'’]', '', "Sunan Abi Dawud".lower()): "abudawud",  # added variant
        re.sub(r'[\s\-\'’]', '', "Tirmidhi".lower()): "tirmidhi",
        re.sub(r'[\s\-\'’]', '', "Jami' at-Tirmidhi".lower()): "tirmidhi",
        re.sub(r'[\s\-\'’]', '', "Ibn Majah".lower()): "ibnmajah",
        re.sub(r'[\s\-\'’]', '', "Sunan Ibn Majah".lower()): "ibnmajah",
        re.sub(r'[\s\-\'’]', '', "An-Nasai".lower()): "nasai",
        re.sub(r'[\s\-\'’]', '', "Sunan an-Nasai".lower()): "nasai",
        re.sub(r'[\s\-\'’]', '', "Malik".lower()): "malik",
        re.sub(r'[\s\-\'’]', '', "Muwatta Malik".lower()): "malik",
        re.sub(r'[\s\-\'’]', '', "Ahmed".lower()): "ahmed",
        re.sub(r'[\s\-\'’]', '', "Musnad Ahmad".lower()): "ahmed",
        re.sub(r'[\s\-\'’]', '', "Darimi".lower()): "darimi",
        re.sub(r'[\s\-\'’]', '', "Sunan Darimi".lower()): "darimi"
    }
    
    # Return the canonical id if a mapping exists, otherwise return the cleaned title.
    return mapping.get(normalized_title, normalized_title)

def main():
    # --- Define Paths ---
    MODEL_PATH = os.path.join("..", "training", "hadith-semantic-model")
    HADITHS_JSON_PATH = os.path.join("..", "training", "hadiths.json")
    
    # Output files in the backend folder (overwritten if they exist)
    OUTPUT_INDEX_PATH = "hadith_index.faiss"
    OUTPUT_MAPPING_PATH = "index_mapping.json"

    # --- Load the Fine-Tuned Model ---
    print("Loading fine-tuned model from:", MODEL_PATH)
    model = SentenceTransformer(MODEL_PATH)
    embedding_dim = model.get_sentence_embedding_dimension()
    print(f"Model loaded. Embedding dimension: {embedding_dim}")

    # --- Load Hadith Data ---
    print("Loading hadith data from:", HADITHS_JSON_PATH)
    with open(HADITHS_JSON_PATH, 'r', encoding='utf-8') as f:
        hadiths = json.load(f)
    print(f"Loaded {len(hadiths)} hadith entries.")

    # --- Prepare Texts and Create a Mapping ---
    texts = []
    mapping = []  # Each entry maps an index to essential hadith details (id, language, collection)
    
    for hadith in hadiths:
        collection_title = hadith.get("title", "")
        std_collection = standardize_collection(collection_title)
        
        # Use Arabic text if available
        if "arabic" in hadith and hadith["arabic"]:
            texts.append(hadith["arabic"])
            mapping.append({
                "id": hadith["id"],
                "language": "arabic",
                "collection": std_collection
            })
        # Use English text if available
        if "english" in hadith and hadith["english"]:
            if isinstance(hadith["english"], dict):
                text = hadith["english"].get("text", "")
            else:
                text = hadith["english"]
            if text:
                texts.append(text)
                mapping.append({
                    "id": hadith["id"],
                    "language": "english",
                    "collection": std_collection
                })
    
    print(f"Prepared {len(texts)} texts for embedding.")

    # --- Compute Embeddings ---
    batch_size = 32
    all_embeddings = []
    print("Computing embeddings...")
    for i in tqdm(range(0, len(texts), batch_size)):
        batch_texts = texts[i:i+batch_size]
        embeddings = model.encode(batch_texts, convert_to_numpy=True)
        embeddings = np.array(embeddings, dtype=np.float32)
        all_embeddings.append(embeddings)
    
    all_embeddings = np.vstack(all_embeddings)
    print("Embeddings computed. Array shape:", all_embeddings.shape)

    # --- Normalize Embeddings for Cosine Similarity ---
    print("Normalizing embeddings...")
    faiss.normalize_L2(all_embeddings)

    # --- Build the FAISS Index ---
    print("Creating FAISS index...")
    index = faiss.IndexFlatIP(embedding_dim)
    index.add(all_embeddings)
    print(f"FAISS index created; total vectors indexed: {index.ntotal}")

    # --- Save the FAISS Index and the Mapping ---
    print("Saving FAISS index to", OUTPUT_INDEX_PATH)
    faiss.write_index(index, OUTPUT_INDEX_PATH)

    print("Saving mapping to", OUTPUT_MAPPING_PATH)
    with open(OUTPUT_MAPPING_PATH, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print("Index building complete.")

if __name__ == "__main__":
    main()
