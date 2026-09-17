import { prisma } from "@stadia/db";

export type Permission =
  | "manage_general"
  | "manage_teams"
  | "manage_schedule"
  | "enter_results"
  | "manage_referees"
  | "manage_registration"
  | "manage_presentation"
  | "view_only";

export async function assertTournamentAccess(
  userId: string,
  tournamentId: string,
  required: Permission
): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true },
  });

  if (!tournament) throw new Error("Tournament not found");
  if (tournament.organizerId === userId) return; // owner has all permissions

  const admin = await prisma.tournamentAdmin.findUnique({
    where: { userId_tournamentId: { userId, tournamentId } },
  });

  if (!admin || !admin.permissions.includes(required)) {
    throw new Error("Permission denied");
  }
}

export async function isTournamentOwner(
  userId: string,
  tournamentId: string
): Promise<boolean> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true },
  });
  return t?.organizerId === userId;
}
