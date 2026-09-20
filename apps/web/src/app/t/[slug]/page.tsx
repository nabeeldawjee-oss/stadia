"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

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
  roundNumber?: number | null;
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
interface Post { id: string; title: string; body: string; published: boolean; publishedAt: string | null; }
interface Tournament {
  id: string;
  name: string;
  sport: string;
  slug: string;
  status: string;
  branding?: { primaryColor?: string; logoUrl?: string } | null;
  divisions: Division[];
  registration?: { isOpen: boolean; entryFee: number; currency: string } | null;
  posts?: Post[];
}
interface ScheduledMatch {
  matchId: string;
  startTime: string;
  field: { name: string };
  match: { homeTeam: { name: string } | null; awayTeam: { name: string } | null; homeScore: number | null; awayScore: number | null; status: string };
}

type Tab = "standings" | "fixtures" | "results" | "bracket" | "stats" | "news" | "teams";

interface StatEntry { player: { id: string; name: string; team: { name: string } } | null; total: number; }
interface StatBoard { statDef: { id: string; name: string; key: string }; entries: StatEntry[]; }
interface PublicTeam { id: string; name: string; logoUrl: string | null; _count: { players: number }; }

function PublicBracket({ bracket, primary }: { bracket: Bracket; primary: string }) {
  const totalRounds = Math.log2(bracket.size);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  const matchByRound: Record<number, Match[]> = {};
  for (const m of bracket.matches) {
    const r = m.roundNumber ?? 1;
    if (!matchByRound[r]) matchByRound[r] = [];
    matchByRound[r].push(m);
  }

  const roundLabel = (r: number) => {
    const rem = totalRounds - r + 1;
    if (rem === 1) return "Final";
    if (rem === 2) return "Semi-finals";
    if (rem === 3) return "Quarter-finals";
    return `Round ${r}`;
  };

  const slotMap: Record<string, typeof bracket.slots[0]> = {};
  for (const s of bracket.slots) slotMap[`${s.roundNumber}-${s.position}-HOME`] = s;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-2 pt-1">
        {rounds.map((r) => {
          const isLast = r === totalRounds;
          const matchesInRound = bracket.size / Math.pow(2, r);
          const matches = matchByRound[r] ?? [];
          const cards = matches.length > 0 ? matches : Array.from({ length: matchesInRound }, (_, i) => ({
            id: `ph-${r}-${i}`, roundNumber: r, homeTeam: null, awayTeam: null,
            homeScore: null, awayScore: null, status: "PENDING",
          } as Match));

          return (
            <div key={r} className="flex flex-col gap-3" style={{ minWidth: 200 }}>
              <div className="text-center">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${isLast ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                  {roundLabel(r)}
                </span>
              </div>
              <div className="flex flex-col gap-2 flex-1 justify-around">
                {cards.map((m) => {
                  const hasScore = m.homeScore !== null;
                  const homeWins = hasScore && m.homeScore! > m.awayScore!;
                  const awayWins = hasScore && m.awayScore! > m.homeScore!;
                  return (
                    <div key={m.id} className={`rounded-xl border overflow-hidden ${isLast ? "border-yellow-200" : "border-gray-200"}`}>
                      {[{ team: m.homeTeam, score: m.homeScore, wins: homeWins }, { team: m.awayTeam, score: m.awayScore, wins: awayWins }].map((row, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 ${i === 1 ? "border-t border-gray-100" : ""} ${row.wins ? (isLast ? "bg-yellow-50" : "bg-green-50") : ""}`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            {row.wins && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: row.wins ? primary : undefined }} />}
                            <span className={`text-xs truncate max-w-[130px] ${row.wins ? "font-bold" : hasScore ? "text-gray-400" : "text-gray-600"}`} style={row.wins && !isLast ? { color: primary } : {}}>
                              {row.team?.name ?? <em className="text-gray-300 not-italic">TBD</em>}
                            </span>
                          </div>
                          {row.score !== null && (
                            <span className={`text-sm font-black ml-2 ${row.wins ? "" : "text-gray-300"}`} style={row.wins && !isLast ? { color: primary } : {}}>
                              {row.score}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const [statBoards, setStatBoards] = useState<StatBoard[]>([]);
  const [rankings, setRankings] = useState<{ rank: number; team: { id: string; name: string }; label: string }[]>([]);
  const [teams, setTeams] = useState<PublicTeam[]>([]);

  const load = async () => {
    try {
      const [tRes, sRes, stRes, rRes, teamsRes] = await Promise.all([
        fetch(`${API_URL}/api/public/t/${slug}`),
        fetch(`${API_URL}/api/public/t/${slug}/schedule`),
        fetch(`${API_URL}/api/public/t/${slug}/stats`),
        fetch(`${API_URL}/api/public/t/${slug}/ranking`),
        fetch(`${API_URL}/api/public/t/${slug}/teams`),
      ]);
      if (!tRes.ok) { setNotFound(true); setLoading(false); return; }
      const t = await tRes.json();
      setTournament(t.data);
      if (t.data?.divisions?.[0]) setActiveDivision(t.data.divisions[0].id);
      if (sRes.ok) { const s = await sRes.json(); setSchedule(s.data ?? []); }
      if (stRes.ok) { const st = await stRes.json(); setStatBoards(st.data ?? []); }
      if (rRes.ok) { const r = await rRes.json(); setRankings(r.data ?? []); }
      if (teamsRes.ok) { const tm = await teamsRes.json(); setTeams(tm.data ?? []); }
    } catch { setNotFound(true); }
    setLoading(false);
  };

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [slug]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  if (notFound || !tournament) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Tournament not found</div>;

  const primary = tournament.branding?.primaryColor || "#16a34a";
  const division = tournament.divisions.find((d) => d.id === activeDivision);
  const allBrackets = tournament.divisions.flatMap(d => d.phases.filter(p => p.type === "KNOCKOUT").flatMap(p => p.brackets));
  const hasKnockout = allBrackets.length > 0;
  const hasStats = statBoards.length > 0;
  const publishedPosts = (tournament.posts ?? []).filter((p) => p.published !== false);
  const hasPosts = publishedPosts.length > 0;
  const hasTeams = teams.length > 0;

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
  const scheduledResults = schedule.filter((sm) => sm.match.homeScore != null);
  const scheduledResultIds = new Set(scheduledResults.map((sm) => sm.matchId));

  // Collect all scored matches from tournament data (group + bracket matches)
  interface ResultMatch { id: string; homeTeam: { name: string } | null; awayTeam: { name: string } | null; homeScore: number; awayScore: number; phaseName: string; groupName?: string; }
  const allScoredMatches: ResultMatch[] = [];
  for (const div of tournament.divisions) {
    for (const phase of div.phases) {
      for (const group of phase.groups ?? []) {
        for (const m of group.matches ?? []) {
          if (m.homeScore !== null && m.awayScore !== null && !scheduledResultIds.has(m.id)) {
            allScoredMatches.push({ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore as number, awayScore: m.awayScore as number, phaseName: phase.name, groupName: group.name });
          }
        }
      }
      for (const bracket of phase.brackets ?? []) {
        for (const m of bracket.matches ?? []) {
          if (m.homeScore !== null && m.awayScore !== null && !scheduledResultIds.has(m.id)) {
            allScoredMatches.push({ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore as number, awayScore: m.awayScore as number, phaseName: phase.name });
          }
        }
      }
    }
  }
  const results = scheduledResults.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6 px-4">
        <div className="max-w-3xl mx-auto text-center relative">
          {tournament.branding?.logoUrl && (
            <img src={tournament.branding.logoUrl} alt="" className="h-14 w-auto object-contain mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{tournament.sport}</p>
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${tournament.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {tournament.status}
          </span>
          {/* Action buttons */}
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <Link
              href={`/t/${slug}/print`}
              target="_blank"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </Link>
            <button
              onClick={() => {
                const url = typeof window !== "undefined" ? window.location.href : "";
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator.share({ title: tournament.name, text: `Follow ${tournament.name} live`, url });
                } else {
                  const wa = `https://wa.me/?text=${encodeURIComponent(`Follow ${tournament.name} live: ${url}`)}`;
                  window.open(wa, "_blank", "noopener");
                }
              }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Registration banner */}
      {tournament.registration?.isOpen && (
        <div className="border-b border-gray-100" style={{ backgroundColor: `${primary}10` }}>
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium" style={{ color: primary }}>
              {tournament.registration.entryFee > 0
                ? `Registration open · ${tournament.registration.entryFee} ${tournament.registration.currency} entry fee`
                : "Registration is open — join now"}
            </p>
            <Link
              href={`/t/${slug}/register`}
              className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              Register →
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 flex gap-0">
          {(["standings", "fixtures", "results", ...(hasKnockout ? ["bracket" as Tab] : []), ...(hasStats ? ["stats" as Tab] : []), ...(hasPosts ? ["news" as Tab] : []), ...(hasTeams ? ["teams" as Tab] : [])] as Tab[]).map((t) => (
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
                                <td className="px-4 py-2.5 font-medium text-gray-900">
                                  <Link href={`/t/${slug}/teams/${row.team.id}`} className="hover:underline" style={{ color: primary }}>{row.team.name}</Link>
                                </td>
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
                  <PublicBracket key={bracket.id} bracket={bracket} primary={primary} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* BRACKET TAB */}
        {tab === "bracket" && (
          <div className="space-y-6">
            {/* Podium — shown when final is complete */}
            {rankings.length > 0 && (() => {
              const champion = rankings.find((r) => r.rank === 1);
              const runnerUp = rankings.find((r) => r.rank === 2);
              const third = rankings.find((r) => r.rank === 3);
              return (
                <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Final standings</p>
                  <div className="flex items-end justify-center gap-4">
                    {runnerUp && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-3xl">🥈</span>
                        <Link href={`/t/${slug}/teams/${runnerUp.team.id}`} className="text-sm font-semibold text-gray-700 hover:underline max-w-[110px] text-center">{runnerUp.team.name}</Link>
                        <span className="text-xs text-gray-400">Runner-up</span>
                      </div>
                    )}
                    {champion && (
                      <div className="flex flex-col items-center gap-1 -mt-4">
                        <span className="text-4xl">🏆</span>
                        <Link href={`/t/${slug}/teams/${champion.team.id}`} className="text-base font-bold hover:underline max-w-[130px] text-center" style={{ color: primary }}>{champion.team.name}</Link>
                        <span className="text-xs font-semibold text-yellow-600">Champion</span>
                      </div>
                    )}
                    {third && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-3xl">🥉</span>
                        <Link href={`/t/${slug}/teams/${third.team.id}`} className="text-sm font-semibold text-gray-700 hover:underline max-w-[110px] text-center">{third.team.name}</Link>
                        <span className="text-xs text-gray-400">3rd Place</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {allBrackets.map((bracket) => (
              <PublicBracket key={bracket.id} bracket={bracket} primary={primary} />
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
                    {dayMatches.map((sm) => {
                      const isLive = sm.match.status === "IN_PROGRESS";
                      return (
                        <div key={sm.matchId} className={`bg-white rounded-xl px-4 py-3 flex items-center gap-3 ${isLive ? "border-2" : "border border-gray-200"}`} style={isLive ? { borderColor: primary } : {}}>
                          <div className="text-xs font-mono text-gray-400 w-10 shrink-0">{fmtTime(sm.startTime)}</div>
                          <div className="text-xs text-gray-300 shrink-0">{sm.field?.name}</div>
                          <div className="flex-1 flex items-center justify-center gap-3 text-sm font-medium">
                            <span className="text-gray-700">{sm.match.homeTeam?.name ?? "TBD"}</span>
                            {isLive ? (
                              <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: primary }}>
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                LIVE
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">vs</span>
                            )}
                            <span className="text-gray-700">{sm.match.awayTeam?.name ?? "TBD"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div className="space-y-6">
            {results.length === 0 && allScoredMatches.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No results yet</div>
            ) : (
              <>
                {results.length > 0 && Object.entries(
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
                ))}

                {allScoredMatches.length > 0 && Object.entries(
                  allScoredMatches.reduce<Record<string, ResultMatch[]>>((acc, m) => {
                    const key = m.groupName ? `${m.phaseName} · ${m.groupName}` : m.phaseName;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(m);
                    return acc;
                  }, {})
                ).map(([label, matches]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</div>
                    <div className="space-y-2">
                      {matches.map((m) => (
                        <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-center gap-3">
                          <span className={`text-sm font-medium ${m.homeScore > m.awayScore ? "text-gray-900 font-bold" : "text-gray-500"}`}>
                            {m.homeTeam?.name ?? "TBD"}
                          </span>
                          <span className="font-mono font-bold text-gray-900 text-base px-2">
                            {m.homeScore} – {m.awayScore}
                          </span>
                          <span className={`text-sm font-medium ${m.awayScore > m.homeScore ? "text-gray-900 font-bold" : "text-gray-500"}`}>
                            {m.awayTeam?.name ?? "TBD"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab === "stats" && (
          <div className="space-y-6">
            {statBoards.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No stats recorded yet</div>
            ) : (
              statBoards.map((board) => (
                <div key={board.statDef.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">{board.statDef.name}</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {board.entries.map((entry, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <span className={`w-6 text-center text-xs font-bold shrink-0 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-gray-300"}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{entry.player?.name ?? "Unknown"}</p>
                          <p className="text-xs text-gray-400 truncate">{entry.player?.team?.name}</p>
                        </div>
                        <span className="text-lg font-black tabular-nums shrink-0" style={{ color: primary }}>{entry.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {/* NEWS TAB */}
        {tab === "news" && (
          <div className="space-y-4">
            {publishedPosts.map((post) => (
              <div key={post.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{post.title}</h3>
                  {post.publishedAt && (
                    <p className="text-xs text-gray-400 shrink-0 mt-0.5">
                      {new Date(post.publishedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{post.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* TEAMS TAB */}
        {tab === "teams" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/t/${slug}/teams/${team.id}`}
                className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 hover:border-gray-300 hover:shadow-sm transition"
              >
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt="" className="w-10 h-10 object-contain rounded-lg shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gray-400">{team.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{team.name}</p>
                  {team._count.players > 0 && (
                    <p className="text-xs text-gray-400">{team._count.players} player{team._count.players !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-gray-300">Updates every 30 seconds · Powered by Stadia</p>
      </div>
    </div>
  );
}
