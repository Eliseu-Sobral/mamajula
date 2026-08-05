import { useEffect, useState } from 'react';
import { Bell, Send, MessageCircle, Check, X, Clock, Smartphone } from 'lucide-react';
import { supabase, type Product, type NotificationJob } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

type Channel = 'push' | 'whatsapp' | 'both';

export default function AdminNotifications() {
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subCount, setSubCount] = useState(0);
  const [channel, setChannel] = useState<Channel>('push');
  const [form, setForm] = useState({ productId: '', title: '', body: '', imageUrl: '' });
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: j }, { data: p }, { count }] = await Promise.all([
      supabase.from('notification_jobs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('products').select('*').eq('status', 'active').order('name'),
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }),
    ]);
    setJobs(j ?? []);
    setProducts(p ?? []);
    setSubCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sendWhatsApp = async (title: string, message: string, imageUrl: string, productId: string) => {
    const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const productUrl = productId ? `${window.location.origin}/produto/${productId}` : '';
    const res = await fetch(`${supaUrl}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ title, message, imageUrl, productUrl, productId }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  };

  const recordPushJob = async (title: string, body: string, imageUrl: string | null, productId: string | null) => {
    const { error } = await supabase.from('notification_jobs').insert({
      channel: 'push',
      product_id: productId || null,
      title,
      body,
      image_url: imageUrl,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.body) return;
    setSending(true);
    setResult(null);

    const selectedProduct = products.find((p) => p.id === form.productId);
    const imageUrl = form.imageUrl || selectedProduct?.images[0] || '';
    const errors: string[] = [];

    if (channel === 'push' || channel === 'both') {
      try {
        await recordPushJob(form.title, form.body, imageUrl || null, form.productId);
      } catch (err) {
        errors.push(`Push: ${(err as Error).message}`);
      }
    }

    if (channel === 'whatsapp' || channel === 'both') {
      try {
        await sendWhatsApp(form.title, form.body, imageUrl, form.productId);
      } catch (err) {
        errors.push(`WhatsApp: ${(err as Error).message}`);
      }
    }

    if (errors.length > 0) {
      setResult({ type: 'error', msg: 'Falha em: ' + errors.join(' | ') });
    } else {
      const channels = channel === 'both' ? 'Push e WhatsApp' : channel === 'push' ? `${subCount} inscritos Push` : 'grupo do WhatsApp';
      setResult({ type: 'success', msg: `Notificação enviada com sucesso via ${channels}!` });
      setForm({ productId: '', title: '', body: '', imageUrl: '' });
    }
    setSending(false);
    load();
  };

  const stats = {
    total: jobs.length,
    sent: jobs.filter((j) => j.status === 'sent').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  };

  const channelOptions: { id: Channel; label: string; icon: typeof Bell }[] = [
    { id: 'push', label: 'Push', icon: Bell },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'both', label: 'Ambos', icon: Send },
  ];

  return (
    <div className="page-enter space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Inscritos Push', value: subCount, icon: Smartphone, color: 'primary' },
          { label: 'Total Enviadas', value: stats.total, icon: Bell, color: 'gold' },
          { label: 'Entregues', value: stats.sent, icon: Check, color: 'success' },
          { label: 'Falhas', value: stats.failed, icon: X, color: 'rose' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl2 shadow-card p-5">
            <div className={`inline-flex p-2 rounded-lg bg-${s.color}-50 text-${s.color}-600 mb-2`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-display font-semibold text-neutral-800">{s.value}</p>
            <p className="text-sm text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Composer */}
        <div className="bg-white rounded-xl2 shadow-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-primary-500" /> Nova Notificação
          </h2>

          {/* Channel selector */}
          <div className="mb-4">
            <label className="label">Canal de envio</label>
            <div className="grid grid-cols-3 gap-2">
              {channelOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setChannel(opt.id)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${channel === opt.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600 hover:border-primary-300'}`}
                >
                  <opt.icon className="w-4 h-4" /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {result && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${result.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.msg}
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label">Produto relacionado (opcional)</label>
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="input">
                <option value="">Sem produto específico</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Título *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Novidade: Perfume X chegou!" maxLength={50} />
            </div>
            <div>
              <label className="label">Mensagem *</label>
              <textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input min-h-24" rows={3} placeholder="Descreva a oferta ou novidade..." maxLength={150} />
            </div>
            <div>
              <label className="label">URL da imagem (opcional)</label>
              <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="input" placeholder="https://..." />
            </div>
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Enviando...' : <><Send className="w-4 h-4" /> Disparar Notificação</>}
            </button>
          </form>

          <div className="mt-6 p-4 bg-cream-50 rounded-xl2">
            <p className="text-xs text-neutral-500 leading-relaxed">
              {channel === 'push' && `A notificação será enviada para ${subCount} inscritos via Web Push.`}
              {channel === 'whatsapp' && 'A mensagem será enviada para o grupo de WhatsApp configurado na Evolution API.'}
              {channel === 'both' && `A notificação será enviada para ${subCount} inscritos Push e para o grupo de WhatsApp.`}
            </p>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-xl2 shadow-card p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Histórico de Envios</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-cream-100 rounded-xl animate-pulse" />)}
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-neutral-400 text-sm py-8 text-center">Nenhuma notificação enviada ainda.</p>
          ) : (
            <ul className="space-y-3 max-h-[500px] overflow-y-auto">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-start gap-3 p-3 rounded-xl bg-cream-50">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${j.channel === 'push' ? 'bg-primary-100 text-primary-600' : 'bg-green-100 text-green-600'}`}>
                    {j.channel === 'push' ? <Bell className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800">{j.title}</p>
                    <p className="text-xs text-neutral-500 line-clamp-2">{j.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(j.created_at)}
                      </span>
                      <span className={`badge text-xs ${j.status === 'sent' ? 'bg-green-100 text-green-700' : j.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>
                        {j.status}
                      </span>
                    </div>
                  </div>
                  {j.image_url && <img src={j.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
