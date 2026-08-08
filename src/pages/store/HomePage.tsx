import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Truck, ShieldCheck, Tag, ArrowRight, Check, X, Loader2, BellOff } from 'lucide-react';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { isPushSupported, isSubscribed, subscribeUser, unsubscribeUser, loadPushConfig } from '@/lib/push';
import ProductCard from '@/components/store/ProductCard';

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'subscribed' | 'not-supported' | 'error'>('idle');
  const [pushMsg, setPushMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [{ data: feat }, { data: cats }] = await Promise.all([
        supabase.from('products').select('*').eq('featured', true).eq('status', 'active').limit(8),
        supabase.from('categories').select('*').order('sort_order'),
      ]);
      setFeatured(feat ?? []);
      setCategories(cats ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!isPushSupported()) {
        setPushState('not-supported');
        return;
      }
      try {
        await loadPushConfig();
        const subscribed = await isSubscribed();
        setPushState(subscribed ? 'subscribed' : 'idle');
      } catch (err) {
        setPushState('error');
        setPushMsg('Erro ao verificar inscrição');
      }
    })();
  }, []);

  const handleTogglePush = async () => {
    if (pushState === 'loading' || pushState === 'not-supported') return;
    setPushState('loading');
    setPushMsg('');
    try {
      if (pushState === 'subscribed') {
        await unsubscribeUser();
        setPushState('idle');
        setPushMsg('Notificações desativadas');
      } else {
        await subscribeUser();
        setPushState('subscribed');
        setPushMsg('Notificações ativadas com sucesso!');
      }
    } catch (err) {
      setPushState('error');
      setPushMsg(err instanceof Error ? err.message : 'Erro ao alterar notificações');
    }
  };

  return (
    <div className="page-enter">
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" /> Até 70% OFF em perfumes importados
              </div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-neutral-800 leading-tight">
                Sua fragrância favorita<br />
                <span className="text-primary-600 italic">com o melhor preço</span>
              </h1>
              <p className="mt-6 text-lg text-neutral-600 max-w-md">
                Perfumes nacionais, importados e árabes originais. Enviamos para todo Brasil
                com segurança e garantia.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/catalogo" className="btn-primary">
                  Ver Catálogo <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/catalogo/promocoes" className="btn-secondary">
                  <Tag className="w-4 h-4" /> Promoções
                </Link>
              </div>
            </div>
            <div className="relative hidden md:block">
              <div className="grid grid-cols-2 gap-4">
                {featured.slice(0, 4).map((p, i) => (
                  <div
                    key={p.id}
                    className={`rounded-xl3 overflow-hidden shadow-card ${i % 2 === 1 ? 'mt-8' : ''}`}
                  >
                    <img src={p.images[0]} alt={p.name} className="w-full h-48 object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Truck, title: 'Envio para todo Brasil', desc: 'Frete rápido e rastreado' },
            { icon: ShieldCheck, title: '100% Originais', desc: 'Garantia de qualidade' },
            { icon: Tag, title: 'Melhores Preços', desc: 'Até 70% abaixo do varejo' },
          ].map((b) => (
            <div key={b.title} className="flex items-center gap-4 p-5 bg-white rounded-xl2 shadow-card">
              <div className="p-3 rounded-xl bg-primary-50 text-primary-600">
                <b.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-neutral-800">{b.title}</p>
                <p className="text-sm text-neutral-500">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="section-title text-center mb-2">Categorias</h2>
        <div className="divider-ornament mb-10 max-w-xs mx-auto">✦</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/catalogo/${cat.slug}`}
              className="group relative aspect-[3/4] rounded-xl2 overflow-hidden shadow-card"
            >
              <img
                src={cat.image_url ?? ''}
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 text-white font-display text-lg font-semibold text-center">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="section-title">Destaques da Semana</h2>
            <p className="text-neutral-500 mt-1">Selecionados especialmente para você</p>
          </div>
          <Link to="/catalogo" className="btn-ghost hidden sm:inline-flex">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-cream-100 rounded-xl3 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* CTA banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="relative overflow-hidden rounded-xl3 bg-primary-700 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-800 to-primary-500 opacity-90" />
          <div className="relative px-8 py-12 md:py-16 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
              Receba ofertas exclusivas
            </h2>
            <p className="text-primary-100 max-w-lg mx-auto mb-6">
              Ative as notificações e seja avisado primeiro quando novos produtos e promoções chegarem.
            </p>
            <button
              onClick={handleTogglePush}
              disabled={pushState === 'loading' || pushState === 'not-supported'}
              className={`btn-primary inline-flex items-center gap-2 ${
                pushState === 'subscribed'
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : pushState === 'not-supported'
                  ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  : pushState === 'error'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-white text-primary-700 hover:bg-cream-100'
              }`}
            >
              {pushState === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pushState === 'subscribed' ? (
                <Check className="w-4 h-4" />
              ) : pushState === 'not-supported' ? (
                <BellOff className="w-4 h-4" />
              ) : pushState === 'error' ? (
                <X className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {pushState === 'subscribed'
                ? 'Inscrição ativada'
                : pushState === 'not-supported'
                ? 'Notificações não suportadas'
                : pushState === 'error'
                ? pushMsg || 'Erro'
                : 'Ativar Notificações'}
            </button>
            {pushMsg && pushState !== 'error' && pushState !== 'loading' && (
              <p className="mt-3 text-sm text-primary-100">{pushMsg}</p>
            )}
            {pushState === 'error' && pushMsg && (
              <p className="mt-3 text-sm text-red-200">{pushMsg}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
