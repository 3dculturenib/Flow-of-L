# Personal Finance App — MVP 1

This iteration adds login/registration and account-specific data ownership to the existing Next.js + Prisma MVP. It remains a prototype: authentication is implemented for local testing, but a full security/deployment review is required before exposing it publicly. Currency defaults to ETB.

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

4. Apply the current prototype schema and optionally create sample data:

   ```bash
   npm run db:migrate -- --name mvp1_foundation
   npm run db:seed
   ```

5. Add an authentication secret to `.env`. Generate a random secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Set the result as `AUTH_SECRET="..."` in `.env`.

6. Start Next.js and open `http://localhost:3000`, then create your account and sign in:

   ```bash
   npm run dev
   ```

The seed creates sample data for testing. If you want to keep existing financial records created by the old local MVP, do not delete or reset the database. The first registration claims the old `seed-user` record when it exists, preserving that record’s accounts, categories, and transactions. Avoid running the seed unless you intentionally want demo records.

## Important model and data notes

- The schema remains a prototype pending the full conceptual-model and historical-source checkpoint. Do not use it as a production system or for irreplaceable financial records yet.
- Before a database migration is treated as final, review the complete model and confirm the remaining relationship and source-reconciliation work.
- Authentication now uses a signed, HTTP-only, SameSite cookie with a 14-day expiry and scrypt password hashing. This is an MVP implementation, not a substitute for a production security review, rate limiting, email verification, password reset, or deployment hardening.
- **Important first-registration behavior:** if the old `seed-user` record exists, the first successful registration claims it to preserve existing financial data. This is suitable only while the app remains private/local. Before public deployment, replace this bootstrap behavior with an explicit owner migration/claim step so an unknown visitor cannot claim legacy data.
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

- Login, registration, sign out, per-user data ownership, signed sessions, and password hashing.
- Optional account assignment/purpose field, editable later from the account page.
- Report category options narrow to income categories when Income is selected and expense categories when Expense is selected; with no type selected, all categories are available.
- See [MVP_IMPROVEMENTS.md](./MVP_IMPROVEMENTS.md) for dashboard analytics, account history, and reports.

### Updating an existing database

The Prisma schema has new nullable `User.email`, `User.passwordHash`, and `Account.assignment` fields. Back up the database first, then apply the schema to your existing prototype database and regenerate Prisma Client:

```bash
npx prisma db push
npm run db:generate
```

This prototype uses `db push` for this incremental schema update because the delivered source ZIP has no checked-in migration history. Do not reset the database; the added fields are nullable and existing records are retained.
