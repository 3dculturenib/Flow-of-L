# Patch notes — MVP 4 Planning

- Added a Planning navigation link and page.
- Added FinancialPlan and PlanMatch database models plus plan/match enums, including remembered suggested/dismissed states.
- Added create/edit plan server actions with per-user ownership and category/type validation.
- Added category/date/type-based match suggestions ranked by amount closeness.
- Added explicit Confirm, Not a match, Remove, and Reconsider controls.
- Prevented one event from being confirmed against multiple plans simultaneously.
- Matching never creates a transaction or changes an account balance.
- Reversed transactions do not contribute to confirmed actual totals.
- Added monthly planning summary with pro-rated share for plans crossing month boundaries.
- Added responsive planning styles and a step-by-step testing guide.
