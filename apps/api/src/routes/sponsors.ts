import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";

const sponsorSchema = z.object({
  name: z.string().min(1).max(200),
  tier: z.enum(["PLATINUM", "GOLD", "SILVER", "BRONZE", "BLUE"]).optional(),
  logoUrl: z.string().url().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  cashAmount: z.number().int().min(0).optional(),
  inKindDescription: z.string().optional().nullable(),
  displayConfirmed: z.boolean().optional(),
  itemsReceived: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function sponsorRoutes(app: FastifyInstance) {
  // List sponsors
  app.get("/api/tournaments/:tournamentId/sponsors", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const sponsors = await prisma.sponsor.findMany({
      where: { tournamentId },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });
    return reply.send({ success: true, data: sponsors });
  });

  // Create sponsor
  app.post("/api/tournaments/:tournamentId/sponsors", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_general");
    const body = sponsorSchema.parse(req.body);
    const sponsor = await prisma.sponsor.create({ data: { tournamentId, ...body } });
    return reply.code(201).send({ success: true, data: sponsor });
  });

  // Update sponsor
  app.put("/api/sponsors/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, sponsor.tournamentId, "manage_general");
    const body = sponsorSchema.partial().parse(req.body);
    const updated = await prisma.sponsor.update({ where: { id }, data: body });
    return reply.send({ success: true, data: updated });
  });

  // Delete sponsor
  app.delete("/api/sponsors/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, sponsor.tournamentId, "manage_general");
    await prisma.sponsor.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}
