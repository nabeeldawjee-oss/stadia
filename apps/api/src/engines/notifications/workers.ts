import { Queue, Worker } from "bullmq";
import { redis } from "../../lib/redis";
import { Resend } from "resend";
import { logger } from "../../lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export const emailQueue = new Queue("emails", { connection: redis });
export const pushQueue = new Queue("push-notifications", { connection: redis });

// Email worker
new Worker(
  "emails",
  async (job) => {
    const { to, subject, html } = job.data;
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@stadia.app",
      to,
      subject,
      html,
    });
    logger.info({ to, subject }, "Email sent");
  },
  { connection: redis }
);

// Push notification worker
new Worker(
  "push-notifications",
  async (job) => {
    const { tokens, title, body, data } = job.data;
    if (!tokens?.length) return;

    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 100) {
      chunks.push(tokens.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const messages = chunk.map((t: string) => ({
        to: t,
        title,
        body,
        data: data ?? {},
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
    }

    logger.info({ count: tokens.length, title }, "Push notifications sent");
  },
  { connection: redis }
);

export async function queueEmail(to: string, subject: string, html: string) {
  await emailQueue.add("send-email", { to, subject, html });
}

export async function queuePush(tokens: string[], title: string, body: string, data?: Record<string, any>) {
  if (tokens.length === 0) return;
  await pushQueue.add("send-push", { tokens, title, body, data });
}
