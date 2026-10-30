# MVP 4 — Planning and transaction matching

## Included
- New Planning page for expected income and expected expenses.
- Plans have a name/purpose, category, expected total amount, start date, end date, and optional note.
- Plans can be edited. Changing plan type/category/date range removes any confirmed matches that no longer satisfy the revised rules.
- Planning summary shows planned income, planned expenses, and planned net for plans overlapping the current month.
- Candidate matches are suggested from active transactions with the same income/expense type and category inside the plan's date range. Amount closeness ranks suggestions but is not a hard exclusion, because a plan can match multiple smaller transactions.
- User must confirm each match or dismiss it. Confirmed matches can be removed. A transaction cannot be confirmed against two plans at the same time.
- Confirming a match only links records. It never creates, edits, or changes the balance effect of a transaction.
- Reversed transactions are not suggested and are excluded from confirmed actual totals.
- Existing authentication, account assignment/type, transaction history, reports, tag analysis, categories, and dashboard remain in place.

## Database update
This release adds `FinancialPlan` and `PlanMatch` tables and two enums. Back up the database first. Keep the existing `.env` and `DATABASE_URL`. From the project folder run:

```bash
npx prisma db push
npm run db:generate
npm run dev
```

Do not reset the database and do not run the demo seed over personal records.

## Testing
1. Sign in with the existing account; verify accounts, categories, tags, and transactions remain.
2. Create an expense plan (for example groceries, 4,000 ETB, current month) using an existing expense category.
3. Record one or more expenses with the same category and a date inside the plan range.
4. Open Planning; verify the transactions appear as suggestions. Amount closeness affects ordering only.
5. Confirm one transaction and check confirmed actual changes while the account balance remains unchanged by matching.
6. Dismiss another suggestion; verify it no longer appears for that plan.
7. Remove a confirmed match; verify it no longer contributes to actual matched amount.
8. Reverse a matched transaction in Transactions; verify it is excluded from the plan's confirmed actual amount.
9. Create and test a planned-income entry using an income category.
10. Edit a plan's date range or category and verify incompatible confirmed matches are removed.
11. Test a date range spanning two months and a plan with multiple transactions.
12. Check mobile layout in a narrow browser window.

## Limitations for this MVP
- Matching is suggestion-based and user-confirmed, not fully automatic.
- Suggestions require the same category, type, and date range. They do not attempt fuzzy category matching or suggest across categories.
- Plans represent a total for their entire date range, not a recurring schedule or installment schedule.
- There is no delete/archive plan action in this iteration; plans can be edited and retained for history.
- A full production build and live Neon integration test must still be performed in the user's environment.
