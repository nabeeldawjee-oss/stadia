"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetch, api } from "@/lib/api";
import { ChevronLeft, Save } from "lucide-react";

interface Group { id: string; name: string; _count: { teams: number }; }
interface BracketSlot { id: string; roundNumber: number; position: number; }
interface Phase { id: string; name: string; format: string; groups: Group[]; brackets: { id: string; slots: BracketSlot[] }[]; }
interface AdvancementRule { fromGroupId: string; position: number; toPhaseId: string; toBracketSlotId?: string; }

export default function AdvancementPage() {
  const { tournamentId, phaseId } = useParams<{ tournamentId: string; phaseId: string }>();
  const router = useRouter();

  const { data: phase } = useSWR<Phase>(
    `/api/phases/${phaseId}`,
    () => apiFetch(`/api/phases/${phaseId}`)
  );

  const { data: phases } = useSWR<Phase[]>(
    tournamentId ? `/api/tournaments/${tournamentId}/phases` : null,
    () => apiFetch(`/api/tournaments/${tournamentId}/phases`)
  );

  const { data: savedRules, mutate } = useSWR<AdvancementRule[]>(
    `/api/phases/${phaseId}/advancement`,
    () => apiFetch(`/api/phases/${phaseId}/advancement`)
  );

  const [rules, setRules] = useState<AdvancementRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (savedRules) setRules(savedRules);
  }, [savedRules]);

  const nextPhases = phases?.filter((p) => p.id !== phaseId) ?? [];

  const setRule = (fromGroupId: string, position: number, patch: Partial<AdvancementRule>) => {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.fromGroupId === fromGroupId && r.position === position);
      const base = idx >= 0 ? prev[idx] : { fromGroupId, position, toPhaseId: "" };
      const updated = { ...base, ...patch };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
    setSaved(false);
  };

  const getRule = (fromGroupId: string, position: number): AdvancementRule | undefined =>
    rules.find((r) => r.fromGroupId === fromGroupId && r.position === position);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/phases/${phaseId}/advancement`, rules.filter((r) => r.toPhaseId));
      await mutate();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!phase) return <div className="p-6 text-gray-400 text-sm">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Advancement Rules</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure which group positions advance to which phase or bracket slot.
      </p>

      {phase.groups.length === 0 ? (
        <div className="text-gray-400 text-sm">Add groups to this phase first.</div>
      ) : (
        <div className="space-y-6">
          {phase.groups.map((group) => {
            const teamCount = group._count?.teams ?? 0;
            const positions = Array.from({ length: teamCount }, (_, i) => i + 1);

            return (
              <div key={group.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 text-sm">{group.name}</h3>
                  <p className="text-xs text-gray-400">{teamCount} teams</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {positions.map((pos) => {
                    const rule = getRule(group.id, pos);
                    const targetPhase = nextPhases.find((p) => p.id === rule?.toPhaseId);
                    const bracketSlots = targetPhase?.brackets?.[0]?.slots ?? [];

                    return (
                      <div key={pos} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-20 shrink-0">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 font-bold text-sm border border-brand-200">
                            {pos}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            {pos === 1 ? "1st" : pos === 2 ? "2nd" : pos === 3 ? "3rd" : `${pos}th`}
                          </span>
                        </div>
                        <span className="text-gray-400 text-sm">→</span>
                        <select
                          value={rule?.toPhaseId ?? ""}
                          onChange={(e) => setRule(group.id, pos, { toPhaseId: e.target.value, toBracketSlotId: undefined })}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">Does not advance</option>
                          {nextPhases.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {targetPhase?.format === "KNOCKOUT" && bracketSlots.length > 0 && (
                          <select
                            value={rule?.toBracketSlotId ?? ""}
                            onChange={(e) => setRule(group.id, pos, { toBracketSlotId: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="">Select slot</option>
                            {bracketSlots.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                R{slot.roundNumber} Slot {slot.position}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save advancement rules"}
          </button>
        </div>
      )}
    </div>
  );
}
