import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { generateGroupMatches } from "../engines/format/generate-matches";
import { generateBracketSlots } from "../engines/format/generate-bracket";

const divisionSchema = z.object({
  name: z.string().min(1).max(100),
  orderIndex: z.number().int().optional(),
  teamLimit: z.number().int().optional(),
});

const phaseSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["GROUP_STAGE", "KNOCKOUT"]),
  orderIndex: z.number().int().optional(),
});

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  legs: z.literal(1).or(z.literal(2)).optional(),
  pointsWin: z.number().int().optional(),
  pointsDraw: z.number().int().optional(),
  pointsLoss: z.number().int().optional(),
});

const bracketSchema = z.object({
  size: z.union([z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
  hasConsolation: z.boolean().optional(),
  thirdPlaceMatch: z.boolean().optional(),
});

export async function divisionRoutes(app: FastifyInstance) {
  // Create division
  app.post("/api/tournaments/:tournamentId/divisions", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_general");
    const body = divisionSchema.parse(req.body);
    const division = await prisma.division.create({ data: { tournamentId, ...body } });
    return reply.code(201).send({ success: true, data: division });
  });

  // Update division
  app.put("/api/divisions/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const division = await prisma.division.findUnique({ where: { id } });
    if (!division) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, division.tournamentId, "manage_general");
    const body = divisionSchema.partial().parse(req.body);
    const updated = await prisma.division.update({ where: { id }, data: body });
    return reply.send({ success: true, data: updated });
  });

  // Delete division
  app.delete("/api/divisions/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const division = await prisma.division.findUnique({ where: { id } });
    if (!division) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, division.tournamentId, "manage_general");
    await prisma.division.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // Get single phase (used by bracket UI)
  app.get("/api/phases/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const phase = await prisma.phase.findUnique({
      where: { id },
      include: {
        division: true,
        groups: { include: { teams: { include: { team: true } }, standings: true, matches: true } },
        brackets: true,
      },
    });
    if (!phase) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "view_only");
    return reply.send({ success: true, data: phase });
  });

  // Get groups for a phase
  app.get("/api/phases/:phaseId/groups", { preHandler: authenticate }, async (req, reply) => {
    const { phaseId } = req.params as { phaseId: string };
    const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { division: true } });
    if (!phase) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "view_only");
    const groups = await prisma.group.findMany({
      where: { phaseId },
      include: {
        teams: { include: { team: true } },
        standings: { include: { team: true }, orderBy: { position: "asc" } },
        matches: { include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } } },
      },
    });
    return reply.send({ success: true, data: groups });
  });

  // Create phase
  app.post("/api/divisions/:divisionId/phases", { preHandler: authenticate }, async (req, reply) => {
    const { divisionId } = req.params as { divisionId: string };
    const division = await prisma.division.findUnique({ where: { id: divisionId } });
    if (!division) return reply.code(404).send({ success: false, error: "Division not found" });
    await assertTournamentAccess(req.userId!, division.tournamentId, "manage_general");
    const body = phaseSchema.parse(req.body);
    const phase = await prisma.phase.create({ data: { divisionId, ...body } });
    return reply.code(201).send({ success: true, data: phase });
  });

  // Start next phase
  app.post("/api/phases/:id/start", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const phase = await prisma.phase.findUnique({ where: { id }, include: { division: true } });
    if (!phase) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "manage_general");
    try {
      const { startNextPhase } = await import("../engines/format/start-next-phase");
      await startNextPhase(id);
      return reply.send({ success: true, data: null });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Create group
  app.post("/api/phases/:phaseId/groups", { preHandler: authenticate }, async (req, reply) => {
    const { phaseId } = req.params as { phaseId: string };
    const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { division: true } });
    if (!phase) return reply.code(404).send({ success: false, error: "Phase not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "manage_general");
    const body = groupSchema.parse(req.body);
    const group = await prisma.group.create({ data: { phaseId, ...body } });
    return reply.code(201).send({ success: true, data: group });
  });

  // Add team to group
  app.post("/api/groups/:groupId/teams", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const { teamId } = z.object({ teamId: z.string() }).parse(req.body);
    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { phase: { include: { division: true } } } });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, group.phase.division.tournamentId, "manage_teams");
    await prisma.groupTeam.create({ data: { groupId, teamId, divisionId: group.phase.divisionId } });
    return reply.code(201).send({ success: true, data: null });
  });

  // Generate matches for group
  app.post("/api/groups/:groupId/generate-matches", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { phase: { include: { division: true } } } });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, group.phase.division.tournamentId, "manage_general");
    await generateGroupMatches(groupId);
    return reply.send({ success: true, data: null });
  });

  // Get group detail (teams, matches, standings)
  app.get("/api/groups/:groupId", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        teams: { include: { team: true } },
        matches: {
          include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } },
          orderBy: { createdAt: "asc" },
        },
        standings: { include: { team: true }, orderBy: { position: "asc" } },
      },
    });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true, data: group });
  });

  // Create bracket
  app.post("/api/phases/:phaseId/brackets", { preHandler: authenticate }, async (req, reply) => {
    const { phaseId } = req.params as { phaseId: string };
    const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { division: true } });
    if (!phase) return reply.code(404).send({ success: false, error: "Phase not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "manage_general");
    const body = bracketSchema.parse(req.body);
    const bracket = await prisma.bracket.create({ data: { phaseId, ...body } });
    await generateBracketSlots(bracket.id);
    return reply.code(201).send({ success: true, data: bracket });
  });

  // List all phases for a tournament (used by advancement UI)
  app.get("/api/tournaments/:tournamentId/phases", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const divisions = await prisma.division.findMany({
      where: { tournamentId },
      include: {
        phases: {
          include: {
            groups: { select: { id: true, name: true, _count: { select: { teams: true } } } },
            brackets: { include: { slots: { select: { id: true, roundNumber: true, position: true }, orderBy: [{ roundNumber: "asc" }, { position: "asc" }] } } },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
    const phases = divisions.flatMap((d) => d.phases.map((p) => ({ ...p, divisionName: d.name })));
    return reply.send({ success: true, data: phases });
  });

  // Get bracket tree
  app.get("/api/brackets/:bracketId", { preHandler: authenticate }, async (req, reply) => {
    const { bracketId } = req.params as { bracketId: string };
    const bracket = await prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        slots: { include: { team: true }, orderBy: [{ roundNumber: "asc" }, { position: "asc" }] },
        matches: { include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } } },
      },
    });
    if (!bracket) return reply.code(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true, data: bracket });
  });
}
