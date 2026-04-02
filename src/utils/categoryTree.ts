import type { Category } from '@/types';

export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

/**
 * Gắn danh mục phẳng thành cây theo parentId (cha → con → cháu).
 * Mục có parentId trỏ tới id không tồn tại được coi là danh mục gốc.
 */
export function buildCategoryTree(flat: Category[]): CategoryTreeNode[] {
  const byId = new Map(flat.map((c) => [c.id, c]));
  const childrenOf = new Map<string | null, Category[]>();

  for (const c of flat) {
    const rawParent = c.parentId;
    const parentKey =
      rawParent != null && byId.has(rawParent) ? rawParent : null;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(c);
  }

  const sort = (a: Category, b: Category) =>
    a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });

  function build(parentKey: string | null): CategoryTreeNode[] {
    const list = (childrenOf.get(parentKey) ?? []).sort(sort);
    return list.map((c) => ({
      ...c,
      children: build(c.id),
    }));
  }

  return build(null);
}
