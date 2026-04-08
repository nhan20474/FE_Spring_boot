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
  /** JSON string: [{ name, hex }, ...] */
  colors?: string | null;
  /** JSON string: string[] hoặc legacy { capacity }[] */
  storageOptions?: string | null;
  /** JSON string: object thông số kỹ thuật */
  specifications?: string | null;
  /** Điểm sao trung bình (0 nếu chưa có đánh giá). */
  rating?: number | null;
  /** Số lượt đánh giá. */
  reviews?: number | null;
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
  authProvider?: 'LOCAL' | 'GOOGLE' | string;
  providerId?: string | null;
  /** ISO instant — null/undefined nếu chưa xác minh email */
  emailVerifiedAt?: string | null;
}

/** Profile từ GET /api/profile (UserDto). */
export interface ProfileDto {
  id: number;
  name: string;
  email: string;
  authProvider?: 'LOCAL' | 'GOOGLE' | string;
  providerId?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  defaultAddress?: AddressDto | null;
  passwordChangedAt?: string | null;
  emailVerifiedAt?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUserDto;
}

export interface CreateOrderItemRequest {
  productId: number;
  quantity: number;
  /** Không gửi — backend lấy giá từ DB */
  price?: number;
  selectedColor?: string | null;
  selectedStorage?: string | null;
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
  /** Gửi kèm khi đã áp dụng mã — backend tính lại và bắt buộc khớp giảm giá */
  couponCode?: string | null;
}

export interface OrderItemDto {
  /** Id dòng đơn — dùng cho PUT /api/product-ratings */
  id: number;
  productId: number | null;
  productName: string;
  productImage?: string | null;
  quantity: number;
  priceAtOrder: number;
  lineTotal?: number | null;
  selectedColor?: string | null;
  selectedStorage?: string | null;
}

/** GET /api/orders — shipment kèm theo đơn (nếu có). */
export interface ShipmentDto {
  id: number;
  orderId: number;
  carrier?: string | null;
  trackingNumber?: string | null;
  status?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  /** URL tra cứu vận đơn đầy đủ (theo quy ước nội bộ). */
  note?: string | null;
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
  couponCode?: string | null;
  status: string;
  paymentMethod?: string | null;
  createdAt: string;
  items: OrderItemDto[];
  shipment?: ShipmentDto | null;
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
  couponCode?: string | null;
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

/** PUT /api/admin/orders/{orderId}/shipment — chỉ field gửi lên mới được cập nhật (null = bỏ qua). */
export interface UpsertShipmentRequest {
  carrier?: string | null;
  trackingNumber?: string | null;
  status?: string | null;
  note?: string | null;
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
  reason?: string | null;
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

/** GET /api/admin/inbox */
export interface AdminInboxItemDto {
  auditId: number;
  orderId: number;
  customerName: string;
  oldStatus: string;
  newStatus: string;
  actor: string;
  note?: string | null;
  changedAt: string;
  read: boolean;
}

export interface AdminInboxResponse {
  items: AdminInboxItemDto[];
  unreadCount: number;
}

export interface AdminChatConversationDto {
  userId: number;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastRole: 'user' | 'assistant';
  lastSentAt: string;
}

export interface AdminChatConversationMessagesDto {
  user: {
    id: number;
    name: string;
    email: string;
  };
  messages: ChatMessageDto[];
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

/** PUT /api/product-ratings */
export interface UpsertProductRatingRequest {
  orderItemId: number;
  rating: number;
}

export interface ProductRatingResponseDto {
  id: number;
  orderItemId: number | null;
  productId: number | null;
  rating: number;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  /** Tồn kho hiện tại (server) */
  stock?: number | null;
}

export interface CartDto {
  id: number;
  userId: number;
  items: CartItemDto[];
  itemCount: number;
  totalPrice: number;
}

/** Một tin nhắn trong lịch sử chat — GET /api/chat/history */
export interface ChatMessageDto {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sentAt: string;
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
