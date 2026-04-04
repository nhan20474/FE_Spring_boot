import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiProductsBySlug } from '@/hooks/useProductApi';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatVND, productDetailPath } from '@/utils';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#f1f5f9" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="sans-serif">📱</text></svg>');

const SUB_CATEGORIES = ['iOS', 'Android', 'Feature Phones', 'Refurbished', 'All Products'];
const TOTAL_PRODUCTS = 60;
const PER_PAGE = 12;
const TOTAL_PAGES = 10;


function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <>
      {[...Array(5)].map((_, i) => {
        if (i < full) return <span key={i} className="material-icons text-yellow-400 text-sm">star</span>;
        if (i === full && half) return <span key={i} className="material-icons text-yellow-400 text-sm">star_half</span>;
        return <span key={i} className="material-icons text-slate-300 text-sm">star</span>;
      })}
    </>
  );
}

function Badge({ label, variant }: { label: string; variant: 'primary' | 'red' | 'slate' | 'green' }) {
  const bg =
    variant === 'primary'
      ? 'bg-primary'
      : variant === 'red'
        ? 'bg-red-500'
        : variant === 'slate'
          ? 'bg-slate-800'
          : 'bg-green-500';
  return (
    <span className={`absolute top-4 left-4 ${bg} text-white text-[10px] font-bold px-2 py-1 rounded uppercase`}>
      {label}
    </span>
  );
}

const MobileCategoryPage: React.FC = () => {
  const { addItem } = useCart();
  const { toggleItem, isInWishlist } = useWishlist();
  const [sortValue, setSortValue] = useState('createdAt-desc');
  const [sortBy, sortDir] = sortValue.split('-');
  const { data: mobileCategoryProducts, loading } = useApiProductsBySlug('mobile', sortBy, sortDir);
  const [selectedSub, setSelectedSub] = useState('All Products');
  const [page, setPage] = useState(1);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const markImageError = (id: string) => setFailedImageIds((prev) => new Set(prev).add(id));

  const getBadgeVariant = (badge: string): 'primary' | 'red' | 'slate' | 'green' => {
    if (badge === 'New Arrival') return 'primary';
    if (badge === 'Save 15%') return 'red';
    if (badge === 'Refurbished') return 'slate';
    if (badge === 'In Stock') return 'green';
    return 'primary';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link to="/" className="hover:text-primary">Trang chủ</Link>
          <span className="material-icons text-xs">chevron_right</span>
          <Link to="/search" className="hover:text-primary">Mua theo danh mục</Link>
          <span className="material-icons text-xs">chevron_right</span>
          <span className="text-primary font-medium">Mobile</span>
        </nav>



        {/* Sub-Category Ribbon */}
        <section className="flex flex-wrap items-center justify-center gap-4 mb-12">
          {SUB_CATEGORIES.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedSub(label)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all shadow-sm ${
                selectedSub === label
                  ? 'bg-primary/10 border border-primary/20 text-primary font-bold'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </section>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Product Grid */}
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-8">
              <p className="text-sm text-slate-500">
                Hiển thị <span className="font-bold text-slate-900 dark:text-white">{mobileCategoryProducts.length}</span> sản phẩm trên tổng{' '}
                <span className="font-bold text-slate-900 dark:text-white">{TOTAL_PRODUCTS}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Sắp xếp theo:</span>
                <select
                  value={sortValue}
                  onChange={(e) => setSortValue(e.target.value)}
                  className="text-sm border-none bg-transparent font-bold focus:ring-0 cursor-pointer"
                >
                  <option value="createdAt-desc">Mới nhất</option>
                  <option value="createdAt-asc">Cũ nhất</option>
                  <option value="price-asc">Giá: Thấp đến cao</option>
                  <option value="price-desc">Giá: Cao đến thấp</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {mobileCategoryProducts.map((product) => {
                const productId = product.productDetailId || product.id;
                const productPath = productDetailPath({
                  id: product.id,
                  slug: product.slug,
                  productDetailId: product.productDetailId,
                });
                return (
                  <Link
                    key={product.id}
                    to={productPath}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden group hover:shadow-xl transition-all duration-300 flex flex-col"
                  >
                  <div className="relative p-6 h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50">
                    {product.badge && (
                      <Badge label={product.badge} variant={getBadgeVariant(product.badge)} />
                    )}
                    <button
                      type="button"
                      className={`absolute top-4 right-4 p-2 bg-white/80 dark:bg-slate-700/80 rounded-full transition-colors z-20 ${isInWishlist(productId) ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleItem({
                          productId,
                          name: product.name,
                          image: product.image || '',
                          price: product.price,
                          oldPrice: product.oldPrice,
                          rating: product.rating,
                          reviews: product.reviews ?? 0,
                        });
                      }}
                      aria-label={isInWishlist(productId) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                    >
                      <span className="material-icons text-lg">{isInWishlist(productId) ? 'favorite' : 'favorite_border'}</span>
                    </button>
                    <img
                      className="h-48 group-hover:scale-105 transition-transform duration-300 object-contain"
                      src={failedImageIds.has(product.id) || !product.image ? PLACEHOLDER_IMAGE : product.image}
                      alt={product.name}
                      onError={() => markImageError(product.id)}
                    />
                  </div>
                  <div className="p-6 flex-grow flex flex-col">
                    <div className="flex items-center gap-1 mb-2">
                      <StarRating rating={product.rating} />
                      <span className="text-xs text-slate-400 ml-1">({product.reviews} đánh giá)</span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    {product.specs && (
                      <p className="text-xs text-slate-500 mb-4 font-medium">{product.specs}</p>
                    )}
                    <div className="mt-auto">
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-xl font-bold text-slate-900 dark:text-white">
                          {formatVND(product.price)}
                        </span>
                        {product.oldPrice && (
                          <span className="text-sm text-slate-400 line-through">
                            {formatVND(product.oldPrice)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="w-full bg-primary text-white py-3 rounded font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 z-20"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            addItem({
                              productId: product.productDetailId ?? product.id,
                              name: product.name,
                              price: product.price,
                              image: product.image || '',
                            });
                          } catch (_) {}
                        }}
                      >
                        <span className="material-icons text-sm">shopping_cart</span>
                        Thêm vào giỏ
                      </button>
                    </div>
                  </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-12 flex justify-center">
              <nav className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-10 h-10 flex items-center justify-center rounded border border-slate-200 dark:border-slate-800 hover:border-primary hover:text-primary transition-all"
                >
                  <span className="material-icons text-sm">chevron_left</span>
                </button>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-10 h-10 flex items-center justify-center rounded font-bold transition-all ${
                      page === n ? 'bg-primary text-white' : 'border border-slate-200 dark:border-slate-800 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="px-2 text-slate-400">...</span>
                <button
                  type="button"
                  onClick={() => setPage(TOTAL_PAGES)}
                  className="w-10 h-10 flex items-center justify-center rounded border border-slate-200 dark:border-slate-800 hover:border-primary hover:text-primary transition-all"
                >
                  {TOTAL_PAGES}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
                  className="w-10 h-10 flex items-center justify-center rounded border border-slate-200 dark:border-slate-800 hover:border-primary hover:text-primary transition-all"
                >
                  <span className="material-icons text-sm">chevron_right</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
    </div>
  );
};

export default MobileCategoryPage;
