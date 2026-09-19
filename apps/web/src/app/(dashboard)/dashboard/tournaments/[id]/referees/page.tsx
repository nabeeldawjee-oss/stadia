"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, Copy, RefreshCw, Trash2, Check, ChevronDown, ChevronRight, UserCheck, X } from "lucide-react";

interface Assignment {
  matchId: string;
  role: string;
  match: {
    id: string;
    homeTeam?: { name: string } | null;
    awayTeam?: { name: string } | null;
    scheduledMatch?: { startTime: string; field: { name: string } } | null;
  };
}
interface Referee {
  id: string; name: string; email: string | null;
  scoreToken: { token: string } | null;
  assignments: Assignment[];
}
interface ScheduledMatch {
  id: string; startTime: string;
  field: { name: string };
  match: { id: string; homeTeam?: { name: string } | null; awayTeam?: { name: string } | null; };
}

export default function RefereesPage() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState("");

  const { data: refs, mutate } = useSWR<Referee[]>(
    `/api/tournaments/${tournamentId}/referees`,
    () => api.get(`/api/tournaments/${tournamentId}/referees`)
  );

  const today = new Date().toISOString().split("T")[0];
  const { data: todayMatches } = useSWR<ScheduledMatch[]>(
    assigning ? `/api/tournaments/${tournamentId}/schedule?day=${today}` : null,
    () => api.get(`/api/tournaments/${tournamentId}/schedule?day=${today}`)
  );

  const add = async () => {
    if (!name.trim()) return;
    await api.post(`/api/tournaments/${tournamentId}/referees`, { name, email: email || undefined });
    setName(""); setEmail(""); setShowAdd(false);
    await mutate();
  };

  const regen = async (refId: string) => {
    if (!confirm("Regenerate this referee's token? Their old link will stop working.")) return;
    await api.post(`/api/referees/${refId}/token`, {});
    await mutate();
  };

  const remove = async (refId: string) => {
    if (!confirm("Remove this referee?")) return;
    await api.delete(`/api/referees/${refId}`);
    await mutate();
  };

  const copyLink = (token: string) => {
    const base = process.env.NEXT_PUBLIC_WEB_URL || window.location.origin;
    navigator.clipboard.writeText(`${base}/ref?token=${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const assignRef = async (refId: string) => {
    if (!selectedMatch) return;
    await api.post(`/api/matches/${selectedMatch}/referee`, { refereeId: refId });
    setAssigning(null); setSelectedMatch("");
    await mutate();
  };

  const unassignRef = async (matchId: string) => {
    await api.delete(`/api/matches/${matchId}/referee`);
    await mutate();
  };

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Referees</h2>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          <Plus className="w-3.5 h-3.5" /> Add referee
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Referee name" onKeyDown={(e) => e.key === "Enter" && add()} className={`${inputCls} w-40`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ref@example.com" className={`${inputCls} w-48`} />
          </div>
          <button onClick={add} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => setShowAdd(false)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!refs ? (
        <div className="text-gray-400 text-sm text-center py-4">Loading...</div>
      ) : refs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No referees added yet.</div>
      ) : (
        <div className="space-y-2">
          {refs.map((ref) => {
            const token = ref.scoreToken?.token;
            const isExpanded = expanded === ref.id;
            return (
              <div key={ref.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setExpanded(isExpanded ? null : ref.id)}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{ref.name}</p>
                      {ref.email && <p className="text-xs text-gray-500">{ref.email}</p>}
                    </div>
                    {ref.assignments.length > 0 && (
                      <span className="ml-2 text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">
                        {ref.assignments.length} match{ref.assignments.length !== 1 ? "es" : ""}
                      </span>
                    )}
                  </div>
                  <button onClick={() => remove(ref.id)} className="text-gray-300 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded: token + assignments */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                    {/* Token link */}
                    {token ? (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Score token link</p>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-xs text-gray-500 font-mono flex-1 truncate">/ref?token={token.slice(0, 20)}…</span>
                          <button onClick={() => copyLink(token)} className="text-gray-400 hover:text-brand-600 transition" title="Copy link">
                            {copied === token ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => regen(ref.id)} className="text-gray-400 hover:text-brand-600 transition" title="Regenerate token">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => regen(ref.id)} className="text-xs text-brand-600 hover:underline">Generate token link</button>
                    )}

                    {/* Assignments */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-gray-500">Match assignments</p>
                        <button
                          onClick={() => { setAssigning(ref.id); setSelectedMatch(""); }}
                          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                        >
                          <UserCheck className="w-3 h-3" /> Assign to match
                        </button>
                      </div>

                      {assigning === ref.id && (
                        <div className="flex items-center gap-2 mb-2">
                          <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)} className={`${inputCls} flex-1 text-xs`}>
                            <option value="">— pick a match —</option>
                            {(todayMatches ?? []).map((sm) => (
                              <option key={sm.match.id} value={sm.match.id}>
                                {sm.match.homeTeam?.name ?? "TBD"} vs {sm.match.awayTeam?.name ?? "TBD"} · {sm.field.name} {new Date(sm.startTime).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => assignRef(ref.id)} disabled={!selectedMatch} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40">Assign</button>
                          <button onClick={() => setAssigning(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}

                      {ref.assignments.length === 0 ? (
                        <p className="text-xs text-gray-400">No matches assigned.</p>
                      ) : (
                        <div className="space-y-1">
                          {ref.assignments.map((a) => (
                            <div key={a.matchId} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-gray-700">
                                {a.match.homeTeam?.name ?? "TBD"} vs {a.match.awayTeam?.name ?? "TBD"}
                                {a.match.scheduledMatch && (
                                  <span className="text-gray-400 ml-1.5">
                                    · {a.match.scheduledMatch.field.name} {new Date(a.match.scheduledMatch.startTime).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                                  </span>
                                )}
                              </span>
                              <button onClick={() => unassignRef(a.matchId)} className="text-gray-300 hover:text-red-500 transition ml-2">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        Share the token link with each referee. They can view their assigned matches and enter scores — no account needed.
      </div>
    </div>
  );
}
