"use client";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useState } from "react";
import ScoreEntryModal from "./ScoreEntryModal";
import { Zap, UserPlus, X } from "lucide-react";

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
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const { data: bracket, mutate } = useSWR<BracketDetail>(
    `/api/brackets/${bracketId}`,
    () => api.get(`/api/brackets/${bracketId}`)
  );
  const { data: teamsData } = useSWR<Team[]>(
    tournamentId ? `/api/tournaments/${tournamentId}/teams` : null,
    () => api.get(`/api/tournaments/${tournamentId}/teams`)
  );
  const { data: qualifiersData } = useSWR<{ label: string; team: Team }[]>(
    `/api/brackets/${bracketId}/qualifiers`,
    () => api.get(`/api/brackets/${bracketId}/qualifiers`)
  );
  const allTeams: Team[] = teamsData ?? [];
  const qualifiers: { label: string; team: Team }[] = qualifiersData ?? [];

  if (!bracket) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading bracket...
      </div>
    );
  }

  if (bracket.matches.length === 0) {
    const generate = async () => {
      setGenerating(true);
      setGenError(null);
      try {
        await api.post(`/api/brackets/${bracketId}/generate-matches`, {});
        await mutate();
      } catch (err: any) {
        setGenError(err.message ?? "Failed to generate matches");
      } finally {
        setGenerating(false);
      }
    };
    return (
      <div className="text-center py-10 text-gray-400 text-sm space-y-3">
        <p>Bracket created. Generate match slots to start seeding teams.</p>
        {genError && <p className="text-red-500 text-xs">{genError}</p>}
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50 mx-auto"
        >
          <Zap className="w-3.5 h-3.5" />
          {generating ? "Generating..." : "Generate matches"}
        </button>
      </div>
    );
  }

  const totalRounds = Math.log2(bracket.size);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  // Deduplicate matches — keep one per (roundNumber, homeSlotId/awaySlotId) pair
  const seenSlotPairs = new Set<string>();
  const uniqueMatches: Match[] = [];
  for (const m of bracket.matches) {
    // Use roundNumber + first occurrence per slot combination
    const key = `${m.roundNumber}`;
    // Actually use homeTeam/awayTeam combo
    const pairKey = `${m.roundNumber}-${(m.homeTeam?.id ?? "tbd")}-${(m.awayTeam?.id ?? "tbd")}`;
    if (!seenSlotPairs.has(pairKey)) {
      seenSlotPairs.add(pairKey);
      uniqueMatches.push(m);
    }
  }

  // Build match lookup by round — prefer matches where both teams are seeded
  const matchByRound: Record<number, Match[]> = {};
  for (const m of uniqueMatches) {
    const r = m.roundNumber ?? 1;
    if (!matchByRound[r]) matchByRound[r] = [];
    matchByRound[r].push(m);
  }

  // Slot lookup by (round, position, side) for seeding UI
  const slotMap: Record<string, BracketSlot> = {};
  for (const s of bracket.slots) {
    slotMap[`${s.roundNumber}-${s.position}-${s.side}`] = s;
  }

  // Seeded team IDs per round (to exclude from dropdowns)
  const seededIds = new Set(bracket.slots.map(s => s.team?.id).filter(Boolean) as string[]);

  const seedSlot = async (slotId: string, teamId: string | null) => {
    await api.put(`/api/bracket-slots/${slotId}/seed`, { teamId });
    await mutate();
  };

  const roundLabel = (r: number, pos?: number) => {
    if (pos === 2) return "3rd Place";
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
          const matches = matchByRound[r] ?? [];
          // For rounds with no matches yet (all TBD), synthesise one card per expected slot pair
          const matchesInRound = bracket.size / Math.pow(2, r);
          const cards = matches.length > 0
            ? matches
            : Array.from({ length: matchesInRound }, (_, i) => ({
                id: `placeholder-${r}-${i + 1}`,
                roundNumber: r,
                homeTeam: null,
                awayTeam: null,
                homeScore: null,
                awayScore: null,
                status: "PENDING",
              } as Match));

          return (
            <div key={r} className="flex flex-col gap-4" style={{ minWidth: 240 }}>
              <div className="flex items-center justify-center">
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                  isLast ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {roundLabel(r)}
                </span>
              </div>
              <div className="flex flex-col gap-3 flex-1 justify-around">
                {cards.map((match, idx) => {
                  const pos = idx + 1;
                  const homeSlot = slotMap[`${r}-${pos}-HOME`];
                  const awaySlot = slotMap[`${r}-${pos}-AWAY`];
                  const isThirdPlace = isLast && pos === 2;
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isFinal={isLast && !isThirdPlace}
                      isThirdPlace={isThirdPlace}
                      homeSlot={homeSlot}
                      awaySlot={awaySlot}
                      allTeams={allTeams}
                      qualifiers={qualifiers}
                      seededIds={seededIds}
                      onScore={() => match.homeTeam && match.awayTeam && setScoring(match)}
                      onSeed={seedSlot}
                    />
                  );
                })}
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

function MatchCard({
  match,
  isFinal,
  isThirdPlace,
  homeSlot,
  awaySlot,
  allTeams,
  qualifiers,
  seededIds,
  onScore,
  onSeed,
}: {
  match: Match;
  isFinal: boolean;
  isThirdPlace?: boolean;
  homeSlot?: BracketSlot;
  awaySlot?: BracketSlot;
  allTeams: Team[];
  qualifiers: { label: string; team: Team }[];
  seededIds: Set<string>;
  onScore: () => void;
  onSeed: (slotId: string, teamId: string | null) => Promise<void>;
}) {
  const hasScore = match.homeScore !== null;
  const homeWins = hasScore && match.homeScore! > match.awayScore!;
  const awayWins = hasScore && match.awayScore! > match.homeScore!;
  const isComplete = match.status === "COMPLETED";
  const canScore = !!(match.homeTeam && match.awayTeam);

  return (
    <div
      className={`rounded-xl overflow-hidden border transition-all ${
        isFinal
          ? "border-yellow-200 shadow-md shadow-yellow-100/50"
          : isThirdPlace
          ? "border-orange-200 shadow-sm shadow-orange-100/50"
          : "border-gray-200"
      }`}
    >
      <SlotRow
        team={match.homeTeam}
        score={match.homeScore}
        isWinner={homeWins}
        hasScore={hasScore}
        isFinal={isFinal}
        isThirdPlace={isThirdPlace}
        slot={homeSlot}
        allTeams={allTeams}
        qualifiers={qualifiers}
        seededIds={seededIds}
        onSeed={onSeed}
      />
      <div className="h-px bg-gray-100" />
      <SlotRow
        team={match.awayTeam}
        score={match.awayScore}
        isWinner={awayWins}
        hasScore={hasScore}
        isFinal={isFinal}
        isThirdPlace={isThirdPlace}
        slot={awaySlot}
        allTeams={allTeams}
        qualifiers={qualifiers}
        seededIds={seededIds}
        onSeed={onSeed}
      />
      {canScore && !isComplete && (
        <div
          onClick={onScore}
          className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end cursor-pointer hover:bg-gray-100 transition"
        >
          <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-500">
            <Zap className="w-2.5 h-2.5" />
            Score
          </span>
        </div>
      )}
    </div>
  );
}

function SlotRow({
  team,
  score,
  isWinner,
  hasScore,
  isFinal,
  isThirdPlace,
  slot,
  allTeams,
  qualifiers,
  seededIds,
  onSeed,
}: {
  team: Team | null;
  score: number | null;
  isWinner: boolean;
  hasScore: boolean;
  isFinal: boolean;
  isThirdPlace?: boolean;
  slot?: BracketSlot;
  allTeams: Team[];
  qualifiers: { label: string; team: Team }[];
  seededIds: Set<string>;
  onSeed: (slotId: string, teamId: string | null) => Promise<void>;
}) {
  const [seeding, setSeeding] = useState(false);
  const [open, setOpen] = useState(false);
  // Show qualifiers if available, otherwise fall back to all teams
  const isLoser = hasScore && !isWinner;
  const seedOptions = qualifiers.length > 0
    ? qualifiers.filter(q => !seededIds.has(q.team.id) || q.team.id === team?.id)
    : allTeams.filter(t => !seededIds.has(t.id) || t.id === team?.id).map(t => ({ label: t.name, team: t }));

  const handleSeed = async (teamId: string | null) => {
    if (!slot) return;
    setSeeding(true);
    setOpen(false);
    try { await onSeed(slot.id, teamId); } finally { setSeeding(false); }
  };

  const winnerColor = isThirdPlace ? "bg-orange-50" : isFinal ? "bg-yellow-50" : "bg-brand-50";
  const dotColor = isThirdPlace ? "bg-orange-400" : isFinal ? "bg-yellow-400" : "bg-brand-500";
  const scoreColor = isThirdPlace ? "text-orange-600" : isFinal ? "text-yellow-700" : "text-brand-700";
  const nameColor = isWinner
    ? isThirdPlace ? "font-bold text-orange-800" : isFinal ? "font-bold text-yellow-800" : "font-bold text-brand-700"
    : isLoser ? "text-gray-400"
    : "text-gray-700";

  return (
    <div className={`flex items-center justify-between px-3 py-2.5 min-h-[42px] ${isWinner ? winnerColor : ""}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isWinner && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
        {team ? (
          <span className={`text-xs truncate max-w-[140px] ${nameColor}`}>
            {team.name}
          </span>
        ) : slot ? (
          <div className="relative">
            {open ? (
              <div className="flex items-center gap-1">
                <select
                  autoFocus
                  className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 max-w-[160px]"
                  defaultValue=""
                  onChange={e => handleSeed(e.target.value || null)}
                  onBlur={() => setOpen(false)}
                >
                  <option value="" disabled>Pick team…</option>
                  {seedOptions.map(opt => (
                    <option key={opt.team.id} value={opt.team.id}>{opt.label}</option>
                  ))}
                </select>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                disabled={seeding}
                onClick={() => setOpen(true)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-500 transition disabled:opacity-40"
              >
                <UserPlus className="w-3 h-3" />
                {seeding ? "Seeding…" : "Seed team"}
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">TBD</span>
        )}
      </div>
      {score !== null && (
        <span className={`text-sm font-black ml-2 shrink-0 ${isWinner ? scoreColor : "text-gray-400"}`}>
          {score}
        </span>
      )}
      {team && slot && score === null && (
        <button
          onClick={() => handleSeed(null)}
          disabled={seeding}
          className="ml-2 text-gray-300 hover:text-red-400 transition shrink-0 disabled:opacity-40"
          title="Remove team"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
