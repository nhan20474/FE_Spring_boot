import React, { useCallback, useEffect, useState } from 'react';
import * as backend from '@/services/backend';
import type { CouponDto } from '@/types/api';
import { ApiError } from '@/services/api';

const CouponListPage: React.FC = () => {
  const [items, setItems] = useState<CouponDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void backend
      .adminListCoupons()
      .then((list) => {
        setItems(list);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Lỗi tải'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const dv = Number(discountValue);
    if (!code.trim() || !Number.isFinite(dv) || dv < 0) {
      setError('Nhập mã và giá trị giảm hợp lệ');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await backend.adminCreateCoupon({
        code: code.trim(),
        discountType,
        discountValue: dv,
        minOrderAmount: minOrder.trim() ? Number(minOrder) : undefined,
        active: true,
      });
      setCode('');
      setDiscountValue('');
      setMinOrder('');
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Tạo thất bại';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: number) => {
    if (!window.confirm('Ngừng kích hoạt coupon này?')) return;
    try {
      await backend.adminDeactivateCoupon(id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Coupon / Voucher</h1>
        <p className="text-sm text-slate-600 mt-1">Quản lý mã giảm giá — đồng bộ với checkout quote.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Tạo coupon mới</h2>
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Mã</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="SALE10"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Loại</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="percent">Phần trăm</option>
              <option value="fixed">Số tiền cố định</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Giá trị</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={discountType === 'percent' ? '10' : '50000'}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Đơn tối thiểu (tuỳ chọn)</span>
            <input
              type="number"
              min="0"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="0"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary text-white font-semibold px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {saving ? 'Đang tạo…' : 'Tạo coupon'}
            </button>
          </div>
        </form>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Danh sách</h2>
          <button type="button" onClick={() => void load()} className="text-sm text-primary font-medium">
            Tải lại
          </button>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500">Đang tải…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Giá trị</th>
                  <th className="px-4 py-3">Tối thiểu</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                    <td className="px-4 py-3">{c.discountType}</td>
                    <td className="px-4 py-3 tabular-nums">{c.discountValue}</td>
                    <td className="px-4 py-3 tabular-nums">{c.minOrderAmount ?? '—'}</td>
                    <td className="px-4 py-3">{c.active ? 'Hoạt động' : 'Đã tắt'}</td>
                    <td className="px-4 py-3 text-right">
                      {c.active && (
                        <button
                          type="button"
                          onClick={() => void deactivate(c.id)}
                          className="text-amber-700 font-medium hover:underline"
                        >
                          Ngừng kích hoạt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-6 text-slate-500">Chưa có coupon.</p>}
          </div>
        )}
      </section>
    </div>
  );
};

export default CouponListPage;
