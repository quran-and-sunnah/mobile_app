import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Image, Pressable, I18nManager } from "react-native";
import { useRouter } from "expo-router";
import "../global.css";

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

export default function Hadith() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hadithData, setHadithData] = useState<BukhariCollection | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterHadiths, setChapterHadiths] = useState<Hadith[]>([]);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'collections' | 'chapters' | 'hadiths' | 'hadith'>('collections');
  
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
    if (selectedCollection) {
      loadHadithData(selectedCollection);
    }
  }, [selectedCollection]);

  // Load data from local JSON file
  const loadHadithData = async (collectionId: string) => {
    try {
      setLoading(true);
      
      let data;
      switch (collectionId) {
        case 'bukhari':
          data = require('../assets/bukhari.json');
          break;
        case 'muslim':
          try {
            data = require('../assets/muslim.json');
          } catch (e) {
            throw new Error('Muslim collection data not available yet');
          }
          break;
        case 'nasai':
          try {
            data = require('../assets/nasai.json');
          } catch (e) {
            throw new Error('Nasai collection data not available yet');
          }
          break;
        case 'abudawud':
          try {
            data = require('../assets/abudawud.json');
          } catch (e) {
            throw new Error('Abu Dawud collection data not available yet');
          }
          break;
        case 'tirmidhi':
          try {
            data = require('../assets/tirmidhi.json');
          } catch (e) {
            throw new Error('Tirmidhi collection data not available yet');
          }
          break;
        case 'ibnmajah':
          try {
            data = require('../assets/ibnmajah.json');
          } catch (e) {
            throw new Error('Ibn Majah collection data not available yet');
          }
          break;
        case 'malik':
          try {
            data = require('../assets/malik.json');
          } catch (e) {
            throw new Error('Malik collection data not available yet');
          }
          break;
        case 'ahmed':
          try {
            data = require('../assets/ahmed.json');
          } catch (e) {
            throw new Error('Ahmad collection data not available yet');
          }
          break;
        case 'darimi':
          try {
            data = require('../assets/darimi.json');
          } catch (e) {
            throw new Error('Darimi collection data not available yet');
          }
          break;
        default:
          throw new Error(`Unknown collection: ${collectionId}`);
      }
      
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
    if (view === 'hadith') {
      setSelectedHadith(null);
      setView('hadiths');
    } else if (view === 'hadiths') {
      setSelectedChapter(null);
      setView('chapters');
    } else if (view === 'chapters') {
      setHadithData(null);
      setSelectedCollection(null);
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
              <Text className="text-white text-xl font-poppinsBold mb-4 text-right">
                {'\u200F' + selectedHadith.arabic + '\u200F'}
              </Text>
            </View>
            
            <View className="border-t border-gray-700 my-3" />
            
            <View className="my-4">
              <Text className="text-md text-gray-500 font-poppins">
                {selectedHadith.english.narrator}
              </Text>
              
              <Text className="text-gray-400 font-poppins leading-6 text-left">
                {(() => {
                  // Remove newlines and normalize spacing
                  const text = selectedHadith.english.text.split('\n').map(line => line.trim()).join(' ');
                  
                  // These patterns are good indicators of the Prophet's speech
                  const prophetIndicators = [
                    /The Prophet\s*(?:\(ﷺ\)|ﷺ|\(peace be upon him\))?\s*(?:replied|said|answered|asked)[:,"']/i,
                    /Allah's Messenger\s*(?:\(ﷺ\)|ﷺ|\(peace be upon him\))?\s*(?:replied|said|answered|asked)[:,"']/i,
                    /The Messenger of Allah\s*(?:\(ﷺ\)|ﷺ|\(peace be upon him\))?\s*(?:replied|said|answered|asked)[:,"']/i,
                    /Messenger of Allah\s*(?:\(ﷺ\)|ﷺ|\(peace be upon him\))?\s*(?:replied|said|answered|asked)[:,"']/i,
                    /He\s+(?:replied|said|answered|asked)[:,"']/i,
                    /I heard Allah's Messenger/i,
                    /I heard the Prophet/i
                  ];
                  
                  // Generic patterns that indicate end of speech
                  const endOfSpeechPatterns = [
                    // Quote ending followed by narrative
                    /["']\.?\s+[A-Z]/i,  
                    
                    // Named person speaking (any name)
                    /\b[A-Z][a-z]+\s+(?:replied|said|answered|added|narrated)/i,
                    
                    // New narrative section
                    /\.\s+Then\b/i,
                    
                    // References to verses or citations
                    /\([0-9\.]+[,\s]*[0-9\.]+\)/,
                    
                    // Clear narrative transitions
                    /\.\s+(?:After|When|Later|Subsequently)/i
                  ];
                  
                  // Function to check if a segment is the Prophet's speech
                  const containsProphetIndicator = (segment: string): boolean => {
                    return prophetIndicators.some(pattern => pattern.test(segment));
                  };
                  
                  // Function to check if a segment indicates end of speech
                  const isEndOfSpeech = (segment: string): boolean => {
                    return endOfSpeechPatterns.some(pattern => pattern.test(segment));
                  };
                  
                  // Define a pattern for sentences
                  const sentencePattern = /([^.!?]+[.!?]+\s*)/g;
                  let sentences: string[] = [];
                  let match;
                  
                  // Split text into sentences
                  while ((match = sentencePattern.exec(text)) !== null) {
                    sentences.push(match[0]);
                  }
                  
                  // If the pattern didn't match everything, add the remainder
                  if (sentences.join('').length < text.length) {
                    sentences.push(text.substring(sentences.join('').length));
                  }
                  
                  // If no sentences were found, just return the text
                  if (sentences.length === 0) {
                    return <Text>{text}</Text>;
                  }
                  
                  // Process each sentence
                  let inProphetSpeech = false;
                  let quoteDepth = 0; // Track nested quotes
                  
                  return sentences.map((sentence, index) => {
                    // Check for end of speech patterns
                    if (inProphetSpeech && isEndOfSpeech(sentence)) {
                      inProphetSpeech = false;
                      quoteDepth = 0;
                      return <Text key={index}>{sentence}</Text>;
                    }
                    
                    // Check for "heard" patterns which have the quotes at the end
                    if (/I heard.*saying,\s*["']/i.test(sentence)) {
                      const parts = sentence.split(/saying,\s*/i);
                      if (parts.length > 1) {
                        inProphetSpeech = true;
                        quoteDepth = 1; // We're now in a quote
                        
                        // Find the position of the first quote in the second part
                        const secondPart = parts[1];
                        
                        return (
                          <Text key={index}>
                            <Text>{parts[0] + "saying, "}</Text>
                            <Text style={{color: 'white', fontFamily: 'Poppins-Bold'}}>{secondPart}</Text>
                          </Text>
                        );
                      }
                    }
                    // Check if this sentence is or contains a Prophet indicator
                    else if (containsProphetIndicator(sentence)) {
                      // This sentence has an indicator, next sentences will be the Prophet's speech
                      inProphetSpeech = true;
                      
                      // Count quotes in this sentence to track quote depth
                      const openQuotes = (sentence.match(/["']/g) || []).length;
                      quoteDepth = openQuotes % 2; // 1 if we're in an open quote, 0 if closed
                      
                      // For sentences with indicators, find the part after the indicator
                      for (const pattern of prophetIndicators) {
                        const parts = sentence.split(pattern);
                        if (parts.length > 1) {
                          const beforeSpeech = parts[0];
                          const prophetSpeech = parts.slice(1).join('');
                          
                          return (
                            <Text key={index}>
                              <Text>{beforeSpeech}</Text>
                              <Text style={{color: 'white', fontFamily: 'Poppins-Bold'}}>{prophetSpeech}</Text>
                            </Text>
                          );
                        }
                      }
                      
                      // If we get here, just return the sentence normally
                      return <Text key={index}>{sentence}</Text>;
                    }
                    // Check for quote markers to track quote depth
                    else if (inProphetSpeech) {
                      // Count quotes in this sentence
                      const quotes = sentence.match(/["']/g) || [];
                      for (const quote of quotes) {
                        quoteDepth = 1 - quoteDepth; // Toggle between 0 and 1
                      }
                      
                      // End of a quote and no more quotes open
                      if (quoteDepth === 0 && 
                          (sentence.trim().endsWith('"') || sentence.trim().endsWith("'")) &&
                          (quotes.length % 2 === 0)) {
                        // This is the last sentence in the quote
                        const result = <Text key={index} style={{color: 'white', fontFamily: 'Poppins-Bold'}}>{sentence}</Text>;
                        inProphetSpeech = false;
                        return result;
                      }
                      
                      // Still in Prophet's speech
                      return <Text key={index} style={{color: 'white', fontFamily: 'Poppins-Bold'}}>{sentence}</Text>;
                    }
                    // Not the Prophet's speech
                    else {
                      return <Text key={index}>{sentence}</Text>;
                    }
                  });
                })()}
              </Text>
            </View>
            
            <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-gray-700">
              <Text className="text-gray-400 font-poppins text-sm">
                {collections.find(c => c.id === selectedCollection)?.name} #{selectedHadith.idInBook}
              </Text>
              
              <TouchableOpacity className="bg-gray-700 px-3 py-1 rounded">
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
          
          <Text className="text-xl font-poppinsSemiBold text-white text-center mb-1">
            {formattedTitle}
          </Text>
          <Text className="text-lg font-poppins text-white text-center mb-2">
            {selectedChapter.english}
          </Text>
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
              <View className="mb-2">
                <Text className="text-gray-400 font-poppinsSemiBold mb-1">
                  {item.english.narrator}
                </Text>
                <Text className="text-white font-poppins text-left">
                  {(item.english.text.length > 120 
                    ? item.english.text.substring(0, 120).split('\n').map(line => line.trim()).join(' ') + '...'
                    : item.english.text.split('\n').map(line => line.trim()).join(' ')
                  )}
                </Text>
              </View>
              <Text className="text-gray-400 font-poppins text-sm">
                {collections.find(c => c.id === selectedCollection)?.name} #{item.idInBook}
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