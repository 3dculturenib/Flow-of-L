"use server";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, getOptionalCurrentUser, SESSION_COOKIE } from "@/lib/current-user";
import { Prisma } from "@prisma/client";

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
        data: { name, email, passwordHash, setupComplete: true },
      });
    } else {
      user = await prisma.user.create({ data: { name, email, passwordHash, currency: "ETB", setupComplete: false } });
    }
    await startSession(user.id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    fail("/register", "Could not create the account. The email may already be registered; please try signing in.");
  }
  redirect(user.setupComplete ? "/" : "/setup");
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
  redirect(user.setupComplete ? "/" : "/setup");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login?notice=You%20have%20signed%20out.");
}


export async function completeInitialSetup(formData: FormData) {
  const user = await getOptionalCurrentUser();
  if (!user || !user.email || !user.passwordHash) redirect("/login");
  const accountName = field(formData, "accountName");
  const accountType = field(formData, "accountType");
  const openingRaw = field(formData, "openingBalance") || "0";
  const allowedTypes = ["Bank account", "Cash", "Mobile money", "Savings account", "Investment", "Wallet", "Other"];
  if (accountName.length < 2 || accountName.length > 80) fail("/setup", "Account name must be between 2 and 80 characters.");
  if (!allowedTypes.includes(accountType)) fail("/setup", "Choose an account type from the list.");
  if (!/^\d+(\.\d{1,2})?$/.test(openingRaw)) fail("/setup", "Opening balance must be zero or a positive amount with up to two decimal places.");
  const opening = new Prisma.Decimal(openingRaw);
  if (!opening.isFinite() || opening.lt(0)) fail("/setup", "Opening balance cannot be negative.");
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.account.count({ where: { userId: user.id, archivedAt: null } });
      if (existing === 0) {
        const account = await tx.account.create({ data: { userId: user.id, name: accountName, type: accountType, isDefault: true } });
        if (opening.gt(0)) {
          const occurredAt = new Date();
          const event = await tx.financialEvent.create({ data: { userId: user.id, type: "OPENING_BALANCE", occurredAt, amount: opening, reason: "Opening balance", note: "Initial balance entered during first-time setup", effects: { create: [{ accountId: account.id, amount: opening }] } } });
          await tx.eventRevision.create({ data: { eventId: event.id, changeType: "CREATE", after: { type: "OPENING_BALANCE", amount: opening.toString(), reason: "Opening balance", effects: [{ accountId: account.id, amount: opening.toString() }] } } });
        }
      }
      await tx.user.update({ where: { id: user.id }, data: { setupComplete: true } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    fail("/setup", "Could not complete setup. Please check your information and try again.");
  }
  redirect("/");
}
