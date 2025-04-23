import React from 'react';
import { Stack, useRouter } from "expo-router";
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// This is the layout for the Hadith section
export default function HadithLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        // Default header style for all screens in the Hadith section
        headerStyle: { backgroundColor: '#1e293b' }, // Example: Slate-800
        headerTintColor: '#f8fafc', // Example: Slate-50
        headerTitleStyle: { fontFamily: 'PoppinsSemiBold', color: '#f8fafc' },
        headerBackTitleVisible: false, // Hide the back button text (iOS)
        contentStyle: { backgroundColor: '#0f172a' }, // Example: Slate-900
        headerLeft: () => (
          <Pressable 
            style={{ marginLeft: 15 }}
            onPress={() => router.push('/quran/quran')}
          >
            <Ionicons name="book-outline" size={24} color="#94a3b8" />
          </Pressable>
        ),
      } as any} // Cast to any to allow headerBackTitleVisible
    >
      {/* Define specific options per screen if needed */}
      <Stack.Screen name="index" options={{ title: "Hadith Collections", headerShown: true }} />
      <Stack.Screen name="bookmarks" options={{ headerShown: false }} />
      <Stack.Screen name="[collectionId]/index" options={{ title: "Chapters" }} />
      <Stack.Screen name="[collectionId]/[chapterId]/index" options={{ title: "Hadiths" }} />
      {/* Add more Stack.Screen entries here as you create the files */}
      {/* e.g., <Stack.Screen name="[collectionId]/index" options={{ title: "Chapters" }} /> */}
    </Stack>
  );
}
