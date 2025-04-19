import { View, Text, Pressable, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import "../../global.css";
import SearchBar from "../../components/SearchBar";

export default function Quran() {
  const router = useRouter();
  
  // This is a placeholder for the actual search implementation
  const handleSearch = (query: string) => {
    console.log("Searching Quran for:", query);
    // Placeholder for search implementation
    alert(`Search functionality for Quran will be implemented soon.\nSearched for: "${query}"`);
  };

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
            QuranExplorer
          </Text>
          <View style={{ width: 50 }}>{/* Empty view for balance */}</View>
        </View>
        
        <SearchBar
          onSearch={handleSearch}
          placeholder="Search Quran..."
        />
      </View>
      
      <ScrollView className="flex-1">
        <View className="flex-1 justify-center items-center p-6">
          <View 
            className="bg-gray-800 p-6 rounded w-full items-center"
          >
            <View className="bg-gray-700 w-16 h-16 rounded-full mb-5 items-center justify-center">
              <Text className="text-white font-poppinsBold text-xl">Q</Text>
            </View>
            
            <Text className="text-lg text-white font-poppins text-center mb-6 leading-6">
              Quran section is under development. More content will be added soon.
            </Text>
            
            <TouchableOpacity 
              className="bg-gray-700 px-7 py-3 rounded mt-4"
              onPress={() => router.push("/hadith")}
            >
              <Text className="text-white font-poppinsSemiBold">Go to Hadith</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}