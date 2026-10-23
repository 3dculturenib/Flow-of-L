import { PrismaClient, Prisma } from "@prisma/client";
import { validateEffects } from "../src/lib/events";

const prisma = new PrismaClient();
const SEED_USER_ID = "seed-user";

async function findOrCreateAccount(userId: string, name: string, type: string, isDefault = false) {
  const existing = await prisma.account.findFirst({ where: { userId, name } });
  if (existing) return existing;
  return prisma.account.create({ data: { userId, name, type, isDefault } });
}

async function findOrCreateCategory(userId: string, kind: "INCOME" | "EXPENSE", name: string, parentId?: string) {
  const existing = await prisma.category.findFirst({ where: { userId, kind, name, parentId: parentId ?? null } });
  if (existing) return existing;
  return prisma.category.create({ data: { userId, kind, name, parentId: parentId ?? null } });
}

async function ensureOpeningBalance(userId: string, accountId: string, amount: number) {
  const existing = await prisma.financialEvent.findFirst({
    where: { userId, type: "OPENING_BALANCE", effects: { some: { accountId } } },
  });
  if (existing) return;
  const effects = [{ accountId, amount: new Prisma.Decimal(amount) }];
  validateEffects("OPENING_BALANCE", amount, effects);
  await prisma.$transaction(async (tx) => {
    const event = await tx.financialEvent.create({
      data: {
        userId, type: "OPENING_BALANCE", occurredAt: new Date(), amount: new Prisma.Decimal(amount),
        reason: "Opening balance", effects: { create: effects },
      },
    });
    await tx.eventRevision.create({
      data: { eventId: event.id, changeType: "CREATE", after: { amount, accountId } },
    });
  });
}

async function main() {
  const user = await prisma.user.upsert({
    where: { id: SEED_USER_ID }, update: {}, create: { id: SEED_USER_ID, name: "Me", currency: "ETB" },
  });
  const main = await findOrCreateAccount(user.id, "Main account", "Bank account", true);
  const savings = await findOrCreateAccount(user.id, "Savings account", "Savings account");
  const cash = await findOrCreateAccount(user.id, "Cash", "Cash");

  const expenseTree: Record<string, string[]> = {
    Food: ["Groceries", "Restaurant"], Transport: [], Utilities: [], Rent: [], Health: [], Other: [],
  };
  for (const [parentName, children] of Object.entries(expenseTree)) {
    const parent = await findOrCreateCategory(user.id, "EXPENSE", parentName);
    for (const childName of children) await findOrCreateCategory(user.id, "EXPENSE", childName, parent.id);
  }
  for (const name of ["Salary", "Rent income", "Side income", "Other income"])
    await findOrCreateCategory(user.id, "INCOME", name);

  await ensureOpeningBalance(user.id, main.id, 25000);
  await ensureOpeningBalance(user.id, savings.id, 40000);
  await ensureOpeningBalance(user.id, cash.id, 1500);
  console.log("Seed complete (safe to rerun): seed user, 3 accounts, categories, and opening balances ensured.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
