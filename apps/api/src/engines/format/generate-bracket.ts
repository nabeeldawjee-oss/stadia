import { prisma } from "@stadia/db";
import { isPowerOfTwo, bracketRounds } from "@stadia/utils";

export async function generateBracketSlots(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    include: { phase: { include: { division: true } } },
  });
  if (!bracket) throw new Error("Bracket not found");
  if (!isPowerOfTwo(bracket.size)) throw new Error("Bracket size must be power of 2");

  const existingSlots = await prisma.bracketSlot.count({ where: { bracketId } });
  if (existingSlots > 0) return;

  const tournamentId = (bracket as any).phase.division.tournamentId;
  const rounds = bracketRounds(bracket.size);
  const slotData: {
    bracketId: string;
    roundNumber: number;
    position: number;
    side: "HOME" | "AWAY";
  }[] = [];

  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = bracket.size / Math.pow(2, round);
    for (let pos = 1; pos <= matchesInRound; pos++) {
      slotData.push({ bracketId, roundNumber: round, position: pos, side: "HOME" });
      slotData.push({ bracketId, roundNumber: round, position: pos, side: "AWAY" });
    }
  }

  // Third-place match: extra slot pair at position 2 in the Final round
  if (bracket.thirdPlaceMatch && rounds >= 2) {
    slotData.push({ bracketId, roundNumber: rounds, position: 2, side: "HOME" });
    slotData.push({ bracketId, roundNumber: rounds, position: 2, side: "AWAY" });
  }

  await prisma.bracketSlot.createMany({ data: slotData });

  const createdSlots = await prisma.bracketSlot.findMany({
    where: { bracketId },
    orderBy: [{ roundNumber: "asc" }, { position: "asc" }, { side: "asc" }],
  });

  const matchData: {
    tournamentId: string;
    contextType: "BRACKET";
    bracketId: string;
    roundNumber: number;
    homeSlotId: string;
    awaySlotId: string;
  }[] = [];

  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = bracket.size / Math.pow(2, round);
    for (let pos = 1; pos <= matchesInRound; pos++) {
      const homeSlot = createdSlots.find(s => s.roundNumber === round && s.position === pos && s.side === "HOME");
      const awaySlot = createdSlots.find(s => s.roundNumber === round && s.position === pos && s.side === "AWAY");
      if (homeSlot && awaySlot) {
        matchData.push({ tournamentId, contextType: "BRACKET", bracketId, roundNumber: round, homeSlotId: homeSlot.id, awaySlotId: awaySlot.id });
      }
    }
  }

  // Third-place match entry
  if (bracket.thirdPlaceMatch && rounds >= 2) {
    const homeSlot = createdSlots.find(s => s.roundNumber === rounds && s.position === 2 && s.side === "HOME");
    const awaySlot = createdSlots.find(s => s.roundNumber === rounds && s.position === 2 && s.side === "AWAY");
    if (homeSlot && awaySlot) {
      matchData.push({ tournamentId, contextType: "BRACKET", bracketId, roundNumber: rounds, homeSlotId: homeSlot.id, awaySlotId: awaySlot.id });
    }
  }

  await prisma.match.createMany({ data: matchData });
}
