"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Calendar, Clock, MapPin, Grid3x3, Plus, Trash2, MapPinned } from "lucide-react";
import { useState } from "react";
import ScheduleBoard from "./ScheduleBoard";

interface Field { id: string; name: string; orderIndex: number | null; }
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
  const [newFieldName, setNewFieldName] = useState("");
  const [addingField, setAddingField] = useState(false);

  const { data: fields, mutate: mutateFields } = useSWR<Field[]>(
    `/api/tournaments/${tournamentId}/fields`,
    () => api.get(`/api/tournaments/${tournamentId}/fields`)
  );

  const { data: scheduled } = useSWR<ScheduledMatch[]>(
    view === "list" ? `/api/tournaments/${tournamentId}/schedule` : null,
    () => api.get(`/api/tournaments/${tournamentId}/schedule`)
  );

  const addField = async () => {
    if (!newFieldName.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/fields`, { name: newFieldName.trim(), orderIndex: (fields?.length ?? 0) });
    await mutateFields();
    setNewFieldName("");
    setAddingField(false);
  };

  const deleteField = async (fieldId: string) => {
    if (!confirm("Delete this field? Any scheduled matches on it will be unscheduled.")) return;
    await api.delete(`/api/fields/${fieldId}`);
    await mutateFields();
  };

  const grouped: Record<string, ScheduledMatch[]> = {};
  for (const item of scheduled ?? []) {
    const day = item.startTime.slice(0, 10);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(item);
  }
  const days = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      {/* Fields management */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Fields / Venues</h3>
            {fields && <span className="text-xs text-gray-400">{fields.length} configured</span>}
          </div>
          <button
            onClick={() => setAddingField(true)}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add field
          </button>
        </div>

        {!fields || fields.length === 0 ? (
          <p className="text-xs text-gray-400">No fields yet. Add at least one field before scheduling matches.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {fields.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700">
                <MapPin className="w-3 h-3 text-gray-400" />
                {f.name}
                <button onClick={() => deleteField(f.id)} className="ml-1 text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {addingField && (
          <div className="flex items-center gap-2 mt-3">
            <input
              autoFocus
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addField(); if (e.key === "Escape") setAddingField(false); }}
              placeholder="Field name, e.g. Pitch A"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button onClick={addField} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition">Add</button>
            <button onClick={() => { setAddingField(false); setNewFieldName(""); }} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        )}
      </div>

      {/* Schedule view toggle */}
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
