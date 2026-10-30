import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { createPlan, setPlanMatch, updatePlan } from "@/app/planning-actions";
import PlanTypeCategoryFields from "@/app/planning/PlanTypeCategoryFields";

export const dynamic = "force-dynamic";
const money = (value: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(value);
const num = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0);
const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (date: Date) => date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default async function PlanningPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [categories, plans, allEvents, confirmedElsewhere] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.financialPlan.findMany({
      where: { userId: user.id },
      include: {
        category: true,
        matches: {
          include: { event: { include: { category: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ priority: "asc" }, { startDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.financialEvent.findMany({ where: { userId: user.id, status: "ACTIVE", type: { in: ["INCOME", "EXPENSE"] } }, include: { category: true }, orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }], take: 500 }),
    prisma.planMatch.findMany({ where: { status: "CONFIRMED", plan: { userId: user.id } }, select: { eventId: true, planId: true } }),
  ]);
  const plansActive = plans.filter((plan) => plan.endDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const monthPlans = plans.filter((plan) => plan.startDate <= monthEnd && plan.endDate >= monthStart);
  function monthPortion(plan: (typeof plans)[number]) {
    const planStart = new Date(plan.startDate.getFullYear(), plan.startDate.getMonth(), plan.startDate.getDate());
    const planEnd = new Date(plan.endDate.getFullYear(), plan.endDate.getMonth(), plan.endDate.getDate());
    const overlapStart = planStart > monthStart ? planStart : monthStart;
    const overlapEnd = planEnd < monthEnd ? planEnd : monthEnd;
    const totalDays = Math.max(1, Math.floor((planEnd.getTime() - planStart.getTime()) / 86400000) + 1);
    const overlapDays = Math.max(0, Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1);
    return num(plan.amount) * overlapDays / totalDays;
  }
  const plannedIncome = monthPlans.filter((plan) => plan.kind === "INCOME").reduce((sum, plan) => sum + monthPortion(plan), 0);
  const plannedExpense = monthPlans.filter((plan) => plan.kind === "EXPENSE").reduce((sum, plan) => sum + monthPortion(plan), 0);

  function candidatesFor(plan: (typeof plans)[number]) {
    const matchesByEvent = new Map(plan.matches.map((match) => [match.eventId, match]));
    return allEvents.filter((event) => {
      if (event.type !== plan.kind || event.categoryId !== plan.categoryId) return false;
      if (event.occurredAt < plan.startDate || event.occurredAt > plan.endDate) return false;
      const existingMatch = matchesByEvent.get(event.id);
      if (existingMatch && existingMatch.status !== "SUGGESTED") return false;
      if (confirmedElsewhere.some((match) => match.eventId === event.id && match.planId !== plan.id)) return false;
      return true;
    }).sort((a, b) => {
      // Amount closeness is a ranking clue, not a hard exclusion: a plan can match multiple smaller transactions.
      const aDistance = Math.abs(num(a.amount) - num(plan.amount));
      const bDistance = Math.abs(num(b.amount) - num(plan.amount));
      return aDistance - bDistance || b.occurredAt.getTime() - a.occurredAt.getTime();
    }).slice(0, 8);
  }

  return <main className="page-content">
    <section className="page-title-row"><div><p className="eyebrow">EXPECTATIONS · 04</p><h1>Planning</h1><p className="muted">Plan expected income and expenses for a date or date range, then review suggested matches to real transactions. Plans never change account balances.</p></div><div className="summary-chip"><span>Plans still in progress</span><strong>{plansActive.length}</strong><small>{plans.length} total plans</small></div></section>
    {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}{params?.notice && <div className="alert alert-success" role="status">{params.notice}</div>}

    <section className="metric-grid report-metrics">
      <article className="metric-card"><span className="metric-label">Planned income this month</span><strong className="positive-text">{money(plannedIncome)}</strong><span className="metric-foot">Estimated share for this month</span></article>
      <article className="metric-card"><span className="metric-label">Planned expenses this month</span><strong className="negative-text">{money(plannedExpense)}</strong><span className="metric-foot">Estimated share for this month</span></article>
      <article className="metric-card"><span className="metric-label">Expected net</span><strong className={plannedIncome - plannedExpense >= 0 ? "positive-text" : "negative-text"}>{money(plannedIncome - plannedExpense)}</strong><span className="metric-foot">Planned income minus planned expenses</span></article>
    </section>

    <section className="two-column-layout planning-layout">
      <aside className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">NEW PLAN</p><h2>What do you expect?</h2></div></div>
        {categories.length ? <form action={createPlan} className="form-stack">
          <PlanTypeCategoryFields categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind }))} />
          <label>Plan name or purpose<input name="name" minLength={2} maxLength={100} placeholder="e.g. Monthly groceries" required /></label>
          <label>Priority<select name="priority" defaultValue="NORMAL" required><option value="CRITICAL">Critical — must address first</option><option value="HIGH">High — important</option><option value="NORMAL">Normal — standard priority</option><option value="LOW">Low — can wait</option></select><span className="field-hint">Priority helps you decide what to focus on; it does not automatically move money or change your plans.</span></label>
          <label>Expected total amount (ETB)<input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
          <div className="form-grid"><label>Start date<input name="startDate" type="date" defaultValue={dateInput(monthStart)} required /></label><label>End date<input name="endDate" type="date" defaultValue={dateInput(monthEnd)} required /></label></div>
          <label>Notes <span className="optional">optional</span><textarea name="note" rows={2} placeholder="Anything important about this plan" /></label>
          <button className="button button-primary" type="submit">Create plan</button>
          <p className="field-hint">The expected amount is a total for the full date range. You can match several smaller transactions to one plan.</p>
        </form> : <div className="empty-state"><h3>Create a category first</h3><p>Planning needs an income or expense category to suggest matches.</p><Link className="button button-secondary" href="/categories">Manage categories</Link></div>}
      </aside>

      <section className="planning-list-column"><div className="panel-heading planning-list-heading"><div><p className="eyebrow">YOUR PLANS</p><h2>Plan and actual activity</h2></div><span className="small-count">{plans.length} plans</span></div>
        {plans.length ? plans.map((plan) => {
          const confirmed = plan.matches.filter((match) => match.status === "CONFIRMED" && match.event.status === "ACTIVE");
          const matchedAmount = confirmed.reduce((sum, match) => sum + num(match.event.amount), 0);
          const variance = plan.kind === "EXPENSE" ? matchedAmount - num(plan.amount) : num(plan.amount) - matchedAmount;
          const candidates = candidatesFor(plan);
          const matchingRecords = plan.matches.filter((match) => match.status === "CONFIRMED");
          return <article className="panel plan-card" key={plan.id}>
            <div className="plan-card-top"><div><div className="plan-pill-row"><span className={`plan-kind-pill ${plan.kind === "INCOME" ? "plan-income" : "plan-expense"}`}>{plan.kind === "INCOME" ? "Planned income" : "Planned expense"}</span><span className={`plan-priority-pill priority-${plan.priority.toLowerCase()}`}>{plan.priority === "CRITICAL" ? "Critical priority" : plan.priority === "HIGH" ? "High priority" : plan.priority === "LOW" ? "Low priority" : "Normal priority"}</span></div><h3>{plan.name}</h3><p className="muted plan-meta">{plan.category.name} · {dateLabel(plan.startDate)} – {dateLabel(plan.endDate)}</p></div><strong className="plan-expected">{money(num(plan.amount))}</strong></div>
            {plan.note && <p className="plan-note">{plan.note}</p>}
            <div className="plan-progress-grid"><div><span>Confirmed actual</span><strong>{money(matchedAmount)}</strong></div><div><span>{plan.kind === "EXPENSE" ? "Compared with plan" : "Expected amount remaining"}</span>{confirmed.length ? <strong className={variance > 0 ? (plan.kind === "EXPENSE" ? "negative-text" : "positive-text") : ""}>{money(Math.abs(variance))}{variance > 0 ? (plan.kind === "EXPENSE" ? " over" : " remaining") : variance < 0 ? (plan.kind === "EXPENSE" ? " under" : " above") : " on plan"}</strong> : <strong className="muted">No matched actual yet</strong>}</div></div>
            <details className="plan-edit-details"><summary>Edit plan</summary><form action={updatePlan} className="form-stack plan-edit-form"><input type="hidden" name="planId" value={plan.id} /><PlanTypeCategoryFields categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind }))} initialKind={plan.kind} initialCategoryId={plan.categoryId} /><label>Name<input name="name" defaultValue={plan.name} minLength={2} maxLength={100} required /></label><label>Priority<select name="priority" defaultValue={plan.priority} required><option value="CRITICAL">Critical — must address first</option><option value="HIGH">High — important</option><option value="NORMAL">Normal — standard priority</option><option value="LOW">Low — can wait</option></select></label><label>Expected total amount (ETB)<input name="amount" type="number" min="0.01" step="0.01" defaultValue={num(plan.amount)} required /></label><div className="form-grid"><label>Start date<input name="startDate" type="date" defaultValue={dateInput(plan.startDate)} required /></label><label>End date<input name="endDate" type="date" defaultValue={dateInput(plan.endDate)} required /></label></div><label>Notes<textarea name="note" rows={2} defaultValue={plan.note ?? ""} /></label><button className="button button-secondary" type="submit">Save plan changes</button></form></details>
            <div className="plan-matches"><div className="plan-section-title"><h4>Confirmed matches</h4><span>{matchingRecords.length}</span></div>
              {matchingRecords.length ? <div className="plan-match-list">{plan.matches.filter((match) => match.status === "CONFIRMED").map((match) => <div className={`plan-match-row ${match.event.status === "REVERSED" ? "plan-match-reversed" : ""}`} key={match.id}><div className="grow"><strong>{match.event.reason ?? match.event.type}</strong><small>{dateLabel(match.event.occurredAt)} · {match.event.category?.name ?? "No category"}{match.event.status === "REVERSED" ? " · Reversed; excluded from actual" : ""}</small></div><strong>{money(num(match.event.amount))}</strong><form action={setPlanMatch}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="eventId" value={match.eventId} /><input type="hidden" name="status" value="REJECTED" /><button className="button button-quiet button-small" type="submit">Remove</button></form></div>)}</div> : <p className="muted plan-empty-hint">No confirmed transactions yet.</p>}
            </div>
            {plan.matches.some((match) => match.status === "REJECTED") && <div className="plan-matches"><div className="plan-section-title"><h4>Dismissed suggestions</h4><span>{plan.matches.filter((match) => match.status === "REJECTED").length}</span></div><div className="plan-match-list">{plan.matches.filter((match) => match.status === "REJECTED").map((match) => <div className="plan-match-row" key={match.id}><div className="grow"><strong>{match.event.reason ?? match.event.type}</strong><small>{dateLabel(match.event.occurredAt)} · {money(num(match.event.amount))}</small></div><form action={setPlanMatch}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="eventId" value={match.eventId} /><input type="hidden" name="status" value="SUGGESTED" /><button className="button button-quiet button-small" type="submit">Reconsider</button></form></div>)}</div></div>}
            <div className="plan-matches"><div className="plan-section-title"><h4>Suggested transactions</h4><span>{candidates.length}</span></div><p className="field-hint">Suggestions use the same category and type within this plan&apos;s dates. Amount closeness ranks suggestions but doesn&apos;t automatically match anything.</p>
              {candidates.length ? <div className="plan-match-list">{candidates.map((event) => <div className="plan-match-row" key={event.id}><div className="grow"><strong>{event.reason ?? event.type}</strong><small>{dateLabel(event.occurredAt)} · {event.category?.name ?? "No category"} · Amount {money(num(event.amount))}</small></div><div className="plan-match-actions"><form action={setPlanMatch}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="status" value="CONFIRMED" /><button className="button button-primary button-small" type="submit">Confirm</button></form><form action={setPlanMatch}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="status" value="REJECTED" /><button className="button button-quiet button-small" type="submit">Not a match</button></form></div></div>)}</div> : <p className="muted plan-empty-hint">No new suggestions. Record transactions in this category and date range, or adjust the plan.</p>}
            </div>
          </article>;
        }) : <div className="panel empty-state"><h3>No plans yet</h3><p>Create a plan to begin comparing expectations with actual transactions.</p></div>}
      </section>
    </section>
    <p className="disclaimer">Planning is separate from recorded financial movements. Confirming a match only links a transaction to a plan; it never creates or edits a transaction. Reversed transactions remain visible in history but are excluded from confirmed actual totals.</p>
  </main>;
}
