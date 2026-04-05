import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getOrderDetails } from '@/data';
import {
  getOrder,
  receiveOrder,
  cancelOrder,
  getAddresses,
  getOrderStatusHistory,
  getOrderReturns,
  createOrderReturn,
} from '@/services/backend';
import { ApiError, isApiConfigured } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { formatVND } from '@/utils';
import { formatDate } from '@/utils/formatDate';
import type { OrderDto, OrderStatusHistoryDto, ReturnRequestDto } from '@/types/api';
import type { OrderDetailsData, SavedAddress } from '@/types';
import AccountSidebar from '@/components/account/AccountSidebar';
import AccountHeader from '@/components/account/AccountHeader';
import AccountFooter from '@/components/account/AccountFooter';
import Breadcrumb from '@/components/common/Breadcrumb';
import { addressDtoToSaved } from '@/services/addressMapper';
import {
  orderStatusLabel,
  paymentMethodLabel,
  shipmentStatusLabel,
  buildCustomerOrderStepper,
  canCustomerCancelOrder,
  canCustomerConfirmCodReceived,
  formatOrderHistoryActor,
  returnRequestStatusLabel,
} from '@/utils/orderDisplay';

const PLACEHOLDER_IMG = 'https://picsum.photos/100/100?random=product';

function mapSavedAddressToShipping(saved?: SavedAddress | null): OrderDetailsData['shippingAddress'] {
  if (!saved) {
    return {
      name: '—',
      street: '—',
      cityStateZip: '—',
      country: '—',
      phone: '—',
    };
  }

  const streetLine = [saved.street, saved.apartment].filter((x) => x && String(x).trim()).join(', ');
  const stateZip = [saved.state, saved.zipCode].filter((x) => x && String(x).trim()).join(' ').trim();
  const cityStateZip =
    saved.city && stateZip ? `${saved.city}, ${stateZip}` : [saved.city, stateZip].filter(Boolean).join(' ').trim();

  return {
    name: saved.name ?? '—',
    street: streetLine || '—',
    cityStateZip: cityStateZip || '—',
    country: saved.country ?? '—',
    phone: saved.phone ?? '—',
  };
}

function mapOrderDtoToDetails(dto: OrderDto, shippingAddress?: SavedAddress | null): OrderDetailsData {
  const placedDate = formatDate(dto.createdAt);
  const statusRaw = dto.status ?? null;
  const lineItems = dto.items.map((item) => {
    const specs = [item.selectedColor, item.selectedStorage].filter(Boolean).join(' · ') || '';
    return {
      name: item.productName,
      image: item.productImage || PLACEHOLDER_IMG,
      specs,
      quantity: item.quantity,
      price: Number(item.priceAtOrder),
    };
  });
  const subtotalCalc = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const subtotalFromApi = dto.subtotal != null ? Number(dto.subtotal) : null;
  const discountAmount = dto.discountAmount != null ? Number(dto.discountAmount) : 0;
  const ship = dto.shipment;
  const hasShip =
    ship &&
    (ship.carrier ||
      ship.trackingNumber ||
      ship.note ||
      (ship.status != null && String(ship.status).trim() !== '') ||
      ship.shippedAt ||
      ship.deliveredAt);
  const shipment = hasShip
    ? {
        carrier: ship!.carrier ?? null,
        trackingNumber: ship!.trackingNumber ?? null,
        trackingUrl: ship!.note?.trim() ? ship!.note.trim() : null,
        status: ship!.status ?? null,
        statusLabel: shipmentStatusLabel(ship!.status),
        shippedAt: ship!.shippedAt ?? null,
        deliveredAt: ship!.deliveredAt ?? null,
      }
    : null;

  return {
    orderId: String(dto.id),
    placedDate,
    statusLabel: orderStatusLabel(String(statusRaw ?? '')),
    statusRaw,
    stepperSteps: buildCustomerOrderStepper(statusRaw, placedDate),
    lineItems,
    subtotal: subtotalFromApi ?? subtotalCalc,
    shipping: Number(dto.shippingCost ?? 0),
    tax: 0,
    total: Number(dto.totalPrice),
    shippingAddress: mapSavedAddressToShipping(shippingAddress),
    payment: {
      brand: paymentMethodLabel(dto.paymentMethod),
      last4: '—',
      expires: '—',
    },
    paymentMethodRaw: dto.paymentMethod ?? null,
    shipment,
    discountAmount,
    couponCode: dto.couponCode ?? null,
    notes: dto.notes ?? null,
    canCancel: canCustomerCancelOrder(statusRaw, dto.paymentMethod),
    canConfirmCodReceived: canCustomerConfirmCodReceived(statusRaw, dto.paymentMethod),
  };
}

const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState<OrderDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [addressesCache, setAddressesCache] = useState<SavedAddress[]>([]);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [statusHistory, setStatusHistory] = useState<OrderStatusHistoryDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [returns, setReturns] = useState<ReturnRequestDto[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnForm, setReturnForm] = useState({ reason: '', note: '' });
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const loadExtras = (id: string) => {
    if (!isApiConfigured() || !isAuthenticated) return;
    setHistoryLoading(true);
    setReturnsLoading(true);
    void Promise.all([
      getOrderStatusHistory(id)
        .then((rows) => setStatusHistory(rows))
        .catch(() => setStatusHistory([]))
        .finally(() => setHistoryLoading(false)),
      getOrderReturns(id)
        .then((rows) => setReturns(rows))
        .catch(() => setReturns([]))
        .finally(() => setReturnsLoading(false)),
    ]);
  };

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setStatusHistory([]);
      setReturns([]);
      return;
    }
    if (isApiConfigured() && isAuthenticated) {
      setLoading(true);
      getOrder(orderId)
        .then(async (dto) => {
          let shipping: SavedAddress | null = null;
          try {
            if (dto.shippingAddressId != null) {
              const addrDtos = await getAddresses();
              const savedList = addrDtos.map(addressDtoToSaved);
              setAddressesCache(savedList);
              shipping = savedList.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
            }
          } catch {
            /* giữ đơn, địa chỉ — */
          }
          setOrder(mapOrderDtoToDetails(dto, shipping));
          loadExtras(orderId);
        })
        .catch(() => {
          setOrder(getOrderDetails(orderId) ?? null);
          setStatusHistory([]);
          setReturns([]);
        })
        .finally(() => setLoading(false));
    } else {
      setOrder(getOrderDetails(orderId) ?? null);
      setStatusHistory([]);
      setReturns([]);
    }
  }, [orderId, isAuthenticated]);

  const canReceiveAndPay = Boolean(order?.canConfirmCodReceived);
  const canCancelOrder = Boolean(order?.canCancel);
  const showApiExtras = isApiConfigured() && isAuthenticated && order != null;

  const handleReceiveAndPay = async () => {
    if (!order || !canReceiveAndPay) return;
    setReceiveError(null);
    setReceiving(true);
    try {
      const dto = await receiveOrder(order.orderId);
      let shipping: SavedAddress | null = null;
      try {
        if (dto.shippingAddressId != null) {
          shipping = addressesCache.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          if (!shipping) {
            const addrDtos = await getAddresses();
            const savedList = addrDtos.map(addressDtoToSaved);
            setAddressesCache(savedList);
            shipping = savedList.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          }
        }
      } catch {
        /* — */
      }
      setOrder(mapOrderDtoToDetails(dto, shipping));
      loadExtras(order.orderId);
    } catch (err: unknown) {
      setReceiveError(err instanceof Error ? err.message : 'Không thể ghi nhận đã nhận hàng.');
    } finally {
      setReceiving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !canCancelOrder) return;
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    setCancelError(null);
    setCancelling(true);
    try {
      const dto = await cancelOrder(order.orderId);
      let shipping: SavedAddress | null = null;
      try {
        if (dto.shippingAddressId != null) {
          shipping = addressesCache.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          if (!shipping) {
            const addrDtos = await getAddresses();
            const savedList = addrDtos.map(addressDtoToSaved);
            setAddressesCache(savedList);
            shipping = savedList.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          }
        }
      } catch {
        /* — */
      }
      setOrder(mapOrderDtoToDetails(dto, shipping));
      loadExtras(order.orderId);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Không thể hủy đơn.';
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!order || !showApiExtras) return;
    setReturnError(null);
    setReturnSubmitting(true);
    try {
      await createOrderReturn(order.orderId, {
        reason: returnForm.reason.trim() || undefined,
        note: returnForm.note.trim() || undefined,
      });
      const rows = await getOrderReturns(order.orderId);
      setReturns(rows);
      setReturnForm({ reason: '', note: '' });
      const dto = await getOrder(order.orderId);
      let shipping: SavedAddress | null = null;
      try {
        if (dto.shippingAddressId != null) {
          shipping =
            addressesCache.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          if (!shipping) {
            const addrDtos = await getAddresses();
            const savedList = addrDtos.map(addressDtoToSaved);
            setAddressesCache(savedList);
            shipping = savedList.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          }
        }
      } catch {
        /* — */
      }
      setOrder(mapOrderDtoToDetails(dto, shipping));
      loadExtras(order.orderId);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không gửi được yêu cầu trả hàng.';
      setReturnError(msg);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const invoiceHref = order ? `/order/${encodeURIComponent(order.orderId)}/invoice` : '#';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-display">
        <AccountHeader />
        <div className="flex items-center justify-center flex-grow py-24">
          <p className="text-slate-500">Đang tải chi tiết đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark font-display">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Không tìm thấy đơn hàng.</p>
          <Link to="/orders" className="text-primary font-semibold hover:underline">
            Quay lại lịch sử đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const discount = order.discountAmount ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
      <AccountHeader />

      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 py-10 flex gap-10 w-full">
        <AccountSidebar />

        <main className="flex-grow space-y-6 min-w-0">
          <div>
            <Breadcrumb
              items={[
                { label: 'Trang chủ', path: '/' },
                { label: 'Tài khoản', path: '/profile' },
                { label: 'Lịch sử đơn hàng', path: '/orders' },
                { label: `#${order.orderId}` },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 transition-colors"
                >
                  <span className="material-icons text-xl">arrow_back</span>
                </button>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Đơn hàng #{order.orderId}
                  </h1>
                  <p className="text-slate-500 mt-0.5">Đặt lúc {order.placedDate}</p>
                  {order.statusRaw ? (
                    <p className="text-xs text-slate-400 font-mono mt-1">Trạng thái hệ thống: {order.statusRaw}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-1.5 bg-primary/10 text-primary text-sm font-bold rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  {order.statusLabel}
                </span>
                {canReceiveAndPay && (
                  <button
                    type="button"
                    disabled={receiving}
                    onClick={() => void handleReceiveAndPay()}
                    className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {receiving ? 'Đang ghi nhận...' : 'Đã nhận hàng (COD)'}
                  </button>
                )}
                {canCancelOrder && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => void handleCancelOrder()}
                    className="px-5 py-2.5 border-2 border-red-200 text-red-700 dark:text-red-300 dark:border-red-800 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60"
                  >
                    {cancelling ? 'Đang hủy...' : 'Hủy đơn'}
                  </button>
                )}
              </div>
            </div>
            {receiveError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                {receiveError}
              </div>
            )}
            {cancelError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                {cancelError}
              </div>
            )}
            {order.notes ? (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Ghi chú đơn: </span>
                <span className="text-slate-600 dark:text-slate-300">{order.notes}</span>
              </div>
            ) : null}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_2px_10px_-2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between relative flex-wrap gap-4">
              {order.stepperSteps.map((step, i) => (
                <React.Fragment key={`${step.label}-${i}`}>
                  <div
                    className={`flex flex-col items-center gap-3 relative z-10 max-w-[140px] ${
                      !step.completed && !step.active ? 'opacity-40' : ''
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        step.completed
                          ? 'bg-primary text-white shadow-lg shadow-primary/30'
                          : step.active
                            ? 'bg-white dark:bg-slate-800 border-2 border-primary text-primary'
                            : 'bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400'
                      }`}
                    >
                      <span className="material-icons text-xl">{step.icon}</span>
                    </div>
                    <span className={`text-[13px] font-bold text-center ${step.active ? 'text-primary' : ''}`}>
                      {step.label}
                    </span>
                    <span
                      className={`text-[11px] text-center ${step.active ? 'text-primary font-medium' : 'text-slate-400'}`}
                    >
                      {step.sublabel}
                    </span>
                  </div>
                  {i < order.stepperSteps.length - 1 && (
                    <div
                      className={`hidden sm:block flex-grow h-1 mx-1 -mt-8 min-w-[16px] ${
                        step.completed ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_2px_10px_-2px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    Sản phẩm ({order.lineItems.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {order.lineItems.map((item, idx) => (
                    <div
                      key={`${item.name}-${idx}`}
                      className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6"
                    >
                      <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center justify-center flex-shrink-0">
                        <img alt={item.name} src={item.image} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{item.name}</h4>
                        {item.specs ? (
                          <p className="text-sm text-slate-500 mt-1">{item.specs}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <span className="text-sm font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            SL: {item.quantity}
                          </span>
                          <span className="text-primary font-bold">{formatVND(item.price)}</span>
                          <span className="text-sm text-slate-500">
                            Thành tiền:{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatVND(item.price * item.quantity)}
                            </span>
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[12px] font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                      >
                        Viết đánh giá
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {showApiExtras ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="material-icons text-primary">history</span>
                      Lịch sử trạng thái
                    </h3>
                    {historyLoading ? (
                      <p className="text-sm text-slate-500">Đang tải…</p>
                    ) : statusHistory.length === 0 ? (
                      <p className="text-sm text-slate-500">Chưa có dữ liệu lịch sử.</p>
                    ) : (
                      <ul className="space-y-3 border-l-2 border-slate-200 dark:border-slate-700 pl-4 ml-1">
                        {statusHistory.map((h, idx) => (
                          <li key={`${h.changedAt}-${idx}`} className="relative">
                            <span
                              className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white dark:ring-slate-900"
                              aria-hidden
                            />
                            <p className="text-sm text-slate-900 dark:text-slate-100">
                              <span className="text-slate-600 dark:text-slate-400">{orderStatusLabel(h.oldStatus)}</span>
                              <span className="mx-1 text-slate-300">→</span>
                              {orderStatusLabel(h.newStatus)}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatOrderHistoryActor(h.actor)} · {formatDate(h.changedAt)}
                            </p>
                            {h.note ? (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 bg-slate-50 dark:bg-slate-800/80 rounded px-2 py-1.5">
                                {h.note}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className="material-icons text-primary">assignment_return</span>
                      Trả hàng / hoàn tiền
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Gửi yêu cầu trả hàng. Cửa hàng sẽ xử lý và cập nhật trạng thái (cùng hệ thống với trang quản trị).
                    </p>
                    {returnError && (
                      <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                        {returnError}
                      </div>
                    )}
                    {returnsLoading ? (
                      <p className="text-sm text-slate-500 mb-4">Đang tải…</p>
                    ) : returns.length === 0 ? (
                      <p className="text-sm text-slate-500 mb-4">Chưa có yêu cầu.</p>
                    ) : (
                      <ul className="space-y-2 mb-4 text-sm">
                        {returns.map((r) => (
                          <li
                            key={r.id}
                            className="flex flex-wrap justify-between gap-2 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2"
                          >
                            <span className="font-medium">{returnRequestStatusLabel(String(r.status ?? ''))}</span>
                            <span className="text-slate-500 text-xs">{formatDate(r.createdAt)}</span>
                            {r.reason ? <span className="w-full text-slate-600 dark:text-slate-400">{r.reason}</span> : null}
                            {r.refundAmount != null ? (
                              <span className="w-full text-primary font-semibold">{formatVND(r.refundAmount)}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                      <label className="block text-sm">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Lý do</span>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                          value={returnForm.reason}
                          onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
                          placeholder="Ví dụ: Sản phẩm không đúng mô tả"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Ghi chú thêm</span>
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                          value={returnForm.note}
                          onChange={(e) => setReturnForm((f) => ({ ...f, note: e.target.value }))}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={returnSubmitting}
                        onClick={() => void handleCreateReturn()}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        {returnSubmitting ? 'Đang gửi…' : 'Gửi yêu cầu trả hàng'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="bg-blue-50 dark:bg-slate-800/50 rounded-2xl border border-primary/20 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-icons text-primary">help_outline</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Cần hỗ trợ đơn hàng?</h4>
                    <p className="text-sm text-slate-500">Theo dõi vận chuyển, đổi trả hoặc liên hệ hỗ trợ.</p>
                  </div>
                </div>
                <div className="flex gap-3 flex-shrink-0 flex-wrap">
                  <button
                    type="button"
                    className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Liên hệ hỗ trợ
                  </button>
                  {showApiExtras ? (
                    <Link
                      to={invoiceHref}
                      className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                    >
                      <span className="material-icons text-lg">description</span>
                      Hóa đơn / in
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_2px_10px_-2px_rgba(0,0,0,0.03)] p-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Tóm tắt đơn hàng</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Tạm tính ({order.lineItems.length} sản phẩm)</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatVND(order.subtotal)}</span>
                  </div>
                  {discount > 0 ? (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Giảm giá{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">−{formatVND(discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Phí vận chuyển</span>
                    <span className="font-semibold text-green-600">
                      {order.shipping === 0 ? 'Miễn phí' : formatVND(order.shipping)}
                    </span>
                  </div>
                  {order.tax > 0 ? (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Thuế</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{formatVND(order.tax)}</span>
                    </div>
                  ) : null}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                    <span className="font-bold text-lg text-slate-900 dark:text-white">Tổng cộng</span>
                    <span className="font-bold text-lg text-primary">{formatVND(order.total)}</span>
                  </div>
                </div>
              </div>

              {order.shipment ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_2px_10px_-2px_rgba(0,0,0,0.03)] p-6">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-icons text-primary text-xl">local_shipping</span>
                    Vận chuyển
                  </h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                    {order.shipment.statusLabel && order.shipment.statusLabel !== '—' ? (
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Trạng thái: </span>
                        {order.shipment.statusLabel}
                      </p>
                    ) : null}
                    {order.shipment.carrier ? (
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Đơn vị: </span>
                        {order.shipment.carrier}
                      </p>
                    ) : null}
                    {order.shipment.trackingNumber ? (
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Mã vận đơn: </span>
                        {order.shipment.trackingNumber}
                      </p>
                    ) : null}
                    {order.shipment.shippedAt ? (
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Gửi hàng: </span>
                        {formatDate(order.shipment.shippedAt)}
                      </p>
                    ) : null}
                    {order.shipment.deliveredAt ? (
                      <p>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Giao tại kho: </span>
                        {formatDate(order.shipment.deliveredAt)}
                      </p>
                    ) : null}
                    {order.shipment.trackingUrl ? (
                      <p>
                        <a
                          href={order.shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-semibold hover:underline break-all"
                        >
                          Tra cứu vận đơn
                        </a>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : showApiExtras ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-sm text-slate-500">
                  Chưa có thông tin vận chuyển. Bạn sẽ thấy đơn vị vận chuyển và mã vận đơn khi cửa hàng cập nhật.
                </div>
              ) : null}

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_2px_10px_-2px_rgba(0,0,0,0.03)] p-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Địa chỉ giao hàng</h3>
                <div className="flex gap-3">
                  <span className="material-icons text-slate-400 flex-shrink-0">location_on</span>
                  <div className="text-sm text-slate-500">
                    <p className="font-bold text-slate-900 dark:text-white">{order.shippingAddress.name}</p>
                    <p className="mt-1">{order.shippingAddress.street}</p>
                    <p>{order.shippingAddress.cityStateZip}</p>
                    <p>{order.shippingAddress.country}</p>
                    <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">{order.shippingAddress.phone}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_2px_10px_-2px_rgba(0,0,0,0.03)] p-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Phương thức thanh toán</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center flex-shrink-0">
                    <span className="material-icons text-slate-600 dark:text-slate-400 text-xl">payments</span>
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 dark:text-white">{order.payment.brand}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AccountFooter />
    </div>
  );
};

export default OrderDetailsPage;
