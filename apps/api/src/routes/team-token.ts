import type { FastifyInstance } from "fastify";
import { prisma } from "@stadia/db";

export async function teamTokenRoutes(app: FastifyInstance) {
  // Public: resolve team token and return team + their matches
  app.get("/api/team", async (req, reply) => {
    const { token } = req.query as { token?: string };
    if (!token) return reply.status(400).send({ success: false, error: "token required" });

    const scoreToken = await prisma.scoreToken.findUnique({
      where: { token },
      include: { team: true },
    });

    if (!scoreToken || scoreToken.type !== "TEAM" || !scoreToken.active) {
      return reply.status(401).send({ success: false, error: "Invalid or expired token" });
    }

    await prisma.scoreToken.update({
      where: { id: scoreToken.id },
      data: { lastUsedAt: new Date() },
    });

    return reply.send({ success: true, data: { id: scoreToken.id, type: scoreToken.type, team: scoreToken.team } });
  });

  // Public: get matches for a team (used by team token page)
  app.get("/api/teams/:teamId/matches", async (req, reply) => {
    const { teamId } = req.params as { teamId: string };
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        scheduledMatch: { include: { field: { select: { name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ success: true, data: matches });
  });

  // Public: get standings + upcoming matches for a team
  app.get("/api/teams/:teamId/portal", async (req, reply) => {
    const { teamId } = req.params as { teamId: string };

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, tournamentId: true },
    });
    if (!team) return reply.status(404).send({ success: false, error: "Team not found" });

    // Group standings for this team across all groups they are in
    const standings = await prisma.groupStanding.findMany({
      where: { teamId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            standings: {
              orderBy: [{ points: "desc" }, { goalDifference: "desc" }, { goalsFor: "desc" }],
              include: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // Upcoming (non-completed) matches with schedule
    const upcoming = await prisma.match.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        status: { not: "COMPLETED" },
        scheduledMatch: { isNot: null },
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        scheduledMatch: { include: { field: { select: { name: true } } } },
      },
      orderBy: { scheduledMatch: { startTime: "asc" } },
      take: 5,
    });

    return reply.send({
      success: true,
      data: {
        standings: standings.map((s) => {
          const rows = s.group.standings;
          const rank = rows.findIndex((r) => r.teamId === teamId) + 1;
          return {
            groupId: s.groupId,
            groupName: s.group.name,
            rank,
            totalTeams: rows.length,
            played: s.played,
            wins: s.wins,
            draws: s.draws,
            losses: s.losses,
            goalsFor: s.goalsFor,
            goalsAgainst: s.goalsAgainst,
            goalDifference: s.goalDifference,
            points: s.points,
            table: rows.map((r, i) => ({
              rank: i + 1,
              teamId: r.teamId,
              teamName: r.team.name,
              played: r.played,
              wins: r.wins,
              draws: r.draws,
              losses: r.losses,
              goalDifference: r.goalDifference,
              points: r.points,
              isCurrentTeam: r.teamId === teamId,
            })),
          };
        }),
        upcoming: upcoming.map((m) => ({
          id: m.id,
          status: m.status,
          homeTeam: m.homeTeam?.name ?? "TBD",
          awayTeam: m.awayTeam?.name ?? "TBD",
          isHome: m.homeTeamId === teamId,
          startTime: m.scheduledMatch?.startTime,
          field: m.scheduledMatch?.field.name,
        })),
      },
    });
  });
}
