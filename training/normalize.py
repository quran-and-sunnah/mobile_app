import json
import re

# Load hadiths
with open('hadiths.json', 'r', encoding='utf-8') as f:
    hadiths = json.load(f)

# Function to normalize Arabic text
def normalize_arabic(text):
    """Normalize Arabic text by removing diacritics and standardizing characters"""
    # Remove tashkeel (diacritics)
    text = re.sub(r'[\u064B-\u065F\u0670]', '', text)
    
    # Standardize alef forms
    text = re.sub(r'[إأآا]', 'ا', text)
    
    # Standardize hamza forms
    text = re.sub(r'[ؤئ]', 'ء', text)
    
    # Standardize ya forms
    text = re.sub(r'[يى]', 'ي', text)
    
    # Standardize ha forms
    text = re.sub(r'[ة]', 'ه', text)
    
    return text

# Normalize all texts in advance
for hadith in hadiths:
    hadith['normalized_arabic'] = normalize_arabic(hadith['arabic'])

# Save normalized version
with open('hadiths_normalized.json', 'w', encoding='utf-8') as f:
    json.dump(hadiths, f, ensure_ascii=False, indent=2)

print(f"Normalized {len(hadiths)} hadiths and saved to hadiths_normalized.json")