import { rankTeams } from "./rank-teams";

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
};

type MatchRecord = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export function resolveHeadToHead(
  tiedTeams: TeamStats[],
  allMatches: MatchRecord[],
  pointsWin = 3,
  pointsDraw = 1,
  pointsLoss = 0
): TeamStats[] {
  const teamIds = new Set(tiedTeams.map((t) => t.teamId));

  // Only matches between tied teams
  const h2hMatches = allMatches.filter(
    (m) =>
      m.homeTeamId && m.awayTeamId &&
      teamIds.has(m.homeTeamId) &&
      teamIds.has(m.awayTeamId)
  );

  const h2hStats: Record<string, TeamStats> = {};
  for (const t of tiedTeams) {
    h2hStats[t.teamId] = {
      teamId: t.teamId,
      played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    };
  }

  for (const m of h2hMatches) {
    if (!m.homeTeamId || !m.awayTeamId || m.homeScore === null || m.awayScore === null) continue;
    const h = h2hStats[m.homeTeamId];
    const a = h2hStats[m.awayTeamId];
    if (!h || !a) continue;

    h.played++; a.played++;
    h.goalsFor += m.homeScore; h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore; a.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      h.wins++; h.points += pointsWin;
      a.losses++; a.points += pointsLoss;
    } else if (m.homeScore < m.awayScore) {
      a.wins++; a.points += pointsWin;
      h.losses++; h.points += pointsLoss;
    } else {
      h.draws++; h.points += pointsDraw;
      a.draws++; a.points += pointsDraw;
    }
    h.goalDifference = h.goalsFor - h.goalsAgainst;
    a.goalDifference = a.goalsFor - a.goalsAgainst;
  }

  // Use same chain minus head_to_head to avoid infinite recursion
  return rankTeams(
    Object.values(h2hStats),
    h2hMatches,
    ["points", "goal_difference", "goals_for"]
  );
}
