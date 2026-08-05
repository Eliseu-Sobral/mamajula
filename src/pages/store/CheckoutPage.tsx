import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Truck, Check } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatBRL } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', cep: '', address: '', number: '', complement: '', city: '', state: '',
  });
  const [payment, setPayment] = useState('pix');

  const shipping = subtotal >= 199 ? 0 : 19.9;
  const total = subtotal + shipping;

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from('orders').insert({
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      shipping_address: { cep: form.cep, address: form.address, number: form.number, complement: form.complement, city: form.city, state: form.state },
      items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, image: i.image })),
      subtotal,
      shipping_cost: shipping,
      total,
      payment_method: payment,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      alert('Erro ao processar pedido. Tente novamente.');
      return;
    }
    setSuccess(true);
    clear();
    setTimeout(() => navigate('/'), 5000);
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center page-enter">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-success" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-neutral-800 mb-3">Pedido Recebido!</h1>
        <p className="text-neutral-600 mb-6">
          Obrigado pela sua compra! Em breve você receberá um e-mail de confirmação com os detalhes do envio.
        </p>
        <Link to="/catalogo" className="btn-primary">Continuar Comprando</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-neutral-500 text-lg mb-4">Seu carrinho está vazio.</p>
        <Link to="/catalogo" className="btn-primary">Explorar produtos</Link>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/catalogo" className="btn-ghost mb-6 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Continuar comprando
      </Link>
      <h1 className="section-title mb-8">Finalizar Compra</h1>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Customer */}
          <section className="bg-white rounded-xl3 shadow-card p-6">
            <h2 className="font-display text-lg font-semibold mb-4">Dados Pessoais</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Nome completo *</label>
                <input required value={form.name} onChange={(e) => update('name', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">E-mail *</label>
                <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Telefone / WhatsApp *</label>
                <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input" />
              </div>
            </div>
          </section>

          {/* Shipping address */}
          <section className="bg-white rounded-xl3 shadow-card p-6">
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-500" /> Endereço de Entrega
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">CEP *</label>
                <input required value={form.cep} onChange={(e) => update('cep', e.target.value)} className="input" placeholder="00000-000" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Endereço *</label>
                <input required value={form.address} onChange={(e) => update('address', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Número *</label>
                <input required value={form.number} onChange={(e) => update('number', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Complemento</label>
                <input value={form.complement} onChange={(e) => update('complement', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Cidade *</label>
                <input required value={form.city} onChange={(e) => update('city', e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Estado *</label>
                <input required value={form.state} onChange={(e) => update('state', e.target.value)} className="input" placeholder="SP" maxLength={2} />
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="bg-white rounded-xl3 shadow-card p-6">
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-500" /> Forma de Pagamento
            </h2>
            <div className="space-y-3">
              {[
                { id: 'pix', label: 'PIX', desc: 'Aprovação imediata · 5% de desconto' },
                { id: 'boleto', label: 'Boleto Bancário', desc: 'Vencimento em 3 dias úteis' },
                { id: 'card', label: 'Cartão de Crédito', desc: 'Até 12x sem juros' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${payment === opt.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'}`}
                >
                  <input type="radio" name="payment" value={opt.id} checked={payment === opt.id} onChange={(e) => setPayment(e.target.value)} className="accent-primary-600" />
                  <div>
                    <p className="font-medium text-neutral-800">{opt.label}</p>
                    <p className="text-sm text-neutral-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-white rounded-xl3 shadow-card p-6 sticky top-24">
            <h2 className="font-display text-lg font-semibold mb-4">Resumo do Pedido</h2>
            <ul className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {items.map((item) => (
                <li key={`${item.id}-${item.variation}`} className="flex gap-3">
                  <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 line-clamp-2">{item.name}</p>
                    {item.variation && <p className="text-xs text-neutral-500">{item.variation}</p>}
                    <p className="text-xs text-neutral-500">{item.qty}x {formatBRL(item.price)}</p>
                  </div>
                  <span className="text-sm font-medium">{formatBRL(item.price * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-cream-200 pt-4 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Frete</span>
                <span>{shipping === 0 ? 'Grátis' : formatBRL(shipping)}</span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-primary-500">Frete grátis acima de {formatBRL(199)}</p>
              )}
              <div className="flex justify-between font-display text-xl font-semibold text-neutral-800 pt-2 border-t border-cream-200">
                <span>Total</span><span>{formatBRL(total)}</span>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full mt-6">
              {submitting ? 'Processando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
