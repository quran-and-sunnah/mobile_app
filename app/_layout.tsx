import { Stack } from "expo-router";
import "../global.css";
import { useFonts } from "expo-font";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PoppinsRegular: require("../assets/fonts/Poppins-Regular.ttf"),
    PoppinsSemiBold: require("../assets/fonts/Poppins-SemiBold.ttf"),
    PoppinsBold: require("../assets/fonts/Poppins-Bold.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#3b82f6' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontFamily: 'PoppinsSemiBold' },
    }}>
      <Stack.Screen name="index" options={{ title: "Islamic App" }} />
      <Stack.Screen name="quran" options={{ title: "Quran" }} />
      <Stack.Screen name="hadith" options={{ title: "Hadith" }} />
    </Stack>
  );
}
