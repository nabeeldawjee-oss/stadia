import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { submitScore } from "../engines/scoring/submit-score";
import { overrideScore } from "../engines/scoring/override-score";
import { resolveToken } from "../engines/scoring/token-resolver";

const scoreSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  sets: z.array(z.object({
    setNumber: z.number().int(),
    homePoints: z.number().int().min(0),
    awayPoints: z.number().int().min(0),
  })).optional(),
  playerStats: z.array(z.object({
    playerId: z.string(),
    statDefId: z.string(),
    value: z.number().int().min(0),
    minute: z.number().int().optional(),
  })).optional(),
});

const overrideSchema = scoreSchema.extend({
  reason: z.string().optional(),
});

export async function scoreRoutes(app: FastifyInstance) {
  // Organizer enters score
  app.post("/api/matches/:matchId/score", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "enter_results");
    try {
      const body = scoreSchema.parse(req.body);
      await submitScore(matchId, body, { type: "organizer", userId: req.userId! });
      return reply.send({ success: true, data: null });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Token-based score entry (referee or team)
  app.post("/api/scores", async (req, reply) => {
    const { token } = req.query as { token?: string };
    const { matchId } = z.object({ matchId: z.string() }).parse(req.body);

    if (!token) return reply.code(401).send({ success: false, error: "Token required" });

    try {
      const ctx = await resolveToken(token);
      const body = scoreSchema.parse(req.body);

      if (ctx.type === "REFEREE") {
        await submitScore(matchId, body, { type: "referee", refereeId: ctx.entityId });
      } else {
        await submitScore(matchId, body, { type: "team", teamId: ctx.entityId });
      }

      return reply.send({ success: true, data: null });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Organizer override
  app.put("/api/matches/:matchId/score/override", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "enter_results");
    try {
      const body = overrideSchema.parse(req.body);
      await overrideScore(matchId, body, req.userId!);
      return reply.send({ success: true, data: null });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Score override log
  app.get("/api/matches/:matchId/score-log", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "view_only");
    const logs = await prisma.scoreOverrideLog.findMany({
      where: { matchId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: logs });
  });

  // Get referee's matches (token-based view)
  app.get("/api/scores/referee", async (req, reply) => {
    const { token } = req.query as { token?: string };
    if (!token) return reply.code(401).send({ success: false, error: "Token required" });

    try {
      const ctx = await resolveToken(token);
      if (ctx.type !== "REFEREE") return reply.code(403).send({ success: false, error: "Not a referee token" });

      const assignments = await prisma.refAssignment.findMany({
        where: { refereeId: ctx.entityId },
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
      });

      return reply.send({ success: true, data: assignments });
    } catch (err: any) {
      return reply.code(401).send({ success: false, error: err.message });
    }
  });
}
