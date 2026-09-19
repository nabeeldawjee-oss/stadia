"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Trash2, Trophy, BarChart2 } from "lucide-react";

interface StatDef { id: string; name: string; key: string; appliesTo: string; }
interface TopScorerEntry { player: { id: string; name: string; team: { name: string } } | undefined; total: number; }
interface StatBoard { statDef: StatDef; entries: TopScorerEntry[]; }

export default function StatsPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [appliesTo, setAppliesTo] = useState("PLAYER");

  const { data: statDefs, mutate: mutateStatDefs } = useSWR<StatDef[]>(
    `/api/tournaments/${tournamentId}/stat-definitions`,
    () => api.get(`/api/tournaments/${tournamentId}/stat-definitions`)
  );

  const { data: boards } = useSWR<StatBoard[]>(
    `/api/tournaments/${tournamentId}/top-scorers`,
    () => api.get(`/api/tournaments/${tournamentId}/top-scorers`)
  );

  const addDef = async () => {
    if (!newName.trim() || !newKey.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/stat-definitions`, {
      name: newName.trim(),
      key: newKey.toLowerCase().replace(/\s+/g, "_"),
      appliesTo,
    });
    setNewName(""); setNewKey(""); setShowAdd(false);
    await mutateStatDefs();
  };

  const deleteDef = async (id: string) => {
    if (!confirm("Delete this stat type? All recorded values will also be deleted.")) return;
    await api.delete(`/api/stat-definitions/${id}`);
    await mutateStatDefs();
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Stat definitions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Stat types</h2>
            <p className="text-xs text-gray-400 mt-0.5">Define what stats are tracked — goals, assists, cards, etc.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add stat type
          </button>
        </div>

        {showAdd && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input value={newName} onChange={(e) => { setNewName(e.target.value); setNewKey(e.target.value.toLowerCase().replace(/\s+/g, "_")); }} placeholder="e.g. Goals" autoFocus className={`${inputCls} w-36`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Key (auto)</label>
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="goals" className={`${inputCls} w-28 font-mono text-xs`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Applies to</label>
              <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className={inputCls}>
                <option value="PLAYER">Player</option>
                <option value="TEAM">Team</option>
              </select>
            </div>
            <button onClick={addDef} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
            <button onClick={() => setShowAdd(false)} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        )}

        {!statDefs || statDefs.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <BarChart2 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            No stat types defined yet. Add Goals, Assists, Yellow Cards, etc. to start tracking.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {statDefs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-gray-800">{d.name}</span>
                <span className="text-xs text-gray-400 font-mono">{d.key}</span>
                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{d.appliesTo.toLowerCase()}</span>
                <button onClick={() => deleteDef(d.id)} className="text-gray-300 hover:text-red-500 transition ml-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboards */}
      {!boards || boards.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          No stats recorded yet. Stats are added when scores are entered with player events.
        </div>
      ) : (
        boards.map((board) => (
          <div key={board.statDef.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-gray-900">{board.statDef.name}</h3>
              <span className="text-xs text-gray-400">{board.statDef.appliesTo.toLowerCase()} stat</span>
            </div>
            <div className="divide-y divide-gray-50">
              {board.entries.map((entry, idx) => (
                <div key={idx} className="px-6 py-3 flex items-center gap-4">
                  <span className={`w-6 text-center text-sm font-bold ${idx === 0 ? "text-amber-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-orange-400" : "text-gray-300"}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{entry.player?.name ?? "Unknown"}</p>
                    <p className="text-xs text-gray-400">{entry.player?.team?.name ?? ""}</p>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{entry.total}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
