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
  const [loading, setLoading] = useState(true);
  const [bukhariData, setBukhariData] = useState<BukhariCollection | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapterHadiths, setChapterHadiths] = useState<Hadith[]>([]);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'chapters' | 'hadiths' | 'hadith'>('chapters');

  // Load Bukhari collection on component mount
  useEffect(() => {
    loadBukhariData();
  }, []);

  // Load data from local JSON file
  const loadBukhariData = async () => {
    try {
      setLoading(true);
      const data = require('../assets/bukhari.json');
      setBukhariData(data);
    } catch (err) {
      console.error('Error loading Bukhari data:', err);
      setError(`Failed to load Bukhari collection: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle chapter selection
  const handleChapterSelect = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    
    if (bukhariData) {
      // Filter hadiths for selected chapter
      const hadiths = bukhariData.hadiths.filter(h => h.chapterId === chapter.id);
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
    }
  };

  // Render loading state
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-700 font-poppinsSemiBold">Loading hadith data...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4 bg-white">
        <Text className="text-red-500 mb-4 text-center">{error}</Text>
        <Pressable 
          className="bg-blue-500 px-6 py-3 rounded-lg mb-3 w-full"
          onPress={() => {
            setError(null);
            loadBukhariData();
          }}
        >
          <Text className="text-white text-center font-poppinsSemiBold">Try Again</Text>
        </Pressable>
        <Pressable 
          className="bg-gray-100 px-6 py-3 rounded-lg w-full"
          onPress={() => router.push("/")}
        >
          <Text className="text-gray-800 text-center font-poppinsSemiBold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Render single hadith view
  if (view === 'hadith' && selectedHadith) {
    const chapterName = bukhariData?.chapters.find(c => c.id === selectedHadith.chapterId)?.english || '';
    
    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4 py-6">
          <Pressable 
            className="mb-4 bg-blue-500 py-2 px-4 rounded-md self-start"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </Pressable>
          
          <View className="bg-blue-50 rounded-xl p-5 mb-6 shadow-sm">
            <Text className="text-blue-800 text-lg font-poppinsSemiBold mb-1">
              Hadith #{selectedHadith.idInBook}
            </Text>
            
            <Text className="text-lg font-poppinsBold text-gray-800 mb-1">
              {bukhariData?.metadata.english.title || 'Sahih al-Bukhari'}
            </Text>
            
            <Text className="text-gray-600 font-poppins mb-3">
              Chapter: {chapterName}
            </Text>
          </View>
          
          <View className="bg-white rounded-xl p-5 mb-6 shadow-sm border border-gray-100">
            <Text className="text-gray-600 italic font-poppins mb-4">
              {selectedHadith.english.narrator}
            </Text>
            
            <Text className="text-gray-800 font-poppins text-base leading-6">
              {selectedHadith.english.text}
            </Text>
          </View>
          
          {selectedHadith.arabic && (
            <View className="bg-gray-50 rounded-xl p-5 mb-4 shadow-sm">
              <Text className="text-right text-lg leading-8 font-poppins text-gray-800" style={{ writingDirection: 'rtl' }}>
                {selectedHadith.arabic}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render hadiths list view
  if (view === 'hadiths' && selectedChapter) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4 pt-6 pb-3 bg-white">
          <Pressable 
            className="mb-4 bg-blue-500 py-2 px-4 rounded-md self-start"
            onPress={handleBack}
          >
            <Text className="text-white font-poppinsSemiBold">← Back</Text>
          </Pressable>
          
          <Text className="text-xl font-poppinsBold text-gray-800 text-center">
            {bukhariData?.metadata.english.title || 'Sahih al-Bukhari'}
          </Text>
          
          <Text className="text-base font-poppins text-gray-600 text-center mb-3">
            {selectedChapter.english}
          </Text>
        </View>
        
        <FlatList
          data={chapterHadiths}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          renderItem={({ item }) => {
            // Limit preview text to avoid excessive length
            const previewText = item.english.text.length > 120
              ? item.english.text.substring(0, 120) + '...'
              : item.english.text;
            
            return (
              <TouchableOpacity 
                className="p-4 mb-3 bg-white rounded-xl shadow-sm border border-gray-100"
                onPress={() => handleHadithSelect(item)}
              >
                <Text className="text-blue-600 font-poppinsSemiBold mb-2">
                  Hadith #{item.idInBook}
                </Text>
                
                <Text className="italic text-sm text-gray-600 font-poppins mb-2">
                  {item.english.narrator}
                </Text>
                
                <Text className="text-gray-700 font-poppins">
                  {previewText}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // Render chapters list view (default view)
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="items-center pt-6 pb-3 px-4">
        <Text className="text-2xl font-poppinsBold text-gray-800 text-center">
          {bukhariData?.metadata.english.title || 'Sahih al-Bukhari'}
        </Text>
        
        <Text className="text-base font-poppins text-gray-600 mb-4 text-center">
          by {bukhariData?.metadata.english.author || 'Imam Bukhari'}
        </Text>
        
        <Image 
          source={require('../assets/images/hadith_caligraphy.png')} 
          className="w-40 h-28 mb-6"
          resizeMode="contain"
        />
        
        <View className="flex-row justify-between w-full mb-4">
          <Pressable 
            className="bg-blue-500 px-4 py-2 rounded-md"
            onPress={() => router.push("/")}
          >
            <Text className="text-white font-poppinsSemiBold">Go Home</Text>
          </Pressable>
          
          <Pressable 
            className="bg-blue-500 px-4 py-2 rounded-md"
            onPress={() => router.push("/quran")}
          >
            <Text className="text-white font-poppinsSemiBold">Go to Quran</Text>
          </Pressable>
        </View>
      </View>
      
      <FlatList
        data={bukhariData?.chapters || []}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            className="p-4 mb-3 bg-white rounded-xl shadow-sm border border-gray-100"
            onPress={() => handleChapterSelect(item)}
          >
            <Text className="text-blue-600 font-poppinsSemiBold mb-1">
              Chapter {item.id}
            </Text>
            
            <Text className="text-lg font-poppins text-gray-800 mb-1">
              {item.english}
            </Text>
            
            <Text className="text-right text-base text-gray-600" style={{ writingDirection: 'rtl' }}>
              {item.arabic}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}