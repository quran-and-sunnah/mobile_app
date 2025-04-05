import { View, Text, Pressable, SafeAreaView, Image } from "react-native";
import { useRouter } from "expo-router";
import "../global.css";

const QuranCaligraphy = require('../assets/images/quran_caligraphy.png');

export default function Quran() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="items-center pt-8 pb-6 px-5 bg-white shadow-md">
        <Text className="text-2xl font-poppinsBold text-gray-800 text-center mb-2">
          Quran
        </Text>
        
        <Image 
          source={QuranCaligraphy} 
          className="w-40 h-32 mb-3"
          resizeMode="contain"
        />
      </View>
      
      <View className="flex-1 justify-center items-center p-6">
        <View 
          className="bg-white p-7 rounded-xl shadow-md w-full items-center border border-gray-100"
          style={{ shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}
        >
          <View className="bg-green-100 w-16 h-16 rounded-full mb-5 items-center justify-center"
                style={{ shadowColor: '#31A05F', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 }}>
            <Text className="text-green-700 font-poppinsBold text-xl">Q</Text>
          </View>
          
          <Text className="text-lg text-gray-700 font-poppins text-center mb-6 leading-6">
            Quran section is under development. More content will be added soon.
          </Text>
          
          <Pressable 
            className="bg-green-600 px-7 py-3 rounded-lg mt-4 shadow-sm"
            style={{ shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 }}
            onPress={() => router.push("/hadith")}
          >
            <Text className="text-white font-poppinsSemiBold">Go to Hadith</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}