import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Image, Pressable, I18nManager, Share, TextInput, Switch } from "react-native";
import { useRouter } from "expo-router";
import "../global.css";
import SearchBar from "../components/SearchBar";
import SearchResults from "../components/SearchResults";
import Constants from "expo-constants";
const host = Constants.expoConfig?.hostUri?.split(":")[0];
const API_URL = `http://${host}:8000`;


// Function to normalize Arabic text by removing diacritics
const normalizeArabicText = (text: string): string => {
  // Remove Arabic diacritics (tashkeel/harakat)
  // This includes fatha, kasra, damma, sukun, shadda, etc.
  let normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');
  
  // Normalize various forms of alef
  normalized = normalized.replace(/[أإآا]/g, 'ا');
  
  // Normalize various forms of yaa
  normalized = normalized.replace(/[يى]/g, 'ي');
  
  // Normalize taa marbutah to haa
  normalized = normalized.replace(/ة/g, 'ه');
  
  return normalized;
};

// Function to normalize collection names consistently
const normalizeCollectionName = (name: string): string => {
  // Remove spaces, hyphens, and apostrophes (matching Python regex)
  return name.toLowerCase().replace(/[\s\-\']/g, '');
};

const isArabicText = (text: string): boolean => {
  // Arabic Unicode range (approximate)
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  // Check if the text contains Arabic characters
  return arabicPattern.test(text);
};

const escapeRegExp = (string: string): string => {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
};

// Canonical names for collections
const canonicalCollectionNames: { [key: string]: string } = {
  "bukhari": "Bukhari",
  "muslim": "Muslim",
  "ahmed": "Ahmed",
  "malik": "Malik",
  "abudawud": "Abu Dawud",
  "tirmidhi": "Tirmidhi",
  "ibnmajah": "Ibn Majah",
  "nasai": "An‑Nasai",
  "darimi": "Ad‑Darimi"
};

// Dictionary to convert variant keys from AI results to canonical keys
const collectionConversion: { [key: string]: string } = {
  "sunanabidawud": "abudawud", // variant from AI result
  "sunanabiidawud": "abudawud",
  "sunanannasai": "nasai",
  "sunanalnasa'i": "nasai",
  "sunanalnasai": "nasai",
  "jamialtirmidhi": "tirmidhi",
  "sahihalbukhari": "bukhari",
  "sahihmuslim": "muslim",
  "musnadahmadibnhanbal": "ahmed",
  "musnadahmad": "ahmed",          // Add other potential variations just in case
  "sunanaldarimi": "darimi",       // Map API result to internal key
  "aldarimi": "darimi",
};

// Define the types for our data structures
interface BookMetadata {
  id: number;
  length: number;
  arabic: {
    title: string;
    author: string;
    introduction: string;
  };
  english: {
    title: string;
    author: string;
    introduction: string;
  };
}

interface Chapter {
  id: number;
  bookId: number;
  arabic: string;
  english: string;
}

interface Hadith {
  id: number;
  idInBook: number;
  chapterId: number;
  bookId: number;
  arabic: string;
  english: {
    narrator: string;
    text: string;
  };
}

interface BukhariCollection {
  id: number;
  metadata: BookMetadata;
  chapters: Chapter[];
  hadiths: Hadith[];
}

interface HadithCollection {
  id: string;
  name: string;
  author: string;
  initial: string;
}

interface SearchResult {
  id: number;
  bookId: number;
  collectionId: string;
  collectionName: string;
  chapterId: number;
  chapterName: string;
  idInBook: number;
  text: string;
  narrator: string;
  arabicText: string;
}

export default function Hadith() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hadithData, setHadithData] = useState<BukhariCollection | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterHadiths, setChapterHadiths] = useState<Hadith[]>([]);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'collections' | 'chapters' | 'hadiths' | 'hadith' | 'search_results' | 'direct_hadith'>('collections');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // New search states
  const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25; // Results per page
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadedCollections, setLoadedCollections] = useState<{[key: string]: BukhariCollection}>({});
  const [skipCollectionLoad, setSkipCollectionLoad] = useState(false);
  // Add state for direct hadith view
  const [directHadith, setDirectHadith] = useState<{
    hadith: Hadith | null,
    collection: string | null,
    collectionData: BukhariCollection | null
  }>({
    hadith: null,
    collection: null,
    collectionData: null
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isAISearch, setIsAISearch] = useState(false);

  // Ref for the search results FlatList
  const searchListRef = useRef<FlatList>(null);

  // Available hadith collections with initials for icons
  const collections: HadithCollection[] = [
    { 
      id: 'bukhari', 
      name: 'Bukhari', 
      author: 'Imam Bukhari',
      initial: 'B'
    },
    { 
      id: 'muslim', 
      name: 'Muslim', 
      author: 'Imam Muslim',
      initial: 'M'
    },
    { 
      id: 'ahmed', 
      name: 'Ahmed', 
      author: 'Imam Ahmad ibn Hanbal',
      initial: 'A'
    },
    { 
      id: 'malik', 
      name: 'Malik', 
      author: 'Imam Malik',
      initial: 'M'
    },
    { 
      id: 'abudawud', 
      name: 'Abu Dawud', 
      author: 'Imam Abu Dawud',
      initial: 'AD'
    },
    { 
      id: 'tirmidhi', 
      name: 'Tirmidhi', 
      author: 'Imam at-Tirmidhi',
      initial: 'T'
    },
    { 
      id: 'ibnmajah', 
      name: 'Ibn Majah', 
      author: 'Imam Ibn Majah',
      initial: 'IM'
    },
    { 
      id: 'nasai', 
      name: 'An-Nasai', 
      author: 'Imam an-Nasai',
      initial: 'N'
    },
    { 
      id: 'darimi', 
      name: 'Ad-Darimi', 
      author: 'Imam ad-Darimi',
      initial: 'D'
    }
  ];

  // New function to preload all collections
  const preloadAllCollections = async () => {
    if (initialLoadComplete) return;
    
    setLoading(true);
    
    const collectionsToLoad = collections.map(c => c.id);
    const newLoadedCollections = {...loadedCollections};
    
    for (const collectionId of collectionsToLoad) {
      if (loadedCollections[collectionId]) continue;
      
      try {
        let data;
        switch (collectionId) {
          case 'bukhari':
            data = require('../assets/bukhari.json');
            break;
          case 'muslim':
            data = require('../assets/muslim.json');
            break;
          case 'nasai':
            data = require('../assets/nasai.json');
            break;
          case 'abudawud':
            data = require('../assets/abudawud.json');
            break;
          case 'tirmidhi':
            data = require('../assets/tirmidhi.json');
            break;
          case 'ibnmajah':
            data = require('../assets/ibnmajah.json');
            break;
          case 'malik':
            data = require('../assets/malik.json');
            break;
          case 'ahmed':
            data = require('../assets/ahmed.json');
            break;
          case 'darimi':
            data = require('../assets/darimi.json');
            break;
          default:
            continue;
        }
        newLoadedCollections[collectionId] = data;
      } catch (e) {
        console.error(`Failed to load collection ${collectionId}:`, e);
      }
    }
    
    setLoadedCollections(newLoadedCollections);
    setInitialLoadComplete(true);
    setLoading(false);
  };

  // Use useEffect to preload collections when the component mounts
  useEffect(() => {
    preloadAllCollections();
  }, []);

  // Load hadith collection when selected
  useEffect(() => {
    if (selectedCollection && !skipCollectionLoad) {
      loadHadithData(selectedCollection);
    }
  }, [selectedCollection, skipCollectionLoad]);

  // Load data from local JSON file
  const loadHadithData = async (collectionId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if we already loaded this collection (for search functionality)
      if (loadedCollections[collectionId]) {
        setHadithData(loadedCollections[collectionId]);
        setView('chapters');
        setLoading(false);
        return;
      }
      
      let data;
      try {
        switch (collectionId) {
          case 'bukhari':
            data = require('../assets/bukhari.json');
            break;
          case 'muslim':
            data = require('../assets/muslim.json');
            break;
          case 'nasai':
            data = require('../assets/nasai.json');
            break;
          case 'abudawud':
            data = require('../assets/abudawud.json');
            break;
          case 'tirmidhi':
            data = require('../assets/tirmidhi.json');
            break;
          case 'ibnmajah':
            data = require('../assets/ibnmajah.json');
            break;
          case 'malik':
            data = require('../assets/malik.json');
            break;
          case 'ahmed':
            data = require('../assets/ahmed.json');
            break;
          case 'darimi':
            data = require('../assets/darimi.json');
            break;
          default:
            throw new Error(`Unknown collection: ${collectionId}`);
        }
      } catch (e) {
        const collectionName = collections.find(c => c.id === collectionId)?.name || collectionId;
        throw new Error(`${collectionName} collection data not available yet`);
      }
      
      if (!data) {
        throw new Error(`Failed to load data for ${collectionId}`);
      }
      
      // Store in loadedCollections for search functionality
      setLoadedCollections(prev => ({...prev, [collectionId]: data}));
      setHadithData(data);
      setView('chapters');
    } catch (err) {
      console.error(`Error loading ${collectionId} data:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const collectionName = collections.find(c => c.id === collectionId)?.name || collectionId;
      setError(`Failed to load ${collectionName}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate displayed results based on pagination
  const displayedSearchResults = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allSearchResults.slice(startIndex, endIndex);
  }, [allSearchResults, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(allSearchResults.length / pageSize);
  }, [allSearchResults, pageSize]);

  // Modified search functionality
  // Modified search functionality
  const handleSearch = async (query: string) => {
    // Detect language for potential API use and normalization logic
    const detectedLanguage = isArabicText(query) ? 'arabic' : 'english';
    let queryToSend = query; // Use original query for potential API call if not Arabic

    // Normalize query if it's Arabic (for both API and local search)
    if (isArabicText(query)) {
      queryToSend = normalizeArabicText(query);
    }
    
    // --- AI Semantic Search Branch ---
    if (isAISearch) {
      setSearchLoading(true);
      setError(null);
      try {
        // Make a POST request to your semantic search API
        const response = await fetch(`${API_URL}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            query: queryToSend, // Send potentially normalized Arabic query
            top_k: 50, // Retrieve more results for potentially better enrichment
            language: detectedLanguage // Send detected language of the query
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.statusText} (${response.status})`);
        }
        
        const data = await response.json();
        
        // Map the AI API results into the SearchResult shape
        const mappedResults: SearchResult[] = data.results.map((item: any) => {
          const rawCollectionKey = normalizeCollectionName(item.collection || "unknown");
          const finalCollectionKey = collectionConversion[rawCollectionKey] || rawCollectionKey;
          const canonicalName = canonicalCollectionNames[finalCollectionKey] || item.collection || "Unknown";
          
          // Ensure ID is parsed correctly, handle potential errors
          let parsedId = parseInt(item.id);
          if (isNaN(parsedId)) {
              console.warn(`Invalid ID received from API: ${item.id}. Assigning temporary ID.`);
              // Assign a temporary unique key if ID is missing or invalid - adjust as needed
              parsedId = Math.random() * -1000000; // Example temporary ID
          }

          return {
            id: parsedId, 
            collectionId: finalCollectionKey,
            collectionName: canonicalName,
            // Enrich these fields later from loadedCollections
            bookId: 0,   
            chapterId: 0,  
            chapterName: "", 
            idInBook: item.idInBook || 0, 
            text: item.text || "", // Use text from API if available
            narrator: "", 
            arabicText: "" 
          };
        });
        
        // Now try to enrich each AI result with full hadith info from preloaded data
        let matchCount = 0;
        let mismatchCount = 0;
        
        const enrichedResults = mappedResults.map(result => {
            // Ensure collectionId is valid before trying to access loadedCollections
            if (!result.collectionId || !loadedCollections[result.collectionId]) {
                 console.warn(`Collection data not loaded or invalid collectionId for API result: ${result.collectionId}`);
                 return result; // Return basic result if collection data isn't available
            }

            const collectionData = loadedCollections[result.collectionId];
            
            // Try finding by ID returned from API
            let fullHadith = collectionData.hadiths.find(h => h.id === result.id);
            
            // Fallback strategy 1: Try matching by idInBook if primary ID failed and idInBook is valid
            if (!fullHadith && result.idInBook && result.idInBook > 0) {
               console.warn(`AI Result ID ${result.id} not found in ${result.collectionId}, trying idInBook ${result.idInBook}`);
               fullHadith = collectionData.hadiths.find(h => h.idInBook === result.idInBook);
            }

            // Fallback strategy 2: Text matching (optional, can be slow/inaccurate)
            // if (!fullHadith && result.text) { ... }

            if (fullHadith) {
                matchCount++;
                const chapter = collectionData.chapters.find(c => c.id === fullHadith.chapterId);
                // Return a new object with enriched data
                return {
                    ...result, // Keep score, potentially API text if enrichment fails below
                    id: fullHadith.id, // Correct local ID
                    idInBook: fullHadith.idInBook,
                    bookId: fullHadith.bookId,
                    chapterId: fullHadith.chapterId,
                    chapterName: chapter ? chapter.english : "Chapter not found",
                    narrator: fullHadith.english.narrator,
                    text: fullHadith.english.text, // Prioritize local text
                    arabicText: fullHadith.arabic, // Local Arabic text
                };
            } else {
                 mismatchCount++;
                 console.warn(`Could not find full hadith details for API result ID ${result.id} (or fallbacks) in ${result.collectionId}`);
                 // Return the result from the API mapping if enrichment failed
                 return result; 
            }
        });
        
        console.log(`AI Search results processed: ${matchCount} enriched, ${mismatchCount} could not be fully enriched.`);
        
        setAllSearchResults(enrichedResults);
        setCurrentPage(1); 
        setSearchQuery(query); // Show original user query in search bar
        setView("search_results");

      } catch (error) {
        console.error("AI Search error:", error);
        setError("Failed to perform AI search: " + (error instanceof Error ? error.message : "Unknown error"));
      } finally {
        setSearchLoading(false);
      }

    // --- Local Keyword Search Branch ---
    } else { 
      setSearchLoading(true);
      setError(null);
      
      // Normalize query for comparison (lowercase handled by regex 'i' flag for English)
      // Keep Arabic normalization consistent
      const normalizedQuery = isArabicText(query) ? normalizeArabicText(query) : query.toLowerCase();
      
      // Build the Regular Expression for whole-word matching
      const escapedQuery = escapeRegExp(normalizedQuery);
      let searchRegex: RegExp | null = null;
      try {
        // Use 'i' flag for case-insensitivity (mainly for English)
        searchRegex = new RegExp(`\\b${escapedQuery}\\b`, 'i'); 
        console.log("Using regex:", searchRegex); // For debugging
      } catch(e) {
        console.error("Failed to create search regex:", e);
        setError("Invalid search pattern.");
        setSearchLoading(false);
        return; // Exit search if regex is invalid
      }

      const localResults: SearchResult[] = [];
      
      // Search through all preloaded collections
      Object.entries(loadedCollections).forEach(([collectionId, collectionData]) => {
        const collectionInfo = collections.find(c => c.id === collectionId);
        if (!collectionInfo || !collectionData?.hadiths) return; // Basic check
        
        collectionData.hadiths.forEach(hadith => {
          // Prepare texts for checking
          const normalizedArabic = normalizeArabicText(hadith.arabic);
          const englishText = hadith.english?.text || ""; // Handle potential missing text
          const narrator = hadith.english?.narrator || ""; // Handle potential missing narrator
          
          // Use regex.test() for whole-word matching
          if (
            searchRegex && ( // Check regex exists
              searchRegex.test(normalizedArabic) ||
              searchRegex.test(englishText) ||
              searchRegex.test(narrator)
            )
          ) {
            const chapter = collectionData.chapters?.find(c => c.id === hadith.chapterId);
            localResults.push({
              id: hadith.id,
              bookId: hadith.bookId,
              collectionId: collectionId,
              collectionName: collectionInfo.name,
              chapterId: hadith.chapterId,
              chapterName: chapter?.english || '',
              idInBook: hadith.idInBook,
              text: hadith.english.text,
              narrator: hadith.english.narrator,
              arabicText: hadith.arabic,
            });
          }
        });
      });
      
      console.log(`Local keyword search found ${localResults.length} results.`);
      setAllSearchResults(localResults);
      setCurrentPage(1);
      setSearchQuery(query); // Show original user query in search bar
      setView("search_results");
      setSearchLoading(false);
    }
  };
  


  // Handle search result selection with direct navigation
  const handleSearchResultSelect = async (result: SearchResult) => {
    try {
      setLoading(true);
      
      // Make sure the collection is loaded and the data is cached
      let collectionData = loadedCollections[result.collectionId];
      
      if (!collectionData) {
        console.log("Loading collection data for:", result.collectionId);
        try {
          switch (result.collectionId) {
            case 'bukhari':
              collectionData = require('../assets/bukhari.json');
              break;
            case 'muslim':
              collectionData = require('../assets/muslim.json');
              break;
            case 'nasai':
              collectionData = require('../assets/nasai.json');
              break;
            case 'abudawud':
              collectionData = require('../assets/abudawud.json');
              break;
            case 'tirmidhi':
              collectionData = require('../assets/tirmidhi.json');
              break;
            case 'ibnmajah':
              collectionData = require('../assets/ibnmajah.json');
              break;
            case 'malik':
              collectionData = require('../assets/malik.json');
              break;
            case 'ahmed':
              collectionData = require('../assets/ahmed.json');
              break;
            case 'darimi':
              collectionData = require('../assets/darimi.json');
              break;
            default:
              throw new Error(`Unknown collection: ${result.collectionId}`);
          }
          
          // Immediately cache the data
          setLoadedCollections(prev => ({...prev, [result.collectionId]: collectionData}));
        } catch (error) {
          console.error("Error loading collection data:", error);
          setError(`Failed to load ${result.collectionName} data.`);
          setLoading(false);
          return;
        }
      }

      if (!collectionData) {
        setError(`Collection data for ${result.collectionName} is not available.`);
        setLoading(false);
        return;
      }

      // DIRECT NAVIGATION - Skip the normal navigation flow
      // Find the hadith directly by ID
      const hadith = collectionData.hadiths.find(h => h.id === result.id);
      if (!hadith) {
        setError(`Hadith #${result.idInBook} not found in ${result.collectionName}.`);
        setLoading(false);
        return;
      }

      // Use the new direct hadith navigation
      setDirectHadith({
        hadith: hadith,
        collection: result.collectionId,
        collectionData: collectionData
      });
      
      // Special view type that bypasses all normal navigation
      setView('direct_hadith');
      
      console.log("Direct navigation to hadith view using direct_hadith view type");
    } catch (error) {
      console.error("Error handling search result selection:", error);
      setError("An error occurred while opening the hadith. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle collection selection
  const handleCollectionSelect = (collectionId: string) => {
    setSelectedCollection(collectionId);
    // Loading state is managed in loadHadithData function
  };

  // Handle chapter selection
  const handleChapterSelect = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    
    if (hadithData) {
      // Filter hadiths for selected chapter
      const hadiths = hadithData.hadiths.filter(h => h.chapterId === chapter.id);
      setChapterHadiths(hadiths);
      setView('hadiths');
    }
  };

  // Handle hadith selection
  const handleHadithSelect = (hadith: Hadith) => {
    setSelectedHadith(hadith);
    setView('hadith');
  };

  // Handle back button
  const handleBack = () => {
    if (view === 'direct_hadith') {
      // Go back to search results from direct hadith view
      setDirectHadith({
        hadith: null,
        collection: null,
        collectionData: null
      });
      setView('search_results');
    } else if (view === 'hadith') {
      // Track where we came from for better navigation
      const cameFromSearch = allSearchResults.length > 0;
      
      // If we came directly from search results, go back to search
      if (cameFromSearch) {
        setSelectedHadith(null);
        // Don't clear results when going back from a single hadith
        setView('search_results'); 
      } else {
        // Normal flow - go back to hadiths list
        setSelectedHadith(null);
        setView('hadiths');
      }
    } else if (view === 'hadiths') {
      setSelectedChapter(null);
      setView('chapters');
    } else if (view === 'chapters') {
      setHadithData(null);
      setSelectedCollection(null);
      setView('collections');
    } else if (view === 'search_results') {
      // Don't clear results when pressing back, just go to collections or previous view
      setAllSearchResults([]); // Clear results when explicitly going back FROM search results
      setCurrentPage(1);

      if (selectedCollection && hadithData) {
        if (selectedChapter) {
          setView('hadiths');
        } else {
          setView('chapters');
        }
      } else {
        setView('collections');
      }
    }
  };

  // Handle cancel search
  const handleCancelSearch = () => {
    setAllSearchResults([]);
    setCurrentPage(1);

    if (selectedCollection && hadithData) {
      if (selectedChapter) {
        setView('hadiths');
      } else {
        setView('chapters');
      }
    } else {
      setView('collections');
    }
  };

  // Add AI search toggle to search bar component
  const renderSearchBar = (placeholder: string) => (
    <View>
      <SearchBar
        onSearch={handleSearch}
        placeholder={placeholder}
        onCancel={handleCancelSearch}
        showCancel={view === 'search_results'}
        isLoading={searchLoading}
      />
      <View className="flex-row items-center justify-end mt-2 mr-2">
        <Text className="text-white mr-2 font-poppins">AI Search</Text>
        <Switch
          value={isAISearch}
          onValueChange={setIsAISearch}
          trackColor={{ false: '#767577', true: '#32CD32' }}
          thumbColor={isAISearch ? '#f4f3f4' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  // Render loading state
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-900">
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text className="mt-4 text-white font-poppinsSemiBold">Loading hadith data...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4 bg-gray-900">
        <Text className="text-red-500 mb-4 text-center font-poppins">{error}</Text>
        <Pressable 
          className="bg-gray-700 px-6 py-3 rounded-lg mb-3 w-full"
          onPress={() => {
            setError(null);
            setSelectedCollection(null);
            setView('collections');
          }}
        >
          <Text className="text-white text-center font-poppinsSemiBold">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  // Render search results
  if (view === 'search_results') {
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        {/* // Use View with padding instead of applying directly to SafeAreaView for consistency */}
        <View className="bg-gray-900 pt-4 px-4 flex-1"> 
          <TouchableOpacity 
            className="flex-row items-center mb-4"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </TouchableOpacity>
          
          <Text className="text-xl font-poppinsSemiBold text-white text-center mb-4">
            Search Results {isAISearch ? '(AI)' : ''}
          </Text>
          
          {/* Search bar rendering */}
          {renderSearchBar("Search hadiths in English or Arabic...")} 
          
          {/* Display search query info */}
          {searchQuery && !searchLoading && ( // Only show if there's a query and not loading initial results
             <Text className="text-gray-400 font-poppins mb-2 text-center"> 
               {allSearchResults.length} results for "{searchQuery}"
             </Text>
          )}
          
          {/* Search Results Component */}
          <SearchResults 
            results={displayedSearchResults}
            onResultPress={handleSearchResultSelect}
            loading={searchLoading}
            ref={searchListRef}
            searchQuery={searchQuery} // <-- Prop added here
          />
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View className="flex-row justify-between items-center p-4 mt-2 border-t border-gray-700">
              <TouchableOpacity
                onPress={() => {
                  setCurrentPage(prev => Math.max(prev - 1, 1));
                  searchListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded ${currentPage === 1 ? 'bg-gray-600 opacity-50' : 'bg-gray-700'}`} // Added opacity for disabled
              >
                <Text className={`font-poppinsSemiBold ${currentPage === 1 ? 'text-gray-400' : 'text-white'}`}>
                  Previous
                </Text>
              </TouchableOpacity>
              <Text className="text-white font-poppins">
                Page {currentPage} of {totalPages}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCurrentPage(prev => Math.min(prev + 1, totalPages));
                  searchListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded ${currentPage === totalPages ? 'bg-gray-600 opacity-50' : 'bg-gray-700'}`} // Added opacity for disabled
              >
                <Text className={`font-poppinsSemiBold ${currentPage === totalPages ? 'text-gray-400' : 'text-white'}`}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Render direct hadith view from search results (completely separate path)
  if (view === 'direct_hadith' && directHadith.hadith && directHadith.collection && directHadith.collectionData) {
    const hadith = directHadith.hadith;
    const collectionId = directHadith.collection;
    const collectionName = collections.find(c => c.id === collectionId)?.name || '';
    const chapterId = hadith.chapterId;
    const chapterName = directHadith.collectionData.chapters.find(c => c.id === chapterId)?.english || '';
    
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="bg-gray-900 pt-4 px-4">
          <TouchableOpacity 
            className="flex-row items-center mb-4"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back to Search</Text>
          </TouchableOpacity>
          
          <Text className="text-xl font-poppinsSemiBold text-white text-center mb-1">
            {collectionName}
          </Text>
          <Text className="text-md font-poppins text-gray-400 text-center mb-2">
            {chapterName}
          </Text>
        </View>
        
        <ScrollView className="flex-1 px-4 py-2">
          <View className="bg-gray-800 rounded p-4 mb-6">
            <View className="flex w-full items-end">
              <Text className="text-white text-xl mb-4 text-right">
                {'\u200F' + hadith.arabic.split('\n').map(line => line.trim()).join(' ').replace(/ ، /g, '، ').replace(/ : /g, ': ') + '\u200F'}
              </Text>
            </View>
            
            <View className="border-t border-gray-700 my-3" />
            
            <View className="my-4">
              <Text className="text-md text-gray-400 font-poppins">
                {hadith.english.narrator}
              </Text>
              
              <Text className="text-white font-poppins leading-6 text-left">
                {hadith.english.text.split('\n').map(line => line.trim()).join(' ')}
              </Text>
            </View>
            
            <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-gray-700">
              <Text className="text-gray-400 font-poppins text-sm">
                {collectionName} #{hadith.idInBook}
              </Text>
              
              <TouchableOpacity 
                className="bg-gray-700 px-3 py-1 rounded"
                onPress={() => {
                  const hadithText = hadith.english.text;
                  const narrator = hadith.english.narrator;
                  
                  Share.share({
                    message: `${narrator}\n\n${hadithText}\n\n- ${collectionName} #${hadith.idInBook}`,
                    title: `Hadith from ${collectionName}`
                  });
                }}
              >
                <Text className="text-white font-poppins">Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render single hadith view
  if (view === 'hadith' && selectedHadith) {
    const chapterName = hadithData?.chapters.find(c => c.id === selectedHadith.chapterId)?.english || '';
    
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="bg-gray-900 pt-4 px-4">
          <TouchableOpacity 
            className="flex-row items-center mb-4"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView className="flex-1 px-4 py-2">
          <View className="bg-gray-800 rounded p-4 mb-6">
            <View className="flex w-full items-end">
              <Text className="text-white text-xl mb-4 text-right">
                {'\u200F' + selectedHadith.arabic.split('\n').map(line => line.trim()).join(' ').replace(/ ، /g, '، ').replace(/ : /g, ': ') + '\u200F'}
              </Text>
            </View>
            
            <View className="border-t border-gray-700 my-3" />
            
            <View className="my-4">
              <Text className="text-md text-gray-400 font-poppins">
                {selectedHadith.english.narrator}
              </Text>
              
              <Text className="text-white font-poppins leading-6 text-left">
                {selectedHadith.english.text.split('\n').map(line => line.trim()).join(' ')}
              </Text>
            </View>
            
            <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-gray-700">
              <Text className="text-gray-400 font-poppins text-sm">
                {collections.find(c => c.id === selectedCollection)?.name} #{selectedHadith.idInBook}
              </Text>
              
              <TouchableOpacity 
                className="bg-gray-700 px-3 py-1 rounded"
                onPress={() => {
                  const collectionName = collections.find(c => c.id === selectedCollection)?.name || '';
                  const hadithText = selectedHadith.english.text;
                  const narrator = selectedHadith.english.narrator;
                  
                  Share.share({
                    message: `${narrator}\n\n${hadithText}\n\n- ${collectionName} #${selectedHadith.idInBook}`,
                    title: `Hadith from ${collectionName}`
                  });
                }}
              >
                <Text className="text-white font-poppins">Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render hadiths list view
  if (view === 'hadiths' && selectedChapter) {
    const chapterName = selectedChapter.english;
    const collectionTitle = collections.find(c => c.id === selectedCollection)?.name || '';
    
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="bg-gray-900 pt-4 px-4">
          <TouchableOpacity 
            className="flex-row items-center mb-4"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </TouchableOpacity>
          
          <Text className="text-xl font-poppinsSemiBold text-white text-center mb-2">
            {collectionTitle}
          </Text>
          <Text className="text-md font-poppins text-gray-400 text-center mb-4">
            {chapterName}
          </Text>
          
          {renderSearchBar("Search hadiths in English or Arabic...")}
        </View>
        
        <FlatList
          data={chapterHadiths}
          keyExtractor={(item, index) => `${selectedCollection}-${item.id}-${index}`}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="p-4 mb-3 bg-gray-800 rounded"
              onPress={() => handleHadithSelect(item)}
            >
              <Text className="text-gray-400 font-poppinsSemiBold mb-1">
                {item.english.narrator}
              </Text>
              <Text className="text-white font-poppins">
                {item.english.text.length > 100 
                  ? item.english.text.substring(0, 100).split('\n').map(line => line.trim()).join(' ') + '...'
                  : item.english.text.split('\n').map(line => line.trim()).join(' ')
                }
              </Text>
              <Text className="text-gray-400 font-poppins text-sm mt-1">
                #{item.idInBook}
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // Render chapters list view
  if (view === 'chapters' && hadithData) {
    const collectionTitle = collections.find(c => c.id === selectedCollection)?.name || '';
    const formattedTitle = hadithData?.metadata.english.title || `Sahih ${collectionTitle}`;
    
    return (
      <SafeAreaView className="flex-1 bg-gray-900">
        <View className="px-4 pt-4 pb-2 bg-gray-900">
          <TouchableOpacity 
            className="flex-row items-center mb-2"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </TouchableOpacity>
          
          <Text className="text-xl font-poppinsSemiBold text-white text-center mb-4">
            {formattedTitle}
          </Text>
          
          {renderSearchBar("Search hadiths in English or Arabic...")}
        </View>
        
        <FlatList
          data={hadithData?.chapters || []}
          keyExtractor={(item, index) => `${selectedCollection || ''}-chapter-${item.id}-${index}`}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="p-4 mb-3 bg-gray-800 rounded"
              onPress={() => handleChapterSelect(item)}
            >
              <Text className="text-white font-poppins">
                {item.id}: {item.english}
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // Render collections list view (default view)
  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <View className="pt-6 pb-4 px-5">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity 
            onPress={() => router.push("/")}
            className="px-3 py-2"
          >
            <Text className="text-white font-poppinsSemiBold">← Home</Text>
          </TouchableOpacity>
          <Text className="text-xl font-poppinsBold text-white">
            HadithExplorer
          </Text>
          <View style={{ width: 50 }}>{/* Empty view for balance */}</View>
        </View>
        
        {renderSearchBar("Search all hadiths in English or Arabic...")}
      </View>
      
      <ScrollView className="flex-1">
        <View className="p-4">
          {collections.map((collection) => (
            <TouchableOpacity 
              key={collection.id}
              className="p-4 mb-3 bg-gray-800 rounded flex-row items-center"
              onPress={() => {
                preloadAllCollections();
                handleCollectionSelect(collection.id);
              }}
            >
              <View className="w-12 h-12 rounded-full mr-4 bg-gray-700 items-center justify-center">
                <Text className="text-white font-poppinsBold text-lg">
                  {collection.initial}
                </Text>
              </View>
              <Text className="text-lg font-poppins text-white">
                {collection.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}