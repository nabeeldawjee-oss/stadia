import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/lib/auth-store";

export default function ProfileTab() {
  const { name, clearAuth } = useAuthStore();
  const router = useRouter();

  const signOut = () => {
    clearAuth();
    router.replace("/(auth)/sign-in");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name ?? "?")[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>

        <TouchableOpacity style={styles.btn} onPress={signOut}>
          <Text style={styles.btnText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  inner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  avatar: { width: 72, height: 72, backgroundColor: "#0284c7", borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#fff" },
  name: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 32 },
  btn: { backgroundColor: "#fee2e2", borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: "#dc2626", fontWeight: "600", fontSize: 15 },
});
