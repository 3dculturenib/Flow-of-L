"use server";

import { CategoryKind, EventType, Prisma, RevisionChange } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { validateEffects } from "@/lib/events";
import { findOverdrawnAccounts } from "@/lib/balance";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function amountValue(raw: string, label = "Amount") {
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be a positive amount with up to two decimal places.`);
  const amount = new Prisma.Decimal(raw);
  if (!amount.isFinite() || amount.lte(0)) throw new Error(`${label} must be greater than zero.`);
  return amount;
}

function dateValue(raw: string) {
  const date = raw ? new Date(`${raw}T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid date.");
  return date;
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function fail(path: string, error: unknown): never {
  redirect(`${path}?error=${encodeURIComponent(safeMessage(error))}`);
}

function done(paths: string[], path: string, message: string): never {
  for (const item of paths) revalidatePath(item);
  redirect(`${path}?notice=${encodeURIComponent(message)}`);
}

export async function createAccount(formData: FormData) {
  const user = await getCurrentUser();
  const name = value(formData, "name");
  const type = value(formData, "type");
  const requestedDefault = formData.get("isDefault") === "on";
  if (name.length < 2) fail("/accounts", new Error("Account name must contain at least 2 characters."));
  if (type.length < 2 || type.length > 40) fail("/accounts", new Error("Account type must contain between 2 and 40 characters."));

  try {
    await prisma.$transaction(async (tx) => {
      const activeCount = await tx.account.count({ where: { userId: user.id, archivedAt: null } });
      const makeDefault = requestedDefault || activeCount === 0;
      if (makeDefault) await tx.account.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      await tx.account.create({ data: { userId: user.id, name, type, isDefault: makeDefault } });
    });
  } catch (error) { fail("/accounts", error); }
  done(["/", "/accounts", "/transactions"], "/accounts", "Account created.");
}

export async function setDefaultAccount(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = value(formData, "accountId");
  try {
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { id: accountId, userId: user.id, archivedAt: null } });
      if (!account) throw new Error("Account not found or archived.");
      await tx.account.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      await tx.account.update({ where: { id: account.id }, data: { isDefault: true } });
    });
  } catch (error) { fail("/accounts", error); }
  done(["/", "/accounts"], "/accounts", "Default account updated.");
}

export async function archiveAccount(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = value(formData, "accountId");
  try {
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { id: accountId, userId: user.id, archivedAt: null } });
      if (!account) throw new Error("Account not found or already archived.");
      const activeAccounts = await tx.account.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "asc" } });
      if (activeAccounts.length <= 1) throw new Error("You must keep at least one active account.");
      const accountBalance = await tx.accountEffect.aggregate({ where: { accountId: account.id, event: { userId: user.id, status: "ACTIVE" } }, _sum: { amount: true } });
      if (!(accountBalance._sum.amount ?? new Prisma.Decimal(0)).isZero()) throw new Error("Transfer the remaining balance to another account before archiving this account.");
      await tx.account.update({ where: { id: account.id }, data: { archivedAt: new Date(), isDefault: false } });
      if (account.isDefault) {
        const nextDefault = activeAccounts.find((item) => item.id !== account.id);
        if (nextDefault) await tx.account.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
      }
    });
  } catch (error) { fail("/accounts", error); }
  done(["/", "/accounts", "/transactions"], "/accounts", "Account archived. Historical records are preserved.");
}

export async function restoreAccount(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = value(formData, "accountId");
  try {
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { id: accountId, userId: user.id, archivedAt: { not: null } } });
      if (!account) throw new Error("Archived account not found or already active.");
      const activeAccounts = await tx.account.count({ where: { userId: user.id, archivedAt: null } });
      const activeDefault = await tx.account.findFirst({ where: { userId: user.id, archivedAt: null, isDefault: true } });
      await tx.account.update({ where: { id: account.id }, data: { archivedAt: null, isDefault: activeAccounts === 0 || !activeDefault } });
    });
  } catch (error) { fail("/accounts", error); }
  done(["/", "/accounts", "/transactions"], "/accounts", "Account restored. Its calculated balance and transaction history are available again.");
}

export async function saveOpeningBalance(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = value(formData, "accountId");
  const rawAmount = value(formData, "amount");
  const date = dateValue(value(formData, "occurredAt"));
  let amount: Prisma.Decimal;
  try {
    if (!rawAmount || !/^\d+(\.\d{1,2})?$/.test(rawAmount)) throw new Error("Enter a valid opening balance (zero is allowed).");
    amount = new Prisma.Decimal(rawAmount);
    if (!amount.isFinite() || amount.lt(0)) throw new Error("Opening balance cannot be negative. Record a transaction if the account is overdrawn.");
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { id: accountId, userId: user.id, archivedAt: null } });
      if (!account) throw new Error("Choose an active account.");
      const existing = await tx.financialEvent.findFirst({
        where: { userId: user.id, type: "OPENING_BALANCE", status: "ACTIVE", effects: { some: { accountId } } },
        include: { effects: true },
      });
      if (existing && amount!.eq(0)) {
        const before = { amount: existing.amount.toString(), occurredAt: existing.occurredAt.toISOString(), effects: existing.effects.map((e) => ({ accountId: e.accountId, amount: e.amount.toString() })) };
        await tx.financialEvent.update({ where: { id: existing.id }, data: { status: "REVERSED", reversedAt: new Date(), reverseNote: "Opening balance corrected to zero" } });
        await tx.eventRevision.create({ data: { eventId: existing.id, changeType: "EDIT", before, after: { amount: "0.00", accountId, status: "REVERSED" } } });
      } else if (existing) {
        const before = { amount: existing.amount.toString(), occurredAt: existing.occurredAt.toISOString(), effects: existing.effects.map((e) => ({ accountId: e.accountId, amount: e.amount.toString() })) };
        await tx.financialEvent.update({ where: { id: existing.id }, data: { amount, occurredAt: date, reason: "Opening balance" } });
        const effect = existing.effects[0];
        if (effect) await tx.accountEffect.update({ where: { id: effect.id }, data: { amount } });
        else await tx.accountEffect.create({ data: { eventId: existing.id, accountId, amount } });
        await tx.eventRevision.create({ data: { eventId: existing.id, changeType: "EDIT", before, after: { amount: amount.toString(), occurredAt: date.toISOString(), effects: [{ accountId, amount: amount.toString() }] } } });
      } else if (!amount!.eq(0)) {
        const event = await tx.financialEvent.create({
          data: { userId: user.id, type: "OPENING_BALANCE", occurredAt: date, amount, reason: "Opening balance", effects: { create: [{ accountId, amount }] } },
        });
        await tx.eventRevision.create({ data: { eventId: event.id, changeType: "CREATE", after: { amount: amount.toString(), occurredAt: date.toISOString(), effects: [{ accountId, amount: amount.toString() }] } } });
      }
    });
  } catch (error) { fail("/accounts", error); }
  done(["/", "/accounts", "/transactions"], "/accounts", "Opening balance saved. It is not counted as income.");
}

export async function createCategory(formData: FormData) {
  const user = await getCurrentUser();
  const name = value(formData, "name");
  const kind = value(formData, "kind") as CategoryKind;
  const parentId = value(formData, "parentId") || null;
  const description = value(formData, "description") || null;
  if (name.length < 2) fail("/categories", new Error("Category name must contain at least 2 characters."));
  if (kind !== "INCOME" && kind !== "EXPENSE") fail("/categories", new Error("Choose income or expense."));
  try {
    if (parentId) {
      const parent = await prisma.category.findFirst({ where: { id: parentId, userId: user.id, archivedAt: null } });
      if (!parent || parent.kind !== kind) throw new Error("Parent category must be active and have the same category type.");
    }
    await prisma.category.create({ data: { userId: user.id, name, kind, parentId, description } });
  } catch (error) { fail("/categories", error); }
  done(["/", "/categories", "/transactions"], "/categories", "Category created.");
}

export async function createTransaction(formData: FormData) {
  const user = await getCurrentUser();
  const type = value(formData, "type") as EventType;
  const reason = value(formData, "reason");
  const note = value(formData, "note") || null;
  const categoryId = value(formData, "categoryId") || null;
  const occurredAt = dateValue(value(formData, "occurredAt"));
  const isPlanned = value(formData, "isPlanned") === "true";
  const tagNames = value(formData, "tags").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
  let amount: Prisma.Decimal;
  let effects: { accountId: string; amount: Prisma.Decimal }[];
  let overdrawnAccountNames: string[] = [];

  try {
    if (type !== "INCOME" && type !== "EXPENSE" && type !== "TRANSFER") throw new Error("Choose income, expense, or transfer.");
    if (reason.length < 2) throw new Error("Description/reason is required.");
    amount = amountValue(value(formData, "amount"));
    if (type === "TRANSFER") {
      const sourceAccountId = value(formData, "sourceAccountId");
      const destinationAccountId = value(formData, "destinationAccountId");
      if (!sourceAccountId || !destinationAccountId) throw new Error("Choose both transfer accounts.");
      effects = [{ accountId: sourceAccountId, amount: amount.negated() }, { accountId: destinationAccountId, amount }];
    } else {
      const accountIds = formData.getAll("effectAccountId").map(String);
      const rawAmounts = formData.getAll("effectAmount").map(String);
      if (accountIds.length === 0 || accountIds.length !== rawAmounts.length) throw new Error("Add at least one account allocation.");
      effects = accountIds.map((accountId, index) => {
        const lineAmount = amountValue(rawAmounts[index], "Account allocation");
        return { accountId, amount: type === "EXPENSE" ? lineAmount.negated() : lineAmount };
      });
      if (new Set(accountIds).size !== accountIds.length) throw new Error("Use each account only once in the allocation list.");
      if (type === "EXPENSE" && !categoryId) throw new Error("Every expense needs a category.");
      if (type === "INCOME" && !categoryId) throw new Error("Every income needs a category.");
    }
    const accountIds = [...new Set(effects.map((effect) => effect.accountId))];
    const ownedAccounts = await prisma.account.findMany({ where: { id: { in: accountIds }, userId: user.id, archivedAt: null }, select: { id: true } });
    if (ownedAccounts.length !== accountIds.length) throw new Error("Every selected account must be active and belong to your account.");
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id, archivedAt: null } });
      if (!category || category.kind !== (type === "INCOME" ? "INCOME" : "EXPENSE")) throw new Error("Choose an active category matching the transaction type.");
    }
    validateEffects(type, amount, effects);
    const overdrawnIds = await findOverdrawnAccounts(prisma, user.id, effects);
    if (overdrawnIds.length) {
      const overdrawnAccounts = await prisma.account.findMany({ where: { id: { in: overdrawnIds }, userId: user.id }, select: { name: true } });
      overdrawnAccountNames = overdrawnAccounts.map((account) => account.name);
    }

    await prisma.$transaction(async (tx) => {
      const event = await tx.financialEvent.create({
        data: {
          userId: user.id, type, occurredAt, amount, reason, note, categoryId,
          isPlanned: type === "EXPENSE" ? isPlanned : null,
          effects: { create: effects },
        },
      });
      for (const tagName of [...new Set(tagNames)]) {
        const tag = await tx.tag.upsert({
          where: { userId_name: { userId: user.id, name: tagName } },
          update: {}, create: { userId: user.id, name: tagName },
        });
        await tx.eventTag.create({ data: { eventId: event.id, tagId: tag.id } });
      }
      await tx.eventRevision.create({
        data: {
          eventId: event.id, changeType: "CREATE",
          after: { type, amount: amount.toString(), reason, note, categoryId, isPlanned: type === "EXPENSE" ? isPlanned : null, tags: [...new Set(tagNames)], occurredAt: occurredAt.toISOString(), effects: effects.map((e) => ({ accountId: e.accountId, amount: e.amount.toString() })) },
        },
      });
    });
  } catch (error) { fail("/transactions", error); }
  const warning = overdrawnAccountNames.length ? ` Warning: ${overdrawnAccountNames.join(", ")} may have a negative calculated balance. Review this, but the transaction was saved.` : "";
  done(["/", "/accounts", "/transactions", "/categories"], "/transactions", `Transaction recorded.${warning}`);
}

export async function reverseTransaction(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = value(formData, "eventId");
  const reverseNote = value(formData, "reverseNote") || "Reversed by user for correction";
  try {
    await prisma.$transaction(async (tx) => {
      const event = await tx.financialEvent.findFirst({
        where: { id: eventId, userId: user.id, status: "ACTIVE" }, include: { effects: true, tags: true },
      });
      if (!event) throw new Error("Active transaction not found.");
      const before = {
        type: event.type, amount: event.amount.toString(), reason: event.reason, note: event.note,
        categoryId: event.categoryId, occurredAt: event.occurredAt.toISOString(),
        effects: event.effects.map((effect) => ({ accountId: effect.accountId, amount: effect.amount.toString() })),
        tags: event.tags.map((item) => item.tagId),
      };
      // A historical correction can change the calculated balance of an archived account.
      // Restore affected archived accounts before removing the event from active balances,
      // so the resulting balance remains visible and can be managed by the user.
      const affectedAccountIds = event.effects.map((effect) => effect.accountId);
      const restored = await tx.account.updateMany({
        where: { userId: user.id, id: { in: affectedAccountIds }, archivedAt: { not: null } },
        data: { archivedAt: null },
      });
      await tx.financialEvent.update({ where: { id: event.id }, data: { status: "REVERSED", reversedAt: new Date(), reverseNote } });
      await tx.eventRevision.create({ data: { eventId: event.id, changeType: RevisionChange.REVERSE, before, after: { status: "REVERSED", reverseNote, restoredArchivedAccounts: restored.count } } });
    });
  } catch (error) { fail("/transactions", error); }
  done(["/", "/accounts", "/transactions"], "/transactions", "Transaction reversed. Its original history is preserved. Any archived account affected by the correction has been restored so its recalculated balance remains visible.");
}

export async function updateCategory(formData: FormData) {
  const user = await getCurrentUser();
  const categoryId = value(formData, "categoryId");
  const name = value(formData, "name");
  const description = value(formData, "description") || null;
  if (name.length < 2) fail("/categories", new Error("Category name must contain at least 2 characters."));
  try {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id, archivedAt: null } });
    if (!category) throw new Error("Category not found or archived.");
    await prisma.category.update({ where: { id: category.id }, data: { name, description } });
  } catch (error) { fail("/categories", error); }
  done(["/", "/categories", "/transactions"], "/categories", "Category updated.");
}

export async function archiveCategory(formData: FormData) {
  const user = await getCurrentUser();
  const categoryId = value(formData, "categoryId");
  try {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id, archivedAt: null } });
    if (!category) throw new Error("Category not found or already archived.");
    const activeChildren = await prisma.category.count({ where: { userId: user.id, parentId: category.id, archivedAt: null } });
    if (activeChildren > 0) throw new Error("Archive this category's child categories first.");
    await prisma.category.update({ where: { id: category.id }, data: { archivedAt: new Date() } });
  } catch (error) { fail("/categories", error); }
  done(["/", "/categories", "/transactions"], "/categories", "Category archived. Existing transaction history is preserved.");
}

export async function updateAccount(formData: FormData) {
  const user = await getCurrentUser();
  const accountId = value(formData, "accountId");
  const name = value(formData, "name");
  const type = value(formData, "type");
  if (name.length < 2) fail("/accounts", new Error("Account name must contain at least 2 characters."));
  if (type.length < 2 || type.length > 40) fail("/accounts", new Error("Account type must contain between 2 and 40 characters."));
  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id, archivedAt: null } });
    if (!account) throw new Error("Account not found or archived.");
    await prisma.account.update({ where: { id: account.id }, data: { name, type } });
  } catch (error) { fail("/accounts", error); }
  done(["/", "/accounts", "/transactions"], "/accounts", "Account updated.");
}
