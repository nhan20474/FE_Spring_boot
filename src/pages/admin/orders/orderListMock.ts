/**
 * Kiểu và hằng số lọc danh sách đơn (admin) — dữ liệu đơn lấy từ API.
 */

export type OrderStatus =
  | 'Completed'
  | 'Processing'
  | 'Rejected'
  | 'On Hold'
  | 'In Transit';

export const PAYMENT_METHOD_OPTIONS = [
  'cash_on_delivery',
  'vnpay',
  'momo',
] as const;

export type PaymentMethodOption = (typeof PAYMENT_METHOD_OPTIONS)[number];

export type AdminOrderRow = {
  id: string;
  name: string;
  address: string;
  /** Ngày đơn (local date) */
  date: Date;
  paymentMethod: string;
  status: OrderStatus;
};

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'Completed',
  'Processing',
  'Rejected',
  'On Hold',
  'In Transit',
];
