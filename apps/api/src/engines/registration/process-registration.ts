import { prisma } from "@stadia/db";
import { stripe } from "../../lib/stripe";
import { generateScoreToken } from "../referees/generate-token";
import { sendEmail, registrationConfirmedHtml } from "../../lib/email";

export async function createRegistrationIntent(tournamentId: string, formData: Record<string, any>) {
  const schema = await prisma.registrationSchema.findUnique({
    where: { tournamentId },
    include: { addOns: true, fields: { orderBy: { orderIndex: "asc" } } },
  });
  if (!schema) throw new Error("Registration is not enabled for this tournament");
  if (!schema.isOpen) throw new Error("Registration is closed");

  // Validate required fields
  for (const field of schema.fields) {
    if (field.required && !formData[field.fieldKey]) {
      throw new Error(`Required field missing: ${field.label}`);
    }
  }

  const selectedAddOnIds: string[] = formData.addOnIds ?? [];
  const selectedAddOns = schema.addOns.filter((a) => selectedAddOnIds.includes(a.id));
  const total = (schema.entryFee ?? 0) + selectedAddOns.reduce((sum, a) => sum + a.price, 0);

  const registration = await prisma.registration.create({
    data: {
      tournamentId,
      teamName: formData.teamName ?? "Unknown",
      contactName: formData.contactName ?? "",
      contactEmail: formData.contactEmail ?? "",
      contactPhone: formData.contactPhone,
      formData,
      paymentStatus: total === 0 ? "PAID" : "PENDING",
      amountDue: total,
      addOns: selectedAddOnIds.length > 0 ? {
        create: selectedAddOns.map((a) => ({ addOnId: a.id, price: a.price })),
      } : undefined,
    },
  });

  if (total === 0) {
    // Free registration — send confirmation immediately
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, slug: true },
    });
    if (tournament && registration.contactEmail) {
      const baseUrl = (process.env.WEB_BASE_URL || "https://stadia.app").split(",")[0].trim();
      Promise.resolve().then(() =>
        sendEmail({
          to: registration.contactEmail,
          subject: `Registration confirmed — ${tournament.name}`,
          html: registrationConfirmedHtml({
            tournamentName: tournament.name,
            teamName: registration.teamName,
            contactName: registration.contactName || registration.teamName,
            entryFee: 0,
            currency: "USD",
            tournamentUrl: `${baseUrl}/t/${tournament.slug}`,
          }),
        })
      ).catch(() => {});
    }
    return { registration, clientSecret: null };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: "usd",
    metadata: { registrationId: registration.id, tournamentId },
  });

  await prisma.registration.update({
    where: { id: registration.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return { registration, clientSecret: paymentIntent.client_secret };
}

export async function confirmRegistrationPayment(paymentIntentId: string) {
  const registration = await prisma.registration.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      tournament: { include: { organizer: { select: { email: true } } } },
    },
  });
  if (!registration) throw new Error("Registration not found");

  await prisma.registration.update({
    where: { id: registration.id },
    data: { paymentStatus: "PAID" },
  });

  // Auto-create team + generate token
  const team = await prisma.team.create({
    data: {
      tournamentId: registration.tournamentId,
      name: registration.teamName,
    },
  });

  await generateScoreToken("TEAM", team.id, registration.tournamentId);

  // Send confirmation emails (fire-and-forget)
  const baseUrl = (process.env.WEB_BASE_URL || "https://stadia.app").split(",")[0].trim();
  const tournamentUrl = `${baseUrl}/t/${registration.tournament.slug}`;
  const { name: tournamentName, organizer } = registration.tournament;
  const emailPayload = {
    tournamentName,
    teamName: registration.teamName,
    contactName: registration.contactName || registration.teamName,
    entryFee: registration.amountDue,
    currency: "USD",
    tournamentUrl,
  };
  Promise.all([
    registration.contactEmail
      ? sendEmail({ to: registration.contactEmail, subject: `Registration confirmed — ${tournamentName}`, html: registrationConfirmedHtml(emailPayload) })
      : Promise.resolve(),
    organizer.email
      ? sendEmail({
          to: organizer.email,
          subject: `New registration: ${registration.teamName} — ${tournamentName}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
            <h1 style="font-size:20px;font-weight:800;color:#111827">New team registered</h1>
            <p style="color:#374151"><strong>${registration.teamName}</strong> has paid and registered for <strong>${tournamentName}</strong>.</p>
            <p style="color:#374151">Contact: ${registration.contactName} &lt;${registration.contactEmail}&gt;</p>
            <a href="${baseUrl}/dashboard/tournaments/${registration.tournamentId}/registration" style="display:inline-block;background:#111827;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">View registration →</a>
          </div>`,
        })
      : Promise.resolve(),
  ]).catch(() => {});

  return { registration, team };
}
