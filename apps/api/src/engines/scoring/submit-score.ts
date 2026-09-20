import { prisma } from "@stadia/db";
import { recalculateStandings } from "../standings/recalculate";
import { advanceBracketWinner } from "../format/advance-bracket-winner";
import type { SubmitScoreBody } from "@stadia/types";
import { sendEmail, scoreAlertHtml, unsubscribeUrl } from "../../lib/email";

type ScoreSource =
  | { type: "organizer"; userId: string }
  | { type: "referee"; refereeId: string }
  | { type: "team"; teamId: string };

export async function submitScore(
  matchId: string,
  body: SubmitScoreBody,
  source: ScoreSource
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { refAssignment: true },
  });

  if (!match) throw new Error("Match not found");
  if (match.status === "CANCELLED") throw new Error("Match is cancelled");

  // Authorization checks
  if (source.type === "referee") {
    if (match.refAssignment?.refereeId !== source.refereeId) {
      throw new Error("Referee not assigned to this match");
    }
    if (match.scoreLocked) {
      throw new Error("Score already submitted — contact organizer to override");
    }
  }

  if (source.type === "team") {
    if (match.homeTeamId !== source.teamId && match.awayTeamId !== source.teamId) {
      throw new Error("Team not participating in this match");
    }
  }

  // Save score
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        homeScore: body.homeScore,
        awayScore: body.awayScore,
        status: "COMPLETED",
        completedAt: new Date(),
        scoreLocked: source.type === "referee",
      },
    });

    // Save sets
    if (body.sets?.length) {
      await tx.matchSet.deleteMany({ where: { matchId } });
      await tx.matchSet.createMany({
        data: body.sets.map((s) => ({ matchId, ...s })),
      });
    }

    // Save player stats
    if (body.playerStats?.length) {
      await tx.matchPlayerStat.deleteMany({ where: { matchId } });
      await tx.matchPlayerStat.createMany({
        data: body.playerStats.map((s) => ({ matchId, ...s })),
      });
    }
  });

  // Downstream: recalculate standings or advance bracket
  if (match.contextType === "GROUP" && match.groupId) {
    await recalculateStandings(match.groupId);
  } else if (match.contextType === "BRACKET") {
    await advanceBracketWinner(matchId);
  }

  // Fire score-alert emails to tournament followers (non-blocking)
  sendScoreAlerts(matchId, body.homeScore, body.awayScore).catch(() => {});
}

async function sendScoreAlerts(matchId: string, homeScore: number, awayScore: number) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      tournamentId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      tournament: { select: { name: true, slug: true, follows: { select: { userId: true, user: { select: { email: true, name: true } } } } } },
    },
  });
  if (!match || !match.homeTeam || !match.awayTeam) return;
  if (!match.tournament.follows.length) return;

  const webBase = (process.env.WEB_BASE_URL || "http://localhost:3001").split(",")[0].trim();
  const tournamentUrl = `${webBase}/t/${match.tournament.slug}`;

  for (const follow of match.tournament.follows) {
    await sendEmail({
      to: follow.user.email,
      subject: `${match.homeTeam.name} ${homeScore}–${awayScore} ${match.awayTeam.name} · ${match.tournament.name}`,
      html: scoreAlertHtml({
        tournamentName: match.tournament.name,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeScore,
        awayScore,
        tournamentUrl,
        unsubUrl: unsubscribeUrl(follow.userId, match.tournamentId),
      }),
    }).catch(() => {});
  }
}
