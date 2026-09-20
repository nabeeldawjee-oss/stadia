"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Match {
  id: string;
  roundNumber: number | null;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}
interface Bracket { id: string; size: number; matches: Match[]; }
interface Phase { id: string; name: string; type: string; brackets: Bracket[]; }
interface Division { id: string; name: string; phases: Phase[]; }
interface Tournament {
  name: string;
  branding?: { primaryColor?: string } | null;
  divisions: Division[];
}

function EmbedContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const theme = searchParams.get("theme") ?? "light";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/t/${slug}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        setTournament(data.data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [slug]);

  const isDark = theme === "dark";
  const bg = isDark ? "#111827" : "#ffffff";
  const border = isDark ? "#374151" : "#e5e7eb";
  const textMain = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#9ca3af";
  const cardBg = isDark ? "#1f2937" : "#f9fafb";
  const primary = tournament?.branding?.primaryColor ?? "#16a34a";

  if (loading) {
    return <div style={{ fontFamily: "system-ui,sans-serif", padding: 16, color: textMuted, background: bg, minHeight: "100vh" }}>Loading…</div>;
  }
  if (!tournament) {
    return <div style={{ fontFamily: "system-ui,sans-serif", padding: 16, color: textMuted, background: bg }}>Tournament not found</div>;
  }

  const allBrackets: { divName: string; phaseName: string; bracket: Bracket }[] = [];
  for (const div of tournament.divisions) {
    for (const phase of div.phases) {
      if (phase.type !== "KNOCKOUT") continue;
      for (const bracket of phase.brackets) {
        allBrackets.push({ divName: div.name, phaseName: phase.name, bracket });
      }
    }
  }

  if (allBrackets.length === 0) {
    return <div style={{ fontFamily: "system-ui,sans-serif", padding: 16, color: textMuted, background: bg, textAlign: "center", fontSize: 13 }}>No bracket yet</div>;
  }

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", background: bg, minHeight: "100%", overflowX: "auto", padding: "12px 0" }}>
      {allBrackets.map(({ divName, phaseName, bracket }, bi) => {
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
          if (rem === 2) return "Semis";
          if (rem === 3) return "QFs";
          return `R${r}`;
        };

        return (
          <div key={bi} style={{ marginBottom: 20, padding: "0 12px" }}>
            {allBrackets.length > 1 && (
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: textMuted, marginBottom: 8 }}>
                {phaseName}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
              {rounds.map((r) => {
                const isLast = r === totalRounds;
                const matchesInRound = bracket.size / Math.pow(2, r);
                const matches = matchByRound[r] ?? [];
                const cards = matches.length > 0
                  ? matches
                  : Array.from({ length: matchesInRound }, (_, i) => ({ id: `ph-${r}-${i}`, roundNumber: r, homeTeam: null, awayTeam: null, homeScore: null, awayScore: null, status: "PENDING" } as Match));

                return (
                  <div key={r} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
                    <div style={{ textAlign: "center", padding: "2px 6px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 20, background: isLast ? "#fef3c7" : cardBg, color: isLast ? "#92400e" : textMuted }}>
                        {roundLabel(r)}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, justifyContent: "space-around" }}>
                      {cards.map((m) => {
                        const hasScore = m.homeScore !== null;
                        const homeWins = hasScore && m.homeScore! > m.awayScore!;
                        const awayWins = hasScore && m.awayScore! > m.homeScore!;
                        return (
                          <div key={m.id} style={{ borderRadius: 10, border: `1px solid ${isLast ? "#fde68a" : border}`, overflow: "hidden" }}>
                            {[
                              { team: m.homeTeam, score: m.homeScore, wins: homeWins },
                              { team: m.awayTeam, score: m.awayScore, wins: awayWins },
                            ].map((row, i) => (
                              <div key={i} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "6px 10px",
                                borderTop: i === 1 ? `1px solid ${border}` : undefined,
                                background: row.wins ? (isLast ? "#fffbeb" : isDark ? "#064e3b" : "#f0fdf4") : bg,
                              }}>
                                <span style={{ fontSize: 12, fontWeight: row.wins ? 700 : 400, color: row.wins ? primary : (m.homeTeam || m.awayTeam ? textMain : textMuted), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
                                  {row.team?.name ?? "TBD"}
                                </span>
                                {row.score !== null && (
                                  <span style={{ fontSize: 13, fontWeight: 900, color: row.wins ? primary : textMuted, marginLeft: 6 }}>
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
      })}
    </div>
  );
}

export default function EmbedBracketPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "#9ca3af", fontFamily: "system-ui,sans-serif" }}>Loading…</div>}>
      <EmbedContent />
    </Suspense>
  );
}
