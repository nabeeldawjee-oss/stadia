import { prisma } from "@stadia/db";
import { addMinutes, overlapsTimeRange } from "@stadia/utils";

export async function moveMatch(
  matchId: string,
  fieldId: string,
  startTime: Date,
  slotDurationMinutes: number
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { scheduledMatch: true },
  });

  if (!match) throw new Error("Match not found");

  const endTime = addMinutes(startTime, slotDurationMinutes);

  // Check for team conflicts (other matches at same time)
  const conflicts = await prisma.scheduledMatch.findMany({
    where: {
      matchId: { not: matchId },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      match: {
        OR: [
          { homeTeamId: match.homeTeamId },
          { awayTeamId: match.homeTeamId },
          { homeTeamId: match.awayTeamId },
          { awayTeamId: match.awayTeamId },
        ],
      },
    },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
  });

  if (conflicts.length > 0) {
    const teams = conflicts
      .map((c) => [c.match.homeTeam?.name, c.match.awayTeam?.name].filter(Boolean).join(" vs "))
      .join(", ");
    throw new Error(`Conflict: team already scheduled at this time (${teams})`);
  }

  if (match.scheduledMatch) {
    await prisma.scheduledMatch.update({
      where: { matchId },
      data: { fieldId, startTime, endTime },
    });
  } else {
    await prisma.scheduledMatch.create({
      data: { matchId, fieldId, startTime, endTime },
    });
    await prisma.match.update({ where: { id: matchId }, data: { status: "SCHEDULED" } });
  }
}
