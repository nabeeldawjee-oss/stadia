import { prisma } from "@tournify/db";

export async function startNextPhase(currentPhaseId: string): Promise<void> {
  const currentPhase = await prisma.phase.findUnique({
    where: { id: currentPhaseId },
    include: { division: true },
  });
  if (!currentPhase) throw new Error("Phase not found");

  // Validate all matches complete
  const incomplete = await prisma.match.count({
    where: {
      OR: [
        { groupId: { in: await getGroupIds(currentPhaseId) } },
        { bracketId: { in: await getBracketIds(currentPhaseId) } },
      ],
      status: { not: "COMPLETED" },
    },
  });

  if (incomplete > 0) {
    throw new Error(`${incomplete} match(es) are not yet completed`);
  }

  // Find next phase
  const nextPhase = await prisma.phase.findFirst({
    where: {
      divisionId: currentPhase.divisionId,
      orderIndex: { gt: currentPhase.orderIndex },
    },
    orderBy: { orderIndex: "asc" },
  });

  if (!nextPhase) throw new Error("No next phase found");

  // Get advancement rules
  const rules = await prisma.advancementRule.findMany({
    where: { fromPhaseId: currentPhaseId },
    include: { toBracketSlot: true },
  });

  // For each rule, find the team at that position and place them
  for (const rule of rules) {
    const standing = await prisma.groupStanding.findFirst({
      where: {
        group: { phaseId: currentPhaseId },
        ...(rule.fromGroupId ? { groupId: rule.fromGroupId } : {}),
        position: rule.finishingPosition,
      },
    });

    if (!standing || !rule.toBracketSlotId) continue;

    await prisma.bracketSlot.update({
      where: { id: rule.toBracketSlotId },
      data: { teamId: standing.teamId },
    });
  }

  await prisma.phase.update({
    where: { id: currentPhaseId },
    data: { status: "COMPLETED" },
  });

  await prisma.phase.update({
    where: { id: nextPhase.id },
    data: { status: "ACTIVE" },
  });
}

async function getGroupIds(phaseId: string): Promise<string[]> {
  const groups = await prisma.group.findMany({ where: { phaseId }, select: { id: true } });
  return groups.map((g) => g.id);
}

async function getBracketIds(phaseId: string): Promise<string[]> {
  const brackets = await prisma.bracket.findMany({ where: { phaseId }, select: { id: true } });
  return brackets.map((b) => b.id);
}
