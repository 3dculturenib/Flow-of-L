import Link from "next/link";
import { archiveAccount, createAccount, restoreAccount, saveOpeningBalance, setDefaultAccount, updateAccount } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAccountBalances } from "@/lib/balance";

export const dynamic = "force-dynamic";

const money = (value: number) => new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(value);
const num = (value: { toString(): string } | null | undefined) => Number(value?.toString() ?? 0);
const knownTypes: Record<string, string> = {
  BANK: "Bank account", CASH: "Cash", MOBILE_MONEY: "Mobile money", SAVINGS: "Savings account", OTHER: "Other",
  "BANK ACCOUNT": "Bank account", "SAVINGS ACCOUNT": "Savings account", "MOBILE MONEY": "Mobile money",
};
const displayType = (type: string) => knownTypes[type.toUpperCase()] ?? type;
const accountIcon = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized.includes("cash")) return "◉";
  if (normalized.includes("saving")) return "↗";
  if (normalized.includes("mobile")) return "▣";
  return "⌂";
};
const typeSuggestions = ["Bank account", "Cash", "Mobile money", "Savings account", "Investment", "Wallet", "Other"];
const normalizedType = (type: string) => typeSuggestions.find((item) => item.toLowerCase() === displayType(type).toLowerCase()) ?? "Other";

export default async function AccountsPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const [accounts, archivedAccounts, balances, openingEvents] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.account.findMany({ where: { userId: user.id, archivedAt: { not: null } }, orderBy: [{ archivedAt: "desc" }, { createdAt: "asc" }] }),
    getAccountBalances(prisma, user.id),
    prisma.financialEvent.findMany({ where: { userId: user.id, type: "OPENING_BALANCE", status: "ACTIVE" }, include: { effects: true } }),
  ]);
  const openingAmounts = new Map<string, string>();
  for (const event of openingEvents) for (const effect of event.effects) openingAmounts.set(effect.accountId, event.amount.toString());
  const total = accounts.reduce((sum, account) => sum + num(balances.get(account.id)), 0);

  return <main className="page-content">
    <section className="page-title-row"><div><p className="eyebrow">FINANCIAL FOUNDATION · 01</p><h1>Accounts</h1><p className="muted">Create the places where you keep money. Choose an account type from the list. Balances are calculated from opening balances and transaction effects.</p></div><div className="summary-chip"><span>Total calculated balance · active accounts</span><strong>{money(total)}</strong></div></section>
    {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}{params?.notice && <div className="alert alert-success" role="status">{params.notice}</div>}
    <section className="two-column-layout">
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">YOUR ACCOUNTS</p><h2>Active accounts <span className="small-count">{accounts.length}</span></h2></div></div>
        {accounts.length ? <div className="account-management-list">{accounts.map((account) => <article className="account-management-card" key={account.id}>
          <div className="account-card-top"><div className="account-icon large-icon">{accountIcon(account.type)}</div><div className="grow"><div className="account-name-line"><h3>{account.name}</h3>{account.isDefault && <span className="status-label status-active">Default</span>}</div><p>{displayType(account.type)}</p>{account.assignment && <p className="account-assignment-summary">Purpose: {account.assignment}</p>}</div><strong className="account-balance">{money(num(balances.get(account.id)))}</strong></div>
          <details className="inline-details"><summary>Edit account details</summary><form action={updateAccount} className="inline-form account-edit-form"><input type="hidden" name="accountId" value={account.id} /><label>Account name<input name="name" defaultValue={account.name} minLength={2} maxLength={80} required /></label><label>Account type<select name="type" defaultValue={normalizedType(account.type)} required>{typeSuggestions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Assignment / purpose<input name="assignment" defaultValue={account.assignment ?? ""} maxLength={200} placeholder="e.g. salary and monthly bills" /></label><button className="button button-secondary" type="submit">Save details</button></form></details>
          <details className="inline-details"><summary>Set or correct opening balance</summary><p className="field-hint">This is the balance when you began tracking this account. It is not income. Changing it creates a history revision.</p><form action={saveOpeningBalance} className="inline-form"><input type="hidden" name="accountId" value={account.id} /><label>Opening balance (ETB)<input type="number" min="0" step="0.01" name="amount" defaultValue={openingAmounts.get(account.id) ?? "0.00"} required /></label><label>As of date<input type="date" name="occurredAt" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><button className="button button-secondary" type="submit">Save balance</button></form></details>
          <div className="account-actions"><Link className="button button-quiet" href={`/accounts/${account.id}/history`}>View history</Link>{!account.isDefault && <form action={setDefaultAccount}><input type="hidden" name="accountId" value={account.id} /><button className="button button-quiet" type="submit">Make default</button></form>}<form action={archiveAccount}><input type="hidden" name="accountId" value={account.id} /><button className="button button-danger-quiet" type="submit">Archive account</button></form></div>
        </article>)}</div> : <div className="empty-state"><h3>No active accounts</h3><p>Create an account to start recording your finances.</p></div>}
      </div>
      <aside className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">ADD ACCOUNT</p><h2>New account</h2></div></div><form action={createAccount} className="form-stack">
        <label>Account name<input name="name" placeholder="e.g. Commercial Bank salary" minLength={2} maxLength={80} required /></label>
        <label>Account type<select name="type" defaultValue="Bank account" required>{typeSuggestions.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Assignment / purpose <span className="field-hint">Optional · what you mainly use this account for</span><input name="assignment" maxLength={200} placeholder="e.g. salary, rent, and bills" /></label>
        <label className="checkbox-label"><input type="checkbox" name="isDefault" /> Set as default account</label>
        <p className="field-hint">Choose one of the available account types. Bank account is the default. Your first account automatically becomes the default account.</p>
        <button className="button button-primary" type="submit">Create account</button>
      </form></aside>
    </section>

    <section className="panel archived-accounts-panel"><div className="panel-heading"><div><p className="eyebrow">PRESERVED HISTORY</p><h2>Archived accounts <span className="small-count">{archivedAccounts.length}</span></h2></div></div>
      {archivedAccounts.length ? <div className="account-management-list">{archivedAccounts.map((account) => <article className="account-management-card archived-account-card" key={account.id}>
        <div className="account-card-top"><div className="account-icon large-icon">{accountIcon(account.type)}</div><div className="grow"><h3>{account.name}</h3><p>{displayType(account.type)}{account.assignment ? ` · Purpose: ${account.assignment}` : ""} · Archived {account.archivedAt?.toLocaleDateString()}</p></div><strong className="account-balance">{money(num(balances.get(account.id)))}</strong></div>
        <p className="field-hint">This account is excluded from the active-account total and cannot be used for new transactions until restored. Its history and calculated balance are preserved.</p>
        <div className="account-actions"><Link className="button button-quiet" href={`/accounts/${account.id}/history`}>View history</Link><form action={restoreAccount}><input type="hidden" name="accountId" value={account.id} /><button className="button button-secondary" type="submit">Restore account</button></form></div>
      </article>)}</div> : <div className="empty-state"><p>No archived accounts. When you archive an account, it will appear here.</p></div>}
    </section>
    <p className="field-hint">Account safety: archiving preserves history; balances are never manually overwritten. If a transaction reversal changes an archived account&apos;s balance, the app automatically restores that account so the resulting balance remains visible.</p>
  </main>;
}
