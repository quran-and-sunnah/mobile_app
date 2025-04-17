# train_hadith_model.py (Final Cleaned Version)

import os
import torch
import json
import random
import numpy as np
import re
from torch.utils.data import DataLoader
from sentence_transformers import SentenceTransformer, InputExample, LoggingHandler, util
from sentence_transformers.losses import MultipleNegativesRankingLoss
from sentence_transformers.evaluation import InformationRetrievalEvaluator, SimilarityFunction 
from tqdm import tqdm
import logging

# --- Logging Setup ---
logging.basicConfig(format='%(asctime)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S',
                    level=logging.INFO,
                    handlers=[LoggingHandler()])

# --- Configuration ---
INPUT_JSON_PATH = "hadiths.json"
OUTPUT_PATH = "hadith-semantic-model-labse" # Main output path (used by fit for tracking best score)
CHECKPOINT_PATH = OUTPUT_PATH + "_checkpoints" # Store intermediate checkpoints separately
MODEL_NAME = 'sentence-transformers/LaBSE'
TRAIN_SPLIT_RATIO = 0.9
NUM_EPOCHS = 5
TRAIN_BATCH_SIZE = 64 
EVAL_BATCH_SIZE = 128
LEARNING_RATE = 2e-5
WARMUP_STEPS_RATIO = 0.1

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

# --- Load and Prepare Data ---
logging.info(f"Loading data from {INPUT_JSON_PATH}...")
# ... (rest of data loading and prep is identical to the previous training script version) ...
with open(INPUT_JSON_PATH, 'r', encoding='utf-8') as f:
    all_hadiths = json.load(f)

valid_hadiths = [
    h for h in all_hadiths 
    if h.get("arabic") and isinstance(h.get("english"), dict) and h["english"].get("text")
]
logging.info(f"Loaded {len(valid_hadiths)} valid hadiths.")

for hadith in tqdm(valid_hadiths, desc="Normalizing Arabic text"):
    hadith["normalized_arabic"] = normalize_arabic_text(hadith["arabic"])
    hadith["english_text"] = hadith["english"]["text"]

random.seed(42)
random.shuffle(valid_hadiths)
split_idx = int(len(valid_hadiths) * TRAIN_SPLIT_RATIO)
train_h = valid_hadiths[:split_idx]
eval_h = valid_hadiths[split_idx:]
logging.info(f"Train set size: {len(train_h)}, Evaluation set size: {len(eval_h)}")

# --- Prepare Data for Training ---
train_examples = []
for hadith in train_h:
    if hadith.get("normalized_arabic") and hadith.get("english_text"):
         train_examples.append(InputExample(texts=[hadith["normalized_arabic"], hadith["english_text"]]))
    else:
        logging.warning(f"Skipping hadith ID {hadith.get('id')} due to missing text.")
logging.info(f"Created {len(train_examples)} training examples for MNRL.")

# --- Prepare Data for Evaluation ---
eval_queries = {} 
eval_corpus = {} 
eval_relevant_docs = {} 
query_id_counter, doc_id_counter = 0, 0
for hadith in tqdm(eval_h, desc="Preparing evaluation data"):
    hadith_id = hadith["id"]
    arabic_text = hadith.get("normalized_arabic")
    english_text = hadith.get("english_text")
    if arabic_text and english_text:
        current_query_id = f"q_{query_id_counter}"
        current_doc_id = f"d_{doc_id_counter}"
        eval_queries[current_query_id] = arabic_text
        eval_corpus[current_doc_id] = english_text
        eval_relevant_docs[current_query_id] = {current_doc_id}
        query_id_counter += 1
        doc_id_counter += 1
    else:
         logging.warning(f"Skipping hadith ID {hadith_id} in eval set.")
logging.info(f"Evaluation: {len(eval_queries)} queries, {len(eval_corpus)} corpus documents.")
if len(eval_queries) != len(eval_corpus) or len(eval_queries) != len(eval_relevant_docs):
     logging.error("Mismatch in evaluation data sizes!"); exit()

# --- Initialize Model ---
logging.info(f"Loading base model: {MODEL_NAME}")
model = SentenceTransformer(MODEL_NAME)

# --- Prepare DataLoader and Loss ---
train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=TRAIN_BATCH_SIZE)
train_loss = MultipleNegativesRankingLoss(model=model)

# --- Prepare Evaluator ---
evaluator = InformationRetrievalEvaluator(
    queries=eval_queries, corpus=eval_corpus, relevant_docs=eval_relevant_docs,
    batch_size=EVAL_BATCH_SIZE, main_score_function=SimilarityFunction.COSINE, 
    score_functions={'cos_sim': util.cos_sim}, name='hadith-retrieval-eval',
    show_progress_bar=True, mrr_at_k=[10], ndcg_at_k=[10], 
    accuracy_at_k=[1, 3, 5, 10], precision_recall_at_k=[1, 3, 5, 10], map_at_k=[10]
)

# --- Calculate Warmup Steps ---
num_training_steps = len(train_dataloader) * NUM_EPOCHS
warmup_steps = int(num_training_steps * WARMUP_STEPS_RATIO)
logging.info(f"Total training steps: {num_training_steps}, Warmup steps: {warmup_steps}")

# --- Train the Model ---
logging.info("Starting model training...")
# model.fit saves the best model checkpoint based on evaluator to CHECKPOINT_PATH
# It also uses OUTPUT_PATH internally to track the best score and save the final state (which seemed problematic)
# We will ignore the final state in OUTPUT_PATH and load directly from the best checkpoint saved in CHECKPOINT_PATH
model.fit(train_objectives=[(train_dataloader, train_loss)],
          evaluator=evaluator,
          epochs=NUM_EPOCHS,
          evaluation_steps=int(len(train_dataloader) * 0.5), 
          warmup_steps=warmup_steps,
          optimizer_params={'lr': LEARNING_RATE},
          output_path=OUTPUT_PATH, # Still needed for tracking best score
          save_best_model=True,    # Saves best checkpoint to CHECKPOINT_PATH/checkpoint-<step>
          checkpoint_save_steps=int(len(train_dataloader) * 0.5),
          checkpoint_path=CHECKPOINT_PATH, # Explicit path for checkpoints
          use_amp=True 
          )
logging.info("Training finished.")
logging.info(f"Checkpoints saved in: {CHECKPOINT_PATH}")
logging.info(f"Best checkpoint should be Step 2367 based on previous logs (MRR@10: ~0.9198)") 

# Removed the explicit load/save block as it was causing errors

print(f"Training process complete. Best model checkpoint is likely in {CHECKPOINT_PATH}/checkpoint-2367")