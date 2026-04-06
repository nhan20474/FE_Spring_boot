/**
 * AI product generator — gọi qua backend (Spring Boot → Gemini).
 * API key được giữ bí mật ở server, không expose ra frontend.
 */
import { apiPost } from './api';

export interface GeneratedColor {
  name: string;
  hex?: string;
}

export interface GeneratedProduct {
  name: string;
  description: string;
  suggestedPrice: number;
  categoryHint: string;
  model?: string;
  suggestedStock?: number;
  colors?: GeneratedColor[];
  storageOptions?: string[];
  specifications?: Record<string, Record<string, string>>;
}

function normalizeColors(raw: unknown): GeneratedColor[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GeneratedColor[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object' && 'name' in item) {
      const name = String((item as { name: unknown }).name ?? '').trim();
      if (!name) continue;
      const hexRaw = (item as { hex?: unknown }).hex;
      const hex =
        hexRaw != null && String(hexRaw).trim() ? String(hexRaw).trim() : undefined;
      out.push(hex ? { name, hex } : { name });
    }
  }
  return out.length > 0 ? out : undefined;
}

function normalizeStorage(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
    .filter((s) => s.length > 0);
  return out.length > 0 ? out : undefined;
}

function normalizeSpecifications(
  raw: unknown
): Record<string, Record<string, string>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, Record<string, string>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const title = k.trim();
    if (!title || typeof v !== 'object' || v === null || Array.isArray(v)) continue;
    const inner: Record<string, string> = {};
    for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
      const lab = ik.trim();
      if (!lab) continue;
      inner[lab] = iv == null ? '' : String(iv);
    }
    if (Object.keys(inner).length > 0) out[title] = inner;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function generateProductInfo(keyword: string): Promise<GeneratedProduct> {
  const data = await apiPost<GeneratedProduct & { message?: string; colors?: unknown; storageOptions?: unknown; specifications?: unknown }>(
    '/admin/ai/generate',
    { keyword },
    { auth: true }
  );

  if (!data.name) {
    throw new Error((data as { message?: string }).message ?? 'AI không tạo được thông tin sản phẩm');
  }

  const suggestedStockRaw = (data as { suggestedStock?: unknown }).suggestedStock;
  let suggestedStock: number | undefined;
  if (typeof suggestedStockRaw === 'number' && Number.isFinite(suggestedStockRaw) && suggestedStockRaw >= 0) {
    suggestedStock = Math.min(Math.floor(suggestedStockRaw), 1_000_000);
  }

  return {
    name: data.name,
    description: data.description ?? '',
    suggestedPrice: Number(data.suggestedPrice) || 0,
    categoryHint: data.categoryHint ?? '',
    model: data.model,
    suggestedStock,
    colors: normalizeColors((data as { colors?: unknown }).colors),
    storageOptions: normalizeStorage((data as { storageOptions?: unknown }).storageOptions),
    specifications: normalizeSpecifications(
      (data as { specifications?: unknown }).specifications
    ),
  };
}

/** Luôn true — không cần key ở frontend nữa */
export function isAiConfigured(): boolean {
  return true;
}
