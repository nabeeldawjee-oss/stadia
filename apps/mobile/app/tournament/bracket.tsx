import { useLocalSearchParams, Stack } from "expo-router";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { useState } from "react";

interface BracketSlot {
  id: string;
  roundNumber: number;
  position: number;
  match: {
    id: string;
    homeTeam: { name: string } | null;
    awayTeam: { name: string } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  } | null;
}

interface Bracket {
  id: string;
  name: string;
  totalRounds: number;
  slots: BracketSlot[];
}

export default function BracketScreen() {
  const { bracketId, name } = useLocalSearchParams<{ bracketId: string; name: string }>();

  const { data: bracket, isLoading } = useSWR<Bracket>(
    bracketId ? `/api/brackets/${bracketId}` : null,
    () => apiFetch(`/api/brackets/${bracketId}`)
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: name ?? "Bracket" }} />
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  if (!bracket) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Bracket" }} />
        <Text style={styles.emptyText}>Bracket not found.</Text>
      </View>
    );
  }

  const rounds = Array.from({ length: bracket.totalRounds }, (_, i) => i + 1);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Stack.Screen options={{ title: bracket.name }} />
      <View style={styles.container}>
        {rounds.map((round) => {
          const slots = bracket.slots
            .filter((s) => s.roundNumber === round)
            .sort((a, b) => a.position - b.position);

          return (
            <View key={round} style={styles.roundColumn}>
              <Text style={styles.roundLabel}>Round {round}</Text>
              <View style={styles.matchList}>
                {slots.map((slot) => (
                  <MatchCard key={slot.id} slot={slot} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function MatchCard({ slot }: { slot: BracketSlot }) {
  const match = slot.match;
  const isCompleted = match?.status === "COMPLETED";

  return (
    <View style={[styles.matchCard, isCompleted && styles.matchCardCompleted]}>
      <TeamRow
        name={match?.homeTeam?.name ?? "TBD"}
        score={match?.homeScore}
        winner={isCompleted && match !== null && (match.homeScore ?? -1) > (match.awayScore ?? -1)}
      />
      <View style={styles.matchDivider} />
      <TeamRow
        name={match?.awayTeam?.name ?? "TBD"}
        score={match?.awayScore}
        winner={isCompleted && match !== null && (match.awayScore ?? -1) > (match.homeScore ?? -1)}
      />
    </View>
  );
}

function TeamRow({ name, score, winner }: { name: string; score: number | null | undefined; winner: boolean }) {
  return (
    <View style={styles.teamRow}>
      <View style={[styles.winnerDot, winner && styles.winnerDotActive]} />
      <Text style={[styles.teamName, winner && styles.teamNameWinner]} numberOfLines={1}>
        {name}
      </Text>
      {score !== null && score !== undefined && (
        <Text style={[styles.score, winner && styles.scoreWinner]}>{score}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1, backgroundColor: "#f9fafb" },
  scrollContent: { padding: 16 },
  container: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  roundColumn: { width: 160 },
  roundLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: "center",
  },
  matchList: { gap: 10 },
  matchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  matchCardCompleted: { borderColor: "#c7d2fe" },
  matchDivider: { height: 1, backgroundColor: "#f3f4f6" },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  winnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
  },
  winnerDotActive: { backgroundColor: "#0284c7" },
  teamName: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  teamNameWinner: { fontWeight: "700", color: "#111827" },
  score: { fontSize: 14, fontWeight: "700", color: "#9ca3af", minWidth: 20, textAlign: "right" },
  scoreWinner: { color: "#0284c7" },
  emptyText: { fontSize: 14, color: "#9ca3af" },
});
