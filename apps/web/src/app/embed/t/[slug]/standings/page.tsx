"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

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
interface Group { id: string; name: string; standings: Standing[]; }
interface Phase { id: string; name: string; type: string; groups: Group[]; }
interface Division { id: string; name: string; phases: Phase[]; }
interface Tournament {
  name: string;
  branding?: { primaryColor?: string; logoUrl?: string } | null;
  divisions: Division[];
}

function EmbedContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const divisionId = searchParams.get("division");
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
  const border = isDark ? "#1f2937" : "#e5e7eb";
  const textMain = isDark ? "#f9fafb" : "#111827";
  const textMuted = isDark ? "#9ca3af" : "#6b7280";
  const rowAlt = isDark ? "#1f2937" : "#f9fafb";
  const primary = tournament?.branding?.primaryColor ?? "#16a34a";

  if (loading) {
    return (
      <div style={{ fontFamily: "system-ui,sans-serif", padding: 16, color: textMuted, background: bg, minHeight: "100vh" }}>
        Loading…
      </div>
    );
  }

  if (!tournament) {
    return (
      <div style={{ fontFamily: "system-ui,sans-serif", padding: 16, color: textMuted, background: bg }}>
        Tournament not found
      </div>
    );
  }

  const targetDivision = divisionId
    ? tournament.divisions.find((d) => d.id === divisionId)
    : tournament.divisions[0];

  const groupStandings: { phaseName: string; groupName: string; standings: Standing[] }[] = [];
  if (targetDivision) {
    for (const phase of targetDivision.phases) {
      if (phase.type !== "GROUP_STAGE") continue;
      for (const group of phase.groups) {
        if (group.standings.length > 0) {
          groupStandings.push({ phaseName: phase.name, groupName: group.name, standings: group.standings });
        }
      }
    }
  }

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", background: bg, minHeight: "100%", padding: "12px 0" }}>
      {groupStandings.length === 0 ? (
        <div style={{ padding: 16, color: textMuted, textAlign: "center", fontSize: 13 }}>No standings yet</div>
      ) : (
        groupStandings.map((gs, gi) => (
          <div key={gi} style={{ marginBottom: 20 }}>
            <div style={{ padding: "4px 12px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: textMuted }}>
              {gs.groupName !== gs.phaseName ? `${gs.phaseName} · ${gs.groupName}` : gs.groupName}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: rowAlt }}>
                  {["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map((h, i) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: i <= 1 ? "left" : "center", color: textMuted, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gs.standings.map((row, i) => (
                  <tr key={row.position} style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? bg : rowAlt }}>
                    <td style={{ padding: "7px 8px", color: textMuted, textAlign: "center", width: 24 }}>{row.position}</td>
                    <td style={{ padding: "7px 8px", fontWeight: 600, color: textMain }}>{row.team.name}</td>
                    <td style={{ padding: "7px 8px", textAlign: "center", color: textMuted }}>{row.played}</td>
                    <td style={{ padding: "7px 8px", textAlign: "center", color: textMuted }}>{row.wins}</td>
                    <td style={{ padding: "7px 8px", textAlign: "center", color: textMuted }}>{row.draws}</td>
                    <td style={{ padding: "7px 8px", textAlign: "center", color: textMuted }}>{row.losses}</td>
                    <td style={{ padding: "7px 8px", textAlign: "center", color: textMuted }}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                    <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 800, color: primary }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

export default function EmbedStandingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: "#9ca3af", fontFamily: "system-ui,sans-serif" }}>Loading…</div>}>
      <EmbedContent />
    </Suspense>
  );
}
