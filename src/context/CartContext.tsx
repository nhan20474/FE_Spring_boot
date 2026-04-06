import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ApiError, getToken, isApiConfigured } from '@/services/api';
import * as backend from '@/services/backend';
import type { CartItem } from '@/types';

export type CartActionResult = { ok: true } | { ok: false; message: string };

const CART_STORAGE_KEY = 'techhome_cart';

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export interface AddToCartPayload {
  productId: string;
  name: string;
  price: number;
  image: string;
  variant?: string;
  quantity?: number;
  selectedColor?: string;
  selectedStorage?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (payload: AddToCartPayload) => Promise<CartActionResult>;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<CartActionResult>;
  clearCart: () => void;
  totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const isLoggedIn = Boolean(getToken());

  // Lắng nghe event logout để clear giỏ hàng ngay lập tức
  useEffect(() => {
    const onLogout = () => {
      setItems([]);
      localStorage.removeItem(CART_STORAGE_KEY);
    };
    window.addEventListener('techhome:logout', onLogout);
    return () => window.removeEventListener('techhome:logout', onLogout);
  }, []);

  useEffect(() => {
    setItems(loadCartFromStorage());
    setInitialized(true);

    if (isApiConfigured() && isLoggedIn) {
      backend
        .getCart()
        .then((cart) => {
          const list = Array.isArray(cart) ? cart : [];
          setItems(list);
          saveCartToStorage(list);
        })
        .catch(() => {/* keep localStorage cart on API error */});
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!initialized) return;
    saveCartToStorage(items);
  }, [items, initialized]);

  const addItem = useCallback(async (payload: AddToCartPayload): Promise<CartActionResult> => {
    const { productId, name, price, image, variant, quantity: qtyIn, selectedColor, selectedStorage } = payload;
    const addQty = qtyIn != null && Number.isFinite(qtyIn) ? Math.max(1, Math.floor(qtyIn)) : 1;
    if (isApiConfigured() && getToken()) {
      try {
        const res = await backend.addCartItem({
          productId,
          name,
          price,
          image: image || '',
          quantity: addQty,
          variant,
          selectedColor,
          selectedStorage,
        });
        setItems(Array.isArray(res) ? res : []);
        return { ok: true };
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Không thêm được vào giỏ. Vui lòng thử lại.';
        return { ok: false, message: msg };
      }
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId && (i.variant ?? '') === (variant ?? ''));
      if (existing) {
        return prev.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + addQty } : i));
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          productId,
          name,
          variant,
          price,
          quantity: addQty,
          image: image || '',
        },
      ];
    });
    return { ok: true };
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    if (isApiConfigured() && getToken()) {
      backend
        .removeCartItem(cartItemId)
        .then((res) => { if (Array.isArray(res)) setItems(res); else setItems((prev) => prev.filter((i) => i.id !== cartItemId)); })
        .catch(() => setItems((prev) => prev.filter((i) => i.id !== cartItemId)));
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== cartItemId));
  }, []);

  const updateQuantity = useCallback(
    async (cartItemId: string, quantity: number): Promise<CartActionResult> => {
      if (quantity < 1) {
        removeItem(cartItemId);
        return { ok: true };
      }
      if (isApiConfigured() && getToken()) {
        try {
          const res = await backend.updateCartItemQuantity(cartItemId, quantity);
          setItems(Array.isArray(res) ? res : []);
          return { ok: true };
        } catch (e) {
          const msg =
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Không cập nhật được số lượng.';
          return { ok: false, message: msg };
        }
      }
      const item = items.find((i) => i.id === cartItemId);
      if (item && item.stock != null && quantity > item.stock) {
        return {
          ok: false,
          message: `"${item.name}" chỉ còn ${item.stock} trong kho.`,
        };
      }
      setItems((prev) =>
        prev.map((i) => (i.id === cartItemId ? { ...i, quantity } : i)),
      );
      return { ok: true };
    },
    [removeItem, items],
  );

  const clearCart = useCallback(() => {
    const run = async () => {
      if (isApiConfigured() && getToken()) {
        try {
          const list = await backend.clearCartAll();
          setItems(Array.isArray(list) ? list : []);
        } catch {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    };
    void run();
  }, []);

  const safeItems = Array.isArray(items) ? items : [];
  const totalCount = safeItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items: safeItems, addItem, removeItem, updateQuantity, clearCart, totalCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (ctx === undefined) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
