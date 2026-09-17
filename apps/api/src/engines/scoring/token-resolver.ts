import { prisma } from "@stadia/db";

export type TokenContext = {
  type: "REFEREE" | "TEAM";
  entityId: string;
  tournamentId: string;
};

export async function resolveToken(token: string): Promise<TokenContext> {
  const record = await prisma.scoreToken.findUnique({ where: { token } });

  if (!record || record.revoked) {
    throw new Error("Invalid or revoked token");
  }

  await prisma.scoreToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    type: record.type as "REFEREE" | "TEAM",
    entityId: record.refereeId || record.teamId || "",
    tournamentId: record.tournamentId,
  };
}
