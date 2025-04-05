import { View, Text, Image, Pressable, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";

const QuranCaligraphy = require('../assets/images/quran_caligraphy.png');
const HadithCaligraphy = require('../assets/images/hadith_caligraphy.png');
const MasjidImage = require('../assets/images/masjid.png');

export default function Index() {
  const router = useRouter();

  const handleQuranPress = () => {
    router.push("/quran");
  };

  const handleHadithPress = () => {
    router.push("/hadith");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 justify-center items-center">
        <Text className="text-3xl mb-12 font-poppinsBold text-gray-800 text-center px-6">
          Islamic Library
        </Text>
        
        <View className="flex-row px-6 justify-center">
          <Pressable 
            onPress={handleQuranPress} 
            className="items-center mr-6 bg-white p-6 rounded-2xl shadow-lg"
            style={{
              shadowColor: '#31A05F',
              shadowOpacity: 0.2,
              shadowRadius: 15,
              elevation: 5
            }}
          >
            <View className="bg-green-100 rounded-xl p-4 mb-4">
              <Image 
                source={QuranCaligraphy} 
                className="w-[110] h-[110]" 
                resizeMode="contain" 
              />
            </View>
            <Text className="font-poppinsSemiBold text-center text-xl text-gray-800">
              Quran
            </Text>
          </Pressable>

          <Pressable 
            onPress={handleHadithPress} 
            className="items-center bg-white p-6 rounded-2xl shadow-lg"
            style={{
              shadowColor: '#3B82F6',
              shadowOpacity: 0.2,
              shadowRadius: 15,
              elevation: 5
            }}
          >
            <View className="bg-blue-100 rounded-xl p-4 mb-4">
              <Image 
                source={HadithCaligraphy} 
                className="w-[110] h-[110]" 
                resizeMode="contain" 
              />
            </View>
            <Text className="font-poppinsSemiBold text-center text-xl text-gray-800">
              Hadith
            </Text>
          </Pressable>
        </View>
      </View>
      
      <Image 
        source={MasjidImage} 
        className="w-[450] h-[280] absolute bottom-0" 
        resizeMode="stretch"
        style={{ opacity: 0.8 }}
      />
    </SafeAreaView>
  );
}
