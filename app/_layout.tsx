import React from 'react';
import { Stack } from "expo-router";
import "../global.css";
import { useFonts } from "expo-font";
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PoppinsRegular: require("../assets/fonts/Poppins-Regular.ttf"),
    PoppinsMedium: require("../assets/fonts/Poppins-Medium.ttf"),
    PoppinsSemiBold: require("../assets/fonts/Poppins-SemiBold.ttf"),
    PoppinsBold: require("../assets/fonts/Poppins-Bold.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: '#1F1F1F' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'PoppinsSemiBold' },
        headerShown: false,
        contentStyle: { backgroundColor: '#121212' },
      }}>
        <Stack.Screen name="index" options={{ title: "Islamic App" }} />
        <Stack.Screen name="quran/quran" options={{ title: "Quran" }} />
        <Stack.Screen name="hadith" options={{ title: "Hadith" }} />
      </Stack>
    </>
  );
}