import { prisma } from "@stadia/db";
import { stripe } from "../../lib/stripe";
import { generateScoreToken } from "../referees/generate-token";

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
    include: { tournament: true },
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

  return { registration, team };
}
