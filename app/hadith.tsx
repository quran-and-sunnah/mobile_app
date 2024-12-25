import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function Hadith() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Hadith Screen</Text>
      <Button title="Go Home" onPress={() => router.push("/")} />
      <Button title="Go to Quran" onPress={() => router.push("/quran")} />
    </View>
  );
}
