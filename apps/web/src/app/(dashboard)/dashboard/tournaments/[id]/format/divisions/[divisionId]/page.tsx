"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, ChevronRight, Play } from "lucide-react";

interface Group { id: string; name: string; }
interface Bracket { id: string; size: number; }
interface Phase { id: string; name: string; type: string; status: string; groups: Group[]; brackets: Bracket[]; }
interface Division { id: string; name: string; matchDurationMinutes: number; halfDurationMinutes: number; phases: Phase[]; }

export default function DivisionPage() {
  const { id: tournamentId, divisionId } = useParams<{ id: string; divisionId: string }>();
  const router = useRouter();
  const [showPhase, setShowPhase] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [phaseType, setPhaseType] = useState<"GROUP_STAGE" | "KNOCKOUT">("GROUP_STAGE");
  const [starting, setStarting] = useState<string | null>(null);
  const [matchDuration, setMatchDuration] = useState("");
  const [halfDuration, setHalfDuration] = useState("");
  const [savingDurations, setSavingDurations] = useState(false);

  const { data: division, mutate } = useSWR<Division>(
    `/api/divisions/${divisionId}`,
    async () => {
      const t = await api.get<{ divisions: Division[] }>(`/api/tournaments/${tournamentId}`);
      return t.divisions.find((d) => d.id === divisionId)!;
    },
    {
      onSuccess: (d) => {
        setMatchDuration(String(d.matchDurationMinutes ?? 90));
        setHalfDuration(String(d.halfDurationMinutes ?? 45));
      },
    }
  );

  const saveDurations = async () => {
    setSavingDurations(true);
    try {
      await api.put(`/api/divisions/${divisionId}`, {
        matchDurationMinutes: parseInt(matchDuration, 10),
        halfDurationMinutes: parseInt(halfDuration, 10),
      });
      await mutate();
    } finally {
      setSavingDurations(false);
    }
  };

  const addPhase = async () => {
    if (!phaseName.trim()) return;
    await api.post(`/api/divisions/${divisionId}/phases`, { name: phaseName, type: phaseType });
    setPhaseName(""); setShowPhase(false);
    await mutate();
  };

  const startPhase = async (phaseId: string) => {
    setStarting(phaseId);
    try {
      await api.post(`/api/phases/${phaseId}/start`, {});
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setStarting(null);
    }
  };

  const statusColor: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <button onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format`)} className="hover:text-gray-700">Format</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{division?.name}</span>
      </div>

      {/* Game time settings */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Match time settings</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Match duration (min)</label>
            <input
              type="number"
              min={1}
              max={300}
              value={matchDuration}
              onChange={(e) => setMatchDuration(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Half duration (min)</label>
            <input
              type="number"
              min={1}
              max={150}
              value={halfDuration}
              onChange={(e) => setHalfDuration(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={saveDurations}
            disabled={savingDurations}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {savingDurations ? "Saving..." : "Save"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          These values are used as defaults when auto-scheduling matches in this division.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Phases</h2>
        <button
          onClick={() => setShowPhase(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add phase
        </button>
      </div>

      {showPhase && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phase name</label>
            <input
              value={phaseName}
              onChange={(e) => setPhaseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPhase()}
              autoFocus
              placeholder="e.g. Group Stage"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-52"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={phaseType} onChange={(e) => setPhaseType(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="GROUP_STAGE">Group Stage</option>
              <option value="KNOCKOUT">Knockout</option>
            </select>
          </div>
          <button onClick={addPhase} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => setShowPhase(false)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!division ? (
        <div className="text-gray-400 text-sm text-center py-6">Loading...</div>
      ) : division.phases.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No phases yet. Add a Group Stage or Knockout phase.</div>
      ) : (
        <div className="space-y-3">
          {division.phases.map((phase) => (
            <div key={phase.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{phase.name}</span>
                  <span className="text-xs text-gray-400">{phase.type.replace("_", " ")}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[phase.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {phase.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {phase.status === "PENDING" && (
                    <button
                      onClick={() => startPhase(phase.id)}
                      disabled={starting === phase.id}
                      className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />
                      {starting === phase.id ? "Starting..." : "Advance to this phase"}
                    </button>
                  )}
                  {phase.type === "GROUP_STAGE" && (
                    <button
                      onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/phases/${phase.id}/groups`)}
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                    >
                      Manage groups <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {phase.type === "KNOCKOUT" && (
                    <button
                      onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/phases/${phase.id}/bracket`)}
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                    >
                      Manage bracket <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-5 py-3 text-xs text-gray-400">
                {phase.type === "GROUP_STAGE"
                  ? `${phase.groups?.length ?? 0} group(s)`
                  : `${phase.brackets?.length ?? 0} bracket(s)`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
