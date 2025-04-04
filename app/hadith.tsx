import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";

export default function Hadith() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<{ id: string; name: string; editions: any[] }[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [hadithData, setHadithData] = useState<HadithData | null>(null);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available collections
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setLoading(true);
        // Use the data from the CDN
        const response = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions.min.json');
        const data = await response.json();
        
        // Convert the data to a more usable format for our UI
        const collectionsArray = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name,
          editions: data[key].collection
        }));
        
        setCollections(collectionsArray);
      } catch (err) {
        console.error('Error fetching collections:', err);
        setError('Failed to load hadith collections');
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // Fetch hadiths when a collection is selected
  interface Hadith {
    hadithnumber: string;
    text: string;
    grade?: string;
  }

  interface HadithData {
    hadiths: Record<string, Hadith>;
  }

  const fetchHadiths = async (collectionId: string, editionName: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${editionName}.min.json`);
      const data: HadithData = await response.json();
      setHadithData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching hadiths:', err);
      setError('Failed to load hadiths');
      setLoading(false);
    }
  };

  interface Collection {
    id: string;
    name: string;
    editions: Edition[];
  }

  interface Edition {
    name: string;
    language: string;
  }

  const handleCollectionSelect = (collection: Collection): void => {
    setSelectedCollection(collection);
    // Find the English edition if available, otherwise use the first one
    const englishEdition = collection.editions.find((edition: Edition) => edition.language === "English");
    const editionToUse = englishEdition || collection.editions[0];
    fetchHadiths(collection.id, editionToUse.name);
  };

  const handleHadithSelect = (hadith: Hadith) => {
    setSelectedHadith(hadith);
  };

  const handleBack = () => {
    if (selectedHadith) {
      setSelectedHadith(null);
    } else if (selectedCollection) {
      setSelectedCollection(null);
      setHadithData(null);
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
        <Button title="Try Again" onPress={() => setError(null)} />
      </View>
    );
  }

  // Render single hadith view
  if (selectedHadith) {
    return (
      <SafeAreaView style={styles.container}>
        <Button title="Back to List" onPress={handleBack} />
        <View style={styles.hadithContainer}>
          <Text style={styles.hadithNumber}>Hadith #{selectedHadith.hadithnumber}</Text>
          <Text style={styles.hadithText}>{selectedHadith.text}</Text>
          {selectedHadith.grade && (
            <Text style={styles.gradeText}>Grade: {selectedHadith.grade}</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Render hadith list view
  if (selectedCollection && hadithData) {
    const hadiths = hadithData.hadiths || [];
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Button title="Back to Collections" onPress={handleBack} />
          <Text style={styles.title}>{selectedCollection.name}</Text>
        </View>
        
        <FlatList
          data={Object.keys(hadiths)}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.hadithItem}
              onPress={() => handleHadithSelect(hadiths[item])}
            >
              <Text style={styles.hadithNumber}>Hadith #{item}</Text>
              <Text style={styles.hadithPreview}>
                {hadiths[item].text?.substring(0, 100)}...
              </Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // Render collections list
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hadith Collections</Text>
        <View style={styles.buttonContainer}>
          <Button title="Go Home" onPress={() => router.push("/")} />
          <Button title="Go to Quran" onPress={() => router.push("/quran")} />
        </View>
      </View>
      
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.collectionItem}
            onPress={() => handleCollectionSelect(item)}
          >
            <Text style={styles.collectionName}>{item.name}</Text>
            <Text style={styles.editionCount}>
              {item.editions.length} editions available
            </Text>
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  collectionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  collectionName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editionCount: {
    fontSize: 14,
    color: '#666',
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
  hadithPreview: {
    fontSize: 14,
    color: '#333',
  },
  hadithContainer: {
    padding: 15,
  },
  hadithText: {
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 10,
  },
  gradeText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
  }
});