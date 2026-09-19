"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { api } from "@/lib/api";
import { Plus, ChevronRight } from "lucide-react";

interface Team { id: string; name: string; }
interface GroupTeam { team: Team; }
interface Standing { position: number; team: Team; played: number; won: number; drawn: number; lost: number; goalDifference: number; points: number; }
interface Match { id: string; homeTeam: Team | null; awayTeam: Team | null; homeScore: number | null; awayScore: number | null; status: string; }
interface Group { id: string; name: string; teams: GroupTeam[]; standings: Standing[]; matches: Match[]; }

export default function GroupsPage() {
  const { id: tournamentId, phaseId } = useParams<{ id: string; phaseId: string }>();
  const router = useRouter();
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [legs, setLegs] = useState<1 | 2>(1);
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: phase } = useSWR<{ id: string; name: string; divisionId: string }>(
    `/api/phases/${phaseId}`,
    () => api.get(`/api/phases/${phaseId}`)
  );

  const { data: groups, mutate } = useSWR<Group[]>(
    `/api/phases/${phaseId}/groups`,
    () => api.get(`/api/phases/${phaseId}/groups`)
  );

  const addGroup = async () => {
    if (!groupName.trim()) return;
    await api.post(`/api/phases/${phaseId}/groups`, { name: groupName, legs });
    await mutate();
    setGroupName(""); setShowGroup(false);
  };

  const generateMatches = async (groupId: string) => {
    setGenerating(groupId);
    try {
      await api.post(`/api/groups/${groupId}/generate-matches`, {});
      await Promise.all([mutate(), globalMutate(`/api/groups/${groupId}`)]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <button onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/divisions/${phase?.divisionId}`)} className="hover:text-gray-700 disabled:pointer-events-none">
          ← {phase?.name ?? "Phase"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
        <button
          onClick={() => setShowGroup(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add group
        </button>
      </div>

      {showGroup && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Group name</label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
              autoFocus
              placeholder="e.g. Group A"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Legs</label>
            <select value={legs} onChange={(e) => setLegs(Number(e.target.value) as 1 | 2)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value={1}>1 (single round-robin)</option>
              <option value={2}>2 (home & away)</option>
            </select>
          </div>
          <button onClick={addGroup} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => setShowGroup(false)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!groups ? (
        <div className="text-gray-400 text-sm text-center py-6">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No groups yet.</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-medium text-gray-900">{group.name}</span>
                <div className="flex items-center gap-3">
                  {group.matches.length === 0 && group.teams.length >= 2 && (
                    <button
                      onClick={() => generateMatches(group.id)}
                      disabled={generating === group.id}
                      className="text-xs text-brand-600 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-lg hover:bg-brand-100 transition disabled:opacity-50"
                    >
                      {generating === group.id ? "Generating..." : "Generate matches"}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/groups/${group.id}`)}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                  >
                    Open <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="px-5 py-3 text-xs text-gray-500">
                {group.teams.length} teams · {group.matches.length} matches
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
