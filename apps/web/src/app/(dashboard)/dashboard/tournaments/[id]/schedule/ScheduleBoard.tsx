"use client";
import { useState } from "react";
import useSWR from "swr";
import { apiFetch, api } from "@/lib/api";
import { GripVertical, Clock, X } from "lucide-react";

interface Field { id: string; name: string; }
interface Match {
  id: string;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
  status: string;
}
interface ScheduledMatch {
  id: string;
  startTime: string;
  field: { id: string; name: string };
  match: {
    id: string;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
    status: string;
  };
}
interface Slot { time: string; label: string; }

const TIME_SLOTS: Slot[] = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? "00" : "30";
  const hour = h > 12 ? h - 12 : h;
  const ampm = h >= 12 ? "PM" : "AM";
  return { time: `${String(h).padStart(2, "0")}:${m}`, label: `${hour}:${m} ${ampm}` };
});

function toUTCHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

interface Props { tournamentId: string; }

export default function ScheduleBoard({ tournamentId }: Props) {
  const { data: fields } = useSWR<Field[]>(
    `/api/tournaments/${tournamentId}/fields`,
    () => apiFetch(`/api/tournaments/${tournamentId}/fields`)
  );
  const { data: matches, mutate: mutateUnscheduled } = useSWR<Match[]>(
    `/api/tournaments/${tournamentId}/matches/unscheduled`,
    () => apiFetch(`/api/tournaments/${tournamentId}/matches/unscheduled`)
  );

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dragging, setDragging] = useState<Match | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: scheduled, mutate: mutateScheduled } = useSWR<ScheduledMatch[]>(
    `/api/tournaments/${tournamentId}/schedule?day=${date}`,
    () => apiFetch(`/api/tournaments/${tournamentId}/schedule?day=${date}`)
  );

  const mutate = async () => {
    await Promise.all([mutateUnscheduled(), mutateScheduled()]);
  };

  const drop = async (fieldId: string, slotTime: string) => {
    if (!dragging) return;
    setSaving(`${fieldId}-${slotTime}`);
    try {
      await api.post(`/api/matches/${dragging.id}/schedule`, {
        fieldId,
        startTime: new Date(`${date}T${slotTime}:00Z`).toISOString(),
      });
      await mutate();
    } finally {
      setSaving(null);
      setDragging(null);
    }
  };

  const unschedule = async (matchId: string) => {
    await api.delete(`/api/matches/${matchId}/schedule`);
    await mutate();
  };

  return (
    <div className="flex gap-6">
      {/* Unscheduled pool */}
      <div className="w-52 shrink-0">
        <div className="sticky top-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Unscheduled
          </h3>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {!matches || matches.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">All matches scheduled</p>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={() => setDragging(m)}
                  onDragEnd={() => setDragging(null)}
                  className="bg-white border border-gray-200 rounded-xl p-2.5 cursor-grab shadow-sm hover:shadow-md transition select-none"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {m.homeTeam?.name ?? "TBD"}
                    </span>
                  </div>
                  <div className="pl-4 text-xs text-gray-400">vs {m.awayTeam?.name ?? "TBD"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {!fields || fields.length === 0 ? (
          <div className="text-gray-400 text-sm">No fields configured. Add fields in tournament settings.</div>
        ) : (
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Header row */}
            <div className="grid" style={{ gridTemplateColumns: `80px repeat(${fields.length}, 1fr)` }}>
              <div className="bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</div>
              {fields.map((f) => (
                <div key={f.id} className="bg-gray-50 border-b border-r last:border-r-0 border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 text-center">
                  {f.name}
                </div>
              ))}
            </div>

            {/* Time slot rows */}
            {TIME_SLOTS.map((slot) => (
              <div
                key={slot.time}
                className="grid border-b last:border-b-0 border-gray-100"
                style={{ gridTemplateColumns: `80px repeat(${fields.length}, 1fr)` }}
              >
                <div className="border-r border-gray-100 px-3 py-2 text-xs text-gray-400 font-medium leading-none self-center">
                  {slot.label}
                </div>
                {fields.map((f) => {
                  const isTarget = saving === `${f.id}-${slot.time}`;
                  const scheduledHere = scheduled?.find(
                    (s) => s.field.id === f.id && toUTCHHMM(s.startTime) === slot.time
                  );
                  return (
                    <div
                      key={f.id}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={() => !scheduledHere && drop(f.id, slot.time)}
                      className={`border-r last:border-r-0 border-gray-100 min-h-[48px] relative transition ${
                        dragging && !scheduledHere ? "bg-brand-50/30 hover:bg-brand-50" : ""
                      } ${isTarget ? "bg-brand-100" : ""}`}
                    >
                      {isTarget && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-600 font-medium">
                          Saving...
                        </div>
                      )}
                      {scheduledHere && !isTarget && (
                        <div className={`m-1 rounded-lg px-2 py-1.5 text-xs leading-tight relative group ${
                          scheduledHere.match.status === "COMPLETED" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                          scheduledHere.match.status === "IN_PROGRESS" ? "bg-green-50 text-green-700 border border-green-200" :
                          "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          <div className="font-medium truncate">{scheduledHere.match.homeTeam?.name ?? "TBD"}</div>
                          <div className="text-center opacity-60 text-[10px]">vs</div>
                          <div className="font-medium truncate">{scheduledHere.match.awayTeam?.name ?? "TBD"}</div>
                          {scheduledHere.match.status === "SCHEDULED" && (
                            <button
                              onClick={() => unschedule(scheduledHere.match.id)}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-500"
                              title="Unschedule"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
