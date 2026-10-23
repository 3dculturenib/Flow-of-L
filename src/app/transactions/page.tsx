import Link from "next/link";
import { TransactionForm } from "@/components/transaction-form";
import { reverseTransaction } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(value);
const num = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0);

export default async function TransactionsPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const [accounts, categories, events] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.category.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.financialEvent.findMany({ where: { userId: user.id }, include: { category: true, effects: { include: { account: true } }, tags: { include: { tag: true } } }, orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }], take: 100 }),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return <main className="page-content">
    <section className="page-title-row"><div><p className="eyebrow">FINANCIAL FOUNDATION · 02</p><h1>Transactions</h1><p className="muted">Record income, expenses, and transfers. One event can affect multiple accounts without splitting the event itself.</p></div><div className="summary-chip"><span>History shown</span><strong>{events.length} records</strong></div></section>
    {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}{params?.notice && <div className="alert alert-success" role="status">{params.notice}</div>}
    <section className="panel transaction-entry-panel"><div className="panel-heading"><div><p className="eyebrow">NEW RECORD</p><h2>Record a financial event</h2></div><span className="quiet-badge">Manual entry</span></div>
      {accounts.length === 0 ? <div className="empty-state"><h3>Create an account first</h3><p>Transactions need at least one active account.</p><Link className="button button-primary" href="/accounts">Go to accounts</Link></div> : <TransactionForm accounts={accounts.map((account) => ({ id: account.id, name: account.name, type: account.type }))} categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind, parentId: category.parentId }))} today={today} />}
      {accounts.length > 0 && categories.length === 0 && <p className="field-hint error-text">Create income and expense categories on the Categories page before recording those event types.</p>}
    </section>
    <section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">RECORD HISTORY</p><h2>Transactions and corrections</h2></div><span className="small-count">Latest 100</span></div>
      {events.length ? <div className="event-history">{events.map((event) => <article className={`event-card ${event.status === "REVERSED" ? "event-reversed" : ""}`} key={event.id}>
        <div className="event-main"><div className={`event-type-icon event-${event.type.toLowerCase()}`}>{event.type === "INCOME" ? "+" : event.type === "EXPENSE" ? "−" : event.type === "TRANSFER" ? "⇄" : "◷"}</div><div className="grow"><div className="event-title-line"><h3>{event.reason || event.type.replaceAll("_", " ")}</h3><span className={`status-label ${event.status === "ACTIVE" ? "status-active" : "status-reversed"}`}>{event.status === "ACTIVE" ? "Active" : "Reversed"}</span></div><p className="event-meta">{event.occurredAt.toLocaleDateString()} · {event.type.replaceAll("_", " ")}{event.category ? ` · ${event.category.name}` : ""}{event.type === "EXPENSE" && event.isPlanned !== null ? ` · ${event.isPlanned ? "Planned" : "Unplanned"}` : ""}</p>{event.note && <p className="event-note">{event.note}</p>}{event.tags.length > 0 && <div className="tag-list">{event.tags.map(({ tag }) => <span key={tag.id}>{tag.name}</span>)}</div>}</div><strong className="event-total">{money(num(event.amount))}</strong></div>
        <div className="event-bottom"><div className="effect-chips">{event.effects.map((effect) => <span key={effect.id}>{effect.account.name} <strong className={num(effect.amount) >= 0 ? "positive-text" : "negative-text"}>{num(effect.amount) > 0 ? "+" : ""}{money(num(effect.amount))}</strong></span>)}</div>{event.status === "ACTIVE" && event.type !== "OPENING_BALANCE" && <form action={reverseTransaction} className="reverse-form"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="reverseNote" value="Reversed by user for correction" /><button className="button button-danger-quiet" type="submit">Reverse for correction</button></form>}{event.status === "REVERSED" && <p className="reversal-note">{event.reverseNote || "This event has been reversed. It no longer affects balances."}</p>}</div>
      </article>)}</div> : <div className="empty-state"><h3>No transactions yet</h3><p>Record an income, expense, or transfer to start building your history.</p></div>}
      {events.length === 100 && <p className="field-hint">Showing the latest 100 records.</p>}
    </section>
    <p className="disclaimer">To correct a saved transaction, reverse it and record the corrected event. Reversals preserve the original record and create a revision; reversed events no longer affect calculated balances.</p>
  </main>;
}
