import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as backend from '@/services/backend';
import type { CategoryDto } from '@/types/api';
import {
  categoryPathLabel,
  collectDescendantIds,
} from '@/utils/categoryDtoTree';

type Mode = 'create' | 'edit';

export type AdminCategoryFormModalProps = {
  open: boolean;
  onClose: () => void;
  categories: CategoryDto[];
  defaultParentId?: number | null;
  editing?: CategoryDto | null;
  onSaved: (cat: CategoryDto) => void;
};

const AdminCategoryFormModal: React.FC<AdminCategoryFormModalProps> = ({
  open,
  onClose,
  categories,
  defaultParentId = null,
  editing = null,
  onSaved,
}) => {
  const mode: Mode = editing ? 'edit' : 'create';
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excludedParentIds = useMemo(() => {
    if (!editing) return new Set<number>();
    const d = collectDescendantIds(editing.id, categories);
    d.add(editing.id);
    return d;
  }, [editing, categories]);

  const parentOptions = useMemo(() => {
    return [...categories]
      .filter((c) => !excludedParentIds.has(c.id))
      .sort((a, b) =>
        categoryPathLabel(a.id, categories).localeCompare(
          categoryPathLabel(b.id, categories),
          'vi',
          { sensitivity: 'base' }
        )
      );
  }, [categories, excludedParentIds]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setSlug(editing.slug ?? '');
      setParentId(editing.parentId != null ? String(editing.parentId) : '');
    } else {
      setName('');
      setDescription('');
      setSlug('');
      setParentId(defaultParentId != null ? String(defaultParentId) : '');
    }
    setError(null);
    setTimeout(() => nameRef.current?.focus(), 80);
  }, [open, editing, defaultParentId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên danh mục.');
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      slug: slug.trim() || undefined,
      parentId: parentId.trim() ? Number(parentId.trim()) : null,
    };
    try {
      const cat =
        mode === 'edit' && editing
          ? await backend.adminUpdateCategoryV2(editing.id, body)
          : await backend.adminCreateCategoryV2(body);
      onSaved(cat);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được. Thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-cat-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-700">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 id="admin-cat-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'create' ? 'Thêm danh mục mới' : 'Sửa danh mục'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="ac-name" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Tên danh mục <span className="text-red-500">*</span>
            </label>
            <input
              id="ac-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=""
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="ac-parent" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Nằm trong danh mục
            </label>
            <select
              id="ac-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Gốc</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {categoryPathLabel(c.id, categories)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ac-desc" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Mô tả
            </label>
            <textarea
              id="ac-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder=""
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="ac-slug" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Slug
            </label>
            <input
              id="ac-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder=""
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <span className="material-icons shrink-0 text-[18px]">error_outline</span>
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {saving ? (
                <span className="material-icons animate-spin text-[18px]">refresh</span>
              ) : (
                <span className="material-icons text-[18px]">save</span>
              )}
              {mode === 'create' ? 'Tạo danh mục' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCategoryFormModal;
