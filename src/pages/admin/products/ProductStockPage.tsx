import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminProductsTabs from '@/components/admin/AdminProductsTabs';
import ProductStockTable from './components/ProductStockTable';
import InventoryAdjustModal from './components/InventoryAdjustModal';
import type { StockColorDot, StockProduct } from './productStockMock';
import * as backend from '@/services/backend';
import { parseProductColorsFromApi } from '@/services/productMappers';
import type { ProductDto } from '@/types/api';

function colorDotsFromApi(colorsJson: string | null | undefined): StockColorDot[] {
  const parsed = parseProductColorsFromApi(colorsJson);
  const seen = new Set<string>();
  const out: StockColorDot[] = [];
  for (const c of parsed) {
    const name = c.name?.trim();
    if (name) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const hex = (c.hex || '').trim() || '#64748b';
      out.push({ hex, name });
      continue;
    }
    const hex = c.hex.trim();
    if (!hex) continue;
    const hkey = `hex:${hex.toLowerCase()}`;
    if (seen.has(hkey)) continue;
    seen.add(hkey);
    out.push({ hex });
  }
  return out;
}

const PAGE_SIZE = 9;
const STORE_SEARCH_SIZE = 500;

function mapApiToStockProducts(list: ProductDto[]): StockProduct[] {
  return list.map((p) => ({
    id: String(p.id),
    name: p.name,
    category: p.categoryName ?? '—',
    price: Number(p.price ?? 0),
    piece: Number(p.stock ?? 0),
    colorDots: colorDotsFromApi(p.colors ?? undefined),
    image: p.image ?? 'https://picsum.photos/seed/placeholder/120/120',
  }));
}

const ProductStockPage: React.FC = () => {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inventoryProduct, setInventoryProduct] = useState<StockProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = debouncedQuery.trim();
      const list = q
        ? await backend.getProducts({
            q,
            page: 0,
            size: STORE_SEARCH_SIZE,
            sortBy: 'createdAt',
            sortDir: 'desc',
          })
        : await backend.adminGetProducts();
      setProducts(mapApiToStockProducts(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu tồn kho');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, page]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const openEdit = async (p: StockProduct) => {
    const input = window.prompt(`Nhập tồn kho mới cho "${p.name}"`, String(p.piece));
    if (input == null) return;
    const next = Number(input);
    if (!Number.isFinite(next) || next < 0) {
      window.alert('Tồn kho không hợp lệ.');
      return;
    }
    const current = p.piece;
    const diff = Math.round(next - current);
    if (diff === 0) return;
    try {
      if (diff > 0) {
        await backend.adminInventoryAdd({ productId: Number(p.id), quantity: diff });
      } else {
        await backend.adminInventoryRemove({ productId: Number(p.id), quantity: Math.abs(diff) });
      }
      await fetchProducts();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Cập nhật tồn kho thất bại');
    }
  };

  const handleDelete = async (p: StockProduct) => {
    if (!window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    try {
      await backend.adminDeleteProduct(p.id);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Xóa sản phẩm thất bại');
    }
  };

  const startIdx = products.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIdx = products.length === 0 ? 0 : Math.min(page * PAGE_SIZE, products.length);

  return (
    <div className="space-y-6">
      <AdminProductsTabs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[32px] leading-[44px] font-normal tracking-tight text-[#202224]">Quản lý tồn kho sản phẩm</h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">Quản lý tồn kho sản phẩm</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-72">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
              search
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên hoặc mô tả"
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Link
            to="/admin/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors shrink-0"
          >
            <span className="material-icons text-[18px]">add</span>
            Thêm sản phẩm
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <span className="material-icons text-[20px]">error_outline</span>
          {error}
          <button onClick={() => void fetchProducts()} className="ml-auto text-red-600 underline font-semibold">Thử lại</button>
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 md:p-6">
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm font-semibold">Đang tải tồn kho...</div>
          ) : (
            <ProductStockTable
              rows={pageRows}
              onEdit={openEdit}
              onDelete={handleDelete}
              onInventoryDetail={(p) => setInventoryProduct(p)}
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 md:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-sm font-medium text-slate-500">
            {products.length === 0
              ? 'Hiển thị 0 trên 0'
              : `Hiển thị ${String(startIdx).padStart(2, '0')}-${String(endIdx).padStart(2, '0')} trên ${products.length}`}
          </p>
          <div className="flex items-center justify-end gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 bg-white min-w-[36px] h-9 inline-flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Trang trước"
            >
              <span className="material-icons text-lg">chevron_left</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 bg-white min-w-[36px] h-9 inline-flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Trang sau"
            >
              <span className="material-icons text-lg">chevron_right</span>
            </button>
          </div>
        </div>
      </section>

      <InventoryAdjustModal
        open={inventoryProduct != null}
        product={inventoryProduct}
        onClose={() => setInventoryProduct(null)}
        onApplied={() => void fetchProducts()}
      />
    </div>
  );
};

export default ProductStockPage;
