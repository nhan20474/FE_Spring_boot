/**
 * Kiểu và hằng số lọc danh sách đơn (admin) — dữ liệu đơn lấy từ API.
 */

export type OrderStatus =
  | 'Completed'
  | 'Processing'
  | 'Rejected'
  | 'On Hold'
  | 'In Transit';

/** Các chip trong popup "Select Order Type" */
export const ORDER_TYPE_OPTIONS = [
  'Health & Medicine',
  'Book & Stationary',
  'Services & Industry',
  'Fashion & Beauty',
  'Home & Living',
  'Electronics',
  'Mobile & Phone',
  'Accessories',
] as const;

export type OrderTypeOption = (typeof ORDER_TYPE_OPTIONS)[number];

export type AdminOrderRow = {
  id: string;
  name: string;
  address: string;
  /** Ngày đơn (local date) */
  date: Date;
  /** Hiển thị cột TYPE (Electric, Book, …) */
  typeLabel: string;
  /** Một hoặc nhiều chip type khớp khi lọc */
  typeKeys: OrderTypeOption[];
  status: OrderStatus;
};

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'Completed',
  'Processing',
  'Rejected',
  'On Hold',
  'In Transit',
];
