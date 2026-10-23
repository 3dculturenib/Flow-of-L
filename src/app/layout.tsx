import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Finance App",
  description: "A clear, reliable personal finance workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <div className="app-frame">
      <header className="app-header">
        <Link className="brand" href="/"><span className="brand-mark">F</span><span><strong>Flow of L</strong><small>Personal finance</small></span></Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/">Overview</Link><Link href="/accounts">Accounts</Link><Link href="/transactions">Transactions</Link><Link href="/reports">Reports</Link><Link href="/categories">Categories</Link>
        </nav>
        <span className="currency-pill">ETB · Local MVP</span>
      </header>
      {children}
      <footer className="app-footer"><span>Personal Finance App</span><span>Calculated balances · History preserved</span></footer>
    </div>
  </body></html>;
}
