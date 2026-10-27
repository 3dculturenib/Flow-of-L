import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { logout } from "@/app/auth-actions";
import { getOptionalCurrentUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "Personal Finance App",
  description: "A clear, reliable personal finance workspace.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getOptionalCurrentUser();
  const authenticated = Boolean(user?.email && user.passwordHash);
  return <html lang="en"><body>
    <div className="app-frame">
      <header className="app-header">
        <Link className="brand" href="/"><span className="brand-mark">F</span><span><strong>Flow of L</strong><small>Personal finance</small></span></Link>
        {authenticated ? <>
          <nav className="main-nav" aria-label="Main navigation">
            <Link href="/">Overview</Link><Link href="/accounts">Accounts</Link><Link href="/transactions">Transactions</Link><Link href="/reports">Reports</Link><Link href="/categories">Categories</Link>
          </nav>
          <div className="header-user"><span className="currency-pill">{user?.name}</span><form action={logout}><button className="button button-quiet sign-out-button" type="submit">Sign out</button></form></div>
        </> : <nav className="main-nav auth-nav" aria-label="Account navigation"><Link href="/login">Sign in</Link><Link href="/register">Create account</Link></nav>}
      </header>
      {children}
      <footer className="app-footer"><span>Personal Finance App</span><span>Calculated balances · History preserved</span></footer>
    </div>
  </body></html>;
}
