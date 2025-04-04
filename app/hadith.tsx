import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";

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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading hadith data...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Try Again" onPress={() => {
          setError(null);
          loadBukhariData();
        }} />
        <Button title="Go Back" onPress={() => router.push("/")} />
      </View>
    );
  }

  // Render single hadith view
  if (view === 'hadith' && selectedHadith) {
    const chapterName = bukhariData?.chapters.find(c => c.id === selectedHadith.chapterId)?.english || '';
    
    return (
      <SafeAreaView style={styles.container}>
        <Button title="Back to List" onPress={handleBack} />
        <ScrollView style={styles.hadithContainer}>
          <Text style={styles.hadithNumber}>Hadith #{selectedHadith.idInBook}</Text>
          
          <Text style={styles.bookName}>
            Book: {bukhariData?.metadata.english.title || 'Sahih al-Bukhari'}
          </Text>
          
          <Text style={styles.chapterName}>Chapter: {chapterName}</Text>
          
          <Text style={styles.narratorText}>{selectedHadith.english.narrator}</Text>
          
          <Text style={styles.hadithText}>{selectedHadith.english.text}</Text>
          
          {selectedHadith.arabic && (
            <View style={styles.arabicContainer}>
              <Text style={styles.arabicText}>{selectedHadith.arabic}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render hadiths list view
  if (view === 'hadiths' && selectedChapter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Button title="Back to Chapters" onPress={handleBack} />
          <Text style={styles.title}>{bukhariData?.metadata.english.title || 'Sahih al-Bukhari'}</Text>
          <Text style={styles.subtitle}>{selectedChapter.english}</Text>
        </View>
        
        <FlatList
          data={chapterHadiths}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            // Limit preview text to avoid excessive length
            const previewText = item.english.text.length > 120
              ? item.english.text.substring(0, 120) + '...'
              : item.english.text;
            
            return (
              <TouchableOpacity 
                style={styles.hadithItem}
                onPress={() => handleHadithSelect(item)}
              >
                <Text style={styles.hadithNumber}>Hadith #{item.idInBook}</Text>
                <Text style={styles.narratorPreview}>{item.english.narrator}</Text>
                <Text style={styles.hadithPreview}>{previewText}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // Render chapters list view (default view)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {bukhariData?.metadata.english.title || 'Sahih al-Bukhari'}
        </Text>
        <Text style={styles.subtitle}>
          by {bukhariData?.metadata.english.author || 'Imam Bukhari'}
        </Text>
        <Image 
          source={require('../assets/images/hadith_caligraphy.png')} 
          style={styles.headerImage}
          resizeMode="contain"
        />
        <View style={styles.buttonContainer}>
          <Button title="Go Home" onPress={() => router.push("/")} />
          <Button title="Go to Quran" onPress={() => router.push("/quran")} />
        </View>
      </View>
      
      <FlatList
        data={bukhariData?.chapters || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.chapterItem}
            onPress={() => handleChapterSelect(item)}
          >
            <Text style={styles.chapterNumber}>Chapter {item.id}</Text>
            <Text style={styles.chapterItemName}>{item.english}</Text>
            <Text style={styles.arabicChapterName}>{item.arabic}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    marginBottom: 15,
    alignItems: 'center',
  },
  headerImage: {
    width: 200,
    height: 120,
    marginVertical: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  chapterItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  chapterNumber: {
    fontSize: 14,
    color: '#666',
  },
  chapterItemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  arabicChapterName: {
    fontSize: 16,
    textAlign: 'right',
    marginTop: 5,
    fontFamily: 'System',
    color: '#333',
  },
  chapterName: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  hadithItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  hadithNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  narratorPreview: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 5,
    color: '#555',
  },
  hadithPreview: {
    fontSize: 14,
    color: '#333',
  },
  hadithContainer: {
    padding: 15,
  },
  narratorText: {
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 10,
    color: '#555',
  },
  hadithText: {
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 10,
  },
  bookName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  arabicContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 15,
  },
  arabicText: {
    fontSize: 18,
    lineHeight: 30,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
  },
});