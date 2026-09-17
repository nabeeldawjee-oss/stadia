import type { FastifyInstance } from "fastify";
import { prisma } from "@stadia/db";

export async function teamTokenRoutes(app: FastifyInstance) {
  // Public: resolve team token and return team + their matches
  app.get("/api/team", async (req, reply) => {
    const { token } = req.query as { token?: string };
    if (!token) return reply.status(400).send({ error: "token required" });

    const scoreToken = await prisma.scoreToken.findUnique({
      where: { token },
      include: { team: true },
    });

    if (!scoreToken || scoreToken.type !== "TEAM" || !scoreToken.active) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }

    await prisma.scoreToken.update({
      where: { id: scoreToken.id },
      data: { lastUsedAt: new Date() },
    });

    return reply.send({
      id: scoreToken.id,
      type: scoreToken.type,
      team: scoreToken.team,
    });
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
    return reply.send(matches);
  });
}
