import React, { useEffect, useState } from 'react';
import StatCard from './dashboard/StatCard';
import RecentOrdersTable from './dashboard/RecentOrdersTable';
import OrdersByStatusPanel from './dashboard/OrdersByStatusPanel';
import type { KpiStat } from './dashboard/dashboardTypes';
import type { AdminDashboardSummaryDto } from '@/types/api';
import * as backend from '@/services/backend';

const STAT_TEMPLATES: Omit<KpiStat, 'value' | 'trendLabel' | 'trend'>[] = [
  { id: 'products', label: 'Sản phẩm', icon: 'inventory_2', iconWrapClass: 'bg-amber-100 text-amber-700' },
  { id: 'users', label: 'Người dùng', icon: 'person', iconWrapClass: 'bg-violet-100 text-violet-700' },
  { id: 'orders', label: 'Đơn hàng', icon: 'receipt_long', iconWrapClass: 'bg-emerald-100 text-emerald-700' },
  { id: 'categories', label: 'Danh mục', icon: 'category', iconWrapClass: 'bg-blue-100 text-blue-700' },
];

const emptySummary: AdminDashboardSummaryDto = {
  revenue: 0,
  ordersByStatus: {},
  recentOrders: [],
};

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<KpiStat[]>(
    STAT_TEMPLATES.map((t) => ({ ...t, value: '—', trendLabel: 'Đang tải...', trend: 'up' as const })),
  );
  const [summary, setSummary] = useState<AdminDashboardSummaryDto>(emptySummary);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, dash] = await Promise.all([backend.adminGetStats(), backend.adminGetDashboardSummary(12)]);
        if (cancelled) return;
        setStats([
          { ...STAT_TEMPLATES[0], value: s.totalProducts.toLocaleString('vi-VN'), trendLabel: 'Tổng sản phẩm trong kho', trend: 'up' },
          { ...STAT_TEMPLATES[1], value: s.totalUsers.toLocaleString('vi-VN'), trendLabel: 'Tổng tài khoản đã đăng ký', trend: 'up' },
          { ...STAT_TEMPLATES[2], value: s.totalOrders.toLocaleString('vi-VN'), trendLabel: 'Tổng đơn hàng đã đặt', trend: 'up' },
          { ...STAT_TEMPLATES[3], value: s.totalCategories.toLocaleString('vi-VN'), trendLabel: 'Tổng danh mục sản phẩm', trend: 'up' },
        ]);
        setSummary(dash);
        setLoadError(null);
      } catch {
        if (!cancelled) setLoadError('Không tải được dữ liệu dashboard. Kiểm tra đăng nhập admin và backend.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const revenueLabel = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(summary.revenue);

  return (
    <div className="space-y-6 text-base max-w-[1600px]">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        {loadError && <p className="mt-2 text-sm text-amber-700">{loadError}</p>}
      </header>

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key performance indicators">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doanh thu (ước tính từ đơn)</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{revenueLabel}</p>
          <p className="mt-2 text-xs text-slate-500">Theo logic backend: paid, shipping, completed, returned, refunded.</p>
        </div>
        <div className="lg:col-span-2">
          <OrdersByStatusPanel ordersByStatus={summary.ordersByStatus} />
        </div>
      </section>

      <section aria-label="Recent orders">
        <RecentOrdersTable rows={summary.recentOrders} />
      </section>
    </div>
  );
};

export default DashboardPage;
