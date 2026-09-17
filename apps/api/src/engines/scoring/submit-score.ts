import { prisma } from "@stadia/db";
import { recalculateStandings } from "../standings/recalculate";
import { advanceBracketWinner } from "../format/advance-bracket-winner";
import type { SubmitScoreBody } from "@stadia/types";

type ScoreSource =
  | { type: "organizer"; userId: string }
  | { type: "referee"; refereeId: string }
  | { type: "team"; teamId: string };

export async function submitScore(
  matchId: string,
  body: SubmitScoreBody,
  source: ScoreSource
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { refAssignment: true },
  });

  if (!match) throw new Error("Match not found");
  if (match.status === "CANCELLED") throw new Error("Match is cancelled");

  // Authorization checks
  if (source.type === "referee") {
    if (match.refAssignment?.refereeId !== source.refereeId) {
      throw new Error("Referee not assigned to this match");
    }
    if (match.scoreLocked) {
      throw new Error("Score already submitted — contact organizer to override");
    }
  }

  if (source.type === "team") {
    if (match.homeTeamId !== source.teamId && match.awayTeamId !== source.teamId) {
      throw new Error("Team not participating in this match");
    }
  }

  // Save score
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        status: "COMPLETED",
        completedAt: new Date(),
        scoreLocked: source.type === "referee",
      },
    });

    // Save sets
    if (body.sets?.length) {
      await tx.matchSet.deleteMany({ where: { matchId } });
      await tx.matchSet.createMany({
        data: body.sets.map((s) => ({ matchId, ...s })),
      });
    }

    // Save player stats
    if (body.playerStats?.length) {
      await tx.matchPlayerStat.deleteMany({ where: { matchId } });
      await tx.matchPlayerStat.createMany({
        data: body.playerStats.map((s) => ({ matchId, ...s })),
      });
    }
  });

  // Downstream: recalculate standings or advance bracket
  if (match.contextType === "GROUP" && match.groupId) {
    await recalculateStandings(match.groupId);
  } else if (match.contextType === "BRACKET") {
    await advanceBracketWinner(matchId);
  }
}
