"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { UserPlus, Zap, RefreshCw, Trash2 } from "lucide-react";
import ScoreEntryModal from "@/components/ScoreEntryModal";

interface Team { id: string; name: string; }
interface GroupTeam { team: Team; }
interface Standing { position: number; team: Team; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; }
interface Match {
  id: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledMatch?: { startTime: string; field: { name: string } } | null;
}
interface GroupDetail { id: string; name: string; teams: GroupTeam[]; standings: Standing[]; matches: Match[]; }

export default function GroupDetailPage() {
  const { id: tournamentId, groupId } = useParams<{ id: string; groupId: string }>();
  const router = useRouter();
  const [addTeamId, setAddTeamId] = useState("");
  const [scoring, setScoring] = useState<Match | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const { data: group, mutate } = useSWR<GroupDetail>(
    `/api/groups/${groupId}`,
    () => api.get(`/api/groups/${groupId}`)
  );
  const { data: allTeams } = useSWR<Team[]>(
    `/api/tournaments/${tournamentId}/teams`,
    () => api.get(`/api/tournaments/${tournamentId}/teams`)
  );

  const addTeam = async () => {
    if (!addTeamId) return;
    try {
      await api.post(`/api/groups/${groupId}/teams`, { teamId: addTeamId });
      setAddTeamId("");
      await mutate();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      await api.post(`/api/groups/${groupId}/standings/recalculate`, {});
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const removeTeam = async (teamId: string) => {
    if (!confirm("Remove this team from the group? Their matches will be deleted.")) return;
    await api.delete(`/api/groups/${groupId}/teams/${teamId}`);
    await mutate();
  };

  const inGroup = new Set(group?.teams.map((t) => t.team.id) ?? []);
  const available = allTeams?.filter((t) => !inGroup.has(t.id)) ?? [];

  const statusColor: Record<string, string> = {
    SCHEDULED: "text-gray-400",
    IN_PROGRESS: "text-green-600 font-semibold",
    COMPLETED: "text-gray-600",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => router.back()} className="hover:text-gray-700">← Back</button>
        <span>/</span>
        <span className="text-gray-900 font-medium">{group?.name}</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Teams */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="font-medium text-gray-900 text-sm">Teams</span>
            {available.length > 0 && (
              <div className="flex items-center gap-2">
                <select value={addTeamId} onChange={(e) => setAddTeamId(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none">
                  <option value="">Add team...</option>
                  {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={addTeam} disabled={!addTeamId} className="text-xs bg-brand-600 text-white px-2 py-1 rounded-lg disabled:opacity-40">
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {group?.teams.map(({ team }) => (
              <div key={team.id} className="px-4 py-2.5 text-sm text-gray-800 flex items-center justify-between group">
                <span>{team.name}</span>
                <button onClick={() => removeTeam(team.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {group?.teams.length === 0 && (
              <div className="px-4 py-4 text-xs text-gray-400 text-center">No teams in this group yet.</div>
            )}
          </div>
        </div>

        {/* Standings */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="font-medium text-gray-900 text-sm">Standings</span>
            <button onClick={recalculate} disabled={recalculating} title="Recalculate standings from match results" className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 disabled:opacity-40 transition">
              <RefreshCw className={`w-3 h-3 ${recalculating ? "animate-spin" : ""}`} />
              {recalculating ? "Recalculating..." : "Recalculate"}
            </button>
          </div>
          {!group?.standings.length ? (
            <div className="px-4 py-4 text-xs text-gray-400 text-center">Standings appear after matches are played.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Team</th>
                  <th className="text-center px-2 py-2">P</th>
                  <th className="text-center px-2 py-2">W</th>
                  <th className="text-center px-2 py-2">D</th>
                  <th className="text-center px-2 py-2">L</th>
                  <th className="text-center px-2 py-2">GD</th>
                  <th className="text-center px-2 py-2 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((row) => (
                  <tr key={row.position} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2 text-gray-400">{row.position}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{row.team.name}</td>
                    <td className="text-center px-2 py-2 text-gray-600">{row.played}</td>
                    <td className="text-center px-2 py-2 text-gray-600">{row.wins}</td>
                    <td className="text-center px-2 py-2 text-gray-600">{row.draws}</td>
                    <td className="text-center px-2 py-2 text-gray-600">{row.losses}</td>
                    <td className="text-center px-2 py-2 text-gray-600">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                    <td className="text-center px-2 py-2 font-bold text-gray-900">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Matches */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="font-medium text-gray-900 text-sm">Matches</span>
        </div>
        {!group?.matches.length ? (
          <div className="px-4 py-6 text-xs text-gray-400 text-center">No matches generated yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {group.matches.map((match) => (
              <div key={match.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">{match.homeTeam?.name ?? "TBD"}</span>
                  {match.homeScore !== null ? (
                    <span className="font-bold text-gray-900 text-sm mx-2">{match.homeScore} – {match.awayScore}</span>
                  ) : (
                    <span className="text-xs text-gray-400 mx-2">vs</span>
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">{match.awayTeam?.name ?? "TBD"}</span>
                </div>
                {match.scheduledMatch && (
                  <span className="text-xs text-gray-400">
                    {new Date(match.scheduledMatch.startTime).toLocaleDateString()} · {match.scheduledMatch.field.name}
                  </span>
                )}
                <span className={`text-xs ${statusColor[match.status] ?? "text-gray-400"}`}>{match.status}</span>
                {match.status !== "COMPLETED" && match.homeTeam && match.awayTeam && (
                  <button
                    onClick={() => setScoring(match)}
                    className="flex items-center gap-1 text-xs text-brand-600 bg-brand-50 border border-brand-200 px-2 py-1 rounded-lg hover:bg-brand-100 transition"
                  >
                    <Zap className="w-3 h-3" /> Enter score
                  </button>
                )}
                {match.status === "COMPLETED" && (
                  <button
                    onClick={() => setScoring(match)}
                    className="text-xs text-gray-400 hover:text-orange-600 transition"
                  >
                    Override
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
          tournamentId={tournamentId}
          isOverride={scoring.status === "COMPLETED"}
          onClose={() => setScoring(null)}
          onSaved={() => { setScoring(null); mutate(); }}
        />
      )}
    </div>
  );
}
