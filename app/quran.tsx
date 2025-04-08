import { View, Text, Pressable, SafeAreaView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import "../global.css";

export default function Quran() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <View className="items-center pt-6 pb-4 px-5">
        <Text className="text-xl font-poppinsBold text-white mb-4">
          Quran Explorer
        </Text>
      </View>
      
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
    </SafeAreaView>
  );
}