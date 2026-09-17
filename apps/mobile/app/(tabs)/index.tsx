import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import useSWR from "swr";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/lib/auth-store";
import { SafeAreaView } from "react-native-safe-area-context";

interface Tournament { id: string; name: string; sport: string; status: string; }

export default function HomeTab() {
  const { token } = useAuthStore();
  const router = useRouter();

  if (!token) {
    router.replace("/(auth)/sign-in");
    return null;
  }

  const { data, isLoading } = useSWR<Tournament[]>(
    "/api/tournaments",
    () => api.get("/api/tournaments")
  );

  const statusColor: Record<string, string> = {
    DRAFT: "#9ca3af",
    PUBLISHED: "#3b82f6",
    ACTIVE: "#22c55e",
    COMPLETED: "#a855f7",
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tournaments</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/tournament/${item.id}`)}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardSport}>{item.sport}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${statusColor[item.status]}20` }]}>
                <Text style={[styles.badgeText, { color: statusColor[item.status] }]}>{item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tournaments yet.</Text>
              <Text style={styles.emptySubText}>Create one on the web dashboard.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cardSport: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280" },
  emptySubText: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
});
