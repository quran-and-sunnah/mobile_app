// Updated SearchResults.tsx with Chapter Name Truncation and Newline Removal

import React from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

// --- Helper Function (should match one in hadith.tsx or be imported) ---
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
};
const normalizeArabicText = (text: string): string => {
  if (!text) return "";
  let normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');
  normalized = normalized.replace(/[أإآا]/g, 'ا');
  normalized = normalized.replace(/[يى]/g, 'ي');
  normalized = normalized.replace(/ة/g, 'ه');
  normalized = normalized.replace(/ـ/g, ''); // Remove tatweel
  return normalized.trim();
};
// --- ---
const isArabicText = (text: string): boolean => {
  // Arabic Unicode range (approximate)
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  // Check if the text contains Arabic characters
  return arabicPattern.test(text);
};

// --- Highlight Component (from previous step) ---
interface HighlightTextProps {
  text?: string | null;
  highlightTerm: string;
  isArabic?: boolean;
  style?: object; 
  highlightStyle?: object; 
}

const HighlightText: React.FC<HighlightTextProps> = ({ 
  text, highlightTerm, isArabic = false, style, highlightStyle = styles.highlight 
}) => {
  if (!text || !highlightTerm) {
    return <Text style={style}>{text || ''}</Text>;
  }
  const escapedTerm = escapeRegExp(highlightTerm);
  const flags = isArabic ? '' : 'i'; 
  try {
    const regex = new RegExp(`(${escapedTerm})`, flags); 
    const parts = text.split(regex);
    const filteredParts = parts.filter(part => part); 
    return (
      <Text style={style}>
        {filteredParts.map((part, index) => 
          regex.test(part) ? (
            <Text key={index} style={highlightStyle}>{part}</Text>
          ) : ( part )
        )}
      </Text>
    );
  } catch (e) {
    console.error("Highlight regex error:", e);
    return <Text style={style}>{text}</Text>; 
  }
};
// --- ---

interface SearchResult {
  id: number;
  bookId: number;
  collectionId: string;
  collectionName: string;
  chapterId: number;
  chapterName: string;
  idInBook: number;
  text: string; // English text
  narrator: string;
  arabicText: string; // Original Arabic text
}

interface SearchResultsProps {
  results: SearchResult[];
  onResultPress: (result: SearchResult) => void;
  loading?: boolean;
  searchQuery: string; 
}

const SearchResults = React.forwardRef<FlatList<SearchResult>, SearchResultsProps>((
  { 
    results, 
    onResultPress,
    loading = false,
    searchQuery 
  }, 
  ref
) => {
  // --- Loading and No Results states ---
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={[styles.infoText, {marginTop: 10}]}>Searching...</Text>
      </View>
    );
  }
  if (!loading && results.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoText}>No results found. Try different keywords or search terms.</Text>
      </View>
    );
  }
  // --- ---

  // --- Helper function to process and truncate text ---
  const prepareTextSnippet = (text: string | null | undefined, maxLength: number): string => {
      if (!text) return "";
      // ** Replace newlines with spaces FIRST **
      const cleanedText = text.replace(/\n/g, ' ').trim(); 
      if (cleanedText.length > maxLength) {
          return cleanedText.substring(0, maxLength) + '...';
      }
      return cleanedText;
  };
  // --- ---

  return (
    <FlatList
      ref={ref}
      data={results}
      keyExtractor={(item) => `${item.collectionId}-${item.id}-${item.idInBook || Math.random()}`} 
      contentContainerStyle={styles.listContentContainer}
      renderItem={({ item }) => {
          // Prepare snippets *before* passing to HighlightText
          const englishSnippet = prepareTextSnippet(item.text, 120);
          const arabicSnippet = prepareTextSnippet(item.arabicText, 100); // Shorter limit for Arabic example

          return (
            <TouchableOpacity 
              style={styles.itemContainer} // Use StyleSheet
              onPress={() => onResultPress(item)}
            >
              {/* --- Header Row --- */}
              <View style={styles.headerRow}> 
                {/* Collection Info */}
                <Text style={styles.collectionText} numberOfLines={1} ellipsizeMode="tail"> 
                  {item.collectionName} #{item.idInBook}
                </Text>
                {/* Chapter Name (Truncated) */}
                <Text style={styles.chapterText} numberOfLines={1} ellipsizeMode="tail"> 
                  {item.chapterName}
                </Text>
              </View>
              {/* --- --- */}
              
              {/* --- Narrator --- */}
              {item.narrator ? (
                 <HighlightText
                    text={item.narrator}
                    highlightTerm={searchQuery}
                    style={styles.narratorText}
                 />
              ) : null}
              {/* --- --- */}
              
              {/* --- English Snippet (Highlighted) --- */}
              <HighlightText
                 text={englishSnippet} // Pass the prepared snippet
                 highlightTerm={searchQuery}
                 style={styles.englishText} 
              />
              {/* --- --- */}
              
              {/* --- Arabic Snippet (Highlighted) --- */}
              {item.arabicText && ( // Check if original Arabic exists
                <View style={styles.arabicContainer}>
                   <HighlightText
                      text={arabicSnippet} // Pass the prepared snippet
                      // Match against normalized query for better chances
                      highlightTerm={isArabicText(searchQuery) ? normalizeArabicText(searchQuery) : searchQuery} 
                      isArabic={true} 
                      style={styles.arabicText} 
                   />
                </View>
              )}
              {/* --- --- */}
            </TouchableOpacity>
          );
        }
      }
    />
  );
});

// --- StyleSheet ---
const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  infoText: {
    color: '#FFFFFF', // text-white
    fontFamily: 'Poppins-Regular', // font-poppins
    textAlign: 'center',
  },
  listContentContainer: { 
     paddingBottom: 12, 
     paddingHorizontal: 12 
  },
  itemContainer: {
    padding: 16, // p-4
    marginBottom: 12, // mb-3
    backgroundColor: '#1F2937', // bg-gray-800 
    borderRadius: 8, // rounded
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4, // mb-1
    // Allow wrapping if needed, though numberOfLines handles overflow
    flexWrap: 'wrap', 
    gap: 8, // Add gap between items if they wrap
  },
  collectionText: {
    color: '#9CA3AF', // text-gray-400
    fontFamily: 'Poppins-SemiBold', // font-poppinsSemiBold
    fontSize: 12, // text-sm
    // Allow shrinking but prioritize showing full if possible
    flexShrink: 1, 
  },
  chapterText: {
    color: '#9CA3AF', // text-gray-400
    fontFamily: 'Poppins-Regular', // font-poppins
    fontSize: 12, // text-sm
    textAlign: 'right',
    // Allow shrinking significantly and truncate
    flexShrink: 1, 
    flexBasis: '50%', // Give it roughly half the space initially
  },
  highlight: {
    backgroundColor: '#FACC15', // yellow-400
    color: '#1F2937', // gray-800
  },
  narratorText: {
    color: '#9CA3AF', // text-gray-400
    fontFamily: 'Poppins-SemiBold', // font-poppinsSemiBold
    marginBottom: 4, // mb-1
  },
  englishText: {
    color: '#FFFFFF', // text-white
    fontFamily: 'Poppins-Regular', // font-poppins
    textAlign: 'left', // text-left
    fontSize: 14, // Adjust size as needed
    lineHeight: 20, // Adjust line height
  },
  arabicContainer: {
     marginTop: 8, // mt-2
     paddingTop: 8, // pt-2
     borderTopWidth: 1,
     borderColor: '#374151', // border-gray-700
     width: '100%',
     alignItems: 'flex-end', // items-end
  },
  arabicText: {
     color: '#FFFFFF', // text-white
     textAlign: 'right', // text-right
     fontSize: 16, // Make Arabic slightly larger maybe
     // Add fontFamily for Arabic if you have one loaded
     // fontFamily: 'YourArabicFont-Regular', 
     lineHeight: 24, // Adjust line height
  }
});
// --- ---

export default SearchResults;