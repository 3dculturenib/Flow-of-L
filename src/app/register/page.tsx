import Link from "next/link";
import { redirect } from "next/navigation";
import { register } from "@/app/auth-actions";
import { getOptionalCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const user = await getOptionalCurrentUser();
  if (user?.email && user.passwordHash) redirect("/");
  const params = await searchParams;
  return <main className="page-content auth-page">
    <section className="auth-card panel">
      <p className="eyebrow">YOUR FINANCIAL WORKSPACE</p><h1>Create your account</h1><p className="muted">Your financial records will be private to your account.</p>
      {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}
      <form action={register} className="form-stack">
        <label>Your name<input type="text" name="name" autoComplete="name" minLength={2} maxLength={80} required /></label>
        <label>Email address<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength={10} maxLength={200} required /><span className="field-hint">Use at least 10 characters.</span></label>
        <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" minLength={10} maxLength={200} required /></label>
        <button className="button button-primary" type="submit">Create account</button>
      </form>
      <p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p>
    </section>
  </main>;
}
