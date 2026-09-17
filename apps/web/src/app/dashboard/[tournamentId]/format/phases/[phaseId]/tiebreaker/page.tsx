"use client";
import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetch, api } from "@/lib/api";
import { GripVertical, ChevronLeft, Save } from "lucide-react";

const CRITERIA_LABELS: Record<string, string> = {
  points: "Points",
  goal_difference: "Goal Difference",
  goals_for: "Goals For",
  goals_against: "Goals Against",
  head_to_head: "Head-to-Head",
  wins: "Wins",
  draws: "Draws",
  losses: "Losses",
  custom: "Custom Criteria",
};

const ALL_CRITERIA = Object.keys(CRITERIA_LABELS);

interface Group { id: string; name: string; tiebreakerChain: string[] | null; }

export default function TiebreakerPage() {
  const { tournamentId, phaseId } = useParams<{ tournamentId: string; phaseId: string }>();
  const router = useRouter();

  const { data: groups } = useSWR<Group[]>(
    `/api/phases/${phaseId}/groups`,
    () => apiFetch(`/api/phases/${phaseId}/groups`)
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [chain, setChain] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const loadGroup = (g: Group) => {
    setSelectedGroupId(g.id);
    setChain(g.tiebreakerChain ?? ["points", "goal_difference", "goals_for", "head_to_head"]);
    setSaved(false);
  };

  const move = (from: number, to: number) => {
    const next = [...chain];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setChain(next);
  };

  const toggle = (criterion: string) => {
    setChain((prev) =>
      prev.includes(criterion) ? prev.filter((c) => c !== criterion) : [...prev, criterion]
    );
  };

  const save = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    try {
      await api.put(`/api/groups/${selectedGroupId}/tiebreaker`, { tiebreakerChain: chain });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Tiebreaker Rules</h1>
      <p className="text-sm text-gray-500 mb-6">
        Set the order of criteria used to break ties in the standings. Drag to reorder.
      </p>

      {!groups ? (
        <div className="text-gray-400 text-sm">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="text-gray-400 text-sm">No groups in this phase.</div>
      ) : (
        <div className="flex gap-6">
          {/* Group selector */}
          <div className="w-40 shrink-0 space-y-1">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => loadGroup(g)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  selectedGroupId === g.id
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* Chain editor */}
          {selectedGroupId && (
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
                Active criteria — drag to reorder
              </p>
              <div className="space-y-2 mb-6">
                {chain.map((criterion, idx) => (
                  <div
                    key={criterion}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== idx) move(dragIdx, idx);
                      setDragIdx(null);
                    }}
                    className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 cursor-grab select-none shadow-sm"
                  >
                    <span className="text-gray-300">
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-medium flex-1">{CRITERIA_LABELS[criterion] ?? criterion}</span>
                    <span className="text-xs text-gray-400">#{idx + 1}</span>
                    <button
                      onClick={() => toggle(criterion)}
                      className="text-xs text-red-400 hover:text-red-600 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Available criteria
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {ALL_CRITERIA.filter((c) => !chain.includes(c)).map((c) => (
                  <button
                    key={c}
                    onClick={() => toggle(c)}
                    className="text-xs px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-600 transition"
                  >
                    + {CRITERIA_LABELS[c] ?? c}
                  </button>
                ))}
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save rules"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
