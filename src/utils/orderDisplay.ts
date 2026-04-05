import type { OrderDetailsStep } from '@/types';

/** Giá trị trạng thái đơn từ backend (chữ thường) — đồng bộ admin / khách. */
export type OrderBackendStatusValue =
  | 'pending'
  | 'pending_payment'
  | 'paid'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'returned'
  | 'refunded';

export interface OrderStatusOption {
  value: OrderBackendStatusValue | string;
  label: string;
}

/** Danh mục trạng thái cho dropdown admin — cùng nguồn với nhãn hiển thị. */
export const ORDER_STATUS_OPTIONS: OrderStatusOption[] = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'pending_payment', label: 'Chờ thanh toán (VNPay)' },
  { value: 'paid', label: 'Đã thanh toán online' },
  { value: 'confirmed', label: 'Đã xác nhận có hàng' },
  { value: 'processing', label: 'Đang chuẩn bị / đóng gói' },
  { value: 'shipped', label: 'Đã giao cho đơn vị vận chuyển' },
  { value: 'shipping', label: 'Đang giao (legacy)' },
  { value: 'delivered', label: 'Đã giao tới khách' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'rejected', label: 'Từ chối đơn' },
  { value: 'returned', label: 'Trả hàng' },
  { value: 'refunded', label: 'Hoàn tiền' },
];

export function orderStatusLabel(statusRaw: string): string {
  const s = String(statusRaw ?? '').trim().toLowerCase();
  const hit = ORDER_STATUS_OPTIONS.find((o) => o.value === s);
  return hit?.label ?? (statusRaw ? String(statusRaw) : '—');
}

export function paymentMethodLabel(raw?: string | null): string {
  const m = String(raw ?? '').trim().toLowerCase();
  if (!m) return '—';
  const map: Record<string, string> = {
    cash_on_delivery: 'Thanh toán khi nhận hàng (COD)',
    vnpay: 'VNPay',
    credit_card: 'Thẻ',
    paypal: 'PayPal',
    momo: 'MoMo',
  };
  return map[m] ?? String(raw) ?? '—';
}

export function shipmentStatusLabel(raw?: string | null): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '—';
  const map: Record<string, string> = {
    pending: 'Chờ gửi',
    shipping: 'Đang vận chuyển',
    delivered: 'Đã giao',
    failed: 'Thất bại / lỗi',
  };
  return map[s] ?? s;
}

/** Nhãn trạng thái yêu cầu trả hàng (bảng return). */
export function returnRequestStatusLabel(statusRaw: string): string {
  const s = String(statusRaw ?? '').trim().toLowerCase();
  const map: Record<string, string> = {
    requested: 'Chờ xử lý',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    refunded: 'Đã hoàn tiền',
  };
  return map[s] ?? statusRaw ?? '—';
}

/** Khách được hủy đơn — khớp OrdersController + OrderStatusService (VNPay chờ thanh toán không hủy từ đây). */
export function canCustomerCancelOrder(statusRaw: string | undefined | null, paymentMethodRaw?: string | null): boolean {
  const st = String(statusRaw ?? '').trim().toLowerCase();
  const pm = String(paymentMethodRaw ?? '').trim().toLowerCase();
  if (st !== 'pending' && st !== 'pending_payment') return false;
  if (pm === 'vnpay' && st === 'pending_payment') return false;
  return true;
}

/** Khớp PATCH /orders/{id}/receive — chỉ COD khi đơn đã giao cho shipper. */
export function canCustomerConfirmCodReceived(statusRaw: string | undefined | null, paymentMethodRaw?: string | null): boolean {
  const st = String(statusRaw ?? '').trim().toLowerCase();
  const cod = pmIsCod(paymentMethodRaw);
  return cod && (st === 'shipped' || st === 'shipping');
}

function pmIsCod(raw?: string | null): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'cash_on_delivery';
}

/** Hiển thị lịch sử trạng thái thân thiện (audit actor từ backend). */
export function formatOrderHistoryActor(actor: string): string {
  const a = String(actor ?? '').trim();
  if (a.startsWith('customer:')) return 'Khách hàng';
  if (a === 'admin' || a.startsWith('admin:')) return 'Cửa hàng';
  if (a === 'system') return 'Hệ thống';
  return a || '—';
}

/**
 * Stepper tiến trình đơn (khách) — cùng nghiệp vụ trạng thái với admin.
 */
export function buildCustomerOrderStepper(
  statusRaw: string | undefined | null,
  placedDate: string,
): OrderDetailsStep[] {
  const s = String(statusRaw ?? '').trim().toLowerCase();

  if (['cancelled', 'rejected', 'refunded', 'returned'].includes(s)) {
    return [
      {
        label: 'Đã đặt hàng',
        sublabel: placedDate,
        completed: true,
        active: false,
        icon: 'check',
      },
      {
        label: orderStatusLabel(s),
        sublabel: 'Đơn đã kết thúc',
        completed: true,
        active: true,
        icon: 'flag',
      },
    ];
  }

  const step1: OrderDetailsStep = {
    label: 'Đã đặt hàng',
    sublabel: placedDate,
    completed: true,
    active: false,
    icon: 'check',
  };

  const pastAwaitingShop = !['pending', 'pending_payment'].includes(s);
  const step2: OrderDetailsStep = {
    label: 'Shop xác nhận',
    sublabel: pastAwaitingShop ? 'Đã xử lý' : 'Đang chờ cửa hàng',
    completed: pastAwaitingShop,
    active: !pastAwaitingShop,
    icon: 'store',
  };

  const pastShipperHandoff = ['shipped', 'shipping', 'delivered', 'completed'].includes(s);
  const step3: OrderDetailsStep = {
    label: 'Vận chuyển',
    sublabel: pastShipperHandoff ? 'Đang / đã giao' : 'Chờ bàn giao shipper',
    completed: pastShipperHandoff,
    active: pastAwaitingShop && !pastShipperHandoff,
    icon: 'local_shipping',
  };

  const pastDone = s === 'completed' || s === 'delivered';
  const step4: OrderDetailsStep = {
    label: 'Hoàn tất',
    sublabel: pastDone ? orderStatusLabel(s) : 'Chờ giao / xác nhận',
    completed: pastDone,
    active: pastShipperHandoff && !pastDone,
    icon: 'done_all',
  };

  return [step1, step2, step3, step4];
}
