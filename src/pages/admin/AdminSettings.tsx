import { useEffect, useState, useCallback } from 'react';
import { ShoppingBag, TrendingUp, Save, Store, Bell, MessageCircle, Check, Send, TestTube, QrCode, RefreshCw, Trash2, Wifi, WifiOff, Loader2, ShoppingCart, ExternalLink, Unlink, Tag } from 'lucide-react';
import { supabase, type Order } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';

type WaStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WaConfig {
  evolution_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  group_jid: string;
  instance_status: WaStatus;
  qr_code: string | null;
}

const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-instance`;
const shopeeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopee-sync`;
const mlFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolivre-sync`;
const fnHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

export default function AdminSettings() {
  const [tab, setTab] = useState<'store' | 'orders' | 'integrations'>('store');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [storeName, setStoreName] = useState('Mamajula Perfumaria');
  const [saved, setSaved] = useState(false);

  // WhatsApp state
  const [waConfig, setWaConfig] = useState<WaConfig | null>(null);
  const [waForm, setWaForm] = useState({ evolution_url: '', evolution_api_key: '', evolution_instance: '', group_jid: '' });
  const [waLoading, setWaLoading] = useState(false);
  const [waCreating, setWaCreating] = useState(false);
  const [waQrLoading, setWaQrLoading] = useState(false);
  const [waDeleting, setWaDeleting] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [waMsg, setWaMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [qrPolling, setQrPolling] = useState(false);

  // Shopee state
  type ShopeeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
  interface ShopeeConfig {
    partner_id: string;
    partner_key: string;
    shop_id: string;
    status: ShopeeStatus;
    expire_at: string | null;
  }
  const [shopeeConfig, setShopeeConfig] = useState<ShopeeConfig | null>(null);
  const [shopeeForm, setShopeeForm] = useState({ partner_id: '', partner_key: '', shop_id: '' });
  const [shopeeLoading, setShopeeLoading] = useState(false);
  const [shopeeConnecting, setShopeeConnecting] = useState(false);
  const [shopeeMsg, setShopeeMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Mercado Livre state
  type MlStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
  interface MlConfig {
    app_id: string;
    client_secret: string;
    ml_user_id: string;
    status: MlStatus;
    expire_at: string | null;
  }
  const [mlConfig, setMlConfig] = useState<MlConfig | null>(null);
  const [mlForm, setMlForm] = useState({ app_id: '', client_secret: '' });
  const [mlLoading, setMlLoading] = useState(false);
  const [mlConnecting, setMlConnecting] = useState(false);
  const [mlMsg, setMlMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(20);
    setOrders(data ?? []);
    setLoadingOrders(false);
  }, []);

  const loadWaConfig = useCallback(async () => {
    setWaLoading(true);
    try {
      const res = await fetch(`${fnUrl}?action=load`, { headers: fnHeaders });
      const data = await res.json();
      if (data.config) {
        setWaConfig(data.config);
        setWaForm({
          evolution_url: data.config.evolution_url || '',
          evolution_api_key: '',
          evolution_instance: data.config.evolution_instance || '',
          group_jid: data.config.group_jid || '',
        });
      }
    } catch { /* ignore */ }
    setWaLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'orders') loadOrders();
    if (tab === 'integrations') { loadWaConfig(); loadShopeeConfig(); loadMlConfig(); }
  }, [tab, loadOrders, loadWaConfig]);

  // Poll for connection status when QR is shown
  useEffect(() => {
    if (!qrPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${fnUrl}?action=status`, { headers: fnHeaders });
        const data = await res.json();
        if (data.success && data.status === 'connected') {
          setWaConfig((prev) => prev ? { ...prev, instance_status: 'connected', qr_code: null } : prev);
          setQrPolling(false);
          setWaMsg({ type: 'success', msg: 'WhatsApp conectado com sucesso!' });
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [qrPolling]);

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // WhatsApp actions
  const handleSaveWa = async () => {
    setWaLoading(true);
    setWaMsg(null);
    try {
      const res = await fetch(`${fnUrl}?action=save`, {
        method: 'POST',
        headers: fnHeaders,
        body: JSON.stringify(waForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaMsg({ type: 'error', msg: data.error || 'Erro ao salvar' });
      } else {
        setWaMsg({ type: 'success', msg: 'Credenciais salvas com sucesso!' });
        loadWaConfig();
      }
    } catch (err) {
      setWaMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setWaLoading(false);
  };

  const handleCreateInstance = async () => {
    setWaCreating(true);
    setWaMsg(null);
    try {
      const res = await fetch(`${fnUrl}?action=create`, { method: 'POST', headers: fnHeaders });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaMsg({ type: 'error', msg: data.error || 'Erro ao criar instância' });
      } else {
        if (data.qr_code) {
          setWaConfig((prev) => prev ? { ...prev, qr_code: data.qr_code, instance_status: 'connecting' } : prev);
          setQrPolling(true);
          setWaMsg({ type: 'success', msg: 'Instância criada! Escaneie o QR code abaixo.' });
        } else {
          setWaMsg({ type: 'success', msg: 'Instância criada. Clique em "Exibir QR Code" para conectar.' });
        }
        loadWaConfig();
      }
    } catch (err) {
      setWaMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setWaCreating(false);
  };

  const handleFetchQr = async () => {
    setWaQrLoading(true);
    setWaMsg(null);
    try {
      const res = await fetch(`${fnUrl}?action=qr`, { headers: fnHeaders });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaMsg({ type: 'error', msg: data.error || 'Erro ao obter QR code' });
      } else if (data.qr_code) {
        setWaConfig((prev) => prev ? { ...prev, qr_code: data.qr_code, instance_status: 'connecting' } : prev);
        setQrPolling(true);
        setWaMsg({ type: 'success', msg: 'QR code gerado! Escaneie com seu celular.' });
      } else {
        setWaMsg({ type: 'error', msg: 'QR code não disponível. A instância pode já estar conectada.' });
      }
    } catch (err) {
      setWaMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setWaQrLoading(false);
  };

  const handleCheckStatus = async () => {
    setWaLoading(true);
    try {
      const res = await fetch(`${fnUrl}?action=status`, { headers: fnHeaders });
      const data = await res.json();
      if (data.success) {
        setWaConfig((prev) => prev ? { ...prev, instance_status: data.status } : prev);
        setWaMsg({ type: 'success', msg: `Status: ${data.status === 'connected' ? 'Conectado' : data.status === 'connecting' ? 'Conectando...' : 'Desconectado'}` });
      } else if (data.error) {
        setWaMsg({ type: 'error', msg: data.error });
      }
    } catch (err) {
      setWaMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setWaLoading(false);
  };

  const handleDeleteInstance = async () => {
    if (!confirm('Tem certeza que deseja remover a instância do WhatsApp?')) return;
    setWaDeleting(true);
    setWaMsg(null);
    try {
      const res = await fetch(`${fnUrl}?action=delete`, { method: 'DELETE', headers: fnHeaders });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaMsg({ type: 'error', msg: data.error || 'Erro ao remover' });
      } else {
        setWaConfig((prev) => prev ? { ...prev, instance_status: 'disconnected', qr_code: null } : prev);
        setQrPolling(false);
        setWaMsg({ type: 'success', msg: 'Instância removida.' });
      }
    } catch (err) {
      setWaMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setWaDeleting(false);
  };

  const handleTestWhatsApp = async () => {
    setWaTesting(true);
    setWaMsg(null);
    try {
      const sendUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`;
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: fnHeaders,
        body: JSON.stringify({
          title: 'Teste Mamajula',
          message: 'Esta é uma mensagem de teste do painel administrativo. Se você a recebeu, a integração com WhatsApp está funcionando!',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setWaMsg({ type: 'error', msg: data.error || `Erro ${res.status}` });
      } else {
        setWaMsg({ type: 'success', msg: 'Mensagem de teste enviada com sucesso para o grupo!' });
      }
    } catch (err) {
      setWaMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setWaTesting(false);
  };

  const loadMlConfig = useCallback(async () => {
    setMlLoading(true);
    try {
      const res = await fetch(`${mlFnUrl}?action=load`, { headers: fnHeaders });
      const data = await res.json();
      if (data.config) {
        setMlConfig(data.config);
        setMlForm({ app_id: data.config.app_id || '', client_secret: '' });
      }
    } catch { /* ignore */ }
    setMlLoading(false);
  }, []);

  const handleSaveMl = async () => {
    setMlLoading(true);
    setMlMsg(null);
    try {
      const res = await fetch(`${mlFnUrl}?action=save`, {
        method: 'POST', headers: fnHeaders,
        body: JSON.stringify(mlForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMlMsg({ type: 'error', msg: data.error || 'Erro ao salvar' });
      } else {
        setMlMsg({ type: 'success', msg: 'Credenciais do Mercado Livre salvas!' });
        loadMlConfig();
      }
    } catch (err) {
      setMlMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setMlLoading(false);
  };

  const handleConnectMl = async () => {
    setMlConnecting(true);
    setMlMsg(null);
    try {
      const res = await fetch(`${mlFnUrl}?action=auth_url`, { method: 'POST', headers: fnHeaders });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMlMsg({ type: 'error', msg: data.error || 'Erro ao gerar link' });
      } else if (data.auth_url) {
        window.open(data.auth_url, '_blank');
        setMlMsg({ type: 'success', msg: 'Link de autorização aberto! Após aprovar no Mercado Livre, clique em Verificar status.' });
      }
    } catch (err) {
      setMlMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setMlConnecting(false);
  };

  const handleCheckMlStatus = async () => {
    setMlLoading(true);
    try {
      const res = await fetch(`${mlFnUrl}?action=status`, { headers: fnHeaders });
      const data = await res.json();
      if (data.success) {
        setMlConfig((prev) => prev ? { ...prev, status: data.status } : prev);
        setMlMsg({ type: 'success', msg: data.status === 'connected' ? 'Mercado Livre conectado!' : 'Mercado Livre não conectado.' });
      }
    } catch (err) {
      setMlMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setMlLoading(false);
  };

  const handleDisconnectMl = async () => {
    if (!confirm('Desconectar a conta do Mercado Livre?')) return;
    setMlLoading(true);
    try {
      const res = await fetch(`${mlFnUrl}?action=disconnect`, { method: 'DELETE', headers: fnHeaders });
      const data = await res.json();
      if (data.success) {
        setMlConfig((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
        setMlMsg({ type: 'success', msg: 'Mercado Livre desconectado.' });
      }
    } catch (err) {
      setMlMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setMlLoading(false);
  };

  const mlStatusBadge = (status: MlStatus) => {
    const map: Record<MlStatus, { label: string; cls: string }> = {
      connected: { label: 'Conectado', cls: 'bg-green-100 text-green-700' },
      connecting: { label: 'Conectando...', cls: 'bg-gold-100 text-gold-700' },
      disconnected: { label: 'Desconectado', cls: 'bg-neutral-100 text-neutral-600' },
      error: { label: 'Erro', cls: 'bg-red-100 text-red-700' },
    };
    const s = map[status] ?? map.disconnected;
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const loadShopeeConfig = useCallback(async () => {
    setShopeeLoading(true);
    try {
      const res = await fetch(`${shopeeFnUrl}?action=load`, { headers: fnHeaders });
      const data = await res.json();
      if (data.config) {
        setShopeeConfig(data.config);
        setShopeeForm({
          partner_id: data.config.partner_id || '',
          partner_key: '',
          shop_id: data.config.shop_id || '',
        });
      }
    } catch { /* ignore */ }
    setShopeeLoading(false);
  }, []);

  const handleSaveShopee = async () => {
    setShopeeLoading(true);
    setShopeeMsg(null);
    try {
      const res = await fetch(`${shopeeFnUrl}?action=save`, {
        method: 'POST', headers: fnHeaders,
        body: JSON.stringify(shopeeForm),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setShopeeMsg({ type: 'error', msg: data.error || 'Erro ao salvar' });
      } else {
        setShopeeMsg({ type: 'success', msg: 'Credenciais Shopee salvas!' });
        loadShopeeConfig();
      }
    } catch (err) {
      setShopeeMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setShopeeLoading(false);
  };

  const handleConnectShopee = async () => {
    setShopeeConnecting(true);
    setShopeeMsg(null);
    try {
      const res = await fetch(`${shopeeFnUrl}?action=auth_url`, { method: 'POST', headers: fnHeaders });
      const data = await res.json();
      if (!res.ok || data.error) {
        setShopeeMsg({ type: 'error', msg: data.error || 'Erro ao gerar link' });
      } else if (data.auth_url) {
        window.open(data.auth_url, '_blank');
        setShopeeMsg({ type: 'success', msg: 'Link de autorização aberto! Após aprovar na Shopee, clique em Verificar status.' });
      }
    } catch (err) {
      setShopeeMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setShopeeConnecting(false);
  };

  const handleCheckShopeeStatus = async () => {
    setShopeeLoading(true);
    try {
      const res = await fetch(`${shopeeFnUrl}?action=status`, { headers: fnHeaders });
      const data = await res.json();
      if (data.success) {
        setShopeeConfig((prev) => prev ? { ...prev, status: data.status } : prev);
        setShopeeMsg({ type: 'success', msg: data.status === 'connected' ? 'Shopee conectado!' : 'Shopee não conectado.' });
      }
    } catch (err) {
      setShopeeMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setShopeeLoading(false);
  };

  const handleDisconnectShopee = async () => {
    if (!confirm('Desconectar a conta Shopee?')) return;
    setShopeeLoading(true);
    try {
      const res = await fetch(`${shopeeFnUrl}?action=disconnect`, { method: 'DELETE', headers: fnHeaders });
      const data = await res.json();
      if (data.success) {
        setShopeeConfig((prev) => prev ? { ...prev, status: 'disconnected' } : prev);
        setShopeeMsg({ type: 'success', msg: 'Shopee desconectado.' });
      }
    } catch (err) {
      setShopeeMsg({ type: 'error', msg: 'Erro: ' + (err as Error).message });
    }
    setShopeeLoading(false);
  };

  const shopeeStatusBadge = (status: ShopeeStatus) => {
    const map: Record<ShopeeStatus, { label: string; cls: string }> = {
      connected: { label: 'Conectado', cls: 'bg-green-100 text-green-700' },
      connecting: { label: 'Conectando...', cls: 'bg-gold-100 text-gold-700' },
      disconnected: { label: 'Desconectado', cls: 'bg-neutral-100 text-neutral-600' },
      error: { label: 'Erro', cls: 'bg-red-100 text-red-700' },
    };
    const s = map[status] ?? map.disconnected;
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const statusBadge = (status: WaStatus) => {
    const map: Record<WaStatus, { label: string; cls: string }> = {
      connected: { label: 'Conectado', cls: 'bg-green-100 text-green-700' },
      connecting: { label: 'Conectando...', cls: 'bg-gold-100 text-gold-700' },
      disconnected: { label: 'Desconectado', cls: 'bg-neutral-100 text-neutral-600' },
      error: { label: 'Erro', cls: 'bg-red-100 text-red-700' },
    };
    const s = map[status] ?? map.disconnected;
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="page-enter">
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-cream-200">
        {[
          { id: 'store', label: 'Dados da Loja', icon: Store },
          { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
          { id: 'integrations', label: 'Integrações', icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'store' && (
        <div className="bg-white rounded-xl2 shadow-card p-6 max-w-2xl space-y-4">
          <div>
            <label className="label">Nome da Loja</label>
            <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="input" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">E-mail de contato</label>
              <input className="input" placeholder="contato@mamajula.com" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input className="input" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="label">Instagram</label>
              <input className="input" placeholder="@mamajula" />
            </div>
            <div>
              <label className="label">Frete grátis a partir de</label>
              <input type="number" className="input" defaultValue="199" />
            </div>
          </div>
          <button onClick={handleSave} className="btn-primary">
            {saved ? <><Check className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white rounded-xl2 shadow-card overflow-hidden">
          {loadingOrders ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-cream-100 rounded-xl animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">Nenhum pedido ainda.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-cream-50 border-b border-cream-200">
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 hidden md:table-cell">Itens</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Data</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-cream-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-800">{o.customer_name}</p>
                      <p className="text-xs text-neutral-400">{o.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-neutral-600">
                      {(o.items as unknown as Array<{ qty: number }>[]).length} itens
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-800">{formatBRL(o.total)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-neutral-500">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value as Order['status'])}
                        className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${o.status === 'pending' ? 'bg-gold-100 text-gold-700' : o.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : o.status === 'shipped' ? 'bg-purple-100 text-purple-700' : o.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        <option value="pending">Pendente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="shipped">Enviado</option>
                        <option value="delivered">Entregado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="space-y-6 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Mercado Livre */}
            <div className="bg-white rounded-xl2 shadow-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-yellow-50 text-yellow-600">
                    <Tag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold">Mercado Livre</h3>
                    <p className="text-sm text-neutral-500">Sincronize produtos como anúncios</p>
                  </div>
                </div>
                {mlConfig && (
                  <div className="flex items-center gap-2">
                    {mlConfig.status === 'connected' ? (
                      <Wifi className="w-5 h-5 text-green-500" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-neutral-400" />
                    )}
                    {mlStatusBadge(mlConfig.status)}
                  </div>
                )}
              </div>

              {/* Step 1: Credentials */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">1</span>
                  Configurar credenciais do aplicativo
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pl-8">
                  <div>
                    <label className="label">App ID</label>
                    <input className="input" placeholder="1234567890" value={mlForm.app_id} onChange={(e) => setMlForm({ ...mlForm, app_id: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Client Secret</label>
                    <input type="password" className="input" placeholder={mlConfig?.client_secret === '••••••' ? '•••••• (já configurada)' : 'Digite o Client Secret'} value={mlForm.client_secret} onChange={(e) => setMlForm({ ...mlForm, client_secret: e.target.value })} />
                  </div>
                </div>
                <div className="pl-8">
                  <button onClick={handleSaveMl} disabled={mlLoading} className="btn-primary">
                    {mlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salvar credenciais</>}
                  </button>
                </div>
              </div>

              {/* Step 2: Authorize */}
              <div className="space-y-4 mt-6 pt-6 border-t border-cream-100">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">2</span>
                  Autorizar conta Mercado Livre
                </div>
                <div className="pl-8 flex flex-wrap gap-3">
                  <button onClick={handleConnectMl} disabled={mlConnecting} className="btn-primary">
                    {mlConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ExternalLink className="w-4 h-4" /> Autorizar conta</>}
                  </button>
                  <button onClick={handleCheckMlStatus} disabled={mlLoading} className="btn-ghost border border-neutral-200">
                    <RefreshCw className="w-4 h-4" /> Verificar status
                  </button>
                  {mlConfig?.status === 'connected' && (
                    <button onClick={handleDisconnectMl} disabled={mlLoading} className="btn-ghost border border-red-200 text-red-600 hover:bg-red-50">
                      <Unlink className="w-4 h-4" /> Desconectar
                    </button>
                  )}
                </div>
                {mlConfig?.status === 'connected' && (
                  <div className="pl-8 mt-4">
                    <div className="p-4 bg-green-50 rounded-xl2 flex items-center gap-3">
                      <Wifi className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Mercado Livre conectado!</p>
                        <p className="text-xs text-green-600">Você pode publicar produtos no Mercado Livre pela lista de produtos.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {mlMsg && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${mlMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {mlMsg.msg}
                </div>
              )}

              <div className="mt-6 p-4 bg-cream-50 rounded-xl2">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  O Mercado Livre permite publicar e sincronizar anúncios diretamente na sua conta.
                  Você precisa criar um aplicativo no portal de desenvolvedores do Mercado Livre
                  (developers.mercadolivre.com.br). Após salvar as credenciais, clique em "Autorizar conta"
                  e aprove o acesso na página do Mercado Livre. Depois, use o botão "Publicar no ML"
                  na lista de produtos para enviar cada produto.
                </p>
              </div>
            </div>

            {/* Push Notifications */}
            <div className="bg-white rounded-xl2 shadow-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold">Push Notifications</h3>
                  <p className="text-sm text-neutral-500">Web Push (VAPID)</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">VAPID Public Key</label>
                  <input className="input" placeholder="BEl62..." />
                </div>
                <div>
                  <label className="label">VAPID Private Key</label>
                  <input type="password" className="input" placeholder="••••••••" />
                </div>
                <button onClick={handleSave} className="btn-primary w-full">
                  {saved ? <><Check className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar</>}
                </button>
              </div>
            </div>
          </div>

          {/* WhatsApp / Evolution API — Full Instance Management */}
          <div className="bg-white rounded-xl2 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold">WhatsApp — Evolution API</h3>
                  <p className="text-sm text-neutral-500">Crie e gerencie a instância diretamente pelo painel</p>
                </div>
              </div>
              {waConfig && (
                <div className="flex items-center gap-2">
                  {waConfig.instance_status === 'connected' ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-neutral-400" />
                  )}
                  {statusBadge(waConfig.instance_status)}
                </div>
              )}
            </div>

            {/* Step 1: Credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">1</span>
                Configurar credenciais da Evolution API
              </div>
              <div className="grid sm:grid-cols-2 gap-4 pl-8">
                <div className="sm:col-span-2">
                  <label className="label">URL da Evolution API</label>
                  <input
                    className="input"
                    placeholder="https://evolution.seudominio.com"
                    value={waForm.evolution_url}
                    onChange={(e) => setWaForm({ ...waForm, evolution_url: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">API Key</label>
                  <input
                    type="password"
                    className="input"
                    placeholder={waConfig?.evolution_api_key === '••••••' ? '•••••• (já configurada)' : 'Digite a API key'}
                    value={waForm.evolution_api_key}
                    onChange={(e) => setWaForm({ ...waForm, evolution_api_key: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Nome da Instância</label>
                  <input
                    className="input"
                    placeholder="mamajula"
                    value={waForm.evolution_instance}
                    onChange={(e) => setWaForm({ ...waForm, evolution_instance: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Group JID (ID do grupo de WhatsApp)</label>
                  <input
                    className="input"
                    placeholder="120363xxx@g.us"
                    value={waForm.group_jid}
                    onChange={(e) => setWaForm({ ...waForm, group_jid: e.target.value })}
                  />
                </div>
              </div>
              <div className="pl-8">
                <button onClick={handleSaveWa} disabled={waLoading} className="btn-primary">
                  {waLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salvar credenciais</>}
                </button>
              </div>
            </div>

            {/* Step 2: Create / Connect Instance */}
            <div className="space-y-4 mt-6 pt-6 border-t border-cream-100">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">2</span>
                Criar instância e conectar WhatsApp
              </div>

              <div className="pl-8 flex flex-wrap gap-3">
                <button onClick={handleCreateInstance} disabled={waCreating} className="btn-primary">
                  {waCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wifi className="w-4 h-4" /> Criar instância</>}
                </button>
                <button onClick={handleFetchQr} disabled={waQrLoading} className="btn-secondary">
                  {waQrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><QrCode className="w-4 h-4" /> Exibir QR Code</>}
                </button>
                <button onClick={handleCheckStatus} disabled={waLoading} className="btn-ghost border border-neutral-200">
                  <RefreshCw className="w-4 h-4" /> Verificar status
                </button>
                <button onClick={handleDeleteInstance} disabled={waDeleting} className="btn-ghost border border-red-200 text-red-600 hover:bg-red-50">
                  {waDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Remover instância</>}
                </button>
              </div>

              {/* QR Code Display */}
              {waConfig?.qr_code && waConfig.instance_status !== 'connected' && (
                <div className="pl-8 mt-4">
                  <div className="inline-block p-6 bg-white border-2 border-green-200 rounded-2xl shadow-lg">
                    <div className="text-center mb-3">
                      <p className="text-sm font-medium text-neutral-700">Escaneie o QR code com seu WhatsApp</p>
                      <p className="text-xs text-neutral-500 mt-1">{'Abra o WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho'}</p>
                    </div>
                    <img
                      src={waConfig.qr_code.startsWith('data:') ? waConfig.qr_code : `data:image/png;base64,${waConfig.qr_code}`}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64 mx-auto rounded-lg"
                    />
                    {qrPolling && (
                      <p className="text-center text-xs text-green-600 mt-3 flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Aguardando conexão...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Connected state */}
              {waConfig?.instance_status === 'connected' && (
                <div className="pl-8 mt-4">
                  <div className="p-4 bg-green-50 rounded-xl2 flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">WhatsApp conectado!</p>
                      <p className="text-xs text-green-600">As mensagens serão enviadas automaticamente ao grupo ao cadastrar produtos.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Test */}
            <div className="space-y-4 mt-6 pt-6 border-t border-cream-100">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">3</span>
                Testar envio
              </div>
              <div className="pl-8">
                <button onClick={handleTestWhatsApp} disabled={waTesting} className="btn-secondary">
                  {waTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><TestTube className="w-4 h-4" /> Enviar mensagem de teste</>}
                </button>
              </div>
            </div>

            {/* Messages */}
            {waMsg && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${waMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {waMsg.msg}
              </div>
            )}

            <div className="mt-6 p-4 bg-cream-50 rounded-xl2">
              <p className="text-xs text-neutral-500 leading-relaxed">
                A Evolution API é um servidor self-hosted para WhatsApp. Você precisa ter uma instância da Evolution API
                rodando (em sua VPS ou servidor). Preencha a URL, API key e nome da instância acima, clique em
                "Criar instância" e escaneie o QR code que aparecerá para conectar seu número de WhatsApp.
                Depois, informe o Group JID do grupo que receberá as mensagens automáticas.
              </p>
            </div>
          </div>

          {/* Shopee Open Platform */}
          <div className="bg-white rounded-xl2 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold">Shopee — Open Platform</h3>
                  <p className="text-sm text-neutral-500">Sincronize produtos com sua loja Shopee</p>
                </div>
              </div>
              {shopeeConfig && (
                <div className="flex items-center gap-2">
                  {shopeeConfig.status === 'connected' ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-neutral-400" />
                  )}
                  {shopeeStatusBadge(shopeeConfig.status)}
                </div>
              )}
            </div>

            {/* Step 1: Credentials */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">1</span>
                Configurar credenciais do Partner Shopee
              </div>
              <div className="grid sm:grid-cols-2 gap-4 pl-8">
                <div>
                  <label className="label">Partner ID</label>
                  <input className="input" placeholder="123456" value={shopeeForm.partner_id} onChange={(e) => setShopeeForm({ ...shopeeForm, partner_id: e.target.value })} />
                </div>
                <div>
                  <label className="label">Partner Key</label>
                  <input type="password" className="input" placeholder={shopeeConfig?.partner_key === '••••••' ? '•••••• (já configurada)' : 'Digite a Partner Key'} value={shopeeForm.partner_key} onChange={(e) => setShopeeForm({ ...shopeeForm, partner_key: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Shop ID (opcional — preenchido após autorização)</label>
                  <input className="input" placeholder="Definido automaticamente após autorização" value={shopeeForm.shop_id} onChange={(e) => setShopeeForm({ ...shopeeForm, shop_id: e.target.value })} />
                </div>
              </div>
              <div className="pl-8">
                <button onClick={handleSaveShopee} disabled={shopeeLoading} className="btn-primary">
                  {shopeeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salvar credenciais</>}
                </button>
              </div>
            </div>

            {/* Step 2: Authorize */}
            <div className="space-y-4 mt-6 pt-6 border-t border-cream-100">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">2</span>
                Autorizar conta Shopee
              </div>
              <div className="pl-8 flex flex-wrap gap-3">
                <button onClick={handleConnectShopee} disabled={shopeeConnecting} className="btn-primary">
                  {shopeeConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ExternalLink className="w-4 h-4" /> Autorizar conta</>}
                </button>
                <button onClick={handleCheckShopeeStatus} disabled={shopeeLoading} className="btn-ghost border border-neutral-200">
                  <RefreshCw className="w-4 h-4" /> Verificar status
                </button>
                {shopeeConfig?.status === 'connected' && (
                  <button onClick={handleDisconnectShopee} disabled={shopeeLoading} className="btn-ghost border border-red-200 text-red-600 hover:bg-red-50">
                    <Unlink className="w-4 h-4" /> Desconectar
                  </button>
                )}
              </div>
              {shopeeConfig?.status === 'connected' && (
                <div className="pl-8 mt-4">
                  <div className="p-4 bg-green-50 rounded-xl2 flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Shopee conectado!</p>
                      <p className="text-xs text-green-600">Você pode publicar produtos na Shopee pela lista de produtos.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {shopeeMsg && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${shopeeMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {shopeeMsg.msg}
              </div>
            )}

            <div className="mt-6 p-4 bg-cream-50 rounded-xl2">
              <p className="text-xs text-neutral-500 leading-relaxed">
                A Shopee Open Platform permite publicar e sincronizar produtos diretamente na sua loja Shopee.
                Você precisa de uma conta de Partner na Shopee Open Platform. Após salvar as credenciais,
                clique em "Autorizar conta" e aprove o acesso na página da Shopee. Depois, use o botão
                "Publicar na Shopee" na lista de produtos para enviar cada produto.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
