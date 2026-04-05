import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckout } from '@/context/CheckoutContext';
import { useCart } from '@/context/CartContext';
import CheckoutStepper from '@/components/checkout/CheckoutStepper';
import CheckoutStep1 from '@/components/checkout/CheckoutStep1';
import CheckoutStep3 from '@/components/checkout/CheckoutStep3';
import { checkoutQuote } from '@/services/backend';
import { getToken, isApiConfigured } from '@/services/api';
import { toCheckoutLineItems } from '@/utils/checkoutLineItems';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items: cartItems } = useCart();
  const { currentStep, nextStep, previousStep, updateCheckoutData, checkoutData } = useCheckout();

  useEffect(() => {
    updateCheckoutData({ items: cartItems });
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [navigate, updateCheckoutData, cartItems]);

  /** Bước thanh toán (step 2): báo giá lại khi giỏ thay đổi để không dùng tổng cũ. */
  useEffect(() => {
    if (cartItems.length === 0 || currentStep !== 2) return;
    if (!isApiConfigured() || !getToken()) return;
    let cancelled = false;
    const coupon = checkoutData.couponCode?.trim();
    (async () => {
      try {
        const q = await checkoutQuote({
          items: toCheckoutLineItems(cartItems),
          couponCode: coupon || undefined,
        });
        if (cancelled) return;
        updateCheckoutData({
          quoteSubtotal: Number(q.subtotal ?? 0),
          quoteDiscountAmount: Number(q.discountAmount ?? 0),
          quoteShippingCost: Number(q.shippingCost ?? 0),
          quoteTotalPrice: Number(q.totalPrice ?? 0),
          couponCode: q.couponCode ?? coupon ?? '',
          quoteCouponApplied: Boolean(q.couponApplied),
          quoteCouponMessage: q.couponMessage ?? '',
          quoteFetchedAt: Date.now(),
        });
      } catch {
        if (!cancelled) navigate('/cart');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartItems, currentStep, checkoutData.couponCode, navigate, updateCheckoutData]);

  const handleNext = () => {
    nextStep();
  };

  const handleBack = () => {
    if (currentStep === 1) {
      navigate('/cart');
    } else {
      previousStep();
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <CheckoutStepper currentStep={currentStep} />

      {currentStep === 1 && <CheckoutStep1 onNext={handleNext} onBack={handleBack} />}
      {currentStep === 2 && <CheckoutStep3 onBack={handleBack} />}
    </div>
  );
};

export default CheckoutPage;

