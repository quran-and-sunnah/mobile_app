import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Image, Pressable, I18nManager, Share } from "react-native";
import { useRouter } from "expo-router";
import "../global.css";
import SearchBar from "../components/SearchBar";
import SearchResults from "../components/SearchResults";

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
  
  // New search states
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
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

  // Search functionality
  const handleSearch = async (query: string) => {
    if (query.trim().length === 0) return;
    
    setSearchLoading(true);
    setSearchQuery(query);
    setSearchResults([]);
    
    try {
      // Determine which collections to search
      let searchCollections: string[] = [];
      
      if (selectedCollection && view !== 'collections') {
        // Search only in the current collection if specific collection view
        searchCollections = [selectedCollection];
      } else {
        // When on collections page, search across all collections
        searchCollections = collections.map(c => c.id);
        
        // For searching in specific collections only, uncomment this:
        // searchCollections = ['bukhari', 'muslim'];
      }
      
      const results: SearchResult[] = [];
      
      // Modified version to ensure data is fully loaded
      const loadCollectionForSearch = async (collectionId: string): Promise<BukhariCollection | null> => {
        try {
          // Check if already loaded
          if (loadedCollections[collectionId]) {
            return loadedCollections[collectionId];
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
            console.error(`Collection ${collectionId} not available for search:`, e);
            return null;
          }
          
          if (!data) {
            return null;
          }
          
          // Make sure the loaded collection is properly stored in state
          // Use a promise to ensure the state update completes
          await new Promise<void>((resolve) => {
            setLoadedCollections(prev => {
              const updated = {...prev, [collectionId]: data};
              resolve();
              return updated;
            });
          });
          
          return data;
        } catch (err) {
          console.error(`Error loading ${collectionId} for search:`, err);
          return null;
        }
      };
      
      // Load and search through each collection
      for (const collectionId of searchCollections) {
        const collectionData = await loadCollectionForSearch(collectionId);
        
        if (!collectionData) continue;
        
        // Search in hadiths
        const collectionName = collections.find(c => c.id === collectionId)?.name || collectionId;
        
        collectionData.hadiths.forEach(hadith => {
          const matchText = hadith.english.text.toLowerCase().includes(query.toLowerCase());
          const matchNarrator = hadith.english.narrator.toLowerCase().includes(query.toLowerCase());
          // Normalize Arabic text to remove diacritics (vowel marks) for better matching
          const normalizedHadithText = normalizeArabicText(hadith.arabic);
          const normalizedQuery = normalizeArabicText(query);
          const matchArabic = normalizedHadithText.includes(normalizedQuery);
          
          if (matchText || matchNarrator || matchArabic) {
            const chapter = collectionData.chapters.find(c => c.id === hadith.chapterId);
            results.push({
              id: hadith.id,
              bookId: hadith.bookId,
              collectionId: collectionId,
              collectionName: collectionName,
              chapterId: hadith.chapterId,
              chapterName: chapter?.english || '',
              idInBook: hadith.idInBook,
              text: hadith.english.text,
              narrator: hadith.english.narrator,
              arabicText: hadith.arabic
            });
          }
        });
      }
      
      setSearchResults(results);
      setView('search_results');
    } catch (err) {
      console.error('Search error:', err);
      setError('Error during search. Please try again.');
    } finally {
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
      const cameFromSearch = searchResults.length > 0;
      
      // If we came directly from search results, go back to search
      if (cameFromSearch) {
        setSelectedHadith(null);
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
      setSearchResults([]);
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
    setSearchResults([]);
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
        <View className="bg-gray-900 pt-4 px-4">
          <TouchableOpacity 
            className="flex-row items-center mb-4"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </TouchableOpacity>
          
          <Text className="text-xl font-poppinsSemiBold text-white text-center mb-4">
            Search Results
          </Text>
          
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search hadiths in English or Arabic..."
            onCancel={handleCancelSearch}
            showCancel={true}
            isLoading={searchLoading}
          />
          
          <Text className="text-gray-400 font-poppins mb-2">
            {searchResults.length} results for "{searchQuery}"
          </Text>
        </View>
        
        <SearchResults 
          results={searchResults}
          onResultPress={handleSearchResultSelect}
          loading={searchLoading}
        />
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
          
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search hadiths in English or Arabic..."
            isLoading={searchLoading}
          />
        </View>
        
        <FlatList
          data={chapterHadiths}
          keyExtractor={(item) => item.id.toString()}
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
          
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search hadiths in English or Arabic..."
            isLoading={searchLoading}
          />
        </View>
        
        <FlatList
          data={hadithData?.chapters || []}
          keyExtractor={(item) => item.id.toString()}
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
        
        <SearchBar
          onSearch={handleSearch}
          placeholder="Search all hadiths in English or Arabic..."
          isLoading={searchLoading}
        />
      </View>
      
      <ScrollView className="flex-1">
        <View className="p-4">
          {collections.map((collection) => (
            <TouchableOpacity 
              key={collection.id}
              className="p-4 mb-3 bg-gray-800 rounded flex-row items-center"
              onPress={() => handleCollectionSelect(collection.id)}
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