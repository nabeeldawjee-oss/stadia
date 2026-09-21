"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useState } from "react";
import ScoreEntryModal from "@/components/ScoreEntryModal";
import { Zap, CheckCircle, ChevronDown, ChevronUp, BarChart2, History } from "lucide-react";

interface Team { id: string; name: string; }
interface Match {
  id: string;
  roundNumber: number | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  contextType: string;
}
interface Standing { position: number; team: { id: string; name: string }; played: number; wins: number; draws: number; losses: number; goalDifference: number; points: number; }
interface Group { id: string; name: string; matches: Match[]; standings: Standing[]; }
interface Bracket { id: string; size: number; matches: Match[]; }
interface Phase { id: string; name: string; type: string; status: string; groups: Group[]; brackets: Bracket[]; }
interface Division { id: string; name: string; phases: Phase[]; }

const ROUND_LABEL = (r: number | null, totalRounds: number) => {
  if (r === null) return "Match";
  const rem = totalRounds - r + 1;
  if (rem === 1) return "Final";
  if (rem === 2) return "Semifinals";
  if (rem === 3) return "Quarterfinals";
  return `Round ${r}`;
};

export default function MatchesPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [scoring, setScoring] = useState<Match | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: divisions, mutate } = useSWR<Division[]>(
    `/api/tournaments/${tournamentId}/matches`,
    () => api.get(`/api/tournaments/${tournamentId}/matches`)
  );

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleSaved = async () => {
    setScoring(null);
    await mutate();
  };

  if (!divisions) return <div className="text-gray-400 text-sm text-center py-12">Loading…</div>;

  const allPhases = divisions.flatMap((d) => d.phases);
  const allMatchFlat = allPhases.flatMap((p) => [...p.groups.flatMap((g) => g.matches), ...p.brackets.flatMap((b) => b.matches)]);
  const totalMatches = allMatchFlat.filter((m) => m.status !== "CANCELLED").length;
  const completedMatches = allMatchFlat.filter((m) => m.status === "COMPLETED").length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">All matches</p>
          <p className="text-xs text-gray-500 mt-0.5">{completedMatches} of {totalMatches} completed</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
          <div className="w-40 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: totalMatches > 0 ? `${(completedMatches / totalMatches) * 100}%` : "0%" }}
            />
          </div>
          {completedMatches}/{totalMatches}
        </div>
      </div>

      {divisions.map((division) => (
        <div key={division.id}>
          {divisions.length > 1 && (
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{division.name}</h2>
          )}
          <div className="space-y-3">
            {division.phases.map((phase) => {
              const phaseMatches = [...phase.groups.flatMap((g) => g.matches), ...phase.brackets.flatMap((b) => b.matches)];
              const phaseDone = phaseMatches.filter((m) => m.status === "COMPLETED").length;
              const phaseKey = `phase-${phase.id}`;
              const isCollapsed = collapsed.has(phaseKey);

              return (
                <div key={phase.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Phase header */}
                  <button
                    onClick={() => toggle(phaseKey)}
                    className="w-full px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between hover:bg-gray-100 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{phase.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        phase.status === "COMPLETED" ? "bg-green-100 text-green-700"
                        : phase.status === "ACTIVE" ? "bg-brand-50 text-brand-700"
                        : "bg-gray-100 text-gray-500"
                      }`}>
                        {phase.status === "ACTIVE" ? "In progress" : phase.status === "COMPLETED" ? "Complete" : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-gray-400">{phaseDone}/{phaseMatches.length}</span>
                      {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <>
                      {/* Group stage groups */}
                      {phase.groups.map((group) => (
                        <div key={group.id}>
                          {phase.groups.length > 1 && (
                            <div className="px-5 py-2 bg-gray-50/60 border-b border-gray-100">
                              <span className="text-xs font-medium text-gray-500">{group.name}</span>
                            </div>
                          )}
                          {group.matches.length === 0 ? (
                            <div className="px-5 py-4 text-xs text-gray-400">No matches generated yet.</div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {group.matches.map((match) => (
                                <MatchRow key={match.id} match={match} tournamentId={tournamentId} onScore={() => setScoring(match)} />
                              ))}
                            </div>
                          )}
                          {/* Inline live standings */}
                          {group.standings.length > 0 && (
                            <div className="border-t border-gray-100 bg-gray-50/40">
                              <div className="px-5 py-2 flex items-center gap-1.5">
                                <BarChart2 className="w-3 h-3 text-gray-400" />
                                <span className="text-xs font-medium text-gray-500">Standings</span>
                              </div>
                              <div className="px-5 pb-3 overflow-x-auto">
                                <table className="w-full text-xs min-w-[360px]">
                                  <thead>
                                    <tr className="text-gray-400 text-right">
                                      <th className="text-left font-medium pb-1 w-6">#</th>
                                      <th className="text-left font-medium pb-1">Team</th>
                                      <th className="font-medium pb-1 w-7">P</th>
                                      <th className="font-medium pb-1 w-7">W</th>
                                      <th className="font-medium pb-1 w-7">D</th>
                                      <th className="font-medium pb-1 w-7">L</th>
                                      <th className="font-medium pb-1 w-10">GD</th>
                                      <th className="font-bold pb-1 w-8 text-gray-600">Pts</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {group.standings.map((row, i) => (
                                      <tr key={row.team.id} className={i < 2 ? "text-gray-800" : "text-gray-400"}>
                                        <td className="py-1 text-gray-400">{row.position}</td>
                                        <td className="py-1 font-medium truncate max-w-[140px]">{row.team.name}</td>
                                        <td className="py-1 text-right">{row.played}</td>
                                        <td className="py-1 text-right">{row.wins}</td>
                                        <td className="py-1 text-right">{row.draws}</td>
                                        <td className="py-1 text-right">{row.losses}</td>
                                        <td className="py-1 text-right">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                                        <td className="py-1 text-right font-bold text-gray-700">{row.points}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Knockout brackets — group by round */}
                      {phase.brackets.map((bracket) => {
                        const totalRounds = Math.log2(bracket.size);
                        const byRound: Record<number, Match[]> = {};
                        for (const m of bracket.matches) {
                          const r = m.roundNumber ?? 1;
                          if (!byRound[r]) byRound[r] = [];
                          byRound[r].push(m);
                        }
                        const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
                        return (
                          <div key={bracket.id}>
                            {rounds.length === 0 ? (
                              <div className="px-5 py-4 text-xs text-gray-400">No matches generated yet.</div>
                            ) : (
                              rounds.map((r) => (
                                <div key={r}>
                                  <div className="px-5 py-2 bg-gray-50/60 border-b border-gray-100">
                                    <span className="text-xs font-medium text-gray-500">{ROUND_LABEL(r, totalRounds)}</span>
                                  </div>
                                  <div className="divide-y divide-gray-50">
                                    {byRound[r].map((match) => (
                                      <MatchRow key={match.id} match={match} tournamentId={tournamentId} onScore={() => setScoring(match)} />
                                    ))}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {divisions.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">No phases or matches yet. Set up the format first.</div>
      )}

      {scoring && (
        <ScoreEntryModal
          match={scoring}
          tournamentId={tournamentId}
          isOverride={scoring.status === "COMPLETED"}
          onClose={() => setScoring(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

interface ScoreLog {
  id: string;
  previousHomeScore: number;
  previousAwayScore: number;
  newHomeScore: number;
  newAwayScore: number;
  reason: string | null;
  createdAt: string;
}

function MatchRow({ match, tournamentId, onScore }: { match: Match; tournamentId: string; onScore: () => void }) {
  const isDone = match.status === "COMPLETED";
  const isCancelled = match.status === "CANCELLED";
  const canScore = !!(match.homeTeam && match.awayTeam) && !isCancelled;
  const homeWins = isDone && match.homeScore! > match.awayScore!;
  const awayWins = isDone && match.awayScore! > match.homeScore!;
  const [logOpen, setLogOpen] = useState(false);

  const { data: logEntries } = useSWR<ScoreLog[]>(
    logOpen ? `/api/matches/${match.id}/score-log` : null,
    () => api.get(`/api/matches/${match.id}/score-log`)
  );

  return (
    <div className={isCancelled ? "opacity-50" : isDone ? "opacity-80" : ""}>
      <div className="px-5 py-3 flex items-center gap-4">
        {/* Teams + score */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className={`flex-1 text-right text-sm truncate ${isCancelled ? "line-through text-gray-400" : homeWins ? "font-bold text-gray-900" : isDone ? "text-gray-400" : "text-gray-700"}`}>
            {match.homeTeam?.name ?? <span className="italic text-gray-300">TBD</span>}
          </span>
          <div className="shrink-0 min-w-[56px] text-center">
            {isDone && !isCancelled ? (
              <span className="font-mono font-bold text-gray-900 text-sm">
                {match.homeScore} – {match.awayScore}
              </span>
            ) : (
              <span className="text-gray-300 text-xs font-medium">vs</span>
            )}
          </div>
          <span className={`flex-1 text-left text-sm truncate ${isCancelled ? "line-through text-gray-400" : awayWins ? "font-bold text-gray-900" : isDone ? "text-gray-400" : "text-gray-700"}`}>
            {match.awayTeam?.name ?? <span className="italic text-gray-300">TBD</span>}
          </span>
        </div>

        {/* Status + action */}
        <div className="shrink-0 flex items-center gap-2">
          {isCancelled ? (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full font-medium">CANCELLED</span>
          ) : isDone ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> FT
            </span>
          ) : (
            <span className="text-xs text-gray-300 font-medium">—</span>
          )}
          {isDone && (
            <button
              onClick={() => setLogOpen((v) => !v)}
              title="Score override history"
              className={`p-1.5 rounded-lg transition ${logOpen ? "bg-amber-100 text-amber-600" : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"}`}
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {canScore && (
            <button
              onClick={onScore}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition ${
                isDone
                  ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              <Zap className="w-3 h-3" />
              {isDone ? "Edit" : "Score"}
            </button>
          )}
        </div>
      </div>

      {/* Score override log */}
      {logOpen && (
        <div className="px-5 pb-3 border-t border-gray-50 bg-amber-50/40">
          <p className="text-xs font-semibold text-amber-700 mt-2 mb-1.5">Score override history</p>
          {!logEntries ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : logEntries.length === 0 ? (
            <p className="text-xs text-gray-400">No overrides recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {logEntries.map((entry) => (
                <div key={entry.id} className="text-xs text-gray-600 flex items-start gap-3">
                  <span className="text-gray-400 shrink-0 tabular-nums">
                    {new Date(entry.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-mono text-gray-500 line-through shrink-0">
                    {entry.previousHomeScore}–{entry.previousAwayScore}
                  </span>
                  <span className="text-gray-300 shrink-0">→</span>
                  <span className="font-mono font-semibold text-gray-800 shrink-0">
                    {entry.newHomeScore}–{entry.newAwayScore}
                  </span>
                  {entry.reason && (
                    <span className="text-gray-400 italic truncate">{entry.reason}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
