/**
 * Map backend DTOs to frontend types for display.
 */

import type { CategoryDto, ProductDto } from '@/types/api';
import type { Category, Product, TrendingProduct, ListingProduct } from '@/types';

const DEFAULT_COLOR_HEX = '#64748b';

/** Parse JSON `colors` từ API → danh sách hiển thị (hỗ trợ legacy mảng chuỗi tên màu). */
export function parseProductColorsFromApi(raw: string | null | undefined): { name: string; hex: string }[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((item) => {
      if (typeof item === 'string') return { name: item, hex: DEFAULT_COLOR_HEX };
      if (item && typeof item === 'object' && 'name' in item) {
        const o = item as { name: unknown; hex?: unknown };
        const hex = o.hex != null && String(o.hex).trim() ? String(o.hex) : DEFAULT_COLOR_HEX;
        return { name: String(o.name), hex };
      }
      return { name: String(item), hex: DEFAULT_COLOR_HEX };
    });
  } catch {
    return [];
  }
}

/** Parse JSON `storageOptions` từ API → mảng nhãn dung lượng (hỗ trợ legacy { capacity }). */
export function parseProductStorageFromApi(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object' && 'capacity' in x) return String((x as { capacity: unknown }).capacity);
      return String(x);
    });
  } catch {
    return [];
  }
}

/** Sinh slug từ tên danh mục (bỏ dấu, lowercase, gạch ngang) */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Map slug/tên → icon Material Symbol */
const iconMap: Record<string, string> = {
  mobile: 'smartphone',
  smartphone: 'smartphone',
  'dien-thoai': 'smartphone',
  tablets: 'tablet',
  tablet: 'tablet',
  'may-tinh-bang': 'tablet',
  accessories: 'keyboard',
  'phu-kien': 'keyboard',
  audio: 'headset',
  'am-thanh': 'headset',
  cooling: 'ac_unit',
  'lam-mat': 'ac_unit',
  'smart-home': 'tv',
  'nha-thong-minh': 'tv',
};

export function mapCategoryDtoToCategory(dto: CategoryDto): Category {
  const slug = (dto.slug && dto.slug.trim()) ? dto.slug.trim().toLowerCase() : nameToSlug(dto.name);
  return {
    id: String(dto.id),
    name: dto.name,
    slug,
    icon: iconMap[slug] ?? 'category',
    parentId: dto.parentId != null ? String(dto.parentId) : null,
  };
}

export function mapProductDtoToTrending(dto: ProductDto): TrendingProduct {
  const price = Number(dto.price);
  return {
    id: String(dto.id),
    slug: dto.slug?.trim() || undefined,
    name: dto.name,
    category: dto.categoryName,
    image: dto.image ?? '',
    price,
    oldPrice: dto.featured ? Math.round(price * 1.15) : undefined,
    rating: dto.rating ?? 0,
    reviews: dto.reviews ?? 0,
    isBestSeller: dto.featured,
    productDetailId: String(dto.id),
    inStock: (dto.stock ?? 0) > 0,
  };
}

export function mapProductDtoToListing(dto: ProductDto): ListingProduct {
  return {
    id: String(dto.id),
    slug: dto.slug?.trim() || undefined,
    name: dto.name,
    price: dto.price,
    image: dto.image ?? '',
    rating: dto.rating ?? 0,
    reviews: dto.reviews ?? 0,
    productDetailId: String(dto.id),
    inStock: (dto.stock ?? 0) > 0,
  };
}

export function mapProductDtoToProduct(dto: ProductDto): Product {
  const image = dto.image ?? '';
  const colors = parseProductColorsFromApi(dto.colors ?? undefined);
  const storageOptions = parseProductStorageFromApi(dto.storageOptions ?? undefined);
  const specRaw = dto.specifications?.trim();
  return {
    id: String(dto.id),
    slug: dto.slug?.trim() || undefined,
    name: dto.name,
    category: dto.categoryName,
    price: dto.price,
    rating: dto.rating ?? 0,
    reviews: dto.reviews ?? 0,
    image,
    images: image ? [image] : undefined,
    description: dto.description ?? undefined,
    inStock: dto.stock > 0,
    ...(colors.length > 0 ? { colors } : {}),
    ...(storageOptions.length > 0 ? { storageOptions } : {}),
    ...(specRaw ? { specifications: specRaw } : {}),
  };
}
