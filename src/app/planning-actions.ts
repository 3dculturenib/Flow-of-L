"use server";

import { PlanKind, PlanMatchStatus, PlanPriority, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

function val(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function parseDate(raw: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Choose valid start and end dates.");
  const date = new Date(`${raw}T${end ? "23:59:59.999" : "00:00:00"}`);
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid date.");
  return date;
}
function fail(error: unknown): never { const message = error instanceof Error ? error.message : "Something went wrong."; redirect(`/planning?error=${encodeURIComponent(message)}`); }
function done(message: string): never { revalidatePath("/planning"); revalidatePath("/reports"); redirect(`/planning?notice=${encodeURIComponent(message)}`); }
function parseAmount(raw: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error("Enter a positive amount with up to two decimal places.");
  const amount = new Prisma.Decimal(raw);
  if (!amount.isFinite() || amount.lte(0)) throw new Error("Plan amount must be greater than zero.");
  return amount;
}

export async function createPlan(formData: FormData) {
  const user = await getCurrentUser();
  const kind = val(formData, "kind") as PlanKind;
  const name = val(formData, "name");
  const categoryId = val(formData, "categoryId");
  const note = val(formData, "note") || null;
  try {
    if (kind !== "INCOME" && kind !== "EXPENSE") throw new Error("Choose planned income or planned expense.");
    if (name.length < 2 || name.length > 100) throw new Error("Plan name must be between 2 and 100 characters.");
    const priority = val(formData, "priority") as PlanPriority;
    if (!Object.values(PlanPriority).includes(priority)) throw new Error("Choose a valid plan priority.");
    const amount = parseAmount(val(formData, "amount"));
    const startDate = parseDate(val(formData, "startDate"));
    const endDate = parseDate(val(formData, "endDate"), true);
    if (startDate > endDate) throw new Error("End date must be on or after the start date.");
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id, archivedAt: null } });
    if (!category || category.kind !== kind) throw new Error("Choose an active category matching the plan type.");
    await prisma.financialPlan.create({ data: { userId: user.id, kind, priority, name, categoryId, amount, startDate, endDate, note } });
  } catch (error) { fail(error); }
  done("Plan created. It does not change account balances.");
}

export async function updatePlan(formData: FormData) {
  const user = await getCurrentUser();
  const planId = val(formData, "planId");
  const kind = val(formData, "kind") as PlanKind;
  const name = val(formData, "name");
  const categoryId = val(formData, "categoryId");
  const note = val(formData, "note") || null;
  try {
    const plan = await prisma.financialPlan.findFirst({ where: { id: planId, userId: user.id } });
    if (!plan) throw new Error("Plan not found.");
    if (kind !== "INCOME" && kind !== "EXPENSE") throw new Error("Choose planned income or planned expense.");
    if (name.length < 2 || name.length > 100) throw new Error("Plan name must be between 2 and 100 characters.");
    const priority = val(formData, "priority") as PlanPriority;
    if (!Object.values(PlanPriority).includes(priority)) throw new Error("Choose a valid plan priority.");
    const amount = parseAmount(val(formData, "amount"));
    const startDate = parseDate(val(formData, "startDate"));
    const endDate = parseDate(val(formData, "endDate"), true);
    if (startDate > endDate) throw new Error("End date must be on or after the start date.");
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: user.id, archivedAt: null } });
    if (!category || category.kind !== kind) throw new Error("Choose an active category matching the plan type.");
    await prisma.financialPlan.update({ where: { id: plan.id }, data: { kind, priority, name, categoryId, amount, startDate, endDate, note } });
    // Keep only confirmed matches that still fit the revised type/category/date window.
    const matches = await prisma.planMatch.findMany({ where: { planId: plan.id }, include: { event: true } });
    for (const match of matches) {
      const typeFits = String(match.event.type) === String(kind);
      const categoryFits = match.event.categoryId === categoryId;
      const dateFits = match.event.occurredAt >= startDate && match.event.occurredAt <= endDate;
      if (!typeFits || !categoryFits || !dateFits) await prisma.planMatch.delete({ where: { id: match.id } });
    }
  } catch (error) { fail(error); }
  done("Plan updated. Matches that no longer fit were removed from the confirmed total.");
}

export async function setPlanMatch(formData: FormData) {
  const user = await getCurrentUser();
  const planId = val(formData, "planId");
  const eventId = val(formData, "eventId");
  const requested = val(formData, "status") as PlanMatchStatus;
  try {
    if (requested !== "SUGGESTED" && requested !== "CONFIRMED" && requested !== "REJECTED") throw new Error("Invalid match decision.");
    const plan = await prisma.financialPlan.findFirst({ where: { id: planId, userId: user.id } });
    const event = await prisma.financialEvent.findFirst({ where: { id: eventId, userId: user.id }, include: { category: true } });
    if (!plan || !event) throw new Error("Plan or transaction not found.");
    if (requested === "CONFIRMED") {
      const categoryFits = event.categoryId === plan.categoryId;
      const typeFits = event.type === plan.kind && event.status === "ACTIVE";
      const dateFits = event.occurredAt >= plan.startDate && event.occurredAt <= plan.endDate;
      if (!categoryFits || !typeFits || !dateFits) throw new Error("This transaction no longer matches the plan's type, category, and date range.");
      const otherConfirmed = await prisma.planMatch.findFirst({ where: { eventId, status: "CONFIRMED", planId: { not: planId }, plan: { userId: user.id } } });
      if (otherConfirmed) throw new Error("This transaction is already confirmed against another plan. Remove that match first.");
    }
    await prisma.planMatch.upsert({ where: { planId_eventId: { planId, eventId } }, create: { planId, eventId, status: requested }, update: { status: requested } });
  } catch (error) { fail(error); }
  done(requested === "CONFIRMED" ? "Transaction matched to the plan." : requested === "SUGGESTED" ? "Suggestion restored for review." : "Suggestion dismissed / match removed.");
}
