import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Share, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { dbPromise } from '@/utils/dbSetup';
import type { SQLiteDatabase } from 'expo-sqlite';
import SearchBar from "@/components/SearchBar";
import { normalizeArabicText, isArabicText, escapeRegExp } from "@/utils/textUtils";
import "@/global.css";

// --- Interface ---
interface SearchResult {
    id: number; // Unique Hadith ID from DB
    bookId: number;
    collectionId: string;
    collectionName: string;
    chapterId: number;
    chapterName: string;
    idInBook: number; // Hadith number within the collection/book
    text: string; // English text
    narrator: string;
    arabicText: string; // Original Arabic text
}

// --- HighlightText Component (Added Back) ---
interface HighlightTextProps {
  text?: string | null;
  highlightTerm: string;
  isArabic?: boolean; // Keep for potential future use if needed
  style?: object;
  highlightStyle?: object;
}

const HighlightText: React.FC<HighlightTextProps> = ({
  text, highlightTerm, isArabic = false, style, highlightStyle = styles.highlight // Default to styles.highlight
}) => {
  if (!text || !highlightTerm) {
    // If no text or term, return plain text
    return <Text style={style}>{text || ''}</Text>;
  }

  // Escape the search term for safe regex use
  const escapedTerm = escapeRegExp(highlightTerm);
  // Case-insensitive for English, case-sensitive for Arabic (default)
  const flags = isArabic ? '' : 'i';
  let regex: RegExp;

  try {
      // Create regex to find the term (capture it in a group)
      regex = new RegExp(`(${escapedTerm})`, flags);
  } catch (e) {
      console.error("Highlight regex error:", e, "Term:", highlightTerm);
      // Fallback: return plain text if regex fails
      return <Text style={style}>{text}</Text>;
  }

  // Split the text by the regex. Parts will include delimiters (the matched term).
  const parts = text.split(regex);

  // Filter out empty strings that might result from splitting
  const filteredParts = parts.filter(part => part);

  return (
    <Text style={style}>
      {filteredParts.map((part, index) =>
        // Test if the part *is* the term we were looking for
        // Need to use the original regex test, comparing part directly might fail with case-insensitivity
        regex.test(part) && part.toLowerCase() === highlightTerm.toLowerCase() ? ( // Added direct comparison for robustness with 'i' flag
          // If it matches, apply the highlight style
          <Text key={`${index}-${part}`} style={highlightStyle}>{part}</Text>
        ) : (
          // Otherwise, render the part as plain text
          part // React fragment is not needed here for a single string
        )
      )}
    </Text>
  );
};
// --- End HighlightText Component ---


// --- Helper Function for Snippets ---
const prepareTextSnippet = (text: string | null | undefined, maxLength: number): string => {
     if (!text) return "";
     const cleanedText = text.replace(/\n+/g, ' ').trim();
     if (cleanedText.length > maxLength) {
         return cleanedText.substring(0, maxLength) + '...';
     }
     return cleanedText;
};
// --- End Helper ---

export default function HadithSearchScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ q: string; ai?: string; collectionId?: string; chapterId?: string }>();
    const searchQuery = params.q || "";
    const isAISearch = params.ai === 'true';
    const filterCollectionId = params.collectionId;
    const filterChapterId = params.chapterId;

    // State for the search input field on *this* screen
    const [searchInput, setSearchInput] = useState(searchQuery); 

    const [db, setDb] = useState<SQLiteDatabase | null>(null);
    const [searchLoading, setSearchLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 20;

    const searchListRef = useRef<FlatList>(null);

    // --- Database Initialization Effect ---
    useEffect(() => {
        let isMounted = true;
        dbPromise.then((database: SQLiteDatabase) => {
            if (isMounted) setDb(database);
        }).catch((err: any) => {
            console.error(`DB Init Effect FAILED:`, err);
            if (isMounted) {
                setError('Database failed to load. Cannot perform local search.');
                setSearchLoading(false);
            }
        });
        return () => { isMounted = false; };
    }, []);

    // --- Search Data Fetching Effect ---
    useEffect(() => {
        // Use a flag to prevent state updates if the effect is superseded
        let isActive = true;

        const performSearch = async () => {
            if (!searchQuery) {
                if (isActive) {
                    setSearchLoading(false);
                    setAllSearchResults([]);
                    setError(null);
                }
                return;
            }

            if (isActive) {
                setSearchLoading(true);
                setError(null); 
                setAllSearchResults([]); 
                setCurrentPage(1); 
            }

            try {
                let results: SearchResult[] = [];
                if (isAISearch) {
                    // --- AI Search ---
                    if (!db) { // Check db before proceeding in AI path too
                        if(isActive) setError("Database not ready for fetching AI result details.");
                        throw new Error("DB not ready"); // Throw to reach finally block
                    }        
                    const host = Constants.expoConfig?.hostUri?.split(":")[0];
                    const API_URL = host ? `http://${host}:8000` : "http://localhost:8000"; 
                    
                    let rawAIResults: { id: string; collection: string; score: number }[] = [];
                    
                    // Step 1: Fetch initial IDs from AI backend
                    const language = isArabicText(searchQuery) ? 'ar' : 'en';
                    const response = await fetch(`${API_URL}/search`, { 
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ query: searchQuery, language: language })
                     });
                     
                    if (!response.ok) { 
                         let errorBody = `HTTP error ${response.status}`;
                         try { errorBody = await response.text(); } catch (_e) {}
                         throw new Error(errorBody);
                    }
                    
                    const data = await response.json();
                    // console.log("DEBUG: AI Search - Raw response data:", JSON.stringify(data, null, 2)); // Keep log if needed

                    // Parse the initial results 
                    if (data && Array.isArray(data.results)) { rawAIResults = data.results; }
                    else if (Array.isArray(data)) { rawAIResults = data; }
                    else { throw new Error("Received invalid data format from AI search."); }

                    if (rawAIResults.length === 0) {
                        console.log("AI Search returned 0 IDs.");
                        results = []; // Set empty results
                    } else {
                        // Step 2: Fetch full details from local DB using IDs from AI
                        const hadithIds = rawAIResults.map(res => parseInt(res.id, 10)).filter(id => !isNaN(id));
                        if(hadithIds.length === 0) {
                            console.log("AI Search - No valid numeric IDs found.");
                            results = [];
                        } else {
                            const placeholders = hadithIds.map(() => '?').join(',');
                            const sql = `SELECT h.id, h.collection_id as collectionId, co.name as collectionName,
                                         h.chapter_id as chapterId, ch.english_name as chapterName, h.id_in_book as idInBook,
                                         h.english_narrator as narrator, h.english_text as text, h.arabic_text as arabicText,
                                         h.book_id as bookId
                                         FROM hadiths h JOIN collections co ON h.collection_id = co.id
                                         LEFT JOIN chapters ch ON h.collection_id = ch.collection_id AND h.chapter_id = ch.id
                                         WHERE h.id IN (${placeholders});`;
                                         
                            let fetchedFullResults: SearchResult[] = []; // Variable to store results from transaction
                            // Use a transaction here too for consistency/safety
                            await db.withTransactionAsync(async () => {
                                // Assign the result to the outer variable
                                fetchedFullResults = await db.getAllAsync<SearchResult>(sql, hadithIds);
                                // Do not return anything here
                            });
                            // Optional: Reorder based on AI score
                            const resultMap = new Map(fetchedFullResults.map(res => [res.id, res]));
                            const orderedResults = hadithIds.map(id => resultMap.get(id)).filter((res): res is SearchResult => !!res); // Type guard
                            results = orderedResults;
                        }
                    }
                } else if (db) {
                    // --- Local DB Search ---
                    const isQueryArabic = isArabicText(searchQuery);
                    const normalizedQueryForSQL = isQueryArabic ? normalizeArabicText(searchQuery) : searchQuery;
                    const searchTermSQL = `%${normalizedQueryForSQL}%`;
                    const termForRegex = isQueryArabic ? normalizeArabicText(searchQuery) : searchQuery;
                    const escapedTermForRegex = escapeRegExp(termForRegex);
                    let filterRegex: RegExp | null = null;
                    try { filterRegex = new RegExp(`\\b${escapedTermForRegex}\\b`, isQueryArabic ? '' : 'i'); }
                    catch (e) { throw new Error("Invalid search pattern."); }

                    // Variable to hold results calculated inside the transaction
                    let transactionResults: SearchResult[] = [];

                    await db.withTransactionAsync(async () => {
                        // ... (Build SQL WHERE clause and args as before)
                        let baseWhereClause = `(h.english_narrator LIKE ? OR h.english_text LIKE ? OR h.arabic_text_normalized LIKE ?)`;
                        const baseArgs = [searchTermSQL, searchTermSQL, searchTermSQL];
                        let filterClauses = [];
                        let filterArgs = [];
                        if (filterCollectionId) { filterClauses.push(`h.collection_id = ?`); filterArgs.push(filterCollectionId); }
                        if (filterChapterId) { filterClauses.push(`h.chapter_id = ?`); filterArgs.push(filterChapterId); }
                        const whereClause = filterClauses.length > 0 ? `${baseWhereClause} AND ${filterClauses.join(' AND ')}` : baseWhereClause;
                        const args = [...baseArgs, ...filterArgs];
                        const sql = `SELECT h.id, h.collection_id as collectionId, co.name as collectionName,
                                     h.chapter_id as chapterId, ch.english_name as chapterName, h.id_in_book as idInBook,
                                     h.english_narrator as narrator, h.english_text as text, h.arabic_text as arabicText,
                                     h.book_id as bookId
                                     FROM hadiths h JOIN collections co ON h.collection_id = co.id
                                     LEFT JOIN chapters ch ON h.collection_id = ch.collection_id AND h.chapter_id = ch.id
                                     WHERE ${whereClause}
                                     LIMIT 500;`; 
                        
                        // console.log(`Executing SQL: WHERE ${whereClause} with args:`, args);
                        const initialResults = await db.getAllAsync<SearchResult>(sql, args);
                        // --- Log count before filtering ---
                        console.log("DEBUG: Local Search - Initial SQL results count:", initialResults.length);

                        // JS Filtering step
                        const filteredResults = initialResults.filter(result => {
                             if (!filterRegex) return false; 
                             const englishContent = (result.narrator || '') + ' ' + (result.text || '');
                             const arabicContentNormalized = normalizeArabicText(result.arabicText || '');
                             if (isQueryArabic) {
                                 return filterRegex.test(arabicContentNormalized);
                             } else {
                                 return filterRegex.test(englishContent) || filterRegex.test(arabicContentNormalized);
                             }
                        });
                        // --- Log count after filtering ---
                        console.log("DEBUG: Local Search - Filtered results count:", filteredResults.length);
                        
                        transactionResults = filteredResults;
                    });
                    results = transactionResults; // Assign results after transaction completes

                } else if (!isAISearch && !db) {
                    // DB not ready for local search, wait
                    if(isActive) setError("Database is initializing...");
                    return; // Keep loading true, wait for DB
                }

                // Update state only if the effect is still active
                if (isActive) {
                    // console.log("DEBUG: Search Effect - Updating state with results.");
                    setAllSearchResults(results);
                    setError(null); // Clear error on success
                }

            } catch (err: any) { // Catch errors from any branch
                console.error('DEBUG: Search Effect - Error during search:', err);
                 if (isActive) {
                    setError(`Search Failed: ${err.message || 'An unknown error occurred.'}`);
                    setAllSearchResults([]); 
                 }
            } finally {
                 if (isActive) {
                    // console.log("DEBUG: Search Effect - Setting loading false.");
                    setSearchLoading(false);
                 }
            }
        };

        performSearch();

        // Cleanup function 
        return () => {
            isActive = false;
        };

    }, [db, searchQuery, isAISearch, filterCollectionId, filterChapterId]); 

    // --- Pagination Logic ---
    const displayedSearchResults = useMemo(() => {
         const startIndex = (currentPage - 1) * pageSize;
         return (allSearchResults || []).slice(startIndex, startIndex + pageSize);
     }, [allSearchResults, currentPage, pageSize]);

     const totalPages = useMemo(() => {
        return Math.ceil((allSearchResults || []).length / pageSize);
     }, [allSearchResults, pageSize]);


    // --- Navigation Handler ---
    // Keep passing searchQuery if the detail screen might still use it for other purposes
    // or if you want highlighting there *as well*. If not needed there anymore, remove it.
    const handleResultPress = (item: SearchResult) => {
         router.push({
             pathname: `/hadith/[collectionId]/[chapterId]/[hadithId]`,
             params: {
                 collectionId: item.collectionId,
                 chapterId: item.chapterId, // Ensure chapterId is consistently available or handled if missing
                 hadithId: item.id,
                 searchQuery: searchQuery // Keep or remove based on detail screen needs
             }
         } as any);
     };

    // Handler for the search bar *on this screen*
    const handleRefineSearch = (newQuery: string) => {
        if (!newQuery?.trim() || newQuery.trim() === searchQuery) return; // Don't search if empty or unchanged

        console.log(`Refining search to: "${newQuery.trim()}"`);
        setSearchInput(newQuery.trim()); // Update local input state
        // Update the route parameter 'q' to trigger the main useEffect
        router.setParams({ q: newQuery.trim() }); 
        // Note: isAISearch, filterCollectionId, filterChapterId remain unchanged
    };

    // --- UI Rendering ---
    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <Stack.Screen options={{ title: `Search: "${searchQuery}"` }} />

            {/* Add SearchBar at the top */}
            <View className="px-4 pt-4 pb-2">
                <SearchBar
                    // Use the screen's searchQuery as the key to reset the component
                    // when the actual search term changes via navigation params.
                    key={searchQuery}
                    onSearch={handleRefineSearch} // Use the refine handler
                    placeholder={`Search... (current: "${searchQuery}")`}
                    isLoading={searchLoading} // Indicate loading state
                />
                {/* Note: AI toggle is NOT included here, search type is fixed */}            
            </View>
            {/* Ensure no stray text/whitespace between these Views */}
            <View className="flex-1 px-4"> 
                {/* Loading Indicator */}
                {searchLoading && ( <View style={StyleSheet.absoluteFill} className="bg-slate-900/80 justify-center items-center z-10"><ActivityIndicator size="large" color="#FFFFFF" /><Text className="text-white mt-2 font-poppins">Searching...</Text></View> )}

                {/* Error Display */}
                {!searchLoading && error && ( <View className="flex-1 justify-center items-center p-6"><Text className="text-red-500 font-poppins text-center">{error}</Text></View> )}

                {/* Results List */}
                {!error && (
                    <FlatList
                        ref={searchListRef}
                        data={displayedSearchResults}
                        keyExtractor={(item) => `${item.collectionId}-${item.id}`} // Use unique hadith ID
                        contentContainerStyle={{ paddingBottom: (totalPages > 1 ? 80 : 20) }} // Adjust padding based on pagination visibility
                        ItemSeparatorComponent={() => <View className="h-3" />} // Use Tailwind for separator height
                        ListEmptyComponent={() => ( !searchLoading && <View><Text className="text-center text-slate-400 py-20 font-poppins">No results found for "{searchQuery}".</Text></View> )}

                        // --- RENDER ITEM WITH HIGHLIGHTING ---
                        renderItem={({ item }) => {
                            const englishSnippet = prepareTextSnippet(item.text, 150);
                            const narratorSnippet = item.narrator || '';
                            const termForHighlight = isArabicText(searchQuery) ? normalizeArabicText(searchQuery) : searchQuery;

                            return (
                                <TouchableOpacity
                                    className="bg-gray-800 rounded-lg p-4 shadow-md mx-1 active:bg-gray-700" // Use Tailwind for styling
                                    onPress={() => handleResultPress(item)}
                                >
                                    {/* Header */}
                                    <View className="mb-2 pb-1 border-b border-gray-700 flex-row justify-between items-center flex-wrap gap-2">
                                        <Text className="text-base font-poppinsSemiBold text-teal-300 flex-shrink mr-2" numberOfLines={1}>
                                            {item.collectionName || 'Unknown Collection'} #{item.idInBook || 'N/A'}
                                        </Text>
                                        <Text className="text-xs font-poppins text-slate-400 text-right flex-1" numberOfLines={1}>
                                            {item.chapterName || 'Chapter N/A'}
                                        </Text>
                                    </View>

                                    {/* Narrator (HIGHLIGHTED) */}
                                    {narratorSnippet ? (
                                        <HighlightText
                                            text={narratorSnippet}
                                            highlightTerm={termForHighlight} 
                                            isArabic={isArabicText(searchQuery)} 
                                            style={styles.narratorText} 
                                            // highlightStyle={styles.highlight} // Use default
                                        />
                                     ) : null}

                                     {/* English Snippet (HIGHLIGHTED) */}
                                     <HighlightText
                                        text={englishSnippet}
                                        highlightTerm={termForHighlight} 
                                        isArabic={isArabicText(searchQuery)}
                                        style={styles.englishSnippetText} 
                                        // highlightStyle={styles.highlight} // Use default
                                     />

                                    {/* Optional: Add Arabic Snippet Highlighting if desired */}
                                    {/* ... uncomment and adapt if needed ... */}

                                </TouchableOpacity>
                            );
                        }}
                        // --- END RENDER ITEM ---

                        // --- FlatList Performance Props ---
                        initialNumToRender={10} // Render initial batch quickly
                        maxToRenderPerBatch={8} // Render subsequent batches smaller
                        windowSize={15} // Render items within viewport + buffer
                    />
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && !searchLoading && !error && (
                    <View style={styles.paginationContainer}>
                       {/* Pagination buttons using Pressable and StyleSheet */}
                       <Pressable
                          onPress={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); searchListRef.current?.scrollToOffset({ offset: 0, animated: true }); }}
                          disabled={currentPage === 1}
                          style={({ pressed }) => [ styles.paginationButton, currentPage === 1 ? styles.paginationButtonDisabled : {}, pressed && currentPage !== 1 ? styles.paginationButtonPressed : {} ]}
                        >
                            <Ionicons name="arrow-back" size={18} color={currentPage === 1 ? '#64748b' : '#f8fafc'} />
                            <Text style={[styles.paginationButtonText, currentPage === 1 ? styles.paginationTextDisabled : {}]}>Prev</Text>
                        </Pressable>

                        <Text style={styles.paginationText}>Page {currentPage} / {totalPages}</Text>

                        <Pressable
                           onPress={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); searchListRef.current?.scrollToOffset({ offset: 0, animated: true }); }}
                           disabled={currentPage === totalPages}
                           style={({ pressed }) => [ styles.paginationButton, currentPage === totalPages ? styles.paginationButtonDisabled : {}, pressed && currentPage !== totalPages ? styles.paginationButtonPressed : {} ]}
                         >
                            <Text style={[styles.paginationButtonText, currentPage === totalPages ? styles.paginationTextDisabled : {}]}>Next</Text>
                            <Ionicons name="arrow-forward" size={18} color={currentPage === totalPages ? '#64748b' : '#f8fafc'} />
                        </Pressable>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

// --- StyleSheet ---
const styles = StyleSheet.create({
    // Add the highlight style back
    highlight: {
        backgroundColor: '#FACC15', // Tailwind yellow-400
        color: '#1F2937',          // Tailwind gray-800 - Good contrast
        // Add padding or other style adjustments if needed
        // Example: paddingHorizontal: 2, borderRadius: 2
    },
     narratorText: {
        color: '#cbd5e1', // slate-300
        fontFamily: 'Poppins-SemiBold', // Ensure this font is loaded
        fontSize: 14,
        marginBottom: 4,
    },
    englishSnippetText: {
        color: '#FFFFFF', // white
        fontFamily: 'Poppins-Regular', // Ensure this font is loaded
        fontSize: 14,
        lineHeight: 20,
    },
    // Add style for Arabic text if you uncomment that section
    // arabicText: {
    //    color: '#FFFFFF',
    //    textAlign: 'right',
    //    fontSize: 16,
    //    fontFamily: 'YourArabicFont-Regular', // Specify your Arabic font
    //    lineHeight: 24,
    // },
    paginationContainer: {
        position: 'absolute', // Position at the bottom
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10, // Reduced vertical padding
        paddingHorizontal: 16, // Increased horizontal padding
        // Use background color matching the SafeAreaView if needed, or slightly different
        backgroundColor: '#0f172a', // bg-slate-900 - Match screen background
        borderTopWidth: 1,
        borderColor: '#334155', // slate-700
    },
    paginationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#334155', // slate-700
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    paginationButtonPressed: {
         backgroundColor: '#1e293b' // slate-800
    },
    paginationButtonDisabled: {
         backgroundColor: '#1e293b', // slate-800
         opacity: 0.6
    },
    paginationButtonText: {
        color: '#f8fafc', // slate-50
        fontFamily: 'Poppins-SemiBold', // Ensure this font is loaded
        fontSize: 14,
        marginHorizontal: 4,
    },
    paginationText: {
        color: '#cbd5e1', // slate-300
        fontFamily: 'Poppins-Regular', // Ensure this font is loaded
        fontSize: 14
    },
    paginationTextDisabled: {
        color: '#64748b' // slate-500
    },
});