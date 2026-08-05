import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import type { Product } from '@/lib/supabase';
import { formatBRL, discountPercent } from '@/lib/format';
import { useCart } from '@/lib/cart';

const tagClass: Record<string, string> = {
  destaque: 'badge-destaque',
  novidade: 'badge-novidade',
  promocao: 'badge-promocao',
  economico: 'badge-economico',
};

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const discount = discountPercent(product.price, product.original_price);
  const soldOut = product.stock <= 0;
  const primaryTag = product.tags[0];

  return (
    <div className="card group flex flex-col">
      <Link to={`/produto/${product.id}`} className="relative block aspect-square overflow-hidden bg-cream-100">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {primaryTag && tagClass[primaryTag] && (
            <span className={`badge ${tagClass[primaryTag]}`}>{primaryTag}</span>
          )}
          {discount > 0 && (
            <span className="badge bg-primary-600 text-white">-{discount}%</span>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="badge badge-esgotado text-sm px-4 py-1">Esgotado</span>
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {product.brand && <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{product.brand}</p>}
        <Link to={`/produto/${product.id}`}>
          <h3 className="font-medium text-sm text-neutral-800 line-clamp-2 hover:text-primary-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        <div className="mt-3 mb-3">
          {product.original_price && discount > 0 && (
            <p className="text-xs text-neutral-400 line-through">{formatBRL(product.original_price)}</p>
          )}
          <p className="text-lg font-display font-semibold text-primary-700">{formatBRL(product.price)}</p>
          {discount > 0 && (
            <p className="text-xs text-success flex items-center gap-1 mt-0.5">
              <Tag className="w-3 h-3" /> Você economiza {formatBRL((product.original_price ?? 0) - product.price)}
            </p>
          )}
        </div>

        <button
          disabled={soldOut}
          onClick={() => add({ id: product.id, name: product.name, price: product.price, image: product.images[0] })}
          className="btn-primary w-full mt-auto text-xs py-2.5"
        >
          {soldOut ? 'Indisponível' : 'Adicionar ao Carrinho'}
        </button>
      </div>
    </div>
  );
}
