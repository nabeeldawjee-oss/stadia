import { prisma } from "@stadia/db";
import { randomBytes } from "crypto";

export async function generateScoreToken(type: "REFEREE" | "TEAM", entityId: string, tournamentId: string) {
  const token = randomBytes(24).toString("hex");
  return prisma.scoreToken.create({
    data: {
      token,
      type,
      tournamentId,
      ...(type === "REFEREE" ? { refereeId: entityId } : { teamId: entityId }),
    },
  });
}

export async function revokeScoreToken(type: "REFEREE" | "TEAM", entityId: string) {
  if (type === "REFEREE") {
    await prisma.scoreToken.deleteMany({ where: { refereeId: entityId } });
  } else {
    await prisma.scoreToken.deleteMany({ where: { teamId: entityId } });
  }
}
