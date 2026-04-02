import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatVND, productDetailPath, shippingCostForNetMerchandiseVnd } from '@/utils';
import { checkoutQuote } from '@/services/backend';
import { getToken, isApiConfigured } from '@/services/api';

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity } = useCart();
  const { addItem: addWishlist } = useWishlist();

  const localSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const normalizedItems = useMemo(
    () =>
      items.map((i) => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity),
        price: Number(i.price),
      })),
    [items],
  );

  const quoteItemsKey = useMemo(
    () => normalizedItems.map((i) => `${i.productId}:${i.quantity}:${i.price}`).join('|'),
    [normalizedItems],
  );

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<{
    subtotal: number;
    discountAmount: number;
    shippingCost: number;
    totalPrice: number;
    couponApplied: boolean;
    couponMessage: string;
  } | null>(null);

  const canQuote = isApiConfigured() && Boolean(getToken()) && normalizedItems.length > 0;

  const fetchQuote = useCallback(
    async (couponCode: string) => {
      if (!canQuote) {
        setQuote(null);
        return;
      }
      setQuoting(true);
      try {
        const q = await checkoutQuote({
          items: normalizedItems,
          couponCode: couponCode.trim() || undefined,
        });
        setQuote({
          subtotal: Number(q.subtotal ?? 0),
          discountAmount: Number(q.discountAmount ?? 0),
          shippingCost: Number(q.shippingCost ?? 0),
          totalPrice: Number(q.totalPrice ?? 0),
          couponApplied: Boolean(q.couponApplied),
          couponMessage: q.couponMessage ?? '',
        });
      } catch {
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    },
    [canQuote, normalizedItems],
  );

  useEffect(() => {
    void fetchQuote(appliedCoupon);
  }, [appliedCoupon, fetchQuote, quoteItemsKey]);

  const applyCoupon = () => {
    setAppliedCoupon(couponInput.trim());
  };

  const displaySubtotal = quote?.subtotal ?? localSubtotal;
  const displayDiscount = quote?.discountAmount ?? 0;
  const displayNet = Math.max(0, displaySubtotal - displayDiscount);
  const displayShipping = quote?.shippingCost ?? shippingCostForNetMerchandiseVnd(displayNet);
  const displayTotal =
    quote?.totalPrice ?? Math.max(0, displaySubtotal - displayDiscount + displayShipping);

  const handleSaveForLater = (item: (typeof items)[0]) => {
    addWishlist({
      productId: item.productId,
      name: item.name,
      image: item.image || '',
      price: item.price,
    });
    removeItem(item.id);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">
        Giỏ hàng <span className="text-gray-400 font-normal ml-2">({totalItems} sản phẩm)</span>
      </h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <div className="col-span-6">Sản phẩm</div>
              <div className="col-span-2 text-center">Đơn giá</div>
              <div className="col-span-2 text-center">Số lượng</div>
              <div className="col-span-2 text-right">Thành tiền</div>
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-4 p-6 items-center border-b border-gray-50 last:border-b-0"
              >
                <div className="col-span-12 md:col-span-6 flex items-center gap-6">
                  <div className="w-24 h-24 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                  <div>
                    <Link
                      to={productDetailPath({ id: item.productId })}
                      className="font-bold text-gray-900 text-lg hover:text-indigo-600"
                    >
                      {item.name}
                    </Link>
                    {item.variant && <p className="text-sm text-gray-400">{item.variant}</p>}
                    <div className="mt-4 flex gap-4">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[10px] font-bold text-gray-400 uppercase hover:text-red-600 flex items-center gap-1"
                      >
                        <span className="material-icons text-sm">delete_outline</span> Xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveForLater(item)}
                        className="text-[10px] font-bold text-gray-400 uppercase hover:text-indigo-600 flex items-center gap-1"
                      >
                        <span className="material-icons text-sm">bookmark_border</span> Để mua sau
                      </button>
                    </div>
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2 text-center">
                  <span className="font-bold text-gray-900">{formatVND(item.price)}</span>
                </div>
                <div className="col-span-4 md:col-span-2 flex justify-center">
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-1 hover:bg-gray-50 text-gray-500"
                    >
                      -
                    </button>
                    <span className="px-4 py-1 font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-1 hover:bg-gray-50 text-gray-500"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2 text-right">
                  <span className="font-black text-indigo-600">{formatVND(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="w-full lg:w-96 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm sticky top-24">
            <h2 className="text-xl font-bold mb-8">Tóm tắt đơn hàng</h2>

            <div className="mb-6 pb-6 border-b border-gray-50">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mã giảm giá</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Nhập mã"
                  disabled={!canQuote}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={!canQuote || quoting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors"
                >
                  {quoting ? '…' : 'Áp dụng'}
                </button>
              </div>
              {!canQuote && items.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">Đăng nhập và bật API để áp mã giảm giá.</p>
              )}
              {quote?.couponMessage && (
                <p
                  className={`mt-2 text-xs ${quote.couponApplied ? 'text-emerald-600' : 'text-amber-600'}`}
                >
                  {quote.couponMessage}
                </p>
              )}
            </div>

            <div className="space-y-4 text-sm text-gray-500 border-b border-gray-50 pb-6 mb-6">
              <div className="flex justify-between">
                <span>Tạm tính ({totalItems} sản phẩm)</span>
                <span className="font-bold text-gray-900">{formatVND(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Giảm giá</span>
                <span className="font-bold text-emerald-600">-{formatVND(displayDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Vận chuyển</span>
                <span className="font-bold text-emerald-600">
                  {displayShipping === 0 ? 'Miễn phí' : formatVND(displayShipping)}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <span className="font-bold text-gray-900">Tổng cộng</span>
              <span className="text-3xl font-black text-indigo-600">{formatVND(displayTotal)}</span>
            </div>
            <p className="mt-3 mb-8 text-center text-[11px] leading-relaxed text-gray-500">
              Giá đã bao gồm thuế GTGT (VAT) theo quy định.
            </p>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
            >
              Thanh toán <span className="material-icons group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
