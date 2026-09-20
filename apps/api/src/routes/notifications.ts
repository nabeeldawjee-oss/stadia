import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";

export async function notificationRoutes(app: FastifyInstance) {
  // Register device token for push
  app.post("/api/device-tokens", { preHandler: authenticate }, async (req, reply) => {
    const { token, platform } = z.object({
      token: z.string(),
      platform: z.enum(["ios", "android"]),
    }).parse(req.body);

    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId: req.userId!, token, platform },
      update: { userId: req.userId!, platform, updatedAt: new Date() },
    });

    return reply.send({ success: true, data: null });
  });

}
