import { redirect } from "next/navigation";
import { getOptionalCurrentUser } from "@/lib/current-user";
import { completeInitialSetup } from "@/app/auth-actions";

export const dynamic = "force-dynamic";
const accountTypes = ["Bank account", "Cash", "Mobile money", "Savings account", "Investment", "Wallet", "Other"];

export default async function SetupPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getOptionalCurrentUser();
  if (!user || !user.email || !user.passwordHash) redirect("/login");
  if (user.setupComplete) redirect("/");
  const params = await searchParams;
  return <main className="page-content auth-page"><section className="auth-card panel">
    <p className="eyebrow">ONE-TIME SETUP</p><h1>Set up your finances</h1><p className="muted">Just the essentials. You can change account details later. Your V1 currency is ETB.</p>
    {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}
    <form action={completeInitialSetup} className="form-stack">
      <label>Your name<input value={user.name} readOnly /></label>
      <label>First account name<input name="accountName" placeholder="e.g. Main bank account" minLength={2} maxLength={80} required /></label>
      <label>Account type<select name="accountType" defaultValue="Bank account" required>{accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      <label>Current balance (ETB) <span className="optional">optional</span><input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" /></label>
      <span className="field-hint">Enter the balance you have now, if you know it. This is an opening balance, not income. You can correct it later.</span>
      <button className="button button-primary" type="submit">Finish setup</button>
    </form>
  </section></main>;
}
