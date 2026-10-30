# MVP 4.1 — Planning refinements

## Changes
- Plan category options now update immediately when plan type changes. Income plans show only active income categories; expense plans show only active expense categories. This works for both creating and editing a plan. Server-side validation remains in place.
- Added plan priority: Critical, High, Normal (default), and Low. Priority is editable later. Plans are listed by priority first, then earlier start date, so the highest-priority items appear first.
- Priority is an organizational aid only; it does not change balances, transaction matching rules, or move funds automatically.

## Database update
The Prisma schema adds `PlanPriority` and a `priority` field to `FinancialPlan`, defaulting existing plans to `NORMAL`. Back up the database first, then run `npx prisma db push` and `npm run db:generate`. Do not reset the database.
