import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AdminProductsTabs from '@/components/admin/AdminProductsTabs';
import SearchableCategorySelect from './components/SearchableCategorySelect';
import * as backend from '@/services/backend';
import { parseProductColorsFromApi, parseProductStorageFromApi } from '@/services/productMappers';
import { generateProductInfo, isAiConfigured } from '@/services/gemini';
import type { CategoryDto } from '@/types/api';

interface ColorRow {
  name: string;
  hex: string;
}

interface SpecRow {
  id: string;
  label: string;
  value: string;
}

interface SpecSection {
  id: string;
  title: string;
  rows: SpecRow[];
}

function newSpecRow(label = '', value = ''): SpecRow {
  return { id: crypto.randomUUID(), label, value };
}

function newSpecSection(title: string, rows: Omit<SpecRow, 'id'>[] = [{ label: '', value: '' }]): SpecSection {
  return {
    id: crypto.randomUUID(),
    title,
    rows: rows.map((r) => ({ ...r, id: crypto.randomUUID() })),
  };
}

/** Gợi ý nhóm thông số — người dùng chỉ cần điền giá trị */
const SPEC_SUGGESTIONS: { title: string; rows: { label: string; value: string }[] }[] = [
  {
    title: 'Màn hình',
    rows: [
      { label: 'Kích thước', value: '' },
      { label: 'Công nghệ màn hình', value: '' },
      { label: 'Độ phân giải / độ sáng', value: '' },
    ],
  },
  {
    title: 'Camera sau',
    rows: [
      { label: 'Độ phân giải', value: '' },
      { label: 'Khẩu độ / chống rung', value: '' },
    ],
  },
  { title: 'Camera trước', rows: [{ label: 'Độ phân giải', value: '' }] },
  {
    title: 'Hiệu năng & bộ nhớ',
    rows: [
      { label: 'Chip xử lý', value: '' },
      { label: 'RAM', value: '' },
    ],
  },
  {
    title: 'Pin & sạc',
    rows: [
      { label: 'Dung lượng pin', value: '' },
      { label: 'Công nghệ sạc', value: '' },
    ],
  },
  {
    title: 'Kết nối',
    rows: [
      { label: 'SIM / 5G', value: '' },
      { label: 'Wi‑Fi / Bluetooth', value: '' },
    ],
  },
  {
    title: 'Thiết kế',
    rows: [
      { label: 'Kháng nước & bụi', value: '' },
      { label: 'Kích thước & trọng lượng', value: '' },
    ],
  },
];

function formatSpecValueForForm(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map((x) => (x == null ? '' : String(x))).join(', ');
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

/** Đọc JSON từ API → bảng chỉnh sửa */
function parseSpecsJsonToSections(raw: string | null | undefined): SpecSection[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const out: SpecSection[] = [];
    for (const [sectionKey, block] of Object.entries(parsed as Record<string, unknown>)) {
      if (block == null) continue;
      if (typeof block === 'object' && !Array.isArray(block)) {
        const rows: SpecRow[] = [];
        for (const [rowKey, val] of Object.entries(block as Record<string, unknown>)) {
          rows.push(newSpecRow(rowKey, formatSpecValueForForm(val)));
        }
        out.push({ id: crypto.randomUUID(), title: sectionKey, rows: rows.length > 0 ? rows : [newSpecRow()] });
      } else {
        out.push({
          id: crypto.randomUUID(),
          title: sectionKey,
          rows: [newSpecRow('Giá trị', formatSpecValueForForm(block))],
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Gộp các nhóm trùng tên khi lưu; giá trị sau ghi đè nhãn trùng */
function buildSpecsJsonFromSections(sections: SpecSection[]): string | null {
  const merged = new Map<string, Record<string, string>>();
  for (const sec of sections) {
    const t = sec.title.trim();
    if (!t) continue;
    const inner = { ...(merged.get(t) ?? {}) };
    for (const row of sec.rows) {
      const lab = row.label.trim();
      if (!lab) continue;
      inner[lab] = row.value.trim();
    }
    if (Object.keys(inner).length > 0) merged.set(t, inner);
  }
  const obj = Object.fromEntries(merged);
  return Object.keys(obj).length > 0 ? JSON.stringify(obj) : null;
}

interface FormData {
  name: string;
  description: string;
  image: string;
  price: string;
  stock: string;
  categoryId: string;
  featured: boolean;
  colors: ColorRow[];
  storageOptions: string[];
  specSections: SpecSection[];
}

const EMPTY: FormData = {
  name: '',
  description: '',
  image: '',
  price: '',
  stock: '',
  categoryId: '',
  featured: false,
  colors: [],
  storageOptions: [],
  specSections: [],
};

const ProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormData>(EMPTY);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI generate
  const [aiOpen, setAiOpen] = useState(false);
  const [aiKeyword, setAiKeyword] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Load categories
  useEffect(() => {
    backend.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const flattenedCategories = useMemo(() => {
    // Map categories by ID
    const map = new Map<number, CategoryDto & { children: CategoryDto[] }>();
    categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
    
    // Build tree
    const tree: (CategoryDto & { children: CategoryDto[] })[] = [];
    categories.forEach((c) => {
      if (c.parentId != null && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(map.get(c.id)!);
      } else {
        tree.push(map.get(c.id)!);
      }
    });

    // Flatten tree with depth indicator
    const flatten = (nodes: any[], depth = 0): { id: number; name: string; depth: number }[] => {
      let result: { id: number; name: string; depth: number }[] = [];
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, depth });
        if (node.children && node.children.length > 0) {
          result = result.concat(flatten(node.children, depth + 1));
        }
      }
      return result;
    };

    return flatten(tree);
  }, [categories]);

  // Load product if editing
  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const dto = await backend.getProduct(id);
      setForm({
        name: dto.name,
        description: dto.description ?? '',
        image: dto.image ?? '',
        price: String(dto.price),
        stock: String(dto.stock ?? 0),
        categoryId: String(dto.categoryId),
        featured: Boolean(dto.featured),
        colors: parseProductColorsFromApi(dto.colors ?? undefined),
        storageOptions: parseProductStorageFromApi(dto.storageOptions ?? undefined),
        specSections: parseSpecsJsonToSections(dto.specifications ?? undefined),
      });
    } catch {
      setError('Không tải được sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Chỉ chấp nhận file ảnh (jpg, png, webp...)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File quá lớn (tối đa 10MB)');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const url = await backend.uploadImage(file);
      setForm((prev) => ({ ...prev, image: url }));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const openAiModal = () => {
    setAiKeyword(form.name || '');
    setAiError(null);
    setAiOpen(true);
    setTimeout(() => aiInputRef.current?.focus(), 50);
  };

  const handleAiGenerate = async () => {
    if (!aiKeyword.trim()) { setAiError('Vui lòng nhập tên hoặc từ khóa sản phẩm'); return; }
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateProductInfo(aiKeyword.trim());

      // Map categoryHint → categoryId nếu tìm được
      const matchedCat = categories.find((c) =>
        c.name.toLowerCase().includes(result.categoryHint.toLowerCase()) ||
        result.categoryHint.toLowerCase().includes(c.name.toLowerCase())
      );

      const DEFAULT_COLOR_HEX = '#64748b';

      setForm((prev) => {
        const next: FormData = {
          ...prev,
          name: result.name,
          description: result.description,
          price:
            result.suggestedPrice > 0
              ? String(Math.round(result.suggestedPrice))
              : prev.price,
          categoryId: matchedCat ? String(matchedCat.id) : prev.categoryId,
        };

        if (result.suggestedStock != null) {
          next.stock = String(result.suggestedStock);
        }

        if (result.colors && result.colors.length > 0) {
          next.colors = result.colors
            .map((c) => {
              const name = c.name.trim();
              const hex =
                c.hex && /^#[0-9A-Fa-f]{6}$/.test(c.hex) ? c.hex : DEFAULT_COLOR_HEX;
              return { name, hex };
            })
            .filter((c) => c.name.length > 0);
        }

        if (result.storageOptions && result.storageOptions.length > 0) {
          next.storageOptions = result.storageOptions
            .map((s) => String(s).trim())
            .filter((s) => s.length > 0);
        }

        if (result.specifications && Object.keys(result.specifications).length > 0) {
          const specJson = JSON.stringify(result.specifications);
          const sections = parseSpecsJsonToSections(specJson);
          if (sections.length > 0) {
            next.specSections = sections;
          }
        }

        return next;
      });
      setAiOpen(false);
      setAiKeyword('');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI gặp lỗi, vui lòng thử lại');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const price = Math.round(parseFloat(form.price));
    const stock = parseInt(form.stock, 10);
    const categoryId = parseInt(form.categoryId, 10);

    if (!form.name.trim()) return setError('Vui lòng nhập tên sản phẩm.');
    if (isNaN(price) || price <= 0) return setError('Giá không hợp lệ.');
    if (isNaN(stock) || stock < 0) return setError('Số lượng không hợp lệ.');
    if (isNaN(categoryId)) return setError('Vui lòng chọn danh mục.');

    const colorPayload = form.colors
      .map((c) => ({ name: c.name.trim(), hex: (c.hex || '#64748b').trim() || '#64748b' }))
      .filter((c) => c.name.length > 0);
    const storagePayload = form.storageOptions.map((s) => s.trim()).filter((s) => s.length > 0);

    const specificationsOut = buildSpecsJsonFromSections(form.specSections);

    setSaving(true);
    try {
      const basePayload = {
        name: form.name.trim(),
        price,
        stock,
        categoryId,
        featured: form.featured,
        ...(form.description ? { description: form.description } : {}),
        ...(form.image ? { image: form.image } : {}),
        colors: colorPayload.length > 0 ? JSON.stringify(colorPayload) : null,
        storageOptions: storagePayload.length > 0 ? JSON.stringify(storagePayload) : null,
        specifications: specificationsOut,
      };

      if (isEdit && id) {
        await backend.adminUpdateProduct(id, basePayload);
      } else {
        await backend.adminCreateProduct(basePayload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/admin/products'), 1000);
    } catch (err: unknown) {
      console.error('[ProductForm] save error:', err);
      let msg = 'Lưu thất bại.';
      if (err && typeof err === 'object') {
        const e = err as { status?: number; message?: string; body?: { message?: string; [k: string]: unknown } };
        if (e.body?.message) {
          msg = `${e.body.message}`;
        } else if (e.message) {
          msg = e.message;
        }
        if (e.status) msg = `[${e.status}] ${msg}`;
        // log full body for debugging
        if (e.body) console.error('[ProductForm] server body:', JSON.stringify(e.body));
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <AdminProductsTabs />
        <div className="flex justify-center py-20">
          <span className="material-icons animate-spin text-4xl text-primary">refresh</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminProductsTabs />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            {isEdit ? `ID: ${id}` : 'Điền thông tin và lưu'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAiConfigured() && (
            <button
              type="button"
              onClick={openAiModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-2 text-sm font-semibold hover:from-violet-600 hover:to-purple-700 transition-all shadow-sm shadow-purple-200"
            >
              <span className="material-icons text-[18px]">auto_awesome</span>
              Tạo bằng AI
            </button>
          )}
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="material-icons text-[18px]">arrow_back</span>
            Quay lại
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="material-icons text-[18px]">error_outline</span>
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <span className="material-icons text-[18px]">check_circle</span>
          Lưu thành công! Đang chuyển trang...
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="text-sm font-bold text-slate-900">Thông tin sản phẩm</div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Tên sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="VD: iPhone 15 Pro Max 256GB"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Danh mục <span className="text-red-500">*</span>
              </label>
              <SearchableCategorySelect
                categories={flattenedCategories}
                value={form.categoryId}
                onChange={(val) => setForm((prev) => ({ ...prev, categoryId: val }))}
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Giá (VND) <span className="text-red-500">*</span>
              </label>
              <input
                name="price"
                type="number"
                min="0"
                step="1000"
                value={form.price}
                onChange={handleChange}
                placeholder="VD: 29990000"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Stock */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Số lượng tồn kho <span className="text-red-500">*</span>
              </label>
              <input
                name="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={handleChange}
                placeholder="VD: 100"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Image Upload */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Hình ảnh sản phẩm</label>

              {/* Drop zone */}
              <div
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-blue-50'
                    : 'border-slate-200 hover:border-primary hover:bg-slate-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
                />

                {uploading ? (
                  <>
                    <span className="material-icons animate-spin text-3xl text-primary">refresh</span>
                    <p className="text-sm text-slate-500 font-medium">Đang tải lên...</p>
                  </>
                ) : form.image ? (
                  <div className="flex items-center gap-4 w-full" onClick={(e) => e.stopPropagation()}>
                    <img
                      src={form.image}
                      alt="preview"
                      className="h-24 w-24 object-contain rounded-lg border border-slate-200 bg-white flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/96x96?text=?'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{form.image}</p>
                      <p className="text-xs text-slate-400 mt-1">Click vùng này để chọn ảnh khác</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setForm((p) => ({ ...p, image: '' })); }}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="Xóa ảnh"
                    >
                      <span className="material-icons text-[20px]">delete</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="material-icons text-4xl text-slate-300">add_photo_alternate</span>
                    <p className="text-sm font-semibold text-slate-600">Kéo thả ảnh vào đây hoặc <span className="text-primary">click để chọn</span></p>
                    <p className="text-xs text-slate-400">JPG, PNG, WebP · Tối đa 10MB</p>
                  </>
                )}
              </div>

              {/* URL fallback input */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-400 flex-shrink-0">hoặc dán URL:</span>
                <input
                  name="image"
                  type="url"
                  value={form.image}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {uploadError && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <span className="material-icons text-[14px]">error_outline</span>
                  {uploadError}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Mô tả
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Mô tả chi tiết sản phẩm..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Màu sắc */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-slate-600">Màu sắc (tên + mã hex)</label>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, colors: [...p.colors, { name: '', hex: '#64748b' }] }))}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Thêm màu
                </button>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                {form.colors.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có màu — khách sẽ không thấy chọn màu trên trang chi tiết.</p>
                ) : (
                  form.colors.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => {
                            const next = [...p.colors];
                            next[idx] = { ...next[idx], name: v };
                            return { ...p, colors: next };
                          });
                        }}
                        placeholder="Tên màu"
                        className="flex-1 min-w-[120px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(row.hex) ? row.hex : '#64748b'}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => {
                            const next = [...p.colors];
                            next[idx] = { ...next[idx], hex: v };
                            return { ...p, colors: next };
                          });
                        }}
                        className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white"
                        title="Chọn màu"
                      />
                      <input
                        type="text"
                        value={row.hex}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => {
                            const next = [...p.colors];
                            next[idx] = { ...next[idx], hex: v };
                            return { ...p, colors: next };
                          });
                        }}
                        placeholder="#1d1d1f"
                        className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, colors: p.colors.filter((_, i) => i !== idx) }))}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Xóa màu"
                      >
                        <span className="material-icons text-[18px]">close</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dung lượng */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-slate-600">Tùy chọn dung lượng</label>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, storageOptions: [...p.storageOptions, ''] }))}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Thêm dung lượng
                </button>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                {form.storageOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có dung lượng — ẩn block chọn bộ nhớ trên storefront.</p>
                ) : (
                  form.storageOptions.map((cap, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cap}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => {
                            const next = [...p.storageOptions];
                            next[idx] = v;
                            return { ...p, storageOptions: next };
                          });
                        }}
                        placeholder="VD: 256GB"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, storageOptions: p.storageOptions.filter((_, i) => i !== idx) }))}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Xóa"
                      >
                        <span className="material-icons text-[18px]">close</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Thông số kỹ thuật — dạng bảng */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-0.5">Thông số kỹ thuật</label>
                  <p className="text-[11px] text-slate-500 max-w-xl">
                    Thêm từng <strong>nhóm</strong> (vd. Màn hình), rồi điền <strong>tên thông số</strong> và <strong>giá trị</strong> — không cần biết JSON. Trang khách sẽ hiển thị giống bảng thông số.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        specSections: [...p.specSections, newSpecSection('', [newSpecRow()])],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    <span className="material-icons text-[16px]">add</span>
                    Thêm nhóm trống
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-2">Thêm nhanh nhóm gợi ý</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPEC_SUGGESTIONS.map((s) => (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          specSections: [...p.specSections, newSpecSection(s.title, s.rows)],
                        }))
                      }
                      className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      + {s.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                {form.specSections.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Chưa có thông số. Chọn gợi ý phía trên hoặc bấm &quot;Thêm nhóm trống&quot;.
                  </p>
                ) : (
                  form.specSections.map((sec, secIdx) => (
                    <div
                      key={sec.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide shrink-0">
                          Nhóm {secIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((p) => {
                              const next = [...p.specSections];
                              next[secIdx] = { ...next[secIdx], title: v };
                              return { ...p, specSections: next };
                            });
                          }}
                          placeholder="Tên nhóm, VD: Màn hình, Camera sau..."
                          className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              specSections: p.specSections.filter((s) => s.id !== sec.id),
                            }))
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
                        >
                          <span className="material-icons text-[16px]">delete_outline</span>
                          Xóa nhóm
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase">
                              <th className="px-3 py-2 w-[35%]">Tên thông số</th>
                              <th className="px-3 py-2">Giá trị (VD: 6.7 inch, OLED)</th>
                              <th className="px-3 py-2 w-10" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sec.rows.map((row, rowIdx) => (
                              <tr key={row.id} className="bg-white">
                                <td className="px-3 py-2 align-top">
                                  <input
                                    type="text"
                                    value={row.label}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((p) => {
                                        const next = [...p.specSections];
                                        const rows = [...next[secIdx].rows];
                                        rows[rowIdx] = { ...rows[rowIdx], label: v };
                                        next[secIdx] = { ...next[secIdx], rows };
                                        return { ...p, specSections: next };
                                      });
                                    }}
                                    placeholder="VD: Kích thước"
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <input
                                    type="text"
                                    value={row.value}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((p) => {
                                        const next = [...p.specSections];
                                        const rows = [...next[secIdx].rows];
                                        rows[rowIdx] = { ...rows[rowIdx], value: v };
                                        next[secIdx] = { ...next[secIdx], rows };
                                        return { ...p, specSections: next };
                                      });
                                    }}
                                    placeholder="VD: 6.7 inch, Super Retina XDR"
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                                  />
                                </td>
                                <td className="px-1 py-2 align-top text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm((p) => {
                                        const next = [...p.specSections];
                                        const rows = next[secIdx].rows.filter((r) => r.id !== row.id);
                                        next[secIdx] = { ...next[secIdx], rows: rows.length > 0 ? rows : [newSpecRow()] };
                                        return { ...p, specSections: next };
                                      })
                                    }
                                    className="p-1 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                                    aria-label="Xóa dòng"
                                  >
                                    <span className="material-icons text-[18px]">close</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => {
                            const next = [...p.specSections];
                            next[secIdx] = {
                              ...next[secIdx],
                              rows: [...next[secIdx].rows, newSpecRow()],
                            };
                            return { ...p, specSections: next };
                          })
                        }
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        + Thêm dòng trong nhóm này
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Featured */}
            <div className="md:col-span-2 flex items-center gap-3">
              <input
                id="featured"
                name="featured"
                type="checkbox"
                checked={form.featured}
                onChange={handleChange}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label htmlFor="featured" className="text-sm font-semibold text-slate-700 cursor-pointer">
                Sản phẩm nổi bật (featured)
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-6 py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="material-icons animate-spin text-[18px]">refresh</span>
              ) : (
                <span className="material-icons text-[18px]">save</span>
              )}
              {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm sản phẩm'}
            </button>
          </div>
        </section>
      </form>

      {/* AI Generate Modal */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <span className="material-icons text-2xl">auto_awesome</span>
                <div>
                  <h3 className="font-bold text-base">Tạo sản phẩm bằng AI</h3>
                  <p className="text-violet-200 text-xs">Powered by Gemini</p>
                </div>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Đóng"
              >
                <span className="material-icons text-[22px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Nhập tên hoặc từ khóa sản phẩm. AI sẽ tự động điền <strong>tên, mô tả, giá đề xuất</strong> và chọn <strong>danh mục</strong> phù hợp.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Tên / Từ khóa sản phẩm
                </label>
                <input
                  ref={aiInputRef}
                  value={aiKeyword}
                  onChange={(e) => setAiKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) handleAiGenerate(); }}
                  placeholder="VD: iPhone 16 Pro Max 256GB, Tai nghe Sony WH-1000XM5..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>

              {aiError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <span className="material-icons text-[18px] flex-shrink-0 mt-0.5">error_outline</span>
                  {aiError}
                </div>
              )}

              {/* Examples */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Gợi ý nhanh</p>
                <div className="flex flex-wrap gap-2">
                  {['iPhone 16 Pro', 'Samsung Galaxy S25', 'AirPods Pro 2', 'iPad Pro M4', 'Sony WH-1000XM5', 'MacBook Air M3'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAiKeyword(s)}
                      className="px-3 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiKeyword.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <span className="material-icons text-[16px] animate-spin">refresh</span>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-[16px]">auto_awesome</span>
                    Tạo ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFormPage;
