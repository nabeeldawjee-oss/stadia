"use client";
import { useState } from "react";
import { api, apiFetch } from "@/lib/api";
import { X, Plus, Trash2, Flag } from "lucide-react";
import useSWR from "swr";

interface Team { id: string; name: string; }
interface Player { id: string; name: string; }
interface StatDef { id: string; name: string; key: string; }
// Each row the user adds is one stat event: one player did one thing once
interface StatRow { playerId: string; playerName: string; teamId: string; statDefId: string; value: number; }

interface Match {
  id: string;
  homeTeam: Team | null;
  awayTeam: Team | null;
  status: string;
}

interface Props {
  match: Match;
  tournamentId?: string;
  isOverride?: boolean;
  token?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function ScoreEntryModal({ match, tournamentId, isOverride, token, onClose, onSaved }: Props) {
  const [home, setHome] = useState("0");
  const [away, setAway] = useState("0");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [statRows, setStatRows] = useState<StatRow[]>([]);

  const { data: homePlayers } = useSWR<Player[]>(
    match.homeTeam ? `/api/teams/${match.homeTeam.id}/players` : null,
    () => apiFetch(`/api/teams/${match.homeTeam!.id}/players`)
  );
  const { data: awayPlayers } = useSWR<Player[]>(
    match.awayTeam ? `/api/teams/${match.awayTeam.id}/players` : null,
    () => apiFetch(`/api/teams/${match.awayTeam!.id}/players`)
  );
  const { data: statDefs } = useSWR<StatDef[]>(
    tournamentId ? `/api/tournaments/${tournamentId}/stat-definitions` : null,
    () => api.get(`/api/tournaments/${tournamentId}/stat-definitions`)
  );

  const addStatRow = (teamId: string) => {
    setStatRows((prev) => [...prev, { playerId: "", playerName: "", teamId, statDefId: statDefs?.[0]?.id ?? "", value: 1 }]);
  };

  const updateRow = (idx: number, patch: Partial<StatRow>) => {
    setStatRows((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeRow = (idx: number) => {
    setStatRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitScore = async (homeScore: number, awayScore: number, overrideReason?: string) => {
    setSaving(true);
    setError(null);
    try {
      const playerStats = statRows
        .filter((s) => s.playerId && s.statDefId)
        .map((s) => ({ playerId: s.playerId, statDefId: s.statDefId, value: s.value }));
      const payload: any = { homeScore, awayScore };
      if (playerStats.length > 0) payload.playerStats = playerStats;
      if (token) {
        await apiFetch(`/api/scores?token=${encodeURIComponent(token)}`, {
          method: "POST",
          body: JSON.stringify({ matchId: match.id, ...payload }),
        });
      } else if (isOverride) {
        payload.reason = overrideReason ?? reason;
        await api.put(`/api/matches/${match.id}/score/override`, payload);
      } else {
        await api.post(`/api/matches/${match.id}/score`, payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const homeScore = parseInt(home, 10);
    const awayScore = parseInt(away, 10);
    if (isNaN(homeScore) || isNaN(awayScore)) {
      setError("Enter valid scores");
      return;
    }
    await submitScore(homeScore, awayScore);
  };

  const walkover = async (winner: "home" | "away") => {
    const hs = winner === "home" ? 3 : 0;
    const as = winner === "away" ? 3 : 0;
    setHome(String(hs));
    setAway(String(as));
    await submitScore(hs, as, "Walkover");
  };

  const allPlayers = (teamId: string) => {
    if (teamId === match.homeTeam?.id) return homePlayers ?? [];
    return awayPlayers ?? [];
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {isOverride ? "Override score" : "Enter score"}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {match.homeTeam?.name} vs {match.awayTeam?.name}
        </p>

        {/* Score inputs — large tap targets for mobile */}
        <div className="flex items-center gap-3 mb-4">
          {[
            { label: match.homeTeam?.name, val: home, set: setHome },
            { label: match.awayTeam?.name, val: away, set: setAway },
          ].map((side, i) => {
            const n = parseInt(side.val, 10) || 0;
            return (
              <div key={i} className={`flex-1 text-center ${i === 0 ? "" : ""}`}>
                <p className="text-xs font-medium text-gray-500 mb-2 truncate">{side.label}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => side.set(String(Math.max(0, n - 1)))}
                    className="w-11 h-11 rounded-xl border-2 border-gray-200 text-gray-500 text-xl font-bold hover:border-gray-400 hover:bg-gray-50 active:scale-95 transition flex items-center justify-center select-none"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-4xl font-bold text-gray-900 tabular-nums">{n}</span>
                  <button
                    type="button"
                    onClick={() => side.set(String(n + 1))}
                    className="w-11 h-11 rounded-xl border-2 border-brand-400 text-brand-600 text-xl font-bold hover:border-brand-500 hover:bg-brand-50 active:scale-95 transition flex items-center justify-center select-none"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {isOverride && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Referee error corrected"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {/* Player stats toggle — only show when stat definitions exist */}
        {tournamentId && (statDefs?.length ?? 0) > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowStats(!showStats)}
              className="text-xs text-brand-600 hover:text-brand-800 font-medium mb-4 underline underline-offset-2"
            >
              {showStats ? "Hide player stats" : "Add player stats"}
            </button>

            {showStats && (
              <div className="mb-5 space-y-4">
                {[match.homeTeam, match.awayTeam].filter(Boolean).map((team) => (
                  <div key={team!.id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">{team!.name}</p>
                      <button
                        onClick={() => addStatRow(team!.id)}
                        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800"
                      >
                        <Plus className="w-3 h-3" /> Add stat
                      </button>
                    </div>
                    <div className="space-y-2">
                      {statRows.filter((s) => s.teamId === team!.id).map((row, rawIdx) => {
                        const idx = statRows.indexOf(row);
                        const players = allPlayers(team!.id);
                        return (
                          <div key={rawIdx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            {players.length > 0 ? (
                              <select
                                value={row.playerId}
                                onChange={(e) => {
                                  const p = players.find((pl) => pl.id === e.target.value);
                                  updateRow(idx, { playerId: e.target.value, playerName: p?.name ?? "" });
                                }}
                                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                              >
                                <option value="">Select player</option>
                                {players.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                placeholder="Player name"
                                value={row.playerName}
                                onChange={(e) => updateRow(idx, { playerName: e.target.value })}
                                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                              />
                            )}
                            <select
                              value={row.statDefId}
                              onChange={(e) => updateRow(idx, { statDefId: e.target.value })}
                              className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none"
                            >
                              <option value="">Stat type</option>
                              {statDefs?.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              value={row.value}
                              onChange={(e) => updateRow(idx, { value: Math.max(1, +e.target.value) })}
                              title="Count"
                              className="w-12 text-center border border-gray-200 rounded-md px-1 py-1 text-xs focus:outline-none"
                            />
                            <button onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-400 ml-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Walkover shortcut — only for new scores, not overrides */}
        {!isOverride && !token && match.homeTeam && match.awayTeam && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                <Flag className="w-3 h-3" /> Walkover / no-show
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => walkover("home")}
                className="flex-1 text-xs font-medium py-2 px-3 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition truncate"
              >
                {match.homeTeam.name} wins W/O
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => walkover("away")}
                className="flex-1 text-xs font-medium py-2 px-3 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition truncate"
              >
                {match.awayTeam.name} wins W/O
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : isOverride ? "Override" : "Save score"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
