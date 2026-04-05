import React, { useEffect, useState } from 'react';
import { PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from '../orderListMock';

type PaymentMethodFilterPopoverProps = {
  initialPaymentMethods: Set<PaymentMethodOption>;
  onApply: (paymentMethods: Set<PaymentMethodOption>) => void;
  onClose: () => void;
};

const PaymentMethodFilterPopover: React.FC<PaymentMethodFilterPopoverProps> = ({ initialPaymentMethods, onApply, onClose }) => {
  const [draft, setDraft] = useState<Set<PaymentMethodOption>>(() => new Set(initialPaymentMethods));

  useEffect(() => {
    setDraft(new Set(initialPaymentMethods));
  }, [initialPaymentMethods]);

  const toggle = (t: PaymentMethodOption) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const getLabel = (opt: PaymentMethodOption) => {
    switch (opt) {
      case 'vnpay': return 'VNPay';
      case 'cash_on_delivery': return 'COD';
      case 'momo': return 'MoMo';
      default: return opt;
    }
  };

  return (
    <div
      className="absolute left-0 top-full z-40 mt-2 w-[min(100vw-2rem,380px)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
      role="dialog"
      aria-label="Chọn phương thức thanh toán"
    >
      <div className="text-sm font-bold text-slate-900 mb-3">Thanh toán</div>
      <div className="flex flex-wrap gap-2">
        {PAYMENT_METHOD_OPTIONS.map((opt) => {
          const on = draft.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${on
                  ? 'border-[#4880FF] bg-[#4880FF] text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
            >
              {getLabel(opt)}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500 italic">*Bạn có thể chọn nhiều phương thức thanh toán</p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(new Set(draft));
            onClose();
          }}
          className="px-6 py-2 text-sm font-semibold text-white bg-[#4880FF] hover:bg-blue-600 rounded-lg"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
};

export default PaymentMethodFilterPopover;
