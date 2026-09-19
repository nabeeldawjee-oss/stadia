"use client";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { X, Trophy, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

interface Team { id: string; name: string; }
interface Standing { position: number; team: Team; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number; }
interface Group { id: string; name: string; standings: Standing[]; }
interface BracketSlot { label: string; }
interface Seeding { groupId: string; groupName: string; position: number; team: Team | null; toBracketSlot: BracketSlot | null; }
interface AdvancePreview {
  incompleteMatches: number;
  nextPhase: { id: string; name: string } | null;
  groups: Group[];
  seedings: Seeding[];
}

interface Props {
  phaseId: string;
  onClose: () => void;
  onStarted: () => void;
}

export default function PhaseTransitionModal({ phaseId, onClose, onStarted }: Props) {
  const [starting, setStarting] = useState(false);
  const { data: preview } = useSWR<AdvancePreview>(
    `/api/phases/${phaseId}/advance-preview`,
    () => api.get(`/api/phases/${phaseId}/advance-preview`)
  );

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post(`/api/phases/${phaseId}/start`, {});
      onStarted();
    } catch (err: any) {
      alert(err.message);
      setStarting(false);
    }
  };

  const slotsConfigured = (preview?.seedings ?? []).some((s) => s.team !== null);
  const canStart = preview && preview.incompleteMatches === 0 && slotsConfigured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs">Group phase complete</p>
              <h2 className="text-white font-bold text-lg">
                Start {preview?.nextPhase?.name ?? "next phase"}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!preview ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading preview...
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Group standings */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Final standings</h3>
                  {preview.groups.map((group) => (
                    <div key={group.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600">{group.name}</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-200">
                            <th className="text-left px-3 py-1.5">#</th>
                            <th className="text-left px-3 py-1.5">Team</th>
                            <th className="text-center px-2 py-1.5">W</th>
                            <th className="text-center px-2 py-1.5">D</th>
                            <th className="text-center px-2 py-1.5">L</th>
                            <th className="text-center px-2 py-1.5 font-bold">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.standings.map((row) => (
                            <tr key={row.position} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-1.5 text-gray-400">{row.position}</td>
                              <td className="px-3 py-1.5 font-medium text-gray-900">{row.team.name}</td>
                              <td className="text-center px-2 py-1.5 text-gray-600">{row.won}</td>
                              <td className="text-center px-2 py-1.5 text-gray-600">{row.drawn}</td>
                              <td className="text-center px-2 py-1.5 text-gray-600">{row.lost}</td>
                              <td className="text-center px-2 py-1.5 font-bold text-gray-900">{row.points}</td>
                            </tr>
                          ))}
                          {group.standings.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 py-3 text-center text-gray-400 text-xs italic">No standings yet</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* Right: Bracket seedings */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bracket assignments</h3>
                  {preview.seedings.length === 0 || !slotsConfigured ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Bracket slots not configured</p>
                          <p className="text-xs text-amber-600 mt-1">
                            Go to Format → Knockout phase and assign group positions to each bracket slot.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                      <div className="divide-y divide-gray-100">
                        {preview.seedings.map((s, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2.5">
                            <span className="text-xs text-gray-500 truncate max-w-[110px]">
                              {s.toBracketSlot?.label ?? `Slot ${i + 1}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-3 h-3 text-gray-300" />
                              {s.team ? (
                                <span className="text-xs font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
                                  {s.team.name}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Not assigned</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                {preview.incompleteMatches > 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {preview.incompleteMatches} match{preview.incompleteMatches !== 1 ? "es" : ""} still pending
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={!canStart || starting}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  {starting ? "Starting..." : `Start ${preview?.nextPhase?.name ?? "phase"}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
