import { prisma } from "@stadia/db";
import { rankTeams } from "./rank-teams";

export async function recalculateStandings(groupId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      teams: { include: { team: true } },
      matches: { where: { status: "COMPLETED" } },
    },
  });

  if (!group) throw new Error("Group not found");

  type Stats = {
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

  const stats: Record<string, Stats> = {};

  for (const gt of group.teams) {
    stats[gt.teamId] = {
      teamId: gt.teamId,
      played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    };
  }

  for (const match of group.matches) {
    if (match.homeTeamId === null || match.awayTeamId === null) continue;
    if (match.homeScore === null || match.awayScore === null) continue;

    const h = match.homeTeamId;
    const a = match.awayTeamId;
    const hs = match.homeScore;
    const as_ = match.awayScore;

    if (!stats[h] || !stats[a]) continue;

    stats[h].played++;
    stats[a].played++;
    stats[h].goalsFor += hs;
    stats[h].goalsAgainst += as_;
    stats[a].goalsFor += as_;
    stats[a].goalsAgainst += hs;

    if (hs > as_) {
      stats[h].wins++; stats[h].points += group.pointsWin;
      stats[a].losses++; stats[a].points += group.pointsLoss;
    } else if (hs < as_) {
      stats[a].wins++; stats[a].points += group.pointsWin;
      stats[h].losses++; stats[h].points += group.pointsLoss;
    } else {
      stats[h].draws++; stats[h].points += group.pointsDraw;
      stats[a].draws++; stats[a].points += group.pointsDraw;
    }

    stats[h].goalDifference = stats[h].goalsFor - stats[h].goalsAgainst;
    stats[a].goalDifference = stats[a].goalsFor - stats[a].goalsAgainst;
  }

  const ranked = rankTeams(
    Object.values(stats),
    group.matches,
    ["points", "goal_difference", "goals_for", "head_to_head"]
  );

  // Upsert all standings
  await Promise.all(
    ranked.map((s, idx) =>
      prisma.groupStanding.upsert({
        where: { groupId_teamId: { groupId, teamId: s.teamId } },
        create: { groupId, ...s, position: idx + 1 },
        update: { ...s, position: idx + 1 },
      })
    )
  );
}
