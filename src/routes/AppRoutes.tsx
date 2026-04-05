import React from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/pages/store/HomePage';
import SearchResults from '@/pages/store/SearchResults';
import ProductDetail from '@/pages/store/ProductDetail';
import CartPage from '@/pages/checkout/CartPage';
import ProductListingPage from '@/pages/store/ProductListingPage';
import CategoryDynamicPage from '@/pages/store/CategoryDynamicPage';
import ProfilePage from '@/pages/account/ProfilePage';
import MobileCategoryPage from '@/pages/store/MobileCategoryPage';
import AccessoriesCategoryPage from '@/pages/store/AccessoriesCategoryPage';
import AudioCategoryPage from '@/pages/store/AudioCategoryPage';
import OrderConfirmationPage from '@/pages/checkout/OrderConfirmationPage';
import ForbiddenPage from '@/pages/ForbiddenPage';
import CheckoutPage from '@/pages/checkout/CheckoutPage';
import LoginPage from '@/pages/auth/LoginPage';
import OrderHistoryPage from '@/pages/account/OrderHistoryPage';
import OrderDetailsPage from '@/pages/account/OrderDetailsPage';
import OrderInvoicePage from '@/pages/account/OrderInvoicePage';
import SavedAddressesPage from '@/pages/account/SavedAddressesPage';
import WishlistPage from '@/pages/account/WishlistPage';
import SignUpPage from '@/pages/auth/SignUpPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import NotFoundPage from '@/pages/NotFoundPage';
import PrivateRoute from '@/routes/PrivateRoute';
import AdminLayout from '@/pages/admin/AdminLayout';
import DashboardPage from '@/pages/admin/DashboardPage';
import AdminProfilePage from '@/pages/admin/AdminProfilePage';
import ProductListPage from '@/pages/admin/products/ProductListPage';
import ProductFormPage from '@/pages/admin/products/ProductFormPage';
import ProductStockPage from '@/pages/admin/products/ProductStockPage';
import CategoryListPage from '@/pages/admin/categories/CategoryListPage';
import OrderListPage from '@/pages/admin/orders/OrderListPage';
import OrderDetailPage from '@/pages/admin/orders/OrderDetailPage';
import InvoicePage from '@/pages/admin/orders/InvoicePage';
import CouponListPage from '@/pages/admin/coupons/CouponListPage';
import UserListPage from '@/pages/admin/users/UserListPage';

const AppRoutes: React.FC = () => (
  <Routes>
    <Route element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/product/:slug" element={<ProductDetail />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/deals" element={<ProductListingPage />} />
      <Route path="/category/mobile" element={<MobileCategoryPage />} />
      <Route path="/category/accessories" element={<AccessoriesCategoryPage />} />
      <Route path="/category/audio" element={<AudioCategoryPage />} />
      <Route path="/category/:slug" element={<CategoryDynamicPage />} />
    </Route>

    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
    <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignUpPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/orders" element={<OrderHistoryPage />} />
    <Route path="/order/:orderId/invoice" element={<PrivateRoute><OrderInvoicePage /></PrivateRoute>} />
    <Route path="/order/:orderId" element={<OrderDetailsPage />} />
    <Route path="/account/addresses" element={<SavedAddressesPage />} />
    <Route path="/wishlist" element={<WishlistPage />} />
    <Route element={<PrivateRoute requiredRole="admin"><AdminLayout /></PrivateRoute>}>
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<DashboardPage />} />
      <Route path="/admin/profile" element={<AdminProfilePage />} />
      <Route path="/admin/products" element={<ProductListPage />} />
      <Route path="/admin/products/stock" element={<ProductStockPage />} />
      <Route path="/admin/products/new" element={<ProductFormPage />} />
      <Route path="/admin/products/:id" element={<ProductFormPage />} />
      <Route path="/admin/categories" element={<CategoryListPage />} />
      <Route path="/admin/coupons" element={<CouponListPage />} />
      <Route path="/admin/users" element={<UserListPage />} />

      <Route path="/admin/orders/invoice" element={<InvoicePage />} />
      <Route path="/admin/orders" element={<OrderListPage />} />
      <Route path="/admin/orders/:orderId" element={<OrderDetailPage />} />
    </Route>
    <Route path="/403" element={<ForbiddenPage />} />
    <Route path="/*" element={<NotFoundPage />} />
  </Routes>
);

export default AppRoutes;
