import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getOrder, getAddresses } from '@/services/backend';
import { formatVND } from '@/utils';
import { addressDtoToSaved } from '@/services/addressMapper';
import type { OrderDto } from '@/types/api';

const OrderInvoicePage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const autoprint = searchParams.get('autoprint') === '1';

  const [dto, setDto] = useState<OrderDto | null>(null);
  const [buyerBlock, setBuyerBlock] = useState<string>('—');

  useEffect(() => {
    if (!orderId) return;
    void (async () => {
      try {
        const o = await getOrder(orderId);
        setDto(o);
        if (o.shippingAddressId != null) {
          try {
            const list = await getAddresses();
            const hit = list.find((a) => Number(a.id) === Number(o.shippingAddressId));
            if (hit) {
              const s = addressDtoToSaved(hit);
              const lines = [s.street, s.apartment, s.city, s.state, s.zipCode, s.country].filter(Boolean);
              setBuyerBlock([s.name, ...lines, s.phone ? `ĐT: ${s.phone}` : ''].filter(Boolean).join('\n'));
            }
          } catch {
            setBuyerBlock('—');
          }
        } else {
          setBuyerBlock('—');
        }
      } catch {
        setDto(null);
      }
    })();
  }, [orderId]);

  useEffect(() => {
    if (!autoprint) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoprint]);

  const rows = useMemo(() => {
    if (!dto?.items?.length) return [];
    return dto.items.map((it, idx) => {
      const line = it.lineTotal ?? it.quantity * it.priceAtOrder;
      const variant = [it.selectedColor, it.selectedStorage].filter(Boolean).join(' · ');
      const desc = variant ? `${it.productName} (${variant})` : it.productName;
      return { id: idx + 1, desc, qty: it.quantity, unit: it.priceAtOrder, line };
    });
  }, [dto]);

  const subtotal = dto?.subtotal != null ? Number(dto.subtotal) : rows.reduce((s, r) => s + r.line, 0);
  const discount = dto?.discountAmount != null ? Number(dto.discountAmount) : 0;
  const ship = dto?.shippingCost != null ? Number(dto.shippingCost) : 0;
  const total = dto?.totalPrice != null ? Number(dto.totalPrice) : subtotal - discount + ship;

  if (!orderId) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-slate-600 text-sm">Thiếu mã đơn.</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hóa đơn bán hàng</h1>
            <p className="text-sm text-slate-500 mt-1">
              Mã đơn: <span className="font-mono text-slate-800">{orderId}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/order/${encodeURIComponent(orderId)}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span className="material-icons text-lg">arrow_back</span>
              Chi tiết đơn
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              <span className="material-icons text-lg">print</span>
              In / PDF
            </button>
          </div>
        </div>

        {!dto ? (
          <p className="text-sm text-slate-500">Đang tải hoặc không có quyền xem đơn này.</p>
        ) : (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8 print:border-0 print:shadow-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Bên bán</p>
                <p className="font-bold text-slate-900 mt-1">TechHome</p>
                <p className="text-slate-600 mt-0.5">Cửa hàng điện thoại / điện tử</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Bên mua</p>
                <p className="text-slate-800 mt-1 whitespace-pre-line">{buyerBlock}</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-100/90 text-left">
                    <th className="px-3 py-2 rounded-l-lg font-semibold text-slate-600">#</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Mặt hàng</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">SL</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Đơn giá</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 rounded-r-lg">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 text-slate-500">{r.id}</td>
                      <td className="px-3 py-3 text-slate-900">{r.desc}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.qty}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatVND(r.unit)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{formatVND(r.line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-2 text-sm max-w-xs ml-auto">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Tạm tính</span>
                <span className="font-medium tabular-nums">{formatVND(subtotal)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Giảm giá{dto.couponCode ? ` (${dto.couponCode})` : ''}</span>
                  <span className="font-medium tabular-nums text-emerald-700">−{formatVND(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Phí vận chuyển</span>
                <span className="font-medium tabular-nums">{ship === 0 ? 'Miễn phí' : formatVND(ship)}</span>
              </div>
              <div className="flex justify-between gap-4 pt-2 border-t border-slate-200 text-base">
                <span className="font-bold">Tổng thanh toán</span>
                <span className="font-bold text-primary tabular-nums">{formatVND(total)}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default OrderInvoicePage;
