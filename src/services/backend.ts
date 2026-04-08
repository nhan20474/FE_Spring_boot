/**
 * Backend API service – endpoints as per backend–frontend linking doc.
 * All paths are relative to API_BASE (e.g. http://localhost:8080/api).
 */

import {
  apiGet,
  apiGetBlob,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  setToken as storeToken,
  setStoredUser,
  clearToken,
  getToken,
  ApiError,
} from './api';
import type {
  CategoryDto,
  ProductDto,
  AuthRequest,
  RegisterRequest,
  AuthResponse,
  AuthUserDto,
  CreateOrderRequest,
  AdminOrderDto,
  AdminOrdersResponse,
  OrderStatusHistoryDto,
  UpdateAdminOrderStatusRequest,
  UpsertShipmentRequest,
  ShipmentDto,
  OrderDto,
  ProfileDto,
  CartDto,
  CartItemDto,
  AddressDto,
  ReturnRequestDto,
  AdminDashboardSummaryDto,
  CouponDto,
  CreateCouponRequestBody,
  AdminUsersResponse,
  AdminUserDto,
  AdminInboxResponse,
  AdminChatConversationDto,
  AdminChatConversationMessagesDto,
  WishlistItemDto,
  UpsertProductRatingRequest,
  ProductRatingResponseDto,
  ChatMessageDto,
} from '@/types/api';
import type { CartItem } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export interface ProductsParams {
  category?: number;
  /** true: lọc sản phẩm thuộc danh mục này và mọi danh mục con (API `includeDescendants`). */
  includeDescendants?: boolean;
  q?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  [key: string]: unknown;
}

interface ItemsPageResponse<T> {
  items: T[];
  page?: number;
  size?: number;
  total?: number;
  totalElements?: number;
  totalPages?: number;
  [key: string]: unknown;
}

interface InventoryReplayResponse {
  idempotentReplay?: boolean;
  operation?: string;
  stock?: InventoryStockDto;
}

export interface CheckoutQuoteRequest {
  items?: Array<{
    productId: number;
    quantity: number;
    selectedColor?: string;
    selectedStorage?: string;
  }>;
  couponCode?: string;
}

export interface CheckoutQuoteResponse {
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  totalPrice: number;
  couponCode?: string;
  couponApplied?: boolean;
  couponMessage?: string;
}

/** Handle both plain array and Spring Page object from backend */
function extractList<T>(response: T[] | PageResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && Array.isArray((response as PageResponse<T>).content)) {
    return (response as PageResponse<T>).content;
  }
  return [];
}

/** Handle plain array, Spring Page(content), and custom page(items). */
function extractListFlexible<T>(response: T[] | PageResponse<T> | ItemsPageResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    if (Array.isArray((response as ItemsPageResponse<T>).items)) {
      return (response as ItemsPageResponse<T>).items;
    }
    if (Array.isArray((response as PageResponse<T>).content)) {
      return (response as PageResponse<T>).content;
    }
  }
  return [];
}

/** Handle either plain array or object wrapper { items: [] }. */
function extractItemsArray<T>(response: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && Array.isArray((response as { items?: T[] }).items)) {
    return (response as { items?: T[] }).items as T[];
  }
  return [];
}

/** Map CartDto (backend) → CartItem[] (frontend) */
function mapCartDto(dto: CartDto): CartItem[] {
  if (!dto || !Array.isArray(dto.items)) return [];
  return dto.items.map((item: CartItemDto) => ({
    id: String(item.id),
    productId: String(item.productId),
    name: item.productName ?? '',
    variant:
      (item.variant && String(item.variant).trim()) ||
      [item.selectedColor, item.selectedStorage].filter((x) => x && String(x).trim()).join(' · ') ||
      undefined,
    selectedColor: item.selectedColor ?? undefined,
    selectedStorage: item.selectedStorage ?? undefined,
    price: Number(item.priceAtAdd ?? 0),
    quantity: item.quantity ?? 1,
    image: item.productImage ?? '',
    stock: item.stock != null && item.stock !== undefined ? Number(item.stock) : undefined,
  }));
}

/** GET /api/health */
export async function health(): Promise<{ status: string }> {
  return apiGet<{ status: string }>('/health', { auth: false });
}

/** GET /api/auth/me — current user from JWT */
export async function fetchAuthMe(): Promise<AuthUserDto> {
  return apiGet<AuthUserDto>('/auth/me', { auth: true });
}

/** POST /api/auth/forgot-password — resetToken chỉ có khi backend bật EXPOSE_RESET_TOKEN (dev) */
export async function forgotPassword(email: string): Promise<{
  message: string;
  accepted: boolean;
  resetToken?: string;
  expiresInSeconds?: number;
}> {
  return apiPost('/auth/forgot-password', { email }, { auth: false });
}

/** POST /api/auth/reset-password */
export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/reset-password', { token, newPassword }, { auth: false });
}

/** GET /api/auth/verify-email?token= */
export async function verifyEmail(token: string): Promise<{ verified: boolean; message: string }> {
  return apiGet<{ verified: boolean; message: string }>(
    `/auth/verify-email?token=${encodeURIComponent(token)}`,
    { auth: false }
  );
}

/** POST /api/auth/resend-verification — cần đăng nhập */
export async function resendVerificationEmail(): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/resend-verification', {}, { auth: true });
}

/** GET /api/admin/dashboard/summary */
export async function adminGetDashboardSummary(recentLimit = 10): Promise<AdminDashboardSummaryDto> {
  const raw = await apiGet<{
    revenue?: unknown;
    ordersByStatus?: Record<string, number>;
    recentOrders?: Array<{
      id: number;
      totalPrice?: unknown;
      status?: string | null;
      createdAt: string;
      customerName?: string | null;
    }>;
  }>(`/admin/dashboard/summary?recentLimit=${recentLimit}`, { auth: true });
  const rev = raw.revenue;
  const revenue = typeof rev === 'number' ? rev : Number(rev ?? 0);
  return {
    revenue: Number.isFinite(revenue) ? revenue : 0,
    ordersByStatus: raw.ordersByStatus ?? {},
    recentOrders: Array.isArray(raw.recentOrders)
      ? raw.recentOrders.map((r) => ({
          id: r.id,
          totalPrice: typeof r.totalPrice === 'number' ? r.totalPrice : Number(r.totalPrice ?? 0),
          status: r.status ?? null,
          createdAt: r.createdAt,
          customerName: r.customerName ?? null,
        }))
      : [],
  };
}

/** GET /api/wishlist */
export async function getWishlist(): Promise<WishlistItemDto[]> {
  return apiGet<WishlistItemDto[]>('/wishlist', { auth: true });
}

/** POST /api/wishlist/items */
export async function addWishlistItemApi(productId: number): Promise<WishlistItemDto[]> {
  return apiPost<WishlistItemDto[]>('/wishlist/items', { productId }, { auth: true });
}

/** DELETE /api/wishlist/items/{productId} */
export async function removeWishlistItemApi(productId: number): Promise<WishlistItemDto[]> {
  return apiDelete<WishlistItemDto[]>(`/wishlist/items/${productId}`, { auth: true });
}

/** PUT /api/product-ratings — đánh giá sao theo dòng đơn (đơn đã giao thành công). */
export async function upsertProductRating(body: UpsertProductRatingRequest): Promise<ProductRatingResponseDto> {
  return apiPut<ProductRatingResponseDto>('/product-ratings', body, { auth: true });
}

/** GET /api/admin/coupons */
export async function adminListCoupons(): Promise<CouponDto[]> {
  return apiGet<CouponDto[]>('/admin/coupons', { auth: true });
}

/** POST /api/admin/coupons */
export async function adminCreateCoupon(body: CreateCouponRequestBody): Promise<CouponDto> {
  return apiPost<CouponDto>('/admin/coupons', body, { auth: true });
}

/** PATCH /api/admin/coupons/{id} */
export async function adminUpdateCoupon(id: number | string, body: Partial<CreateCouponRequestBody>): Promise<CouponDto> {
  return apiPatch<CouponDto>(`/admin/coupons/${id}`, body, { auth: true });
}

/** PATCH /api/admin/coupons/{id}/deactivate */
export async function adminDeactivateCoupon(id: number | string): Promise<{ message: string }> {
  return apiPatch<{ message: string }>(`/admin/coupons/${id}/deactivate`, {}, { auth: true });
}

/** GET /api/admin/users */
export async function adminGetUsers(params?: {
  role?: string;
  q?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<AdminUsersResponse> {
  const sp = new URLSearchParams();
  if (params?.role) sp.set('role', params.role);
  if (params?.q) sp.set('q', params.q);
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.size != null) sp.set('size', String(params.size));
  if (params?.sortBy) sp.set('sortBy', params.sortBy);
  if (params?.sortDir) sp.set('sortDir', params.sortDir);
  const query = sp.toString();
  return apiGet<AdminUsersResponse>(query ? `/admin/users?${query}` : '/admin/users', { auth: true });
}

/** PUT /api/admin/users/{id}/role */
export async function adminUpdateUserRole(userId: number | string, role: 'admin' | 'customer'): Promise<AdminUserDto> {
  return apiPut<AdminUserDto>(`/admin/users/${userId}/role`, { role }, { auth: true });
}

/** DELETE /api/admin/users/{id} */
export async function adminDeleteUser(userId: number | string): Promise<void> {
  return apiDelete<void>(`/admin/users/${userId}`, { auth: true });
}

/** GET /api/admin/inbox */
export async function adminGetInbox(limit = 30): Promise<AdminInboxResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return apiGet<AdminInboxResponse>(`/admin/inbox?limit=${safeLimit}`, { auth: true });
}

/** PATCH /api/admin/inbox/{auditId}/read */
export async function adminMarkInboxRead(auditId: number): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/admin/inbox/${auditId}/read`, {}, { auth: true });
}

/** PATCH /api/admin/inbox/read-all */
export async function adminMarkAllInboxRead(limit = 100): Promise<{ ok: boolean; updated: number }> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  return apiPatch<{ ok: boolean; updated: number }>(`/admin/inbox/read-all?limit=${safeLimit}`, {}, { auth: true });
}

/** GET /api/admin/chat/conversations */
export async function adminGetChatConversations(limit = 50): Promise<{ items: AdminChatConversationDto[] }> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  return apiGet<{ items: AdminChatConversationDto[] }>(`/admin/chat/conversations?limit=${safeLimit}`, { auth: true });
}

/** GET /api/admin/chat/conversations/{userId}/messages */
export async function adminGetChatMessages(
  userId: number,
  limit = 100,
): Promise<AdminChatConversationMessagesDto> {
  const safeLimit = Math.min(Math.max(limit, 1), 300);
  return apiGet<AdminChatConversationMessagesDto>(`/admin/chat/conversations/${userId}/messages?limit=${safeLimit}`, {
    auth: true,
  });
}

/** POST /api/admin/chat/conversations/{userId}/reply */
export async function adminReplyChatMessage(
  userId: number,
  message: string,
): Promise<{ id: number; role: 'assistant'; content: string; sentAt: string }> {
  return apiPost<{ id: number; role: 'assistant'; content: string; sentAt: string }>(
    `/admin/chat/conversations/${userId}/reply`,
    { message },
    { auth: true },
  );
}

/** GET /api/categories */
export async function getCategories(): Promise<CategoryDto[]> {
  const raw = await apiGet<CategoryDto[] | PageResponse<CategoryDto>>('/categories', { auth: false });
  return extractList(raw);
}

/** GET /api/products?category=&includeDescendants=&q=&page=&size= */
export async function getProducts(params: ProductsParams = {}): Promise<ProductDto[]> {
  const sp = new URLSearchParams();
  if (params.category != null) sp.set('category', String(params.category));
  if (params.includeDescendants === true) sp.set('includeDescendants', 'true');
  if (params.q != null && params.q !== '') sp.set('q', params.q);
  if (params.page != null) sp.set('page', String(params.page));
  if (params.size != null) sp.set('size', String(params.size));
  if (params.sortBy != null) sp.set('sortBy', params.sortBy);
  if (params.sortDir != null) sp.set('sortDir', params.sortDir);
  const query = sp.toString();
  const path = query ? `/products?${query}` : '/products';
  const raw = await apiGet<ProductDto[] | PageResponse<ProductDto>>(path, { auth: false });
  return extractList(raw);
}

/** GET /api/products/{id} */
export async function getProduct(id: number | string): Promise<ProductDto> {
  return apiGet<ProductDto>(`/products/${id}`, { auth: false });
}

/** GET /api/products/slug/{slug} */
export async function getProductBySlug(slug: string): Promise<ProductDto> {
  return apiGet<ProductDto>(`/products/slug/${encodeURIComponent(slug)}`, { auth: false });
}

/** GET /api/products/featured */
export async function getFeaturedProducts(): Promise<ProductDto[]> {
  const raw = await apiGet<ProductDto[] | PageResponse<ProductDto>>('/products/featured', { auth: false });
  return extractList(raw);
}

// ——— Admin: Products ———

export interface AdminProductPayload {
  name: string;
  description?: string | null;
  image?: string | null;
  price: number;
  categoryId: number;
  stock: number;
  featured?: boolean;
  colors?: string | null;
  storageOptions?: string | null;
  specifications?: string | null;
}

// ——— File Upload ———

/** Khi browser không set `file.type`, suy MIME từ đuôi để presign R2 vẫn dùng image/*. */
function guessImageContentType(file: File): string {
  const t = file.type?.trim();
  if (t && t.startsWith('image/')) return t;
  const n = file.name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.bmp')) return 'image/bmp';
  if (n.endsWith('.svg')) return 'image/svg+xml';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

/** Presign rồi upload lên storage (local: POST multipart + /uploads; R2: PUT presigned). */
export async function uploadImage(file: File): Promise<string> {
  const { getToken } = await import('./api');
  const token = getToken();
  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const contentType = guessImageContentType(file);

  const presignRes = await fetch(`${API_BASE}/upload/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
    }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Presign lỗi ${presignRes.status}`);
  }
  const presign = (await presignRes.json()) as {
    uploadUrl: string;
    publicUrl: string;
    method: string;
    headers?: Record<string, string>;
  };
  const method = (presign.method || 'PUT').toUpperCase();

  if (method === 'POST') {
    const formData = new FormData();
    formData.append('file', file);
    const extra = presign.headers?.['X-Upload-Filename'] ?? presign.headers?.['x-upload-filename'];
    const res = await fetch(presign.uploadUrl, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(extra ? { 'X-Upload-Filename': extra } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message ?? `Upload lỗi ${res.status}`);
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  const putHeaders: Record<string, string> = { ...(presign.headers ?? {}) };
  if (!putHeaders['Content-Type'] && !putHeaders['content-type']) {
    putHeaders['Content-Type'] = contentType;
  }
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: putHeaders,
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload lên storage lỗi ${putRes.status}`);
  }
  return presign.publicUrl;
}

// ——— Admin: Stats ———

export interface AdminStats {
  totalProducts: number;
  totalUsers: number;
  totalOrders: number;
  totalCategories: number;
}

/** GET /api/admin/stats */
export async function adminGetStats(): Promise<AdminStats> {
  return apiGet<AdminStats>('/admin/stats', { auth: true });
}

/** GET /api/admin/products */
export async function adminGetProducts(): Promise<ProductDto[]> {
  const raw = await apiGet<ProductDto[] | PageResponse<ProductDto>>('/admin/products', { auth: true });
  return extractList(raw);
}

/** POST /api/admin/products */
export async function adminCreateProduct(body: AdminProductPayload): Promise<ProductDto> {
  return apiPost<ProductDto>('/admin/products', body, { auth: true });
}

/** PATCH /api/admin/products/{id} */
export async function adminUpdateProduct(id: number | string, body: Partial<AdminProductPayload>): Promise<ProductDto> {
  return apiPatch<ProductDto>(`/admin/products/${id}`, body, { auth: true });
}

/** DELETE /api/admin/products/{id} */
export async function adminDeleteProduct(id: number | string): Promise<void> {
  return apiDelete<void>(`/admin/products/${id}`, { auth: true });
}

// ——— Admin: Excel import ———

const ADMIN_API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export interface ExcelImportRowError {
  row: number;
  message: string;
}

export interface ExcelImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ExcelImportRowError[];
}

async function adminDownloadExcelTemplate(path: string, downloadFilename: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${ADMIN_API_BASE}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Tải mẫu lỗi ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text) msg = text;
    }
    throw new ApiError(msg, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename;
  a.click();
  URL.revokeObjectURL(url);
}

/** GET /api/admin/import/templates/products */
export async function adminDownloadProductImportTemplate(): Promise<void> {
  await adminDownloadExcelTemplate('/admin/import/templates/products', 'mau_san_pham.xlsx');
}

/** GET /api/admin/import/templates/users */
export async function adminDownloadUserImportTemplate(): Promise<void> {
  await adminDownloadExcelTemplate('/admin/import/templates/users', 'mau_nguoi_dung.xlsx');
}

async function postExcelImport(path: string, file: File): Promise<ExcelImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Import lỗi ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text) msg = text;
    }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<ExcelImportResult>;
}

/** POST /api/admin/import/products (multipart file) */
export async function adminImportProductsExcel(file: File): Promise<ExcelImportResult> {
  return postExcelImport('/admin/import/products', file);
}

/** POST /api/admin/import/users (multipart file) */
export async function adminImportUsersExcel(file: File): Promise<ExcelImportResult> {
  return postExcelImport('/admin/import/users', file);
}

// ——— Admin: Categories ———

/** GET /api/admin/categories */
export async function adminGetCategories(): Promise<CategoryDto[]> {
  const raw = await apiGet<CategoryDto[] | PageResponse<CategoryDto>>('/admin/categories', { auth: true });
  return extractList(raw);
}

/** POST /api/admin/categories */
export async function adminCreateCategory(body: { name: string; description?: string }): Promise<CategoryDto> {
  return apiPost<CategoryDto>('/admin/categories', body, { auth: true });
}

/** PATCH /api/admin/categories/{id} */
export async function adminUpdateCategory(id: number | string, body: { name?: string; description?: string }): Promise<CategoryDto> {
  return apiPatch<CategoryDto>(`/admin/categories/${id}`, body, { auth: true });
}

/** DELETE /api/admin/categories/{id} */
export async function adminDeleteCategory(id: number | string): Promise<void> {
  return apiDelete<void>(`/admin/categories/${id}`, { auth: true });
}

export interface AdminCategoryPayload {
  name: string;
  description?: string;
  slug?: string;
  parentId?: number | null;
}

export async function adminCreateCategoryV2(body: AdminCategoryPayload): Promise<CategoryDto> {
  return apiPost<CategoryDto>('/admin/categories', body, { auth: true });
}

export async function adminUpdateCategoryV2(id: number | string, body: Partial<AdminCategoryPayload>): Promise<CategoryDto> {
  return apiPatch<CategoryDto>(`/admin/categories/${id}`, body, { auth: true });
}

// ——— Admin: Orders ———
/** GET /api/admin/orders */
export async function adminGetOrders(params?: {
  status?: string;
  page?: number;
  size?: number;
  sortDir?: 'asc' | 'desc';
}): Promise<AdminOrdersResponse> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.size != null) sp.set('size', String(params.size));
  if (params?.sortDir) sp.set('sortDir', params.sortDir);
  const query = sp.toString();
  const path = query ? `/admin/orders?${query}` : '/admin/orders';
  const raw = await apiGet<AdminOrdersResponse | AdminOrderDto[]>(path, { auth: true });
  if (Array.isArray(raw)) {
    return {
      items: raw,
      page: 0,
      size: raw.length,
      total: raw.length,
      totalElements: raw.length,
      totalPages: 1,
    };
  }
  return {
    items: Array.isArray(raw.items) ? raw.items : [],
    page: Number(raw.page ?? 0),
    size: Number(raw.size ?? 0),
    total: Number(raw.total ?? raw.totalElements ?? 0),
    totalElements: raw.totalElements,
    totalPages: raw.totalPages,
  };
}

function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** GET /api/orders/{id}/invoice.pdf — PDF do backend sinh (chỉ chủ đơn) */
export async function downloadCustomerOrderInvoicePdf(orderId: number | string): Promise<void> {
  const blob = await apiGetBlob(`/orders/${orderId}/invoice.pdf`, { auth: true });
  saveBlobAsFile(blob, `hoa-don-${orderId}.pdf`);
}

/** GET /api/admin/orders/{id}/invoice.pdf — PDF hóa đơn (admin) */
export async function downloadAdminOrderInvoicePdf(orderId: number | string): Promise<void> {
  const blob = await apiGetBlob(`/admin/orders/${orderId}/invoice.pdf`, { auth: true });
  saveBlobAsFile(blob, `hoa-don-${orderId}.pdf`);
}

/** GET /api/admin/orders/{id} */
export async function adminGetOrder(orderId: number | string): Promise<AdminOrderDto> {
  return apiGet<AdminOrderDto>(`/admin/orders/${orderId}`, { auth: true });
}

/** PATCH /api/admin/orders/{id}/status */
export async function adminUpdateOrderStatus(
  orderId: number | string,
  body: UpdateAdminOrderStatusRequest,
): Promise<AdminOrderDto> {
  return apiPatch<AdminOrderDto>(`/admin/orders/${orderId}/status`, body, { auth: true });
}

/**
 * GET /api/admin/orders/{orderId}/shipment
 * Backend trả { shipment: null } khi chưa có, hoặc body phẳng ShipmentDto khi đã có.
 */
export async function adminGetShipment(orderId: number | string): Promise<ShipmentDto | null> {
  type Wrapped = { shipment: ShipmentDto | null };
  const raw = await apiGet<ShipmentDto | Wrapped>(`/admin/orders/${orderId}/shipment`, { auth: true });
  if (raw && typeof raw === 'object' && 'shipment' in raw) {
    return (raw as Wrapped).shipment ?? null;
  }
  if (raw && typeof raw === 'object' && 'orderId' in raw) {
    return raw as ShipmentDto;
  }
  return null;
}

/** PUT /api/admin/orders/{orderId}/shipment */
export async function adminUpsertShipment(
  orderId: number | string,
  body: UpsertShipmentRequest,
): Promise<ShipmentDto> {
  return apiPut<ShipmentDto>(`/admin/orders/${orderId}/shipment`, body, { auth: true });
}

export interface InventoryStockDto {
  productId: number;
  stock: number;
  reservedStock: number;
  availableStock: number;
}

type InventoryMutationPayload = {
  productId: number;
  quantity: number;
  idempotencyKey?: string;
};

export async function adminGetInventoryStock(productId: number | string): Promise<InventoryStockDto> {
  return apiGet<InventoryStockDto>(`/admin/inventory/products/${productId}`, { auth: true });
}

export async function adminInventoryAdd(body: InventoryMutationPayload): Promise<InventoryStockDto> {
  return apiPost<InventoryStockDto>('/admin/inventory/add', body, { auth: true });
}

export async function adminInventoryRemove(body: InventoryMutationPayload): Promise<InventoryStockDto> {
  return apiPost<InventoryStockDto>('/admin/inventory/remove', body, { auth: true });
}

export async function adminInventoryReserve(body: InventoryMutationPayload): Promise<InventoryStockDto> {
  const raw = await apiPost<InventoryStockDto | InventoryReplayResponse>('/admin/inventory/reserve', body, { auth: true });
  if (raw && typeof raw === 'object' && 'idempotentReplay' in raw) {
    const replay = raw as InventoryReplayResponse;
    if (replay.stock) return replay.stock;
  }
  return raw as InventoryStockDto;
}

export async function adminInventorySold(body: InventoryMutationPayload): Promise<InventoryStockDto> {
  const raw = await apiPost<InventoryStockDto | InventoryReplayResponse>('/admin/inventory/sold', body, { auth: true });
  if (raw && typeof raw === 'object' && 'idempotentReplay' in raw) {
    const replay = raw as InventoryReplayResponse;
    if (replay.stock) return replay.stock;
  }
  return raw as InventoryStockDto;
}

/** GET /api/admin/orders/{id}/status-history */
export async function adminGetOrderStatusHistory(orderId: number | string): Promise<OrderStatusHistoryDto[]> {
  const raw = await apiGet<OrderStatusHistoryDto[] | { items?: OrderStatusHistoryDto[] }>(`/admin/orders/${orderId}/status-history`, { auth: true });
  return extractItemsArray(raw);
}

/** GET /api/admin/orders/{orderId}/returns */
export async function adminGetOrderReturns(orderId: number | string): Promise<ReturnRequestDto[]> {
  const raw = await apiGet<ReturnRequestDto[] | { items?: ReturnRequestDto[] }>(`/admin/orders/${orderId}/returns`, { auth: true });
  return extractItemsArray(raw);
}

/** POST /api/admin/orders/{orderId}/returns */
export async function adminCreateReturn(
  orderId: number | string,
  body: { reason?: string; refundAmount?: number; note?: string }
): Promise<ReturnRequestDto> {
  return apiPost<ReturnRequestDto>(`/admin/orders/${orderId}/returns`, body, { auth: true });
}

/** PATCH /api/admin/returns/{returnId}/status */
export async function adminUpdateReturnStatus(
  returnId: number | string,
  body: { status: string; note?: string }
): Promise<ReturnRequestDto> {
  return apiPatch<ReturnRequestDto>(`/admin/returns/${returnId}/status`, body, { auth: true });
}

/** POST /api/auth/login */
export async function login(body: AuthRequest): Promise<AuthResponse> {
  const res = await apiPost<AuthResponse>('/auth/login', body, { auth: false });
  storeToken(res.token);
  setStoredUser(res.user);
  return res;
}

/** Build Google OAuth start URL on backend. */
export function getGoogleLoginUrl(redirectUri?: string): string {
  const path = '/auth/google';
  if (!redirectUri) return `${API_BASE}${path}`;
  return `${API_BASE}${path}?redirectUri=${encodeURIComponent(redirectUri)}`;
}

/** GET /api/chat/status — cần JWT (trợ lý có bật trên server không) */
export async function getChatStatus(): Promise<{ available: boolean }> {
  return apiGet<{ available: boolean }>('/chat/status', { auth: true });
}

/** GET /api/chat/history?limit= — lấy lịch sử tin nhắn đã lưu trong DB */
export async function getChatHistory(limit = 50): Promise<{ messages: ChatMessageDto[] }> {
  return apiGet<{ messages: ChatMessageDto[] }>(`/chat/history?limit=${limit}`, { auth: true });
}

/** POST /api/chat/message — cần JWT */
export async function postChatMessage(message: string): Promise<{ reply: string }> {
  return apiPost<{ reply: string }>('/chat/message', { message }, { auth: true });
}

/** POST /api/auth/register */
export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const res = await apiPost<AuthResponse>('/auth/register', body, { auth: false });
  storeToken(res.token);
  setStoredUser(res.user);
  return res;
}

/** POST /api/orders – requires Authorization */
export async function createOrder(body: CreateOrderRequest): Promise<OrderDto> {
  return apiPost<OrderDto>('/orders', body, { auth: true });
}

/** POST /api/payments/vnpay/create — trả về URL chuyển hướng VNPay */
export async function createVnpayPayment(orderId: number): Promise<{ paymentUrl: string }> {
  return apiPost<{ paymentUrl: string }>('/payments/vnpay/create', { orderId }, { auth: true });
}

/** GET /api/orders – requires Authorization */
export async function getOrders(): Promise<OrderDto[]> {
  const raw = await apiGet<OrderDto[] | PageResponse<OrderDto> | ItemsPageResponse<OrderDto>>('/orders', { auth: true });
  return extractListFlexible(raw);
}

/** GET /api/orders/:id – requires Authorization */
export async function getOrder(id: number | string): Promise<OrderDto> {
  return apiGet<OrderDto>(`/orders/${id}`, { auth: true });
}

/** GET /api/orders/{id}/status-history — chủ đơn */
export async function getOrderStatusHistory(orderId: number | string): Promise<OrderStatusHistoryDto[]> {
  const raw = await apiGet<OrderStatusHistoryDto[] | { items?: OrderStatusHistoryDto[] }>(
    `/orders/${orderId}/status-history`,
    { auth: true },
  );
  return extractItemsArray(raw);
}

/** GET /api/orders/{id}/returns — chủ đơn */
export async function getOrderReturns(orderId: number | string): Promise<ReturnRequestDto[]> {
  const raw = await apiGet<ReturnRequestDto[] | { items?: ReturnRequestDto[] }>(`/orders/${orderId}/returns`, {
    auth: true,
  });
  return extractItemsArray(raw);
}

/** POST /api/orders/{id}/returns — khách gửi yêu cầu trả */
export async function createOrderReturn(
  orderId: number | string,
  body: { reason?: string; refundAmount?: number; note?: string },
): Promise<ReturnRequestDto> {
  return apiPost<ReturnRequestDto>(`/orders/${orderId}/returns`, body, { auth: true });
}

/** POST /api/checkout/quote */
export async function checkoutQuote(body: CheckoutQuoteRequest): Promise<CheckoutQuoteResponse> {
  return apiPost<CheckoutQuoteResponse>('/checkout/quote', body, { auth: true });
}

/** PATCH /api/orders/{id}/receive — COD: customer confirms received */
export async function receiveOrder(orderId: number | string): Promise<OrderDto> {
  return apiPatch<OrderDto>(`/orders/${orderId}/receive`, {}, { auth: true });
}

/** PATCH /api/orders/{id}/cancel — khách hủy (chỉ pending / pending_payment) */
export async function cancelOrder(orderId: number | string): Promise<OrderDto> {
  return apiPatch<OrderDto>(`/orders/${orderId}/cancel`, {}, { auth: true });
}

/** Logout: clear token and user from storage (no backend call). */
export function logout(): void {
  clearToken();
}

// ——— Cart API (requires auth) ———

/** GET /api/cart – trả về CartItem[] (mapped từ CartDto) */
export async function getCart(): Promise<CartItem[]> {
  const dto = await apiGet<CartDto>('/cart', { auth: true });
  return mapCartDto(dto);
}

/** POST /api/cart/items */
export async function addCartItem(payload: {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity?: number;
  variant?: string;
  selectedColor?: string;
  selectedStorage?: string;
}): Promise<CartItem[]> {
  const body: Record<string, unknown> = {
    productId: Number(payload.productId),
    quantity: payload.quantity ?? 1,
    variant: payload.variant,
    name: payload.name,
    price: payload.price,
    image: payload.image,
  };
  if (payload.selectedColor != null && payload.selectedColor !== '') {
    body.selectedColor = payload.selectedColor;
  }
  if (payload.selectedStorage != null && payload.selectedStorage !== '') {
    body.selectedStorage = payload.selectedStorage;
  }
  const dto = await apiPost<CartDto>('/cart/items', body, { auth: true });
  return mapCartDto(dto);
}

/** PATCH /api/cart/items/:id */
export async function updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItem[]> {
  const dto = await apiPatch<CartDto>(`/cart/items/${encodeURIComponent(cartItemId)}`, { quantity }, { auth: true });
  return mapCartDto(dto);
}

/** DELETE /api/cart/items/:id */
export async function removeCartItem(cartItemId: string): Promise<CartItem[]> {
  const dto = await apiDelete<CartDto>(`/cart/items/${encodeURIComponent(cartItemId)}`, { auth: true });
  return mapCartDto(dto);
}

/** DELETE /api/cart/items — xóa toàn bộ giỏ (server) */
export async function clearCartAll(): Promise<CartItem[]> {
  const dto = await apiDelete<CartDto>('/cart/items', { auth: true });
  return mapCartDto(dto);
}

// ——— Profile & Password (requires auth) ———

/** GET /api/profile */
export async function getProfile(): Promise<ProfileDto> {
  return apiGet<ProfileDto>('/profile', { auth: true });
}

/** PATCH /api/profile */
export async function updateProfile(body: {
  name?: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
}): Promise<ProfileDto> {
  return apiPatch<ProfileDto>('/profile', body, { auth: true });
}

/** POST /api/profile/linked-accounts/google/unlink */
export async function unlinkGoogleAccount(): Promise<ProfileDto> {
  return apiPost<ProfileDto>('/profile/linked-accounts/google/unlink', {}, { auth: true });
}

/** POST /api/auth/change-password */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string; passwordChangedAt?: string }> {
  return apiPost<{ message: string; passwordChangedAt?: string }>('/auth/change-password', {
    currentPassword,
    newPassword,
  }, { auth: true });
}

// ——— Addresses (requires auth) ———

export interface AddressPayload {
  name: string;
  phone: string;
  street: string;
  apartment?: string | null;
  label?: string | null;
  city: string;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  isDefault?: boolean;
}

/** GET /api/addresses */
export async function getAddresses(): Promise<AddressDto[]> {
  return apiGet<AddressDto[]>('/addresses', { auth: true });
}

/** POST /api/addresses */
export async function createAddress(body: AddressPayload): Promise<AddressDto> {
  return apiPost<AddressDto>('/addresses', body, { auth: true });
}

/** PATCH /api/addresses/:id */
export async function updateAddress(id: number, body: Partial<AddressPayload>): Promise<AddressDto> {
  return apiPatch<AddressDto>(`/addresses/${id}`, body, { auth: true });
}

/** DELETE /api/addresses/:id */
export async function deleteAddress(id: number): Promise<void> {
  await apiDelete<{ message?: string }>(`/addresses/${id}`, { auth: true });
}

/** PUT /api/addresses/:id/set-default */
export async function setDefaultAddress(id: number): Promise<AddressDto> {
  return apiPut<AddressDto>(`/addresses/${id}/set-default`, {}, { auth: true });
}
