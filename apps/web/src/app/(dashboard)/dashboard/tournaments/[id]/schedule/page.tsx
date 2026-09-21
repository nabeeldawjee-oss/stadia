"use client";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { Calendar, Clock, MapPin, Grid3x3, Plus, Trash2, MapPinned, Zap, ChevronDown, ChevronUp, ExternalLink, RotateCcw, Pencil, PauseCircle, Ban, RotateCw } from "lucide-react";
import { useState, useMemo } from "react";
import ScheduleBoard from "./ScheduleBoard";
import ScoreEntryModal from "@/components/ScoreEntryModal";

interface Field { id: string; name: string; orderIndex: number | null; }
interface Group { id: string; name: string; _count?: { teams: number }; }
interface Bracket { id: string; size: number; }
interface Phase {
  id: string;
  name: string;
  type: string;
  divisionName: string;
  divisionId: string;
  divisionMatchDurationMinutes: number;
  divisionHalfDurationMinutes: number;
  groups: Group[];
  brackets: Bracket[];
}
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

type View = "list" | "board" | "matrix";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function MatrixView({ scheduled, fields }: { scheduled: ScheduledMatch[]; fields: Field[] }) {
  if (!scheduled.length) return (
    <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-200 rounded-2xl">
      No matches scheduled yet.
    </div>
  );

  // Group by day
  const days: string[] = [...new Set(scheduled.map((s) => s.startTime.slice(0, 10)))].sort();

  return (
    <div className="space-y-6">
      {days.map((day) => {
        const dayMatches = scheduled.filter((s) => s.startTime.slice(0, 10) === day);
        // Collect unique time slots
        const slots = [...new Set(dayMatches.map((s) => s.startTime))].sort();
        // Collect only fields that appear on this day
        const dayFieldIds = [...new Set(dayMatches.map((s) => s.field.id))];
        const orderedFields = fields.filter((f) => dayFieldIds.includes(f.id));

        return (
          <div key={day}>
            <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">{fmtDate(day)}</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-max">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500 border-r border-gray-100 w-16">Time</th>
                    {orderedFields.map((f) => (
                      <th key={f.id} className="px-3 py-2 text-center font-medium text-gray-700 border-r border-gray-100 last:border-r-0 min-w-[140px]">{f.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => {
                    const slotMatches = dayMatches.filter((s) => s.startTime === slot);
                    return (
                      <tr key={slot} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-400 border-r border-gray-100 whitespace-nowrap">{fmtTime(slot)}</td>
                        {orderedFields.map((f) => {
                          const m = slotMatches.find((s) => s.field.id === f.id);
                          return (
                            <td key={f.id} className="px-2 py-1.5 border-r border-gray-100 last:border-r-0 text-center">
                              {m ? (
                                <div className={`rounded-lg px-2 py-1.5 text-xs leading-tight ${
                                  m.match.status === "COMPLETED" ? "bg-purple-50 text-purple-700" :
                                  m.match.status === "IN_PROGRESS" ? "bg-green-50 text-green-700" :
                                  "bg-blue-50 text-blue-700"
                                }`}>
                                  <div className="font-medium">{m.match.homeTeam?.name ?? "TBD"}</div>
                                  {m.match.homeScore != null
                                    ? <div className="font-bold">{m.match.homeScore} – {m.match.awayScore}</div>
                                    : <div className="text-gray-400">vs</div>}
                                  <div className="font-medium">{m.match.awayTeam?.name ?? "TBD"}</div>
                                </div>
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulePage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { mutate: globalMutate } = useSWRConfig();
  const [view, setView] = useState<View>("list");
  const [newFieldName, setNewFieldName] = useState("");
  const [addingField, setAddingField] = useState(false);

  // Auto-schedule panel
  const [autoOpen, setAutoOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedBrackets, setSelectedBrackets] = useState<Set<string>>(new Set());
  const [matchDay, setMatchDay] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [slotDuration, setSlotDuration] = useState("90");
  const [restMinutes, setRestMinutes] = useState("60");
  const [autoRunning, setAutoRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [breaksOpen, setBreaksOpen] = useState(false);
  const [newBreak, setNewBreak] = useState({ label: "", date: new Date().toISOString().split("T")[0], startTime: "12:00", endTime: "13:00", fieldId: "" });
  const [scoringMatch, setScoringMatch] = useState<{ id: string; homeTeam: { id: string; name: string } | null; awayTeam: { id: string; name: string } | null; status: string } | null>(null);
  const [autoResult, setAutoResult] = useState<{ scheduled: number; unscheduled: number } | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotFieldId, setSlotFieldId] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);

  const { data: fields, mutate: mutateFields } = useSWR<Field[]>(
    `/api/tournaments/${tournamentId}/fields`,
    () => api.get(`/api/tournaments/${tournamentId}/fields`)
  );

  const { data: phases } = useSWR<Phase[]>(
    `/api/tournaments/${tournamentId}/phases`,
    () => api.get(`/api/tournaments/${tournamentId}/phases`)
  );

  interface BreakBlock { id: string; label: string; startTime: string; endTime: string; field?: { name: string } | null; }
  const { data: breakBlocks, mutate: mutateBreaks } = useSWR<BreakBlock[]>(
    `/api/tournaments/${tournamentId}/break-blocks`,
    () => api.get(`/api/tournaments/${tournamentId}/break-blocks`)
  );

  const { data: scheduled, mutate: mutateScheduled } = useSWR<ScheduledMatch[]>(
    view !== "board" ? `/api/tournaments/${tournamentId}/schedule` : null,
    () => api.get(`/api/tournaments/${tournamentId}/schedule`)
  );

  // Derive default slot duration from selected groups' divisions
  const suggestedSlotDuration = useMemo(() => {
    if (!phases || selectedGroups.size === 0) return null;
    const selectedPhase = phases.find((p) => p.groups.some((g) => selectedGroups.has(g.id)));
    return selectedPhase?.divisionMatchDurationMinutes ?? null;
  }, [phases, selectedGroups]);

  const addField = async () => {
    if (!newFieldName.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/fields`, { name: newFieldName.trim(), orderIndex: (fields?.length ?? 0) });
    await mutateFields();
    setNewFieldName("");
    setAddingField(false);
  };

  const addBreak = async () => {
    if (!newBreak.label.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/break-blocks`, {
      label: newBreak.label, date: newBreak.date, startTime: newBreak.startTime, endTime: newBreak.endTime,
      fieldId: newBreak.fieldId || undefined,
    });
    await mutateBreaks();
    setNewBreak({ label: "", date: new Date().toISOString().split("T")[0], startTime: "12:00", endTime: "13:00", fieldId: "" });
  };

  const deleteBreak = async (id: string) => {
    await api.delete(`/api/break-blocks/${id}`);
    await mutateBreaks();
  };

  const setMatchStatus = async (matchId: string, status: "CANCELLED" | "SCHEDULED") => {
    if (status === "CANCELLED" && !confirm("Cancel this match? The slot stays in the schedule but the match will be marked cancelled.")) return;
    setChangingStatus(matchId);
    try {
      await api.put(`/api/matches/${matchId}/status`, { status });
      await mutateScheduled();
    } catch (err: any) {
      alert(err.message || "Failed to update match status");
    } finally {
      setChangingStatus(null);
    }
  };

  const openSlotEdit = (s: ScheduledMatch) => {
    const dt = new Date(s.startTime);
    setSlotDate(s.startTime.slice(0, 10));
    setSlotTime(dt.toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }));
    setSlotFieldId(s.field.id);
    setEditingSlot(s.id);
  };

  const saveSlot = async (matchId: string, existingStart: string, existingEnd: string) => {
    setSavingSlot(true);
    try {
      const startIso = `${slotDate}T${slotTime}:00.000Z`;
      const durationMs = new Date(existingEnd).getTime() - new Date(existingStart).getTime();
      const slotDurationMinutes = Math.round(durationMs / 60000) || 90;
      await api.put(`/api/matches/${matchId}/slot`, { fieldId: slotFieldId, startTime: startIso, slotDurationMinutes });
      setEditingSlot(null);
      await mutateScheduled();
    } catch (err: any) {
      alert(err.message || "Failed to reschedule");
    } finally {
      setSavingSlot(false);
    }
  };

  const deleteField = async (fieldId: string) => {
    if (!confirm("Delete this field? Any scheduled matches on it will be unscheduled.")) return;
    await api.delete(`/api/fields/${fieldId}`);
    await mutateFields();
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleBracket = (id: string) => {
    setSelectedBrackets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetSchedule = async () => {
    if (!confirm("Reset the entire schedule? All match assignments will be cleared and matches returned to unscheduled. This cannot be undone.")) return;
    setResetting(true);
    try {
      await api.delete(`/api/tournaments/${tournamentId}/schedule`);
      // Invalidate all SWR cache entries for this tournament so the board, list, and matrix all refresh
      await globalMutate((key: unknown) => typeof key === "string" && key.includes(tournamentId));
    } catch (err: any) {
      alert(err.message || "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const runAutoSchedule = async () => {
    setAutoRunning(true);
    setAutoResult(null);
    setAutoError(null);
    try {
      const result = await api.post<{ scheduled: number; unscheduled: number }>(
        `/api/tournaments/${tournamentId}/schedule/auto`,
        {
          groupIds: selectedGroups.size > 0 ? Array.from(selectedGroups) : undefined,
          bracketIds: selectedBrackets.size > 0 ? Array.from(selectedBrackets) : undefined,
          matchDay,
          startTime,
          slotDurationMinutes: parseInt(slotDuration, 10),
          restMinutesBetweenSameTeam: parseInt(restMinutes, 10),
        }
      );
      setAutoResult(result);
      await mutateScheduled();
    } catch (err: any) {
      setAutoError(err.message);
    } finally {
      setAutoRunning(false);
    }
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

      {/* Break blocks */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setBreaksOpen((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-gray-900">Break blocks</span>
            <span className="text-xs text-gray-400">Lunch, prayer time, or other gaps in the schedule</span>
            {breakBlocks && breakBlocks.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{breakBlocks.length}</span>
            )}
          </div>
          {breaksOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {breaksOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
            {/* Existing breaks */}
            {breakBlocks && breakBlocks.length > 0 && (
              <div className="space-y-1.5">
                {breakBlocks.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-sm">
                    <PauseCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-medium text-orange-900">{b.label}</span>
                    <span className="text-orange-600 text-xs font-mono">
                      {new Date(b.startTime).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                      {" – "}
                      {new Date(b.endTime).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    {b.field && <span className="text-orange-400 text-xs">{b.field.name}</span>}
                    <button onClick={() => deleteBreak(b.id)} className="ml-auto text-orange-300 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new break */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Add break</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input value={newBreak.label} onChange={(e) => setNewBreak({ ...newBreak, label: e.target.value })} placeholder="e.g. Lunch break" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input type="date" value={newBreak.date} onChange={(e) => setNewBreak({ ...newBreak, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Field (optional)</label>
                  <select value={newBreak.fieldId} onChange={(e) => setNewBreak({ ...newBreak, fieldId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">All fields</option>
                    {(fields ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input type="time" value={newBreak.startTime} onChange={(e) => setNewBreak({ ...newBreak, startTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Until</label>
                  <input type="time" value={newBreak.endTime} onChange={(e) => setNewBreak({ ...newBreak, endTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <button onClick={addBreak} disabled={!newBreak.label.trim()} className="mt-3 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 transition">
                Add break block
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auto-schedule panel */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => { setAutoOpen((v) => !v); setAutoResult(null); setAutoError(null); }}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-900">Auto-schedule</span>
            <span className="text-xs text-gray-400">Assign matches to fields with equal rest time</span>
          </div>
          {autoOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {autoOpen && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-5">
            {/* Group / bracket selection */}
            {!phases || phases.length === 0 ? (
              <p className="text-xs text-gray-400">No phases found. Set up divisions and phases in the Format tab first.</p>
            ) : (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Select groups / brackets to schedule</p>
                <div className="space-y-3">
                  {phases.map((phase) => (
                    <div key={phase.id}>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        {phase.divisionName} › {phase.name}
                        <span className="ml-2 text-gray-400">({phase.divisionMatchDurationMinutes} min match · {phase.divisionHalfDurationMinutes} min halves)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {phase.type === "GROUP_STAGE" && phase.groups.map((g) => (
                          <label key={g.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${selectedGroups.has(g.id) ? "bg-brand-50 border-brand-400 text-brand-700 font-medium" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                            <input type="checkbox" className="sr-only" checked={selectedGroups.has(g.id)} onChange={() => toggleGroup(g.id)} />
                            {g.name}
                            {g._count && <span className="text-gray-400">{g._count.teams} teams</span>}
                          </label>
                        ))}
                        {phase.type === "KNOCKOUT" && phase.brackets.map((b) => (
                          <label key={b.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition ${selectedBrackets.has(b.id) ? "bg-brand-50 border-brand-400 text-brand-700 font-medium" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                            <input type="checkbox" className="sr-only" checked={selectedBrackets.has(b.id)} onChange={() => toggleBracket(b.id)} />
                            {b.size}-team bracket
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule parameters */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Match day</label>
                <input
                  type="date"
                  value={matchDay}
                  onChange={(e) => setMatchDay(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Slot duration (min)
                  {suggestedSlotDuration && parseInt(slotDuration, 10) !== suggestedSlotDuration && (
                    <button onClick={() => setSlotDuration(String(suggestedSlotDuration))} className="ml-2 text-brand-500 hover:text-brand-700 text-xs underline">
                      Use {suggestedSlotDuration}
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min rest per team (min)</label>
                <input
                  type="number"
                  min={0}
                  max={480}
                  value={restMinutes}
                  onChange={(e) => setRestMinutes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {autoError && <p className="text-red-500 text-sm">{autoError}</p>}

            {autoResult && (
              <div className={`text-sm rounded-xl px-4 py-3 ${autoResult.unscheduled > 0 ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
                {autoResult.scheduled} match{autoResult.scheduled !== 1 ? "es" : ""} scheduled.
                {autoResult.unscheduled > 0 && ` ${autoResult.unscheduled} could not be placed — use the Board to assign them manually.`}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={runAutoSchedule}
                disabled={autoRunning || (selectedGroups.size === 0 && selectedBrackets.size === 0)}
                className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-40 transition"
              >
                <Zap className="w-4 h-4" />
                {autoRunning ? "Scheduling..." : "Run auto-schedule"}
              </button>
              <p className="text-xs text-gray-400">
                Only unscheduled matches are placed. Existing schedule is kept.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Field display links */}
      {fields && fields.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Field display screens</h3>
            <span className="text-xs text-gray-400">Open on a TV or tablet at each field — auto-refreshes every 15s</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {fields.map((f) => (
              <a
                key={f.id}
                href={`/display/${tournamentId}/field/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 hover:border-brand-200 transition"
              >
                <MapPin className="w-3 h-3" /> {f.name} <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Schedule view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Schedule</h2>
          <button
            onClick={resetSchedule}
            disabled={resetting}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {resetting ? "Resetting..." : "Reset schedule"}
          </button>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Calendar className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setView("matrix")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === "matrix" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Grid3x3 className="w-3.5 h-3.5" /> Matrix
          </button>
          <button onClick={() => setView("board")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${view === "board" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            <Grid3x3 className="w-3.5 h-3.5" /> Board
          </button>
        </div>
      </div>

      {view === "board" ? (
        <ScheduleBoard tournamentId={tournamentId} />
      ) : view === "matrix" ? (
        <MatrixView scheduled={scheduled ?? []} fields={fields ?? []} />
      ) : !scheduled ? (
        <div className="text-gray-400 text-sm text-center py-8">Loading...</div>
      ) : scheduled.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No matches scheduled yet.</p>
          <p className="text-xs mt-1">Use Auto-schedule above, or switch to Board view to place matches manually.</p>
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
                  <div key={s.id} className={`bg-white border rounded-xl overflow-hidden ${s.match.status === "CANCELLED" ? "border-red-100 opacity-60" : "border-gray-200"}`}>
                  <div className="px-5 py-3 flex items-center gap-6">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-[80px]">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(s.startTime).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {s.field.name}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className={`font-medium text-sm ${s.match.status === "CANCELLED" ? "line-through text-gray-400" : "text-gray-900"}`}>{s.match.homeTeam?.name ?? "TBD"}</span>
                      <div className="px-4 text-center">
                        {s.match.homeScore !== null && s.match.status !== "CANCELLED" ? (
                          <span className="text-sm font-bold text-gray-900">
                            {s.match.homeScore} — {s.match.awayScore}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">vs</span>
                        )}
                      </div>
                      <span className={`font-medium text-sm text-right ${s.match.status === "CANCELLED" ? "line-through text-gray-400" : "text-gray-900"}`}>{s.match.awayTeam?.name ?? "TBD"}</span>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      s.match.status === "COMPLETED" ? "bg-purple-100 text-purple-700" :
                      s.match.status === "IN_PROGRESS" ? "bg-green-100 text-green-700" :
                      s.match.status === "CANCELLED" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {s.match.status.replace("_", " ")}
                    </div>
                    {s.match.status === "CANCELLED" ? (
                      <button
                        onClick={() => setMatchStatus(s.match.id, "SCHEDULED")}
                        disabled={changingStatus === s.match.id}
                        title="Restore match"
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-700 disabled:opacity-40"
                      >
                        <RotateCw className="w-3 h-3" />
                        Restore
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {s.match.homeTeam && s.match.awayTeam && (
                          <button
                            onClick={() => setScoringMatch(s.match)}
                            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition ${
                              s.match.status === "COMPLETED"
                                ? "bg-gray-50 text-gray-400 hover:bg-gray-100"
                                : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                            }`}
                          >
                            <Pencil className="w-3 h-3" />
                            {s.match.status === "COMPLETED" ? "Edit" : "Score"}
                          </button>
                        )}
                        {s.match.status === "SCHEDULED" && (
                          <button
                            onClick={() => editingSlot === s.id ? setEditingSlot(null) : openSlotEdit(s)}
                            title="Reschedule"
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {s.match.status !== "COMPLETED" && (
                          <button
                            onClick={() => setMatchStatus(s.match.id, "CANCELLED")}
                            disabled={changingStatus === s.match.id}
                            title="Cancel match"
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Inline reschedule form */}
                  {editingSlot === s.id && (
                    <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Date</label>
                        <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Time (UTC)</label>
                        <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Field</label>
                        <select value={slotFieldId} onChange={(e) => setSlotFieldId(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                          {(fields ?? []).map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => saveSlot(s.match.id, s.startTime, s.endTime)}
                        disabled={savingSlot || !slotDate || !slotTime || !slotFieldId}
                        className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition"
                      >
                        {savingSlot ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingSlot(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {scoringMatch && (
        <ScoreEntryModal
          match={scoringMatch}
          tournamentId={tournamentId}
          isOverride={scoringMatch.status === "COMPLETED"}
          onClose={() => setScoringMatch(null)}
          onSaved={() => { setScoringMatch(null); mutateScheduled(); }}
        />
      )}
    </div>
  );
}
