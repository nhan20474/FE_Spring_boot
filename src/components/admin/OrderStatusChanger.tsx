import React, { useEffect, useMemo, useState } from 'react';

export type OrderBackendStatusOption = { value: string; label: string };

type OrderStatusChangerProps = {
  isOpen: boolean;
  options: OrderBackendStatusOption[];
  currentValue: string;
  onClose: () => void;
  onApply: (nextBackendValue: string) => void;
};

export default function OrderStatusChanger({
  isOpen,
  options,
  currentValue,
  onClose,
  onApply,
}: OrderStatusChangerProps) {
  const [selected, setSelected] = useState(currentValue);

  useEffect(() => {
    if (isOpen) setSelected(currentValue);
  }, [isOpen, currentValue]);

  const title = useMemo(() => 'Chọn trạng thái đơn (backend)', []);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="admin-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="admin-modal-title">{title}</div>
        <p className="text-[11px] text-slate-500 mb-3">
          Chỉ các chuyển trạng thái hợp lệ mới được API chấp nhận (theo quy trình đơn).
        </p>

        <div className="admin-chip-grid max-h-[50vh] overflow-y-auto">
          {options.map((opt) => {
            const active = opt.value === selected;
            return (
              <button
                key={opt.value}
                type="button"
                className={`admin-chip${active ? ' active' : ''}`}
                onClick={() => setSelected(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="admin-modal-actions">
          <button className="admin-btn secondary" type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="admin-btn" type="button" onClick={() => onApply(selected)}>
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
