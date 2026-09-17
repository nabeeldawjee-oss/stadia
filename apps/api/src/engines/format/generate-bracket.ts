import { prisma } from "@stadia/db";
import { isPowerOfTwo, bracketRounds } from "@stadia/utils";

export async function generateBracketSlots(bracketId: string): Promise<void> {
  const bracket = await prisma.bracket.findUnique({ where: { id: bracketId } });
  if (!bracket) throw new Error("Bracket not found");
  if (!isPowerOfTwo(bracket.size)) throw new Error("Bracket size must be power of 2");

  const rounds = bracketRounds(bracket.size);
  const slots: {
    bracketId: string;
    roundNumber: number;
    position: number;
    side: "HOME" | "AWAY";
  }[] = [];

  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = bracket.size / Math.pow(2, round);
    for (let pos = 1; pos <= matchesInRound; pos++) {
      slots.push({ bracketId, roundNumber: round, position: pos, side: "HOME" });
      slots.push({ bracketId, roundNumber: round, position: pos, side: "AWAY" });
    }
  }

  await prisma.bracketSlot.createMany({ data: slots });
}
