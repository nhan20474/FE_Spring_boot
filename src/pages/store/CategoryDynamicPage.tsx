import React, { useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useApiCategories, useApiProductsBySlug } from '@/hooks/useProductApi';
import { isApiConfigured } from '@/services/api';
import ProductCard from '@/features/products/components/ProductCard';
import Breadcrumbs from '@/components/store/Breadcrumbs';
import { buildCategoryTree, type CategoryTreeNode } from '@/utils/categoryTree';
import type { Category, Product } from '@/types';

function findTreeNodeBySlug(nodes: CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  for (const n of nodes) {
    if (n.slug === slug) return n;
    const found = findTreeNodeBySlug(n.children, slug);
    if (found) return found;
  }
  return null;
}

function ancestorChain(categories: Category[], current: Category): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: Category[] = [];
  let cur: Category | undefined = current;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

function parseSort(searchParams: URLSearchParams): { sortBy: string; sortDir: string } {
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortDir = searchParams.get('sortDir') || 'desc';
  const ok =
    (sortBy === 'createdAt' || sortBy === 'price') && (sortDir === 'asc' || sortDir === 'desc');
  return ok ? { sortBy, sortDir } : { sortBy: 'createdAt', sortDir: 'desc' };
}

function categoryPath(slug: string) {
  return `/category/${encodeURIComponent(slug)}`;
}

/** Hàng pill cuộn ngang — phù hợp nhiều danh mục trên mobile */
function HorizontalCategoryRail({
  label,
  items,
  activeSlug,
}: {
  label: string;
  items: Category[];
  activeSlug: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <div className="relative -mx-1">
        <div
          className="flex gap-2 overflow-x-auto px-1 pb-2 pt-0.5 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          role="list"
        >
          {items.map((c) => {
            const active = c.slug === activeSlug;
            return (
              <Link
                key={c.id}
                to={categoryPath(c.slug)}
                role="listitem"
                className={`snap-start shrink-0 max-w-[85vw] truncate rounded-full px-3.5 py-2 text-sm font-medium transition-colors border ${
                  active
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-600 hover:border-primary/50'
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Sidebar dọc: cuộn độc lập khi danh mục nhiều (desktop) */
function CategorySidebarNav({
  parentCategory,
  siblings,
  childCategories,
  activeSlug,
}: {
  parentCategory: Category | null;
  siblings: Category[];
  childCategories: CategoryTreeNode[];
  activeSlug: string;
}) {
  const showSiblingBlock = siblings.length > 1;
  const showChildBlock = childCategories.length > 0;
  if (!parentCategory && !showSiblingBlock && !showChildBlock) return null;

  return (
    <aside className="hidden lg:block w-full min-w-[220px] max-w-[280px] shrink-0">
      <nav
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-sm sticky top-24 max-h-[min(70vh,calc(100vh-7rem))] overflow-y-auto overscroll-contain p-4 space-y-5"
        aria-label="Danh mục"
      >
        {parentCategory && (
          <div>
            <Link
              to={categoryPath(parentCategory.slug)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <span className="material-icons text-lg" aria-hidden>
                arrow_back
              </span>
              <span className="truncate">{parentCategory.name}</span>
            </Link>
          </div>
        )}

        {showSiblingBlock && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Danh mục
            </h2>
            <ul className="space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
              {siblings.map((s) => {
                const active = s.slug === activeSlug;
                return (
                  <li key={s.id}>
                    <Link
                      to={categoryPath(s.slug)}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {s.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {showChildBlock && (
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Chi tiết danh mục
            </h2>
            <ul className="space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
              {childCategories.map((ch) => {
                const active = ch.slug === activeSlug;
                return (
                  <li key={ch.id}>
                    <Link
                      to={categoryPath(ch.slug)}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {ch.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    </aside>
  );
}

/**
 * PLP theo slug: sidebar + rail ngang, sort từ API, includeDescendants.
 */
const CategoryDynamicPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sortBy, sortDir } = parseSort(searchParams);

  const { data: categories, loading: catsLoading } = useApiCategories();
  const { data: products, loading: productsLoading } = useApiProductsBySlug(slug, sortBy, sortDir, true);

  const cat = categories.find((c) => c.slug === slug);
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const treeNode = slug ? findTreeNodeBySlug(tree, slug) : null;
  const childCategories = treeNode?.children ?? [];

  const parentCategory = useMemo(() => {
    if (!cat?.parentId) return null;
    return categories.find((c) => c.id === cat.parentId) ?? null;
  }, [cat, categories]);

  const siblings = useMemo(() => {
    if (!cat) return [];
    return categories
      .filter((c) => c.parentId === cat.parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
  }, [cat, categories]);

  const loading = isApiConfigured() && (catsLoading || productsLoading);
  const title = cat?.name ?? (slug.replace(/-/g, ' ') || 'Danh mục');
  const unknownCategory = isApiConfigured() && !catsLoading && !cat;

  const breadcrumbItems = useMemo(() => {
    const home = { label: 'Trang chủ', path: '/' as const };
    if (!cat) {
      return [home, { label: 'Danh mục', path: '/search' }, { label: title }];
    }
    const chain = ancestorChain(categories, cat);
    const mid = chain.slice(0, -1).map((c) => ({
      label: c.name,
      path: categoryPath(c.slug),
    }));
    const last = chain[chain.length - 1];
    return [home, ...mid, { label: last.name }];
  }, [cat, categories, title]);

  const sortValue = `${sortBy}-${sortDir}`;
  const onSortChange = (value: string) => {
    const [sb, sd] = value.split('-');
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('sortBy', sb);
        n.set('sortDir', sd);
        return n;
      },
      { replace: true },
    );
  };

  const showMobileRails = siblings.length > 1 || childCategories.length > 0 || parentCategory;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8 w-full">
      <Breadcrumbs items={breadcrumbItems} className="mb-4 lg:mb-6" />

      {loading ? (
        <div className="text-center text-slate-500 py-24">Đang tải sản phẩm…</div>
      ) : unknownCategory ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Không tìm thấy danh mục</p>
          <p className="text-slate-500 mt-2 text-sm">Slug &quot;{slug}&quot; chưa khớp với dữ liệu trên server.</p>
          <Link to="/search" className="inline-block mt-6 text-primary font-semibold hover:underline">
            Tìm kiếm sản phẩm
          </Link>
        </div>
      ) : products.length === 0 && childCategories.length === 0 ? (
        <div className="text-center py-16 text-slate-500">Chưa có sản phẩm trong danh mục này.</div>
      ) : (
        <div className="lg:flex lg:items-start lg:gap-8 xl:gap-10">
          <CategorySidebarNav
            parentCategory={parentCategory}
            siblings={siblings}
            childCategories={childCategories}
            activeSlug={slug}
          />

          <div className="min-w-0 flex-1">
            {/* Mobile: điều hướng nhanh + sticky toolbar */}
            {showMobileRails && (
              <div className="lg:hidden mb-4 space-y-4 border-b border-slate-200 dark:border-slate-700 pb-4">
                {parentCategory && (
                  <Link
                    to={categoryPath(parentCategory.slug)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                  >
                    <span className="material-icons text-base" aria-hidden>
                      arrow_back
                    </span>
                    {parentCategory.name}
                  </Link>
                )}
                <HorizontalCategoryRail
                  label="Danh mục cùng cấp"
                  items={siblings.length > 1 ? siblings : []}
                  activeSlug={slug}
                />
                <HorizontalCategoryRail
                  label="Thu hẹp trong danh mục"
                  items={childCategories}
                  activeSlug={slug}
                />
              </div>
            )}

            <div className="sticky z-20 -mx-4 px-4 py-3 mb-4 border-b border-slate-200/90 dark:border-slate-700/90 bg-slate-50/95 dark:bg-slate-950/90 backdrop-blur-md lg:static lg:mx-0 lg:px-0 lg:py-0 lg:mb-5 lg:border-0 lg:bg-transparent lg:backdrop-blur-none top-[4.5rem]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{title}</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {products.length > 0
                      ? `${products.length} sản phẩm`
                      : 'Chưa có sản phẩm hiển thị'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label htmlFor="category-sort" className="text-sm text-slate-500 whitespace-nowrap">
                    Sắp xếp
                  </label>
                  <select
                    id="category-sort"
                    value={sortValue}
                    onChange={(e) => onSortChange(e.target.value)}
                    className="w-full sm:w-auto min-w-0 sm:min-w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="createdAt-desc">Mới nhất</option>
                    <option value="createdAt-asc">Cũ nhất</option>
                    <option value="price-asc">Giá: Thấp → cao</option>
                    <option value="price-desc">Giá: Cao → thấp</option>
                  </select>
                </div>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-12 text-slate-500 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                Chưa có sản phẩm trong nhánh danh mục này.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p as unknown as Product} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDynamicPage;
