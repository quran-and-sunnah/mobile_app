import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, Pressable, StyleSheet, Share, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { dbPromise } from '@/utils/dbSetup';
import type { SQLiteDatabase } from 'expo-sqlite';
import SearchBar from "@/components/SearchBar";
import BottomNavBar from "@/components/BottomNavBar";
import { normalizeArabicText, isArabicText, escapeRegExp } from "@/utils/textUtils";
import "@/global.css";

// --- Interface ---
// Adjusted to reflect full Hadith data potentially returned by API + retrieval score
interface SearchResult {
    id: number; // Unique Hadith ID from DB/API
    bookId?: number; // Optional now, depends if backend sends it
    collectionId?: string; // Backend SearchResult returns 'collection' - map this
    collectionName?: string; // Backend SearchResult returns 'title' - map this
    chapterId?: number; // Optional now
    chapterName?: string; // Need to ensure this comes from API or local lookup if needed
    idInBook?: number; // Optional now
    text?: string; // English text
    narrator?: string; // English narrator
    arabicText?: string; // Original Arabic text
    // Add score directly, will map from backend's retrieval_score
    score?: number;
    // Include raw english object if API returns it nested
    english?: { narrator?: string; text?: string; chapter_title?: string };
}

// --- HighlightText Component (No Changes Needed) ---
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
    let regex: RegExp;
    try {
        regex = new RegExp(`(${escapedTerm})`, flags);
    } catch (e) {
        console.error("Highlight regex error:", e, "Term:", highlightTerm);
        return <Text style={style}>{text}</Text>;
    }
    const parts = text.split(regex);
    const filteredParts = parts.filter(part => part);

    return (
        <Text style={style}>
            {filteredParts.map((part, index) =>
                regex.test(part) && part.toLowerCase() === highlightTerm.toLowerCase() ? (
                    <Text key={`${index}-${part}`} style={highlightStyle}>{part}</Text>
                ) : (
                    part
                )
            )}
        </Text>
    );
};
// --- End HighlightText Component ---

// --- Helper Function for Snippets (No Changes Needed) ---
const prepareTextSnippet = (text: string | null | undefined, maxLength: number): string => {
    if (!text) return "";
    // First replace any newlines with a space, then trim and clean up multiple spaces
    const cleanedText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
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

    const [searchInput, setSearchInput] = useState(searchQuery);
    const [db, setDb] = useState<SQLiteDatabase | null>(null);
    const [searchLoading, setSearchLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([]); // Holds results from AI or DB
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 20;
    const searchListRef = useRef<FlatList>(null);

    // --- Database Initialization Effect (No Changes Needed) ---
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

    // --- Search Data Fetching Effect (MODIFIED) ---
    useEffect(() => {
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
                    // --- AI Search (MODIFIED LOGIC) ---
                    const host = Constants.expoConfig?.hostUri?.split(":")[0];
                    const API_URL = host ? `http://${host}:8000` : "http://localhost:8000"; // Or your deployed backend URL
                    const desired_top_k = 100; // How many unique results you want ultimately

                    console.log(`Performing AI search to ${API_URL}/search for query: "${searchQuery}"`);

                    const response = await fetch(`${API_URL}/search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ query: searchQuery, top_k: desired_top_k }) // Send query and top_k
                    });

                    if (!response.ok) {
                        let errorBody = `AI Search Failed: HTTP error ${response.status}`;
                        try { errorBody = await response.text(); } catch (_e) {}
                        throw new Error(errorBody);
                    }

                    const data = await response.json();
                    // console.log("DEBUG: AI Search - Raw API Response:", JSON.stringify(data, null, 2));

                    // Directly use the results array from the backend API
                    if (data && Array.isArray(data.results)) {
                         // Map backend fields to frontend interface fields
                         results = data.results.map((item: any) => ({
                            id: item.id,
                            bookId: item.bookId,
                            // Backend 'title' field holds the collection name string
                            collectionId: item.collectionId || standardize_collection_frontend(item.title || ''), // Derive ID if needed or ensure backend sends it
                            collectionName: item.title || 'Unknown Collection',
                            chapterId: item.chapterId,
                            // Attempt to get chapter name from nested english object if backend sends it
                            chapterName: item.chapterName || item.english?.chapter_title || 'Chapter N/A',
                            idInBook: item.idInBook,
                            narrator: item.english?.narrator || '',
                            text: item.english?.text || '',
                            arabicText: item.arabic || '',
                            score: item.retrieval_score // Map backend score field
                         }));
                         console.log(`AI Search successful, received ${results.length} results.`);
                    } else {
                        console.log("AI Search - Received invalid data format from API.");
                        results = []; // Set empty results on invalid format
                    }

                } else if (db) {
                    // --- Local DB Search (Unchanged) ---
                    console.log(`Performing Local DB search for query: "${searchQuery}"`);
                    const isQueryArabic = isArabicText(searchQuery);
                    const normalizedQueryForSQL = isQueryArabic ? normalizeArabicText(searchQuery) : searchQuery;
                    const searchTermSQL = `%${normalizedQueryForSQL}%`;
                    const termForRegex = isQueryArabic ? normalizeArabicText(searchQuery) : searchQuery;
                    const escapedTermForRegex = escapeRegExp(termForRegex);
                    let filterRegex: RegExp | null = null;
                    try { filterRegex = new RegExp(`\\b${escapedTermForRegex}\\b`, isQueryArabic ? '' : 'i'); }
                    catch (e) { throw new Error("Invalid search pattern."); }

                    let transactionResults: SearchResult[] = [];
                    await db.withTransactionAsync(async () => {
                        let baseWhereClause = `(h.english_narrator LIKE ? OR h.english_text LIKE ? OR h.arabic_text_normalized LIKE ?)`;
                        const baseArgs: (string | number)[] = [searchTermSQL, searchTermSQL, searchTermSQL]; // Explicit typing
                        let filterClauses = [];
                        let filterArgs: (string | number)[] = []; // Explicit typing

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
                                        LIMIT 500;`; // Keep initial limit high for filtering

                        // console.log(`Executing SQL: WHERE ${whereClause} with args:`, args);
                        const initialResults = await db.getAllAsync<SearchResult>(sql, args);
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
                        console.log("DEBUG: Local Search - Filtered results count:", filteredResults.length);
                        transactionResults = filteredResults;
                    });
                    results = transactionResults;

                } else if (!isAISearch && !db) {
                    if(isActive) setError("Database is initializing...");
                    return;
                }

                if (isActive) {
                     console.log("Search Effect - Updating state with results:", results.length);
                    setAllSearchResults(results);
                    setError(null);
                }

            } catch (err: any) {
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

        return () => {
            isActive = false;
            console.log("Search Effect Cleanup");
        };

    }, [db, searchQuery, isAISearch, filterCollectionId, filterChapterId]); // Dependencies

    // --- Pagination Logic (No Changes Needed) ---
    const displayedSearchResults = useMemo(() => {
         const startIndex = (currentPage - 1) * pageSize;
         return (allSearchResults || []).slice(startIndex, startIndex + pageSize);
       }, [allSearchResults, currentPage, pageSize]);

     const totalPages = useMemo(() => {
         return Math.ceil((allSearchResults || []).length / pageSize);
       }, [allSearchResults, pageSize]);


    // --- Navigation Handler (Ensure ChapterID is passed correctly) ---
    const handleResultPress = (item: SearchResult) => {
         // Use collectionId derived during result formatting if needed
         const targetCollectionId = item.collectionId || params.collectionId || 'unknown';
         // Use chapterId from item if available, otherwise from params or default
         const targetChapterId = item.chapterId !== undefined ? item.chapterId : (params.chapterId ? parseInt(params.chapterId, 10) : 0);
         console.log("Navigating to Hadith Detail:");
         console.log("  Collection ID:", targetCollectionId); // Should be 'nasai'
         console.log("  Chapter ID:", targetChapterId);    // Should be a valid number, NOT undefined or NaN
         console.log("  Hadith ID:", item.id);
         if (isNaN(targetChapterId)) {
             console.error("Invalid Chapter ID for navigation:", item.chapterId, params.chapterId);
             return; // Prevent navigation with NaN chapterId
         }

         router.push({
             pathname: `/hadith/[collectionId]/[chapterId]/[hadithId]`,
             params: {
                 collectionId: targetCollectionId,
                 chapterId: targetChapterId, // Ensure it's a number
                 hadithId: item.id,
                 searchQuery: searchQuery // Pass search query if needed by detail screen
             }
         } as any);
       };

    // Handler for the search bar on this screen (No Changes Needed)
    const handleRefineSearch = (newQuery: string) => {
        if (!newQuery?.trim() || newQuery.trim() === searchQuery) return;
        console.log(`Refining search to: "${newQuery.trim()}"`);
        setSearchInput(newQuery.trim());
        router.setParams({ q: newQuery.trim() });
    };

    // --- UI Rendering (No Changes Needed in Structure) ---
    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <Stack.Screen options={{ title: `Search: "${searchQuery}"` }} />

            {/* SearchBar */}
            <View className="px-4 pt-4 pb-2">
                <SearchBar
                    key={searchQuery}
                    onSearch={handleRefineSearch}
                    placeholder={`Search... (current: "${searchQuery}")`}
                    isLoading={searchLoading}
                />
            </View>

            {/* Results Area */}
            <View className="flex-1 px-4">
                {/* Loading Indicator */}
                {searchLoading && ( <View style={StyleSheet.absoluteFill} className="bg-slate-900/80 justify-center items-center z-10"><ActivityIndicator size="large" color="#FFFFFF" /><Text className="text-white mt-2 font-poppins">Searching...</Text></View> )}

                {/* Error Display */}
                {!searchLoading && error && ( <View className="flex-1 justify-center items-center p-6"><Text className="text-red-500 font-poppins text-center">{error}</Text></View> )}

                {/* Results List */}
                {!error && (
                    <FlatList
                        className="flex-1" // Add flex-1 to make list take available space
                        ref={searchListRef}
                        data={displayedSearchResults}
                        keyExtractor={(item) => `${item.collectionId}-${item.id}`}
                        // Removed explicit bottom padding
                        contentContainerStyle={{ paddingBottom: 16 }}
                        ItemSeparatorComponent={() => <View className="h-3" />}
                        ListEmptyComponent={() => ( !searchLoading && <View><Text className="text-center text-slate-400 py-20 font-poppins">No results found for "{searchQuery}".</Text></View> )}
                        renderItem={({ item }) => {
                            const englishSnippet = prepareTextSnippet(item.text, 150);
                            const narratorSnippet = item.narrator || '';
                            // Use derived/mapped collectionName
                            const collectionDisplayName = item.collectionName || item.collectionId || 'Unknown Collection';
                            const chapterDisplayName = item.chapterName || `Chapter ${item.chapterId ?? 'N/A'}`;
                            const termForHighlight = isArabicText(searchQuery) ? normalizeArabicText(searchQuery) : searchQuery;

                            return (
                                <TouchableOpacity
                                    className="bg-gray-800 rounded-lg p-4 shadow-md mx-1 active:bg-gray-700"
                                    onPress={() => handleResultPress(item)}
                                >
                                    {/* Header */}
                                    <View className="mb-2 pb-1 border-b border-gray-700 flex-row justify-between items-center flex-wrap gap-2">
                                        <Text className="text-base font-poppinsSemiBold text-teal-300 flex-shrink mr-2" numberOfLines={1}>
                                            {collectionDisplayName} #{item.idInBook || 'N/A'}
                                        </Text>
                                        <Text className="text-xs font-poppins text-slate-400 text-right flex-1" numberOfLines={1}>
                                            {chapterDisplayName}
                                        </Text>
                                    </View>

                                    {/* Narrator */}
                                    {narratorSnippet ? (
                                        <HighlightText
                                            text={prepareTextSnippet(narratorSnippet, 100)}
                                            highlightTerm={termForHighlight}
                                            isArabic={isArabicText(searchQuery)}
                                            style={styles.narratorText}
                                        />
                                    ) : null}

                                     {/* English Snippet */}
                                     <HighlightText
                                         text={englishSnippet}
                                         highlightTerm={termForHighlight}
                                         isArabic={isArabicText(searchQuery)}
                                         style={styles.englishSnippetText}
                                     />
                                </TouchableOpacity>
                            );
                        }}
                        initialNumToRender={10}
                        maxToRenderPerBatch={8}
                        windowSize={15}
                    />
                )}
            </View>
            {/* BottomNavBar is now the last element */}
            <BottomNavBar />
        </SafeAreaView>
    );
}

// --- Helper Function (Frontend Only) ---
// Simple helper to derive a collection ID if backend doesn't send it
function standardize_collection_frontend(title: string): string {
    const normalized_title = title.toLowerCase().replace(/[\s\-\'']/g, '');
    const mapping: { [key: string]: string } = {
        "sahihalbukhari": "bukhari", "bukhari": "bukhari",
        "sahihmuslim": "muslim", "muslim": "muslim",
        "sunanabudawud": "abudawud", "sunanabidawud": "abudawud", "abudawud": "abudawud",
        "jamialtirmidhi": "tirmidhi", "tirmidhi": "tirmidhi",
        "sunanibnmajah": "ibnmajah", "ibnmajah": "ibnmajah",
        "sunanannasai": "nasai", "annasai": "nasai",
        "muwattamalik": "malik", "malik": "malik",
        "musnadahmad": "ahmed", "ahmed": "ahmed",
        "sunanaddarimi": "darimi", "aldarimi": "darimi", "darimi": "darimi"
    };
    return mapping[normalized_title] || normalized_title || 'unknown';
}


// --- StyleSheet (No Changes Needed) ---
const styles = StyleSheet.create({
    highlight: {
        backgroundColor: '#FACC15',
        color: '#1F2937',
    },
    narratorText: {
        color: '#cbd5e1',
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        marginBottom: 4,
    },
    englishSnippetText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
    },
    paginationContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderColor: '#334155',
    },
    paginationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#334155',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    paginationButtonPressed: {
        backgroundColor: '#1e293b'
    },
    paginationButtonDisabled: {
        backgroundColor: '#1e293b',
        opacity: 0.6
    },
    paginationButtonText: {
        color: '#f8fafc',
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        marginHorizontal: 4,
    },
    paginationText: {
        color: '#cbd5e1',
        fontFamily: 'Poppins-Regular',
        fontSize: 14
    },
    paginationTextDisabled: {
        color: '#64748b'
    },
});