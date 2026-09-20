import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { verifyUnsubscribeToken } from "../lib/email";

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

  // One-click unsubscribe from tournament follow emails (no auth required)
  app.get("/api/unsubscribe", async (req, reply) => {
    const { uid, tid, sig } = (req.query as any);
    if (!uid || !tid || !sig || !verifyUnsubscribeToken(uid, tid, sig)) {
      return reply.code(400).send({ success: false, error: "Invalid unsubscribe link" });
    }
    await prisma.tournamentFollow.deleteMany({ where: { userId: uid, tournamentId: tid } });
    // Redirect to the frontend unsubscribe confirmation page
    const webBase = (process.env.WEB_BASE_URL || "https://stadia.app").split(",")[0].trim();
    return reply.redirect(`${webBase}/unsubscribe?done=1`);
  });

}
