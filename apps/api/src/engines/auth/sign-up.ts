import bcrypt from "bcryptjs";
import { prisma } from "@stadia/db";
import { slugify } from "@stadia/utils";
import { signToken } from "./jwt";
import type { SignUpBody } from "@stadia/types";

export async function signUp(body: SignUpBody) {
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: {
      email: body.email.toLowerCase().trim(),
      name: body.name.trim(),
      passwordHash,
    },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}
