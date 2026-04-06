/**
 * Hooks to load categories and products from backend API.
 * When API is not configured or request fails, return empty data so callers can use mock fallback.
 */

import { useState, useEffect, useCallback } from 'react';
import * as backend from '@/services/backend';
import { isApiConfigured } from '@/services/api';
import {
  mapCategoryDtoToCategory,
  mapProductDtoToTrending,
  mapProductDtoToListing,
  mapProductDtoToProduct,
} from '@/services/productMappers';
import type { Category, Product, TrendingProduct, ListingProduct } from '@/types';

export function useApiCategories(): { data: Category[]; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      const list = await backend.getCategories();
      setData(list.map(mapCategoryDtoToCategory));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useApiFeaturedProducts(): { data: TrendingProduct[]; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<TrendingProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      const list = await backend.getFeaturedProducts();
      setData(list.map(mapProductDtoToTrending));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load featured products');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export interface UseApiProductsParams {
  category?: number;
  includeDescendants?: boolean;
  q?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
  /** Khi false: không gọi API (ví dụ chờ resolve slug danh mục). */
  enabled?: boolean;
}

export function useApiProducts(params: UseApiProductsParams = {}): {
  data: ListingProduct[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<ListingProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { category, includeDescendants, q, page = 0, size = 100, enabled = true, sortBy, sortDir } = params;

  const fetchData = useCallback(async () => {
    if (!isApiConfigured()) return;
    if (enabled === false) return;
    setLoading(true);
    setError(null);
    try {
      const list = await backend.getProducts({ category, includeDescendants, q, page, size, sortBy, sortDir });
      setData(list.map(mapProductDtoToListing));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [category, includeDescendants, q, page, size, enabled, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/** Fetch products by category slug — resolves slug → id; mặc định gồm cả sản phẩm ở danh mục con. */
export function useApiProductsBySlug(
  categorySlug: string,
  sortBy?: string,
  sortDir?: string,
  includeDescendants: boolean = true,
): {
  data: ListingProduct[];
  loading: boolean;
} {
  const { data: categories, loading: catsLoading } = useApiCategories();
  const cat = categories.find((c) => c.slug === categorySlug);
  const categoryId = cat ? Number(cat.id) : undefined;
  const enabled = !catsLoading && categoryId != null;
  const { data: products, loading: productsLoading } = useApiProducts(
    categoryId != null
      ? { category: categoryId, includeDescendants, enabled, sortBy, sortDir }
      : { enabled: false },
  );
  return { data: products, loading: catsLoading || productsLoading };
}

/**
 * segment: slug từ URL hoặc id số (legacy). Số thuần → GET /products/{id}; còn lại → GET /products/slug/{slug}.
 */
export function useApiProduct(segment: string | undefined): {
  data: Product | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isApiConfigured() || !segment) return;
    setLoading(true);
    setError(null);
    try {
      const isNumericId = /^\d+$/.test(segment);
      const dto = isNumericId ? await backend.getProduct(segment) : await backend.getProductBySlug(segment);
      setData(mapProductDtoToProduct(dto));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load product');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
