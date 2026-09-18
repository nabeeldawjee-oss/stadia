"use client";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { Users, GitBranch, Calendar, Trophy, Activity, Clock, MapPin, Pencil, CheckCircle, Circle, PlayCircle } from "lucide-react";
import { useState } from "react";
import ScoreEntryModal from "@/components/ScoreEntryModal";

interface TournamentDetail {
  id: string;
  name: string;
  sport: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { teams?: number };
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

  const [scoringMatch, setScoringMatch] = useState<{ id: string; homeTeam: { id: string; name: string } | null; awayTeam: { id: string; name: string } | null; status: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  if (!t) return <div className="text-gray-400 py-8 text-center">Loading...</div>;

  const statusColor: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    PUBLISHED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-purple-100 text-purple-700",
  };

  const stats = [
    { icon: Users, label: "Teams", value: t.teams?.length ?? 0 },
    { icon: GitBranch, label: "Divisions", value: t.divisions?.length ?? 0 },
    { icon: Activity, label: "Status", value: t.status },
  ];

  const pending = todayMatches?.filter((s) => s.match.status === "SCHEDULED") ?? [];
  const live = todayMatches?.filter((s) => s.match.status === "IN_PROGRESS") ?? [];
  const done = todayMatches?.filter((s) => s.match.status === "COMPLETED") ?? [];
  const hasToday = (todayMatches?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Status + dates */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold text-gray-900">{t.name}</h2>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                {t.status}
              </span>
            </div>
            {t.description && <p className="text-gray-500 text-sm">{t.description}</p>}
            {(t.startDate || t.endDate) && (
              <p className="text-sm text-gray-400 mt-2">
                {t.startDate ? new Date(t.startDate).toLocaleDateString() : "TBD"}
                {" — "}
                {t.endDate ? new Date(t.endDate).toLocaleDateString() : "TBD"}
              </p>
            )}
          </div>
          <Trophy className="w-8 h-8 text-brand-200" />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's matches — live scoring hub */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Today's matches</h3>
            {hasToday && (
              <div className="flex items-center gap-2 ml-2">
                {live.length > 0 && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {live.length} live
                  </span>
                )}
                {pending.length > 0 && (
                  <span className="text-xs text-gray-400">{pending.length} upcoming</span>
                )}
                {done.length > 0 && (
                  <span className="text-xs text-gray-400">{done.length} done</span>
                )}
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
          <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : !hasToday ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">No matches scheduled for today.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {[...live, ...pending, ...done].map((s) => {
              const isLive = s.match.status === "IN_PROGRESS";
              const isDone = s.match.status === "COMPLETED";
              const nextStatus = STATUS_CYCLE[s.match.status];
              const toggling = togglingId === s.match.id;

              return (
                <div key={s.id} className={`px-6 py-3 flex items-center gap-4 ${isLive ? "bg-green-50/40" : ""}`}>
                  {/* Time + field */}
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

                  {/* Teams + score */}
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

                  {/* Status badge */}
                  <div className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isDone ? "bg-purple-100 text-purple-700" :
                    isLive ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {isLive ? "LIVE" : isDone ? "FT" : "KO"}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {/* Status toggle: Scheduled→Live→Done */}
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
                    {/* Score entry */}
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
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="font-medium text-gray-700 mb-4">Quick links</h3>
        <a
          href={`/t/${t.status !== "DRAFT" ? (t as any).slug : "#"}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 text-sm text-brand-600 hover:underline ${t.status === "DRAFT" ? "opacity-40 pointer-events-none" : ""}`}
        >
          Public tournament page →
        </a>
        {t.status === "DRAFT" && (
          <p className="text-xs text-gray-400 mt-1">Publish the tournament to share the public link.</p>
        )}
      </div>

      {scoringMatch && (
        <ScoreEntryModal
          match={scoringMatch}
          onClose={() => setScoringMatch(null)}
          onSaved={() => {
            setScoringMatch(null);
            mutateTodayMatches();
            globalMutate((key: unknown) => typeof key === "string" && key.includes(id));
          }}
        />
      )}
    </div>
  );
}
