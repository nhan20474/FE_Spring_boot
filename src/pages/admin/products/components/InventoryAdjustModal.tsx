import React, { useEffect, useState } from 'react';
import * as backend from '@/services/backend';
import type { InventoryStockDto } from '@/services/backend';
import type { StockProduct } from '../productStockMock';
type InventoryAdjustModalProps = {
  product: StockProduct | null;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
};

const InventoryAdjustModal: React.FC<InventoryAdjustModalProps> = ({ product, open, onClose, onApplied }) => {
  const [detail, setDetail] = useState<InventoryStockDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reserveQty, setReserveQty] = useState('');
  const [soldQty, setSoldQty] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !product) {
      setDetail(null);
      setError(null);
      setReserveQty('');
      setSoldQty('');
      return;
    }
    setLoading(true);
    setError(null);
    backend
      .adminGetInventoryStock(product.id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được tồn kho chi tiết'))
      .finally(() => setLoading(false));
  }, [open, product]);

  const pid = product ? Number(product.id) : 0;

  const runReserve = async () => {
    const q = Number(reserveQty);
    if (!product || !Number.isFinite(q) || q <= 0) {
      setError('Số lượng reserve phải > 0');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await backend.adminInventoryReserve({
        productId: pid,
        quantity: Math.floor(q),
        idempotencyKey: crypto.randomUUID(),
      });
      setDetail(next);
      setReserveQty('');
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reserve thất bại');
    } finally {
      setBusy(false);
    }
  };

  const runSold = async () => {
    const q = Number(soldQty);
    if (!product || !Number.isFinite(q) || q <= 0) {
      setError('Số lượng sold phải > 0');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await backend.adminInventorySold({
        productId: pid,
        quantity: Math.floor(q),
        idempotencyKey: crypto.randomUUID(),
      });
      setDetail(next);
      setSoldQty('');
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ghi nhận sold thất bại');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tồn kho chi tiết</h2>
            {product && <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{product.name}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && detail && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Tồn (stock)</span>
                <span className="font-bold tabular-nums">{detail.stock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Đang giữ (reserved)</span>
                <span className="font-bold tabular-nums text-amber-700">{detail.reservedStock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Khả dụng</span>
                <span className="font-bold tabular-nums text-emerald-700">{detail.availableStock}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Reserve thêm (giữ hàng)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={reserveQty}
                onChange={(e) => setReserveQty(e.target.value)}
                placeholder="Số lượng"
              />
              <button
                type="button"
                disabled={busy || !product}
                onClick={() => void runReserve()}
                className="shrink-0 rounded-lg bg-amber-600 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                Reserve
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Ghi nhận đã bán (sold)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={soldQty}
                onChange={(e) => setSoldQty(e.target.value)}
                placeholder="Số lượng"
              />
              <button
                type="button"
                disabled={busy || !product}
                onClick={() => void runSold()}
                className="shrink-0 rounded-lg bg-slate-800 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                Sold
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Mỗi lần bấm gửi kèm <code className="bg-slate-100 px-1 rounded">idempotencyKey</code> mới (theo contract backend).
            Điều chỉnh nhanh tồn tổng vẫn dùng nút sửa trên bảng (add/remove).
          </p>
        </div>
      </div>
    </div>
  );
};

export default InventoryAdjustModal;
