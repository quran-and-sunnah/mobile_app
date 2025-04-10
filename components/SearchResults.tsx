import React from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";

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
}

interface SearchResultsProps {
  results: SearchResult[];
  onResultPress: (result: SearchResult) => void;
  loading?: boolean;
}

const SearchResults: React.FC<SearchResultsProps> = ({ 
  results, 
  onResultPress,
  loading = false
}) => {
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-white font-poppins">Searching...</Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-white font-poppins text-center">No results found. Try different keywords or search terms.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => `${item.collectionId}-${item.id}`}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <TouchableOpacity 
          className="p-4 mb-3 bg-gray-800 rounded"
          onPress={() => onResultPress(item)}
        >
          <View className="flex-row justify-between mb-1">
            <Text className="text-gray-400 font-poppinsSemiBold">
              {item.collectionName} #{item.idInBook}
            </Text>
            <Text className="text-gray-400 font-poppins">
              {item.chapterName}
            </Text>
          </View>
          
          <Text className="text-gray-400 font-poppinsSemiBold mb-1">
            {item.narrator}
          </Text>
          
          <Text className="text-white font-poppins text-left">
            {item.text.length > 120 
              ? item.text.substring(0, 120) + '...'
              : item.text
            }
          </Text>
        </TouchableOpacity>
      )}
    />
  );
};

export default SearchResults;