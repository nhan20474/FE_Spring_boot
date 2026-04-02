import React, { useEffect, useMemo, useState } from 'react';
import { useCheckout } from '@/context/CheckoutContext';
import { formatVND, shippingCostForNetMerchandiseVnd } from '@/utils';
import { getToken, isApiConfigured } from '@/services/api';
import { checkoutQuote } from '@/services/backend';

const CheckoutSummary: React.FC = () => {
  const { checkoutData, updateCheckoutData } = useCheckout();
  const { items } = checkoutData;
  const [couponInput, setCouponInput] = useState(checkoutData.couponCode ?? '');
  const [quoting, setQuoting] = useState(false);

  const localSubtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  const subtotal = checkoutData.quoteSubtotal ?? localSubtotal;
  const discount = checkoutData.quoteDiscountAmount ?? 0;
  const netAfterDiscount = Math.max(0, subtotal - discount);
  const shippingFallback = shippingCostForNetMerchandiseVnd(netAfterDiscount);
  const shipping = checkoutData.quoteShippingCost ?? shippingFallback;
  const total = checkoutData.quoteTotalPrice ?? Math.max(0, subtotal - discount + shippingFallback);

  const normalizedItems = useMemo(
    () =>
      items.map((i) => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity),
        price: Number(i.price),
      })),
    [items]
  );
  const quoteItemsKey = useMemo(
    () => normalizedItems.map((i) => `${i.productId}:${i.quantity}:${i.price}`).join('|'),
    [normalizedItems]
  );

  const refreshQuote = async (couponCode?: string) => {
    if (!isApiConfigured() || !getToken() || normalizedItems.length === 0) {
      const ship = shippingCostForNetMerchandiseVnd(localSubtotal);
      updateCheckoutData({
        quoteSubtotal: localSubtotal,
        quoteDiscountAmount: 0,
        quoteShippingCost: ship,
        quoteTotalPrice: Math.max(0, localSubtotal + ship),
        quoteCouponApplied: false,
        quoteCouponMessage: '',
      });
      return;
    }
    setQuoting(true);
    try {
      const q = await checkoutQuote({
        items: normalizedItems,
        couponCode: (couponCode ?? checkoutData.couponCode) || undefined,
      });
      updateCheckoutData({
        quoteSubtotal: Number(q.subtotal ?? 0),
        quoteDiscountAmount: Number(q.discountAmount ?? 0),
        quoteShippingCost: Number(q.shippingCost ?? shippingCostForNetMerchandiseVnd(localSubtotal)),
        quoteTotalPrice: Number(q.totalPrice ?? 0),
        couponCode: q.couponCode ?? (couponCode ?? checkoutData.couponCode),
        quoteCouponApplied: Boolean(q.couponApplied),
        quoteCouponMessage: q.couponMessage ?? '',
      });
    } finally {
      setQuoting(false);
    }
  };

  useEffect(() => {
    void refreshQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSubtotal, quoteItemsKey]);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    updateCheckoutData({ couponCode: code });
    await refreshQuote(code || undefined);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sticky top-24">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Tóm tắt</h3>

      {/* Selected Products */}
      <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Sản phẩm đã chọn</h4>
        <div className="space-y-3">
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {item.name}
                </p>
                <p className="text-xs text-slate-500">
                  SL: {item.quantity} × {formatVND(item.price)}
                </p>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {formatVND(item.price * item.quantity)}
              </div>
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-xs text-slate-500 text-center">
              +{items.length - 3} more item(s)
            </p>
          )}
        </div>
      </div>

      {/* Shipment Info */}
      {checkoutData.selectedAddress && (
        <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Thông tin giao hàng
          </h4>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div>
              <span className="font-medium">Địa chỉ:</span>
              <p className="mt-1">
                {checkoutData.selectedAddress.addressLines[0]}
                {checkoutData.selectedAddress.addressLines.length > 1 && (
                  <span className="block">
                    {checkoutData.selectedAddress.addressLines.slice(1).join(', ')}
                  </span>
                )}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Giao hàng tiêu chuẩn — miễn phí vận chuyển đơn từ 500.000đ (sau giảm giá).
            </p>
          </div>
        </div>
      )}

      {/* Price Info */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-500 mb-2">Mã giảm giá</label>
        <div className="flex gap-2">
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            placeholder="Nhập coupon"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => void applyCoupon()}
            disabled={quoting}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
          >
            {quoting ? 'Đang áp...' : 'Áp dụng'}
          </button>
        </div>
        {checkoutData.quoteCouponMessage && (
          <p className={`mt-2 text-xs ${checkoutData.quoteCouponApplied ? 'text-emerald-600' : 'text-amber-600'}`}>
            {checkoutData.quoteCouponMessage}
          </p>
        )}
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Tạm tính</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatVND(subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Giảm giá</span>
          <span className="font-semibold text-emerald-600">-{formatVND(discount)}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Phí vận chuyển</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {shipping === 0 ? 'MIỄN PHÍ' : formatVND(shipping)}
          </span>
        </div>
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <span className="text-lg font-bold text-slate-900 dark:text-white">Tổng</span>
          <span className="text-2xl font-black text-primary">{formatVND(total)}</span>
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Giá đã bao gồm thuế GTGT (VAT) theo quy định.
        </p>
      </div>
    </div>
  );
};

export default CheckoutSummary;

