import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApiProduct } from '@/hooks/useProductApi';
import { isApiConfigured } from '@/services/api';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatVND } from '@/utils';
import Breadcrumbs from '@/components/store/Breadcrumbs';

const EMPTY_COLORS: { name: string; hex: string }[] = [];
const EMPTY_STORAGE_OPTS: string[] = [];

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#f1f5f9" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="sans-serif">📱</text></svg>');

const ProductDetail: React.FC = () => {
  const { slug: segment } = useParams<{ slug: string }>();
  const { data: product, loading: apiLoading } = useApiProduct(segment);
  const extras = null;

  const { addItem } = useCart();
  const { toggleItem, isInWishlist } = useWishlist();
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [justAddedToCart, setJustAddedToCart] = useState(false);
  const [failedThumbIndices, setFailedThumbIndices] = useState<Set<number>>(() => new Set());

  const colors = useMemo(
    () => (product?.colors && product.colors.length > 0 ? product.colors : EMPTY_COLORS),
    [product?.colors],
  );

  const storageOptions = useMemo(
    () => (product?.storageOptions && product.storageOptions.length > 0 ? product.storageOptions : EMPTY_STORAGE_OPTS),
    [product?.storageOptions],
  );

  useEffect(() => {
    setFailedThumbIndices(new Set());
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const c = product.colors;
    const s = product.storageOptions;
    setSelectedColor(c?.length ? c[0].name : '');
    setSelectedSize(s?.length ? (s[1] ?? s[0]) : '');
  }, [product?.id, product?.colors, product?.storageOptions]);

  if (isApiConfigured() && apiLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-display flex items-center justify-center">
        <div className="text-center text-slate-500">Đang tải sản phẩm...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark font-display flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Không tìm thấy sản phẩm</h1>
          <Link to="/" className="text-primary hover:underline">Về trang chủ</Link>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const mainImage = images[selectedImageIndex] ?? images[0];
  const mainImageSrc = failedThumbIndices.has(selectedImageIndex) ? PLACEHOLDER_IMAGE : mainImage;
  const thumbSrc = (idx: number) => (failedThumbIndices.has(idx) ? PLACEHOLDER_IMAGE : (images[idx] ?? ''));

  const renderStars = (rating: number, size = 'text-sm') => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <div className={`flex ${size}`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= full || (i === full + 1 && half);
          const icon = i <= full ? 'star' : i === full + 1 && half ? 'star_half' : 'star';
          return (
            <span key={i} className={`material-icons ${filled ? 'text-amber-400' : 'text-slate-300'}`}>{icon}</span>
          );
        })}
      </div>
    );
  };

  // Determine category path for breadcrumbs
  const getCategoryPath = () => {
    const categoryLower = product.category.toLowerCase();
    if (categoryLower.includes('smartphone') || categoryLower.includes('mobile')) return '/search?category=mobile';
    if (categoryLower.includes('tablet')) return '/search?category=tablets';
    if (categoryLower.includes('accessories')) return '/category/accessories';
    if (categoryLower.includes('audio') || categoryLower.includes('headphone')) return '/category/audio';
    return '/search';
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased">
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-10">
        <Breadcrumbs
          items={[
            { label: 'Trang chủ', path: '/' },
            { label: 'Catalog', path: '/search' },
            { label: product.category, path: getCategoryPath() },
            ...(extras?.brand ? [{ label: extras.brand, path: '/search' }] : []),
            { label: product.name }
          ]}
          className="mb-6 md:mb-8"
        />

        <section className="mb-12 md:mb-16 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 lg:min-h-[420px]">
            <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4 p-4 sm:p-6 lg:border-r border-slate-200 dark:border-slate-800">
              <div className="flex md:flex-col gap-2 sm:gap-3 overflow-x-auto md:overflow-y-auto md:max-h-[min(520px,70vh)] hide-scrollbar py-1">
                {images.slice(0, 5).map((img, num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSelectedImageIndex(num)}
                    className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex-shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all ${selectedImageIndex === num ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'border border-slate-200 dark:border-slate-700 hover:border-primary/50 opacity-90 hover:opacity-100'}`}
                  >
                    <img alt={`Thumbnail ${num + 1}`} src={thumbSrc(num)} className="w-full h-full object-cover" onError={() => setFailedThumbIndices((prev) => new Set(prev).add(num))} />
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-[240px] sm:min-h-[320px] rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-center relative group">
                <img alt={product.name} src={mainImageSrc} className="w-full h-full max-h-[min(480px,55vh)] object-contain p-4 sm:p-6" onError={() => setFailedThumbIndices((prev) => new Set(prev).add(selectedImageIndex))} />
                <button type="button" className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/80 backdrop-blur p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Phóng to ảnh">
                  <span className="material-icons text-lg text-slate-700 dark:text-slate-200">zoom_in</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col p-5 sm:p-6 lg:p-8">
              <div className="mb-5">
                {product.tag && <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest">{product.tag}</span>}
                <h1 className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-bold mt-1.5 leading-snug">{product.name}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-sm text-slate-500">
                  {renderStars(product.rating)}
                  <span className="font-medium underline-offset-2 hover:underline cursor-pointer">{product.reviews} đánh giá</span>
                  {product.sku && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
                      <span>SKU: {product.sku}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/30 px-4 py-3 mb-5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">{formatVND(product.price)}</span>
                  {product.oldPrice && <span className="text-sm text-slate-400 line-through tabular-nums">{formatVND(product.oldPrice)}</span>}
                </div>
                <p className={`text-xs sm:text-sm font-semibold mt-1.5 ${product.inStock !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                  {product.inStock !== false ? 'Còn hàng · Sẵn sàng giao' : 'Hết hàng'}
                </p>
              </div>

              {(colors.length > 0 || storageOptions.length > 0) && (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/40 p-4 mb-5 space-y-5">
                  {colors.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Màu sắc</p>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((color) => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => setSelectedColor(color.name)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold leading-tight transition-colors ${selectedColor === color.name ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary/50'}`}
                          >
                            {color.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {storageOptions.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Dung lượng</p>
                      <div className="flex flex-wrap gap-2">
                        {storageOptions.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold leading-tight transition-colors ${selectedSize === size ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary/50'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-auto mb-5">
                <button
                  type="button"
                  disabled={product.inStock === false}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void (async () => {
                      const r = await addItem({
                        productId: String(product.id),
                        name: product.name,
                        price: Number(product.price),
                        image: Array.isArray(product.images) && product.images[0] ? product.images[0] : (product.image || ''),
                        variant: [selectedColor, selectedSize].filter(Boolean).join(', ') || undefined,
                      });
                      if (!r.ok) {
                        window.alert(r.message);
                        return;
                      }
                      setJustAddedToCart(true);
                      setTimeout(() => setJustAddedToCart(false), 2000);
                    })();
                  }}
                  className="flex-1 min-w-0 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold text-sm sm:text-base py-3 sm:py-3.5 rounded-xl shadow-md shadow-primary/15 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-icons text-xl">{justAddedToCart ? 'check_circle' : 'shopping_bag'}</span>
                  {justAddedToCart ? 'Đã thêm vào giỏ' : 'Thêm vào giỏ'}
                </button>
                <button
                  type="button"
                  className={`shrink-0 w-12 sm:w-14 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${product && isInWishlist(product.id) ? 'text-red-500 border-red-200 dark:border-red-900/50' : ''}`}
                  onClick={() =>
                    product &&
                    toggleItem({
                      productId: product.id,
                      name: product.name,
                      image: product.image || '',
                      price: product.price,
                      oldPrice: product.oldPrice,
                      rating: product.rating,
                      reviews: product.reviews ?? 0,
                    })
                  }
                  aria-label={product && isInWishlist(product.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                >
                  <span className="material-icons">{product && isInWishlist(product.id) ? 'favorite' : 'favorite_border'}</span>
                </button>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="material-icons text-primary text-xl shrink-0">local_shipping</span>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">Giao hàng nhanh</p>
                    <p className="text-xs text-slate-500 mt-0.5">Miễn phí vận chuyển cho đơn đủ điều kiện</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-icons text-primary text-xl shrink-0">verified_user</span>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">Bảo hành chính hãng</p>
                    <p className="text-xs text-slate-500 mt-0.5">Theo chính sách nhà sản xuất</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

          {product.description?.trim() ? (
            <section className="mb-10 md:mb-14" aria-labelledby="product-description-heading">
              <h2 id="product-description-heading" className="text-lg sm:text-xl font-bold mb-4 text-slate-900 dark:text-white">
                Mô tả sản phẩm
              </h2>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-5 py-5 sm:px-7 sm:py-6">
                <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-w-3xl">
                  {product.description.trim()}
                </div>
              </div>
            </section>
          ) : null}

        {(() => {
          function renderSpecValue(v: unknown): React.ReactNode {
            if (v == null) return '—';
            if (Array.isArray(v)) return v.join(', ');
            if (typeof v === 'object') {
              return (
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                  {Object.entries(v).map(([k, val]) => (
                    <li key={k}>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{k}:</span>{' '}
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </li>
                  ))}
                </ul>
              );
            }
            return String(v);
          }
          let apiSpecs: Record<string, unknown> | null = null;
          if (product.specifications && typeof product.specifications === 'string') {
            try {
              apiSpecs = JSON.parse(product.specifications) as Record<string, unknown>;
            } catch {
              apiSpecs = null;
            }
          }
          if (apiSpecs && Object.keys(apiSpecs).length > 0) {
            return (
              <section className="mb-16 md:mb-20" key="api-specs">
                <h2 className="text-lg sm:text-xl font-bold mb-4 text-slate-900 dark:text-white">Thông số kỹ thuật</h2>
                <div className="space-y-4 sm:space-y-5">
                  {Object.entries(apiSpecs).map(([key, block]) => {
                    if (key === 'tenSanPham' || block == null) return null;
                    const isObj = block && typeof block === 'object' && !Array.isArray(block);
                    const rows = isObj ? Object.entries(block as Record<string, unknown>) : [];
                    return (
                      <div key={key} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/30 shadow-sm">
                        <h3 className="bg-slate-50 dark:bg-slate-800/60 px-4 sm:px-5 py-2.5 text-sm sm:text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800">
                          {key}
                        </h3>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {rows.map(([rowKey, value], idx) => (
                            <div
                              key={rowKey}
                              className={`flex flex-col sm:flex-row sm:items-start sm:gap-6 px-4 sm:px-5 py-3 sm:py-3.5 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900/20' : 'bg-slate-50/60 dark:bg-slate-800/20'}`}
                            >
                              <dt className="font-semibold text-xs sm:text-sm text-slate-600 dark:text-slate-400 sm:w-[38%] shrink-0">{rowKey}</dt>
                              <dd className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1 sm:mt-0 flex-1 min-w-0">{renderSpecValue(value)}</dd>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }
          if (extras && extras.specs.length > 0) {
            return (
              <section className="mb-20" key="mock-specs">
                <h2 className="text-2xl font-bold mb-8">Thông số kỹ thuật</h2>
                <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {extras.specs.map((spec, idx) => (
                        <tr key={spec.label} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}>
                          <td className="py-4 px-6 font-semibold text-sm w-1/3">{spec.label}</td>
                          <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400">{spec.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          }
          return null;
        })()}
        {extras && (
          <section className="mb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
              <div>
                <h2 className="text-2xl font-bold mb-2">Đánh giá của khách hàng</h2>
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-bold">{extras.reviewScore}</span>
                  <div>{renderStars(extras.reviewScore, '')}<p className="text-sm text-slate-500 font-medium">Dựa trên {product.reviews} đánh giá</p></div>
                </div>
              </div>
              {extras.reviewDistribution && (
                <div className="flex-grow max-w-md">
                  <div className="space-y-2">
                    {([5, 4, 3] as const).map((star) => (
                      <div key={star} className="flex items-center gap-4">
                        <span className="text-xs font-medium w-4">{star}</span>
                        <div className="flex-grow bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-primary h-full" style={{ width: `${extras.reviewDistribution[star] ?? 0}%` }} /></div>
                        <span className="text-xs text-slate-500 w-10 text-right">{extras.reviewDistribution[star] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Viết đánh giá</button>
            </div>
            {extras.customerPhotos && extras.customerPhotos.length > 0 && (
              <div className="mb-10">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Ảnh của khách hàng</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                  {extras.customerPhotos.map((photo, i) => <img key={i} src={photo} alt="" className="w-32 h-32 rounded-lg object-cover flex-shrink-0" />)}
                  <div className="w-32 h-32 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer text-slate-500 flex-shrink-0"><span className="text-sm font-bold">+24 ảnh khác</span></div>
                </div>
              </div>
            )}
            {extras.reviews && extras.reviews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {extras.reviews.map((review, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-primary/20 text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'}`}>{review.initials}</div>
                        <div><p className="font-bold">{review.author}</p><p className="text-xs text-slate-500">{review.verified ? 'Người mua đã xác nhận' : ''} • {review.date}</p></div>
                      </div>
                      {renderStars(review.rating, 'text-xs')}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{review.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {extras && extras.relatedProducts && extras.relatedProducts.length > 0 && (
          <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Sản phẩm liên quan</h2>
              <div className="flex gap-2">
                <button type="button" className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><span className="material-icons">chevron_left</span></button>
                <button type="button" className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><span className="material-icons">chevron_right</span></button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {extras.relatedProducts.map((item) => (
                <Link key={item.id} to={`/product/${item.id}`} className="group">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-4 overflow-hidden relative">
                    <img alt={item.name} src={item.image} className="w-full h-48 object-contain transition-transform group-hover:scale-105" />
                    <button
                      type="button"
                      className={`absolute top-4 right-4 bg-white/80 dark:bg-black/40 backdrop-blur p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isInWishlist(item.id) ? 'opacity-100 text-red-500' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleItem({
                          productId: item.id,
                          name: item.name,
                          image: item.image || '',
                          price: item.price,
                          rating: 0,
                          reviews: 0,
                        });
                      }}
                      aria-label={isInWishlist(item.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                    >
                      <span className="material-icons text-sm">{isInWishlist(item.id) ? 'favorite' : 'favorite_border'}</span>
                    </button>
                  </div>
                  <h4 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{item.name}</h4>
                  <p className="text-slate-500 text-xs mb-2">{item.subtitle}</p>
                  <p className="font-bold text-primary">{formatVND(item.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ProductDetail;
