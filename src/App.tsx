import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { AvatarProvider } from '@/context/AvatarContext';
import { CartProvider } from '@/context/CartContext';
import { CheckoutProvider } from '@/context/CheckoutContext';
import { WishlistProvider } from '@/context/WishlistContext';
import AppRoutes from '@/routes/AppRoutes';
import SupportChatWidget from '@/components/chat/SupportChatWidget';

const App: React.FC = () => (
  <HashRouter>
    <AuthProvider>
      <AvatarProvider>
        <CartProvider>
          <WishlistProvider>
            <CheckoutProvider>
              <AppRoutes />
              <SupportChatWidget />
            </CheckoutProvider>
          </WishlistProvider>
        </CartProvider>
      </AvatarProvider>
    </AuthProvider>
  </HashRouter>
);

export default App;
