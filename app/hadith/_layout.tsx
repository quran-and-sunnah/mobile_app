import React from 'react';
import { Stack } from "expo-router";

// This is the layout for the Hadith section
export default function HadithLayout() {
  return (
    <Stack
      screenOptions={{
        // Default header style for all screens in the Hadith section
        headerStyle: { backgroundColor: '#1e293b' }, // Example: Slate-800
        headerTintColor: '#f8fafc', // Example: Slate-50
        headerTitleStyle: { fontFamily: 'PoppinsSemiBold', color: '#f8fafc' },
        headerBackTitleVisible: false, // Hide the back button text (iOS)
        contentStyle: { backgroundColor: '#0f172a' }, // Example: Slate-900
      } as any} // Cast to any to allow headerBackTitleVisible
    >
      {/* Define specific options per screen if needed */}
      <Stack.Screen name="index" options={{ title: "Hadith Collections", headerShown: true }} />
      {/* Add more Stack.Screen entries here as you create the files */}
      {/* e.g., <Stack.Screen name="[collectionId]/index" options={{ title: "Chapters" }} /> */}
    </Stack>
  );
}
