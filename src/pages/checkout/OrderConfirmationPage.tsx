import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { orderConfirmationSample } from '@/data';
import { formatVND } from '@/utils';
import { isApiConfigured } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { getOrder, getAddresses } from '@/services/backend';
import { ApiError } from '@/services/api';
import type { OrderDto } from '@/types/api';
import type { SavedAddress } from '@/types';
import { addressDtoToSaved } from '@/services/addressMapper';

function paymentMethodToBrand(method?: string | null): { brand: string; last4: string; expires: string } {
  const m = String(method ?? '').trim().toLowerCase();
  if (!m) return { brand: '—', last4: '—', expires: '—' };
  if (m === 'credit_card') return { brand: 'Credit Card', last4: '—', expires: '—' };
  if (m === 'paypal') return { brand: 'PayPal', last4: '—', expires: '—' };
  if (m === 'paypal_credit') return { brand: 'PayPal Credit', last4: '—', expires: '—' };
  if (m === 'cash_on_delivery') return { brand: 'Thanh toán khi nhận hàng', last4: '—', expires: '—' };
  if (m === 'vnpay') return { brand: 'VNPay', last4: '—', expires: '—' };
  return { brand: method, last4: '—', expires: '—' };
}

const OrderConfirmationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const paymentResult = searchParams.get('payment');
  const paymentReason = searchParams.get('reason');
  const location = useLocation();
  const { orderId: orderIdFromPath } = useParams<{ orderId?: string }>();
  const state = location.state as { orderId?: number; fromApi?: boolean } | null;
  const orderIdFromUrl =
    state?.orderId ??
    (orderIdFromPath && /^\d+$/.test(orderIdFromPath) ? Number(orderIdFromPath) : undefined);
  const { isAuthenticated, user, isInitialized } = useAuth();

  const [apiOrder, setApiOrder] = useState<OrderDto | null>(null);
  const [apiShipping, setApiShipping] = useState<{
    name: string;
    street: string;
    city: string;
    stateZip: string;
    country: string;
  } | null>(null);
  const [orderLoadError, setOrderLoadError] = useState<string | null>(null);

  const shouldFetchOrder =
    orderIdFromUrl != null &&
    Number.isFinite(orderIdFromUrl) &&
    isInitialized &&
    isApiConfigured() &&
    isAuthenticated;

  useEffect(() => {
    setOrderLoadError(null);
    if (!shouldFetchOrder || orderIdFromUrl == null) {
      setApiOrder(null);
      setApiShipping(null);
      return;
    }

    let cancelled = false;

    getOrder(orderIdFromUrl)
      .then(async (dto) => {
        if (cancelled) return;
        if (user?.id != null && dto.userId !== user.id) {
          setApiOrder(null);
          setApiShipping(null);
          setOrderLoadError('Bạn không có quyền xem đơn hàng này.');
          return;
        }
        setApiOrder(dto);

        if (dto.shippingAddressId == null) {
          setApiShipping(null);
          return;
        }

        try {
          const addrDtos = await getAddresses();
          const savedList: SavedAddress[] = addrDtos.map(addressDtoToSaved);
          const shipping = savedList.find((a) => Number(a.id) === Number(dto.shippingAddressId)) ?? null;
          if (!shipping) {
            setApiShipping(null);
            return;
          }

          const streetLine = [shipping.street, shipping.apartment]
            .filter((x) => x && String(x).trim())
            .join(', ');
          const stateZip = [shipping.state, shipping.zipCode].filter((x) => x && String(x).trim()).join(' ').trim();

          setApiShipping({
            name: shipping.name ?? '—',
            street: streetLine || '—',
            city: shipping.city ?? '',
            stateZip: stateZip || '',
            country: shipping.country ?? '',
          });
        } catch {
          setApiShipping(null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setApiOrder(null);
        setApiShipping(null);
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Không tải được đơn hàng.';
        setOrderLoadError(msg);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldFetchOrder, orderIdFromUrl, user?.id]);

  const order = orderConfirmationSample;
  const { delivery } = order;
  const deliveryShippingToShow = apiShipping ?? delivery.shippingAddress;
  const payment = useMemo(() => {
    if (apiOrder?.paymentMethod) return paymentMethodToBrand(apiOrder.paymentMethod);
    return { brand: order.payment.brand, last4: order.payment.last4 };
  }, [apiOrder?.paymentMethod]);

  const orderIdToShow = apiOrder?.id ? String(apiOrder.id) : String(order.orderId);

  const lineItemsToRender = useMemo(() => {
    if (apiOrder?.items?.length) {
      return apiOrder.items.map((it, idx) => ({
        key: `${it.productId ?? idx}-${idx}`,
        name: it.productName,
        image: it.productImage ?? '',
        variant: [it.selectedColor, it.selectedStorage].filter(Boolean).join(' · ') || undefined,
        quantity: it.quantity,
        price: it.priceAtOrder,
      }));
    }
    return orderConfirmationSample.lineItems.map((item) => ({
      key: item.id,
      name: item.name,
      image: item.image,
      variant: item.variant,
      quantity: item.quantity,
      price: item.price,
    }));
  }, [apiOrder]);

  const totals = useMemo(() => {
    if (apiOrder) {
      const subtotal = apiOrder.subtotal != null ? Number(apiOrder.subtotal) : null;
      const shipping = apiOrder.shippingCost != null ? Number(apiOrder.shippingCost) : null;
      const total = Number(apiOrder.totalPrice ?? 0);
      return { subtotal, shipping, tax: 0, total };
    }
    return {
      subtotal: orderConfirmationSample.subtotal,
      shipping: orderConfirmationSample.shipping,
      tax: orderConfirmationSample.tax,
      total: orderConfirmationSample.total,
    };
  }, [apiOrder]);

  const showSampleWhenNoApiOrder =
    !apiOrder && (!orderIdFromUrl || !shouldFetchOrder) && !orderLoadError;

  const showErrorForIntendedApi =
    orderIdFromUrl != null && shouldFetchOrder && orderLoadError && !apiOrder;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen">
      {/* Navigation */}
      <nav className="bg-white dark:bg-background-dark/50 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="material-icons text-white text-xl">devices</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">TechHome</span>
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Link to="/search" className="hover:text-primary transition-colors">Mua sắm</Link>
            <Link to="/search" className="hover:text-primary transition-colors">Hỗ trợ</Link>
            <Link to="/profile" className="hover:text-primary transition-colors">Tài khoản</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {paymentResult === 'failed' && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            Thanh toán chưa hoàn tất
            {paymentReason ? ` — ${decodeURIComponent(paymentReason)}` : ''}. Bạn có thể thử lại từ mục đơn hàng hoặc liên hệ
            hỗ trợ nếu đã bị trừ tiền.
          </div>
        )}
        {paymentResult === 'success' && (
          <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            Thanh toán VNPay đã được ghi nhận. Cảm ơn bạn!
          </div>
        )}

        {showErrorForIntendedApi && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {orderLoadError}
            <div className="mt-2">
              <Link to="/orders" className="font-semibold text-primary hover:underline">
                Xem đơn hàng của tôi
              </Link>
            </div>
          </div>
        )}

        {orderIdFromUrl != null && !isAuthenticated && isInitialized && (
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Đăng nhập để xem chi tiết đơn #{orderIdFromUrl}.
            <Link to="/login" className="ml-2 font-semibold text-primary hover:underline">
              Đăng nhập
            </Link>
          </div>
        )}

        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
            <span className="material-icons text-green-600 dark:text-green-400 text-5xl">check_circle</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">Cảm ơn bạn đã đặt hàng!</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">Đơn hàng #{orderIdToShow}</p>
          <p className="text-slate-500 dark:text-slate-500 mt-2">Email xác nhận đã được gửi đến hộp thư của bạn.</p>
          {apiOrder?.status && (
            <p className="text-sm text-slate-500 mt-2">Trạng thái: {apiOrder.status}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
            to="/orders"
            className="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <span className="material-icons text-sm">local_shipping</span>
            Theo dõi đơn hàng
          </Link>
          <Link
            to="/orders"
            className="px-8 py-3 bg-white dark:bg-slate-800 border-2 border-primary/20 hover:border-primary text-primary font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <span className="material-icons text-sm">receipt_long</span>
            Chi tiết đơn hàng
          </Link>
        </div>

        {/* Order Information Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Summary Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-bold text-lg text-slate-800 dark:text-white">Tóm tắt đơn hàng</h2>
                {showSampleWhenNoApiOrder && (
                  <p className="text-xs text-amber-600 mt-1">Đang hiển thị ví dụ — đặt hàng qua tài khoản để xem đơn thật.</p>
                )}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {lineItemsToRender.map((item) => (
                  <div key={item.key} className="p-6 flex gap-6 items-center">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 rounded-lg object-cover bg-slate-100"
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">{item.name}</h4>
                      {item.variant && (
                        <p className="text-sm text-slate-500">{item.variant}</p>
                      )}
                      <p className="text-sm text-slate-400 mt-1">SL: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatVND(item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 space-y-3">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tạm tính</span>
                  <span>{totals.subtotal != null ? formatVND(totals.subtotal) : '—'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Vận chuyển</span>
                  <span className="text-green-600 font-medium">
                    {totals.shipping === 0 ? 'Miễn phí' : totals.shipping != null ? formatVND(totals.shipping) : '—'}
                  </span>
                </div>
                {totals.tax > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Thuế</span>
                    <span>{formatVND(totals.tax)}</span>
                  </div>
                )}
                <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">Tổng cộng</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatVND(totals.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-6">
            {/* Delivery Info */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons text-primary text-xl">event</span>
                Trạng thái giao hàng
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dự kiến giao</p>
                  <p className="text-slate-700 dark:text-slate-200 font-medium">
                    {apiOrder ? '—' : delivery.estimatedDelivery}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Giao đến</p>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    {deliveryShippingToShow.name}
                    <br />
                    {deliveryShippingToShow.street}
                    <br />
                    {deliveryShippingToShow.city}, {deliveryShippingToShow.stateZip}
                    <br />
                    {deliveryShippingToShow.country}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-icons text-primary text-xl">payment</span>
                Thanh toán
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-6 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400">{payment.brand}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-200 font-medium text-sm">
                  {payment.brand} kết thúc bằng {payment.last4}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next? */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Tiếp theo?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:border-primary transition-colors group cursor-pointer">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                <span className="material-icons text-primary group-hover:text-white">verified_user</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Đăng ký bảo hành</h4>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Gia hạn bảo hành 2 năm với ưu đãi 20% khi đăng ký trong 48 giờ.
              </p>
              <a href="#" className="text-primary font-semibold flex items-center gap-1 hover:underline">
                Đăng ký bảo hành
                <span className="material-icons text-sm">arrow_forward</span>
              </a>
            </div>
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-left hover:border-primary transition-colors group cursor-pointer">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                <span className="material-icons text-primary group-hover:text-white">mail</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">TechHome Insider</h4>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Đăng ký nhận tin để nhận ưu đãi, cập nhật firmware và mẹo bảo trì.
              </p>
              <a href="#" className="text-primary font-semibold flex items-center gap-1 hover:underline">
                Tham gia cộng đồng
                <span className="material-icons text-sm">arrow_forward</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer Help */}
        <div className="mt-16 py-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary transition-colors underline underline-offset-4">Cần trợ giúp?</a>
            <a href="#" className="hover:text-primary transition-colors underline underline-offset-4">Chính sách đổi trả</a>
            <a href="#" className="hover:text-primary transition-colors underline underline-offset-4">Câu hỏi thường gặp</a>
          </div>
          <p>© 2024 TechHome Electronics Inc. Bảo lưu mọi quyền.</p>
        </div>
      </main>
    </div>
  );
};

export default OrderConfirmationPage;
