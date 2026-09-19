"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { GitBranch, Plus, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Phase { id: string; name: string; type: string; status: string; }
interface Division { id: string; name: string; phases: Phase[]; }

export default function FormatPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [showDiv, setShowDiv] = useState(false);
  const [divName, setDivName] = useState("");

  const { data: tournament, mutate } = useSWR<{ id: string; divisions: Division[] }>(
    `/api/tournaments/${tournamentId}`,
    () => api.get(`/api/tournaments/${tournamentId}`)
  );

  const deleteDivision = async (divId: string, divName: string) => {
    if (!confirm(`Delete division "${divName}"? This will permanently remove all its phases, groups, matches, and bracket data. This cannot be undone.`)) return;
    await api.delete(`/api/divisions/${divId}`);
    await mutate();
  };

  const addDivision = async () => {
    if (!divName.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/divisions`, { name: divName });
    setDivName("");
    setShowDiv(false);
    await mutate();
  };

  const statusBadge: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Divisions & Phases</h2>
        <button
          onClick={() => setShowDiv(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add division
        </button>
      </div>

      {showDiv && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3">
          <input
            value={divName}
            onChange={(e) => setDivName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDivision()}
            autoFocus
            placeholder="Division name (e.g. Men's Open)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={addDivision} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => setShowDiv(false)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!tournament ? (
        <div className="text-gray-400 text-sm text-center py-4">Loading...</div>
      ) : tournament.divisions?.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <GitBranch className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No divisions yet. Add a division to set up your format.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournament.divisions?.map((div) => (
            <div key={div.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-gray-900">{div.name}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/divisions/${div.id}`)}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                  >
                    Manage <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteDivision(div.id, div.name)}
                    className="text-gray-300 hover:text-red-500 transition"
                    title="Delete division"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {div.phases?.length === 0 ? (
                <div className="px-5 py-3 text-xs text-gray-400">No phases yet</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {div.phases?.map((phase) => (
                    <div key={phase.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GitBranch className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-800">{phase.name}</span>
                        <span className="text-xs text-gray-400">{phase.type.replace("_", " ")}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[phase.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {phase.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
