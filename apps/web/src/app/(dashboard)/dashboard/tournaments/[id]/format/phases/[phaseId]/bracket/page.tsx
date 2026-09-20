"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus } from "lucide-react";
import BracketView from "@/components/BracketView";

interface Bracket { id: string; size: number; }

export default function BracketPage() {
  const { id: tournamentId, phaseId } = useParams<{ id: string; phaseId: string }>();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [size, setSize] = useState(8);
  const [thirdPlace, setThirdPlace] = useState(false);

  const { data: phase, mutate } = useSWR<{ id: string; brackets: Bracket[] }>(
    `/api/phases/${phaseId}`,
    () => api.get(`/api/phases/${phaseId}`)
  );

  const createBracket = async () => {
    setCreating(true);
    try {
      await api.post(`/api/phases/${phaseId}/brackets`, { size, thirdPlaceMatch: thirdPlace });
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <button onClick={() => router.back()} className="hover:text-gray-700">← Back</button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Bracket</h2>
        {(!phase?.brackets || phase.brackets.length === 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none">
              {[2, 4, 8, 16, 32].map((n) => (
                <option key={n} value={n}>{n} teams</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={thirdPlace}
                onChange={(e) => setThirdPlace(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              3rd-place match
            </label>
            <button
              onClick={createBracket}
              disabled={creating}
              className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {creating ? "Creating..." : "Create bracket"}
            </button>
          </div>
        )}
      </div>

      {!phase ? (
        <div className="text-gray-400 text-sm text-center py-6">Loading...</div>
      ) : phase.brackets?.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No bracket yet. Create one above.</div>
      ) : (
        phase.brackets?.map((bracket) => (
          <BracketView key={bracket.id} bracketId={bracket.id} />
        ))
      )}
    </div>
  );
}
