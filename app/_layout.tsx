import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="quran" options={{ title: "Quran" }} />
      <Stack.Screen name="hadith" options={{ title: "Hadith" }} />
    </Stack>
  );
}
