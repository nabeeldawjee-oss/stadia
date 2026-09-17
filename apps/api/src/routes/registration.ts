import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { createRegistrationIntent, confirmRegistrationPayment } from "../engines/registration/process-registration";
import { stripe } from "../lib/stripe";

const schemaBody = z.object({
  entryFee: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  maxTeams: z.number().int().optional(),
  deadline: z.string().optional(),
  isOpen: z.boolean().optional(),
  fields: z.array(z.object({
    fieldKey: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    orderIndex: z.number().int().optional(),
  })).optional(),
});

export async function registrationRoutes(app: FastifyInstance) {
  // Get/create registration schema
  app.get("/api/tournaments/:tournamentId/registration", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_registration");
    const schema = await prisma.registrationSchema.findUnique({
      where: { tournamentId },
      include: { fields: { orderBy: { orderIndex: "asc" } }, addOns: true },
    });
    return reply.send({ success: true, data: schema });
  });

  app.put("/api/tournaments/:tournamentId/registration", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_registration");
    const body = schemaBody.parse(req.body);

    const schema = await prisma.registrationSchema.upsert({
      where: { tournamentId },
      create: {
        tournamentId,
        entryFee: body.entryFee,
        currency: body.currency ?? "USD",
        maxTeams: body.maxTeams,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        isOpen: body.isOpen ?? false,
      },
      update: {
        entryFee: body.entryFee,
        currency: body.currency,
        maxTeams: body.maxTeams,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        isOpen: body.isOpen,
      },
    });

    if (body.fields) {
      await prisma.formField.deleteMany({ where: { schemaId: schema.id } });
      await prisma.formField.createMany({
        data: body.fields.map((f, i) => ({
          schemaId: schema.id,
          fieldKey: f.fieldKey,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          options: f.options ?? [],
          orderIndex: f.orderIndex ?? i,
        })),
      });
    }

    return reply.send({ success: true, data: schema });
  });

  // List registrations
  app.get("/api/tournaments/:tournamentId/registrations", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_registration");
    const regs = await prisma.registration.findMany({
      where: { tournamentId },
      include: { addOns: { include: { addOn: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: regs });
  });

  // Public registration form data
  app.get("/api/public/t/:slug/register", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true } });
    if (!tournament) return reply.code(404).send({ success: false, error: "Not found" });
    const schema = await prisma.registrationSchema.findUnique({
      where: { tournamentId: tournament.id },
      include: { fields: { orderBy: { orderIndex: "asc" } }, addOns: true },
    });
    if (!schema?.isOpen) return reply.code(403).send({ success: false, error: "Registration is closed" });
    return reply.send({ success: true, data: schema });
  });

  // Public: submit registration
  app.post("/api/public/t/:slug/register", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true } });
    if (!tournament) return reply.code(404).send({ success: false, error: "Not found" });
    try {
      const result = await createRegistrationIntent(tournament.id, req.body as Record<string, any>);
      return reply.code(201).send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  // Stripe webhook
  app.post("/api/webhooks/stripe", {
    config: { rawBody: true },
  }, async (req, reply) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch {
      return reply.code(400).send("Webhook signature invalid");
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as { id: string };
      await confirmRegistrationPayment(pi.id).catch(() => {});
    }

    return reply.send({ received: true });
  });
}
