import { Prisma, EventType } from "@prisma/client";

export type EffectInput = { accountId: string; amount: Prisma.Decimal | number | string };

const D = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);

/**
 * Validates account-effect lines against the event type (Sprint 0 invariants).
 * Throws an Error with a user-readable message when a rule is broken.
 * Insufficient balance is NOT checked here: it is a warning, never a block.
 */
export function validateEffects(type: EventType, amount: Prisma.Decimal | number | string, effects: EffectInput[]) {
  const total = D(amount);
  if (total.lte(0)) throw new Error("Amount must be greater than zero.");
  if (effects.length === 0) throw new Error("At least one account is required.");
  const lines = effects.map((e) => D(e.amount));
  const sum = lines.reduce((a, b) => a.plus(b), D(0));

  switch (type) {
    case "INCOME":
    case "OPENING_BALANCE":
      if (lines.some((l) => l.lte(0))) throw new Error("Income lines must all be positive.");
      if (type === "OPENING_BALANCE" && effects.length !== 1) throw new Error("Opening balance affects exactly one account.");
      if (!sum.eq(total)) throw new Error("Destination amounts must add up to the income amount.");
      break;
    case "EXPENSE":
      if (lines.some((l) => l.gte(0))) throw new Error("Expense lines must all be negative.");
      if (!sum.abs().eq(total)) throw new Error("Funding amounts must add up to the expense amount.");
      break;
    case "TRANSFER": {
      const out = effects.filter((_, i) => lines[i].lt(0));
      const inn = effects.filter((_, i) => lines[i].gt(0));
      if (effects.length !== 2 || out.length !== 1 || inn.length !== 1)
        throw new Error("A transfer needs exactly one source and one destination.");
      if (out[0].accountId === inn[0].accountId) throw new Error("Source and destination must differ.");
      if (!sum.eq(0)) throw new Error("Transfer lines must net to zero.");
      if (!lines.find((l) => l.gt(0))!.eq(total)) throw new Error("Transfer lines must equal the transfer amount.");
      break;
    }
    default:
      throw new Error(`Event type "${type}" has no effect validation rules yet.`);
  }
}
