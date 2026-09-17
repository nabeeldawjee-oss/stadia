import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { saveAdvancementRules, getAdvancementRules } from "../engines/format/advancement-rules";

const ruleSchema = z.array(z.object({
  fromGroupId: z.string(),
  position: z.number().int().min(1),
  toPhaseId: z.string(),
  toBracketSlotId: z.string().optional(),
  toBracketSide: z.enum(["HOME", "AWAY"]).optional(),
  toBracketRound: z.number().int().optional(),
  toBracketPosition: z.number().int().optional(),
}));

const tiebreakerSchema = z.object({
  chain: z.array(z.enum(["points", "goal_difference", "goals_for", "goals_against", "head_to_head"])),
});

export async function advancementRoutes(app: FastifyInstance) {
  // Get advancement rules for a phase
  app.get("/api/phases/:phaseId/advancement", { preHandler: authenticate }, async (req, reply) => {
    const { phaseId } = req.params as { phaseId: string };
    const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { division: true } });
    if (!phase) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "manage_general");
    const rules = await getAdvancementRules(phaseId);
    return reply.send({ success: true, data: rules });
  });

  // Save advancement rules for a phase
  app.put("/api/phases/:phaseId/advancement", { preHandler: authenticate }, async (req, reply) => {
    const { phaseId } = req.params as { phaseId: string };
    const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { division: true } });
    if (!phase) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, phase.division.tournamentId, "manage_general");
    const rules = ruleSchema.parse(req.body);
    await saveAdvancementRules(rules);
    return reply.send({ success: true, data: null });
  });

  // Get tiebreaker chain for a group
  app.get("/api/groups/:groupId/tiebreaker", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { phase: { include: { division: true } } },
    });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, group.phase.division.tournamentId, "manage_general");
    return reply.send({ success: true, data: { chain: group.tiebreakerChain ?? ["points", "goal_difference", "goals_for", "head_to_head"] } });
  });

  // Update tiebreaker chain for a group
  app.put("/api/groups/:groupId/tiebreaker", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { phase: { include: { division: true } } },
    });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, group.phase.division.tournamentId, "manage_general");
    const { chain } = tiebreakerSchema.parse(req.body);
    await prisma.group.update({ where: { id: groupId }, data: { tiebreakerChain: chain } });
    return reply.send({ success: true, data: { chain } });
  });
}
