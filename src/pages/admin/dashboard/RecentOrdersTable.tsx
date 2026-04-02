import React from 'react';
import { Link } from 'react-router-dom';
import type { AdminDashboardSummaryDto } from '@/types/api';

type Props = {
  rows: AdminDashboardSummaryDto['recentOrders'];
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

const RecentOrdersTable: React.FC<Props> = ({ rows }) => {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 mb-4">Đơn hàng gần đây</h2>
      <div className="overflow-x-auto -mx-1">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
              <th className="py-3 px-3">Mã</th>
              <th className="py-3 px-3">Khách</th>
              <th className="py-3 px-3">Tổng</th>
              <th className="py-3 px-3">Trạng thái</th>
              <th className="py-3 px-3">Thời gian</th>
              <th className="py-3 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Chưa có đơn hàng.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-slate-900">
                  <td className="py-3 px-3 font-mono font-semibold">#{r.id}</td>
                  <td className="py-3 px-3">{r.customerName ?? '—'}</td>
                  <td className="py-3 px-3 tabular-nums">{formatMoney(r.totalPrice)}</td>
                  <td className="py-3 px-3 capitalize">{r.status ?? '—'}</td>
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      to={`/admin/orders/${r.id}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrdersTable;
