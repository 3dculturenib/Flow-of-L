# MVP 3 — Tag reports, first-time setup, and fixed account types

## Changes
- Added an optional tag filter to Reports. Selecting a tag restricts matching events to events carrying that tag.
- Added tag analysis showing active matching record counts, income, expenses, and net income-minus-expenses per tag. Events with multiple tags appear in each relevant tag row; totals intentionally overlap. Reversed events remain in history but do not contribute to financial analysis.
- New registrations are sent through a one-time setup step asking only for the first account name, a fixed account type (Bank account is the default), and an optional opening balance. Name is reused from registration and currency remains ETB for V1.
- Account types are now a fixed dropdown: Bank account, Cash, Mobile money, Savings account, Investment, Wallet, Other. Server actions validate against this list. Existing custom types display as Other in the edit dropdown if they do not match a supported type.
- Existing users are preserved as setup-complete when the new boolean field is added.

## Database update
Back up the database first, then run `npx prisma db push` and `npm run db:generate`. This adds `User.setupComplete`; it does not intentionally reset existing records.

## Notes
This version is a development/test build. Validate authentication and user-data isolation before deploying with real financial records.
