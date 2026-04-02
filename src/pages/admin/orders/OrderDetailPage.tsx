import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  adminGetOrder,
  adminGetOrderReturns,
  adminGetOrderStatusHistory,
  adminGetShipment,
  adminUpsertShipment,
  adminCreateReturn,
  adminUpdateReturnStatus,
  adminUpdateOrderStatus,
} from '@/services/backend';
import type {
  AdminOrderDto,
  OrderStatusHistoryDto,
  ReturnRequestDto,
  ShipmentDto,
  UpdateAdminOrderStatusRequest,
} from '@/types/api';
import { formatDate } from '@/utils/formatDate';
import { formatVND } from '@/utils';
import { OrderStatusBadge as UiOrderStatusBadge, type OrderStatus } from '@/components/admin/OrderStatusBadge';
import OrderStatusChanger from '@/components/admin/OrderStatusChanger';

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const invoiceHref =
    orderId != null
      ? `/admin/orders/invoice?orderId=${encodeURIComponent(orderId)}`
      : '/admin/orders/invoice';

  const handleDownloadPdf = () => {
    if (orderId == null) return;
    navigate(`/admin/orders/invoice?orderId=${encodeURIComponent(orderId)}&autoprint=1`);
  };

  const [order, setOrder] = useState<AdminOrderDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistoryDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shipment, setShipment] = useState<ShipmentDto | null>(null);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipForm, setShipForm] = useState({
    carrier: '',
    trackingNumber: '',
    status: '',
    note: '',
  });
  const [returns, setReturns] = useState<ReturnRequestDto[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnForm, setReturnForm] = useState({ reason: '', refundAmount: '', note: '' });
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnStatusUpdatingId, setReturnStatusUpdatingId] = useState<number | null>(null);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [changerOpen, setChangerOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const statusOptionsForChanger: OrderStatus[] = useMemo(
    () => ['Processing', 'Shipping', 'Completed', 'Rejected'],
    [],
  );

  const mapBackendStatusToAdminStatus = (statusRaw: string): OrderStatus => {
    const s = String(statusRaw ?? '').trim().toLowerCase();
    if (s === 'cancelled' || s === 'canceled' || s === 'reject') return 'Rejected';
    if (s === 'paid' || s === 'completed') return 'Completed';
    if (s === 'pending' || s === 'pending_payment' || s === 'processing') return 'Processing';
    if (s === 'shipping') return 'Shipping';
    if (s === 'shipped' || s === 'delivered') return 'In Transit';
    if (s === 'returned' || s === 'refunded') return 'Rejected';
    return 'Processing';
  };

  const mapAdminStatusToBackendStatus = (adminStatus: OrderStatus): string => {
    switch (adminStatus) {
      case 'Completed':
        return 'paid';
      case 'Processing':
        return 'pending';
      case 'Rejected':
        return 'cancelled';
      case 'In Transit':
        return 'shipping';
      case 'Shipping':
        return 'shipping';
      default:
        return 'pending';
    }
  };

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
      setShipment(null);
      setShipForm({ carrier: '', trackingNumber: '', status: '', note: '' });
      return;
    }
    setShipmentLoading(true);
    setShipmentError(null);
    adminGetShipment(orderId)
      .then((s) => {
        setShipment(s);
        if (s) {
          setShipForm({
            carrier: s.carrier ?? '',
            trackingNumber: s.trackingNumber ?? '',
            status: s.status ?? '',
            note: s.note ?? '',
          });
        } else {
          setShipForm({ carrier: '', trackingNumber: '', status: 'pending', note: '' });
        }
      })
      .catch(() => {
        setShipment(null);
        setShipForm({ carrier: '', trackingNumber: '', status: 'pending', note: '' });
      })
      .finally(() => setShipmentLoading(false));
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

  const currentStatus: OrderStatus = mapBackendStatusToAdminStatus(order?.status ?? 'pending');

  const items = order?.items ?? [];
  const customerName = order?.customerName ?? '—';
  const address = order?.shippingAddressSummary ?? '—';
  const orderDate = order?.createdAt ? new Date(order.createdAt) : null;
  const typeLabel = 'Order';

  const totalCost = useMemo(() => {
    if (order?.totalPrice != null) return Number(order.totalPrice);
    return items.reduce((sum, i) => sum + i.quantity * i.priceAtOrder, 0);
  }, [items, order?.totalPrice]);

  const handleApplyStatus = async (nextStatus: OrderStatus) => {
    if (!orderId) return;
    try {
      setUpdating(true);
      const backendStatus = mapAdminStatusToBackendStatus(nextStatus);
      const body: UpdateAdminOrderStatusRequest = { status: backendStatus };
      const updated = await adminUpdateOrderStatus(orderId, body);
      setOrder(updated);
      try {
        const rows = await adminGetOrderStatusHistory(orderId);
        setStatusHistory(rows);
      } catch {
        /* keep previous history */
      }
      setChangerOpen(false);
    } catch {
      // keep modal open; user can retry
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveShipment = async () => {
    if (!orderId) return;
    setShipmentError(null);
    setShipmentSaving(true);
    try {
      const updated = await adminUpsertShipment(orderId, {
        carrier: shipForm.carrier.trim() || undefined,
        trackingNumber: shipForm.trackingNumber.trim() || undefined,
        status: shipForm.status.trim() || undefined,
        note: shipForm.note.trim() || undefined,
      });
      setShipment(updated);
      setShipForm({
        carrier: updated.carrier ?? '',
        trackingNumber: updated.trackingNumber ?? '',
        status: updated.status ?? '',
        note: updated.note ?? '',
      });
    } catch (e) {
      setShipmentError(e instanceof Error ? e.message : 'Không lưu được vận đơn');
    } finally {
      setShipmentSaving(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!orderId) return;
    setReturnError(null);
    const amt = returnForm.refundAmount.trim();
    const refundAmount = amt === '' ? undefined : Number(amt);
    if (amt !== '' && !Number.isFinite(refundAmount)) {
      setReturnError('Số tiền hoàn không hợp lệ');
      return;
    }
    setReturnSubmitting(true);
    try {
      await adminCreateReturn(orderId, {
        reason: returnForm.reason.trim() || undefined,
        refundAmount,
        note: returnForm.note.trim() || undefined,
      });
      const rows = await adminGetOrderReturns(orderId);
      setReturns(rows);
      setReturnForm({ reason: '', refundAmount: '', note: '' });
    } catch (e) {
      setReturnError(e instanceof Error ? e.message : 'Không tạo được yêu cầu trả hàng');
    } finally {
      setReturnSubmitting(false);
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
    } catch (e) {
      setReturnError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái trả hàng');
    } finally {
      setReturnStatusUpdatingId(null);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Chi tiết đơn hàng</h1>
          <p className="text-xs font-semibold text-slate-500">
            Mã đơn: <span className="font-bold text-slate-700">{orderId ?? '(placeholder)'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {orderId != null && (
            <>
              <Link
                to={invoiceHref}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="material-icons text-[18px]">description</span>
                Tạo hóa đơn
              </Link>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="material-icons text-[18px]">picture_as_pdf</span>
                Tải PDF
              </button>
            </>
          )}
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="material-icons text-[18px]">arrow_back</span>
            Quay lại
          </Link>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Chi tiết đơn hàng</div>
          <div className="text-xs font-semibold text-slate-500">Hiển thị khách hàng + sản phẩm + trạng thái</div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-900">Khách hàng / Địa chỉ giao hàng</div>
            <div className="mt-2 space-y-2 text-xs font-semibold text-slate-500">
              <div>
                Khách hàng: <span className="font-bold text-slate-700">{customerName}</span>
              </div>
              <div>
                Địa chỉ: <span className="font-bold text-slate-700">{address}</span>
              </div>
              <div>
                Loại đơn: <span className="font-bold text-slate-700">{typeLabel}</span>
              </div>
              <div>
                Ngày đặt:{' '}
                <span className="font-bold text-slate-700">{orderDate ? orderDate.toLocaleDateString('en-GB') : '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-900">Sản phẩm</div>
            {loading ? (
              <div className="mt-2 text-xs font-semibold text-slate-500">Đang tải...</div>
            ) : items.length === 0 ? (
              <div className="mt-2 text-xs font-semibold text-slate-500">Không có sản phẩm nào.</div>
            ) : (
              <div className="mt-2">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                        <th className="py-2 px-2">Sản phẩm</th>
                        <th className="py-2 px-2 text-right">SL</th>
                        <th className="py-2 px-2 text-right">Đơn giá</th>
                        <th className="py-2 px-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const lineTotal = it.lineTotal ?? it.quantity * it.priceAtOrder;
                        return (
                          <tr key={it.productId != null ? String(it.productId) : String(idx)} className="border-t border-slate-100">
                            <td className="py-2 px-2 font-medium text-slate-800">{it.productName}</td>
                            <td className="py-2 px-2 text-right text-slate-700">{it.quantity}</td>
                            <td className="py-2 px-2 text-right text-slate-700">{formatVND(it.priceAtOrder)}</td>
                            <td className="py-2 px-2 text-right text-slate-900 font-bold">{formatVND(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end pt-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Tổng: <span className="font-extrabold text-slate-900">{formatVND(totalCost)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-900">Trạng thái / Hóa đơn</div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <UiOrderStatusBadge status={currentStatus} />
                <button
                  type="button"
                  onClick={() => setChangerOpen(true)}
                  disabled={updating}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-icons text-[16px]">edit</span>
                Đổi trạng thái
                </button>
              </div>

              <div className="flex items-center gap-2">
                {orderId != null && (
                  <Link
                    to={invoiceHref}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    <span className="material-icons text-[16px]">receipt_long</span>
                    Xem hóa đơn
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Lịch sử trạng thái</div>
          <div className="text-xs font-semibold text-slate-500">Theo dõi từ API (audit)</div>
        </div>
        <div className="p-6">
          {historyLoading ? (
            <p className="text-xs font-semibold text-slate-500">Đang tải lịch sử…</p>
          ) : statusHistory.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">Chưa có bản ghi lịch sử cho đơn này.</p>
          ) : (
            <ul className="space-y-4 border-l-2 border-primary/30 ml-1 pl-4">
              {statusHistory.map((h, idx) => (
                <li key={`${h.changedAt}-${idx}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                  <div className="text-xs font-bold text-slate-900">
                    {h.oldStatus} → {h.newStatus}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {h.actor} · {formatDate(h.changedAt)}
                  </div>
                  {h.note && <p className="text-xs text-slate-600 mt-1">{h.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Vận đơn (giao hàng)</div>
          <div className="text-xs font-semibold text-slate-500">GET/PUT /api/admin/orders/&#123;id&#125;/shipment</div>
        </div>
        <div className="p-6 space-y-4">
          {shipmentLoading ? (
            <p className="text-xs font-semibold text-slate-500">Đang tải vận đơn…</p>
          ) : (
            <>
              {shipment && (
                <p className="text-[11px] text-slate-500">
                  ID vận đơn: <span className="font-mono font-semibold text-slate-700">{shipment.id}</span>
                  {shipment.shippedAt && (
                    <span className="ml-2">· Gửi: {formatDate(shipment.shippedAt)}</span>
                  )}
                  {shipment.deliveredAt && (
                    <span className="ml-2">· Nhận: {formatDate(shipment.deliveredAt)}</span>
                  )}
                </p>
              )}
              {!shipment && <p className="text-xs text-slate-500">Chưa có vận đơn — điền form bên dưới để tạo/cập nhật.</p>}
              {shipmentError && <p className="text-xs text-red-600">{shipmentError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-[11px] font-bold text-slate-600">
                  Đơn vị vận chuyển
                  <input
                    className={`mt-1 ${inputCls}`}
                    value={shipForm.carrier}
                    onChange={(e) => setShipForm((f) => ({ ...f, carrier: e.target.value }))}
                    placeholder="VD: GHTK, GHN…"
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-600">
                  Mã vận đơn
                  <input
                    className={`mt-1 ${inputCls}`}
                    value={shipForm.trackingNumber}
                    onChange={(e) => setShipForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                    placeholder="Tracking number"
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-600">
                  Trạng thái giao
                  <input
                    className={`mt-1 ${inputCls}`}
                    value={shipForm.status}
                    onChange={(e) => setShipForm((f) => ({ ...f, status: e.target.value }))}
                    placeholder="pending, in_transit, delivered…"
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-600 sm:col-span-2">
                  Ghi chú
                  <input
                    className={`mt-1 ${inputCls}`}
                    value={shipForm.note}
                    onChange={(e) => setShipForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveShipment()}
                disabled={!orderId || shipmentSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {shipmentSaving ? 'Đang lưu…' : 'Lưu vận đơn'}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="text-sm font-bold text-slate-900">Trả hàng / hoàn tiền</div>
          <div className="text-xs font-semibold text-slate-500">GET/POST orders/&#123;id&#125;/returns · PATCH /api/admin/returns/&#123;id&#125;/status</div>
        </div>
        <div className="p-6 space-y-4">
          {returnsLoading ? (
            <p className="text-xs font-semibold text-slate-500">Đang tải yêu cầu trả…</p>
          ) : returns.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">Chưa có yêu cầu trả hàng.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                    <th className="py-2 pr-2">ID</th>
                    <th className="py-2 pr-2">Trạng thái</th>
                    <th className="py-2 pr-2">Lý do</th>
                    <th className="py-2 pr-2 text-right">Hoàn</th>
                    <th className="py-2 pr-2">Kho</th>
                    <th className="py-2 pr-2">Cập nhật</th>
                    <th className="py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => {
                    const st = String(r.status ?? '').toLowerCase();
                    const busy = returnStatusUpdatingId === r.id;
                    return (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-2 pr-2 font-mono">{r.id}</td>
                        <td className="py-2 pr-2 font-semibold text-slate-800">{r.status}</td>
                        <td className="py-2 pr-2 text-slate-600">{r.reason ?? '—'}</td>
                        <td className="py-2 pr-2 text-right">
                          {r.refundAmount != null ? formatVND(r.refundAmount) : '—'}
                        </td>
                        <td className="py-2 pr-2">{r.restocked ? 'Đã nhập kho' : '—'}</td>
                        <td className="py-2 pr-2 text-slate-500">{formatDate(r.updatedAt)}</td>
                        <td className="py-2 text-right">
                          <div className="flex flex-wrap gap-1 justify-end">
                            <button
                              type="button"
                              disabled={busy || st === 'approved'}
                              onClick={() => void handlePatchReturnStatus(r.id, 'approved')}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 disabled:opacity-40"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              disabled={busy || st === 'rejected'}
                              onClick={() => void handlePatchReturnStatus(r.id, 'rejected')}
                              className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 disabled:opacity-40"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={busy || st === 'refunded'}
                              onClick={() => void handlePatchReturnStatus(r.id, 'refunded')}
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-800 disabled:opacity-40"
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

          <div className="border-t border-slate-100 pt-4 mt-2">
            <div className="text-xs font-bold text-slate-800 mb-2">Tạo yêu cầu trả</div>
            {returnError && <p className="text-xs text-red-600 mb-2">{returnError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-[11px] font-bold text-slate-600 sm:col-span-3">
                Lý do
                <input
                  className={`mt-1 ${inputCls}`}
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </label>
              <label className="block text-[11px] font-bold text-slate-600">
                Số tiền hoàn (tùy chọn)
                <input
                  className={`mt-1 ${inputCls}`}
                  type="number"
                  min={0}
                  step="1"
                  value={returnForm.refundAmount}
                  onChange={(e) => setReturnForm((f) => ({ ...f, refundAmount: e.target.value }))}
                />
              </label>
              <label className="block text-[11px] font-bold text-slate-600 sm:col-span-2">
                Ghi chú
                <input
                  className={`mt-1 ${inputCls}`}
                  value={returnForm.note}
                  onChange={(e) => setReturnForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateReturn()}
              disabled={!orderId || returnSubmitting}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {returnSubmitting ? 'Đang gửi…' : 'Gửi yêu cầu trả'}
            </button>
          </div>
        </div>
      </section>

      <OrderStatusChanger
        isOpen={changerOpen}
        currentStatus={currentStatus}
        statuses={statusOptionsForChanger}
        onClose={() => setChangerOpen(false)}
        onApply={(next) => void handleApplyStatus(next)}
      />
    </div>
  );
};

export default OrderDetailPage;

