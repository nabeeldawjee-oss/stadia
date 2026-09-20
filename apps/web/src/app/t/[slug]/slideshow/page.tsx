"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Standing { position: number; team: { name: string }; played: number; wins: number; draws: number; losses: number; goalDifference: number; points: number; }
interface Post { id: string; title: string; body: string; }
interface SlideshowData { name: string; sport: string; branding?: { primaryColor?: string; logoUrl?: string }; slideshow?: { autoPlaySeconds?: number; theme?: string; showStandings?: boolean; showPosts?: boolean }; posts: Post[]; divisions: any[]; }

type Slide = { type: "standings"; groupName: string; standings: Standing[] } | { type: "post"; post: Post } | { type: "welcome"; tournament: SlideshowData };

export default function SlideshowPage() {
  const params = useParams<{ slug: string }>();
  const [data, setData] = useState<SlideshowData | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch(`${API_URL}/api/public/t/${params.slug}/slideshow`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.data as SlideshowData;
        setData(t);
        const built: Slide[] = [{ type: "welcome", tournament: t }];
        if (t.slideshow?.showStandings !== false) {
          for (const div of t.divisions ?? []) {
            for (const phase of div.phases ?? []) {
              for (const group of phase.groups ?? []) {
                if (group.standings?.length > 0) {
                  built.push({ type: "standings", groupName: group.name, standings: group.standings });
                }
              }
            }
          }
        }
        if (t.slideshow?.showPosts !== false) {
          for (const post of t.posts ?? []) {
            built.push({ type: "post", post });
          }
        }
        setSlides(built);
      });
  }, [params.slug]);

  useEffect(() => {
    if (slides.length < 2) return;
    const secs = data?.slideshow?.autoPlaySeconds ?? 8;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, secs * 1000);
    return () => clearInterval(interval);
  }, [slides, data]);

  const isDark = data?.slideshow?.theme === "dark";
  const primary = data?.branding?.primaryColor ?? "#0284c7";

  const bg = isDark ? "#0f172a" : "#f9fafb";
  const text = isDark ? "#f1f5f9" : "#111827";
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const muted = isDark ? "#94a3b8" : "#6b7280";

  if (!data || slides.length === 0) {
    return <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: muted }}>Loading...</div>;
  }

  const slide = slides[current];

  return (
    <div style={{ background: bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", color: text }}>
      {/* Header bar */}
      <div style={{ background: primary, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {data.branding?.logoUrl && <img src={data.branding.logoUrl} style={{ height: 36, objectFit: "contain" }} />}
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>{data.name}</span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>{data.sport}</span>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        {slide.type === "welcome" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, fontWeight: 900, color: primary, marginBottom: 16 }}>{data.name}</div>
            <div style={{ fontSize: 24, color: muted }}>{data.sport}</div>
          </div>
        )}

        {slide.type === "standings" && (
          <div style={{ background: cardBg, borderRadius: 20, padding: 32, minWidth: 600, maxWidth: 900, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: text }}>{slide.groupName} — Standings</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Team" ? "left" : "center", padding: "8px 12px", fontSize: 13, color: muted, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.standings.map((row, i) => (
                  <tr key={row.position} style={{ borderTop: `1px solid ${isDark ? "#334155" : "#f3f4f6"}` }}>
                    <td style={{ padding: "10px 12px", color: muted, textAlign: "center" }}>{row.position}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: 16 }}>{row.team.name}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{row.played}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{row.wins}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{row.draws}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{row.losses}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: 18, color: primary }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {slide.type === "post" && (
          <div style={{ background: cardBg, borderRadius: 20, padding: 48, maxWidth: 700, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16, color: text }}>{slide.post.title}</h2>
            <p style={{ fontSize: 18, color: muted, lineHeight: 1.6 }}>{slide.post.body}</p>
          </div>
        )}
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 24 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{ width: i === current ? 24 : 8, height: 8, borderRadius: 4, background: i === current ? primary : muted, border: "none", cursor: "pointer", transition: "width 0.2s" }}
          />
        ))}
      </div>
    </div>
  );
}
