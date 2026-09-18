"use client";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Users, ChevronDown, ChevronRight, Trash2, Pencil, Check, X, Upload, CreditCard, AlertCircle } from "lucide-react";

interface Player { id: string; name: string; number: number | null; position: string | null; dateOfBirth: string | null; }
interface Team { id: string; name: string; logoUrl: string | null; paymentStatus: string; paymentAmount: number | null; players: Player[]; }

function ageLabel(dob: string | null, divisionName?: string): { ok: boolean; label: string } | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (!divisionName) return { ok: true, label: `Age ${age}` };
  const match = divisionName.match(/U(\d+)/i);
  if (!match) return { ok: true, label: `Age ${age}` };
  const maxAge = parseInt(match[1], 10);
  return { ok: age <= maxAge, label: `Age ${age}` };
}

const PAY_COLORS: Record<string, string> = {
  UNPAID: "bg-red-50 text-red-600 border-red-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  WAIVED: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function TeamsPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [addingToTeam, setAddingToTeam] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", position: "", dateOfBirth: "" });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayer, setEditPlayer] = useState({ name: "", number: "", position: "", dateOfBirth: "" });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: teams, mutate } = useSWR<Team[]>(
    `/api/tournaments/${tournamentId}/teams`,
    () => api.get(`/api/tournaments/${tournamentId}/teams`)
  );

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreateError(null);
    try {
      await api.post(`/api/tournaments/${tournamentId}/teams`, { name: newTeamName.trim() });
      setNewTeamName(""); setShowCreate(false);
      await mutate();
    } catch (err: any) { setCreateError(err.message); }
  };

  const deleteTeam = async (id: string) => {
    if (!confirm("Delete this team and all its players?")) return;
    await api.delete(`/api/teams/${id}`);
    await mutate();
  };

  const saveTeamName = async (id: string) => {
    if (!editTeamName.trim()) return;
    await api.put(`/api/teams/${id}`, { name: editTeamName.trim() });
    await mutate(); setEditingTeamId(null);
  };

  const addPlayer = async (teamId: string) => {
    if (!newPlayer.name.trim()) return;
    await api.post(`/api/teams/${teamId}/players`, {
      name: newPlayer.name.trim(),
      number: newPlayer.number ? parseInt(newPlayer.number, 10) : undefined,
      position: newPlayer.position.trim() || undefined,
      dateOfBirth: newPlayer.dateOfBirth || undefined,
    });
    await mutate();
    setAddingToTeam(null);
    setNewPlayer({ name: "", number: "", position: "", dateOfBirth: "" });
  };

  const savePlayer = async (id: string) => {
    if (!editPlayer.name.trim()) return;
    await api.put(`/api/players/${id}`, {
      name: editPlayer.name.trim(),
      number: editPlayer.number ? parseInt(editPlayer.number, 10) : null,
      position: editPlayer.position.trim() || null,
      dateOfBirth: editPlayer.dateOfBirth || null,
    });
    await mutate(); setEditingPlayerId(null);
  };

  const deletePlayer = async (id: string) => {
    if (!confirm("Remove this player?")) return;
    await api.delete(`/api/players/${id}`);
    await mutate();
  };

  const startEditPlayer = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditPlayer({
      name: p.name, number: p.number?.toString() ?? "",
      position: p.position ?? "",
      dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
    });
  };

  const savePayment = async (id: string) => {
    await api.put(`/api/teams/${id}/payment`, {
      paymentStatus,
      paymentAmount: paymentAmount ? parseInt(paymentAmount, 10) : null,
    });
    await mutate(); setEditingPaymentId(null);
  };

  const startEditPayment = (t: Team) => {
    setEditingPaymentId(t.id);
    setPaymentStatus(t.paymentStatus);
    setPaymentAmount(t.paymentAmount?.toString() ?? "");
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportError(null);
    try {
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.toLowerCase().startsWith("name"));
      const teams = lines.map((l) => {
        const [name, country] = l.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        return { name, country: country || undefined };
      }).filter((t) => t.name);
      if (!teams.length) { setImportError("No valid team names found. Use one team name per line."); setImporting(false); return; }
      await api.post(`/api/tournaments/${tournamentId}/teams/import`, { teams });
      await mutate();
    } catch (err: any) { setImportError(err.message || "Import failed"); }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const paid = (teams ?? []).filter((t) => t.paymentStatus === "PAID").length;
  const total = (teams ?? []).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
          {total > 0 && <p className="text-xs text-gray-400 mt-0.5">{total} teams · {paid} paid{total - paid > 0 ? ` · ${total - paid} unpaid` : ""}</p>}
        </div>
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-3.5 h-3.5" />
            {importing ? "Importing…" : "Import CSV"}
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvImport} />
          </label>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add team
          </button>
        </div>
      </div>

      {importError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {importError}
          <button onClick={() => setImportError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
        CSV format: one team per line — <code>Team Name, Country (optional)</code>. First row may be a header and will be skipped.
      </div>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
            <input autoFocus value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createTeam()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {createError && <p className="text-red-500 text-xs mt-1">{createError}</p>}
          </div>
          <button onClick={createTeam} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => { setShowCreate(false); setNewTeamName(""); }} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!teams ? (
        <div className="text-gray-400 py-4 text-sm text-center">Loading…</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No teams yet. Add or import teams above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <div key={team.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Team header */}
              <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(expanded === team.id ? null : team.id)}>
                  {expanded === team.id ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  {editingTeamId === team.id ? (
                    <input autoFocus value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTeamName(team.id); if (e.key === "Escape") setEditingTeamId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="border border-brand-300 rounded-md px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{team.name}</span>
                      <span className="text-xs text-gray-400">{team.players.length} players</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {/* Payment status */}
                  {editingPaymentId === team.id ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs">
                        <option value="UNPAID">UNPAID</option>
                        <option value="PAID">PAID</option>
                        <option value="WAIVED">WAIVED</option>
                      </select>
                      <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="R amount" className="w-20 border border-gray-300 rounded px-2 py-1 text-xs" />
                      <button onClick={() => savePayment(team.id)} className="text-green-500 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingPaymentId(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); startEditPayment(team); }}
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium transition hover:opacity-80 ${PAY_COLORS[team.paymentStatus] ?? PAY_COLORS.UNPAID}`}>
                      {team.paymentStatus}{team.paymentAmount ? ` R${team.paymentAmount.toLocaleString()}` : ""}
                    </button>
                  )}
                  {editingTeamId === team.id ? (
                    <>
                      <button onClick={() => saveTeamName(team.id)} className="text-green-500 hover:text-green-700 p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTeamId(null)} className="text-gray-400 p-1"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditingTeamId(team.id); setEditTeamName(team.name); }} className="text-gray-400 hover:text-brand-600 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
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
                          <th className="text-left pb-2 font-medium w-10">#</th>
                          <th className="text-left pb-2 font-medium">Name</th>
                          <th className="text-left pb-2 font-medium">Position</th>
                          <th className="text-left pb-2 font-medium">DOB / Age</th>
                          <th className="pb-2 w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {team.players.map((p) => (
                          <tr key={p.id} className="border-b border-gray-50 last:border-0 group">
                            {editingPlayerId === p.id ? (
                              <>
                                <td className="py-1.5"><input type="number" value={editPlayer.number} onChange={(e) => setEditPlayer({ ...editPlayer, number: e.target.value })} placeholder="#" className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                <td className="py-1.5 pr-2"><input autoFocus value={editPlayer.name} onChange={(e) => setEditPlayer({ ...editPlayer, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") savePlayer(p.id); if (e.key === "Escape") setEditingPlayerId(null); }} className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" /></td>
                                <td className="py-1.5 pr-2"><input value={editPlayer.position} onChange={(e) => setEditPlayer({ ...editPlayer, position: e.target.value })} placeholder="Position" className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none" /></td>
                                <td className="py-1.5 pr-2"><input type="date" value={editPlayer.dateOfBirth} onChange={(e) => setEditPlayer({ ...editPlayer, dateOfBirth: e.target.value })} className="border border-gray-200 rounded px-2 py-0.5 text-xs focus:outline-none" /></td>
                                <td className="py-1.5"><div className="flex gap-1"><button onClick={() => savePlayer(p.id)} className="text-green-500 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button><button onClick={() => setEditingPlayerId(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button></div></td>
                              </>
                            ) : (
                              <>
                                <td className="py-1.5 text-gray-500">{p.number ?? "—"}</td>
                                <td className="py-1.5 font-medium text-gray-900">{p.name}</td>
                                <td className="py-1.5 text-gray-500">{p.position ?? "—"}</td>
                                <td className="py-1.5">
                                  {p.dateOfBirth ? (() => {
                                    const age = ageLabel(p.dateOfBirth, team.name);
                                    return age ? (
                                      <span className={`text-xs px-1.5 py-0.5 rounded ${age.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{age.label}</span>
                                    ) : null;
                                  })() : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="py-1.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={() => startEditPlayer(p)} className="text-gray-400 hover:text-brand-600"><Pencil className="w-3 h-3" /></button><button onClick={() => deletePlayer(p.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div></td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {addingToTeam === team.id ? (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <input type="number" value={newPlayer.number} onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })} placeholder="#" className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
                      <input autoFocus value={newPlayer.name} onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addPlayer(team.id)} placeholder="Player name" className="flex-1 min-w-32 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
                      <input value={newPlayer.position} onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })} placeholder="Position" className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                      <input type="date" value={newPlayer.dateOfBirth} onChange={(e) => setNewPlayer({ ...newPlayer, dateOfBirth: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
                      <button onClick={() => addPlayer(team.id)} className="text-green-500 hover:text-green-700"><Check className="w-4 h-4" /></button>
                      <button onClick={() => { setAddingToTeam(null); setNewPlayer({ name: "", number: "", position: "", dateOfBirth: "" }); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingToTeam(team.id); setNewPlayer({ name: "", number: "", position: "", dateOfBirth: "" }); }} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mt-1">
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
