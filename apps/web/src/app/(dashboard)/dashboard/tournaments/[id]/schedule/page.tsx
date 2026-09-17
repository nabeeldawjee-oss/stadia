"use client";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { Calendar, Clock, MapPin, Grid3x3 } from "lucide-react";
import { useState } from "react";
import ScheduleBoard from "./ScheduleBoard";

interface ScheduledMatch {
  id: string;
  startTime: string;
  endTime: string;
  field: { id: string; name: string };
  match: {
    id: string;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  };
}

type View = "list" | "board";

export default function SchedulePage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [view, setView] = useState<View>("list");

  const { data: scheduled } = useSWR<ScheduledMatch[]>(
    view === "list" ? `/api/tournaments/${tournamentId}/schedule` : null,
    () => apiFetch(`/api/tournaments/${tournamentId}/schedule`)
  );

  const grouped: Record<string, ScheduledMatch[]> = {};
  for (const item of scheduled ?? []) {
    const day = item.startTime.slice(0, 10);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(item);
  }
  const days = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              view === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("board")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              view === "board" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" /> Board
          </button>
        </div>
      </div>

      {view === "board" ? (
        <ScheduleBoard tournamentId={tournamentId} />
      ) : !scheduled ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading...</div>
      ) : scheduled.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No matches scheduled yet.</p>
          <p className="text-xs mt-1">Switch to Board view to drag matches onto the grid.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                {new Date(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <div className="space-y-2">
                {grouped[day].map((s) => (
                  <div key={s.id} className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-6">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-[80px]">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(s.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {s.field.name}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium text-gray-900 text-sm">{s.match.homeTeam?.name ?? "TBD"}</span>
                      <div className="px-4 text-center">
                        {s.match.homeScore !== null ? (
                          <span className="text-sm font-bold text-gray-900">
                            {s.match.homeScore} — {s.match.awayScore}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">vs</span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 text-sm text-right">{s.match.awayTeam?.name ?? "TBD"}</span>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.match.status === "COMPLETED" ? "bg-purple-100 text-purple-700" :
                      s.match.status === "IN_PROGRESS" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {s.match.status.replace("_", " ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
