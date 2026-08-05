import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '@/lib/cart';
import { AuthProvider } from '@/lib/auth';
import StoreLayout from '@/components/store/StoreLayout';
import HomePage from '@/pages/store/HomePage';
import CatalogPage from '@/pages/store/CatalogPage';
import ProductPage from '@/pages/store/ProductPage';
import CheckoutPage from '@/pages/store/CheckoutPage';
import AboutPage from '@/pages/store/AboutPage';
import AdminLogin from '@/pages/admin/AdminLogin';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminNotifications from '@/pages/admin/AdminNotifications';
import AdminSettings from '@/pages/admin/AdminSettings';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Storefront */}
            <Route path="/" element={<StoreLayout><HomePage /></StoreLayout>} />
            <Route path="/catalogo" element={<StoreLayout><CatalogPage /></StoreLayout>} />
            <Route path="/catalogo/:category" element={<StoreLayout><CatalogPage /></StoreLayout>} />
            <Route path="/produto/:id" element={<StoreLayout><ProductPage /></StoreLayout>} />
            <Route path="/checkout" element={<StoreLayout><CheckoutPage /></StoreLayout>} />
            <Route path="/sobre" element={<StoreLayout><AboutPage /></StoreLayout>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/products" element={<AdminLayout><AdminProducts /></AdminLayout>} />
            <Route path="/admin/notifications" element={<AdminLayout><AdminNotifications /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
