// utils/textUtils.ts

export const normalizeArabicText = (text: string): string => {
    if (!text) return "";
    let normalized = text.replace(/[\u064B-\u065F\u0670]/g, ''); // Remove diacritics
    normalized = normalized.replace(/[أإآا]/g, 'ا'); // Normalize alef variants
    normalized = normalized.replace(/[يى]/g, 'ي'); // Normalize ya variants
    normalized = normalized.replace(/ة/g, 'ه'); // Normalize taa marbuta
    normalized = normalized.replace(/ـ/g, ''); // Remove tatweel
    return normalized.trim();
};

export const normalizeCollectionName = (name: string): string => {
    if (!name) return "";
    // Converts to lowercase and removes spaces, hyphens, and apostrophes
    return name.toLowerCase().replace(/[\s\-']/g, '');
};

export const isArabicText = (text: string): boolean => {
    if (!text) return false;
    // Regex to check for presence of Arabic Unicode characters
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
};

export const escapeRegExp = (string: string): string => {
    if (!string) return "";
    // Escapes special regex characters
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}; 