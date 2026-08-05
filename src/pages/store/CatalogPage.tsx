import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { SlidersHorizontal, Search } from 'lucide-react';
import { supabase, type Product, type Category } from '@/lib/supabase';
import ProductCard from '@/components/store/ProductCard';

export default function CatalogPage() {
  const { category } = useParams<{ category?: string }>();
  const isPromo = category === 'promocoes';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'price-asc' | 'price-desc'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('products').select('*').eq('status', 'active'),
        supabase.from('categories').select('*').order('sort_order'),
      ]);
      setProducts(prods ?? []);
      setCategories(cats ?? []);
      setLoading(false);
    })();
  }, []);

  const activeCategory = categories.find((c) => c.slug === category);

  const filtered = useMemo(() => {
    let list = [...products];
    if (isPromo) {
      list = list.filter((p) => p.tags.includes('promocao') || (p.original_price && p.original_price > p.price));
    } else if (category && !isPromo) {
      list = list.filter((p) => p.category_id === activeCategory?.id);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
      );
    }
    switch (sort) {
      case 'price-asc': list.sort((a, b) => a.price - b.price); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      default: list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [products, category, activeCategory, isPromo, search, sort]);

  const title = isPromo ? 'Promoções' : activeCategory?.name ?? 'Todos os Produtos';

  return (
    <div className="page-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="section-title">{title}</h1>
        <p className="text-neutral-500 mt-1">{filtered.length} produtos encontrados</p>
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input sm:w-48">
          <option value="recent">Mais recentes</option>
          <option value="price-asc">Menor preço</option>
          <option value="price-desc">Maior preço</option>
        </select>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn-ghost border border-neutral-200 sm:hidden"
        >
          <SlidersHorizontal className="w-4 h-4" /> Filtros
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className={`w-48 flex-shrink-0 ${showFilters ? 'block' : 'hidden'} md:block`}>
          <h3 className="font-semibold text-sm text-neutral-700 mb-3 uppercase tracking-wide">Categorias</h3>
          <ul className="space-y-1.5">
            <li>
              <a href="/catalogo" className={`block px-3 py-2 rounded-lg text-sm ${!category ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-600 hover:bg-cream-100'}`}>
                Todos
              </a>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <a
                  href={`/catalogo/${c.slug}`}
                  className={`block px-3 py-2 rounded-lg text-sm ${category === c.slug ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-600 hover:bg-cream-100'}`}
                >
                  {c.name}
                </a>
              </li>
            ))}
            <li>
              <a
                href="/catalogo/promocoes"
                className={`block px-3 py-2 rounded-lg text-sm ${isPromo ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-600 hover:bg-cream-100'}`}
              >
                Promoções
              </a>
            </li>
          </ul>
        </aside>

        {/* Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square bg-cream-100 rounded-xl3 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-500 text-lg">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
