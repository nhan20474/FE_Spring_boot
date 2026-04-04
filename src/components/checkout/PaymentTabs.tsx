import React from 'react';

export type PaymentMethodType =
  | 'cash_on_delivery'
  | 'vnpay';

interface PaymentTabsProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
}

const PaymentTabs: React.FC<PaymentTabsProps> = ({ selectedMethod, onSelectMethod }) => {
  const tabs = [
    { id: 'vnpay' as PaymentMethodType, label: 'VNPay' },
    { id: 'cash_on_delivery' as PaymentMethodType, label: 'Cash on Delivery' },
  ];

  return (
    <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelectMethod(tab.id)}
          className={`pb-3 px-4 font-semibold text-sm transition-colors ${
            selectedMethod === tab.id
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default PaymentTabs;

