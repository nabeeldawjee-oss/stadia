import bcrypt from "bcryptjs";
import { prisma } from "@stadia/db";
import { signToken } from "./jwt";
import type { SignInBody } from "@stadia/types";

export async function signIn(body: SignInBody) {
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
  });

  if (!user) throw new Error("Invalid email or password");

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) throw new Error("Invalid email or password");

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}
