# conversion_script.py (Conceptual Example)
import json
import sqlite3
import os
import re # For normalization functions

# --- Normalization Functions (Ported from your TS) ---
def normalize_arabic_text(text):
    if not isinstance(text, str):
        return ""
    # Remove diacritics
    normalized = re.sub(r'[\u064B-\u065F\u0670]', '', text)
    # Normalize alef
    normalized = re.sub(r'[أإآا]', 'ا', normalized)
    # Normalize yaa
    normalized = re.sub(r'[يى]', 'ي', normalized)
    # Normalize taa marbuta
    normalized = re.sub(r'ة', 'ه', normalized)
    # Optional: Remove tatweel (elongation character)
    normalized = re.sub(r'ـ', '', normalized)
    return normalized.strip()

# --- Main Script ---
DATABASE_NAME = 'hadith_data.db'
ASSETS_DIR = './assets' # Path to your JSON files
COLLECTIONS_INFO = [ # Match your TS array
    { "id": 'bukhari', "name": 'Bukhari', "author": 'Imam Bukhari', "initial": 'B' },
    { "id": 'muslim', "name": 'Muslim', "author": 'Imam Muslim', "initial": 'M' },
    { "id": 'ahmed', "name": 'Ahmed', "author": 'Imam Ahmad ibn Hanbal', "initial": 'A' },
    { "id": 'malik', "name": 'Malik', "author": 'Imam Malik', "initial": 'M' },
    { "id": 'abudawud', "name": 'Abu Dawud', "author": 'Imam Abu Dawud', "initial": 'AD' },
    { "id": 'tirmidhi', "name": 'Tirmidhi', "author": 'Imam at-Tirmidhi', "initial": 'T' },
    { "id": 'ibnmajah', "name": 'Ibn Majah', "author": 'Imam Ibn Majah', "initial": 'IM' },
    { "id": 'nasai', "name": 'An-Nasai', "author": 'Imam an-Nasai', "initial": 'N' },
    { "id": 'darimi', "name": 'Ad-Darimi', "author": 'Imam ad-Darimi', "initial": 'D' }
]

# Delete existing DB if it exists to start fresh
if os.path.exists(DATABASE_NAME):
    os.remove(DATABASE_NAME)

conn = sqlite3.connect(DATABASE_NAME)
cursor = conn.cursor()

# Create Tables
cursor.execute('''
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    author TEXT,
    initial TEXT,
    metadata_en_title TEXT,
    metadata_ar_title TEXT,
    metadata_en_intro TEXT,
    metadata_ar_intro TEXT
)''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS chapters (
    internal_id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique ID across DB
    id INTEGER NOT NULL, -- Chapter ID within collection
    collection_id TEXT NOT NULL,
    book_id INTEGER,
    english_name TEXT,
    arabic_name TEXT,
    FOREIGN KEY (collection_id) REFERENCES collections (id)
)''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS hadiths (
    internal_id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique ID across DB
    id INTEGER NOT NULL, -- Hadith ID within collection
    collection_id TEXT NOT NULL,
    chapter_id INTEGER,
    book_id INTEGER,
    id_in_book INTEGER,
    english_narrator TEXT,
    english_text TEXT,
    arabic_text TEXT,
    arabic_text_normalized TEXT, -- For faster Arabic search
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    -- Optional: FOREIGN KEY (collection_id, chapter_id) REFERENCES chapters (collection_id, id)
)''')

# --- Process Each Collection ---
for coll_info in COLLECTIONS_INFO:
    collection_id = coll_info['id']
    json_path = os.path.join(ASSETS_DIR, f'{collection_id}.json')

    if not os.path.exists(json_path):
        print(f"Warning: JSON file not found for {collection_id}, skipping.")
        continue

    print(f"Processing {collection_id}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Insert Collection Info
        metadata = data.get('metadata', {})
        en_meta = metadata.get('english', {})
        ar_meta = metadata.get('arabic', {})
        cursor.execute('''
        INSERT INTO collections (id, name, author, initial, metadata_en_title, metadata_ar_title, metadata_en_intro, metadata_ar_intro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            collection_id, coll_info['name'], coll_info['author'], coll_info['initial'],
            en_meta.get('title'), ar_meta.get('title'),
            en_meta.get('introduction'), ar_meta.get('introduction')
        ))

        # Insert Chapters
        chapters_to_insert = []
        for chapter in data.get('chapters', []):
            chapters_to_insert.append((
                chapter.get('id'), collection_id, chapter.get('bookId'),
                chapter.get('english'), chapter.get('arabic')
            ))
        cursor.executemany('''
        INSERT INTO chapters (id, collection_id, book_id, english_name, arabic_name)
        VALUES (?, ?, ?, ?, ?)
        ''', chapters_to_insert)

        # Insert Hadiths
        hadiths_to_insert = []
        for hadith in data.get('hadiths', []):
            en_hadith = hadith.get('english', {})
            arabic_raw = hadith.get('arabic', '')
            arabic_normalized = normalize_arabic_text(arabic_raw)
            hadiths_to_insert.append((
                hadith.get('id'), collection_id, hadith.get('chapterId'), hadith.get('bookId'),
                hadith.get('idInBook'), en_hadith.get('narrator'), en_hadith.get('text'),
                arabic_raw, arabic_normalized
            ))
        cursor.executemany('''
        INSERT INTO hadiths (id, collection_id, chapter_id, book_id, id_in_book, english_narrator, english_text, arabic_text, arabic_text_normalized)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', hadiths_to_insert)

    except Exception as e:
        print(f"Error processing {collection_id}: {e}")
        conn.rollback() # Rollback changes for this collection on error
    else:
        conn.commit() # Commit changes for this collection

print("Creating indexes...")
# --- Add Indexes for Performance ---
cursor.execute("CREATE INDEX IF NOT EXISTS idx_chapters_collection ON chapters (collection_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_collection ON hadiths (collection_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_chapter ON hadiths (collection_id, chapter_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_id_in_book ON hadiths (collection_id, id_in_book)")
# Optional: Index for text search (LIKE might still be slow on large text)
# cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_en_text ON hadiths (english_text)")
# cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_ar_norm_text ON hadiths (arabic_text_normalized)")

# --- Optional: Full-Text Search (FTS5) ---
# Create an FTS table mirroring hadiths for efficient text search
# cursor.execute('''
# CREATE VIRTUAL TABLE IF NOT EXISTS hadiths_fts USING fts5(
#     english_narrator,
#     english_text,
#     arabic_text_normalized,
#     content='hadiths', -- Link to original table
#     content_rowid='internal_id' -- Use the unique row ID
# )''')
# # Populate the FTS table
# cursor.execute('''
# INSERT INTO hadiths_fts (rowid, english_narrator, english_text, arabic_text_normalized)
# SELECT internal_id, english_narrator, english_text, arabic_text_normalized FROM hadiths
# ''')

conn.commit()
print("Indexes created.")
conn.close()
print(f"Database '{DATABASE_NAME}' created successfully.")