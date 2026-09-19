"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Plus, ChevronRight, ArrowRightCircle, Trash2, CheckCircle, AlertTriangle, X } from "lucide-react";

interface Group { id: string; name: string; }
interface Bracket { id: string; size: number; }
interface Phase { id: string; name: string; type: string; status: string; groups: Group[]; brackets: Bracket[]; }
interface Division { id: string; name: string; matchDurationMinutes: number; halfDurationMinutes: number; phases: Phase[]; }

interface StandingRow { position: number; team: { id: string; name: string }; points: number; played: number; wins: number; draws: number; losses: number; goalDifference: number; }
interface Seeding { groupId: string | null; groupName: string; position: number; team: { id: string; name: string } | null; toPhaseName: string; toBracketSlot: { roundNumber: number; position: number } | null; }
interface AdvancePreview {
  incompleteMatches: number;
  nextPhase: { id: string; name: string } | null;
  groups: { id: string; name: string; standings: StandingRow[] }[];
  seedings: Seeding[];
}

function AdvancementPreviewModal({ phaseId, phaseName, onClose, onConfirm }: {
  phaseId: string; phaseName: string; onClose: () => void; onConfirm: (force: boolean) => void;
}) {
  const { data: preview } = useSWR<AdvancePreview>(
    `/api/phases/${phaseId}/advance-preview`,
    () => api.get(`/api/phases/${phaseId}/advance-preview`)
  );

  if (!preview) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-gray-400 text-sm">Loading preview…</div>
    </div>
  );

  const hasIncomplete = preview.incompleteMatches > 0;
  const hasSeedings = preview.seedings.length > 0;
  const hasNoNext = !preview.nextPhase;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Complete "{phaseName}"</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {preview.nextPhase ? `Advances to "${preview.nextPhase.name}"` : "This is the final phase — no next phase to advance to."}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 mt-0.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Incomplete warning */}
          {hasIncomplete && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span><strong>{preview.incompleteMatches} match{preview.incompleteMatches !== 1 ? "es" : ""}</strong> not yet completed. You can still advance but those results won't count toward standings.</span>
            </div>
          )}

          {/* Standings per group */}
          {preview.groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.name} standings</h3>
              <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-medium">Pos</th>
                      <th className="px-3 py-2 text-left font-medium">Team</th>
                      <th className="px-3 py-2 text-center font-medium">P</th>
                      <th className="px-3 py-2 text-center font-medium">W</th>
                      <th className="px-3 py-2 text-center font-medium">D</th>
                      <th className="px-3 py-2 text-center font-medium">L</th>
                      <th className="px-3 py-2 text-center font-medium">GD</th>
                      <th className="px-3 py-2 text-center font-medium">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.standings.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-3 text-gray-400 text-center">No standings yet</td></tr>
                    ) : group.standings.map((s) => {
                      const advances = preview.seedings.some((r) => r.groupId === group.id && r.position === s.position && r.team?.id === s.team.id);
                      return (
                        <tr key={s.position} className={advances ? "bg-green-50" : ""}>
                          <td className="px-3 py-2 font-medium text-gray-500">{s.position}</td>
                          <td className="px-3 py-2 font-medium text-gray-900 flex items-center gap-1.5">
                            {advances && <ArrowRightCircle className="w-3 h-3 text-green-500 shrink-0" />}
                            {s.team.name}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600">{s.played}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{s.wins}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{s.draws}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{s.losses}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                          <td className="px-3 py-2 text-center font-bold text-gray-900">{s.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Seeding summary */}
          {hasSeedings && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bracket seedings</h3>
              <div className="space-y-1">
                {preview.seedings.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 min-w-[100px]">{s.groupName} #{s.position}</span>
                    <ArrowRightCircle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className={s.team ? "font-medium text-gray-900" : "text-gray-400 italic"}>
                      {s.team?.name ?? "No team at this position yet"}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {s.toPhaseName}{s.toBracketSlot ? ` · R${s.toBracketSlot.roundNumber} Slot ${s.toBracketSlot.position}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasSeedings && !hasNoNext && (
            <p className="text-sm text-gray-400">No advancement rules configured. Set them up in the Advancement tab first, or this phase will be marked complete with no teams advancing.</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          {hasIncomplete ? (
            <>
              <button
                onClick={() => onConfirm(true)}
                className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition"
              >
                <CheckCircle className="w-4 h-4" /> Advance anyway
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirm(false)}
                className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition"
              >
                <CheckCircle className="w-4 h-4" /> Complete &amp; advance
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DivisionPage() {
  const { id: tournamentId, divisionId } = useParams<{ id: string; divisionId: string }>();
  const router = useRouter();
  const [showPhase, setShowPhase] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [phaseType, setPhaseType] = useState<"GROUP_STAGE" | "KNOCKOUT">("GROUP_STAGE");
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [previewPhase, setPreviewPhase] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [matchDuration, setMatchDuration] = useState("");
  const [halfDuration, setHalfDuration] = useState("");
  const [savingDurations, setSavingDurations] = useState(false);

  const { data: division, mutate } = useSWR<Division>(
    `/api/divisions/${divisionId}`,
    async () => {
      const t = await api.get<{ divisions: Division[] }>(`/api/tournaments/${tournamentId}`);
      return t.divisions.find((d) => d.id === divisionId)!;
    },
    {
      onSuccess: (d) => {
        setMatchDuration(String(d.matchDurationMinutes ?? 90));
        setHalfDuration(String(d.halfDurationMinutes ?? 45));
      },
    }
  );

  const saveDurations = async () => {
    setSavingDurations(true);
    try {
      await api.put(`/api/divisions/${divisionId}`, {
        matchDurationMinutes: parseInt(matchDuration, 10),
        halfDurationMinutes: parseInt(halfDuration, 10),
      });
      await mutate();
    } finally {
      setSavingDurations(false);
    }
  };

  const addPhase = async () => {
    if (!phaseName.trim()) return;
    await api.post(`/api/divisions/${divisionId}/phases`, { name: phaseName, type: phaseType });
    setPhaseName(""); setShowPhase(false);
    await mutate();
  };

  const deletePhase = async (phaseId: string, name: string) => {
    if (!confirm(`Delete phase "${name}"? This removes all groups, matches, and bracket data inside it.`)) return;
    setDeleting(phaseId);
    try {
      await api.delete(`/api/phases/${phaseId}`);
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const confirmAdvance = async (phaseId: string, force: boolean) => {
    setPreviewPhase(null);
    setAdvancing(phaseId);
    try {
      await api.post(`/api/phases/${phaseId}/start`, { force });
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdvancing(null);
    }
  };

  const statusColor: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <button onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format`)} className="hover:text-gray-700">Format</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{division?.name}</span>
      </div>

      {/* Match time settings */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Match time settings</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Match duration (min)</label>
            <input type="number" min={1} max={300} value={matchDuration} onChange={(e) => setMatchDuration(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Half duration (min)</label>
            <input type="number" min={1} max={150} value={halfDuration} onChange={(e) => setHalfDuration(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button onClick={saveDurations} disabled={savingDurations}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition">
            {savingDurations ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Used as defaults when auto-scheduling matches in this division.</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Phases</h2>
        <button onClick={() => setShowPhase(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition">
          <Plus className="w-3.5 h-3.5" /> Add phase
        </button>
      </div>

      {showPhase && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phase name</label>
            <input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPhase()} autoFocus
              placeholder="e.g. Group Stage"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-52" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={phaseType} onChange={(e) => setPhaseType(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="GROUP_STAGE">Group Stage</option>
              <option value="KNOCKOUT">Knockout</option>
            </select>
          </div>
          <button onClick={addPhase} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
          <button onClick={() => setShowPhase(false)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium">Cancel</button>
        </div>
      )}

      {!division ? (
        <div className="text-gray-400 text-sm text-center py-6">Loading…</div>
      ) : division.phases.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No phases yet. Add a Group Stage or Knockout phase.</div>
      ) : (
        <div className="space-y-3">
          {division.phases.map((phase) => (
            <div key={phase.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{phase.name}</span>
                  <span className="text-xs text-gray-400">{phase.type.replace("_", " ")}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[phase.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {phase.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Complete & advance — only for ACTIVE phases */}
                  {phase.status === "ACTIVE" && (
                    <button
                      onClick={() => setPreviewPhase({ id: phase.id, name: phase.name })}
                      disabled={advancing === phase.id}
                      className="flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-lg hover:bg-brand-100 transition disabled:opacity-50"
                    >
                      <ArrowRightCircle className="w-3 h-3" />
                      {advancing === phase.id ? "Advancing…" : "Complete & advance"}
                    </button>
                  )}
                  {/* Manage groups / bracket */}
                  {phase.type === "GROUP_STAGE" && (
                    <button
                      onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/phases/${phase.id}/groups`)}
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                    >
                      Groups <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {phase.type === "KNOCKOUT" && (
                    <button
                      onClick={() => router.push(`/dashboard/tournaments/${tournamentId}/format/phases/${phase.id}/bracket`)}
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                    >
                      Bracket <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {/* Delete — only PENDING phases */}
                  {phase.status === "PENDING" && (
                    <button
                      onClick={() => deletePhase(phase.id, phase.name)}
                      disabled={deleting === phase.id}
                      className="text-gray-300 hover:text-red-500 transition disabled:opacity-40"
                      title="Delete phase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-5 py-3 text-xs text-gray-400">
                {phase.type === "GROUP_STAGE"
                  ? `${phase.groups?.length ?? 0} group(s)`
                  : `${phase.brackets?.length ?? 0} bracket(s)`}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewPhase && (
        <AdvancementPreviewModal
          phaseId={previewPhase.id}
          phaseName={previewPhase.name}
          onClose={() => setPreviewPhase(null)}
          onConfirm={(force) => confirmAdvance(previewPhase.id, force)}
        />
      )}
    </div>
  );
}
