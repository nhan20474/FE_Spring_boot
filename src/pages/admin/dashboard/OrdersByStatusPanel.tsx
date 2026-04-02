import React from 'react';

type Props = {
  ordersByStatus: Record<string, number>;
};

const OrdersByStatusPanel: React.FC<Props> = ({ ordersByStatus }) => {
  const entries = Object.entries(ordersByStatus).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 mb-4">Đơn theo trạng thái</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map(([status, count]) => (
            <li key={status}>
              <div className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                <span className="capitalize">{status}</span>
                <span className="tabular-nums">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/80 transition-all"
                  style={{ width: `${Math.round((count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OrdersByStatusPanel;
