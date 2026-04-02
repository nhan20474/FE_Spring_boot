import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '@/types';
import { buildCategoryTree, type CategoryTreeNode } from '@/utils/categoryTree';

type Props = {
  flatCategories: Category[];
  loading: boolean;
  open: boolean;
  onNavigate: () => void;
};

function CategoryLinkRow({
  node,
  onHover,
  active,
  onNavigate,
  depth,
}: {
  node: CategoryTreeNode;
  onHover: () => void;
  active: boolean;
  onNavigate: () => void;
  depth: 1 | 2 | 3;
}) {
  const hasChildren = node.children.length > 0;
  const to = `/category/${encodeURIComponent(node.slug)}`;

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren && typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
      e.preventDefault();
      onHover();
    }
  };

  const pad = depth === 1 ? 'px-3 py-2.5' : depth === 2 ? 'px-3 py-2' : 'px-3 py-2 pl-4';

  return (
    <Link
      to={to}
      onClick={(e) => {
        handleClick(e);
        if (!e.defaultPrevented) onNavigate();
      }}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={`flex items-center gap-2 rounded-lg text-left transition-colors ${pad} ${
        active
          ? 'bg-primary/10 text-primary dark:bg-primary/20'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
      }`}
    >
      <span
        className={`material-icons shrink-0 text-lg ${depth === 1 ? 'text-slate-500' : 'text-slate-400'}`}
        aria-hidden
      >
        {node.icon}
      </span>
      <span className={`min-w-0 flex-1 ${depth === 1 ? 'font-semibold text-sm' : 'text-sm'}`}>{node.name}</span>
      {hasChildren && (
        <span className="material-icons text-base text-slate-400 shrink-0" aria-hidden>
          chevron_right
        </span>
      )}
    </Link>
  );
}

const StoreCategoryMegaMenu: React.FC<Props> = ({ flatCategories, loading, open, onNavigate }) => {
  const tree = useMemo(() => buildCategoryTree(flatCategories), [flatCategories]);

  const hasLevel2 = useMemo(() => tree.some((n) => n.children.length > 0), [tree]);
  const hasLevel3 = useMemo(
    () => tree.some((n) => n.children.some((ch) => ch.children.length > 0)),
    [tree]
  );

  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const flatOnly = tree.length > 0 && !hasLevel2;

  useEffect(() => {
    if (!open || tree.length === 0) return;
    setActiveRootId((prev) => {
      if (prev && tree.some((n) => n.id === prev)) return prev;
      return tree[0]?.id ?? null;
    });
    setActiveChildId(null);
  }, [open, tree]);

  const rootNode = useMemo(
    () => (activeRootId ? tree.find((n) => n.id === activeRootId) : tree[0]),
    [tree, activeRootId]
  );

  const secondLevel = rootNode?.children ?? [];
  const childNode = useMemo(
    () => (activeChildId ? secondLevel.find((n) => n.id === activeChildId) : secondLevel[0]),
    [secondLevel, activeChildId]
  );

  const thirdLevel = childNode?.children ?? [];

  const showCol2 = hasLevel2 && secondLevel.length > 0;
  const showCol3 = hasLevel3 && thirdLevel.length > 0;
  const visibleCols = 1 + (showCol2 ? 1 : 0) + (showCol3 ? 1 : 0);

  const panelWidthClass =
    visibleCols <= 1
      ? 'w-[min(100vw-2rem,320px)]'
      : visibleCols === 2
        ? 'w-[min(100vw-2rem,560px)]'
        : 'w-[min(100vw-2rem,880px)]';

  useEffect(() => {
    if (!open || !rootNode) {
      setActiveChildId(null);
      return;
    }
    const sl = rootNode.children;
    if (sl.length === 0) {
      setActiveChildId(null);
      return;
    }
    setActiveChildId((prev) => {
      if (prev && sl.some((n) => n.id === prev)) return prev;
      return sl[0].id;
    });
  }, [open, rootNode?.id]);

  if (!open) return null;

  return (
    <div className="absolute top-full left-0 z-[110] pt-1.5">
      <div
        className={`flex max-h-[min(420px,72vh)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 ${panelWidthClass}`}
        role="navigation"
        aria-label="Danh mục"
      >
        {loading && flatCategories.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Đang tải danh mục…</div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Chưa có danh mục.</div>
        ) : flatOnly ? (
          <div className="max-h-[min(400px,70vh)] w-[min(100vw-2rem,320px)] overflow-y-auto overscroll-contain p-2">
            {tree.map((node) => (
              <CategoryLinkRow
                key={node.id}
                node={node}
                depth={1}
                active={false}
                onHover={() => {}}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <>
            <div
              className={`flex min-w-0 flex-col ${showCol2 || showCol3 ? 'flex-[1.05] border-r border-slate-100 dark:border-slate-700' : 'w-full'}`}
            >
              <div className="overflow-y-auto overscroll-contain p-2">
                {tree.map((node) => (
                  <CategoryLinkRow
                    key={node.id}
                    node={node}
                    depth={1}
                    active={node.id === rootNode?.id}
                    onHover={() => {
                      setActiveRootId(node.id);
                      setActiveChildId(null);
                    }}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>

            {showCol2 && (
              <div
                className={`flex min-w-0 flex-1 flex-col ${showCol3 ? 'border-r border-slate-100 dark:border-slate-700' : ''}`}
              >
                <div className="overflow-y-auto overscroll-contain p-2">
                  {secondLevel.map((node) => (
                    <CategoryLinkRow
                      key={node.id}
                      node={node}
                      depth={2}
                      active={node.id === childNode?.id}
                      onHover={() => setActiveChildId(node.id)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            )}

            {showCol3 && (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="overflow-y-auto overscroll-contain p-2">
                  {thirdLevel.map((node) => (
                    <CategoryLinkRow
                      key={node.id}
                      node={node}
                      depth={3}
                      active={false}
                      onHover={() => {}}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StoreCategoryMegaMenu;
