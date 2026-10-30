import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { ReportFilters } from "@/components/report-filters";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(value);
const num = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0);
const validDate = (value: string | undefined, fallback: Date) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};
const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const niceType = (type: string) => type.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; type?: string; categoryId?: string; tagId?: string; accountId?: string; status?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const now = new Date();
  const startDefault = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = validDate(params.from, startDefault);
  const end = validDate(params.to, now);
  const from = start <= end ? start : validDate(params.to, now);
  const to = start <= end ? end : validDate(params.from, startDefault);
  const endExclusive = new Date(to); endExclusive.setDate(endExclusive.getDate() + 1);
  const selectedType = ["INCOME", "EXPENSE", "TRANSFER", "OPENING_BALANCE"].includes(params.type ?? "") ? params.type! : "";
  const selectedStatus = ["ACTIVE", "REVERSED", "ALL"].includes(params.status ?? "") ? params.status! : "ACTIVE";

  const [accounts, categories, tags] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }] }),
    prisma.category.findMany({ where: { userId: user.id, ...(selectedType === "INCOME" ? { kind: "INCOME" } : selectedType === "EXPENSE" ? { kind: "EXPENSE" } : selectedType ? { id: "__no_categories_for_this_type__" } : {}) }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);
  const events = await prisma.financialEvent.findMany({
    where: {
      userId: user.id,
      occurredAt: { gte: from, lt: endExclusive },
      ...(selectedType ? { type: selectedType as "INCOME" | "EXPENSE" | "TRANSFER" | "OPENING_BALANCE" } : {}),
      ...(selectedStatus === "ALL" ? {} : { status: selectedStatus as "ACTIVE" | "REVERSED" }),
      ...(params.categoryId && categories.some((category) => category.id === params.categoryId) ? { categoryId: params.categoryId } : {}),
      ...(params.accountId ? { effects: { some: { accountId: params.accountId } } } : {}),
      ...(params.tagId && tags.some((tag) => tag.id === params.tagId) ? { tags: { some: { tagId: params.tagId } } } : {}),
    },
    include: { category: true, effects: { include: { account: true } }, tags: { include: { tag: true } } },
    orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
  });

  // Financial totals exclude reversed events, even when the history filter is set to "All".
  const effectiveEvents = events.filter((event) => event.status === "ACTIVE");
  const totalIncome = effectiveEvents.filter((event) => event.type === "INCOME").reduce((sum, event) => sum + num(event.amount), 0);
  const totalExpenses = effectiveEvents.filter((event) => event.type === "EXPENSE").reduce((sum, event) => sum + num(event.amount), 0);
  const days = Math.max(1, Math.floor((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000) + 1);
  const dailyExpense = totalExpenses / days;
  const typeTotals = ["INCOME", "EXPENSE", "TRANSFER", "OPENING_BALANCE"].map((type) => ({ type, amount: effectiveEvents.filter((event) => event.type === type).reduce((sum, event) => sum + num(event.amount), 0), count: effectiveEvents.filter((event) => event.type === type).length })).filter((row) => row.count > 0 || !selectedType);
  const categoryMap = new Map<string, { name: string; kind: string; amount: number; count: number }>();
  for (const event of effectiveEvents.filter((item) => item.type === "INCOME" || item.type === "EXPENSE")) {
    const key = `${event.type}:${event.categoryId ?? "uncategorized"}`;
    const current = categoryMap.get(key) ?? { name: event.category?.name ?? "Uncategorized", kind: event.type, amount: 0, count: 0 };
    current.amount += num(event.amount); current.count += 1; categoryMap.set(key, current);
  }
  const categoryRows = [...categoryMap.values()].sort((a, b) => b.amount - a.amount);
  const tagMap = new Map<string, { name: string; income: number; expenses: number; count: number }>();
  for (const event of effectiveEvents) {
    for (const eventTag of event.tags) {
      const row = tagMap.get(eventTag.tagId) ?? { name: eventTag.tag.name, income: 0, expenses: 0, count: 0 };
      if (event.type === "INCOME") row.income += num(event.amount);
      if (event.type === "EXPENSE") row.expenses += num(event.amount);
      row.count += 1;
      tagMap.set(eventTag.tagId, row);
    }
  }
  const tagRows = [...tagMap.entries()].map(([id, row]) => ({ id, ...row, net: row.income - row.expenses })).sort((a, b) => (b.expenses + b.income) - (a.expenses + a.income));

  return <main className="page-content">
    <section className="page-title-row"><div><p className="eyebrow">ANALYSIS · 03</p><h1>Reports</h1><p className="muted">Filter your financial events and analyze income, expenses, categories, accounts, and cross-category tags.</p></div><div className="summary-chip"><span>Matching records</span><strong>{events.length}</strong><small>{from.toLocaleDateString()} – {to.toLocaleDateString()}</small></div></section>

    <section className="panel report-filter-panel"><div className="panel-heading"><div><p className="eyebrow">REPORT PARAMETERS</p><h2>Choose what to analyze</h2></div><Link href="/reports" className="text-link">Reset filters ↺</Link></div>
      <ReportFilters
        from={dateInput(from)}
        to={dateInput(to)}
        type={selectedType}
        categoryId={categories.some((category) => category.id === params.categoryId) ? params.categoryId ?? "" : ""}
        tagId={tags.some((tag) => tag.id === params.tagId) ? params.tagId ?? "" : ""}
        accountId={params.accountId ?? ""}
        status={selectedStatus}
        categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind, archivedAt: category.archivedAt?.toISOString() ?? null }))}
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, archivedAt: account.archivedAt?.toISOString() ?? null }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
      />
    </section>

    <section className="metric-grid report-metrics">
      <article className="metric-card"><span className="metric-label">Recorded income</span><strong className="positive-text">{money(totalIncome)}</strong><span className="metric-foot">Active income in filtered period</span></article>
      <article className="metric-card"><span className="metric-label">Recorded expenses</span><strong className="negative-text">{money(totalExpenses)}</strong><span className="metric-foot">Active expenses in filtered period</span></article>
      <article className="metric-card"><span className="metric-label">Net cash flow</span><strong className={totalIncome - totalExpenses >= 0 ? "positive-text" : "negative-text"}>{money(totalIncome - totalExpenses)}</strong><span className="metric-foot">Income minus expenses; transfers excluded</span></article>
      <article className="metric-card"><span className="metric-label">Average daily spending</span><strong>{money(dailyExpense)}</strong><span className="metric-foot">Expenses ÷ {days} calendar day{days === 1 ? "" : "s"} in selected range</span></article>
    </section>

    <section className="content-grid report-analysis-grid">
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">BY TYPE</p><h2>Transaction type summary</h2></div></div>
        {typeTotals.length ? <div className="report-breakdown-list">{typeTotals.map((row) => <div className="report-breakdown-row" key={row.type}><div className="grow"><strong>{niceType(row.type)}</strong><small>{row.count} active record{row.count === 1 ? "" : "s"}</small></div><strong>{money(row.amount)}</strong></div>)}</div> : <p className="muted">No active events match these filters.</p>}
      </div>
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">BY CATEGORY</p><h2>Category breakdown</h2></div></div>
        {categoryRows.length ? <div className="report-breakdown-list">{categoryRows.map((row) => { const maxForKind = Math.max(1, ...categoryRows.filter((item) => item.kind === row.kind).map((item) => item.amount)); return <div className="report-breakdown-row" key={`${row.kind}:${row.name}`}><div className="grow"><strong>{row.name}</strong><small>{niceType(row.kind)} · {row.count} record{row.count === 1 ? "" : "s"}</small><div className={`report-bar ${row.kind === "INCOME" ? "report-bar-income" : "report-bar-expense"}`}><span style={{ width: `${Math.max(2, row.amount / maxForKind * 100)}%` }} /></div></div><strong className={row.kind === "INCOME" ? "positive-text" : "negative-text"}>{money(row.amount)}</strong></div>; })}</div> : <p className="muted">No categorized income or expenses match these filters.</p>}
      </div>
    </section>

    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">CROSS-CATEGORY ANALYSIS</p><h2>Analysis by tag</h2></div><span className="small-count">{tagRows.length} tags used</span></div>
      {tagRows.length ? <><p className="muted">Tags group records across categories—for example, a Work Trip tag can group transport, meals, and accommodation. A transaction with multiple tags appears in each relevant tag row, so tag totals overlap and should not be added together.</p><div className="table-wrap"><table><thead><tr><th>Tag</th><th>Records</th><th>Income</th><th>Expenses</th><th>Income − expenses</th></tr></thead><tbody>{tagRows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.count}</td><td className="positive-text">{money(row.income)}</td><td className="negative-text">{money(row.expenses)}</td><td className={row.net >= 0 ? "positive-text" : "negative-text"}>{money(row.net)}</td></tr>)}</tbody></table></div></> : <p className="muted">No tags are used in the matching records yet. Add optional tags such as Family, Work Trip, or Home Project when recording transactions to see cross-category analysis here.</p>}
    </section>

    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">MATCHING RECORDS</p><h2>Transaction details</h2></div><span className="small-count">{events.length} records</span></div>
      {events.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type / category</th><th>Account effects</th><th>Amount</th><th>Status</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.occurredAt.toLocaleDateString()}</td><td><strong>{event.reason || niceType(event.type)}</strong><small>{event.note ?? ""}</small>{event.tags.length > 0 && <small>{event.tags.map((item) => item.tag.name).join(", ")}</small>}</td><td>{niceType(event.type)}<small>{event.category?.name ?? "—"}</small></td><td><div className="effect-list">{event.effects.map((effect) => <span key={effect.id}>{effect.account.name}: <strong className={num(effect.amount) >= 0 ? "positive-text" : "negative-text"}>{num(effect.amount) > 0 ? "+" : ""}{money(num(effect.amount))}</strong></span>)}</div></td><td>{money(num(event.amount))}</td><td><span className={`status-label ${event.status === "ACTIVE" ? "status-active" : "status-reversed"}`}>{niceType(event.status)}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><p>No records match these filters.</p><Link href="/transactions" className="button button-secondary">Record a transaction</Link></div>}
    </section>
    <p className="disclaimer">Reports describe entered records, not a forecast. Account transfers move money between your accounts and are excluded from income-minus-expense net cash flow. Reversed records remain visible in history but do not contribute to financial totals.</p>
  </main>;
}
