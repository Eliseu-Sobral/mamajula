import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Truck, ShieldCheck, Minus, Plus, ShoppingBag } from 'lucide-react';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { formatBRL, discountPercent } from '@/lib/format';
import { useCart } from '@/lib/cart';
import ProductCard from '@/components/store/ProductCard';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { add, setOpen } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [variation, setVariation] = useState<string | undefined>(undefined);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
      setProduct(data);
      if (data?.variations?.[0]?.options?.[0]) setVariation(data.variations[0].options[0]);
      if (data?.category_id) {
        const { data: cat } = await supabase.from('categories').select('*').eq('id', data.category_id).maybeSingle();
        setCategory(cat);
        const { data: rel } = await supabase
          .from('products')
          .select('*')
          .eq('category_id', data.category_id)
          .neq('id', id)
          .limit(4);
        setRelated(rel ?? []);
      }
      setLoading(false);
      setActiveImage(0);
      setQty(1);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-cream-100 rounded-xl3 animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-cream-100 rounded animate-pulse w-3/4" />
            <div className="h-6 bg-cream-100 rounded animate-pulse w-1/2" />
            <div className="h-32 bg-cream-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-neutral-500 text-lg">Produto não encontrado.</p>
        <Link to="/catalogo" className="btn-primary mt-6">Voltar ao catálogo</Link>
      </div>
    );
  }

  const discount = discountPercent(product.price, product.original_price);
  const soldOut = product.stock <= 0;

  const handleAdd = () => {
    add({ id: product.id, name: product.name, price: product.price, image: product.images[0], variation }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="page-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-6 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square rounded-xl3 overflow-hidden bg-cream-100 shadow-card mb-4">
            <img src={product.images[activeImage] ?? product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${activeImage === i ? 'border-primary-500' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.brand && <p className="text-sm text-neutral-400 uppercase tracking-wide mb-2">{product.brand}</p>}
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-neutral-800 mb-3">{product.name}</h1>

          {category && (
            <Link to={`/catalogo/${category.slug}`} className="text-sm text-primary-600 hover:underline">
              {category.name}
            </Link>
          )}

          <div className="mt-4 mb-6">
            {product.original_price && discount > 0 && (
              <p className="text-neutral-400 line-through text-base">{formatBRL(product.original_price)}</p>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-display font-semibold text-primary-700">{formatBRL(product.price)}</span>
              {discount > 0 && <span className="badge bg-primary-600 text-white">-{discount}%</span>}
            </div>
            {discount > 0 && (
              <p className="text-sm text-success mt-1">
                Economize {formatBRL((product.original_price ?? 0) - product.price)}
              </p>
            )}
          </div>

          <p className="text-neutral-600 leading-relaxed mb-6">{product.description}</p>

          {/* Variations */}
          {product.variations && product.variations.length > 0 && (
            <div className="mb-6">
              <p className="label">{product.variations[0].name}</p>
              <div className="flex flex-wrap gap-2">
                {product.variations[0].options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setVariation(opt)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${variation === opt ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600 hover:border-primary-300'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + add */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-neutral-200 rounded-xl">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-cream-100 rounded-l-xl">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="p-3 hover:bg-cream-100 rounded-r-xl">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button onClick={handleAdd} disabled={soldOut} className="btn-primary flex-1">
              {added ? <><Check className="w-5 h-5" /> Adicionado!</> : <><ShoppingBag className="w-5 h-5" /> Adicionar ao Carrinho</>}
            </button>
          </div>

          {/* Trust */}
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-cream-200">
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Truck className="w-5 h-5 text-primary-500" /> Envio para todo Brasil
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <ShieldCheck className="w-5 h-5 text-primary-500" /> Produto 100% original
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="section-title mb-6">Você também pode gostar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
