"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Users, ChevronDown, ChevronRight, Trash2, Pencil, Check, X } from "lucide-react";

interface Player { id: string; name: string; number: number | null; position: string | null; }
interface Team { id: string; name: string; logoUrl: string | null; players: Player[]; }

export default function TeamsPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Edit team name
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");

  // Add player
  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("");

  // Edit player
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerNumber, setEditPlayerNumber] = useState("");
  const [editPlayerPosition, setEditPlayerPosition] = useState("");

  const { data: teams, mutate } = useSWR<Team[]>(
    `/api/tournaments/${tournamentId}/teams`,
    () => api.get(`/api/tournaments/${tournamentId}/teams`)
  );

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreateError(null);
    try {
      await api.post(`/api/tournaments/${tournamentId}/teams`, { name: newTeamName.trim() });
      await mutate();
      setNewTeamName("");
      setShowCreate(false);
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Delete this team and all its players?")) return;
    await api.delete(`/api/teams/${teamId}`);
    await mutate();
  };

  const saveTeamName = async (teamId: string) => {
    if (!editTeamName.trim()) return;
    await api.put(`/api/teams/${teamId}`, { name: editTeamName.trim() });
    await mutate();
    setEditingTeamId(null);
  };

  const addPlayer = async (teamId: string) => {
    if (!newPlayerName.trim()) return;
    await api.post(`/api/teams/${teamId}/players`, {
      name: newPlayerName.trim(),
      number: newPlayerNumber ? parseInt(newPlayerNumber, 10) : undefined,
      position: newPlayerPosition.trim() || undefined,
    });
    await mutate();
    setAddingToTeam(null);
    setNewPlayerName(""); setNewPlayerNumber(""); setNewPlayerPosition("");
  };

  const savePlayer = async (playerId: string) => {
    if (!editPlayerName.trim()) return;
    await api.put(`/api/players/${playerId}`, {
      name: editPlayerName.trim(),
      number: editPlayerNumber ? parseInt(editPlayerNumber, 10) : undefined,
      position: editPlayerPosition.trim() || undefined,
    });
    await mutate();
    setEditingPlayerId(null);
  };

  const deletePlayer = async (playerId: string) => {
    if (!confirm("Remove this player?")) return;
    await api.delete(`/api/players/${playerId}`);
    await mutate();
  };

  const startEditPlayer = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditPlayerName(p.name);
    setEditPlayerNumber(p.number?.toString() ?? "");
    setEditPlayerPosition(p.position ?? "");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add team
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
            <input
              autoFocus
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTeam()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {createError && <p className="text-red-500 text-xs mt-1">{createError}</p>}
          </div>
          <button onClick={createTeam} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => { setShowCreate(false); setNewTeamName(""); }} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!teams ? (
        <div className="text-gray-400 py-4 text-sm text-center">Loading...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No teams yet. Add the first team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Team header */}
              <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => setExpanded(expanded === team.id ? null : team.id)}
                >
                  {expanded === team.id ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  {editingTeamId === team.id ? (
                    <input
                      autoFocus
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTeamName(team.id); if (e.key === "Escape") setEditingTeamId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="border border-brand-300 rounded-md px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{team.name}</span>
                      <span className="text-xs text-gray-400">{team.players.length} players</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {editingTeamId === team.id ? (
                    <>
                      <button onClick={() => saveTeamName(team.id)} className="text-green-500 hover:text-green-700 p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTeamId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTeamId(team.id); setEditTeamName(team.name); }}
                        className="text-gray-400 hover:text-brand-600 transition p-1"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }}
                        className="text-gray-400 hover:text-red-500 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Players panel */}
              {expanded === team.id && (
                <div className="border-t border-gray-100 px-4 py-3">
                  {team.players.length > 0 && (
                    <table className="w-full text-sm mb-3">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left pb-2 font-medium w-12">#</th>
                          <th className="text-left pb-2 font-medium">Name</th>
                          <th className="text-left pb-2 font-medium">Position</th>
                          <th className="pb-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {team.players.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0 group">
                            {editingPlayerId === p.id ? (
                              <>
                                <td className="py-1.5">
                                  <input
                                    type="number"
                                    value={editPlayerNumber}
                                    onChange={(e) => setEditPlayerNumber(e.target.value)}
                                    placeholder="#"
                                    className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none"
                                  />
                                </td>
                                <td className="py-1.5 pr-2">
                                  <input
                                    autoFocus
                                    value={editPlayerName}
                                    onChange={(e) => setEditPlayerName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") savePlayer(p.id); if (e.key === "Escape") setEditingPlayerId(null); }}
                                    className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                                  />
                                </td>
                                <td className="py-1.5 pr-2">
                                  <input
                                    value={editPlayerPosition}
                                    onChange={(e) => setEditPlayerPosition(e.target.value)}
                                    placeholder="Position"
                                    className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none"
                                  />
                                </td>
                                <td className="py-1.5">
                                  <div className="flex gap-1">
                                    <button onClick={() => savePlayer(p.id)} className="text-green-500 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setEditingPlayerId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-1.5 text-gray-500">{p.number ?? "—"}</td>
                                <td className="py-1.5 font-medium text-gray-900">{p.name}</td>
                                <td className="py-1.5 text-gray-500">{p.position ?? "—"}</td>
                                <td className="py-1.5">
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => startEditPlayer(p)} className="text-gray-400 hover:text-brand-600"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => deletePlayer(p.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Add player form */}
                  {addingToTeam === team.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        value={newPlayerNumber}
                        onChange={(e) => setNewPlayerNumber(e.target.value)}
                        placeholder="#"
                        className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                      />
                      <input
                        autoFocus
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addPlayer(team.id)}
                        placeholder="Player name"
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                      />
                      <input
                        value={newPlayerPosition}
                        onChange={(e) => setNewPlayerPosition(e.target.value)}
                        placeholder="Position"
                        className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                      />
                      <button onClick={() => addPlayer(team.id)} className="text-green-500 hover:text-green-700"><Check className="w-4 h-4" /></button>
                      <button onClick={() => { setAddingToTeam(null); setNewPlayerName(""); setNewPlayerNumber(""); setNewPlayerPosition(""); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingToTeam(team.id); setNewPlayerName(""); setNewPlayerNumber(""); setNewPlayerPosition(""); }}
                      className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add player
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
