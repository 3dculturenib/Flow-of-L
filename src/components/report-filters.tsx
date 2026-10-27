"use client";

import { useState } from "react";

type CategoryOption = { id: string; name: string; kind: "INCOME" | "EXPENSE"; archivedAt: string | null };
type AccountOption = { id: string; name: string; archivedAt: string | null };

type Props = {
  from: string;
  to: string;
  type: string;
  categoryId: string;
  accountId: string;
  status: string;
  categories: CategoryOption[];
  accounts: AccountOption[];
};

export function ReportFilters({ from, to, type, categoryId, accountId, status, categories, accounts }: Props) {
  const [selectedType, setSelectedType] = useState(type);
  const [selectedCategory, setSelectedCategory] = useState(categoryId);
  const filteredCategories = selectedType === "INCOME"
    ? categories.filter((category) => category.kind === "INCOME")
    : selectedType === "EXPENSE"
      ? categories.filter((category) => category.kind === "EXPENSE")
      : selectedType
        ? []
        : categories;

  function changeType(nextType: string) {
    setSelectedType(nextType);
    if (nextType && nextType !== "INCOME" && nextType !== "EXPENSE") {
      setSelectedCategory("");
    } else if (selectedCategory && !categories.some((category) => category.id === selectedCategory && (!nextType || category.kind === nextType))) {
      setSelectedCategory("");
    }
  }

  return <form method="get" action="/reports" className="report-filters">
    <label>From date<input type="date" name="from" defaultValue={from} required /></label>
    <label>To date<input type="date" name="to" defaultValue={to} required /></label>
    <label>Transaction type<select name="type" value={selectedType} onChange={(event) => changeType(event.target.value)}><option value="">All types</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option><option value="TRANSFER">Transfer</option><option value="OPENING_BALANCE">Opening balance</option></select></label>
    <label>Category<select name="categoryId" value={filteredCategories.some((category) => category.id === selectedCategory) ? selectedCategory : ""} onChange={(event) => setSelectedCategory(event.target.value)}><option value="">All categories</option>{filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.kind === "INCOME" ? "Income" : "Expense"} · {category.name}{category.archivedAt ? " (archived)" : ""}</option>)}</select><small className="field-hint">{selectedType === "INCOME" ? "Income categories only" : selectedType === "EXPENSE" ? "Expense categories only" : selectedType ? "This transaction type has no category" : "All categories are shown until you choose Income or Expense."}</small></label>
    <label>Account<select name="accountId" defaultValue={accountId}><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.archivedAt ? " (archived)" : ""}</option>)}</select></label>
    <label>Record status<select name="status" defaultValue={status}><option value="ACTIVE">Active only</option><option value="REVERSED">Reversed only</option><option value="ALL">All records</option></select></label>
    <div className="report-filter-actions"><button className="button button-primary" type="submit">Run report</button><span className="field-hint">Totals ignore reversed events because they no longer affect calculated balances.</span></div>
  </form>;
}
