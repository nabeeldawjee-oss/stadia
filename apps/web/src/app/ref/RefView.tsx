"use client";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ScoreEntryModal from "@/components/ScoreEntryModal";


interface Team { id: string; name: string; }
interface Match { id: string; homeTeam: Team | null; awayTeam: Team | null; homeScore: number | null; awayScore: number | null; status: string; scheduledMatch?: { startTime: string; field: { name: string } } | null; }
interface Assignment { id: string; role: string; match: Match; }
interface Referee { id: string; name: string; assignments: Assignment[]; }

function Whistle(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 9.8 8H12l-3 4H4.2A9.9 9.9 0 0 1 2 12z" />
      <path d="M12 14v4" /><circle cx="12" cy="20" r="2" />
    </svg>
  );
}

export default function RefView() {
  const params = useSearchParams();
  const token = params.get("token");
  const [scoring, setScoring] = useState<Match | null>(null);

  const { data: referee, error, mutate } = useSWR<Referee>(
    token ? `/api/ref?token=${token}` : null,
    () => apiFetch(`/api/ref?token=${token}`)
  );

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No token provided. Use the link sent by the tournament organizer.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Invalid or expired token.</p>
      </div>
    );
  }

  if (!referee) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const statusColor: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-600",
    IN_PROGRESS: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Whistle className="w-6 h-6 text-brand-700" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Hello, {referee.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Your assigned matches</p>
        </div>

        {referee.assignments.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No matches assigned yet.</div>
        ) : (
          <div className="space-y-3">
            {referee.assignments.map((a) => (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">
                    {a.match.scheduledMatch
                      ? `${new Date(a.match.scheduledMatch.startTime).toLocaleString()} · ${a.match.scheduledMatch.field.name}`
                      : "Not yet scheduled"}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[a.match.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {a.match.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <p className="font-semibold text-gray-900">{a.match.homeTeam?.name ?? "TBD"}</p>
                    {a.match.homeScore !== null && (
                      <p className="text-3xl font-bold text-gray-900 mt-1">{a.match.homeScore}</p>
                    )}
                  </div>
                  <div className="px-4 text-gray-300 font-bold">vs</div>
                  <div className="flex-1 text-center">
                    <p className="font-semibold text-gray-900">{a.match.awayTeam?.name ?? "TBD"}</p>
                    {a.match.awayScore !== null && (
                      <p className="text-3xl font-bold text-gray-900 mt-1">{a.match.awayScore}</p>
                    )}
                  </div>
                </div>
                {a.match.status !== "COMPLETED" && a.match.homeTeam && a.match.awayTeam && (
                  <button
                    onClick={() => setScoring(a.match)}
                    className="mt-3 w-full bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition"
                  >
                    Enter score
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {scoring && (
          <ScoreEntryModal
            match={scoring}
            onClose={() => setScoring(null)}
            onSaved={() => { setScoring(null); mutate(); }}
          />
        )}
      </div>
    </div>
  );
}
