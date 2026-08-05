import { type ReactNode } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, Bell, Settings, LogOut, ShoppingBag, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Produtos', icon: Package },
  { to: '/admin/notifications', label: 'Notificações', icon: Bell },
  { to: '/admin/settings', label: 'Configurações', icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-cream-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900 text-neutral-300 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-5 border-b border-neutral-800">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <img src="/image.png" alt="Mamajula" className="h-10 w-auto object-contain bg-white/5 rounded-lg p-1" />
            <div>
              <p className="font-display text-lg text-white">Mamajula</p>
              <p className="text-xs text-neutral-500">Painel Admin</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary-600 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-neutral-800 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors">
            <ExternalLink className="w-5 h-5" /> Ver loja
          </Link>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neutral-400 hover:bg-red-900/40 hover:text-red-300 transition-colors">
            <LogOut className="w-5 h-5" /> Sair
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-64">
        <header className="bg-white border-b border-cream-200 px-8 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-neutral-800">
            {navItems.find((n) => location.pathname === n.to)?.label ?? 'Painel'}
          </h1>
          <div className="flex items-center gap-3">
            <Link to="/" className="btn-ghost text-sm">
              <ShoppingBag className="w-4 h-4" /> Ver loja
            </Link>
            <span className="text-sm text-neutral-500">{user.email}</span>
          </div>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
