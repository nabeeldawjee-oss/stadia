import { prisma } from "@stadia/db";

export interface AdvancementRule {
  fromPhaseId: string;
  toPhaseId: string;
  rules: { groupId: string; positions: number[]; bracketSlotIds: string[] }[];
}

export async function saveAdvancementRules(
  fromPhaseId: string,
  rules: { fromGroupId: string; position: number; toPhaseId: string; toBracketSlotId?: string }[]
) {
  await prisma.$transaction([
    prisma.advancementRule.deleteMany({ where: { fromPhaseId } }),
    prisma.advancementRule.createMany({
      data: rules.map((r) => ({
        fromPhaseId,
        fromGroupId: r.fromGroupId,
        finishingPosition: r.position,
        toPhaseId: r.toPhaseId,
        toBracketSlotId: r.toBracketSlotId ?? null,
      })),
    }),
  ]);
}

export async function getAdvancementRules(phaseId: string) {
  return prisma.advancementRule.findMany({ where: { fromPhaseId: phaseId } });
}
