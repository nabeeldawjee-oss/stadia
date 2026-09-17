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

  // Follow a tournament (for push/email updates)
  app.post("/api/tournaments/:tournamentId/follow", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await prisma.tournamentFollow.upsert({
      where: { userId_tournamentId: { userId: req.userId!, tournamentId } },
      create: { userId: req.userId!, tournamentId },
      update: {},
    });
    return reply.send({ success: true, data: null });
  });

  app.delete("/api/tournaments/:tournamentId/follow", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await prisma.tournamentFollow.deleteMany({
      where: { userId: req.userId!, tournamentId },
    });
    return reply.send({ success: true, data: null });
  });

  // Broadcast announcement to followers
  app.post("/api/tournaments/:tournamentId/announce", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_general");
    const { title, message } = z.object({ title: z.string(), message: z.string() }).parse(req.body);

    const follows = await prisma.tournamentFollow.findMany({
      where: { tournamentId },
      include: { user: { include: { deviceTokens: true } } },
    });

    const tokens = follows.flatMap((f) => f.user.deviceTokens.map((d) => d.token));

    const { queuePush, queueEmail } = await import("../engines/notifications/workers");

    await queuePush(tokens, title, message, { tournamentId });

    for (const follow of follows) {
      if (follow.user.email) {
        await queueEmail(follow.user.email, title, `<p>${message}</p>`);
      }
    }

    return reply.send({ success: true, data: { sent: tokens.length } });
  });
}
