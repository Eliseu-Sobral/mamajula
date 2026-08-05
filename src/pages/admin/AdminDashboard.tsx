import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Bell, TrendingUp, DollarSign, ShoppingCart, ArrowRight, Clock } from 'lucide-react';
import { supabase, type Product, type Order, type NotificationJob } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, notifications: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentJobs, setRecentJobs] = useState<NotificationJob[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ count: prodCount }, { data: orders, count: orderCount }, { data: jobs }, { data: products }] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('notification_jobs').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('products').select('*').lt('stock', 10).order('stock', { ascending: true }),
      ]);

      const revenue = (orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0);
      setStats({
        products: prodCount ?? 0,
        orders: orderCount ?? 0,
        revenue,
        notifications: (jobs ?? []).filter((j) => j.status === 'sent').length,
      });
      setRecentOrders(orders ?? []);
      setRecentJobs(jobs ?? []);
      setLowStock(products ?? []);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: 'Produtos Ativos', value: stats.products, icon: Package, color: 'primary' },
    { label: 'Pedidos', value: stats.orders, icon: ShoppingCart, color: 'gold' },
    { label: 'Receita (recente)', value: formatBRL(stats.revenue), icon: DollarSign, color: 'success' },
    { label: 'Notificações Enviadas', value: stats.notifications, icon: Bell, color: 'rose' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-xl2 shadow-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 page-enter">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl2 shadow-card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl bg-${c.color}-50 text-${c.color}-600`}>
                <c.icon className="w-6 h-6" />
              </div>
              <TrendingUp className="w-5 h-5 text-neutral-300" />
            </div>
            <p className="text-2xl font-display font-semibold text-neutral-800">{c.value}</p>
            <p className="text-sm text-neutral-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Recent orders + low stock */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl2 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Pedidos Recentes</h2>
            <Link to="/admin/products" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">Nenhum pedido ainda.</p>
          ) : (
            <ul className="space-y-3">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{o.customer_name}</p>
                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-800">{formatBRL(o.total)}</p>
                    <span className={`badge text-xs ${o.status === 'pending' ? 'bg-gold-100 text-gold-700' : 'bg-green-100 text-green-700'}`}>
                      {o.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl2 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Estoque Baixo</h2>
            <Link to="/admin/products" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Gerenciar <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">Todos os produtos têm estoque adequado.</p>
          ) : (
            <ul className="space-y-3">
              {lowStock.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 border-b border-cream-100 last:border-0">
                  <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{p.name}</p>
                  </div>
                  <span className={`badge text-xs ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>
                    {p.stock} un.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent notifications */}
      <div className="bg-white rounded-xl2 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Atividade de Notificações</h2>
          <Link to="/admin/notifications" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <p className="text-neutral-400 text-sm py-8 text-center">Nenhuma notificação enviada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {recentJobs.map((j) => (
              <li key={j.id} className="flex items-center gap-3 py-2 border-b border-cream-100 last:border-0">
                <div className={`p-2 rounded-lg ${j.channel === 'push' ? 'bg-primary-50 text-primary-600' : 'bg-green-50 text-green-600'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{j.title}</p>
                  <p className="text-xs text-neutral-400">{formatDate(j.created_at)}</p>
                </div>
                <span className={`badge text-xs ${j.status === 'sent' ? 'bg-green-100 text-green-700' : j.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>
                  {j.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
