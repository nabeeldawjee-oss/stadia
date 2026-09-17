import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/lib/api";

interface Tournament { id: string; name: string; sport: string; status: string; slug: string; }

export default function ExploreTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const router = useRouter();

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      // Search by slug (public endpoint)
      const t = await apiFetch<Tournament>(`/api/public/t/${query.trim().toLowerCase()}`);
      setResults([t]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter tournament slug..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            autoCapitalize="none"
            returnKeyType="search"
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={search}>
            <Text style={styles.searchBtnText}>Find</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/public/${item.slug}`)}
            >
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardSport}>{item.sport}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No tournament found for "{query}"</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 12 },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827" },
  searchBtn: { backgroundColor: "#0284c7", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cardSport: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { fontSize: 14, color: "#9ca3af" },
});
