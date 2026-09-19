"use client";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useState } from "react";
import ScoreEntryModal from "./ScoreEntryModal";
import { Zap } from "lucide-react";

interface Team { id: string; name: string; }
interface BracketSlot { id: string; roundNumber: number; position: number; side: "HOME" | "AWAY"; team: Team | null; }
interface Match {
  id: string;
  roundNumber: number | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}
interface BracketDetail {
  id: string;
  size: number;
  slots: BracketSlot[];
  matches: Match[];
}

export default function BracketView({ bracketId, tournamentId }: { bracketId: string; tournamentId?: string }) {
  const [scoring, setScoring] = useState<Match | null>(null);
  const { data: bracket, mutate } = useSWR<BracketDetail>(
    `/api/brackets/${bracketId}`,
    () => api.get(`/api/brackets/${bracketId}`)
  );

  if (!bracket) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading bracket...
      </div>
    );
  }

  const totalRounds = Math.log2(bracket.size);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  const matchByRound: Record<number, Match[]> = {};
  for (const m of bracket.matches) {
    const r = m.roundNumber ?? 1;
    if (!matchByRound[r]) matchByRound[r] = [];
    matchByRound[r].push(m);
  }

  const roundLabel = (r: number) => {
    const remaining = totalRounds - r + 1;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semi-finals";
    if (remaining === 3) return "Quarter-finals";
    return `Round ${r}`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max pb-4 pt-2 px-1">
        {rounds.map((r) => {
          const isLast = r === totalRounds;
          return (
            <div key={r} className="flex flex-col gap-4" style={{ minWidth: 220 }}>
              <div className="flex items-center justify-center">
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                  isLast ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {roundLabel(r)}
                </span>
              </div>
              <div className="flex flex-col gap-3 flex-1 justify-around">
                {(matchByRound[r] ?? []).map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isFinal={isLast}
                    onClick={() => match.homeTeam && match.awayTeam && setScoring(match)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {scoring && (
        <ScoreEntryModal
          match={scoring}
          tournamentId={tournamentId ?? ""}
          onClose={() => setScoring(null)}
          onSaved={() => { setScoring(null); mutate(); }}
          isOverride={scoring.status === "COMPLETED"}
        />
      )}
    </div>
  );
}

function MatchCard({ match, isFinal, onClick }: { match: Match; isFinal: boolean; onClick: () => void }) {
  const hasScore = match.homeScore !== null;
  const homeWins = hasScore && match.homeScore! > match.awayScore!;
  const awayWins = hasScore && match.awayScore! > match.homeScore!;
  const isComplete = match.status === "COMPLETED";
  const canScore = match.homeTeam && match.awayTeam;

  return (
    <div
      onClick={canScore ? onClick : undefined}
      className={`rounded-xl overflow-hidden border transition-all ${
        isFinal
          ? "border-yellow-200 shadow-md shadow-yellow-100/50"
          : "border-gray-200"
      } ${
        canScore ? "cursor-pointer hover:border-brand-300 hover:shadow-sm" : ""
      }`}
    >
      <MatchRow
        team={match.homeTeam}
        score={match.homeScore}
        isWinner={homeWins}
        isFinal={isFinal}
      />
      <div className="h-px bg-gray-100" />
      <MatchRow
        team={match.awayTeam}
        score={match.awayScore}
        isWinner={awayWins}
        isFinal={isFinal}
      />
      {canScore && !isComplete && (
        <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-500">
            <Zap className="w-2.5 h-2.5" />
            Score
          </span>
        </div>
      )}
    </div>
  );
}

function MatchRow({
  team,
  score,
  isWinner,
  isFinal,
}: {
  team: Team | null;
  score: number | null;
  isWinner: boolean;
  isFinal: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 ${
      isWinner
        ? isFinal
          ? "bg-yellow-50"
          : "bg-brand-50"
        : ""
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {isWinner && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFinal ? "bg-yellow-400" : "bg-brand-500"}`} />
        )}
        <span className={`text-xs truncate max-w-[140px] ${
          team
            ? isWinner
              ? isFinal
                ? "font-bold text-yellow-800"
                : "font-bold text-brand-700"
              : "text-gray-700"
            : "text-gray-400 italic"
        }`}>
          {team?.name ?? "TBD"}
        </span>
      </div>
      {score !== null && (
        <span className={`text-sm font-black ml-2 shrink-0 ${
          isWinner
            ? isFinal ? "text-yellow-700" : "text-brand-700"
            : "text-gray-400"
        }`}>
          {score}
        </span>
      )}
    </div>
  );
}
