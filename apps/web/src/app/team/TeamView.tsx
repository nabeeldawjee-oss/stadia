"use client";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ScoreEntryModal from "@/components/ScoreEntryModal";
import { Shield, Clock, MapPin, Trophy, ChevronUp, ChevronDown, Minus } from "lucide-react";

interface Team { id: string; name: string; }
interface Match { id: string; homeTeam: Team | null; awayTeam: Team | null; homeScore: number | null; awayScore: number | null; status: string; scheduledMatch?: { startTime: string; field: { name: string } } | null; }
interface TokenData { id: string; type: string; team: { id: string; name: string; tournamentId: string; } | null; }

interface StandingRow { rank: number; teamId: string; teamName: string; played: number; wins: number; draws: number; losses: number; goalDifference: number; points: number; isCurrentTeam: boolean; }
interface GroupStanding { groupId: string; groupName: string; rank: number; totalTeams: number; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; table: StandingRow[]; }
interface UpcomingMatch { id: string; status: string; homeTeam: string; awayTeam: string; isHome: boolean; startTime: string; field: string; }
interface PortalData { standings: GroupStanding[]; upcoming: UpcomingMatch[]; }

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

  const { data: portal } = useSWR<PortalData>(
    teamId ? `/api/teams/${teamId}/portal` : null,
    () => apiFetch(`/api/teams/${teamId}/portal`)
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
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="w-6 h-6 text-brand-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{teamName}</h1>
        </div>

        {/* Standings */}
        {portal?.standings && portal.standings.length > 0 && (
          <div className="space-y-4">
            {portal.standings.map((g) => (
              <div key={g.groupId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <Trophy className="w-4 h-4 text-brand-600" />
                  <span className="text-sm font-semibold text-gray-800">{g.groupName} — Standings</span>
                  <span className="ml-auto text-sm font-bold text-brand-600">
                    {g.rank === 1 ? "1st" : g.rank === 2 ? "2nd" : g.rank === 3 ? "3rd" : `${g.rank}th`} of {g.totalTeams}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100">
                        <th className="text-left px-4 py-2 font-medium w-6">#</th>
                        <th className="text-left px-2 py-2 font-medium">Team</th>
                        <th className="px-2 py-2 font-medium text-center">P</th>
                        <th className="px-2 py-2 font-medium text-center">W</th>
                        <th className="px-2 py-2 font-medium text-center">D</th>
                        <th className="px-2 py-2 font-medium text-center">L</th>
                        <th className="px-2 py-2 font-medium text-center">GD</th>
                        <th className="px-4 py-2 font-medium text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.table.map((row) => (
                        <tr key={row.teamId} className={`border-b border-gray-50 last:border-0 ${row.isCurrentTeam ? "bg-brand-50" : ""}`}>
                          <td className="px-4 py-2.5 text-gray-500">{row.rank}</td>
                          <td className={`px-2 py-2.5 font-medium ${row.isCurrentTeam ? "text-brand-700" : "text-gray-900"}`}>
                            {row.teamName}
                            {row.isCurrentTeam && <span className="ml-1 text-brand-400">←</span>}
                          </td>
                          <td className="px-2 py-2.5 text-center text-gray-600">{row.played}</td>
                          <td className="px-2 py-2.5 text-center text-green-600">{row.wins}</td>
                          <td className="px-2 py-2.5 text-center text-gray-500">{row.draws}</td>
                          <td className="px-2 py-2.5 text-center text-red-500">{row.losses}</td>
                          <td className="px-2 py-2.5 text-center text-gray-600">
                            <span className="flex items-center justify-center gap-0.5">
                              {row.goalDifference > 0 ? <ChevronUp className="w-3 h-3 text-green-500" /> : row.goalDifference < 0 ? <ChevronDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />}
                              {Math.abs(row.goalDifference)}
                            </span>
                          </td>
                          <td className={`px-4 py-2.5 text-center font-bold ${row.isCurrentTeam ? "text-brand-700" : "text-gray-900"}`}>{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming schedule */}
        {portal?.upcoming && portal.upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming matches</h2>
            <div className="space-y-2">
              {portal.upcoming.map((m) => {
                const start = new Date(m.startTime);
                const dateStr = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
                const timeStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold flex-1 text-right ${m.isHome ? "text-brand-700" : "text-gray-800"}`}>{m.homeTeam}</span>
                      <span className="text-xs text-gray-400 font-medium px-2">vs</span>
                      <span className={`text-sm font-semibold flex-1 ${!m.isHome ? "text-brand-700" : "text-gray-800"}`}>{m.awayTeam}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{dateStr} · {timeStr}</span>
                      {m.field && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.field}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All matches */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All matches</h2>
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
        </div>

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
