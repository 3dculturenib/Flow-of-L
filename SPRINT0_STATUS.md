# MVP 1 Status

## Implemented in code
- [x] Next.js App Router scaffold and shared navigation
- [x] Dashboard queries using calculated balances
- [x] Account creation, details editing, default selection, and soft archiving
- [x] Opening balance creation/correction with revision history
- [x] Income, expense, and transfer creation
- [x] Multi-account effects for one income/expense event
- [x] Category selection, hierarchical category creation, rename, and archive
- [x] Tag creation during transaction entry and tag usage display
- [x] Planned/unplanned expense marker
- [x] Transaction history and reversal-based correction
- [x] Revision snapshots on event create/opening-balance edit/reversal
- [x] Account ownership and category type checks in server actions

## Not implemented yet
- [ ] Edit a normal transaction in-place (current correction workflow is reverse + re-enter)
- [ ] Obligations/receivables, borrowing/lending, repayments, self-loans
- [ ] Savings-purpose assignments, confirmed/potential savings, goals
- [ ] Planning and planned-versus-actual matching
- [ ] Reminder engine and forecast analysis
- [ ] Authentication and multi-user interface
- [ ] Receipt image upload
- [ ] Automated test suite and end-to-end verification

## Verification
- Source files were prepared, but dependency installation timed out and the npm cache does not contain the dependencies. Therefore TypeScript build, Prisma validation/migration, and PostgreSQL runtime have not been verified in this environment.
- Run `npm install`, `npm run db:validate`, `npm run db:generate`, and `npm run build` locally; resolve reported errors before using the app.
- Keep the schema as a prototype until the complete conceptual model and historical/source reconciliation review are explicitly approved.
