import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  adminGetOrder,
  adminGetOrderReturns,
  adminGetOrderStatusHistory,
  adminUpdateReturnStatus,
  adminUpdateOrderStatus,
  adminGetShipment,
  adminUpsertShipment,
  downloadAdminOrderInvoicePdf,
} from '@/services/backend';
import { ApiError } from '@/services/api';
import type { AdminOrderDto, OrderStatusHistoryDto, ReturnRequestDto, ShipmentDto } from '@/types/api';
import { formatDate } from '@/utils/formatDate';
import { formatVND } from '@/utils';
import OrderStatusChanger from '@/components/admin/OrderStatusChanger';
import {
  ORDER_STATUS_OPTIONS,
  orderStatusLabel,
  paymentMethodLabel,
  formatOrderHistoryActor,
  returnRequestStatusLabel,
  type OrderStatusOption,
} from '@/utils/orderDisplay';

const SHIPMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Chờ gửi' },
  { value: 'shipping', label: 'Đang vận chuyển' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'failed', label: 'Thất bại / lỗi' },
];

const TERMINAL_ORDER_STATUSES = new Set([
  'cancelled',
  'rejected',
  'refunded',
  'returned',
  'completed',
]);

/** Khớp backend OrderStatusService.ADMIN_TRANSITIONS */
const ADMIN_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  pending_payment: ['cancelled', 'rejected'],
  paid: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled', 'rejected'],
  processing: ['shipped', 'cancelled', 'rejected'],
  shipping: ['shipped', 'delivered', 'completed', 'cancelled', 'rejected'],
  shipped: ['delivered', 'completed', 'cancelled', 'rejected'],
  delivered: ['completed', 'cancelled', 'rejected'],
};

function adminStatusOptionsForCurrent(currentRaw: string): OrderStatusOption[] {
  const cur = String(currentRaw ?? '').trim().toLowerCase();
  if (!cur || TERMINAL_ORDER_STATUSES.has(cur)) {
    return ORDER_STATUS_OPTIONS.filter((o) => o.value === cur);
  }
  const next = ADMIN_STATUS_TRANSITIONS[cur];
  if (!next?.length) {
    return ORDER_STATUS_OPTIONS.filter((o) => o.value === cur);
  }
  const allow = new Set<string>([cur, ...next]);
  return ORDER_STATUS_OPTIONS.filter((o) => allow.has(o.value));
}

function isValidShipmentTrackingUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/25 focus:border-primary';

const btnIcon =
  'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50';

function adminOrderStatusBadgeClass(statusRaw: string): string {
  const s = String(statusRaw ?? '').trim().toLowerCase();
  if (s === 'completed' || s === 'delivered') return 'admin-badge completed';
  if (s === 'cancelled' || s === 'rejected' || s === 'refunded' || s === 'returned') return 'admin-badge rejected';
  if (s === 'shipped' || s === 'shipping' || s === 'paid' || s === 'confirmed' || s === 'processing')
    return 'admin-badge processing';
  return 'admin-badge processing';
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
  className = '',
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <span className="material-icons text-primary text-xl shrink-0" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-900 text-right tabular-nums">{value}</span>
    </div>
  );
}

function FlashMessage({ type, text }: { type: 'ok' | 'err'; text: string }) {
  const cls =
    type === 'ok'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
      : 'bg-red-50 text-red-700 border-red-100';
  return <div className={`mb-3 rounded-md border px-3 py-2 text-sm ${cls}`}>{text}</div>;
}

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();

  const invoiceHref =
    orderId != null ? `/admin/orders/invoice?orderId=${encodeURIComponent(orderId)}` : '/admin/orders/invoice';

  const [order, setOrder] = useState<AdminOrderDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistoryDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [returns, setReturns] = useState<ReturnRequestDto[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnStatusUpdatingId, setReturnStatusUpdatingId] = useState<number | null>(null);

  const [shipment, setShipment] = useState<ShipmentDto | null>(null);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    carrier: '',
    trackingNumber: '',
    note: '',
    status: 'pending',
  });
  const [shipmentMessage, setShipmentMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [returnError, setReturnError] = useState<string | null>(null);
  const [changerOpen, setChangerOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [invoicePdfLoading, setInvoicePdfLoading] = useState(false);

  const loadShipment = useCallback(async () => {
    if (!orderId) {
      setShipment(null);
      return;
    }
    setShipmentLoading(true);
    setShipmentMessage(null);
    try {
      const s = await adminGetShipment(orderId);
      setShipment(s);
    } catch {
      setShipment(null);
    } finally {
      setShipmentLoading(false);
    }
  }, [orderId]);

  const handleDownloadInvoicePdf = useCallback(() => {
    if (!orderId) return;
    void (async () => {
      setInvoicePdfLoading(true);
      try {
        await downloadAdminOrderInvoicePdf(orderId);
      } catch (e) {
        window.alert(e instanceof ApiError ? e.message : 'Không tải được PDF từ máy chủ.');
      } finally {
        setInvoicePdfLoading(false);
      }
    })();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setStatusHistory([]);
      return;
    }
    setLoading(true);
    adminGetOrder(orderId)
      .then((dto) => setOrder(dto))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    void loadShipment();
  }, [loadShipment]);

  useEffect(() => {
    if (!shipment) {
      setShipmentForm({ carrier: '', trackingNumber: '', note: '', status: 'pending' });
      return;
    }
    setShipmentForm({
      carrier: shipment.carrier ?? '',
      trackingNumber: shipment.trackingNumber ?? '',
      note: shipment.note ?? '',
      status: shipment.status ?? 'pending',
    });
  }, [shipment]);

  useEffect(() => {
    if (!orderId) {
      setStatusHistory([]);
      return;
    }
    setHistoryLoading(true);
    adminGetOrderStatusHistory(orderId)
      .then((rows) => setStatusHistory(rows))
      .catch(() => setStatusHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setReturns([]);
      return;
    }
    setReturnsLoading(true);
    adminGetOrderReturns(orderId)
      .then((rows) => setReturns(rows))
      .catch(() => setReturns([]))
      .finally(() => setReturnsLoading(false));
  }, [orderId]);

  const currentBackendStatus = String(order?.status ?? 'pending').trim().toLowerCase();
  const statusChangerOptions = useMemo(
    () => adminStatusOptionsForCurrent(order?.status ?? ''),
    [order?.status],
  );
  const items = order?.items ?? [];
  const customerName = order?.customerName ?? '—';
  const address = order?.shippingAddressSummary ?? '—';
  const subtotal = order?.subtotal != null ? Number(order.subtotal) : null;
  const discount = order?.discountAmount != null ? Number(order.discountAmount) : null;
  const shippingCost = order?.shippingCost != null ? Number(order.shippingCost) : null;

  const totalCost = useMemo(() => {
    if (order?.totalPrice != null) return Number(order.totalPrice);
    return items.reduce((sum, i) => sum + i.quantity * i.priceAtOrder, 0);
  }, [items, order?.totalPrice]);

  const handleApplyStatus = async (nextBackend: string) => {
    if (!orderId) return;
    const next = String(nextBackend ?? '').trim().toLowerCase();
    if (next === currentBackendStatus) {
      setChangerOpen(false);
      return;
    }
    const allowedValues = new Set(statusChangerOptions.map((o) => o.value));
    if (!allowedValues.has(next)) {
      setStatusError('Không được chuyển sang trạng thái này từ bước hiện tại. Kiểm tra quy trình đơn (ví dụ: xác nhận đơn trước khi thêm vận chuyển).');
      return;
    }
    try {
      setUpdating(true);
      setStatusError(null);
      const updated = await adminUpdateOrderStatus(orderId, { status: nextBackend });
      setOrder(updated);
      try {
        const rows = await adminGetOrderStatusHistory(orderId);
        setStatusHistory(rows);
      } catch {
        /* keep */
      }
      await loadShipment();
      setChangerOpen(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không cập nhật được trạng thái';
      setStatusError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveShipment = async () => {
    if (!orderId) return;
    const carrierT = shipmentForm.carrier.trim();
    if (carrierT.length > 0 && carrierT.length < 2) {
      setShipmentMessage({ type: 'err', text: 'Tên đơn vị vận chuyển quá ngắn (tối thiểu 2 ký tự).' });
      return;
    }
    const noteT = shipmentForm.note.trim();
    if (noteT.length > 0 && !isValidShipmentTrackingUrl(noteT)) {
      setShipmentMessage({
        type: 'err',
        text: 'Link tra cứu phải là URL http(s) hợp lệ. Nếu chưa có link, để trống hoặc dán đúng định dạng https://…',
      });
      return;
    }
    setShipmentSaving(true);
    setShipmentMessage(null);
    try {
      const saved = await adminUpsertShipment(orderId, {
        carrier: shipmentForm.carrier.trim() || undefined,
        trackingNumber: shipmentForm.trackingNumber.trim() || undefined,
        note: shipmentForm.note.trim() || undefined,
        status: shipmentForm.status || undefined,
      });
      setShipment(saved);
      setShipmentMessage({
        type: 'ok',
        text: 'Đã lưu. Nhớ đổi trạng thái đơn sang «Đã giao shipper» khi bàn giao.',
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không lưu được vận chuyển';
      setShipmentMessage({ type: 'err', text: msg });
    } finally {
      setShipmentSaving(false);
    }
  };

  const handlePatchReturnStatus = async (returnId: number, status: 'approved' | 'rejected' | 'refunded') => {
    if (!orderId) return;
    setReturnError(null);
    setReturnStatusUpdatingId(returnId);
    try {
      await adminUpdateReturnStatus(returnId, { status });
      const rows = await adminGetOrderReturns(orderId);
      setReturns(rows);
      const o = await adminGetOrder(orderId);
      setOrder(o);
    } catch (e) {
      setReturnError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái trả hàng');
    } finally {
      setReturnStatusUpdatingId(null);
    }
  };

  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link to="/admin/orders" className="text-xs text-slate-500 hover:text-primary mb-1 inline-block">
            ← Danh sách đơn
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Đơn #{orderId ?? '—'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {order?.createdAt ? `Đặt lúc ${formatDate(order.createdAt)}` : loading ? 'Đang tải…' : '—'}
          </p>
        </div>
        {orderId != null && (
          <div className="flex flex-wrap gap-2">
            <Link
              to={invoiceHref}
              className={`${btnIcon} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              <span className="material-icons text-lg">description</span>
              Hóa đơn
            </Link>
            <button
              type="button"
              disabled={invoicePdfLoading}
              onClick={handleDownloadInvoicePdf}
              className={`${btnIcon} border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none`}
            >
              <span className="material-icons text-lg">picture_as_pdf</span>
              {invoicePdfLoading ? 'Đang tải…' : 'Tải PDF'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <SectionCard icon="flag" title="Trạng thái" subtitle="Chỉ chuyển khi đúng bước xử lý.">
            {loading && !order ? (
              <p className="text-sm text-slate-500">Đang tải đơn…</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={adminOrderStatusBadgeClass(order?.status ?? '')}>
                    {orderStatusLabel(order?.status ?? '—')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{currentBackendStatus}</span>
                </div>
                <p className="text-sm text-slate-600">
                  Thanh toán: <span className="text-slate-900">{paymentMethodLabel(order?.paymentMethod)}</span>
                  {order?.notes ? (
                    <>
                      <br />
                      <span className="text-slate-500">Ghi chú:</span> {order.notes}
                    </>
                  ) : null}
                </p>
                {statusError && <p className="text-sm text-red-600">{statusError}</p>}
                {orderId != null && (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => {
                      setStatusError(null);
                      setChangerOpen(true);
                    }}
                    className={`${btnIcon} bg-primary text-white border-primary hover:opacity-90`}
                  >
                    <span className="material-icons text-lg">sync_alt</span>
                    Đổi trạng thái
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard icon="inventory_2" title="Sản phẩm">
            {loading ? (
              <p className="text-sm text-slate-500">Đang tải…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">Không có sản phẩm.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="pb-2 pr-2 font-medium">Sản phẩm</th>
                      <th className="pb-2 pr-2 font-medium">Biến thể</th>
                      <th className="pb-2 pr-2 font-medium text-right w-12">SL</th>
                      <th className="pb-2 pr-2 font-medium text-right">Đơn giá</th>
                      <th className="pb-2 font-medium text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const lineTotal = it.lineTotal ?? it.quantity * it.priceAtOrder;
                      const variant = [it.selectedColor, it.selectedStorage].filter(Boolean).join(' · ') || '—';
                      return (
                        <tr
                          key={it.productId != null ? String(it.productId) : String(idx)}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-2.5 pr-2 text-slate-900">{it.productName}</td>
                          <td className="py-2.5 pr-2 text-slate-600">{variant}</td>
                          <td className="py-2.5 pr-2 text-right tabular-nums">{it.quantity}</td>
                          <td className="py-2.5 pr-2 text-right tabular-nums">{formatVND(it.priceAtOrder)}</td>
                          <td className="py-2.5 text-right font-medium tabular-nums">{formatVND(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard icon="person" title="Khách & giao hàng">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Tên khách</p>
                <p className="font-medium text-slate-900">{customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Địa chỉ</p>
                <p className="text-slate-700 leading-relaxed">{address}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon="payments" title="Thanh toán">
            <div className="space-y-2">
              <DetailRow label="Tạm tính" value={subtotal != null ? formatVND(subtotal) : '—'} />
              <DetailRow
                label="Giảm giá"
                value={
                  discount != null ? (discount > 0 ? `−${formatVND(discount)}` : formatVND(0)) : '—'
                }
              />
              {order?.couponCode ? (
                <DetailRow label="Mã giảm giá" value={<span className="font-mono text-xs">{order.couponCode}</span>} />
              ) : null}
              <DetailRow
                label="Phí ship"
                value={shippingCost != null ? (shippingCost === 0 ? 'Miễn phí' : formatVND(shippingCost)) : '—'}
              />
              <div className="border-t border-slate-100 pt-3 mt-2 flex justify-between items-baseline gap-4">
                <span className="text-sm font-semibold text-slate-900">Tổng</span>
                <span className="text-lg font-semibold text-primary tabular-nums">{formatVND(totalCost)}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard icon="local_shipping" title="Vận chuyển" subtitle="Đơn vị, mã vận đơn, link tra cứu.">
        {shipmentLoading ? (
          <p className="text-sm text-slate-500">Đang tải…</p>
        ) : (
          <>
            {shipmentMessage && <FlashMessage type={shipmentMessage.type} text={shipmentMessage.text} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className={labelCls}>Đơn vị</span>
                <input
                  className={inputCls}
                  value={shipmentForm.carrier}
                  onChange={(e) => setShipmentForm((f) => ({ ...f, carrier: e.target.value }))}
                  placeholder="GHTK, GHN…"
                />
              </label>
              <label className="block">
                <span className={labelCls}>Mã vận đơn</span>
                <input
                  className={inputCls}
                  value={shipmentForm.trackingNumber}
                  onChange={(e) => setShipmentForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                  placeholder="Tracking"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Link tra cứu</span>
                <input
                  className={`${inputCls} font-mono text-xs`}
                  value={shipmentForm.note}
                  onChange={(e) => setShipmentForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Trạng thái shipment</span>
                <select
                  className={inputCls}
                  value={shipmentForm.status}
                  onChange={(e) => setShipmentForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {SHIPMENT_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!orderId || shipmentSaving}
                onClick={() => void handleSaveShipment()}
                className={`${btnIcon} border-slate-900 bg-slate-900 text-white hover:bg-slate-800`}
              >
                <span className="material-icons text-lg">save</span>
                {shipmentSaving ? 'Đang lưu…' : 'Lưu'}
              </button>
              <button
                type="button"
                disabled={shipmentLoading}
                onClick={() => void loadShipment()}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                Tải lại
              </button>
            </div>
          </>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard icon="history" title="Lịch sử trạng thái">
          {historyLoading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : statusHistory.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
          ) : (
            <ul className="space-y-3 border-l-2 border-slate-200 pl-4 ml-1">
              {statusHistory.map((h, idx) => (
                <li key={`${h.changedAt}-${idx}`} className="relative">
                  <span
                    className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white"
                    aria-hidden
                  />
                  <p className="text-sm text-slate-900">
                    <span className="text-slate-600">{orderStatusLabel(h.oldStatus)}</span>
                    <span className="mx-1 text-slate-300">→</span>
                    {orderStatusLabel(h.newStatus)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatOrderHistoryActor(h.actor)} · {formatDate(h.changedAt)}
                  </p>
                  {h.note ? <p className="text-sm text-slate-600 mt-1 bg-slate-50 rounded px-2 py-1.5">{h.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon="assignment_return"
          title="Trả hàng"
          subtitle="Chỉ xử lý khi khách đã gửi yêu cầu từ tài khoản. Admin không tạo yêu cầu thay khách."
        >
          {returnError && <p className="text-sm text-red-600 mb-3">{returnError}</p>}
          {returnsLoading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : returns.length === 0 ? (
            <p className="text-sm text-slate-600">
              Chưa có yêu cầu trả hàng. Khi khách gửi từ trang chi tiết đơn (tài khoản), danh sách và thao tác duyệt / từ chối /
              hoàn tiền sẽ hiển thị tại đây.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1 mb-4">
              <table className="w-full min-w-[440px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-2 font-medium">ID</th>
                    <th className="pb-2 pr-2 font-medium">Trạng thái</th>
                    <th className="pb-2 pr-2 font-medium">Lý do</th>
                    <th className="pb-2 pr-2 font-medium text-right">Hoàn</th>
                    <th className="pb-2 pr-2 font-medium">Kho</th>
                    <th className="pb-2 font-medium text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => {
                    const st = String(r.status ?? '').toLowerCase();
                    const busy = returnStatusUpdatingId === r.id;
                    const btnReturn = 'rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40';
                    const canApproveOrReject = st === 'requested';
                    const canRefund = st === 'approved';
                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-mono text-slate-600">{r.id}</td>
                        <td className="py-2 pr-2">{returnRequestStatusLabel(String(r.status ?? ''))}</td>
                        <td className="py-2 pr-2 text-slate-600 max-w-[120px] truncate" title={r.reason ?? ''}>
                          {r.reason ?? '—'}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {r.refundAmount != null ? formatVND(r.refundAmount) : '—'}
                        </td>
                        <td className="py-2 pr-2">{r.restocked ? 'Có' : '—'}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1 justify-end">
                            <button
                              type="button"
                              disabled={busy || !canApproveOrReject}
                              onClick={() => void handlePatchReturnStatus(r.id, 'approved')}
                              className={`${btnReturn} border-emerald-200 bg-emerald-50 text-emerald-800`}
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              disabled={busy || !canApproveOrReject}
                              onClick={() => void handlePatchReturnStatus(r.id, 'rejected')}
                              className={`${btnReturn} border-rose-200 bg-rose-50 text-rose-800`}
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={busy || !canRefund}
                              onClick={() => void handlePatchReturnStatus(r.id, 'refunded')}
                              className={`${btnReturn} border-slate-200 bg-slate-50 text-slate-800`}
                            >
                              Hoàn tiền
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <OrderStatusChanger
        isOpen={changerOpen}
        currentValue={currentBackendStatus}
        options={statusChangerOptions}
        onClose={() => setChangerOpen(false)}
        onApply={(next) => void handleApplyStatus(next)}
      />
    </div>
  );
};

export default OrderDetailPage;
