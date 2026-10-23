import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAccountBalances } from "@/lib/balance";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(value);
const num = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0);
const knownAccountTypes: Record<string, string> = { BANK: "Bank account", CASH: "Cash", MOBILE_MONEY: "Mobile money", SAVINGS: "Savings account", OTHER: "Other" };
const displayType = (type: string) => knownAccountTypes[type.toUpperCase()] ?? type;
const accountIcon = (type: string) => type.toLowerCase().includes("cash") ? "◉" : type.toLowerCase().includes("saving") ? "↗" : type.toLowerCase().includes("mobile") ? "▣" : "⌂";

export default async function Home() {
  const user = await getCurrentUser();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [accounts, balances, monthEvents, recentEvents] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    getAccountBalances(prisma, user.id),
    prisma.financialEvent.findMany({ where: { userId: user.id, status: "ACTIVE", occurredAt: { gte: monthStart, lte: now }, type: { in: ["INCOME", "EXPENSE"] } }, select: { type: true, amount: true } }),
    prisma.financialEvent.findMany({ where: { userId: user.id }, include: { category: true, effects: { include: { account: true } }, tags: { include: { tag: true } } }, orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }], take: 7 }),
  ]);
  const accountTotal = accounts.reduce((sum, account) => sum + num(balances.get(account.id)), 0);
  const income = monthEvents.filter((event) => event.type === "INCOME").reduce((sum, event) => sum + num(event.amount), 0);
  const expenses = monthEvents.filter((event) => event.type === "EXPENSE").reduce((sum, event) => sum + num(event.amount), 0);
  const monthName = now.toLocaleDateString("en", { month: "long", year: "numeric" });
  const elapsedDays = now.getDate();
  const averageDailyExpense = expenses / Math.max(1, elapsedDays);
  const monthExpenseCategoryRows = await prisma.financialEvent.groupBy({
    by: ["categoryId"],
    where: { userId: user.id, status: "ACTIVE", type: "EXPENSE", categoryId: { not: null }, occurredAt: { gte: monthStart, lte: now } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 1,
  });
  const topCategoryId = monthExpenseCategoryRows[0]?.categoryId;
  const topCategory = topCategoryId ? await prisma.category.findFirst({ where: { id: topCategoryId, userId: user.id }, select: { name: true } }) : null;


  return <main className="page-content">
    <section className="welcome-row"><div><p className="eyebrow">YOUR FINANCIAL PICTURE</p><h1>Good to see you.</h1><p className="muted">A clear view of your money, based on the records you have entered.</p></div><Link className="button button-primary" href="/transactions">+ Add transaction</Link></section>
    <section className="metric-grid" aria-label="Financial summary">
      <article className="metric-card metric-primary"><span className="metric-label">Total across active accounts</span><strong>{money(accountTotal)}</strong><span className="metric-foot">Calculated balance · {accounts.length} active account{accounts.length === 1 ? "" : "s"}</span></article>
      <article className="metric-card"><span className="metric-label">Income this month</span><strong className="positive-text">{money(income)}</strong><span className="metric-foot">{monthName}</span></article>
      <article className="metric-card"><span className="metric-label">Expenses this month</span><strong className="negative-text">{money(expenses)}</strong><span className="metric-foot">{monthName}</span></article>
      <article className="metric-card"><span className="metric-label">Net cash flow this month</span><strong className={income - expenses >= 0 ? "positive-text" : "negative-text"}>{money(income - expenses)}</strong><span className="metric-foot">Income minus expenses</span></article>
      <article className="metric-card"><span className="metric-label">Average daily spending</span><strong>{money(averageDailyExpense)}</strong><span className="metric-foot">Month-to-date expenses ÷ {elapsedDays} calendar day{elapsedDays === 1 ? "" : "s"}</span></article>
      <article className="metric-card"><span className="metric-label">Top expense category</span><strong className="metric-category-value">{topCategory?.name ?? "—"}</strong><span className="metric-foot">{topCategory ? "Highest recorded expense total this month" : "Record categorized expenses to see a pattern"}</span></article>
    </section>

    <section className="content-grid">
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNTS</p><h2>Where your money is</h2></div><Link href="/accounts" className="text-link">Manage accounts ↗</Link></div>
        {accounts.length ? <div className="account-list">{accounts.map((account) => <div className="account-list-row" key={account.id}><div className="account-icon">{accountIcon(account.type)}</div><div className="grow"><strong>{account.name}</strong><small>{displayType(account.type)}{account.isDefault ? " · Default" : ""}</small></div><strong className="amount">{money(num(balances.get(account.id)))}</strong></div>)}</div> : <div className="empty-state"><h3>No accounts yet</h3><p>Create your first account and enter its current balance.</p><Link className="button button-secondary" href="/accounts">Set up an account</Link></div>}
      </div>
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">MONTHLY SIGNAL</p><h2>A simple check-in</h2></div><span className="status-dot" /></div>
        {monthEvents.length === 0 ? <p className="muted">Once you record income and expenses, this section will show your current cash-flow direction.</p> : <><p className="insight-lead">{income >= expenses ? "Your recorded income currently covers your recorded expenses." : "Your recorded expenses are higher than your recorded income this month."}</p><p className="muted">This is a calculation from recorded transactions, not a forecast. Missing or late entries can change the result.</p><div className="mini-bar"><span style={{ width: `${income + expenses === 0 ? 0 : Math.min(100, income / (income + expenses) * 100)}%` }} /></div><div className="bar-legend"><span>Income {money(income)}</span><span>Expenses {money(expenses)}</span></div></>}
        <Link className="text-link bottom-link" href="/transactions">Review activity ↗</Link>
      </div>
    </section>

    <section className="quick-links-grid">
      <Link href="/reports" className="quick-link-card"><span className="quick-link-icon">▤</span><span><strong>Reports & analysis</strong><small>Filter transactions and compare categories, types, and time periods.</small></span><span className="quick-link-arrow">↗</span></Link>
      <Link href="/accounts" className="quick-link-card"><span className="quick-link-icon">◷</span><span><strong>Account history</strong><small>Open any account to review its historical financial events.</small></span><span className="quick-link-arrow">↗</span></Link>
    </section>

    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Your latest records</h2></div><Link className="text-link" href="/transactions">All transactions ↗</Link></div>
      {recentEvents.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account effect</th><th>Status</th></tr></thead><tbody>{recentEvents.map((event) => <tr key={event.id}><td>{event.occurredAt.toLocaleDateString()}</td><td><strong>{event.reason || event.type.replaceAll("_", " ")}</strong><small>{event.type.replaceAll("_", " ")}</small></td><td>{event.category?.name ?? "—"}</td><td><div className="effect-list">{event.effects.map((effect) => <span key={effect.id}>{effect.account.name}: {effect.amount.greaterThan(0) ? "+" : ""}{money(num(effect.amount))}</span>)}</div></td><td><span className={`status-label ${event.status === "ACTIVE" ? "status-active" : "status-reversed"}`}>{event.status === "ACTIVE" ? "Active" : "Reversed"}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><p>No activity recorded yet.</p><Link className="button button-secondary" href="/transactions">Record your first transaction</Link></div>}
    </section>
    <p className="disclaimer">The dashboard reports recorded facts. Insights are descriptive only; planning, savings projections, and debt analysis will be added in later MVP stages.</p>
  </main>;
}
