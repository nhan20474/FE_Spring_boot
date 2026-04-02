import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as backend from '@/services/backend';
import type { CategoryDto } from '@/types/api';
import AdminCategoryFormModal from '@/pages/admin/categories/AdminCategoryFormModal';
import {
  buildCategoryDtoTree,
  countDescendants,
  type AdminCategoryTreeNode,
} from '@/utils/categoryDtoTree';

const CategoryBranch: React.FC<{
  node: AdminCategoryTreeNode;
  onEdit: (c: CategoryDto) => void;
  onAddChild: (parentId: number) => void;
  onDelete: (c: CategoryDto) => void;
}> = ({ node, onEdit, onAddChild, onDelete }) => {
  const hasChildren = node.children.length > 0;

  return (
    <div className={hasChildren ? 'mb-1' : ''}>
      <div className="group flex flex-col gap-3 rounded-xl border border-transparent bg-white px-3 py-3 transition-colors hover:border-slate-200 hover:bg-slate-50/90 dark:bg-slate-900/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            aria-hidden
          >
            <span className="material-icons text-[20px]">{hasChildren ? 'folder' : 'label'}</span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">{node.name}</span>
              {node.slug ? (
                <span className="inline-flex max-w-full items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  /{node.slug}
                </span>
              ) : null}
            </div>
            {node.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{node.description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 pl-12 sm:justify-end sm:pl-0 sm:opacity-100">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="material-icons text-[16px]">add</span>
            Thêm con
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="material-icons text-[16px]">edit</span>
            Sửa
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <span className="material-icons text-[16px]">delete_outline</span>
            Xóa
          </button>
        </div>
      </div>

      {hasChildren && (
        <div className="ml-4 mt-1 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
          {node.children.map((ch) => (
            <CategoryBranch key={ch.id} node={ch} onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
};

const CategoryListPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditing, setModalEditing] = useState<CategoryDto | null>(null);
  const [modalDefaultParent, setModalDefaultParent] = useState<number | null>(null);

  const tree = useMemo(() => buildCategoryDtoTree(categories), [categories]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await backend.adminGetCategories();
      setCategories(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh mục');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreate = (parentId: number | null = null) => {
    setModalEditing(null);
    setModalDefaultParent(parentId);
    setModalOpen(true);
  };

  const openEdit = (c: CategoryDto) => {
    setModalEditing(c);
    setModalDefaultParent(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalEditing(null);
    setModalDefaultParent(null);
  };

  const handleSaved = (cat: CategoryDto) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === cat.id);
      if (exists) return prev.map((c) => (c.id === cat.id ? cat : c));
      return [cat, ...prev];
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await backend.adminDeleteCategory(deleteConfirm.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const deleteDescCount = deleteConfirm ? countDescendants(deleteConfirm.id, categories) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-[#202224] dark:text-white">Danh mục sản phẩm</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {loading ? 'Đang tải…' : `${categories.length} danh mục trong hệ thống`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate(null)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600"
        >
          <span className="material-icons text-[20px]">add_circle_outline</span>
          Thêm danh mục gốc
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <span className="material-icons shrink-0 text-[20px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={fetchCategories} className="font-semibold underline">
            Thử lại
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-700 dark:bg-slate-900/30">
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Danh sách</p>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-full max-w-md rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-icons mb-3 text-5xl text-slate-300 dark:text-slate-600">category</span>
              <p className="font-semibold text-slate-700 dark:text-slate-300">Chưa có danh mục nào</p>
              <button
                type="button"
                onClick={() => openCreate(null)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                <span className="material-icons text-[18px]">add</span>
                Tạo danh mục đầu tiên
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tree.map((node) => (
                <CategoryBranch
                  key={node.id}
                  node={node}
                  onEdit={openEdit}
                  onAddChild={(parentId) => openCreate(parentId)}
                  onDelete={setDeleteConfirm}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminCategoryFormModal
        open={modalOpen}
        onClose={closeModal}
        categories={categories}
        defaultParentId={modalDefaultParent}
        editing={modalEditing}
        onSaved={handleSaved}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <span className="material-icons text-3xl text-amber-500">warning</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Xác nhận xóa danh mục</h3>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">&ldquo;{deleteConfirm.name}&rdquo;</p>
            {deleteDescCount > 0 && (
              <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                {deleteDescCount} danh mục con.
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {deleting && <span className="material-icons animate-spin text-[18px]">refresh</span>}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryListPage;
