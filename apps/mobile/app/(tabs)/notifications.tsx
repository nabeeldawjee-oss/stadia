import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";

export default function NotificationsTab() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>
      <View style={styles.empty}>
        <Bell size={40} color="#d1d5db" />
        <Text style={styles.emptyText}>No notifications yet</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, color: "#9ca3af" },
});
