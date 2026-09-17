import { prisma } from "@stadia/db";
import { recalculateStandings } from "../standings/recalculate";
import { advanceBracketWinner } from "../format/advance-bracket-winner";
import type { OverrideScoreBody } from "@stadia/types";

export async function overrideScore(
  matchId: string,
  body: OverrideScoreBody,
  organizerId: string
): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");

  // Log the override
  await prisma.scoreOverrideLog.create({
    data: {
      matchId,
      overriddenById: organizerId,
      previousHomeScore: match.homeScore ?? 0,
      previousAwayScore: match.awayScore ?? 0,
      newHomeScore: body.homeScore,
      newAwayScore: body.awayScore,
      reason: body.reason,
    },
  });

  // Apply override
  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      status: "COMPLETED",
      completedAt: new Date(),
      scoreLocked: false,
    },
  });

  // Recalculate downstream
  if (match.contextType === "GROUP" && match.groupId) {
    await recalculateStandings(match.groupId);
  } else if (match.contextType === "BRACKET") {
    await advanceBracketWinner(matchId);
  }
}
