"use client";

import { useMemo, useState } from "react";
import { createCategory } from "@/app/actions";

type CategoryOption = { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentId: string | null };

export function CategoryForm({ categories }: { categories: CategoryOption[] }) {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const parents = useMemo(() => categories.filter((category) => category.kind === kind), [categories, kind]);
  return <form action={createCategory} className="form-stack">
    <label>Category type<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as "INCOME" | "EXPENSE")}><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select></label>
    <label>Category name<input name="name" minLength={2} maxLength={80} placeholder={kind === "EXPENSE" ? "e.g. Food" : "e.g. Salary"} required /></label>
    <label>Parent category <span className="optional">optional</span><select name="parentId" defaultValue=""><option value="">No parent — top-level category</option>{parents.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label>Description <span className="optional">optional</span><textarea name="description" rows={2} placeholder="What belongs in this category?" /></label>
    <p className="field-hint">Categories can be nested. Choose a parent of the same type to create a child category.</p>
    <button className="button button-primary" type="submit">Create category</button>
  </form>;
}
