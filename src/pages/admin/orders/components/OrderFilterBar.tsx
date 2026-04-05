import React, { useEffect, useRef } from 'react';
import type { OrderStatus, PaymentMethodOption } from '../orderListMock';
import { formatOrderDate } from '../orderListUtils';
import DateFilterPopover from './DateFilterPopover';
import StatusFilterPopover from './StatusFilterPopover';
import PaymentMethodFilterPopover from './PaymentMethodFilterPopover';

export type FilterPanel = 'date' | 'paymentMethod' | 'status' | null;

type OrderFilterBarProps = {
  openPanel: FilterPanel;
  setOpenPanel: (p: FilterPanel) => void;
  appliedDates: Date[];
  onApplyDates: (dates: Date[]) => void;
  appliedPaymentMethods: Set<PaymentMethodOption>;
  onApplyPaymentMethods: (methods: Set<PaymentMethodOption>) => void;
  appliedStatuses: Set<OrderStatus>;
  onApplyStatuses: (statuses: Set<OrderStatus>) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onReset: () => void;
};

function dateTriggerLabel(dates: Date[]): string {
  if (dates.length === 0) return 'Ngày';
  if (dates.length === 1) return formatOrderDate(dates[0]);
  return `${dates.length} ngày`;
}

function paymentMethodTriggerLabel(methods: Set<PaymentMethodOption>): string {
  if (methods.size === 0) return 'Thanh toán';
  if (methods.size === 1) {
    const opt = [...methods][0];
    switch (opt) {
      case 'vnpay': return 'VNPay';
      case 'cash_on_delivery': return 'COD';
      case 'momo': return 'MoMo';
      case 'stripe': return 'Stripe';
      case 'paypal': return 'PayPal';
      default: return opt;
    }
  }
  return `${methods.size} PTĐTT`;
}

function statusTriggerLabel(statuses: Set<OrderStatus>): string {
  if (statuses.size === 0) return 'Trạng thái đơn';
  if (statuses.size === 1) return [...statuses][0];
  return `${statuses.size} trạng thái`;
}

const OrderFilterBar: React.FC<OrderFilterBarProps> = ({
  openPanel,
  setOpenPanel,
  appliedDates,
  onApplyDates,
  appliedPaymentMethods,
  onApplyPaymentMethods,
  appliedStatuses,
  onApplyStatuses,
  searchQuery,
  setSearchQuery,
  onReset,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPanel) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openPanel, setOpenPanel]);

  const toggle = (p: Exclude<FilterPanel, null>) => {
    setOpenPanel(openPanel === p ? null : p);
  };

  return (
    <div
      ref={rootRef}
      className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-stretch"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100">
        <span className="material-icons text-slate-500 text-[22px]">search</span>
      </div>
      
      <div className="flex items-center px-4 py-3 border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100 flex-grow min-w-[200px]">
        <input 
          type="text" 
          placeholder="Tìm ID đơn hàng / Tên khách hàng" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
        />
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100">
        <span className="material-icons text-slate-500 text-[22px]">filter_alt</span>
      </div>

      <div className="flex items-center px-4 py-3 text-sm font-semibold text-slate-700 border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100">
        Lọc theo
      </div>

      <div className="relative flex-1 min-w-[140px] border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100">
        <button
          type="button"
          onClick={() => toggle('date')}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50/80 transition-colors"
        >
          <span className="truncate">{dateTriggerLabel(appliedDates)}</span>
          <span className="material-icons text-slate-400 text-xl shrink-0">expand_more</span>
        </button>
        {openPanel === 'date' && (
          <DateFilterPopover
            initialDates={appliedDates}
            onApply={onApplyDates}
            onClose={() => setOpenPanel(null)}
          />
        )}
      </div>

      <div className="relative flex-1 min-w-[140px] border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100">
        <button
          type="button"
          onClick={() => toggle('paymentMethod')}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50/80 transition-colors"
        >
          <span className="truncate text-left">{paymentMethodTriggerLabel(appliedPaymentMethods)}</span>
          <span className="material-icons text-slate-400 text-xl shrink-0">expand_more</span>
        </button>
        {openPanel === 'paymentMethod' && (
          <PaymentMethodFilterPopover
            initialPaymentMethods={appliedPaymentMethods}
            onApply={onApplyPaymentMethods}
            onClose={() => setOpenPanel(null)}
          />
        )}
      </div>

      <div className="relative flex-1 min-w-[140px] border-b border-slate-100 sm:border-b-0 sm:border-r border-slate-100">
        <button
          type="button"
          onClick={() => toggle('status')}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50/80 transition-colors"
        >
          <span className="truncate text-left">{statusTriggerLabel(appliedStatuses)}</span>
          <span className="material-icons text-slate-400 text-xl shrink-0">expand_more</span>
        </button>
        {openPanel === 'status' && (
          <StatusFilterPopover
            initialStatuses={appliedStatuses}
            onApply={onApplyStatuses}
            onClose={() => setOpenPanel(null)}
          />
        )}
      </div>

      <div className="flex items-center justify-end px-4 py-3 flex-1 min-w-[140px]">
        <button
          type="button"
          onClick={() => {
            onReset();
            setOpenPanel(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-500 hover:text-rose-600 transition-colors"
        >
          <span className="material-icons text-[20px]">refresh</span>
          Đặt lại bộ lọc
        </button>
      </div>
    </div>
  );
};

export default OrderFilterBar;
