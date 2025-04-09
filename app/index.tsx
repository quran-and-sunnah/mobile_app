import { View, Text, Pressable, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import * as Font from 'expo-font';
import { useEffect, useState } from "react";

export default function Index() {
  const router = useRouter();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        'Amiri': require('../assets/fonts/Amiri-Regular.ttf'),
        'Amiri-Bold': require('../assets/fonts/Amiri-Bold.ttf'),
      });
      setFontsLoaded(true);
    }
    
    loadFonts();
  }, []);

  const handleQuranPress = () => {
    router.push("/quran");
  };

  const handleHadithPress = () => {
    router.push("/hadith");
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-3xl mb-12 font-poppinsBold text-white text-center">
          Islamic Library
        </Text>
        
        <View className="w-full">
          <Pressable 
            onPress={handleQuranPress} 
            className="items-center mb-6 bg-gray-800 p-6 rounded-lg"
          >
            <View className="mb-4 w-16 h-16 bg-gray-700 rounded-full items-center justify-center">
              <Text className="text-white font-poppinsBold text-xl">Q</Text>
            </View>
            <Text className="font-poppinsSemiBold text-center text-xl text-white">
              Quran
            </Text>
          </Pressable>

          <Pressable 
            onPress={handleHadithPress} 
            className="items-center bg-gray-800 p-6 rounded-lg"
          >
            <View className="mb-4 w-16 h-16 bg-gray-700 rounded-full items-center justify-center">
              <Text className="text-white font-poppinsBold text-xl">H</Text>
            </View>
            <Text className="font-poppinsSemiBold text-center text-xl text-white">
              Hadith
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}