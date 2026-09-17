import * as React from "react";

interface Props {
  tournamentName: string;
  title: string;
  message: string;
  tournamentSlug: string;
  webBaseUrl: string;
}

export function AnnouncementEmail({ tournamentName, title, message, tournamentSlug, webBaseUrl }: Props) {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "0 auto", padding: 32 }}>
      <p style={{ color: "#9ca3af", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{tournamentName}</p>
      <h1 style={{ fontSize: 22, color: "#111827", margin: "8px 0 16px" }}>{title}</h1>
      <p style={{ color: "#374151", lineHeight: 1.6 }}>{message}</p>
      <a
        href={`${webBaseUrl}/t/${tournamentSlug}`}
        style={{ display: "inline-block", background: "#0284c7", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 14, marginTop: 16 }}
      >
        View tournament →
      </a>
    </div>
  );
}
