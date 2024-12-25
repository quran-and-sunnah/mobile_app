import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Welcome to the Home Screen</Text>
      <Button title="Go to Quran" onPress={() => router.push("/quran")} />
      <Button title="Go to Hadith" onPress={() => router.push("/hadith")} />
    </View>
  );
}
