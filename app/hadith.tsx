import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Image, Pressable } from "react-native";
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
  
  // Available hadith collections
  const collections = [
    { id: 'bukhari', name: 'Sahih al-Bukhari', author: 'Imam Bukhari' },
    { id: 'muslim', name: 'Sahih Muslim', author: 'Imam Muslim' },
    { id: 'nasai', name: 'Sunan an-Nasai', author: 'Imam an-Nasai' },
    { id: 'abudawud', name: 'Sunan Abu Dawud', author: 'Imam Abu Dawud' },
    { id: 'tirmidhi', name: 'Jami at-Tirmidhi', author: 'Imam at-Tirmidhi' },
    { id: 'ibnmajah', name: 'Sunan Ibn Majah', author: 'Imam Ibn Majah' },
    { id: 'malik', name: 'Muwatta Malik', author: 'Imam Malik' },
    { id: 'ahmed', name: 'Musnad Ahmad', author: 'Imam Ahmad ibn Hanbal' },
    { id: 'darimi', name: 'Sunan ad-Darimi', author: 'Imam ad-Darimi' }
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
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-700 font-poppinsSemiBold">Loading hadith data...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4 bg-gray-50">
        <Text className="text-red-500 mb-4 text-center font-poppins">{error}</Text>
        <Pressable 
          className="bg-blue-500 px-6 py-3 rounded-lg mb-3 w-full"
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
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView className="flex-1 px-5 py-6">
          <Pressable 
            className="mb-5 bg-blue-600 py-2 px-5 rounded-full self-start flex-row items-center shadow-sm"
            style={{ shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 }}
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </Pressable>
          
          <View className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-100">
            <Text className="text-blue-700 text-lg font-poppinsSemiBold mb-1">
              Hadith #{selectedHadith.idInBook}
            </Text>
            
            <Text className="text-lg font-poppinsBold text-gray-800 mb-1">
              {hadithData?.metadata.english.title || ''}
            </Text>
            
            <Text className="text-gray-600 font-poppins mb-2">
              Chapter: {chapterName}
            </Text>
          </View>
          
          {/* Arabic text first */}
          {selectedHadith.arabic && (
            <View className="bg-blue-50 rounded-xl p-6 mb-5 shadow-md" style={{ shadowOpacity: 0.05, shadowRadius: 5 }}>
              <Text className="text-right text-xl leading-10 font-poppins text-gray-800" style={{ writingDirection: 'rtl' }}>
                {selectedHadith.arabic}
              </Text>
            </View>
          )}
          
          {/* English text below */}
          <View className="bg-white rounded-xl p-6 mb-8 shadow-md border border-gray-100">
            <Text className="text-gray-600 italic font-poppins mb-4">
              {selectedHadith.english.narrator}
            </Text>
            
            <Text className="text-gray-800 font-poppins text-base leading-7">
              {selectedHadith.english.text}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render hadiths list view
  if (view === 'hadiths' && selectedChapter) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="px-5 pt-6 pb-4 bg-white shadow-md">
          <Pressable 
            className="mb-4 bg-blue-600 py-2 px-5 rounded-full self-start shadow-sm"
            style={{ shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 }}
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </Pressable>
          
          <Text className="text-xl font-poppinsBold text-gray-800 text-center mb-1">
            {hadithData?.metadata.english.title || collections.find(c => c.id === selectedCollection)?.name || ''}
          </Text>
          
          <Text className="text-base font-poppins text-gray-600 text-center mb-3">
            {selectedChapter.english}
          </Text>
        </View>
        
        <FlatList
          data={chapterHadiths}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            // Limit preview text to avoid excessive length
            const previewText = item.english.text.length > 120
              ? item.english.text.substring(0, 120) + '...'
              : item.english.text;
            
            return (
              <TouchableOpacity 
                className="p-6 mb-4 bg-white rounded-xl shadow-md border border-gray-100"
                style={{ shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
                onPress={() => handleHadithSelect(item)}
              >
                <View className="flex-row items-center mb-2">
                  <View className="bg-blue-100 w-8 h-8 rounded-full mr-3 items-center justify-center">
                    <Text className="text-blue-700 font-poppinsBold text-sm">
                      {item.idInBook}
                    </Text>
                  </View>
                  <Text className="text-blue-700 font-poppinsSemiBold">
                    Hadith #{item.idInBook}
                  </Text>
                </View>
                
                <Text className="italic text-sm text-gray-600 font-poppins mb-3">
                  {item.english.narrator}
                </Text>
                
                <Text className="text-gray-700 font-poppins leading-6">
                  {previewText}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // Render chapters list view
  if (view === 'chapters' && hadithData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="items-center pt-6 pb-4 px-5 bg-white shadow-md">
          <Pressable 
            className="mb-4 bg-blue-600 py-2 px-5 rounded-full self-start shadow-sm"
            style={{ shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 }}
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </Pressable>
        
          <Text className="text-2xl font-poppinsBold text-gray-800 text-center mb-1">
            {hadithData?.metadata.english.title || collections.find(c => c.id === selectedCollection)?.name || ''}
          </Text>
          
          <Text className="text-base font-poppins text-gray-600 mb-4 text-center">
            by {hadithData?.metadata.english.author || collections.find(c => c.id === selectedCollection)?.author || ''}
          </Text>
          
          <Image 
            source={require('../assets/images/hadith_caligraphy.png')} 
            className="w-36 h-24 mb-3"
            resizeMode="contain"
          />
        </View>
        
        <FlatList
          data={hadithData?.chapters || []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="p-6 mb-4 bg-white rounded-xl shadow-md border border-gray-100"
              style={{ shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
              onPress={() => handleChapterSelect(item)}
            >
              <View className="flex-row items-center mb-2">
                <View className="bg-blue-100 w-8 h-8 rounded-full mr-3 items-center justify-center">
                  <Text className="text-blue-700 font-poppinsBold text-sm">
                    {item.id}
                  </Text>
                </View>
                <Text className="text-blue-700 font-poppinsSemiBold">
                  Chapter {item.id}
                </Text>
              </View>
              
              <Text className="text-lg font-poppins text-gray-800 mb-3">
                {item.english}
              </Text>
              
              <Text className="text-right text-base text-gray-600 leading-7" style={{ writingDirection: 'rtl' }}>
                {item.arabic}
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // Render collections list view (default view)
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="items-center pt-8 pb-6 px-5 bg-white shadow-md">
        <Text className="text-2xl font-poppinsBold text-gray-800 text-center mb-2">
          Hadith Collections
        </Text>
        
        <Image 
          source={require('../assets/images/hadith_caligraphy.png')} 
          className="w-40 h-32 mb-3"
          resizeMode="contain"
        />
      </View>
      
      <ScrollView className="flex-1">
        <View className="p-6">
          {collections.map((collection) => (
            <TouchableOpacity 
              key={collection.id}
              className="p-6 mb-5 bg-white rounded-xl shadow-md flex-row items-center border border-gray-100"
              style={{ shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
              onPress={() => handleCollectionSelect(collection.id)}
            >
              <View 
                className="bg-blue-100 w-14 h-14 rounded-full mr-4 items-center justify-center"
                style={{ shadowColor: '#3B82F6', shadowOpacity: 0.1, shadowRadius: 5, elevation: 1 }}
              >
                <Text className="text-blue-700 font-poppinsBold text-lg">
                  {collection.name.charAt(0)}
                </Text>
              </View>
              
              <View className="flex-1">
                <Text className="text-lg font-poppinsSemiBold text-gray-800 mb-1">
                  {collection.name}
                </Text>
                
                <Text className="text-sm font-poppins text-gray-600">
                  by {collection.author}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}