import { Fragment, type ReactNode } from "react";
import { archiveCategory, updateCategory } from "@/app/actions";
import { CategoryForm } from "@/components/category-form";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }: { searchParams?: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: [{ name: "asc" }] }),
    prisma.tag.findMany({ where: { userId: user.id }, include: { _count: { select: { events: true } } }, orderBy: { name: "asc" } }),
  ]);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const childrenByParent = new Map<string | null, typeof categories>();
  for (const category of categories) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) siblings.sort((a, b) => a.name.localeCompare(b.name));

  function renderCategory(category: (typeof categories)[number], depth: number): ReactNode {
    const children = childrenByParent.get(category.id) ?? [];
    return <Fragment key={category.id}>
      <article className="category-row" style={{ marginLeft: `${depth * 22}px` }}>
        <span className={`category-kind kind-${category.kind.toLowerCase()}`}>{category.kind === "INCOME" ? "Income" : "Expense"}</span>
        <div className="category-info"><strong>{category.name}</strong><small>{category.parentId ? `Under ${byId.get(category.parentId)?.name ?? "archived parent"}` : "Top-level category"}{category.description ? ` · ${category.description}` : ""}</small></div>
        <details className="category-edit"><summary>Edit</summary><form action={updateCategory} className="category-edit-form"><input type="hidden" name="categoryId" value={category.id} /><label>Name<input name="name" defaultValue={category.name} minLength={2} required /></label><label>Description<input name="description" defaultValue={category.description ?? ""} /></label><button className="button button-secondary" type="submit">Save changes</button></form></details>
        <form action={archiveCategory}><input type="hidden" name="categoryId" value={category.id} /><button className="icon-button" type="submit" aria-label={`Archive ${category.name}`} title="Archive category">×</button></form>
      </article>
      {children.map((child) => renderCategory(child, depth + 1))}
    </Fragment>;
  }

  const incomeRoots = childrenByParent.get(null)?.filter((category) => category.kind === "INCOME") ?? [];
  const expenseRoots = childrenByParent.get(null)?.filter((category) => category.kind === "EXPENSE") ?? [];
  const rootlessCount = incomeRoots.length + expenseRoots.length;

  return <main className="page-content">
    <section className="page-title-row"><div><p className="eyebrow">ORGANIZATION · 03</p><h1>Categories & tags</h1><p className="muted">Use categories to classify income and expenses; use tags for flexible labels that can cross categories.</p></div><div className="summary-chip"><span>Active categories</span><strong>{categories.length}</strong></div></section>
    {params?.error && <div className="alert alert-error" role="alert">{params.error}</div>}{params?.notice && <div className="alert alert-success" role="status">{params.notice}</div>}
    <section className="two-column-layout categories-layout">
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">CATEGORY TREE</p><h2>Income and expense categories</h2></div></div>
        {categories.length ? <div className="category-list">
          <section className="category-tree-group"><h3 className="category-tree-heading">Income</h3>{incomeRoots.length ? incomeRoots.map((category) => renderCategory(category, 0)) : <p className="field-hint">No income categories yet.</p>}</section>
          <section className="category-tree-group"><h3 className="category-tree-heading">Expenses</h3>{expenseRoots.length ? expenseRoots.map((category) => renderCategory(category, 0)) : <p className="field-hint">No expense categories yet.</p>}</section>
          {rootlessCount === 0 && <p className="field-hint">No top-level categories are available. Check whether any categories have an archived parent.</p>}
        </div> : <div className="empty-state"><h3>No categories yet</h3><p>Create income and expense categories to organize your records.</p></div>}
      </div>
      <aside className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">ADD CATEGORY</p><h2>New category</h2></div></div><CategoryForm categories={categories.map((category) => ({ id: category.id, name: category.name, kind: category.kind, parentId: category.parentId }))} /></aside>
    </section>
    <section className="panel tag-panel"><div className="panel-heading"><div><p className="eyebrow">FLEXIBLE LABELS</p><h2>Tags used in transactions</h2></div><span className="small-count">{tags.length} tags</span></div>
      {tags.length ? <div className="tag-management-list">{tags.map((tag) => <div className="tag-management-item" key={tag.id}><span className="tag-token">{tag.name}</span><span className="muted">Used on {tag._count.events} event{tag._count.events === 1 ? "" : "s"}</span></div>)}</div> : <p className="muted">No tags yet. Add comma-separated tags while recording a transaction; tags are created automatically.</p>}
    </section>
  </main>;
}
