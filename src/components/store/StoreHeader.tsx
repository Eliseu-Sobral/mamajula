import { Link } from 'react-router-dom';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/lib/cart';

export default function StoreHeader() {
  const { count, setOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/catalogo/promocoes', label: 'Promoções' },
    { to: '/sobre', label: 'Sobre' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-md border-b border-cream-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-3">
            <img src="/image.png" alt="Mamajula" className="h-10 md:h-12 w-auto object-contain" />
            <span className="font-display text-xl md:text-2xl font-semibold text-primary-700 hidden sm:inline">
              Mamajula
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-sm font-medium text-neutral-600 hover:text-primary-600 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="relative p-2 rounded-lg hover:bg-cream-100 transition-colors"
              aria-label="Carrinho"
            >
              <ShoppingBag className="w-6 h-6 text-neutral-700" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-cream-100"
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-2">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-neutral-700 hover:bg-cream-100 font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
