import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import useSWR from "swr";
import { api } from "../../src/lib/api";
import { useEffect } from "react";
import { io } from "socket.io-client";
import Constants from "expo-constants";

const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:4000";

interface Standing { position: number; team: { name: string }; played: number; won: number; drawn: number; lost: number; goalDifference: number; points: number; }
interface Match { id: string; homeTeam?: { name: string }; awayTeam?: { name: string }; homeScore: number | null; awayScore: number | null; status: string; scheduledMatch?: { startTime: string; field: { name: string } } | null; }
interface Group { id: string; name: string; standings: Standing[]; matches: Match[]; }
interface Bracket { id: string; name: string; }
interface Phase { id: string; name: string; type: string; status: string; groups: Group[]; brackets: Bracket[]; }
interface Division { id: string; name: string; phases: Phase[]; }
interface Tournament { id: string; name: string; sport: string; status: string; divisions: Division[]; }

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: tournament, mutate, isLoading } = useSWR<Tournament>(
    `/api/tournaments/${id}`,
    () => api.get(`/api/tournaments/${id}`)
  );

  useEffect(() => {
    if (!id) return;
    const socket = io(API_URL);
    socket.on("connect", () => socket.emit("join:tournament", id));
    socket.on("standings-updated", () => mutate());
    socket.on("score-updated", () => mutate());
    return () => { socket.emit("leave:tournament", id); socket.disconnect(); };
  }, [id]);

  if (isLoading || !tournament) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#0284c7" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.sport}>{tournament.sport}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {tournament.divisions?.map((div) => (
          <View key={div.id}>
            {tournament.divisions.length > 1 && (
              <Text style={styles.divisionName}>{div.name}</Text>
            )}
            {div.phases?.filter((p) => p.status === "ACTIVE").map((phase) => (
              <View key={phase.id}>
                <Text style={styles.phaseName}>{phase.name}</Text>
                {/* Bracket links */}
                {phase.brackets?.map((bracket) => (
                  <TouchableOpacity
                    key={bracket.id}
                    onPress={() => router.push({ pathname: "/tournament/bracket", params: { bracketId: bracket.id, name: bracket.name } })}
                    style={styles.bracketButton}
                  >
                    <Text style={styles.bracketButtonText}>🏆 View {bracket.name}</Text>
                  </TouchableOpacity>
                ))}
                {phase.groups?.map((group) => (
                  <View key={group.id} style={styles.card}>
                    <Text style={styles.groupName}>{group.name}</Text>

                    {/* Standings */}
                    {group.standings?.length > 0 && (
                      <View style={styles.table}>
                        <View style={styles.tableHeader}>
                          {["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map((h) => (
                            <Text key={h} style={[styles.th, h === "Team" ? styles.thTeam : {}]}>{h}</Text>
                          ))}
                        </View>
                        {group.standings.map((row) => (
                          <View key={row.position} style={styles.tableRow}>
                            <Text style={styles.td}>{row.position}</Text>
                            <Text style={[styles.td, styles.tdTeam]}>{row.team.name}</Text>
                            <Text style={styles.td}>{row.played}</Text>
                            <Text style={styles.td}>{row.won}</Text>
                            <Text style={styles.td}>{row.drawn}</Text>
                            <Text style={styles.td}>{row.lost}</Text>
                            <Text style={styles.td}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</Text>
                            <Text style={[styles.td, styles.tdPts]}>{row.points}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Recent/upcoming matches */}
                    {group.matches?.slice(0, 5).map((match) => (
                      <View key={match.id} style={styles.matchRow}>
                        <Text style={styles.matchTeam}>{match.homeTeam?.name ?? "TBD"}</Text>
                        {match.homeScore !== null ? (
                          <Text style={styles.score}>{match.homeScore} – {match.awayScore}</Text>
                        ) : (
                          <Text style={styles.vsText}>vs</Text>
                        )}
                        <Text style={styles.matchTeam}>{match.awayTeam?.name ?? "TBD"}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { backgroundColor: "#0284c7", paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  back: { marginBottom: 8 },
  backText: { color: "#bae6fd", fontSize: 13 },
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  sport: { fontSize: 13, color: "#bae6fd", marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 40 },
  divisionName: { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6, marginTop: 8 },
  phaseName: { fontSize: 12, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  groupName: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 10 },
  table: { marginBottom: 12 },
  tableHeader: { flexDirection: "row", marginBottom: 4 },
  th: { flex: 1, fontSize: 11, fontWeight: "600", color: "#9ca3af", textAlign: "center" },
  thTeam: { flex: 3, textAlign: "left" },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  td: { flex: 1, fontSize: 12, color: "#6b7280", textAlign: "center" },
  tdTeam: { flex: 3, textAlign: "left", color: "#111827", fontWeight: "500" },
  tdPts: { fontWeight: "700", color: "#111827" },
  matchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  matchTeam: { flex: 1, fontSize: 12, color: "#374151", fontWeight: "500" },
  score: { fontSize: 13, fontWeight: "700", color: "#111827", paddingHorizontal: 8 },
  vsText: { fontSize: 11, color: "#d1d5db", paddingHorizontal: 8 },
  bracketButton: { backgroundColor: "#eff6ff", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: "#bfdbfe" },
  bracketButtonText: { fontSize: 14, fontWeight: "600", color: "#1d4ed8", textAlign: "center" },
});
