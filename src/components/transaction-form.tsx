"use client";

import { useMemo, useState } from "react";
import { createTransaction } from "@/app/actions";

type AccountOption = { id: string; name: string; type: string };
type CategoryOption = { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentId: string | null };
type Allocation = { accountId: string; amount: string };

export function TransactionForm({ accounts, categories, today }: { accounts: AccountOption[]; categories: CategoryOption[]; today: string }) {
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");
  const [allocations, setAllocations] = useState<Allocation[]>([{ accountId: accounts[0]?.id ?? "", amount: "" }]);
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const categoryOptions = useMemo(() => categories.filter((category) => category.kind === (type === "INCOME" ? "INCOME" : "EXPENSE")), [categories, type]);

  function changeType(next: string) {
    if (next === "INCOME" || next === "EXPENSE" || next === "TRANSFER") setType(next);
  }
  function updateAllocation(index: number, key: keyof Allocation, value: string) {
    setAllocations((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }
  function addAllocation() {
    const available = accounts.find((account) => !allocations.some((item) => item.accountId === account.id));
    setAllocations((current) => [...current, { accountId: available?.id ?? "", amount: "" }]);
  }
  function removeAllocation(index: number) {
    setAllocations((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={createTransaction} className="form-stack">
      <div className="form-grid">
        <label>Transaction type
          <select name="type" value={type} onChange={(event) => changeType(event.target.value)}>
            <option value="EXPENSE">Expense (−)</option><option value="INCOME">Income (+)</option><option value="TRANSFER">Transfer (neutral overall)</option>
          </select>
        </label>
        <label>Date
          <input name="occurredAt" type="date" defaultValue={today} required />
        </label>
      </div>
      <label>Description / reason
        <input name="reason" placeholder={type === "EXPENSE" ? "e.g. Weekly groceries" : type === "INCOME" ? "e.g. Monthly salary" : "e.g. Move money to savings"} minLength={2} required />
      </label>
      <div className="form-grid">
        <label>Total amount (ETB)
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
        </label>
        {type !== "TRANSFER" ? <label>Category
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>Select a category</option>
            {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label> : <label>Transfer rule
          <input value="Moves money between your accounts" readOnly />
        </label>}
      </div>
      {type === "TRANSFER" ? <div className="form-grid">
        <label>From account
          <select name="sourceAccountId" value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)} required>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label>To account
          <select name="destinationAccountId" value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} required>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        {sourceAccountId === destinationAccountId && <p className="field-hint error-text full-span">Choose two different accounts.</p>}
      </div> : <div className="allocation-section">
        <div className="subsection-heading"><div><h3>{type === "EXPENSE" ? "Paid from" : "Money received into"}</h3><p>{type === "EXPENSE" ? "Split one purchase across accounts when needed." : "Split one income event across accounts when needed."}</p></div><button className="button button-quiet" type="button" onClick={addAllocation} disabled={allocations.length >= accounts.length || accounts.length < 2}>+ Add account</button></div>
        {allocations.map((allocation, index) => {
          const usedElsewhere = allocations.filter((_, i) => i !== index).map((item) => item.accountId);
          return <div className="allocation-row" key={index}>
            <label>Account
              <select name="effectAccountId" value={allocation.accountId} onChange={(event) => updateAllocation(index, "accountId", event.target.value)} required>
                <option value="" disabled>Select account</option>
                {accounts.map((account) => <option key={account.id} value={account.id} disabled={usedElsewhere.includes(account.id)}>{account.name}</option>)}
              </select>
            </label>
            <label>Amount (ETB)
              <input name="effectAmount" type="number" min="0.01" step="0.01" value={allocation.amount} onChange={(event) => updateAllocation(index, "amount", event.target.value)} placeholder="0.00" required />
            </label>
            {allocations.length > 1 && <button className="remove-line" type="button" aria-label="Remove account allocation" onClick={() => removeAllocation(index)}>×</button>}
          </div>;
        })}
        <p className="field-hint">The account allocations must add up exactly to the total amount.</p>
      </div>}
      {type === "EXPENSE" && <label>Plan status
        <select name="isPlanned" defaultValue="false"><option value="false">Unplanned</option><option value="true">Planned</option></select>
      </label>}
      <label>Tags <span className="optional">optional · comma-separated</span>
        <input name="tags" placeholder="e.g. family, recurring, work" />
      </label>
      <label>Note <span className="optional">optional</span>
        <textarea name="note" rows={2} placeholder="Extra details if useful" />
      </label>
      <div className="form-footer"><p>Balances update from saved account effects. Negative-balance situations are allowed but should be reviewed.</p><button className="button button-primary" type="submit" disabled={accounts.length === 0 || (type === "TRANSFER" && sourceAccountId === destinationAccountId)}>Save transaction</button></div>
      {accounts.length === 0 && <p className="field-hint error-text">Create an account before recording a transaction.</p>}
      {type !== "TRANSFER" && categoryOptions.length === 0 && <p className="field-hint error-text">Create a matching {type.toLowerCase()} category before saving.</p>}
    </form>
  );
}
