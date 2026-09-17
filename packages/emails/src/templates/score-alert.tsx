import * as React from "react";

interface Props {
  tournamentName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  fieldName?: string;
  tournamentSlug: string;
  webBaseUrl: string;
}

export function ScoreAlertEmail({
  tournamentName,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  fieldName,
  tournamentSlug,
  webBaseUrl,
}: Props) {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "0 auto", padding: 32 }}>
      <p style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{tournamentName}</p>
      <h1 style={{ fontSize: 20, color: "#111827", margin: "8px 0" }}>Match Result</h1>
      <div style={{ background: "#f9fafb", borderRadius: 12, padding: 24, textAlign: "center", margin: "16px 0" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{homeTeam}</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#0284c7" }}>{homeScore} – {awayScore}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{awayTeam}</span>
        </div>
        {fieldName && <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>{fieldName}</p>}
      </div>
      <a
        href={`${webBaseUrl}/t/${tournamentSlug}`}
        style={{ display: "inline-block", background: "#0284c7", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14 }}
      >
        View standings →
      </a>
    </div>
  );
}
