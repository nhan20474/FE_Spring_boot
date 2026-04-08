import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminOrderRow } from '../orderListMock';
import { formatOrderDate } from '../orderListUtils';
import OrderStatusBadge from './OrderStatusBadge';
import { downloadAdminOrderInvoicePdf } from '@/services/backend';
import { ApiError } from '@/services/api';

type OrderTableProps = {
  rows: AdminOrderRow[];
};

const OrderTable: React.FC<OrderTableProps> = ({ rows }) => {
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
            <th className="py-4 px-4">Mã</th>
            <th className="py-4 px-4">Khách hàng</th>
            <th className="py-4 px-4">Địa chỉ</th>
            <th className="py-4 px-4">Ngày đặt</th>
            <th className="py-4 px-4">Thanh toán</th>
            <th className="py-4 px-4">Trạng thái</th>
            <th className="py-4 px-4 text-right">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 px-4 text-center text-sm font-semibold text-slate-500">
                Không có đơn hàng phù hợp với bộ lọc hiện tại.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="text-sm text-slate-900">
                <td className="py-4 px-4 font-semibold tabular-nums">{row.id}</td>
                <td className="py-4 px-4 font-medium">{row.name}</td>
                <td className="py-4 px-4 text-slate-700">{row.address}</td>
                <td className="py-4 px-4 text-slate-700 whitespace-nowrap">{formatOrderDate(row.date)}</td>
                <td className="py-4 px-4 text-slate-700">
                  {row.paymentMethod === 'vnpay' ? 'VNPay' :
                    row.paymentMethod === 'cash_on_delivery' ? 'COD' :
                      row.paymentMethod === 'momo' ? 'MoMo' :
                        row.paymentMethod || '—'}
                </td>
                <td className="py-4 px-4">
                  <OrderStatusBadge status={row.status} />
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      to={`/admin/orders/${row.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span className="material-icons text-[16px]">visibility</span>
                      Xem
                    </Link>
                    <Link
                      to={`/admin/orders/invoice?orderId=${encodeURIComponent(row.id)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span className="material-icons text-[16px]">receipt_long</span>
                      Xem hóa đơn
                    </Link>
                    <button
                      type="button"
                      disabled={pdfLoadingId === row.id}
                      onClick={() => {
                        void (async () => {
                          setPdfLoadingId(row.id);
                          try {
                            await downloadAdminOrderInvoicePdf(row.id);
                          } catch (e) {
                            window.alert(e instanceof ApiError ? e.message : 'Không tải được PDF.');
                          } finally {
                            setPdfLoadingId(null);
                          }
                        })();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className="material-icons text-[16px]">picture_as_pdf</span>
                      {pdfLoadingId === row.id ? 'Đang tải…' : 'Tải PDF'}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;
