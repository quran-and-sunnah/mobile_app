import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function Quran() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Quran Screen</Text>
      <Button title="Go to Home" onPress={() => router.push("/")} />
      <Button title="Go to Hadith" onPress={() => router.push("/hadith")} />
    </View>
  );
}
