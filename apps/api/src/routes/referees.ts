import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { generateScoreToken, revokeScoreToken } from "../engines/referees/generate-token";

const refSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const availSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export async function refereeRoutes(app: FastifyInstance) {
  // List referees
  app.get("/api/tournaments/:tournamentId/referees", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_referees");
    const refs = await prisma.referee.findMany({
      where: { tournamentId },
      include: {
        tokens: { orderBy: { createdAt: "desc" }, take: 1 },
        availability: { orderBy: { date: "asc" } },
        assignments: { include: { match: { include: { homeTeam: true, awayTeam: true } } } },
      },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: refs });
  });

  // Create referee
  app.post("/api/tournaments/:tournamentId/referees", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_referees");
    const body = refSchema.parse(req.body);
    const referee = await prisma.referee.create({ data: { tournamentId, ...body } });
    // Auto-generate a score token
    const tokenRecord = await generateScoreToken("REFEREE", referee.id, tournamentId);
    return reply.code(201).send({ success: true, data: { ...referee, token: tokenRecord.token } });
  });

  // Delete referee
  app.delete("/api/referees/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ref = await prisma.referee.findUnique({ where: { id } });
    if (!ref) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, ref.tournamentId, "manage_referees");
    await prisma.referee.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // Regenerate token for referee
  app.post("/api/referees/:id/token", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ref = await prisma.referee.findUnique({ where: { id } });
    if (!ref) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, ref.tournamentId, "manage_referees");
    // Revoke existing tokens
    await prisma.scoreToken.deleteMany({ where: { entityId: id, type: "REFEREE" } });
    const token = await generateScoreToken("REFEREE", id, ref.tournamentId);
    return reply.send({ success: true, data: { token: token.token } });
  });

  // Add referee availability
  app.post("/api/referees/:id/availability", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ref = await prisma.referee.findUnique({ where: { id } });
    if (!ref) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, ref.tournamentId, "manage_referees");
    const body = availSchema.parse(req.body);
    const avail = await prisma.refAvailability.create({
      data: {
        refereeId: id,
        date: new Date(body.date),
        startTime: new Date(`${body.date}T${body.startTime}`),
        endTime: new Date(`${body.date}T${body.endTime}`),
      },
    });
    return reply.code(201).send({ success: true, data: avail });
  });

  // Assign referee to match
  app.post("/api/matches/:matchId/referee", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const { refereeId, role } = z.object({ refereeId: z.string(), role: z.string().optional() }).parse(req.body);
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_referees");
    const assignment = await prisma.refAssignment.create({
      data: { matchId, refereeId, role: role ?? "MAIN" },
    });
    return reply.code(201).send({ success: true, data: assignment });
  });

  // Remove referee from match
  app.delete("/api/matches/:matchId/referee/:refereeId", { preHandler: authenticate }, async (req, reply) => {
    const { matchId, refereeId } = req.params as { matchId: string; refereeId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_referees");
    await prisma.refAssignment.deleteMany({ where: { matchId, refereeId } });
    return reply.send({ success: true, data: null });
  });

  // Get referee's view via token (public endpoint)
  app.get("/api/ref", async (req, reply) => {
    const { token } = req.query as { token?: string };
    if (!token) return reply.code(401).send({ success: false, error: "Token required" });
    const tokenRecord = await prisma.scoreToken.findUnique({ where: { token } });
    if (!tokenRecord || tokenRecord.type !== "REFEREE") {
      return reply.code(401).send({ success: false, error: "Invalid token" });
    }
    await prisma.scoreToken.update({ where: { token }, data: { lastUsedAt: new Date() } });
    const referee = await prisma.referee.findUnique({
      where: { id: tokenRecord.entityId },
      include: {
        assignments: {
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                scheduledMatch: { include: { field: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return reply.send({ success: true, data: referee });
  });
}
