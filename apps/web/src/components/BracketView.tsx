"use client";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useState } from "react";
import ScoreEntryModal from "./ScoreEntryModal";

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

export default function BracketView({ bracketId }: { bracketId: string }) {
  const [scoring, setScoring] = useState<Match | null>(null);
  const { data: bracket, mutate } = useSWR<BracketDetail>(
    `/api/brackets/${bracketId}`,
    () => api.get(`/api/brackets/${bracketId}`)
  );

  if (!bracket) return <div className="text-gray-400 text-sm py-4">Loading bracket...</div>;

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
      <div className="flex gap-4 min-w-max pb-2">
        {rounds.map((r) => (
          <div key={r} className="flex flex-col gap-3 min-w-[180px]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">{roundLabel(r)}</p>
            {(matchByRound[r] ?? []).map((match) => (
              <div
                key={match.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-brand-300 transition"
                onClick={() => match.homeTeam && match.awayTeam && setScoring(match)}
              >
                <MatchRow team={match.homeTeam} score={match.homeScore} isWinner={match.homeScore !== null && match.homeScore > (match.awayScore ?? 0)} />
                <div className="h-px bg-gray-100" />
                <MatchRow team={match.awayTeam} score={match.awayScore} isWinner={match.awayScore !== null && match.awayScore > (match.homeScore ?? 0)} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {scoring && (
        <ScoreEntryModal
          match={scoring}
          onClose={() => setScoring(null)}
          onSaved={() => { setScoring(null); mutate(); }}
          isOverride={scoring.status === "COMPLETED"}
        />
      )}
    </div>
  );
}

function MatchRow({ team, score, isWinner }: { team: Team | null; score: number | null; isWinner: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 text-xs ${isWinner ? "bg-brand-50" : ""}`}>
      <span className={`truncate max-w-[110px] ${team ? (isWinner ? "font-bold text-brand-700" : "text-gray-700") : "text-gray-400 italic"}`}>
        {team?.name ?? "TBD"}
      </span>
      {score !== null && (
        <span className={`font-bold ml-2 ${isWinner ? "text-brand-700" : "text-gray-500"}`}>{score}</span>
      )}
    </div>
  );
}
