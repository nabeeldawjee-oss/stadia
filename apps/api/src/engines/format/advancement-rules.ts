import { prisma } from "@stadia/db";

export interface AdvancementRule {
  fromPhaseId: string;
  toPhaseId: string;
  rules: { groupId: string; positions: number[]; bracketSlotIds: string[] }[];
}

export async function saveAdvancementRules(rules: {
  fromGroupId: string;
  position: number;
  toPhaseId: string;
  toBracketSlotId?: string;
  toBracketSide?: "HOME" | "AWAY";
  toBracketRound?: number;
  toBracketPosition?: number;
}[]) {
  await prisma.$transaction(
    rules.map((r) =>
      prisma.advancementRule.upsert({
        where: {
          fromGroupId_position: { fromGroupId: r.fromGroupId, position: r.position },
        },
        create: r,
        update: r,
      })
    )
  );
}

export async function getAdvancementRules(phaseId: string) {
  const phase = await prisma.phase.findUnique({
    where: { id: phaseId },
    include: { groups: { include: { advancementRules: true } } },
  });
  return phase?.groups.flatMap((g) => g.advancementRules) ?? [];
}
