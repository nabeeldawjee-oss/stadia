import { prisma } from "@stadia/db";
import { randomBytes } from "crypto";

export async function generateScoreToken(type: "REFEREE" | "TEAM", entityId: string, tournamentId: string) {
  const token = randomBytes(24).toString("hex");
  return prisma.scoreToken.create({
    data: { token, type, entityId, tournamentId },
  });
}

export async function revokeScoreToken(tokenId: string) {
  await prisma.scoreToken.delete({ where: { id: tokenId } });
}
