"use server";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/current-user";

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 60 * 60 * 24 * 14;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function startSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function register(formData: FormData) {
  const name = field(formData, "name");
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (name.length < 2 || name.length > 80) fail("/register", "Name must be between 2 and 80 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("/register", "Enter a valid email address.");
  if (password.length < 10 || password.length > 200) fail("/register", "Password must be at least 10 characters long.");
  if (password !== confirmPassword) fail("/register", "The passwords do not match.");

  const passwordHash = await hashPassword(password);
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) fail("/register", "An account with this email already exists. Please sign in.");

    // Compatibility: the earlier private MVP stored its existing data under seed-user.
    // The first registration claims that local record so the user's existing finance data remains available.
    const legacy = await prisma.user.findUnique({ where: { id: "seed-user" } });
    let user;
    if (legacy && !legacy.email && !legacy.passwordHash) {
      user = await prisma.user.update({
        where: { id: legacy.id },
        data: { name, email, passwordHash },
      });
    } else {
      user = await prisma.user.create({ data: { name, email, passwordHash, currency: "ETB" } });
    }
    await startSession(user.id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    fail("/register", "Could not create the account. The email may already be registered; please try signing in.");
  }
  redirect("/");
}

export async function login(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) fail("/login", "Enter your email and password.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    fail("/login", "Email or password is incorrect.");
  }
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login?notice=You%20have%20signed%20out.");
}
