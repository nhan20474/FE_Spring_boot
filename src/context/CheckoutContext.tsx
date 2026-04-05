import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import type { SavedAddress, CartItem } from '@/types';

export interface PaymentMethod {
  type: 'credit_card' | 'paypal' | 'paypal_credit' | 'cash_on_delivery';
  cardNumber?: string;
  cardHolder?: string;
  expiryDate?: string;
  cvv?: string;
}

export type PaymentMethodType = 'credit_card' | 'paypal' | 'paypal_credit' | 'cash_on_delivery';

export interface CheckoutData {
  // Step 1: Shipping Address
  selectedAddress: SavedAddress | null;
  newAddress: Partial<SavedAddress> | null;

  // Step 2: Payment
  paymentMethod: PaymentMethod | null;
  couponCode: string;
  quoteSubtotal: number | null;
  quoteDiscountAmount: number | null;
  quoteShippingCost: number | null;
  quoteTotalPrice: number | null;
  quoteCouponApplied: boolean;
  quoteCouponMessage: string;
  /** Thời điểm nhận báo giá từ server (để hết hạn cache ~5 phút). */
  quoteFetchedAt: number | null;
  agreeToTerms: boolean;
  
  // Cart items
  items: CartItem[];
}

interface CheckoutContextType {
  checkoutData: CheckoutData;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  updateCheckoutData: (data: Partial<CheckoutData>) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetCheckout: () => void;
}

const defaultCheckoutData: CheckoutData = {
  selectedAddress: null,
  newAddress: null,
  paymentMethod: null,
  couponCode: '',
  quoteSubtotal: null,
  quoteDiscountAmount: null,
  quoteShippingCost: null,
  quoteTotalPrice: null,
  quoteCouponApplied: false,
  quoteCouponMessage: '',
  quoteFetchedAt: null,
  agreeToTerms: false,
  items: [],
};

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export const CheckoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [checkoutData, setCheckoutData] = useState<CheckoutData>(defaultCheckoutData);
  const [currentStep, setCurrentStep] = useState(1);

  const updateCheckoutData = useCallback((data: Partial<CheckoutData>) => {
    setCheckoutData((prev) => ({ ...prev, ...data }));
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((s) => (s < 2 ? s + 1 : s));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((s) => (s > 1 ? s - 1 : s));
  }, []);

  const resetCheckout = useCallback(() => {
    setCheckoutData(defaultCheckoutData);
    setCurrentStep(1);
  }, []);

  const value = useMemo(
    () => ({
      checkoutData,
      currentStep,
      setCurrentStep,
      updateCheckoutData,
      nextStep,
      previousStep,
      resetCheckout,
    }),
    [checkoutData, currentStep, updateCheckoutData, nextStep, previousStep, resetCheckout]
  );

  return (
    <CheckoutContext.Provider value={value}>
      {children}
    </CheckoutContext.Provider>
  );
};

export const useCheckout = () => {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return context;
};

