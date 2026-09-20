import { prisma } from "@stadia/db";

export async function startNextPhase(
  currentPhaseId: string,
  opts: { force?: boolean } = {}
): Promise<{ incompleteMatches: number }> {
  const currentPhase = await prisma.phase.findUnique({
    where: { id: currentPhaseId },
    include: { division: true },
  });
  if (!currentPhase) throw new Error("Phase not found");

  const incomplete = await prisma.match.count({
    where: {
      OR: [
        { groupId: { in: await getGroupIds(currentPhaseId) } },
        { bracketId: { in: await getBracketIds(currentPhaseId) } },
      ],
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  });

  if (incomplete > 0 && !opts.force) {
    throw new Error(`${incomplete} match(es) are not yet completed. Pass force=true to advance anyway.`);
  }

  const nextPhase = await prisma.phase.findFirst({
    where: {
      divisionId: currentPhase.divisionId,
      orderIndex: { gt: currentPhase.orderIndex },
    },
    orderBy: { orderIndex: "asc" },
  });

  // Apply advancement rules (seed bracket slots from group standings)
  const rules = await prisma.advancementRule.findMany({
    where: { fromPhaseId: currentPhaseId },
    include: { toBracketSlot: true },
  });

  for (const rule of rules) {
    const standing = await prisma.groupStanding.findFirst({
      where: {
        group: { phaseId: currentPhaseId },
        ...(rule.fromGroupId ? { groupId: rule.fromGroupId } : {}),
        position: rule.finishingPosition,
      },
    });
    if (!standing || !rule.toBracketSlotId) continue;
    const slot = await prisma.bracketSlot.update({
      where: { id: rule.toBracketSlotId },
      data: { teamId: standing.teamId },
    });
    // Propagate into the match record so homeTeam/awayTeam is populated immediately
    const match = await prisma.match.findFirst({
      where: slot.side === "HOME" ? { homeSlotId: slot.id } : { awaySlotId: slot.id },
    });
    if (match) {
      await prisma.match.update({
        where: { id: match.id },
        data: slot.side === "HOME" ? { homeTeamId: standing.teamId } : { awayTeamId: standing.teamId },
      });
    }
  }

  await prisma.phase.update({
    where: { id: currentPhaseId },
    data: { status: "COMPLETED" },
  });

  if (nextPhase) {
    await prisma.phase.update({
      where: { id: nextPhase.id },
      data: { status: "ACTIVE" },
    });
  }

  return { incompleteMatches: incomplete };
}

async function getGroupIds(phaseId: string): Promise<string[]> {
  const groups = await prisma.group.findMany({ where: { phaseId }, select: { id: true } });
  return groups.map((g) => g.id);
}

async function getBracketIds(phaseId: string): Promise<string[]> {
  const brackets = await prisma.bracket.findMany({ where: { phaseId }, select: { id: true } });
  return brackets.map((b) => b.id);
}
