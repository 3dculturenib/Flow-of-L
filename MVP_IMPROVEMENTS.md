# MVP Improvements — Dashboard, Account History, Reports

This update builds on the existing `finance-app-mvp1-bugfixes` source. It does not change the Prisma schema, so **no database migration is required**.

## Added

### Dashboard analysis
- Average daily spending for the current month-to-date: active expense total divided by elapsed calendar days in the month.
- Highest recorded expense category for the current month-to-date.
- Shortcuts to Reports and account management/history.

These are descriptive calculations based on recorded events, not forecasts. Missing entries can change the results.

### Account history
- Each active and archived account has a `View history` link.
- History lists financial events affecting that account, including opening balances, income, expenses, transfers, and reversed events.
- Each row identifies whether the event currently affects the calculated balance.
- The page shows the current calculated balance, total event count, and number of reversed records.
- This is an event timeline, not a reconstructed daily balance statement. The current data model does not retain historical balance snapshots for every date.

### Reports
- New `/reports` page in the main navigation.
- Filters: date range, event type, category, account, and event status (active, reversed, or all records).
- Summary: income, expenses, net cash flow, average daily spending, and counts/totals by event type.
- Category breakdown for active income and expense events.
- Matching transaction details including account effects and tags.
- Reversed events can be inspected, but they are excluded from financial totals because they no longer affect calculated balances.
- Transfers are excluded from net cash flow (income minus expenses).

## Apply this update
1. Back up your current project folder.
2. Extract the ZIP to a temporary folder.
3. Copy the updated source files into your current project, overwriting matching source files. Keep `.env` and `prisma/migrations` unchanged.
4. No schema migration is required. Run:

   ```powershell
   npm install
   npm run db:validate
   npm run db:generate
   npm run dev
   ```

5. Open `http://localhost:3000`, then test dashboard metrics, account history, and report filters.

## Verification status
Dependencies could not be installed in the build environment because installation timed out. Consequently, a full Next.js build and live Neon database test were not verified here. Run the commands above locally and report any errors verbatim.
