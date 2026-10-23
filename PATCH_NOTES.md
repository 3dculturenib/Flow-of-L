# MVP bug-fix patch

This patch is intended to be copied over the existing local `finance-app-sprint0` project. It deliberately does not include `.env` or `prisma/migrations`, so your Neon credentials and locally generated migration history are not replaced.

## Fixes included

1. **Category tree order** — categories are grouped into Income and Expenses, then rendered in parent-first tree order. Each parent is immediately followed by its children and deeper descendants before the next sibling/root.
2. **Archived accounts** — Accounts now has a separate Archived accounts section with calculated balances and a Restore account action. Archived accounts remain excluded from the active-account total and cannot be selected for new transactions until restored.
3. **Reversal after archiving** — reversing an active historical transaction restores any archived account touched by that transaction before the event is reversed. This ensures a changed calculated balance is visible and manageable instead of being hidden in the archived list.
4. **Custom account types** — account type is now free text with common suggestions. Users can enter a custom type when creating an account or change it later. Existing enum values such as `BANK`, `CASH`, `SAVINGS`, and `MOBILE_MONEY` are displayed with readable labels.

## Apply the patch safely

1. Back up your current project folder.
2. Extract this ZIP and copy the contents of `finance-app-sprint0` over your existing `finance-app-sprint0` folder. Do not delete the existing folder and do not replace `.env` or `prisma/migrations`.
3. Open a terminal in the existing project folder.
4. Run:

   ```powershell
   npm install
   npm run db:validate
   npm run db:generate
   npm run db:migrate -- --name configurable_account_types
   ```

5. Inspect the migration summary. It should change the Account `type` column from the old PostgreSQL enum to text. If Prisma proposes dropping/resetting tables or resetting the database, cancel and ask for help before accepting.
6. Start the app with `npm run dev` and open `http://localhost:3000`.

The migration changes the schema but does not delete account, category, or transaction rows. Keep working against your development Neon database until the changes have been tested.

## Manual regression tests

- Category tree: create an Expense root `Home`, child `Repairs`, and another root `Food`. `Repairs` should appear directly after `Home`, before `Food`.
- Archive view: archive a zero-balance account; confirm it appears under Archived accounts and can be restored.
- Historical reversal: archive an account after bringing its balance to zero, then reverse an earlier active transaction affecting that account. Confirm the account is automatically restored and its resulting balance appears on the active Accounts list and dashboard total.
- Custom account type: create an account with type `Investment wallet`; confirm it is displayed as entered, then edit the type and save.
- Existing types: confirm prior accounts with enum values (`BANK`, `CASH`, `SAVINGS`, `MOBILE_MONEY`, `OTHER`) show readable labels.
