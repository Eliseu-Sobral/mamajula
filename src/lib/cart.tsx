import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  variation?: string;
};

type CartContextType = {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (id: string, variation?: string) => void;
  updateQty: (id: string, variation: string | undefined, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = 'mamajula-cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add: CartContextType['add'] = (item, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id && p.variation === item.variation);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
    setOpen(true);
  };

  const remove: CartContextType['remove'] = (id, variation) => {
    setItems((prev) => prev.filter((p) => !(p.id === id && p.variation === variation)));
  };

  const updateQty: CartContextType['updateQty'] = (id, variation, qty) => {
    if (qty < 1) return;
    setItems((prev) =>
      prev.map((p) =>
        p.id === id && p.variation === variation ? { ...p, qty } : p,
      ),
    );
  };

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, updateQty, clear, count, subtotal, isOpen, setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
