import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Truck, ShieldCheck, Tag, ArrowRight, Check, X, Loader2, BellOff, Bell } from 'lucide-react';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { isPushSupported, isSubscribed, subscribeUser, unsubscribeUser, loadPushConfig } from '@/lib/push';
import ProductCard from '@/components/store/ProductCard';

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState<'idle' | 'loading' | 'subscribed' | 'not-supported' | 'error'>('idle');
  const [pushMsg, setPushMsg] = useState<string>('');
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const wasDismissed = localStorage.getItem('mamajula_push_dismissed') === '1';
      setDismissed(wasDismissed);
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismissPushBanner = () => {
    try {
      localStorage.setItem('mamajula_push_dismissed', '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

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
      {/* ===== Banner FIXO de Push (sticky top, sempre visível até o usuário ativar ou fechar) ===== */}
      {pushState !== 'subscribed' && pushState !== 'not-supported' && !dismissed && (
        <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 text-white shadow-xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-sm sm:text-base leading-tight">
                🔔 Receba ofertas exclusivas em primeira mão
              </p>
              <p className="text-primary-100 text-xs sm:text-sm truncate max-w-2xl">
                Ative as notificações e ganhe desconto de 10% na primeira compra!
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleTogglePush}
                disabled={pushState === 'loading'}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-sm transition-all duration-300 shadow-md ${
                  pushState === 'loading'
                    ? 'bg-neutral-400 text-white cursor-wait'
                    : pushState === 'error'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white text-primary-700 hover:bg-cream-100 hover:scale-105'
                }`}
              >
                {pushState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : pushState === 'error' ? (
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                {pushState === 'error'
                  ? (pushMsg || 'Erro').slice(0, 18)
                  : pushState === 'loading'
                  ? 'Ativando...'
                  : 'Ativar agora'}
              </button>
              <button
                onClick={dismissPushBanner}
                type="button"
                aria-label="Fechar aviso de notificações"
                className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
          {pushState === 'error' && pushMsg && (
            <div className="border-t border-white/15 bg-red-500/20 px-4 sm:px-8 py-2">
              <p className="text-sm text-red-100 font-medium">{pushMsg}</p>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
