"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Player { id: string; name: string; number: number | null; position: string | null; }
interface MatchEntry {
  id: string;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledMatch: { startTime: string; field?: { name: string } } | null;
}
interface Team {
  id: string;
  name: string;
  logoUrl: string | null;
  players: Player[];
  homeMatches: MatchEntry[];
  awayMatches: MatchEntry[];
}
interface Tournament {
  id: string;
  name: string;
  sport: string;
  slug: string;
  branding?: { primaryColor?: string; logoUrl?: string } | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function TeamPage() {
  const { slug, teamId } = useParams<{ slug: string; teamId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, teamRes] = await Promise.all([
          fetch(`${API_URL}/api/public/t/${slug}`),
          fetch(`${API_URL}/api/public/t/${slug}/teams/${teamId}`),
        ]);
        if (!teamRes.ok) { setNotFound(true); setLoading(false); return; }
        const t = await tRes.json();
        const tm = await teamRes.json();
        setTournament(t.data);
        setTeam(tm.data);
      } catch { setNotFound(true); }
      setLoading(false);
    };
    load();
  }, [slug, teamId]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;
  if (notFound || !team) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Team not found</div>;

  const primary = tournament?.branding?.primaryColor || "#16a34a";

  const allMatches = [
    ...team.homeMatches.map((m) => ({ ...m, side: "home" as const })),
    ...team.awayMatches.map((m) => ({ ...m, side: "away" as const })),
  ].sort((a, b) => {
    const at = a.scheduledMatch ? new Date(a.scheduledMatch.startTime).getTime() : 0;
    const bt = b.scheduledMatch ? new Date(b.scheduledMatch.startTime).getTime() : 0;
    return at - bt;
  });

  const results = allMatches.filter((m) => m.status === "COMPLETED");
  const upcoming = allMatches.filter((m) => m.status !== "COMPLETED");

  const getOutcome = (m: typeof allMatches[0]) => {
    if (m.homeScore === null || m.awayScore === null) return null;
    const teamScore = m.side === "home" ? m.homeScore : m.awayScore;
    const oppScore = m.side === "home" ? m.awayScore : m.homeScore;
    if (teamScore > oppScore) return "W";
    if (teamScore < oppScore) return "L";
    return "D";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href={`/t/${slug}`} className="text-xs text-gray-400 hover:text-gray-600 transition">
            ← {tournament?.name ?? "Tournament"}
          </Link>
          <div className="mt-3 flex items-center gap-4">
            {team.logoUrl && (
              <img src={team.logoUrl} alt="" className="h-14 w-14 object-contain rounded-xl border border-gray-100" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{tournament?.sport}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Roster */}
        {team.players.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Squad</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {team.players.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  {p.number != null && (
                    <span className="w-7 text-center text-xs font-bold text-gray-400">{p.number}</span>
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-800">{p.name}</span>
                  {p.position && (
                    <span className="text-xs text-gray-400">{p.position}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Results</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {results.map((m) => {
                const outcome = getOutcome(m);
                const opp = m.side === "home" ? m.awayTeam : m.homeTeam;
                const teamScore = m.side === "home" ? m.homeScore : m.awayScore;
                const oppScore = m.side === "home" ? m.awayScore : m.homeScore;
                return (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <span className={`w-6 text-center text-xs font-black shrink-0 ${outcome === "W" ? "text-green-600" : outcome === "L" ? "text-red-500" : "text-gray-400"}`}>
                      {outcome}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">vs {opp?.name ?? "TBD"}</p>
                      {m.scheduledMatch && (
                        <p className="text-xs text-gray-400">{fmtDate(m.scheduledMatch.startTime)}</p>
                      )}
                    </div>
                    <span className="text-sm font-mono font-bold text-gray-900 shrink-0">{teamScore} – {oppScore}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Upcoming</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {upcoming.map((m) => {
                const opp = m.side === "home" ? m.awayTeam : m.homeTeam;
                return (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">vs {opp?.name ?? "TBD"}</p>
                      {m.scheduledMatch && (
                        <p className="text-xs text-gray-400">{fmtDate(m.scheduledMatch.startTime)} · {fmtTime(m.scheduledMatch.startTime)}{m.scheduledMatch.field ? ` · ${m.scheduledMatch.field.name}` : ""}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 font-medium shrink-0">–</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {team.players.length === 0 && results.length === 0 && upcoming.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No data yet for this team.</div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8 text-center">
        <p className="text-xs text-gray-300">Powered by Stadia</p>
      </div>
    </div>
  );
}
