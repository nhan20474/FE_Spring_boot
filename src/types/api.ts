/**
 * DTOs and request/response types for backend API (http://localhost:8080/api).
 * Matches backend contract for frontend–backend linking.
 */

export interface CategoryDto {
  id: number;
  name: string;
  slug?: string | null;
  parentId?: number | null;
  description?: string | null;
}

export interface ProductDto {
  id: number;
  name: string;
  slug?: string | null;
  description: string | null;
  image: string | null;
  price: number;
  categoryId?: number | null;
  categoryName?: string | null;
  stock?: number | null;
  featured?: boolean | null;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthUserDto {
  id: number;
  name: string;
  email: string;
  /** Backend trả về lowercase: 'admin' | 'customer' */
  role?: 'admin' | 'customer';
}

/** Profile từ GET /api/profile (UserDto). */
export interface ProfileDto {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  defaultAddress?: AddressDto | null;
  passwordChangedAt?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUserDto;
}

export interface CreateOrderItemRequest {
  productId: number;
  quantity: number;
  price: number;
}

export interface CreateOrderRequest {
  totalPrice: number;
  items: CreateOrderItemRequest[];
  shippingAddressId?: number | null;
  subtotal?: number | null;
  discountAmount?: number | null;
  shippingCost?: number | null;
  paymentMethod?: string | null;
  notes?: string | null;
}

export interface OrderItemDto {
  productId: number | null;
  productName: string;
  productImage?: string | null;
  quantity: number;
  priceAtOrder: number;
  lineTotal?: number | null;
  selectedColor?: string | null;
  selectedStorage?: string | null;
}

export interface OrderDto {
  id: number;
  userId: number;
  shippingAddressId?: number | null;
  subtotal?: number | null;
  discountAmount?: number | null;
  shippingCost?: number | null;
  totalPrice: number;
  notes?: string | null;
  status: string;
  paymentMethod?: string | null;
  createdAt: string;
  items: OrderItemDto[];
}

/** Admin order payload used by /api/admin/orders */
export interface AdminOrderItemDto {
  productId: number | null;
  productName: string;
  productImage?: string | null;
  quantity: number;
  priceAtOrder: number;
  lineTotal: number;
  selectedColor?: string | null;
  selectedStorage?: string | null;
}

export interface AdminOrderDto {
  id: number;
  customerName?: string | null;
  shippingAddressSummary?: string | null;
  items: AdminOrderItemDto[];
  subtotal?: number | null;
  discountAmount?: number | null;
  shippingCost?: number | null;
  totalPrice: number;
  paymentMethod?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
}

export interface AdminOrdersResponse {
  items: AdminOrderDto[];
  page: number;
  size: number;
  total: number;
  totalElements?: number;
  totalPages?: number;
}

export interface OrderStatusHistoryDto {
  oldStatus: string;
  newStatus: string;
  actor: string;
  note?: string | null;
  changedAt: string;
}


export interface ReturnRequestDto {
  id: number;
  orderId: number;
  status: string;
  reason?: string | null;
  refundAmount?: number | null;
  note?: string | null;
  restocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAdminOrderStatusRequest {
  status: string;
}

export interface ApiErrorBody {
  message?: string;
  [key: string]: unknown;
}

/** GET /api/admin/dashboard/summary */
export interface AdminDashboardSummaryDto {
  revenue: number;
  ordersByStatus: Record<string, number>;
  recentOrders: Array<{
    id: number;
    totalPrice: number;
    status: string | null;
    createdAt: string;
    customerName?: string | null;
  }>;
}

/** GET/POST /api/admin/coupons */
export interface CouponDto {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  active?: boolean | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface CreateCouponRequestBody {
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  active?: boolean | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** GET /api/admin/users */
export interface AdminUserDto {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  phone?: string | null;
  createdAt?: string | null;
}

export interface AdminUsersResponse {
  items: AdminUserDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** GET /api/wishlist */
export interface WishlistItemDto {
  id: number;
  productId: string | null;
  name: string | null;
  image: string | null;
  price: number | null;
  oldPrice?: number | null;
  rating?: number | null;
  reviews?: number | null;
}

// ——— Cart DTOs (matches backend CartDto / CartItemDto) ———

export interface CartItemDto {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null;
  quantity: number;
  selectedColor: string | null;
  selectedStorage: string | null;
  variant?: string | null;
  priceAtAdd: number;
  lineTotal: number;
}

export interface CartDto {
  id: number;
  userId: number;
  items: CartItemDto[];
  itemCount: number;
  totalPrice: number;
}

/** Địa chỉ — GET/POST/PATCH /api/addresses */
export interface AddressDto {
  id: number;
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
