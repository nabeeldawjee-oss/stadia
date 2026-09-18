"use client";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ScoreEntryModal from "@/components/ScoreEntryModal";
import { Shield } from "lucide-react";

interface Team { id: string; name: string; }
interface Match { id: string; homeTeam: Team | null; awayTeam: Team | null; homeScore: number | null; awayScore: number | null; status: string; scheduledMatch?: { startTime: string; field: { name: string } } | null; }
interface TokenData { id: string; type: string; team: { id: string; name: string; tournamentId: string; } | null; }

export default function TeamView() {
  const params = useSearchParams();
  const token = params.get("token");
  const [scoring, setScoring] = useState<Match | null>(null);

  const { data: tokenData, error: tokenError } = useSWR<TokenData>(
    token ? `/api/team?token=${token}` : null,
    () => apiFetch(`/api/team?token=${token}`)
  );

  const teamId = tokenData?.team?.id;
  const { data: matches, error: matchError, mutate } = useSWR<Match[]>(
    teamId ? `/api/teams/${teamId}/matches` : null,
    () => apiFetch(`/api/teams/${teamId}/matches`)
  );

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-gray-500 text-sm text-center">
          No token provided. Use the link sent by the tournament organizer.
        </p>
      </div>
    );
  }

  if (tokenError || matchError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-red-500 text-sm">Invalid or expired token.</p>
      </div>
    );
  }

  if (!tokenData || !matches) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>;
  }

  const teamName = tokenData.team?.name ?? "Your Team";

  const statusColor: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-600",
    IN_PROGRESS: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="w-6 h-6 text-brand-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{teamName}</h1>
          <p className="text-sm text-gray-500 mt-1">Your matches</p>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No matches scheduled yet.</div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">
                    {match.scheduledMatch
                      ? `${new Date(match.scheduledMatch.startTime).toLocaleString()} · ${match.scheduledMatch.field.name}`
                      : "Not yet scheduled"}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[match.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {match.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <p className="font-semibold text-gray-900">{match.homeTeam?.name ?? "TBD"}</p>
                    {match.homeScore !== null && (
                      <p className="text-3xl font-bold text-gray-900 mt-1">{match.homeScore}</p>
                    )}
                  </div>
                  <div className="px-4 text-gray-300 font-bold">vs</div>
                  <div className="flex-1 text-center">
                    <p className="font-semibold text-gray-900">{match.awayTeam?.name ?? "TBD"}</p>
                    {match.awayScore !== null && (
                      <p className="text-3xl font-bold text-gray-900 mt-1">{match.awayScore}</p>
                    )}
                  </div>
                </div>
                {match.status !== "COMPLETED" && match.homeTeam && match.awayTeam && (
                  <button
                    onClick={() => setScoring(match)}
                    className="mt-3 w-full bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition"
                  >
                    Submit score
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {scoring && (
          <ScoreEntryModal
            match={scoring}
            token={token ?? undefined}
            onClose={() => setScoring(null)}
            onSaved={() => { setScoring(null); mutate(); }}
          />
        )}
      </div>
    </div>
  );
}
