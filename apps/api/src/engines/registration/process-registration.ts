import { prisma } from "@stadia/db";
import { stripe } from "../../lib/stripe";
import { sendEmail, registrationConfirmedHtml } from "../../lib/email";

function getFromForm(fd: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) if (fd[k]) return String(fd[k]);
  return "";
}

export async function createRegistrationIntent(tournamentId: string, formData: Record<string, any>) {
  const schema = await prisma.registrationSchema.findUnique({
    where: { tournamentId },
    include: { addOns: true, fields: { orderBy: { orderIndex: "asc" } } },
  });
  if (!schema) throw new Error("Registration is not enabled for this tournament");
  if (!schema.isOpen) throw new Error("Registration is closed");
  if (schema.deadline && new Date(schema.deadline) < new Date()) throw new Error("Registration deadline has passed");

  if (schema.maxTeams) {
    const confirmed = await prisma.registration.count({
      where: { schemaId: schema.id, status: { not: "WITHDRAWN" } },
    });
    if (confirmed >= schema.maxTeams) throw new Error("This tournament has reached its maximum number of registrations");
  }

  // Validate required fields
  for (const field of schema.fields) {
    if (field.required && !formData[field.fieldKey]) {
      throw new Error(`Required field missing: ${field.label}`);
    }
  }

  const selectedAddOnIds: string[] = formData.addOnIds ?? [];
  const selectedAddOns = schema.addOns.filter((a) => selectedAddOnIds.includes(a.id));
  const total = (schema.entryFee ?? 0) + selectedAddOns.reduce((s, a) => s + a.price, 0);
  const expiresAt = new Date(Date.now() + (total === 0 ? 365 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000));

  const registration = await prisma.registration.create({
    data: {
      schema: { connect: { id: schema.id } },
      formData,
      status: total === 0 ? "CONFIRMED" : "PENDING_PAYMENT",
      totalAmount: total,
      currency: schema.currency,
      expiresAt,
      confirmedAt: total === 0 ? new Date() : undefined,
      addOns: selectedAddOns.length > 0 ? {
        create: selectedAddOns.map((a) => ({ addOnId: a.id, qty: 1, unitPrice: a.price })),
      } : undefined,
    },
  });

  if (total === 0) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, slug: true },
    });
    const contactEmail = getFromForm(formData, "email", "contact_email", "contactEmail");
    const teamName = getFromForm(formData, "team_name", "teamName", "name") || "Your team";
    const contactName = getFromForm(formData, "contact_name", "contactName", "name") || teamName;
    if (tournament && contactEmail) {
      const baseUrl = (process.env.WEB_BASE_URL || "https://stadia.app").split(",")[0].trim();
      Promise.resolve().then(() =>
        sendEmail({
          to: contactEmail,
          subject: `Registration confirmed — ${tournament.name}`,
          html: registrationConfirmedHtml({
            tournamentName: tournament.name,
            teamName,
            contactName,
            entryFee: 0,
            currency: schema.currency,
            tournamentUrl: `${baseUrl}/t/${tournament.slug}`,
          }),
        })
      ).catch(() => {});
    }
    return { registration, clientSecret: null };
  }

  if (!stripe) throw new Error("Stripe is not configured");

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: schema.currency.toLowerCase(),
    metadata: { registrationId: registration.id, tournamentId },
  });

  await prisma.registration.update({
    where: { id: registration.id },
    data: { paymentIntentId: paymentIntent.id },
  });

  return { registration, clientSecret: paymentIntent.client_secret };
}

export async function confirmRegistrationPayment(paymentIntentId: string) {
  const registration = await prisma.registration.findFirst({
    where: { paymentIntentId },
    include: {
      schema: {
        include: {
          tournament: {
            include: { organizer: { select: { email: true } } },
          },
        },
      },
    },
  });
  if (!registration) throw new Error("Registration not found");

  await prisma.registration.update({
    where: { id: registration.id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  const fd = registration.formData as Record<string, any>;
  const contactEmail = getFromForm(fd, "email", "contact_email", "contactEmail");
  const teamName = getFromForm(fd, "team_name", "teamName", "name") || "Your team";
  const contactName = getFromForm(fd, "contact_name", "contactName", "name") || teamName;
  const { tournament } = registration.schema;
  const baseUrl = (process.env.WEB_BASE_URL || "https://stadia.app").split(",")[0].trim();
  const tournamentUrl = `${baseUrl}/t/${tournament.slug}`;

  const emailPayload = {
    tournamentName: tournament.name,
    teamName,
    contactName,
    entryFee: registration.totalAmount,
    currency: registration.currency,
    tournamentUrl,
  };

  Promise.all([
    contactEmail
      ? sendEmail({ to: contactEmail, subject: `Registration confirmed — ${tournament.name}`, html: registrationConfirmedHtml(emailPayload) })
      : Promise.resolve(),
    tournament.organizer.email
      ? sendEmail({
          to: tournament.organizer.email,
          subject: `New registration: ${teamName} — ${tournament.name}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <h1 style="font-size:20px;font-weight:800;color:#111827">New team registered</h1>
            <p style="color:#374151"><strong>${teamName}</strong> has paid and registered for <strong>${tournament.name}</strong>.</p>
            <p style="color:#374151">Contact: ${contactName}${contactEmail ? ` &lt;${contactEmail}&gt;` : ""}</p>
            <a href="${baseUrl}/dashboard/tournaments/${registration.schema.tournamentId}/registration" style="display:inline-block;background:#111827;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">View registration →</a>
          </div>`,
        })
      : Promise.resolve(),
  ]).catch(() => {});

  return { registration };
}
