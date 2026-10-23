import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAccountBalances } from "@/lib/balance";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(value);
const num = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0);
const knownTypes: Record<string, string> = { BANK: "Bank account", CASH: "Cash", MOBILE_MONEY: "Mobile money", SAVINGS: "Savings account", OTHER: "Other" };
const displayType = (type: string) => knownTypes[type.toUpperCase()] ?? type;

export default async function AccountHistoryPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const user = await getCurrentUser();
  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) notFound();

  const [balances, events] = await Promise.all([
    getAccountBalances(prisma, user.id),
    prisma.financialEvent.findMany({
      where: { userId: user.id, effects: { some: { accountId } } },
      include: { category: true, effects: { where: { accountId }, include: { account: true } } },
      orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
    }),
  ]);
  const balance = num(balances.get(account.id));
  const reversedCount = events.filter((event) => event.status === "REVERSED").length;

  return <main className="page-content">
    <section className="page-title-row"><div><p className="eyebrow">ACCOUNT RECORDS</p><h1>{account.name} history</h1><p className="muted">A timeline of financial events linked to this account, including reversed records.</p><Link href="/accounts" className="text-link">← Back to accounts</Link></div><div className="summary-chip"><span>Current calculated balance</span><strong>{money(balance)}</strong><small>{displayType(account.type)}{account.archivedAt ? " · Archived" : " · Active"}</small></div></section>

    <section className="metric-grid account-history-metrics">
      <article className="metric-card"><span className="metric-label">Events in history</span><strong>{events.length}</strong><span className="metric-foot">Includes reversed records</span></article>
      <article className="metric-card"><span className="metric-label">Reversed records</span><strong>{reversedCount}</strong><span className="metric-foot">Preserved for history, excluded from current balance</span></article>
    </section>

    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">CHRONOLOGICAL RECORD</p><h2>Account activity</h2></div><span className="small-count">{events.length} events</span></div>
      {events.length ? <div className="event-history">{events.map((event) => {
        const effect = event.effects.reduce((sum, item) => sum + num(item.amount), 0);
        const active = event.status === "ACTIVE";
        return <article className={`event-card ${!active ? "event-reversed" : ""}`} key={event.id}>
          <div className="event-main"><div className={`event-type-icon event-${event.type.toLowerCase()}`}>{event.type === "INCOME" ? "+" : event.type === "EXPENSE" ? "−" : event.type === "TRANSFER" ? "⇄" : "◷"}</div><div className="grow"><div className="event-title-line"><h3>{event.reason || event.type.replaceAll("_", " ")}</h3><span className={`status-label ${active ? "status-active" : "status-reversed"}`}>{active ? "Affects current balance" : "Reversed · no current effect"}</span></div><p className="event-meta">{event.occurredAt.toLocaleDateString()} · {event.type.replaceAll("_", " ")}{event.category ? ` · ${event.category.name}` : ""}</p>{event.note && <p className="event-note">{event.note}</p>}{!active && event.reverseNote && <p className="reversal-note">{event.reverseNote}</p>}</div><strong className={`event-total ${effect >= 0 ? "positive-text" : "negative-text"}`}>{effect > 0 ? "+" : ""}{money(effect)}</strong></div>
          <div className="event-bottom"><span className="field-hint">{active ? "This effect is included in the account's current calculated balance." : "This original effect is preserved for history but excluded from the current calculated balance."}</span><Link href="/transactions" className="text-link">View transactions ↗</Link></div>
        </article>;
      })}</div> : <div className="empty-state"><h3>No account history yet</h3><p>Opening balances and transactions affecting this account will appear here.</p><Link href="/transactions" className="button button-secondary">Record a transaction</Link></div>}
    </section>
    <p className="disclaimer">The event list preserves recorded history; it is not a reconstructed daily balance statement. Reversed events are shown for auditability but do not contribute to the current calculated balance.</p>
  </main>;
}
