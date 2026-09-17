import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/lib/auth-store";

export default function SignInScreen() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: string; name: string } }>("/api/auth/signin", { email, password });
      setAuth(res.token, res.user.id, res.user.name);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Sign in failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>Stadia</Text>
        <Text style={styles.subtitle}>Tournament Management Platform</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#9ca3af"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={signIn} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign in"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
          <Text style={styles.link}>No account? Create one</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  logo: { fontSize: 32, fontWeight: "800", color: "#0284c7", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#9ca3af", textAlign: "center", marginBottom: 36 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 12, color: "#111827" },
  btn: { backgroundColor: "#0284c7", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  link: { textAlign: "center", color: "#0284c7", marginTop: 16, fontSize: 14 },
});
