# conversion_script.py
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
ASSETS_DIR = '../assets' # Path to your JSON files
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
    print(f"Removed existing database '{DATABASE_NAME}'.")

conn = sqlite3.connect(DATABASE_NAME)
cursor = conn.cursor()

# Create Tables
print("Creating standard tables...")
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

# Use internal_id as the primary key for hadiths table
cursor.execute('''
CREATE TABLE IF NOT EXISTS hadiths (
    internal_id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique ID across DB, used for FTS rowid
    id INTEGER NOT NULL, -- Hadith ID within collection (original JSON ID)
    collection_id TEXT NOT NULL,
    chapter_id INTEGER,
    book_id INTEGER,
    id_in_book INTEGER,
    english_narrator TEXT,
    english_text TEXT,
    arabic_text TEXT,
    arabic_text_normalized TEXT, -- For faster Arabic search / FTS indexing
    FOREIGN KEY (collection_id) REFERENCES collections (id)
    -- Optional: FOREIGN KEY (collection_id, chapter_id) REFERENCES chapters (collection_id, id)
    -- Check if chapter IDs are unique per collection or globally before adding composite FK
)''')
conn.commit()
print("Standard tables created.")

# --- Process Each Collection ---
total_hadiths_processed = 0
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
            # Using original `id` from JSON, chapterId, bookId, idInBook directly
            hadiths_to_insert.append((
                hadith.get('id'), collection_id, hadith.get('chapterId'), hadith.get('bookId'),
                hadith.get('idInBook'), en_hadith.get('narrator'), en_hadith.get('text'),
                arabic_raw, arabic_normalized
            ))
        cursor.executemany('''
        INSERT INTO hadiths (id, collection_id, chapter_id, book_id, id_in_book, english_narrator, english_text, arabic_text, arabic_text_normalized)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', hadiths_to_insert)
        total_hadiths_processed += len(hadiths_to_insert)
        print(f"Processed {len(chapters_to_insert)} chapters and {len(hadiths_to_insert)} hadiths for {collection_id}.")

    except Exception as e:
        print(f"Error processing {collection_id}: {e}")
        conn.rollback() # Rollback changes for this collection on error
    else:
        conn.commit() # Commit changes for this collection

print(f"\nFinished processing all collections. Total hadiths inserted: {total_hadiths_processed}")

# --- Add Indexes for Performance ---
print("Creating standard indexes...")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_chapters_collection ON chapters (collection_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_collection ON hadiths (collection_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_chapter ON hadiths (collection_id, chapter_id)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_id_in_book ON hadiths (collection_id, id_in_book)")
# Indexing the normalized arabic text might still be useful for specific non-FTS queries if needed
cursor.execute("CREATE INDEX IF NOT EXISTS idx_hadiths_ar_norm_text ON hadiths (arabic_text_normalized)")
conn.commit()
print("Standard indexes created.")

# --- Add Full-Text Search (FTS5) ---
print("Creating FTS5 table...")
# Create the FTS table using fts5 engine
# Link it to the 'hadiths' table using the unique 'internal_id' as the rowid
cursor.execute('''
CREATE VIRTUAL TABLE IF NOT EXISTS hadiths_fts USING fts5(
    english_narrator,
    english_text,
    arabic_text_normalized,
    content='hadiths',        -- Optional: Name of the content table
    content_rowid='internal_id', -- *** IMPORTANT: Use the actual PK of hadiths ***
    -- Optional: Add tokenizer if needed, e.g., tokenize="unicode61 remove_diacritics 0"
    -- Start without tokenizer for simplicity unless issues arise
    -- Note: Default tokenizer 'unicode61' is often good for multiple languages.
    tokenize = "unicode61 remove_diacritics 0" -- Try unicode61 to handle text better, disable diacritics removal as we pre-normalized
)''')
conn.commit()
print("FTS5 table created.")

print("Populating FTS5 table...")
# Populate the FTS table with data from the main hadiths table
# This needs to run *after* hadiths table is fully populated
cursor.execute('''
INSERT INTO hadiths_fts (rowid, english_narrator, english_text, arabic_text_normalized)
SELECT internal_id, english_narrator, english_text, arabic_text_normalized FROM hadiths
''')
conn.commit()
print("FTS5 table populated.")

print("Creating FTS synchronization triggers...")
# --- Triggers to keep FTS table synced with hadiths table ---
# (Essential if the hadiths table could ever be modified *after* initial creation)

# After deleting a hadith, delete from FTS index
# The 'delete' command requires the old rowid
cursor.execute('''
CREATE TRIGGER IF NOT EXISTS hadiths_ad AFTER DELETE ON hadiths BEGIN
  INSERT INTO hadiths_fts (hadiths_fts, rowid) VALUES ('delete', old.internal_id);
END;
''')

# After inserting a hadith, insert into FTS index
cursor.execute('''
CREATE TRIGGER IF NOT EXISTS hadiths_ai AFTER INSERT ON hadiths BEGIN
  INSERT INTO hadiths_fts (rowid, english_narrator, english_text, arabic_text_normalized)
  VALUES (new.internal_id, new.english_narrator, new.english_text, new.arabic_text_normalized);
END;
''')

# After updating a hadith, update the FTS index
# This is done by deleting the old entry and inserting the new one
# Need to reference the specific columns that might change
cursor.execute('''
CREATE TRIGGER IF NOT EXISTS hadiths_au AFTER UPDATE ON hadiths BEGIN
  INSERT INTO hadiths_fts (hadiths_fts, rowid) VALUES ('delete', old.internal_id);
  INSERT INTO hadiths_fts (rowid, english_narrator, english_text, arabic_text_normalized)
  VALUES (new.internal_id, new.english_narrator, new.english_text, new.arabic_text_normalized);
END;
''')

conn.commit()
print("FTS triggers created.")

# --- Finalize ---
conn.close()
print(f"Database '{DATABASE_NAME}' created successfully with FTS5.")