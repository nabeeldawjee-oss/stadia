import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { createRegistrationIntent, confirmRegistrationPayment } from "../engines/registration/process-registration";
import { stripe } from "../lib/stripe";
import { sendEmail, registrationConfirmedHtml } from "../lib/email";

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
    const schema = await prisma.registrationSchema.findUnique({ where: { tournamentId } });
    if (!schema) return reply.send({ success: true, data: [] });
    const regs = await prisma.registration.findMany({
      where: { schemaId: schema.id },
      include: { addOns: { include: { addOn: true } }, team: true },
      orderBy: { reservedAt: "desc" },
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
    const deadlinePassed = schema?.deadline && new Date(schema.deadline) < new Date();
    if (!schema?.isOpen || deadlinePassed) return reply.code(403).send({ success: false, error: "Registration is closed" });

    if (schema.maxTeams) {
      const confirmed = await prisma.registration.count({
        where: { schemaId: schema.id, status: { not: "WITHDRAWN" } },
      });
      if (confirmed >= schema.maxTeams) return reply.code(403).send({ success: false, error: "Registration is full" });
    }
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

  // Update registration status (organizer approve/reject)
  app.patch("/api/registrations/:registrationId", { preHandler: authenticate }, async (req, reply) => {
    const { registrationId } = req.params as { registrationId: string };
    const { status } = z.object({ status: z.enum(["CONFIRMED", "WITHDRAWN"]) }).parse(req.body);

    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { schema: { select: { tournamentId: true } } },
    });
    if (!reg) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, reg.schema.tournamentId, "manage_registration");

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: { status, ...(status === "CONFIRMED" ? { confirmedAt: new Date() } : {}) },
      include: { schema: { select: { tournamentId: true, tournament: { select: { name: true, slug: true, branding: { select: { primaryColor: true } } } }, entryFee: true, currency: true } } },
    });

    // Send confirmation email non-blocking
    if (status === "CONFIRMED") {
      const formData = updated.formData as Record<string, string> ?? {};
      const contactEmail = formData["email"] ?? formData["contact_email"] ?? formData["contactEmail"] ?? "";
      const teamName = formData["team_name"] ?? formData["teamName"] ?? formData["name"] ?? "Your team";
      const contactName = formData["contact_name"] ?? formData["contactName"] ?? formData["name"] ?? "Team manager";
      const webBase = (process.env.WEB_BASE_URL || "http://localhost:3001").split(",")[0].trim();
      const tournamentUrl = `${webBase}/t/${updated.schema.tournament.slug}`;
      if (contactEmail) {
        sendEmail({
          to: contactEmail,
          subject: `Registration confirmed — ${updated.schema.tournament.name}`,
          html: registrationConfirmedHtml({
            tournamentName: updated.schema.tournament.name,
            teamName,
            contactName,
            entryFee: updated.schema.entryFee,
            currency: updated.schema.currency,
            tournamentUrl,
          }),
        }).catch(() => {});
      }
    }

    return reply.send({ success: true, data: updated });
  });

  // Convert a confirmed registration into a tournament team
  app.post("/api/registrations/:registrationId/import-team", { preHandler: authenticate }, async (req, reply) => {
    const { registrationId } = req.params as { registrationId: string };

    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { schema: { select: { tournamentId: true } } },
    });
    if (!reg) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, reg.schema.tournamentId, "manage_registration");

    if (reg.status !== "CONFIRMED") {
      return reply.code(400).send({ success: false, error: "Only confirmed registrations can be imported as teams" });
    }
    if (reg.teamId) {
      return reply.code(400).send({ success: false, error: "This registration already has a team linked" });
    }

    const fd = reg.formData as Record<string, any>;
    const teamName = fd?.teamName ?? fd?.team_name ?? fd?.name ?? "Unnamed Team";

    const team = await prisma.team.create({
      data: {
        name: teamName,
        tournamentId: reg.schema.tournamentId,
        registrations: { connect: { id: reg.id } },
      },
    });

    return reply.send({ success: true, data: { teamId: team.id, teamName: team.name } });
  });

  // Bulk-import all un-linked confirmed registrations as tournament teams
  app.post("/api/tournaments/:tournamentId/registrations/import-all-teams", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_registration");

    const schema = await prisma.registrationSchema.findUnique({ where: { tournamentId } });
    if (!schema) return reply.send({ success: true, data: { imported: 0 } });

    const regs = await prisma.registration.findMany({
      where: { schemaId: schema.id, status: "CONFIRMED", teamId: null },
    });

    let imported = 0;
    for (const reg of regs) {
      const fd = reg.formData as Record<string, any>;
      const teamName = fd?.teamName ?? fd?.team_name ?? fd?.name ?? "Unnamed Team";
      await prisma.team.create({
        data: {
          name: teamName,
          tournamentId,
          registrations: { connect: { id: reg.id } },
        },
      });
      imported++;
    }

    return reply.send({ success: true, data: { imported } });
  });

  // Stripe webhook
  app.post("/api/webhooks/stripe", {
    config: { rawBody: true },
  }, async (req, reply) => {
    if (!stripe) return reply.code(503).send({ success: false, error: "Stripe not configured" });
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
