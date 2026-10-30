"use client";

import { useState } from "react";

type CategoryOption = { id: string; name: string; kind: "INCOME" | "EXPENSE" };
type Props = {
  categories: CategoryOption[];
  initialKind?: "INCOME" | "EXPENSE";
  initialCategoryId?: string;
  kindName?: string;
  categoryName?: string;
};

export default function PlanTypeCategoryFields({
  categories, initialKind = "EXPENSE", initialCategoryId = "",
  kindName = "kind", categoryName = "categoryId",
}: Props) {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(initialKind);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const filtered = categories.filter((category) => category.kind === kind);
  const selectedStillValid = filtered.some((category) => category.id === categoryId);

  return (
    <>
      <label>Plan type<select name={kindName} value={kind} onChange={(event) => { setKind(event.target.value as "INCOME" | "EXPENSE"); setCategoryId(""); }} required>
        <option value="EXPENSE">Planned expense</option><option value="INCOME">Planned income</option>
      </select></label>
      <label>Category<select name={categoryName} value={selectedStillValid ? categoryId : ""} onChange={(event) => setCategoryId(event.target.value)} required>
        <option value="" disabled>Select {kind === "INCOME" ? "income" : "expense"} category</option>
        {filtered.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select><span className="field-hint">Only {kind.toLowerCase()} categories are shown for this plan.</span></label>
    </>
  );
}
