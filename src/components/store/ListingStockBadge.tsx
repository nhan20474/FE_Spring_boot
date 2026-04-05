import React from 'react';

export interface ListingStockBadgeProps {
  /** `undefined` → coi như còn hàng (tương thích mock / dữ liệu cũ) */
  inStock?: boolean;
  className?: string;
}

/**
 * Badge trạng thái tồn kho cho card listing (hướng 1: chỉ Còn hàng / Hết hàng).
 */
const ListingStockBadge: React.FC<ListingStockBadgeProps> = ({ inStock, className = '' }) => {
  const available = inStock !== false;
  return (
    <span
      role="status"
      aria-label={available ? 'Còn hàng' : 'Hết hàng'}
      className={`inline-flex items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
        available
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
      } ${className}`}
    >
      {available ? 'Còn hàng' : 'Hết hàng'}
    </span>
  );
};

export default ListingStockBadge;
