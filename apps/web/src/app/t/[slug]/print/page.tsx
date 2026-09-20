"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ScheduledMatch {
  matchId: string;
  startTime: string;
  field: { name: string };
  match: {
    homeTeam: { name: string } | null;
    awayTeam: { name: string } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    group?: { name: string; phase: { name: string; division: { name: string } } } | null;
  };
}

interface Standing {
  position: number;
  team: { name: string };
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface Tournament {
  name: string;
  sport: string;
  branding?: { primaryColor?: string; logoUrl?: string } | null;
  divisions: {
    id: string;
    name: string;
    phases: {
      id: string;
      name: string;
      type: string;
      groups: { id: string; name: string; standings: Standing[] }[];
    }[];
  }[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function PrintPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"schedule" | "standings">("schedule");

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/public/t/${slug}`).then((r) => r.json()),
      fetch(`${API_URL}/api/public/t/${slug}/schedule`).then((r) => r.json()),
    ]).then(([t, s]) => {
      setTournament(t.data);
      setSchedule(s.data ?? []);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!tournament) return <div className="p-8 text-gray-500">Tournament not found.</div>;

  const primary = tournament.branding?.primaryColor ?? "#16a34a";

  const byDate: Record<string, ScheduledMatch[]> = {};
  schedule.forEach((sm) => {
    const d = new Date(sm.startTime).toISOString().split("T")[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(sm);
  });
  const sortedDates = Object.keys(byDate).sort();

  const groupStandings: { divName: string; phaseName: string; groupName: string; standings: Standing[] }[] = [];
  for (const div of tournament.divisions) {
    for (const phase of div.phases) {
      if (phase.type !== "GROUP_STAGE") continue;
      for (const group of phase.groups) {
        if (group.standings.length > 0) {
          groupStandings.push({ divName: div.name, phaseName: phase.name, groupName: group.name, standings: group.standings });
        }
      }
    }
  }

  return (
    <div className="bg-white min-h-screen font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; }
          table { page-break-inside: avoid; }
          .page-break { page-break-before: always; }
        }
        @media screen {
          body { background: #f3f4f6; }
          .print-wrapper { max-width: 800px; margin: 0 auto; background: white; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        }
      `}</style>

      <div className="print-wrapper">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 mb-6 border-b-2" style={{ borderColor: primary }}>
          {tournament.branding?.logoUrl && (
            <img src={tournament.branding.logoUrl} alt="" style={{ height: 48, objectFit: "contain" }} />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-sm text-gray-500">{tournament.sport}</p>
          </div>
          {/* Controls - hidden when printing */}
          <div className="no-print ml-auto flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setView("schedule")}
                className={`px-3 py-1.5 font-medium transition ${view === "schedule" ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                style={view === "schedule" ? { backgroundColor: primary } : {}}
              >
                Schedule
              </button>
              <button
                onClick={() => setView("standings")}
                className={`px-3 py-1.5 font-medium transition ${view === "standings" ? "text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                style={view === "standings" ? { backgroundColor: primary } : {}}
              >
                Standings
              </button>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              🖨 Print / Save PDF
            </button>
          </div>
        </div>

        {/* SCHEDULE VIEW */}
        {view === "schedule" && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Match Schedule</h2>
            {sortedDates.length === 0 ? (
              <p className="text-gray-400 text-sm">No matches scheduled yet.</p>
            ) : (
              sortedDates.map((date) => (
                <div key={date} className="mb-6">
                  <div className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">
                    {fmtDate(date)}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600, width: 56 }}>Time</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600, width: 80 }}>Field</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Home</th>
                        <th style={{ textAlign: "center", padding: "6px 4px", color: "#6b7280", fontWeight: 600, width: 60 }}>Score</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Away</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600, width: 80 }}>Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDate[date].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map((sm, i) => (
                        <tr key={sm.matchId} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#374151" }}>{fmtTime(sm.startTime)}</td>
                          <td style={{ padding: "6px 8px", color: "#6b7280", fontSize: 11 }}>{sm.field.name}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#111827" }}>{sm.match.homeTeam?.name ?? "TBD"}</td>
                          <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 700, color: "#374151" }}>
                            {sm.match.homeScore !== null ? `${sm.match.homeScore} – ${sm.match.awayScore}` : "–"}
                          </td>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#111827" }}>{sm.match.awayTeam?.name ?? "TBD"}</td>
                          <td style={{ padding: "6px 8px", color: "#9ca3af", fontSize: 10 }}>
                            {sm.match.group ? `${sm.match.group.phase.name} · ${sm.match.group.name}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}

        {/* STANDINGS VIEW */}
        {view === "standings" && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Standings</h2>
            {groupStandings.length === 0 ? (
              <p className="text-gray-400 text-sm">No standings available yet.</p>
            ) : (
              groupStandings.map((gs, gi) => (
                <div key={gi} className="mb-6">
                  <div className="text-sm font-bold text-gray-700 mb-2 pb-1 border-b border-gray-200">
                    {gs.phaseName} · {gs.groupName}
                    {groupStandings.some((s) => s.divName !== gs.divName) && (
                      <span className="text-gray-400 font-normal ml-2">({gs.divName})</span>
                    )}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: h === "Team" ? "left" : "center", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gs.standings.map((row, i) => (
                        <tr key={row.position} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#9ca3af" }}>{row.position}</td>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#111827" }}>{row.team.name}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.played}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.wins}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.draws}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.losses}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.goalsFor}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.goalsAgainst}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "#374151" }}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 800, color: primary }}>{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}

        <div className="no-print mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-300">
          Powered by Stadia · {tournament.name}
        </div>
      </div>
    </div>
  );
}
