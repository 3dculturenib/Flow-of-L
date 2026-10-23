# Personal Finance App — MVP 1

This iteration adds the first usable local MVP workflows to the Next.js + Prisma starter. It is designed for one local user (`seed-user`) and ETB. Authentication, collaborative use, planning, savings-purpose allocation, borrowing/lending, and advanced forecasting are not implemented in this iteration.

## Included functionality

- Dashboard with calculated active-account balances, current-month income/expense/net cash flow, recent events, and a descriptive cash-flow signal.
- Account creation, account types, default-account selection, soft archiving, and opening-balance entry/correction.
- Income, expense, and transfer entry.
- One income or expense event can allocate effects across multiple accounts. Transfer effects must be one source and one destination, and the transfer is neutral to total money.
- Required transaction reason and category for income/expense; optional notes and comma-separated tags.
- Planned/unplanned classification for expenses.
- Hierarchical income/expense categories, category rename/description edits, and soft archiving.
- Reversal-based transaction correction. Reversed events remain in history but no longer affect balances.
- Revision snapshots for opening-balance changes, new events, and reversals.
- Validation of account ownership, active accounts, matching category type, positive amount, and effect-line totals.

## Requirements

- Node.js 20.9+ (recommended for Next.js 15)
- PostgreSQL
- npm

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to your local PostgreSQL database. Example:

   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/finance_app?schema=public"
   ```

3. Install dependencies and generate Prisma Client:

   ```bash
   npm install
   npm run db:generate
   ```

4. Apply the current prototype schema and create sample data:

   ```bash
   npm run db:migrate -- --name mvp1_foundation
   npm run db:seed
   ```

5. Start Next.js:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

The seed is safe to rerun for the existing demo records. It ensures a `Me` user, three accounts (Main account: 25,000 ETB; Savings account: 40,000 ETB; Cash: 1,500 ETB), and starter categories. If those sample accounts are not wanted, do not run the seed; the application creates the local user on first visit and you can create accounts/categories manually.

## Important model and data notes

- The schema remains a prototype pending the full conceptual-model and historical-source checkpoint. Do not use it as a production system or for irreplaceable financial records yet.
- Before a database migration is treated as final, review the complete model and confirm the remaining relationship and source-reconciliation work.
- The app currently has no authentication. It is a local single-user prototype; do not expose it to the internet or use it as a multi-user deployment.
- Balances are calculated from account effects on ACTIVE events. They are not stored directly.
- Opening balances are not income. Borrowed principal, lending, repayments, savings-purpose allocation, and obligation/receivable relationships are not yet implemented.
- To correct a normal transaction in this version, reverse it and record the corrected event. The original record remains in history.
- An expense/income event may affect multiple accounts. All effect lines must add up exactly to the event total. For expenses, the account effects are negative; for income, positive.
- A transfer requires one negative source effect and one positive destination effect with equal magnitude. Transfers do not change total money across owned accounts.
- Negative account balances are warnings, not automatic blocks, in line with the current project rule.

## Useful commands

```bash
npm run dev
npm run build
npm run lint
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```


## Latest MVP improvements

See [MVP_IMPROVEMENTS.md](./MVP_IMPROVEMENTS.md) for the dashboard analytics, account-history timeline, and transaction-report filters added in the latest source update. These additions do not change the Prisma schema and do not require a migration.
