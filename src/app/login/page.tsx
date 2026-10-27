import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/auth-actions";
import { getOptionalCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const user = await getOptionalCurrentUser();
  if (user?.email && user.passwordHash) redirect("/");
  const params = await searchParams;
  return <main className="page-content auth-page">
    <section className="auth-card panel">
      <p className="eyebrow">WELCOME BACK</p><h1>Sign in</h1><p className="muted">Sign in to access your personal financial records.</p>
      {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}{params?.notice && <div className="alert alert-success" role="status">{params.notice}</div>}
      <form action={login} className="form-stack">
        <label>Email address<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        <button className="button button-primary" type="submit">Sign in</button>
      </form>
      <p className="auth-switch">New here? <Link href="/register">Create an account</Link></p>
    </section>
  </main>;
}
