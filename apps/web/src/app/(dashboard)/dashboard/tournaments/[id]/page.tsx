"use client";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { Users, GitBranch, Calendar, Trophy, Clock, MapPin, Pencil, CheckCircle, PlayCircle, BarChart2, ChevronRight, Globe, X, Undo2, ExternalLink, Copy, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import ScoreEntryModal from "@/components/ScoreEntryModal";
import PhaseTransitionModal from "@/components/PhaseTransitionModal";
import RankingModal from "@/components/RankingModal";

interface TournamentDetail {
  id: string;
  name: string;
  sport: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  slug?: string;
  divisions?: { id: string; name: string }[];
  teams?: { id: string }[];
}

interface ScheduledMatch {
  id: string;
  startTime: string;
  field: { id: string; name: string };
  match: {
    id: string;
    homeTeam: { id: string; name: string } | null;
    awayTeam: { id: string; name: string } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  };
}

interface PhaseProgress {
  id: string;
  name: string;
  type: string;
  status: string;
  totalMatches: number;
  completedMatches: number;
  nextPhaseId: string | null;
  divisionName: string;
}

const STATUS_CYCLE: Record<string, string | null> = {
  SCHEDULED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
};

export default function TournamentOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { mutate: globalMutate } = useSWRConfig();
  const today = new Date().toISOString().split("T")[0];

  const { data: t } = useSWR<TournamentDetail>(`/api/tournaments/${id}`, () => api.get(`/api/tournaments/${id}`));
  const { data: todayMatches, mutate: mutateTodayMatches } = useSWR<ScheduledMatch[]>(
    `/api/tournaments/${id}/schedule?day=${today}`,
    () => api.get(`/api/tournaments/${id}/schedule?day=${today}`)
  );
  const { data: progress, mutate: mutateProgress } = useSWR<PhaseProgress[]>(
    `/api/tournaments/${id}/progress`,
    () => api.get(`/api/tournaments/${id}/progress`)
  );

  const [scoringMatch, setScoringMatch] = useState<{ id: string; homeTeam: { id: string; name: string } | null; awayTeam: { id: string; name: string } | null; status: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    if (!t) return;
    setEditName(t.name);
    setEditDesc(t.description ?? "");
    setEditStart(t.startDate ? t.startDate.split("T")[0] : "");
    setEditEnd(t.endDate ? t.endDate.split("T")[0] : "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/api/tournaments/${id}`, {
        name: editName,
        description: editDesc || null,
        startDate: editStart || null,
        endDate: editEnd || null,
      });
      await globalMutate(`/api/tournaments/${id}`);
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      await api.put(`/api/tournaments/${id}`, { status: "ACTIVE" });
      await globalMutate(`/api/tournaments/${id}`);
    } finally {
      setPublishing(false);
    }
  };
  const [transitionPhaseId, setTransitionPhaseId] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  // Auto-fire phase transition modal when a group stage finishes
  useEffect(() => {
    if (!progress) return;
    const ready = progress.find(
      (p) =>
        p.type === "GROUP_STAGE" &&
        p.status === "ACTIVE" &&
        p.totalMatches > 0 &&
        p.completedMatches === p.totalMatches &&
        p.nextPhaseId !== null &&
        !dismissedRef.current.has(p.id)
    );
    if (ready && !transitionPhaseId) {
      setTransitionPhaseId(ready.id);
    }
  }, [progress]);

  const advanceStatus = async (matchId: string, currentStatus: string) => {
    const next = STATUS_CYCLE[currentStatus];
    if (!next) return;
    setTogglingId(matchId);
    try {
      await api.put(`/api/matches/${matchId}/status`, { status: next });
      await mutateTodayMatches();
      await globalMutate((key: unknown) => typeof key === "string" && key.includes(id));
    } finally {
      setTogglingId(null);
    }
  };

  const handleScoreSaved = async () => {
    setScoringMatch(null);
    await mutateTodayMatches();
    await mutateProgress();
    globalMutate((key: unknown) => typeof key === "string" && key.includes(id));
  };

  const handleTransitionClose = () => {
    if (transitionPhaseId) dismissedRef.current.add(transitionPhaseId);
    setTransitionPhaseId(null);
  };

  const handleTransitionStarted = async () => {
    setTransitionPhaseId(null);
    await mutateProgress();
    globalMutate((key: unknown) => typeof key === "string" && key.includes(id));
  };

  const [undoing, setUndoing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const handleUndo = async (phaseId: string) => {
    if (!confirm("Undo this phase transition? The next phase will be reset to Pending and bracket seeds cleared.")) return;
    setUndoing(phaseId);
    try {
      await api.post(`/api/phases/${phaseId}/undo`, {});
      await mutateProgress();
      globalMutate((key: unknown) => typeof key === "string" && key.includes(id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUndoing(null);
    }
  };

  if (!t) return <div className="text-gray-400 py-12 text-center">Loading...</div>;

  const pending = todayMatches?.filter((s) => s.match.status === "SCHEDULED") ?? [];
  const live = todayMatches?.filter((s) => s.match.status === "IN_PROGRESS") ?? [];
  const done = todayMatches?.filter((s) => s.match.status === "COMPLETED") ?? [];
  const hasToday = (todayMatches?.length ?? 0) > 0;

  const isComplete = (progress?.length ?? 0) > 0 && (progress ?? []).every(
    (p) => p.status === "COMPLETED" || (p.totalMatches > 0 && p.completedMatches === p.totalMatches)
  );

  // Find any group stage phase ready for transition (for manual trigger button)
  const readyForTransition = progress?.find(
    (p) =>
      p.type === "GROUP_STAGE" &&
      p.status === "ACTIVE" &&
      p.totalMatches > 0 &&
      p.completedMatches === p.totalMatches &&
      p.nextPhaseId !== null
  );

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {t.description && <p className="text-gray-500 text-sm mt-1">{t.description}</p>}
            {(t.startDate || t.endDate) && (
              <p className="text-sm text-gray-400 mt-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {t.startDate ? new Date(t.startDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "TBD"}
                {" — "}
                {t.endDate ? new Date(t.endDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "TBD"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={openEdit}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Edit tournament"
            >
              <Pencil className="w-4 h-4" />
            </button>
            {t.status === "DRAFT" && (
              <button
                onClick={publish}
                disabled={publishing}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition shadow-sm disabled:opacity-50"
              >
                <Globe className="w-4 h-4" />
                {publishing ? "Publishing…" : "Publish"}
              </button>
            )}
            {isComplete && (
              <button
                onClick={() => setShowRanking(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-sm"
              >
                <Trophy className="w-4 h-4" />
                Rankings
              </button>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: Users, label: "Teams", value: t.teams?.length ?? 0, color: "text-brand-600 bg-brand-50" },
            { icon: GitBranch, label: "Divisions", value: t.divisions?.length ?? 0, color: "text-violet-600 bg-violet-50" },
            { icon: BarChart2, label: "Phases", value: progress?.length ?? 0, color: "text-emerald-600 bg-emerald-50" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase progress */}
      {progress && progress.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Phase progress</h3>
            {readyForTransition && !transitionPhaseId && (
              <button
                onClick={() => setTransitionPhaseId(readyForTransition.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition"
              >
                Start {progress.find((p) => p.id === readyForTransition.nextPhaseId)?.name ?? "next phase"}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {progress.map((phase) => {
              const pct = phase.totalMatches > 0 ? (phase.completedMatches / phase.totalMatches) * 100 : 0;
              const isPhaseComplete = phase.totalMatches > 0 && phase.completedMatches === phase.totalMatches;
              const isKnockoutPending = phase.type === "KNOCKOUT" && phase.status === "PENDING";

              return (
                <div key={phase.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{phase.name}</span>
                      {progress.length > 1 && (
                        <span className="text-xs text-gray-400">{phase.divisionName}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        phase.status === "COMPLETED" || isPhaseComplete
                          ? "bg-green-100 text-green-700"
                          : phase.status === "ACTIVE"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {isKnockoutPending ? "Pending start" : isPhaseComplete ? "Complete" : phase.status === "ACTIVE" ? "In progress" : phase.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">
                        {phase.completedMatches}/{phase.totalMatches}
                      </span>
                      {phase.status === "COMPLETED" && phase.type === "GROUP_STAGE" && phase.nextPhaseId && (
                        <button
                          onClick={() => handleUndo(phase.id)}
                          disabled={undoing === phase.id}
                          title="Undo phase transition"
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 hover:bg-amber-50 px-2 py-0.5 rounded-lg transition disabled:opacity-40"
                        >
                          <Undo2 className="w-3 h-3" />
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPhaseComplete ? "bg-green-500" : "bg-brand-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's matches */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Today's matches</h3>
            {hasToday && (
              <div className="flex items-center gap-2 ml-1">
                {live.length > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {live.length} live
                  </span>
                )}
                {pending.length > 0 && <span className="text-xs text-gray-400">{pending.length} upcoming</span>}
                {done.length > 0 && <span className="text-xs text-gray-400">{done.length} done</span>}
              </div>
            )}
          </div>
          {hasToday && (
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          )}
        </div>

        {!todayMatches ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : !hasToday ? (
          <div className="px-6 py-10 text-center">
            <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No matches scheduled for today.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {[...live, ...pending, ...done].map((s) => {
              const isLive = s.match.status === "IN_PROGRESS";
              const isDone = s.match.status === "COMPLETED";
              const nextStatus = STATUS_CYCLE[s.match.status];
              const toggling = togglingId === s.match.id;

              return (
                <div key={s.id} className={`px-6 py-3 flex items-center gap-4 ${isLive ? "bg-green-50/40" : ""}`}>
                  <div className="w-28 shrink-0">
                    <div className="flex items-center gap-1 text-xs font-mono text-gray-500">
                      <Clock className="w-3 h-3" />
                      {new Date(s.startTime).toLocaleTimeString("en-ZA", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {s.field.name}
                    </div>
                  </div>

                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <span className={`flex-1 text-right text-sm font-medium truncate ${isLive ? "text-green-800" : "text-gray-900"}`}>
                      {s.match.homeTeam?.name ?? "TBD"}
                    </span>
                    <div className="shrink-0 text-center min-w-[60px]">
                      {s.match.homeScore !== null ? (
                        <span className="text-base font-bold text-gray-900">
                          {s.match.homeScore} – {s.match.awayScore}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 font-medium">vs</span>
                      )}
                    </div>
                    <span className={`flex-1 text-left text-sm font-medium truncate ${isLive ? "text-green-800" : "text-gray-900"}`}>
                      {s.match.awayTeam?.name ?? "TBD"}
                    </span>
                  </div>

                  <div className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isDone ? "bg-purple-100 text-purple-700" :
                    isLive ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {isLive ? "LIVE" : isDone ? "FT" : "KO"}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {nextStatus && s.match.homeTeam && s.match.awayTeam && (
                      <button
                        onClick={() => advanceStatus(s.match.id, s.match.status)}
                        disabled={toggling}
                        title={nextStatus === "IN_PROGRESS" ? "Start match" : "End match"}
                        className={`p-1.5 rounded-lg transition disabled:opacity-40 ${
                          nextStatus === "IN_PROGRESS"
                            ? "text-gray-400 hover:text-green-600 hover:bg-green-50"
                            : "text-green-600 hover:text-purple-600 hover:bg-purple-50"
                        }`}
                      >
                        {nextStatus === "IN_PROGRESS"
                          ? <PlayCircle className="w-4 h-4" />
                          : <CheckCircle className="w-4 h-4" />}
                      </button>
                    )}
                    {s.match.status !== "CANCELLED" && s.match.homeTeam && s.match.awayTeam && (
                      <button
                        onClick={() => setScoringMatch(s.match)}
                        className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition ${
                          isDone
                            ? "bg-gray-50 text-gray-400 hover:bg-gray-100"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                        {isDone ? "Edit" : "Score"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      {(() => {
        const slug = (t as any).slug as string | undefined;
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const publicUrl = slug ? `${baseUrl}/t/${slug}` : null;
        const regUrl = slug ? `${baseUrl}/t/${slug}/register` : null;
        const isDraft = t.status === "DRAFT";

        const copyLink = async (url: string, key: string) => {
          await navigator.clipboard.writeText(url);
          setCopied(key);
          setTimeout(() => setCopied(null as any), 2000);
        };

        const rows = [
          { label: "Public page", url: publicUrl },
          { label: "Registration form", url: regUrl },
        ];

        return (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-medium text-gray-700 text-sm mb-3">Quick links</h3>
            {isDraft ? (
              <p className="text-xs text-gray-400">Publish the tournament to share these links.</p>
            ) : (
              <div className="space-y-2">
                {rows.map(({ label, url }) => url && (
                  <div key={label} className="flex items-center gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-sm text-brand-600 hover:underline truncate flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </a>
                    <button
                      onClick={() => copyLink(url, label)}
                      className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title="Copy link"
                    >
                      {(copied as any) === label ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Score entry modal */}
      {scoringMatch && (
        <ScoreEntryModal
          match={scoringMatch}
          tournamentId={id}
          isOverride={scoringMatch.status === "COMPLETED"}
          onClose={() => setScoringMatch(null)}
          onSaved={handleScoreSaved}
        />
      )}

      {/* Phase transition modal */}
      {transitionPhaseId && (
        <PhaseTransitionModal
          phaseId={transitionPhaseId}
          onClose={handleTransitionClose}
          onStarted={handleTransitionStarted}
        />
      )}

      {/* Ranking modal */}
      {showRanking && (
        <RankingModal
          tournamentId={id}
          onClose={() => setShowRanking(false)}
        />
      )}

      {/* Quick edit modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Edit tournament</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving || !editName.trim()}
                className="px-4 py-2 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
