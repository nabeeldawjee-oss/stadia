import * as React from "react";

interface Props {
  tournamentName: string;
  teamName: string;
  contactName: string;
  entryFee: number;
  currency: string;
  tournamentSlug: string;
  webBaseUrl: string;
}

export function RegistrationConfirmEmail({
  tournamentName,
  teamName,
  contactName,
  entryFee,
  currency,
  tournamentSlug,
  webBaseUrl,
}: Props) {
  const publicUrl = `${webBaseUrl}/t/${tournamentSlug}`;
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "0 auto", padding: 32 }}>
      <h1 style={{ color: "#0284c7", fontSize: 24, marginBottom: 8 }}>Registration Confirmed</h1>
      <p style={{ color: "#374151" }}>Hi {contactName},</p>
      <p style={{ color: "#374151" }}>
        <strong>{teamName}</strong> has been successfully registered for <strong>{tournamentName}</strong>.
      </p>
      {entryFee > 0 && (
        <p style={{ color: "#374151" }}>
          Entry fee paid: <strong>${entryFee} {currency}</strong>
        </p>
      )}
      <a
        href={publicUrl}
        style={{ display: "inline-block", background: "#0284c7", color: "#fff", padding: "12px 24px", borderRadius: 8, textDecoration: "none", marginTop: 16, fontWeight: 600 }}
      >
        View tournament →
      </a>
      <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 32 }}>
        Stadia · Tournament Management Platform
      </p>
    </div>
  );
}
