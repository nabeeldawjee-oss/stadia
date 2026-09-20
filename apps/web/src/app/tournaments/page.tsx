"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Tournament {
  id: string;
  name: string;
  slug: string;
  sport: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  branding: { primaryColor: string | null; logoUrl: string | null } | null;
  _count: { teams: number };
}

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Upcoming",
  ACTIVE: "Live",
  COMPLETED: "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

function fmtDateRange(start: string | null, end: string | null) {
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [allSports, setAllSports] = useState<string[]>([]);

  const load = useCallback(async (query: string, sportFilter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (sportFilter) params.set("sport", sportFilter);
      const res = await fetch(`${API_URL}/api/public/tournaments?${params}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const list: Tournament[] = data.data ?? [];
      setTournaments(list);
      if (!sportFilter && !query) {
        const sports = Array.from(new Set(list.map((t) => t.sport))).sort();
        setAllSports(sports);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(q, sport); }, [q, sport, load]);

  const live = tournaments.filter((t) => t.status === "ACTIVE");
  const upcoming = tournaments.filter((t) => t.status === "PUBLISHED");
  const completed = tournaments.filter((t) => t.status === "COMPLETED");

  const groups = [
    { label: "Live now", items: live },
    { label: "Upcoming", items: upcoming },
    { label: "Completed", items: completed },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tight text-gray-900">Stadia</Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Sign in</Link>
            <Link href="/sign-up" className="text-sm font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition">Get started free</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-1">Tournaments</h1>
          <p className="text-gray-500">Browse all public tournaments on Stadia</p>
        </div>

        {/* Search + filters */}
        <div className="flex gap-3 mb-8 flex-wrap">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tournaments…"
            className="flex-1 min-w-48 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          {allSports.length > 1 && (
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">All sports</option>
              {allSports.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 font-medium">No tournaments found</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search, or <Link href="/sign-up" className="text-green-600 underline">create one</Link>.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map(({ label, items }) => (
              <div key={label}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">{label}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((t) => {
                    const primary = t.branding?.primaryColor ?? "#16a34a";
                    const dateRange = fmtDateRange(t.startDate, t.endDate);
                    return (
                      <Link
                        key={t.id}
                        href={`/t/${t.slug}`}
                        className="block bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition group"
                      >
                        {/* Color band */}
                        <div className="h-1.5" style={{ background: primary }} />
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-green-700 transition">{t.name}</h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {STATUS_LABEL[t.status] ?? t.status}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-700">{t.sport}</span>
                              <span>·</span>
                              <span>{t._count.teams} team{t._count.teams !== 1 ? "s" : ""}</span>
                            </div>
                            {dateRange && <div>{dateRange}</div>}
                            {t.description && (
                              <p className="text-gray-400 line-clamp-2 mt-1">{t.description}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
