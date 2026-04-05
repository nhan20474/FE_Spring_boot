import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckout } from '@/context/CheckoutContext';
import { useAuth } from '@/context/AuthContext';
import { checkoutQuote, createOrder, createVnpayPayment } from '@/services/backend';
import { isApiConfigured } from '@/services/api';
import { ApiError } from '@/services/api';
import { useCart } from '@/context/CartContext';
import { toCheckoutLineItems } from '@/utils/checkoutLineItems';
import PaymentTabs, { type PaymentMethodType } from './PaymentTabs';

import CheckoutSummary from './CheckoutSummary';

interface CheckoutStep3Props {
  onBack: () => void;
}

const CheckoutStep3: React.FC<CheckoutStep3Props> = ({ onBack }) => {
  const navigate = useNavigate();
  const { checkoutData, updateCheckoutData } = useCheckout();
  const { isAuthenticated } = useAuth();
  const { clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('vnpay');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderError, setOrderError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!agreeToTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    if (placingRef.current) return;
    setOrderError(null);
    updateCheckoutData({
      paymentMethod: {
        type: paymentMethod,
      },
      agreeToTerms: true,
    });

    const { items } = checkoutData;
    const useBackend = isApiConfigured() && isAuthenticated && items.length > 0;
    const lineItems = toCheckoutLineItems(items);

    if (useBackend) {
      const { selectedAddress } = checkoutData;
      const shippingAddressId = selectedAddress ? Number(selectedAddress.id) : undefined;
      if (selectedAddress && shippingAddressId != null && Number.isNaN(shippingAddressId)) {
        setOrderError('Địa chỉ giao hàng không hợp lệ. Vui lòng chọn lại địa chỉ.');
        return;
      }

      const validItems = lineItems.every(
        (i) => Number.isFinite(i.productId) && i.productId > 0 && Number.isFinite(i.quantity) && i.quantity >= 1,
      );
      if (!validItems) {
        setOrderError('Giỏ hàng đang có dữ liệu không hợp lệ để tạo đơn. Vui lòng thêm lại sản phẩm từ danh sách.');
        return;
      }

      placingRef.current = true;
      setPlacing(true);
      try {
        const couponForQuote =
          checkoutData.quoteCouponApplied && checkoutData.couponCode.trim()
            ? checkoutData.couponCode.trim()
            : undefined;
        const fresh = await checkoutQuote({
          items: lineItems,
          couponCode: couponForQuote,
        });
        const subtotal = Number(fresh.subtotal ?? 0);
        const discountAmount = Number(fresh.discountAmount ?? 0);
        const shippingCost = Number(fresh.shippingCost ?? 0);
        const totalPrice = Number(fresh.totalPrice ?? 0);
        updateCheckoutData({
          quoteSubtotal: subtotal,
          quoteDiscountAmount: discountAmount,
          quoteShippingCost: shippingCost,
          quoteTotalPrice: totalPrice,
          quoteCouponApplied: Boolean(fresh.couponApplied),
          quoteCouponMessage: fresh.couponMessage ?? '',
          couponCode: fresh.couponCode ?? checkoutData.couponCode,
          quoteFetchedAt: Date.now(),
        });

        const couponForOrder =
          discountAmount > 0
            ? (fresh.couponCode ?? checkoutData.couponCode).trim() || null
            : null;

        const order = await createOrder({
          totalPrice,
          paymentMethod,
          shippingAddressId: shippingAddressId ?? null,
          subtotal,
          discountAmount,
          shippingCost,
          couponCode: couponForOrder,
          items: lineItems,
        });
        if (paymentMethod !== 'vnpay') {
          clearCart();
        }

        if (paymentMethod === 'vnpay') {
          const { paymentUrl } = await createVnpayPayment(order.id);
          window.location.assign(paymentUrl);
          return;
        }

        navigate(`/order-confirmation/${order.id}`, { state: { orderId: order.id, fromApi: true } });
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Không tạo được đơn hàng. Vui lòng thử lại.';
        setOrderError(err instanceof ApiError && err.status === 401 ? 'Vui lòng đăng nhập để đặt hàng.' : msg);
      } finally {
        placingRef.current = false;
        setPlacing(false);
      }
    } else {
      navigate('/order-confirmation');
    }
  };

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Payment Details */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Thanh toán</h2>

        <PaymentTabs selectedMethod={paymentMethod} onSelectMethod={setPaymentMethod} />

        {paymentMethod === 'vnpay' && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              Sau khi bấm Đặt hàng, bạn sẽ được chuyển tới cổng thanh toán VNPay (sandbox hoặc production tùy cấu hình
              server).
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Đơn được tạo ở trạng thái chờ thanh toán cho đến khi giao dịch thành công.
            </p>
          </div>
        )}

        {paymentMethod === 'cash_on_delivery' && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Thanh toán khi nhận hàng. Vui lòng chuẩn bị tiền mặt để thanh toán.
            </p>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Sau khi bạn nhận hàng thành công, hệ thống sẽ ghi nhận thanh toán.
            </div>
          </div>
        )}

        {orderError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {orderError}
          </div>
        )}

        {/* Terms and Conditions */}
        <div className="mt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Tôi đồng ý với{' '}
              <a href="#" className="text-primary hover:underline">
                Điều khoản & Điều kiện
              </a>{' '}
              và{' '}
              <a href="#" className="text-primary hover:underline">
                Chính sách bảo mật
              </a>
            </span>
          </label>
          {errors.terms && (
            <p className="mt-1 text-sm text-red-500">{errors.terms}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4 pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Quay lại
          </button>
          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="px-8 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:pointer-events-none"
          >
            {placing ? 'Đang đặt hàng...' : 'Đặt hàng'}
          </button>
        </div>
      </div>

      {/* Summary Sidebar */}
      <div className="lg:col-span-1">
        <CheckoutSummary />
      </div>
    </div>
  );
};

export default CheckoutStep3;

