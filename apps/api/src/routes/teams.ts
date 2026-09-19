import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { generateScoreToken } from "../engines/referees/generate-token";

const teamSchema = z.object({
  name: z.string().min(1).max(200),
  logoUrl: z.string().url().optional(),
  country: z.string().optional(),
});

const playerSchema = z.object({
  name: z.string().min(1).max(200),
  number: z.number().int().min(0).max(999).optional(),
  position: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export async function teamRoutes(app: FastifyInstance) {
  // List teams
  app.get("/api/tournaments/:tournamentId/teams", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const teams = await prisma.team.findMany({
      where: { tournamentId },
      include: { players: { orderBy: { number: "asc" } } },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: teams });
  });

  // Create team
  app.post("/api/tournaments/:tournamentId/teams", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_teams");
    const body = teamSchema.parse(req.body);
    const team = await prisma.team.create({ data: { tournamentId, ...body } });
    return reply.code(201).send({ success: true, data: team });
  });

  // Update team
  app.put("/api/teams/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, team.tournamentId, "manage_teams");
    const body = teamSchema.partial().parse(req.body);
    const updated = await prisma.team.update({ where: { id }, data: body });
    return reply.send({ success: true, data: updated });
  });

  // Delete team
  app.delete("/api/teams/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, team.tournamentId, "manage_teams");
    await prisma.team.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // List players
  app.get("/api/teams/:teamId/players", { preHandler: authenticate }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string };
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, team.tournamentId, "view_only");
    const players = await prisma.player.findMany({ where: { teamId }, orderBy: { number: "asc" } });
    return reply.send({ success: true, data: players });
  });

  // Add player
  app.post("/api/teams/:teamId/players", { preHandler: authenticate }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string };
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, team.tournamentId, "manage_teams");
    const body = playerSchema.parse(req.body);
    const player = await prisma.player.create({
      data: { teamId, ...body, dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined },
    });
    return reply.code(201).send({ success: true, data: player });
  });

  // Update player
  app.put("/api/players/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const player = await prisma.player.findUnique({ where: { id }, include: { team: true } });
    if (!player) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, player.team.tournamentId, "manage_teams");
    const body = playerSchema.partial().parse(req.body);
    const updated = await prisma.player.update({ where: { id }, data: body });
    return reply.send({ success: true, data: updated });
  });

  // Delete player
  app.delete("/api/players/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const player = await prisma.player.findUnique({ where: { id }, include: { team: true } });
    if (!player) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, player.team.tournamentId, "manage_teams");
    await prisma.player.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // Update team payment status
  app.put("/api/teams/:id/payment", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, team.tournamentId, "manage_teams");
    const body = z.object({
      paymentStatus: z.enum(["UNPAID", "PAID", "WAIVED"]),
      paymentAmount: z.number().int().min(0).optional().nullable(),
    }).parse(req.body);
    const updated = await prisma.team.update({ where: { id }, data: body });
    return reply.send({ success: true, data: updated });
  });

  // Generate / regenerate team score token
  app.post("/api/teams/:teamId/token", { preHandler: authenticate }, async (req, reply) => {
    const { teamId } = req.params as { teamId: string };
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, team.tournamentId, "manage_teams");
    await prisma.scoreToken.deleteMany({ where: { teamId } });
    const token = await generateScoreToken("TEAM", teamId, team.tournamentId);
    return reply.send({ success: true, data: { token: token.token } });
  });

  // Bulk import teams from CSV data
  app.post("/api/tournaments/:tournamentId/teams/import", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_teams");
    const body = z.object({
      teams: z.array(z.object({
        name: z.string().min(1).max(200),
        country: z.string().optional(),
      })).min(1).max(500),
    }).parse(req.body);
    const created = await prisma.$transaction(
      body.teams.map((t) => prisma.team.create({ data: { tournamentId, ...t } }))
    );
    return reply.code(201).send({ success: true, data: created });
  });
}
