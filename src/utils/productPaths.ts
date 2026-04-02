/**
 * Canonical storefront path for product detail. Prefer API slug when present so URLs stay stable.
 * Numeric `id` still works as a segment (legacy bookmarks).
 */

export function productDetailPath(p: {
  id: string;
  slug?: string | null;
  productDetailId?: string | null;
}): string {
  const id = p.productDetailId ?? p.id;
  const s = p.slug?.trim();
  if (s) return `/product/${encodeURIComponent(s)}`;
  return `/product/${encodeURIComponent(id)}`;
}
