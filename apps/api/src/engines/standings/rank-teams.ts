type TeamStats = {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  [key: string]: any;
};

type MatchRecord = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

type Criterion =
  | "points"
  | "goal_difference"
  | "goals_for"
  | "goals_against"
  | "head_to_head"
  | `custom:${string}`;

export function rankTeams(
  teams: TeamStats[],
  allMatches: MatchRecord[],
  chain: Criterion[]
): TeamStats[] {
  return resolveRanking(teams, allMatches, chain, 0);
}

function resolveRanking(
  teams: TeamStats[],
  allMatches: MatchRecord[],
  chain: Criterion[],
  chainIndex: number
): TeamStats[] {
  if (teams.length <= 1 || chainIndex >= chain.length) return teams;

  const criterion = chain[chainIndex];

  const sorted = sortByCriterion(teams, allMatches, criterion, chain);

  // Group teams with identical value at this criterion
  const result: TeamStats[] = [];
  let i = 0;
  while (i < sorted.length) {
    const group = [sorted[i]];
    while (
      i + group.length < sorted.length &&
      getValue(sorted[i + group.length], criterion, allMatches, group) ===
        getValue(sorted[i], criterion, allMatches, group)
    ) {
      group.push(sorted[i + group.length]);
    }
    if (group.length > 1) {
      const resolved = resolveRanking(group, allMatches, chain, chainIndex + 1);
      result.push(...resolved);
    } else {
      result.push(...group);
    }
    i += group.length;
  }

  return result;
}

function sortByCriterion(
  teams: TeamStats[],
  matches: MatchRecord[],
  criterion: Criterion,
  _chain: Criterion[]
): TeamStats[] {
  if (criterion === "head_to_head") return teams; // handled in grouping
  if (criterion === "goals_against") {
    return [...teams].sort((a, b) => a.goalsAgainst - b.goalsAgainst);
  }

  const key = criterionToKey(criterion);
  return [...teams].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
}

function getValue(
  team: TeamStats,
  criterion: Criterion,
  _matches: MatchRecord[],
  _group: TeamStats[]
): number {
  if (criterion === "head_to_head") return 0; // tie-breaking handled by recursion
  if (criterion === "goals_against") return team.goalsAgainst;
  return team[criterionToKey(criterion)] ?? 0;
}

function criterionToKey(criterion: Criterion): string {
  const map: Record<string, string> = {
    points: "points",
    goal_difference: "goalDifference",
    goals_for: "goalsFor",
    goals_against: "goalsAgainst",
  };
  if (criterion.startsWith("custom:")) return criterion.slice(7);
  return map[criterion] || criterion;
}
