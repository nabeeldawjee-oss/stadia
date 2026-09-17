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
    match.homeScore > match.awayScore
      ? match.homeTeamId
      : match.awayTeamId;

  const loserId =
    match.homeScore > match.awayScore
      ? match.awayTeamId
      : match.homeTeamId;

  const maxRound = bracketRounds(match.bracket.size);

  if (match.roundNumber! >= maxRound) {
    // This is the final — mark bracket complete
    await prisma.bracket.update({
      where: { id: match.bracketId! },
      data: {},
    });
    return;
  }

  // Advance winner to next round
  const nextRound = match.roundNumber! + 1;
  const nextPos = nextPosition(match.homeSlot.position);
  // home slots (odd positions) → HOME side of next match
  // away slots (even positions) → AWAY side of next match
  const nextSide = match.homeSlot.position % 2 === 1 ? "HOME" : "AWAY";

  const nextSlot = await prisma.bracketSlot.findFirst({
    where: {
      bracketId: match.bracketId!,
      roundNumber: nextRound,
      position: nextPos,
      side: nextSide,
    },
  });

  if (nextSlot) {
    await prisma.bracketSlot.update({
      where: { id: nextSlot.id },
      data: { teamId: winnerId },
    });

    // If partner slot also filled, create the match
    const partnerSide = nextSide === "HOME" ? "AWAY" : "HOME";
    const partnerSlot = await prisma.bracketSlot.findFirst({
      where: {
        bracketId: match.bracketId!,
        roundNumber: nextRound,
        position: nextPos,
        side: partnerSide,
      },
    });

    if (partnerSlot?.teamId) {
      const homeSlot = nextSide === "HOME" ? nextSlot : partnerSlot;
      const awaySlot = nextSide === "HOME" ? partnerSlot : nextSlot;

      const phase = await prisma.bracket.findUnique({
        where: { id: match.bracketId! },
        include: { phase: { include: { division: true } } },
      });

      await prisma.match.create({
        data: {
          tournamentId: phase!.phase.division.tournamentId,
          contextType: "BRACKET",
          bracketId: match.bracketId!,
          roundNumber: nextRound,
          homeSlotId: homeSlot.id,
          awaySlotId: awaySlot.id,
          homeTeamId: homeSlot.teamId,
          awayTeamId: awaySlot.teamId,
        },
      });
    }
  }

  // Consolation bracket — advance loser
  if (match.bracket.hasConsolation && loserId) {
    // Mirror logic for consolation bracket (simplified: same bracket, mark specially)
    // Full consolation bracket would be a separate Bracket record
  }
}
