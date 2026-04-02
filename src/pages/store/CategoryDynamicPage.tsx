import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApiCategories, useApiProductsBySlug } from '@/hooks/useProductApi';
import { isApiConfigured } from '@/services/api';
import ProductCard from '@/features/products/components/ProductCard';
import Breadcrumbs from '@/components/store/Breadcrumbs';
import type { Product } from '@/types';

/**
 * PLP theo slug danh mục (API). Các route tĩnh /category/mobile|accessories|audio vẫn dùng trang riêng.
 */
const CategoryDynamicPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: categories, loading: catsLoading } = useApiCategories();
  const { data: products, loading: productsLoading } = useApiProductsBySlug(slug);
  const cat = categories.find((c) => c.slug === slug);
  const loading = isApiConfigured() && (catsLoading || productsLoading);
  const title = cat?.name ?? (slug.replace(/-/g, ' ') || 'Danh mục');
  const unknownCategory = isApiConfigured() && !catsLoading && !cat;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <Breadcrumbs
        items={[{ label: 'Trang chủ', path: '/' }, { label: 'Danh mục', path: '/search' }, { label: title }]}
        className="mb-6"
      />

      {loading ? (
        <div className="text-center text-slate-500 py-24">Đang tải sản phẩm…</div>
      ) : unknownCategory ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Không tìm thấy danh mục</p>
          <p className="text-slate-500 mt-2 text-sm">Slug "{slug}" chưa khớp với dữ liệu trên server.</p>
          <Link to="/search" className="inline-block mt-6 text-primary font-semibold hover:underline">
            Tìm kiếm sản phẩm
          </Link>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-slate-500">Chưa có sản phẩm trong danh mục này.</div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{title}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p as unknown as Product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryDynamicPage;
