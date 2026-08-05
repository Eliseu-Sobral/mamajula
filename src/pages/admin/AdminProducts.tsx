import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search, Package, MessageCircle, ShoppingCart, Tag as TagIcon, Loader2 } from 'lucide-react';
import { supabase, type Product, type Category } from '@/lib/supabase';
import { formatBRL } from '@/lib/format';

type EditState = {
  id?: string;
  name: string;
  description: string;
  category_id: string;
  price: string;
  original_price: string;
  stock: string;
  images: string;
  tags: string;
  status: 'draft' | 'active' | 'inactive';
  featured: boolean;
  brand: string;
  weight_kg: string;
  variations: string;
};

const empty: EditState = {
  name: '', description: '', category_id: '', price: '', original_price: '',
  stock: '', images: '', tags: '', status: 'active', featured: false,
  brand: '', weight_kg: '', variations: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoWhatsApp, setAutoWhatsApp] = useState(true);
  const [autoShopee, setAutoShopee] = useState(false);
  const [autoMl, setAutoMl] = useState(false);
  const [waStatus, setWaStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [shopeeSyncing, setShopeeSyncing] = useState<string | null>(null);
  const [mlSyncing, setMlSyncing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const payload = {
      name: editing.name,
      description: editing.description,
      category_id: editing.category_id || null,
      price: parseFloat(editing.price) || 0,
      original_price: editing.original_price ? parseFloat(editing.original_price) : null,
      stock: parseInt(editing.stock) || 0,
      images: editing.images.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: editing.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      status: editing.status,
      featured: editing.featured,
      brand: editing.brand || null,
      weight_kg: editing.weight_kg ? parseFloat(editing.weight_kg) : null,
      variations: editing.variations ? JSON.parse(editing.variations) : null,
    };

    let newProductId: string | null = null;

    if (editing.id) {
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      const { data: inserted } = await supabase.from('products').insert(payload).select('id').single();
      newProductId = inserted?.id ?? null;

      // Auto-dispatch WhatsApp message for new products
      if (newProductId && autoWhatsApp && editing.status === 'active') {
        try {
          const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
          const images = payload.images as string[];
          await fetch(`${supaUrl}/functions/v1/whatsapp-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({
              title: `Novo produto: ${editing.name}`,
              message: editing.description || editing.name,
              imageUrl: images[0] || '',
              productUrl: `${window.location.origin}/produto/${newProductId}`,
              productId: newProductId,
            }),
          });
          setWaStatus({ type: 'success', msg: 'Produto enviado ao grupo do WhatsApp!' });
        } catch {
          setWaStatus({ type: 'error', msg: 'Falha ao enviar para WhatsApp. Verifique as credenciais da Evolution API.' });
        }
        setTimeout(() => setWaStatus(null), 5000);
      }

      // Auto-sync to Shopee for new products
      if (newProductId && autoShopee) {
        try {
          const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
          await fetch(`${supaUrl}/functions/v1/shopee-sync?action=push_product`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({ product_id: newProductId }),
          });
        } catch { /* ignore sync errors */ }
      }

      // Auto-sync to Mercado Livre for new products
      if (newProductId && autoMl) {
        try {
          const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
          await fetch(`${supaUrl}/functions/v1/mercadolivre-sync?action=push_product`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({ product_id: newProductId }),
          });
        } catch { /* ignore sync errors */ }
      }
    }
    setSaving(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    await supabase.from('products').delete().eq('id', id);
    load();
  };

  const handleSyncShopee = async (productId: string) => {
    setShopeeSyncing(productId);
    try {
      const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supaUrl}/functions/v1/shopee-sync?action=push_product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert('Erro ao publicar na Shopee: ' + (data.error || 'desconhecido'));
      } else {
        alert('Produto publicado na Shopee com sucesso!');
      }
      load();
    } catch (err) {
      alert('Erro: ' + (err as Error).message);
    }
    setShopeeSyncing(null);
  };

  const handleSyncMl = async (productId: string) => {
    setMlSyncing(productId);
    try {
      const supaUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supaUrl}/functions/v1/mercadolivre-sync?action=push_product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert('Erro ao publicar no Mercado Livre: ' + (data.error || 'desconhecido'));
      } else {
        alert('Produto publicado no Mercado Livre com sucesso!');
      }
      load();
    } catch (err) {
      alert('Erro: ' + (err as Error).message);
    }
    setMlSyncing(null);
  };

  const startEdit = (p: Product) => {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      category_id: p.category_id ?? '',
      price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : '',
      stock: String(p.stock),
      images: p.images.join('\n'),
      tags: p.tags.join(', '),
      status: p.status,
      featured: p.featured,
      brand: p.brand ?? '',
      weight_kg: p.weight_kg ? String(p.weight_kg) : '',
      variations: p.variations ? JSON.stringify(p.variations) : '',
    });
  };

  return (
    <div className="page-enter">
      {/* Toolbar */}
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
        <button onClick={() => setEditing(empty)} className="btn-primary">
          <Plus className="w-5 h-5" /> Novo Produto
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl2 shadow-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl2 shadow-card p-12 text-center">
          <Package className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl2 shadow-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-cream-50 border-b border-cream-200">
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3 hidden sm:table-cell">Estoque</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Shopee</th>
                <th className="px-4 py-3 hidden lg:table-cell">ML</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id);
                return (
                  <tr key={p.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.images[0]} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-800 line-clamp-1">{p.name}</p>
                          {p.brand && <p className="text-xs text-neutral-400">{p.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-neutral-600">{cat?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-800">{formatBRL(p.price)}</p>
                      {p.original_price && p.original_price > p.price && (
                        <p className="text-xs text-neutral-400 line-through">{formatBRL(p.original_price)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`badge text-xs ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock < 10 ? 'bg-gold-100 text-gold-700' : 'bg-green-100 text-green-700'}`}>
                        {p.stock} un.
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.shopee_sync_status === 'synced' ? (
                        <span className="badge text-xs bg-green-100 text-green-700">Sincronizado</span>
                      ) : p.shopee_sync_status === 'error' ? (
                        <span className="badge text-xs bg-red-100 text-red-700">Erro</span>
                      ) : p.shopee_sync_status === 'pending' ? (
                        <span className="badge text-xs bg-gold-100 text-gold-700">Pendente</span>
                      ) : (
                        <span className="badge text-xs bg-neutral-100 text-neutral-400">Não enviado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {p.mercadolivre_sync_status === 'synced' ? (
                        <span className="badge text-xs bg-green-100 text-green-700">Sincronizado</span>
                      ) : p.mercadolivre_sync_status === 'error' ? (
                        <span className="badge text-xs bg-red-100 text-red-700">Erro</span>
                      ) : p.mercadolivre_sync_status === 'pending' ? (
                        <span className="badge text-xs bg-gold-100 text-gold-700">Pendente</span>
                      ) : (
                        <span className="badge text-xs bg-neutral-100 text-neutral-400">Não enviado</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleSyncShopee(p.id)} disabled={shopeeSyncing === p.id} title="Publicar na Shopee" className="p-2 rounded-lg hover:bg-orange-50 text-neutral-400 hover:text-orange-600">
                          {shopeeSyncing === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleSyncMl(p.id)} disabled={mlSyncing === p.id} title="Publicar no Mercado Livre" className="p-2 rounded-lg hover:bg-yellow-50 text-neutral-400 hover:text-yellow-600">
                          {mlSyncing === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TagIcon className="w-4 h-4" />}
                        </button>
                        <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-cream-100 text-neutral-500 hover:text-primary-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-xl3 shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto page-enter">
            <div className="sticky top-0 bg-white border-b border-cream-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{editing.id ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-cream-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input min-h-24" rows={3} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoria</label>
                  <select value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })} className="input">
                    <option value="">Selecione...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Marca</label>
                  <input value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Preço (R$) *</label>
                  <input required type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Preço Original (R$)</label>
                  <input type="number" step="0.01" value={editing.original_price} onChange={(e) => setEditing({ ...editing, original_price: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Estoque *</label>
                  <input required type="number" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Peso (kg)</label>
                  <input type="number" step="0.001" value={editing.weight_kg} onChange={(e) => setEditing({ ...editing, weight_kg: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Imagens (uma URL por linha)</label>
                <textarea value={editing.images} onChange={(e) => setEditing({ ...editing, images: e.target.value })} className="input min-h-20" rows={3} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Tags (separadas por vírgula)</label>
                <input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} className="input" placeholder="destaque, promocao, novidade" />
              </div>
              <div>
                <label className="label">Variações (JSON)</label>
                <input value={editing.variations} onChange={(e) => setEditing({ ...editing, variations: e.target.value })} className="input" placeholder='[{"name":"Volume","options":["50ml","100ml"]}]' />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Status</label>
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as EditState['status'] })} className="input">
                    <option value="active">Ativo</option>
                    <option value="draft">Rascunho</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-3">
                    <input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} className="w-5 h-5 accent-primary-600 rounded" />
                    <span className="text-sm font-medium text-neutral-700">Destaque na home</span>
                  </label>
                </div>
              </div>
              {!editing.id && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-xl2 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="auto-wa"
                      checked={autoWhatsApp}
                      onChange={(e) => setAutoWhatsApp(e.target.checked)}
                      className="w-5 h-5 accent-green-600 rounded"
                    />
                    <label htmlFor="auto-wa" className="text-sm font-medium text-neutral-700 flex items-center gap-2 cursor-pointer">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      Enviar automaticamente ao grupo do WhatsApp
                    </label>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl2 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="auto-shopee"
                      checked={autoShopee}
                      onChange={(e) => setAutoShopee(e.target.checked)}
                      className="w-5 h-5 accent-orange-600 rounded"
                    />
                    <label htmlFor="auto-shopee" className="text-sm font-medium text-neutral-700 flex items-center gap-2 cursor-pointer">
                      <ShoppingCart className="w-4 h-4 text-orange-600" />
                      Publicar automaticamente na Shopee
                    </label>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-xl2 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="auto-ml"
                      checked={autoMl}
                      onChange={(e) => setAutoMl(e.target.checked)}
                      className="w-5 h-5 accent-yellow-600 rounded"
                    />
                    <label htmlFor="auto-ml" className="text-sm font-medium text-neutral-700 flex items-center gap-2 cursor-pointer">
                      <TagIcon className="w-4 h-4 text-yellow-600" />
                      Publicar automaticamente no Mercado Livre
                    </label>
                  </div>
                </div>
              )}
              {waStatus && (
                <div className={`p-3 rounded-lg text-sm ${waStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {waStatus.msg}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-ghost border border-neutral-200 flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
