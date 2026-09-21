import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { generateScoreToken } from "../engines/referees/generate-token";
import { sendEmail, refereePortalHtml } from "../lib/email";

const refSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function refereeRoutes(app: FastifyInstance) {
  // List referees
  app.get("/api/tournaments/:tournamentId/referees", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_referees");
    const refs = await prisma.referee.findMany({
      where: { tournamentId },
      include: {
        scoreToken: true,
        availability: { orderBy: { matchDay: "asc" } },
        assignments: {
          include: {
            match: { include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } } },
          },
        },
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
    await prisma.scoreToken.deleteMany({ where: { refereeId: id } });
    const token = await generateScoreToken("REFEREE", id, ref.tournamentId);
    return reply.send({ success: true, data: { token: token.token } });
  });

  // Email referee their portal link
  app.post("/api/referees/:id/send-link", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ref = await prisma.referee.findUnique({
      where: { id },
      include: { scoreToken: true, tournament: { select: { name: true } } },
    });
    if (!ref) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, ref.tournamentId, "manage_referees");
    if (!ref.email) return reply.code(400).send({ success: false, error: "Referee has no email address" });
    if (!ref.scoreToken) return reply.code(400).send({ success: false, error: "Referee has no portal token" });
    const webBase = (process.env.WEB_BASE_URL || "http://localhost:3001").split(",")[0].trim();
    const portalUrl = `${webBase}/ref?token=${encodeURIComponent(ref.scoreToken.token)}`;
    await sendEmail({
      to: ref.email,
      subject: `Referee portal — ${ref.tournament.name}`,
      html: refereePortalHtml({ tournamentName: ref.tournament.name, refName: ref.name, portalUrl }),
    });
    return reply.send({ success: true, data: null });
  });

  // Add referee availability
  app.post("/api/referees/:id/availability", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ref = await prisma.referee.findUnique({ where: { id } });
    if (!ref) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, ref.tournamentId, "manage_referees");
    const body = z.object({ date: z.string(), startTime: z.string(), endTime: z.string() }).parse(req.body);
    const avail = await prisma.refAvailability.create({
      data: {
        refereeId: id,
        matchDay: new Date(`${body.date}T00:00:00Z`),
        availFrom: new Date(`${body.date}T${body.startTime}:00Z`),
        availUntil: new Date(`${body.date}T${body.endTime}:00Z`),
      },
    });
    return reply.code(201).send({ success: true, data: avail });
  });

  // Delete referee availability
  app.delete("/api/referees/availability/:availId", { preHandler: authenticate }, async (req, reply) => {
    const { availId } = req.params as { availId: string };
    const avail = await prisma.refAvailability.findUnique({
      where: { id: availId },
      include: { referee: true },
    });
    if (!avail) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, avail.referee.tournamentId, "manage_referees");
    await prisma.refAvailability.delete({ where: { id: availId } });
    return reply.send({ success: true, data: null });
  });

  // Assign referee to match
  app.post("/api/matches/:matchId/referee", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const { refereeId, role } = z.object({
      refereeId: z.string(),
      role: z.enum(["REFEREE", "ASSISTANT_REFEREE", "FOURTH_OFFICIAL"]).optional(),
    }).parse(req.body);
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_referees");
    const assignment = await prisma.refAssignment.upsert({
      where: { matchId },
      create: { matchId, refereeId, role: role ?? "REFEREE" },
      update: { refereeId, role: role ?? "REFEREE" },
    });
    return reply.send({ success: true, data: assignment });
  });

  // Remove referee from match
  app.delete("/api/matches/:matchId/referee", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_referees");
    await prisma.refAssignment.deleteMany({ where: { matchId } });
    return reply.send({ success: true, data: null });
  });

  // Get referee's view via token (public endpoint)
  app.get("/api/ref", async (req, reply) => {
    const { token } = req.query as { token?: string };
    if (!token) return reply.code(401).send({ success: false, error: "Token required" });
    const tokenRecord = await prisma.scoreToken.findUnique({ where: { token } });
    if (!tokenRecord || tokenRecord.type !== "REFEREE" || !tokenRecord.refereeId) {
      return reply.code(401).send({ success: false, error: "Invalid token" });
    }
    await prisma.scoreToken.update({ where: { token }, data: { lastUsedAt: new Date() } });
    const referee = await prisma.referee.findUnique({
      where: { id: tokenRecord.refereeId },
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
          orderBy: { match: { scheduledMatch: { startTime: "asc" } } },
        },
      },
    });
    return reply.send({ success: true, data: referee });
  });
}
