import { prisma } from "@stadia/db";
import { nextPosition, bracketRounds } from "@stadia/utils";

export async function advanceBracketWinner(matchId: string): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { bracket: true, homeSlot: true, awaySlot: true },
  });

  if (!match?.bracket || !match.homeSlot || !match.awaySlot) return;
  if (match.homeScore === null || match.awayScore === null) return;

  const winnerId =
    match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId;
  const loserId =
    match.homeScore > match.awayScore ? match.awayTeamId : match.homeTeamId;

  const maxRound = bracketRounds(match.bracket.size);

  // Third-place: SF losers (round maxRound-1) seed into 3rd-place slot if enabled
  if (match.bracket.thirdPlaceMatch && match.roundNumber === maxRound - 1 && loserId) {
    const thirdSlot = await prisma.bracketSlot.findFirst({
      where: { bracketId: match.bracketId!, roundNumber: maxRound, position: 2, side: nextPosition(match.homeSlot.position) % 2 === 1 ? "HOME" : "AWAY" },
    });
    if (thirdSlot) {
      await prisma.bracketSlot.update({ where: { id: thirdSlot.id }, data: { teamId: loserId } });
      const thirdMatch = await prisma.match.findFirst({
        where: { bracketId: match.bracketId!, roundNumber: maxRound, ...(thirdSlot.side === "HOME" ? { homeSlotId: thirdSlot.id } : { awaySlotId: thirdSlot.id }) },
      });
      if (thirdMatch) {
        await prisma.match.update({
          where: { id: thirdMatch.id },
          data: thirdSlot.side === "HOME" ? { homeTeamId: loserId } : { awayTeamId: loserId },
        });
      }
    }
  }

  if (match.roundNumber! >= maxRound) return; // Final — nothing to advance

  const nextRound = match.roundNumber! + 1;
  const nextPos = nextPosition(match.homeSlot.position);
  const nextSide = match.homeSlot.position % 2 === 1 ? "HOME" : "AWAY";

  const nextSlot = await prisma.bracketSlot.findFirst({
    where: {
      bracketId: match.bracketId!,
      roundNumber: nextRound,
      position: nextPos,
      side: nextSide,
    },
  });

  if (!nextSlot) return;

  // Update slot with winner
  await prisma.bracketSlot.update({
    where: { id: nextSlot.id },
    data: { teamId: winnerId },
  });

  // Update the existing match record for this next-round slot (already created by generateBracketSlots)
  const nextMatch = await prisma.match.findFirst({
    where: {
      bracketId: match.bracketId!,
      roundNumber: nextRound,
      ...(nextSide === "HOME" ? { homeSlotId: nextSlot.id } : { awaySlotId: nextSlot.id }),
    },
  });

  if (nextMatch) {
    await prisma.match.update({
      where: { id: nextMatch.id },
      data: nextSide === "HOME" ? { homeTeamId: winnerId } : { awayTeamId: winnerId },
    });
  }
}
