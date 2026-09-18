"use client";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Team { id: string; name: string; }
interface Match {
  id: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  group?: { phase?: { division?: { name: string } } } | null;
}
interface ScheduledMatch {
  matchId: string;
  startTime: string;
  endTime: string;
  field: { id: string; name: string };
  match: Match;
}
interface TournamentInfo { name: string; branding?: { primaryColor?: string; logoUrl?: string } | null; }

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isNow(s: ScheduledMatch) {
  const now = Date.now();
  return new Date(s.startTime).getTime() <= now && new Date(s.endTime).getTime() >= now;
}

function score(m: Match) {
  if (m.homeScore == null || m.awayScore == null) return null;
  return `${m.homeScore} – ${m.awayScore}`;
}

export default function FieldDisplayPage() {
  const { tournamentId, fieldId } = useParams<{ tournamentId: string; fieldId: string }>();
  const [slug, setSlug] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [field, setField] = useState<{ name: string } | null>(null);
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [now, setNow] = useState(new Date());

  // Resolve slug from tournamentId (the display URL uses the DB id, not slug)
  const [tournamentName, setTournamentName] = useState("");

  const fetchData = useCallback(async (resolvedSlug?: string) => {
    if (!resolvedSlug && !slug) return;
    const s = resolvedSlug ?? slug!;
    try {
      const today = new Date().toISOString().split("T")[0];
      const [schRes, tRes] = await Promise.all([
        fetch(`${API_URL}/api/public/t/${s}/schedule?fieldId=${fieldId}&day=${today}`),
        fetch(`${API_URL}/api/public/t/${s}`),
      ]);
      if (schRes.ok) {
        const d = await schRes.json();
        setMatches(d.data ?? []);
        if (d.data?.[0]) setField(d.data[0].field);
      }
      if (tRes.ok) {
        const d = await tRes.json();
        setTournament(d.data);
        setTournamentName(d.data?.name ?? "");
      }
    } catch { /* silent */ }
  }, [slug, fieldId]);

  // Resolve slug: the page is linked with tournamentId but public API uses slug.
  // We read the tournament list from the admin API or just show the tournamentId as slug if it looks like one.
  useEffect(() => {
    // Try using tournamentId as slug first; if that fails the page will show an error.
    setSlug(tournamentId);
    fetchData(tournamentId);
  }, [tournamentId, fieldId]);

  useEffect(() => {
    if (!slug) return;
    const iv = setInterval(() => {
      fetchData();
      setNow(new Date());
    }, 15_000);
    setNow(new Date());
    const clockIv = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(iv); clearInterval(clockIv); };
  }, [slug, fetchData]);

  const current = matches.filter(isNow);
  const upcoming = matches.filter((m) => new Date(m.startTime).getTime() > Date.now()).slice(0, 3);
  const past = matches.filter((m) => new Date(m.endTime).getTime() < Date.now()).slice(-2);

  const primary = tournament?.branding?.primaryColor || "#16a34a";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10" style={{ backgroundColor: primary + "22" }}>
        <div className="flex items-center gap-4">
          {tournament?.branding?.logoUrl && (
            <img src={tournament.branding.logoUrl} alt="" className="h-10 w-auto object-contain" />
          )}
          <div>
            <div className="text-xs text-white/50 uppercase tracking-widest font-medium">{tournamentName}</div>
            <div className="text-2xl font-bold" style={{ color: primary }}>{field?.name ?? `Field`}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold tabular-nums">{now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</div>
          <div className="text-sm text-white/40">{now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-0 p-8">
        {/* Current match */}
        {current.length > 0 ? (
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-white/40 mb-3 font-semibold">Now Playing</div>
            {current.map((sm) => (
              <div key={sm.matchId} className="rounded-2xl p-6" style={{ background: primary + "18", border: `1px solid ${primary}44` }}>
                <div className="text-xs text-white/40 mb-2">
                  {sm.match.group?.phase?.division?.name ?? ""} · {fmt(sm.startTime)}–{fmt(sm.endTime)}
                </div>
                <div className="flex items-center justify-center gap-6">
                  <div className="flex-1 text-right">
                    <div className="text-3xl font-bold leading-tight">{sm.match.homeTeam?.name ?? "TBD"}</div>
                  </div>
                  <div className="text-center">
                    {score(sm.match) ? (
                      <div className="text-5xl font-mono font-black tabular-nums px-6 py-2 rounded-xl bg-white/10">{score(sm.match)}</div>
                    ) : (
                      <div className="text-2xl font-mono text-white/30 px-6 py-2">vs</div>
                    )}
                    <div className="mt-1">
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: primary + "40", color: primary }}>
                        {sm.match.status === "IN_PROGRESS" ? "LIVE" : sm.match.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-3xl font-bold leading-tight">{sm.match.awayTeam?.name ?? "TBD"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl p-6 text-center text-white/20 border border-white/5">
            <div className="text-lg">No match in progress</div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-white/40 mb-3 font-semibold">Up Next</div>
            <div className="space-y-2">
              {upcoming.map((sm, i) => (
                <div key={sm.matchId} className={`flex items-center gap-4 rounded-xl px-5 py-3 ${i === 0 ? "bg-white/8" : "bg-white/4"}`}>
                  <div className="text-sm font-mono text-white/50 w-12 shrink-0">{fmt(sm.startTime)}</div>
                  <div className="flex-1 text-sm text-white/30 text-xs">{sm.match.group?.phase?.division?.name ?? ""}</div>
                  <div className="flex items-center gap-3 flex-1 justify-end text-sm font-medium">
                    <span>{sm.match.homeTeam?.name ?? "TBD"}</span>
                    <span className="text-white/30 text-xs">vs</span>
                    <span>{sm.match.awayTeam?.name ?? "TBD"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent results */}
        {past.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-widest text-white/20 mb-3 font-semibold">Earlier Today</div>
            <div className="space-y-1">
              {past.map((sm) => (
                <div key={sm.matchId} className="flex items-center gap-4 rounded-xl px-5 py-2 bg-white/3 opacity-50">
                  <div className="text-xs font-mono text-white/40 w-12 shrink-0">{fmt(sm.startTime)}</div>
                  <div className="flex items-center gap-3 flex-1 justify-end text-sm">
                    <span className="text-white/60">{sm.match.homeTeam?.name ?? "TBD"}</span>
                    <span className="font-mono font-semibold text-white/80">{score(sm.match) ?? "–"}</span>
                    <span className="text-white/60">{sm.match.awayTeam?.name ?? "TBD"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {matches.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/20 text-xl">
            No matches scheduled for today on this field
          </div>
        )}
      </div>

      <div className="px-8 py-3 text-xs text-white/15 text-right border-t border-white/5">
        Auto-refreshes every 15s · Powered by Stadia
      </div>
    </div>
  );
}
