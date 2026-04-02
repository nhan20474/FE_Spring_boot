import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { WishlistItem } from '@/types';
import type { WishlistItemDto } from '@/types/api';
import * as backend from '@/services/backend';
import { useAuth } from '@/context/AuthContext';

const WISHLIST_STORAGE_KEY = 'techhome_wishlist';

function loadWishlistFromStorage(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWishlistToStorage(items: WishlistItem[]) {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
}

function mapDtoToItem(d: WishlistItemDto): WishlistItem {
  const pid = d.productId ?? String(d.id);
  return {
    id: String(d.id),
    productId: pid,
    name: d.name ?? '',
    image: d.image ?? '',
    price: Number(d.price ?? 0),
    oldPrice: d.oldPrice != null ? Number(d.oldPrice) : undefined,
    rating: d.rating ?? 0,
    reviews: d.reviews ?? 0,
    onSale: d.oldPrice != null && Number(d.oldPrice) > Number(d.price ?? 0),
  };
}

export interface AddToWishlistPayload {
  productId: string;
  name: string;
  image: string;
  price: number;
  oldPrice?: number;
  rating?: number;
  reviews?: number;
}

interface WishlistContextType {
  items: WishlistItem[];
  addItem: (payload: AddToWishlistPayload) => void;
  removeItem: (productId: string) => void;
  toggleItem: (payload: AddToWishlistPayload) => void;
  isInWishlist: (productId: string) => boolean;
  totalCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>(() => loadWishlistFromStorage());

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      setItems(loadWishlistFromStorage());
      return;
    }
    let cancelled = false;
    void (async () => {
      const guest = loadWishlistFromStorage();
      try {
        let server = await backend.getWishlist();
        for (const g of guest) {
          const rawPid = g.productId ?? g.id.replace(/^wl-/, '');
          const pid = Number(rawPid);
          if (!Number.isFinite(pid)) continue;
          if (server.some((s) => String(s.productId) === String(pid))) continue;
          try {
            server = await backend.addWishlistItemApi(pid);
          } catch {
            /* bỏ qua từng item lỗi */
          }
        }
        if (cancelled) return;
        localStorage.removeItem(WISHLIST_STORAGE_KEY);
        setItems(server.map(mapDtoToItem));
      } catch {
        if (!cancelled) setItems(guest);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isInitialized]);

  useEffect(() => {
    if (!isAuthenticated) {
      saveWishlistToStorage(items);
    }
  }, [items, isAuthenticated]);

  const addItem = useCallback(
    (payload: AddToWishlistPayload) => {
      const { productId, name, image, price, oldPrice, rating = 0, reviews = 0 } = payload;
      if (isAuthenticated) {
        const pid = Number(productId);
        if (!Number.isFinite(pid)) return;
        void backend.addWishlistItemApi(pid).then((list) => setItems(list.map(mapDtoToItem)));
        return;
      }
      setItems((prev) => {
        if (prev.some((i) => (i.productId ?? i.id) === productId)) return prev;
        return [
          ...prev,
          {
            id: `wl-${productId}`,
            productId,
            name,
            image,
            price,
            oldPrice,
            rating,
            reviews,
            onSale: oldPrice != null && oldPrice > price,
          },
        ];
      });
    },
    [isAuthenticated],
  );

  const removeItem = useCallback(
    (productId: string) => {
      if (isAuthenticated) {
        const pid = Number(productId);
        if (!Number.isFinite(pid)) return;
        void backend.removeWishlistItemApi(pid).then((list) => setItems(list.map(mapDtoToItem)));
        return;
      }
      setItems((prev) => prev.filter((i) => (i.productId ?? i.id) !== productId && i.id !== `wl-${productId}`));
    },
    [isAuthenticated],
  );

  const toggleItem = useCallback(
    (payload: AddToWishlistPayload) => {
      const exists = items.some(
        (i) => (i.productId ?? i.id) === payload.productId || i.id === `wl-${payload.productId}`,
      );
      if (isAuthenticated) {
        const pid = Number(payload.productId);
        if (!Number.isFinite(pid)) return;
        const op = exists ? backend.removeWishlistItemApi(pid) : backend.addWishlistItemApi(pid);
        void op.then((list) => setItems(list.map(mapDtoToItem)));
        return;
      }
      setItems((prev) => {
        if (exists) {
          return prev.filter(
            (i) => (i.productId ?? i.id) !== payload.productId && i.id !== `wl-${payload.productId}`,
          );
        }
        const { productId, name, image, price, oldPrice, rating = 0, reviews = 0 } = payload;
        return [
          ...prev,
          {
            id: `wl-${productId}`,
            productId,
            name,
            image,
            price,
            oldPrice,
            rating,
            reviews,
            onSale: oldPrice != null && oldPrice > price,
          },
        ];
      });
    },
    [isAuthenticated, items],
  );

  const isInWishlist = useCallback(
    (productId: string) =>
      items.some((i) => (i.productId ?? i.id) === productId || i.id === `wl-${productId}`),
    [items],
  );

  const totalCount = items.length;

  const value: WishlistContextType = {
    items,
    addItem,
    removeItem,
    toggleItem,
    isInWishlist,
    totalCount,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (ctx === undefined) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}
