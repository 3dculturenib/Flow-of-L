# Authentication and account assignment update

## Included

- Registration with name, email, password, and password confirmation.
- Login and sign out.
- Passwords hashed with Node.js scrypt; never stored as plain text.
- Signed, HTTP-only, SameSite session cookie with a 14-day expiry.
- Existing pages and server actions resolve the signed-in user; data operations remain scoped to that user's ID.
- Optional account assignment/purpose, visible on the account page and dashboard, editable from the account edit form, and clearable by saving it empty.
- Report category options narrow to Income categories for Income, Expense categories for Expense, no categories for Transfer/Opening Balance, and all categories when no transaction type is selected.

## Existing database update

Back up the database first, ensure `AUTH_SECRET` is set in `.env`, then run:

```bash
npx prisma db push
npm run db:generate
npm run dev
```

Generate `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not run a database reset. The schema additions are nullable and preserve existing rows.

## Existing-data compatibility / important limitation

If the previous local MVP created the `seed-user` row, the first registration claims that row by adding the supplied name/email/password hash. This preserves the existing user's financial records. This first-registration claim is only appropriate for a private local prototype. Before deployment to a public URL, change it to a deliberate owner-claim/migration procedure and review security, rate limiting, account recovery, email verification, session invalidation, backups, and hosting configuration.

## Report filter behavior

The category selector is server-rendered after choosing a transaction type and running the report. Income narrows to income categories, Expense narrows to expense categories, Transfer and Opening Balance show no category options, and an empty transaction type shows all categories. If the chosen type changes, a previous category that no longer matches is ignored.
