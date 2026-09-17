import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";

const PERMISSIONS = [
  "manage_general",
  "manage_teams",
  "manage_schedule",
  "enter_results",
  "manage_referees",
  "manage_registration",
  "manage_presentation",
  "view_only",
] as const;

const addAdminSchema = z.object({
  email: z.string().email(),
  permissions: z.array(z.enum(PERMISSIONS)).min(1),
});

const updateAdminSchema = z.object({
  permissions: z.array(z.enum(PERMISSIONS)).min(1),
});

async function assertOwner(userId: string, tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw Object.assign(new Error("Tournament not found"), { statusCode: 404 });
  if (tournament.ownerId !== userId) throw Object.assign(new Error("Owner access required"), { statusCode: 403 });
}

export async function adminRoutes(app: FastifyInstance) {
  // List co-organizers
  app.get("/api/tournaments/:tournamentId/admins", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertOwner(req.userId!, tournamentId);
    const admins = await prisma.tournamentAdmin.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return reply.send({ success: true, data: admins });
  });

  // Add co-organizer
  app.post("/api/tournaments/:tournamentId/admins", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertOwner(req.userId!, tournamentId);
    const { email, permissions } = addAdminSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(404).send({ success: false, error: "No user found with that email" });

    const existing = await prisma.tournamentAdmin.findUnique({
      where: { userId_tournamentId: { userId: user.id, tournamentId } },
    });
    if (existing) return reply.code(409).send({ success: false, error: "Already an admin" });

    const admin = await prisma.tournamentAdmin.create({
      data: { userId: user.id, tournamentId, permissions },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return reply.code(201).send({ success: true, data: admin });
  });

  // Update co-organizer permissions
  app.put("/api/tournaments/:tournamentId/admins/:userId", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId, userId } = req.params as { tournamentId: string; userId: string };
    await assertOwner(req.userId!, tournamentId);
    const { permissions } = updateAdminSchema.parse(req.body);

    const admin = await prisma.tournamentAdmin.update({
      where: { userId_tournamentId: { userId, tournamentId } },
      data: { permissions },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return reply.send({ success: true, data: admin });
  });

  // Remove co-organizer
  app.delete("/api/tournaments/:tournamentId/admins/:userId", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId, userId } = req.params as { tournamentId: string; userId: string };
    await assertOwner(req.userId!, tournamentId);
    await prisma.tournamentAdmin.delete({
      where: { userId_tournamentId: { userId, tournamentId } },
    });
    return reply.send({ success: true, data: null });
  });
}
