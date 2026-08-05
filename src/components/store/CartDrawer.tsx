import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/lib/cart';
import { formatBRL } from '@/lib/format';

export default function CartDrawer() {
  const { items, isOpen, setOpen, remove, updateQty, subtotal } = useCart();

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-cream-50 h-full shadow-modal flex flex-col page-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
              <h3 className="font-display text-lg font-semibold text-neutral-800 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary-600" />
                Seu Carrinho
              </h3>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-cream-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-16 h-16 text-neutral-300 mb-4" />
                  <p className="text-neutral-500 font-medium">Seu carrinho está vazio</p>
                  <Link to="/catalogo" onClick={() => setOpen(false)} className="btn-primary mt-6">
                    Explorar produtos
                  </Link>
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={`${item.id}-${item.variation}`} className="flex gap-3 bg-white rounded-xl p-3 shadow-card">
                      <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-800 line-clamp-2">{item.name}</p>
                        {item.variation && <p className="text-xs text-neutral-500 mt-0.5">{item.variation}</p>}
                        <p className="text-primary-600 font-semibold text-sm mt-1">{formatBRL(item.price)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQty(item.id, item.variation, item.qty - 1)}
                            className="p-1 rounded-md hover:bg-cream-100"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, item.variation, item.qty + 1)}
                            className="p-1 rounded-md hover:bg-cream-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => remove(item.id, item.variation)}
                            className="ml-auto p-1 rounded-md hover:bg-red-50 text-neutral-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-cream-200 px-6 py-4 space-y-3 bg-white">
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-neutral-800">{formatBRL(subtotal)}</span>
                </div>
                <Link to="/checkout" onClick={() => setOpen(false)} className="btn-primary w-full">
                  Finalizar Compra
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
