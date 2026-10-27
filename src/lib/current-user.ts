import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "flowofl_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be set to a random value of at least 32 characters.");
  return value;
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(`${userId}|${Date.now() + SESSION_SECONDS * 1000}`).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf("|");
    const userId = decoded.slice(0, separator);
    const expiry = Number(decoded.slice(separator + 1));
    if (!userId || !Number.isFinite(expiry) || expiry <= Date.now()) return null;
    return userId;
  } catch { return null; }
}

export async function getOptionalCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getCurrentUser() {
  const user = await getOptionalCurrentUser();
  if (!user || !user.email || !user.passwordHash) redirect("/login");
  if (!user.setupComplete) redirect("/setup");
  return user;
}
