import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiFeaturedProducts } from '@/hooks/useProductApi';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatVND, productDetailPath } from '@/utils';
import type { TrendingProduct as TrendingProductType } from '@/types';

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#f1f5f9" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="sans-serif">📱</text></svg>');

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex text-amber-400">
      {[...Array(5)].map((_, i) => {
        if (i < full) return <span key={i} className="material-icons text-sm">star</span>;
        if (i === full && half) return <span key={i} className="material-icons text-sm">star_half</span>;
        return <span key={i} className="material-icons text-sm">star_border</span>;
      })}
    </div>
  );
}

interface TrendingCardProps {
  product: TrendingProductType;
  imageError: boolean;
  onImageError: () => void;
}

const TrendingCard: React.FC<TrendingCardProps> = ({ product, imageError, onImageError }) => {
  const { addItem } = useCart();
  const { toggleItem, isInWishlist } = useWishlist();
  const to = productDetailPath({
    id: product.id,
    slug: product.slug,
    productDetailId: product.productDetailId,
  });
  const productId = product.productDetailId ?? product.id;
  const imgSrc = imageError || !product.image ? PLACEHOLDER_IMAGE : product.image;
  const inWishlist = isInWishlist(productId);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      addItem({ productId, name: product.name, price: product.price, image: product.image || '' });
    } catch (_) { }
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
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
  };

  return (
    <Link
      to={to}
      className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all flex flex-col group relative z-10"
    >
      <div className="relative mb-4 h-48 overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
        <img
          src={imgSrc}
          alt={product.name}
          className="max-h-full transition-transform group-hover:scale-110 object-contain"
          onError={onImageError}
        />
        {product.isBestSeller && (
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded z-20">
            BÁN CHẠY
          </span>
        )}
        <button
          type="button"
          className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full text-slate-400 hover:text-red-500 transition-colors z-20"
          onClick={handleWishlistToggle}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={inWishlist ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        >
          <span className={`material-icons text-xl ${inWishlist ? 'text-red-500' : ''}`}>{inWishlist ? 'favorite' : 'favorite_border'}</span>
        </button>
      </div>
      <div className="flex-grow">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</span>
        <h4 className="font-bold text-slate-900 dark:text-white mt-1 mb-2 line-clamp-2">{product.name}</h4>
        <div className="flex items-center gap-1 mb-3">
          <StarRating rating={product.rating} />
          <span className="text-xs text-slate-400 font-medium">({product.reviews.toLocaleString()})</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <span className="block text-2xl font-black text-slate-900 dark:text-white">
            {formatVND(product.price)}
          </span>
        </div>
        <button
          type="button"
          className="bg-primary text-white p-2 rounded-lg hover:bg-blue-600 transition-colors z-20"
          onClick={handleAddToCart}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="material-icons">add_shopping_cart</span>
        </button>
      </div>
    </Link>
  );
}

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'bestseller' | 'featured'>('new');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const { data: trendingProducts } = useApiFeaturedProducts();

  const markImageError = (id: string) => setFailedImageIds((prev) => new Set(prev).add(id));

  const isUsingApiProducts = true;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <main className="container mx-auto px-4 py-8">


        <section className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sản phẩm nổi bật</h3>
            </div>
            <Link to="/search" className="text-primary font-bold hover:underline flex items-center gap-1">
              Xem tất cả <span className="material-icons text-sm">arrow_forward</span>
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('new')}
              className={`pb-3 px-4 font-semibold text-sm transition-colors ${activeTab === 'new'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Hàng mới về
            </button>
            <button
              onClick={() => setActiveTab('bestseller')}
              className={`pb-3 px-4 font-semibold text-sm transition-colors ${activeTab === 'bestseller'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Bán chạy
            </button>
            <button
              onClick={() => setActiveTab('featured')}
              className={`pb-3 px-4 font-semibold text-sm transition-colors ${activeTab === 'featured'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Sản phẩm nổi bật
            </button>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingProducts
              .filter((product) => {
                if (activeTab === 'new') {
                  // New Arrival: from API show all; from mock use !isBestSeller
                  if (isUsingApiProducts) return true;
                  return !product.isBestSeller;
                } else if (activeTab === 'bestseller') {
                  return product.isBestSeller === true;
                } else {
                  return true;
                }
              })
              .map((product) => (
                <TrendingCard
                  key={product.id}
                  product={product}
                  imageError={failedImageIds.has(product.id)}
                  onImageError={() => markImageError(product.id)}
                />
              ))}
          </div>
        </section>

      </main>
    </div>
  );
};

export default HomePage;
