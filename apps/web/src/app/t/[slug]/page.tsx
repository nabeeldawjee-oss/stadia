"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Standing {
  position: number;
  team: { id: string; name: string };
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
interface Match {
  id: string;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledMatch?: { startTime: string; field?: { name: string } } | null;
}
interface Group { id: string; name: string; standings: Standing[]; matches: Match[]; }
interface Bracket {
  id: string;
  size: number;
  slots: { id: string; roundNumber: number; position: number; team: { name: string } | null; isBye: boolean }[];
  matches: Match[];
}
interface Phase { id: string; name: string; type: string; groups: Group[]; brackets: Bracket[]; }
interface Division { id: string; name: string; phases: Phase[]; }
interface Tournament {
  id: string;
  name: string;
  sport: string;
  slug: string;
  status: string;
  branding?: { primaryColor?: string; logoUrl?: string } | null;
  divisions: Division[];
}
interface ScheduledMatch {
  matchId: string;
  startTime: string;
  field: { name: string };
  match: { homeTeam: { name: string } | null; awayTeam: { name: string } | null; homeScore: number | null; awayScore: number | null; status: string };
}

type Tab = "standings" | "fixtures" | "results";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { hour: "2-digit", minute: "2-digit", weekday: "short", day: "numeric", month: "short", hour12: false });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
}

export default function PublicTournamentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);
  const [tab, setTab] = useState<Tab>("standings");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeDivision, setActiveDivision] = useState<string | null>(null);

  const load = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/public/t/${slug}`),
        fetch(`${API_URL}/api/public/t/${slug}/schedule`),
      ]);
      if (!tRes.ok) { setNotFound(true); setLoading(false); return; }
      const t = await tRes.json();
      setTournament(t.data);
      if (t.data?.divisions?.[0]) setActiveDivision(t.data.divisions[0].id);
      if (sRes.ok) { const s = await sRes.json(); setSchedule(s.data ?? []); }
    } catch { setNotFound(true); }
    setLoading(false);
  };

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [slug]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  if (notFound || !tournament) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Tournament not found</div>;

  const primary = tournament.branding?.primaryColor || "#16a34a";
  const division = tournament.divisions.find((d) => d.id === activeDivision);

  // Group schedule by date
  const byDate: Record<string, ScheduledMatch[]> = {};
  schedule.forEach((sm) => {
    const d = new Date(sm.startTime).toISOString().split("T")[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(sm);
  });
  const allDates = Object.keys(byDate).sort();
  const today = new Date().toISOString().split("T")[0];

  const fixtures = schedule.filter((sm) => sm.match.status !== "COMPLETED" && new Date(sm.startTime).getTime() >= Date.now() - 7200_000);
  const results = schedule.filter((sm) => sm.match.homeScore != null).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {tournament.branding?.logoUrl && (
            <img src={tournament.branding.logoUrl} alt="" className="h-14 w-auto object-contain mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{tournament.sport}</p>
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${tournament.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {tournament.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 flex gap-0">
          {(["standings", "fixtures", "results"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition ${tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              style={tab === t ? { borderColor: primary, color: primary } : {}}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Division tabs (for standings) */}
        {tab === "standings" && tournament.divisions.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {tournament.divisions.map((div) => (
              <button
                key={div.id}
                onClick={() => setActiveDivision(div.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${activeDivision === div.id ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                style={activeDivision === div.id ? { backgroundColor: primary } : {}}
              >
                {div.name}
              </button>
            ))}
          </div>
        )}

        {/* STANDINGS TAB */}
        {tab === "standings" && division && (
          <div className="space-y-6">
            {division.phases.map((phase) => (
              <div key={phase.id}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{division.name} · {phase.name}</h3>
                {phase.type === "GROUP_STAGE" && phase.groups.map((group) => (
                  <div key={group.id} className="mb-5">
                    <div className="text-xs font-medium text-gray-500 mb-2 px-1">{group.name}</div>
                    {group.standings.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr className="text-xs text-gray-400">
                              <th className="text-left px-4 py-2">#</th>
                              <th className="text-left px-4 py-2">Team</th>
                              <th className="px-2 py-2 text-center">P</th>
                              <th className="px-2 py-2 text-center">W</th>
                              <th className="px-2 py-2 text-center">D</th>
                              <th className="px-2 py-2 text-center">L</th>
                              <th className="px-2 py-2 text-center">GD</th>
                              <th className="px-2 py-2 text-center font-semibold">Pts</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {group.standings.map((row) => (
                              <tr key={row.position} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 text-gray-400 text-xs w-8">{row.position}</td>
                                <td className="px-4 py-2.5 font-medium text-gray-900">{row.team.name}</td>
                                <td className="px-2 py-2.5 text-center text-gray-500">{row.played}</td>
                                <td className="px-2 py-2.5 text-center text-gray-500">{row.wins}</td>
                                <td className="px-2 py-2.5 text-center text-gray-500">{row.draws}</td>
                                <td className="px-2 py-2.5 text-center text-gray-500">{row.losses}</td>
                                <td className="px-2 py-2.5 text-center text-gray-400">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                                <td className="px-2 py-2.5 text-center font-bold text-gray-900">{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
                {phase.type === "KNOCKOUT" && phase.brackets.map((bracket) => (
                  <div key={bracket.id} className="text-sm text-gray-500 px-1">
                    Knockout bracket ({bracket.size} teams)
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* FIXTURES TAB */}
        {tab === "fixtures" && (
          <div className="space-y-6">
            {fixtures.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No upcoming matches</div>
            ) : (
              Object.entries(
                fixtures.reduce<Record<string, ScheduledMatch[]>>((acc, sm) => {
                  const d = new Date(sm.startTime).toISOString().split("T")[0];
                  if (!acc[d]) acc[d] = [];
                  acc[d].push(sm);
                  return acc;
                }, {})
              ).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayMatches]) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                    {fmtDate(date)}
                    {date === today && <span className="px-1.5 py-0.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: primary }}>TODAY</span>}
                  </div>
                  <div className="space-y-2">
                    {dayMatches.map((sm) => (
                      <div key={sm.matchId} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="text-xs font-mono text-gray-400 w-10 shrink-0">{fmtTime(sm.startTime)}</div>
                        <div className="text-xs text-gray-300 shrink-0">{sm.field?.name}</div>
                        <div className="flex-1 flex items-center justify-center gap-3 text-sm font-medium">
                          <span className="text-gray-700">{sm.match.homeTeam?.name ?? "TBD"}</span>
                          <span className="text-gray-300 text-xs">vs</span>
                          <span className="text-gray-700">{sm.match.awayTeam?.name ?? "TBD"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div className="space-y-6">
            {results.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No results yet</div>
            ) : (
              Object.entries(
                results.reduce<Record<string, ScheduledMatch[]>>((acc, sm) => {
                  const d = new Date(sm.startTime).toISOString().split("T")[0];
                  if (!acc[d]) acc[d] = [];
                  acc[d].push(sm);
                  return acc;
                }, {})
              ).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayMatches]) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{fmtDate(date)}</div>
                  <div className="space-y-2">
                    {dayMatches.map((sm) => (
                      <div key={sm.matchId} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="text-xs font-mono text-gray-400 w-10 shrink-0">{fmtTime(sm.startTime)}</div>
                        <div className="text-xs text-gray-300 shrink-0">{sm.field?.name}</div>
                        <div className="flex-1 flex items-center justify-center gap-3">
                          <span className={`text-sm font-medium ${(sm.match.homeScore ?? 0) > (sm.match.awayScore ?? 0) ? "text-gray-900 font-bold" : "text-gray-500"}`}>
                            {sm.match.homeTeam?.name ?? "TBD"}
                          </span>
                          <span className="font-mono font-bold text-gray-900 text-base px-2">
                            {sm.match.homeScore} – {sm.match.awayScore}
                          </span>
                          <span className={`text-sm font-medium ${(sm.match.awayScore ?? 0) > (sm.match.homeScore ?? 0) ? "text-gray-900 font-bold" : "text-gray-500"}`}>
                            {sm.match.awayTeam?.name ?? "TBD"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-gray-300">Updates every 30 seconds · Powered by Stadia</p>
      </div>
    </div>
  );
}
