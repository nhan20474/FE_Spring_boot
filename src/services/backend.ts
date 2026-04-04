/**
 * Backend API service – endpoints as per backend–frontend linking doc.
 * All paths are relative to API_BASE (e.g. http://localhost:8080/api).
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  setToken as storeToken,
  setStoredUser,
  clearToken,
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
  OrderDto,
  ProfileDto,
  CartDto,
  CartItemDto,
  AddressDto,
  ShipmentDto,
  ReturnRequestDto,
  AdminDashboardSummaryDto,
  CouponDto,
  CreateCouponRequestBody,
  AdminUsersResponse,
  AdminUserDto,
  WishlistItemDto,
} from '@/types/api';
import type { CartItem } from '@/types';

export interface ProductsParams {
  category?: number;
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

interface ShipmentNullResponse {
  shipment: null;
}

interface InventoryReplayResponse {
  idempotentReplay?: boolean;
  operation?: string;
  stock?: InventoryStockDto;
}

export interface CheckoutQuoteRequest {
  items?: Array<{ productId: number; quantity: number; price: number }>;
  couponCode?: string;
  shippingCost?: number;
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

/** Handle shipment union: ShipmentDto OR { shipment: null } */
function extractShipment(response: ShipmentDto | ShipmentNullResponse | null | undefined): ShipmentDto | null {
  if (!response || typeof response !== 'object') return null;
  if ('shipment' in response) return null;
  return response as ShipmentDto;
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
    price: Number(item.priceAtAdd ?? 0),
    quantity: item.quantity ?? 1,
    image: item.productImage ?? '',
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

/** POST /api/auth/forgot-password */
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

/** GET /api/categories */
export async function getCategories(): Promise<CategoryDto[]> {
  const raw = await apiGet<CategoryDto[] | PageResponse<CategoryDto>>('/categories', { auth: false });
  return extractList(raw);
}

/** GET /api/products?category=&q=&page=&size= */
export async function getProducts(params: ProductsParams = {}): Promise<ProductDto[]> {
  const sp = new URLSearchParams();
  if (params.category != null) sp.set('category', String(params.category));
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

/** GET /api/admin/orders/{orderId}/shipment */
export async function adminGetShipment(orderId: number | string): Promise<ShipmentDto | null> {
  const raw = await apiGet<ShipmentDto | ShipmentNullResponse>(`/admin/orders/${orderId}/shipment`, { auth: true });
  return extractShipment(raw);
}

/** PUT /api/admin/orders/{orderId}/shipment */
export async function adminUpsertShipment(
  orderId: number | string,
  body: { carrier?: string; trackingNumber?: string; status?: string; note?: string }
): Promise<ShipmentDto> {
  return apiPut<ShipmentDto>(`/admin/orders/${orderId}/shipment`, body, { auth: true });
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

/** GET /api/orders/{id}/shipment */
export async function getOrderShipment(id: number | string): Promise<ShipmentDto | null> {
  const raw = await apiGet<ShipmentDto | ShipmentNullResponse>(`/orders/${id}/shipment`, { auth: true });
  return extractShipment(raw);
}

/** POST /api/checkout/quote */
export async function checkoutQuote(body: CheckoutQuoteRequest): Promise<CheckoutQuoteResponse> {
  return apiPost<CheckoutQuoteResponse>('/checkout/quote', body, { auth: true });
}

/** PATCH /api/orders/{id}/receive — COD: customer confirms received */
export async function receiveOrder(orderId: number | string): Promise<OrderDto> {
  return apiPatch<OrderDto>(`/orders/${orderId}/receive`, {}, { auth: true });
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
}): Promise<CartItem[]> {
  const dto = await apiPost<CartDto>('/cart/items', {
    productId: Number(payload.productId),
    quantity: payload.quantity ?? 1,
    variant: payload.variant,
  }, { auth: true });
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
