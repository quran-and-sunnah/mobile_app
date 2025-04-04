import { View, Text, Image, Pressable } from "react-native";
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
    <View className="flex-1 justify-center items-center bg-white">
      <View className="flex-row">
        <Pressable onPress={handleQuranPress} className="items-center mr-12">
          <View className="bg-blue-300 rounded-lg p-4">
            <Image source={QuranCaligraphy} className="w-[100] h-[100] rounded-md" resizeMode="contain" />
          </View>
          <Text className="mt-2 font-poppinsSemiBold text-center text-xl">Quran</Text>
        </Pressable>

        <Pressable onPress={handleHadithPress} className="items-center">
          <View className="bg-blue-300 rounded-lg p-4">
            <Image source={HadithCaligraphy} className="w-[100] h-[100] rounded-md" resizeMode="contain" />
          </View>
          <Text className="mt-2 font-poppinsSemiBold text-center text-xl">Hadith</Text>
        </Pressable>
      </View>
      <Image source={MasjidImage} className="w-[450] h-[300] absolute bottom-0" />
    </View>
  );
}
