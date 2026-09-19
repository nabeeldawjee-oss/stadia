import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { autoSchedule } from "../engines/scheduling/auto-schedule";
import { moveMatch } from "../engines/scheduling/move-match";

const autoScheduleSchema = z.object({
  groupIds: z.array(z.string()).optional(),
  bracketIds: z.array(z.string()).optional(),
  matchDay: z.string(),
  startTime: z.string(),
  slotDurationMinutes: z.number().int().min(10).max(300),
  restMinutesBetweenSameTeam: z.number().int().optional(),
});

const moveMatchSchema = z.object({
  fieldId: z.string(),
  startTime: z.string(),
  slotDurationMinutes: z.number().int().min(10).max(300),
});

export async function scheduleRoutes(app: FastifyInstance) {
  // Get full schedule for a tournament
  app.get("/api/tournaments/:tournamentId/schedule", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const { day } = req.query as { day?: string };

    const scheduled = await prisma.scheduledMatch.findMany({
      where: {
        match: { tournamentId },
        ...(day ? { startTime: { gte: new Date(`${day}T00:00:00`), lt: new Date(`${day}T23:59:59`) } } : {}),
      },
      include: {
        field: true,
        match: { include: { homeTeam: true, awayTeam: true } },
      },
      orderBy: { startTime: "asc" },
    });

    return reply.send({ success: true, data: scheduled });
  });

  // Auto-schedule
  app.post("/api/tournaments/:tournamentId/schedule/auto", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_schedule");
    try {
      const body = autoScheduleSchema.parse(req.body);
      const result = await autoSchedule(tournamentId, body);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Move match (drag-drop)
  app.put("/api/matches/:matchId/slot", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_schedule");
    try {
      const body = moveMatchSchema.parse(req.body);
      await moveMatch(matchId, body.fieldId, new Date(body.startTime), body.slotDurationMinutes);
      return reply.send({ success: true, data: null });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Reset entire schedule for a tournament
  app.delete("/api/tournaments/:tournamentId/schedule", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_schedule");

    await prisma.scheduledMatch.deleteMany({ where: { match: { tournamentId } } });
    const updated = await prisma.match.updateMany({
      where: { tournamentId, status: "SCHEDULED" },
      data: { status: "PENDING" },
    });

    return reply.send({ success: true, data: { reset: updated.count } });
  });

  // Unschedule a single match
  app.delete("/api/matches/:matchId/schedule", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_schedule");

    await prisma.scheduledMatch.deleteMany({ where: { matchId } });
    await prisma.match.updateMany({
      where: { id: matchId, status: "SCHEDULED" },
      data: { status: "PENDING" },
    });

    return reply.send({ success: true, data: null });
  });

  // Unscheduled matches (for schedule board)
  app.get("/api/tournaments/:tournamentId/matches/unscheduled", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const matches = await prisma.match.findMany({
      where: { tournamentId, scheduledMatch: null, status: { not: "CANCELLED" } },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data: matches });
  });

  // Quick schedule a match (drag-drop board)
  app.post("/api/matches/:matchId/schedule", { preHandler: authenticate }, async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const body = z.object({ fieldId: z.string(), startTime: z.string() }).parse(req.body);
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, match.tournamentId, "manage_schedule");
    await moveMatch(matchId, body.fieldId, new Date(body.startTime), 60);
    return reply.send({ success: true, data: null });
  });

  // Fields CRUD
  app.get("/api/tournaments/:tournamentId/fields", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const fields = await prisma.field.findMany({ where: { tournamentId }, orderBy: { orderIndex: "asc" } });
    return reply.send({ success: true, data: fields });
  });

  app.post("/api/tournaments/:tournamentId/fields", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_schedule");
    const body = z.object({ name: z.string(), orderIndex: z.number().int().optional() }).parse(req.body);
    const field = await prisma.field.create({ data: { tournamentId, ...body } });
    return reply.code(201).send({ success: true, data: field });
  });

  app.delete("/api/fields/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const field = await prisma.field.findUnique({ where: { id } });
    if (!field) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, field.tournamentId, "manage_schedule");
    await prisma.field.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // Break blocks (block out time slots for lunch, prayer, ceremonies, etc.)
  app.get("/api/tournaments/:tournamentId/break-blocks", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const blocks = await prisma.breakBlock.findMany({
      where: { tournamentId },
      include: { field: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
    });
    return reply.send({ success: true, data: blocks });
  });

  app.post("/api/tournaments/:tournamentId/break-blocks", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_schedule");
    const body = z.object({
      label: z.string().min(1).max(100),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      fieldId: z.string().optional().nullable(),
    }).parse(req.body);
    const block = await prisma.breakBlock.create({
      data: {
        tournamentId,
        label: body.label,
        fieldId: body.fieldId ?? null,
        startTime: new Date(`${body.date}T${body.startTime}:00Z`),
        endTime: new Date(`${body.date}T${body.endTime}:00Z`),
      },
    });
    return reply.code(201).send({ success: true, data: block });
  });

  app.delete("/api/break-blocks/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const block = await prisma.breakBlock.findUnique({ where: { id } });
    if (!block) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, block.tournamentId, "manage_schedule");
    await prisma.breakBlock.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
