import { PrismaClient, Prisma } from "@prisma/client";

/** Balance = sum of effect lines from ACTIVE events. Never stored by hand. */
export async function getAccountBalances(prisma: PrismaClient, userId: string) {
  const rows = await prisma.accountEffect.groupBy({
    by: ["accountId"],
    where: { event: { userId, status: "ACTIVE" } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.accountId, r._sum.amount ?? new Prisma.Decimal(0)]));
}

/** Warning check (never a block): would these effects push any account negative? */
export async function findOverdrawnAccounts(
  prisma: PrismaClient,
  userId: string,
  effects: { accountId: string; amount: Prisma.Decimal | number | string }[],
) {
  const balances = await getAccountBalances(prisma, userId);
  return effects
    .filter((e) => new Prisma.Decimal(e.amount).lt(0))
    .filter((e) => (balances.get(e.accountId) ?? new Prisma.Decimal(0)).plus(new Prisma.Decimal(e.amount)).lt(0))
    .map((e) => e.accountId);
}
