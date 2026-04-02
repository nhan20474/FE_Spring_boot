import type { CategoryDto } from '@/types/api';

export type AdminCategoryTreeNode = CategoryDto & { children: AdminCategoryTreeNode[] };

/**
 * Gắn danh mục admin (DTO) thành cây theo parentId.
 */
export function buildCategoryDtoTree(flat: CategoryDto[]): AdminCategoryTreeNode[] {
  const byId = new Map(flat.map((c) => [c.id, c]));
  const childrenOf = new Map<number | null, CategoryDto[]>();

  for (const c of flat) {
    const rawParent = c.parentId;
    const parentKey =
      rawParent != null && byId.has(rawParent) ? rawParent : null;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(c);
  }

  const sort = (a: CategoryDto, b: CategoryDto) =>
    a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });

  function build(parentKey: number | null): AdminCategoryTreeNode[] {
    const list = (childrenOf.get(parentKey) ?? []).sort(sort);
    return list.map((c) => ({
      ...c,
      children: build(c.id),
    }));
  }

  return build(null);
}

/** Mọi id là con/cháu của rootId (không gồm rootId). */
export function collectDescendantIds(rootId: number, flat: CategoryDto[]): Set<number> {
  const childrenMap = new Map<number, number[]>();
  for (const c of flat) {
    if (c.parentId == null) continue;
    if (!childrenMap.has(c.parentId)) childrenMap.set(c.parentId, []);
    childrenMap.get(c.parentId)!.push(c.id);
  }
  const out = new Set<number>();
  const stack = [...(childrenMap.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const kids = childrenMap.get(id);
    if (kids) stack.push(...kids);
  }
  return out;
}

/** Nhãn "A → B → C" để hiển thị trong dropdown chọn cha. */
export function categoryPathLabel(categoryId: number, flat: CategoryDto[]): string {
  const byId = new Map(flat.map((c) => [c.id, c]));
  const parts: string[] = [];
  let cur: CategoryDto | undefined = byId.get(categoryId);
  const guard = new Set<number>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(' → ');
}

export function countDescendants(rootId: number, flat: CategoryDto[]): number {
  return collectDescendantIds(rootId, flat).size;
}
