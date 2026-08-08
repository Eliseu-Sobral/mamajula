import { useEffect, useState } from 'react';
import { Bell, Send, MessageCircle, Check, X, Clock, Smartphone, LogIn, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase, type Product, type NotificationJob } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useNavigate } from 'react-router-dom';

type Channel = 'push' | 'whatsapp' | 'both';

function edgeFnUrl(name: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string || '').replace(/\/$/, '');
  return `${base}/functions/v1/${name}`;
}

export default function AdminNotifications() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subCount, setSubCount] = useState(0);
  const [channel, setChannel] = useState<Channel>('push');
  const [form, setForm] = useState({ productId: '', title: '', body: '', imageUrl: '' });
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = async () => {
    if (!session) return;
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

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setLoading(false); return; }
    load();
  }, [authLoading, session]);

  function wrapEdgeError(fnName: string, fnUrl: string, err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && (err.name === 'TypeError' || /Failed to fetch|Failed to send a request to the Edge Function|NetworkError|CORS|Blocked by CORS|Fetch failed/i.test(msg))) {
      return new Error(
        `Não foi possível contatar a função ${fnName}. ` +
        `Causas comuns: ` +
        `(1) A edge function ainda NÃO FOI DEPLOYADA — rode no terminal: supabase functions deploy ${fnName} ` +
        `(2) Bloqueio de CORS — verifique o secret SITE_ORIGIN (deve ser '${window.location.origin}' para o ambiente atual, ou '*' em desenvolvimento). ` +
        `(3) URL usada: ${fnUrl} — abra essa URL numa nova aba: se aparecer 401/JSON, a função existe. Se aparecer 404/branco, falta deploy. ` +
        `(4) A extensão AdBlock/uBlock/privacidade pode bloquear a requisição — desative temporariamente e teste. ` +
        `Detalhe original do navegador: ${msg}`,
      );
    }
    return err instanceof Error ? err : new Error(msg);
  }

  function decodeFnError(fnName: string, fnUrl: string, rawError: string, status: number): Error {
    if (status === 401 || status === 403 || /unauthorized|forbidden/i.test(rawError)) {
      return new Error(
        `Sem permissão para chamar ${fnName} (HTTP ${status}). ` +
        `O que fazer: (1) Clique em "Ir para Login" e recarregue a sessão. ` +
        `(2) Verifique se o secret JWT_SECRET foi definido na edge function no Supabase (` +
        `Project Settings → API → JWT Secret, depois 'supabase secrets set JWT_SECRET=...'). ` +
        `(3) Se quiser, pode testar manualmente a URL ${fnUrl} com POST no Postman usando o mesmo token. ` +
        `Detalhe do servidor: ${rawError}`,
      );
    }
    if (status === 404) {
      return new Error(
        `Função ${fnName} não encontrada (HTTP 404) em ${fnUrl}. ` +
        `Implante com: supabase functions deploy ${fnName}. Depois confirme no painel Supabase → Edge Functions que a função aparece listada.`,
      );
    }
    if (status >= 500 && /vapid/i.test(rawError)) {
      return new Error(`${rawError}. Vá em Admin → Configurações → Integrações → Push Notifications, clique em Gerar novas chaves VAPID e depois Salvar VAPID.`);
    }
    if (status >= 500) {
      return new Error(`Erro interno no servidor da função ${fnName} (HTTP ${status}). Confira os logs da edge function no painel Supabase → Edge Functions → ${fnName} → Logs. Detalhe: ${rawError}`);
    }
    return new Error(rawError);
  }

  async function postEdgeFn(
    fnName: string,
    bodyPayload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const fnUrl = edgeFnUrl(fnName);
    const token = session?.access_token;
    if (!token) throw new Error(`Sem sessão ativa para chamar ${fnName}. Faça login novamente.`);

    let response: Response;
    try {
      response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '',
        },
        body: JSON.stringify(bodyPayload),
      });
    } catch (err) {
      throw wrapEdgeError(fnName, fnUrl, err);
    }

    let data: Record<string, unknown> = {};
    try { data = (await response.json()) as Record<string, unknown>; } catch { /* ignore JSON parse */ }

    const serverError = String((data.error as string) ?? '');
    if (!response.ok || serverError) {
      throw decodeFnError(fnName, fnUrl, serverError || `HTTP ${response.status} sem resposta JSON`, response.status);
    }
    return data;
  }

  const sendWhatsApp = async (title: string, message: string, imageUrl: string, productId: string) => {
    const productUrl = productId ? `${window.location.origin}/produto/${productId}` : '';
    return postEdgeFn('whatsapp-send', { title, message, imageUrl, productUrl, productId });
  };

  const sendPushNotification = async (title: string, body: string, imageUrl: string, productId: string) => {
    return postEdgeFn('push-send', { title, body, imageUrl, productId, channel: 'push' });
  };

  function pushErrorToReadable(errorLine: string): string {
    if (!errorLine) return '';
    if (/HTTP 401|Unauthorized|restricted|JWT|expired|invalid.*aud|invalid.*sub/i.test(errorLine)) {
      return 'VAPID inválido (HTTP 401 do provedor de push). As chaves VAPID salvas no banco NÃO BATEM com a chave pública usada no subscribe do navegador. SOLUÇÃO: Vá para Configurações → Integrações → Push → clique em GERAR NOVAS CHAVES VAPID → salve. DEPOIS, desative e ative NOVAMENTE as notificações na HOME para inscrever com a chave nova.';
    }
    if (/HTTP 403|Forbidden|permission.*denied/i.test(errorLine)) {
      return 'Provedor de push retornou 403 (VAPID claim errado / sub claim inválido). Confira: (1) E-mail do remetente VAPID é válido. (2) SITE_URL definido corretamente (sem aspas).';
    }
    if (/HTTP 404|HTTP 410|Gone|inscrição expirada/i.test(errorLine)) {
      return 'Inscrição expirada/inválida (HTTP 410). Será removida automaticamente. DESATIVE e ATIVE NOVAMENTE as notificações na home para gerar uma inscrição nova.';
    }
    if (/HTTP 429|Too many requests/i.test(errorLine)) {
      return 'Rate limit do provedor de push (429). Espere alguns minutos e tente novamente.';
    }
    if (/HTTP 5\d\d|ServerError|gateway|timeout/i.test(errorLine)) {
      return 'Erro no servidor do provedor de push (Firebase/Edge/Mozilla). Geralmente é transitório. Tente novamente em 1 minuto.';
    }
    if (/encrypt|aes128gcm|HKDF|p256dh|auth.*key|invalid.*key|crypto|subtle/i.test(errorLine)) {
      return 'Erro durante criptografia Web Push AES128-GCM. Provavelmente a chave p256dh/auth da inscrição está corrompida. Solução: desative e ative novamente as notificações na home para reinscrever.';
    }
    if (/vapid t=|Authorization.*vapid/i.test(errorLine)) {
      return 'Provedor de push rejeitou o header VAPID. Confira SITE_URL (sem aspas) e se a chave privada VAPID foi importada corretamente (formato pkcs8).';
    }
    return errorLine;
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.body) return;
    setSending(true);
    setResult(null);

    const selectedProduct = products.find((p) => p.id === form.productId);
    const imageUrl = form.imageUrl || selectedProduct?.images[0] || '';
    const errors: string[] = [];
    let pushSentCount = 0;
    let pushFailedCount = 0;
    let pushErrorDetails: string[] = [];
    let pushTotal = 0;

    if (channel === 'push' || channel === 'both') {
      try {
        const pushResult = await sendPushNotification(form.title, form.body, imageUrl, form.productId);
        pushSentCount = Number(pushResult.sent) || 0;
        pushFailedCount = Number(pushResult.failed) || 0;
        pushTotal = Number(pushResult.total) || 0;

        const errList = (pushResult.errors as unknown[]) || [];
        if (Array.isArray(errList)) {
          pushErrorDetails = errList.map((item) => {
            if (item && typeof item === 'object' && 'err' in item) return String((item as { err: string }).err);
            return String(item);
          });
        } else if (pushResult.error_message) {
          pushErrorDetails = [String(pushResult.error_message)];
        }

        if (pushFailedCount > 0) {
          const readable = pushErrorDetails.slice(0, 5).map((e) => pushErrorToReadable(e));
          const totalErrs = pushErrorDetails.length;
          const sampleHosts = (pushResult.sampleEndpoints as unknown[]) || [];
          const hostsStr = Array.isArray(sampleHosts)
            ? sampleHosts.map((h) => (typeof h === 'object' && h !== null ? String((h as { host?: string }).host ?? '') : '')).filter(Boolean).join(', ')
            : '';
          errors.push(
            `Push: ${pushSentCount} enviada(s), ${pushFailedCount} falha(s) para ${pushTotal} inscrito(s). ` +
            (hostsStr ? `Provedor(es) dos inscritos: ${hostsStr}. ` : '') +
            `Primeiro(s) erro(s) detalhado(s): ` +
            readable.map((r, i) => `\n  ${i + 1}. ${r}`).join('') +
            (totalErrs > readable.length ? `\n  (mais ${totalErrs - readable.length} erro(s) omitidos)` : ''),
          );
        }
        if (!pushResult.jobId && !pushResult.success) {
          errors.push(`Push: Nenhum job ID retornado`);
        }
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
      setResult({ type: 'error', msg: 'Falha em: ' + errors.join('\n\n---\n') });
    } else {
      let detail = '';
      if (channel === 'push') detail = `${pushSentCount} enviada(s), ${pushFailedCount} falha(s) para ${pushTotal || subCount} inscrito(s)`;
      else if (channel === 'whatsapp') detail = 'grupo do WhatsApp';
      else detail = `${pushSentCount} Push + grupo WhatsApp`;
      setResult({ type: 'success', msg: `Notificação enviada com sucesso! (${detail})` });
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

  const diagnosticPushFnUrl = edgeFnUrl('push-send');
  const EXPECTED_BUILD_ID = '2026-08-06-cors-v2-fix';

  const runSelfTest = async () => {
    setResult(null);
    setSending(true);
    const errs: string[] = [];
    const warns: string[] = [];
    const infos: string[] = [];

    let serverBuildId: string | null = null;
    let serverDebugOrigin: string | null = null;
    let serverCorsAllowOrigin: string | null = null;
    let health: Record<string, unknown> | null = null;
    let optionsBlockedInBrowser = false;
    let healthBlockedInBrowser = false;

    const cacheBust = () => `_cb=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const noCacheHeaders = {
      'Pragma': 'no-cache',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    } as const;

    try {
      const preflightRes = await fetch(diagnosticPushFnUrl + '?health=1&' + cacheBust(), {
        method: 'OPTIONS',
        cache: 'no-store',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization,apikey',
          'Origin': window.location.origin,
          ...noCacheHeaders,
        },
      });
      serverCorsAllowOrigin = preflightRes.headers.get('Access-Control-Allow-Origin');
      const acam = preflightRes.headers.get('Access-Control-Allow-Methods');
      const acah = preflightRes.headers.get('Access-Control-Allow-Headers');
      serverBuildId = preflightRes.headers.get('X-Build-Id');
      serverDebugOrigin = preflightRes.headers.get('X-Debug-Origin');

      infos.push(`CORS OPTIONS (preflight): status=${preflightRes.status}`);
      infos.push(`  Allow-Origin:  ${serverCorsAllowOrigin ?? '(não enviado — CORS VAI FALHAR)'}`);
      infos.push(`  Allow-Methods: ${acam ?? '(não enviado)'}`);
      infos.push(`  Allow-Headers: ${acah ?? '(não enviado)'}`);
      if (serverBuildId) infos.push(`  Build-Id:      ${serverBuildId}  (esperado: ${EXPECTED_BUILD_ID})`);
      if (serverDebugOrigin) infos.push(`  Debug-Origin:  ${serverDebugOrigin}`);

      if (!serverCorsAllowOrigin) errs.push('CORS: Servidor não retornou Access-Control-Allow-Origin. SITE_ORIGIN da função deve ser * ou ' + window.location.origin);
    } catch (err) {
      optionsBlockedInBrowser = true;
      infos.push(`CORS OPTIONS (preflight): 🚫 BLOQUEADO no navegador (ver avisos abaixo)`);
    }

    try {
      const healthRes = await fetch(diagnosticPushFnUrl + '?health=1&' + cacheBust(), {
        method: 'GET',
        cache: 'no-store',
        headers: noCacheHeaders,
      });
      if (!serverBuildId) serverBuildId = healthRes.headers.get('X-Build-Id');
      let txt = '';
      try { txt = await healthRes.text(); } catch { /* ignore */ }
      try { health = JSON.parse(txt) as Record<string, unknown>; } catch { /* ignore */ }

      infos.push(`GET /health: status=${healthRes.status}`);
      if (healthRes.status === 404) errs.push('Função push-send NÃO EXISTE (404). Execute: supabase functions deploy push-send');
      if (health && typeof health.build === 'string') {
        infos.push(`  health.build = ${health.build}  (esperado: ${EXPECTED_BUILD_ID})`);
        if (!serverBuildId) serverBuildId = health.build;
        if (health.build === EXPECTED_BUILD_ID) {
          infos.push(`  ✅ VERSÃO CORRETA CONFIRMADA via endpoint /health.`);
        }
      }
      if (health) {
        const h = health as Record<string, unknown>;
        if (typeof h.cfgSiteOrigin === 'string') infos.push(`  health.cfgSiteOrigin = ${h.cfgSiteOrigin}`);
        if (typeof h.effectiveAllowOrigin === 'string') infos.push(`  health.effectiveAllowOrigin = ${h.effectiveAllowOrigin}`);
        if (typeof h.siteUrl === 'string') {
          const cleanSiteUrl = h.siteUrl.trim();
          if (/[`'"]/.test(cleanSiteUrl)) {
            warns.push(
              `SITE_URL gravado com aspas/crase coladas (recebi: ${cleanSiteUrl}). ` +
              `Isso vai quebrar o link das notificações. Edite o secret SITE_URL no painel do Supabase e ` +
              `cole APENAS: https://mamajula.com.br (sem crase, sem aspas duplas/simples, sem espaço).`,
            );
          }
          infos.push(`  health.siteUrl = ${cleanSiteUrl}`);
        }
        infos.push(
          `  health: supabaseUrl=${String(h.supabaseUrlSet)}, ` +
          `serviceKey=${String(h.serviceKeySet)}, ` +
          `jwtSecret=${String(h.jwtSecretSet)}`,
        );
      } else if (txt) {
        infos.push(`  (body, versão antiga não tem endpoint /health): ${txt.slice(0, 220)}`);
      }
    } catch (err) {
      healthBlockedInBrowser = true;
      infos.push(`GET /health: 🚫 BLOQUEADO no navegador — Detalhe: ${(err as Error).message}`);
    }

    if (optionsBlockedInBrowser && healthBlockedInBrowser) {
      errs.push(
        `BLOQUEIO TOTAL NO NAVEGADOR: TANTO o CORS OPTIONS QUANTO o GET /health falharam com "Failed to fetch". ` +
        `MAS a mesma URL funciona se você abrir em NOVA ABA (você já confirmou isso antes). ` +
        `Isso SÓ PODE significar EXTENSÃO BLOQUEANDO fetch() no JS. PASSOS OBRIGATÓRIOS: ` +
        `(A) Abra o site em JANELA ANÔNIMA do Chrome/Edge e teste novamente. ` +
        `(B) Desative TEMPORARIAMENTE AdBlock, uBlock, Brave Shields, Privacy Badger, DDG Privacy Essentials, Kaspersky Total Security, etc. ` +
        `(C) Se estiver em Rede Corporativa / VPN de empresa, provavelmente o proxy bloqueia requisições fetch para domínios .supabase.co — teste em rede doméstica.`,
      );
    } else if (optionsBlockedInBrowser && !healthBlockedInBrowser) {
      warns.push(
        `CORS OPTIONS bloqueado no navegador mas GET /health PASSOU (versão ${serverBuildId ?? 'correta'}). ` +
        `Isso é tipicamente cache CORS do navegador. Pode tentar DISPARAR A NOTIFICAÇÃO MESMO ASSIM — tem chances de funcionar. ` +
        `Para limpar o cache CORS: teste em janela anônima, ou limpe dados de site do seu domínio localhost.`,
      );
    }

    if (serverBuildId && serverBuildId !== EXPECTED_BUILD_ID) {
      warns.push(
        `DEPLOY DESATUALIZADO: O servidor está rodando BUILD "${serverBuildId}", ` +
        `mas esperamos "${EXPECTED_BUILD_ID}". Isso significa que o código novo NÃO foi enviado ao Supabase ainda. ` +
        `Rode novamente: supabase functions deploy push-send`,
      );
    }
    if (!serverBuildId && !health) {
      if (healthBlockedInBrowser && optionsBlockedInBrowser) {
        // Não sabe sobre o deploy porque não conseguiu nem pingar — não emite falso "deploy desatualizado"
        infos.push(`  ℹ️ Build Id não pode ser verificado porque TODAS as requisições foram bloqueadas no navegador. Use a URL de diagnóstico abaixo.`);
      } else if (healthBlockedInBrowser || optionsBlockedInBrowser) {
        infos.push(`  ℹ️ Build Id não veio em todas as requisições (pode ser cache). Confirme via URL abaixo.`);
      } else {
        warns.push(
          `DEPLOY DESATUALIZADO: O servidor NÃO enviou X-Build-Id nem health.build. ` +
          `Isso indica 100% certeza que a versão em execução é a ANTIGA (antes da correção CORS). ` +
          `Rode: supabase functions deploy push-send`,
        );
      }
    } else if (serverBuildId === EXPECTED_BUILD_ID && !serverCorsAllowOrigin && !health && !optionsBlockedInBrowser) {
      warns.push(
        `Build nova detectada mas CORS OPTIONS falhou. Pode ser cache do navegador (Max-Age antigo). ` +
        `Teste em uma janela anônima ou limpe o cache do navegador e rode novamente o Autoteste.`,
      );
    }

    const lines: string[] = [];
    if (errs.length) lines.push(`Problemas encontrados (${errs.length}):\n` + errs.map((e, i) => `${i + 1}. ${e}`).join('\n'));
    if (warns.length) lines.push(`Avisos (${warns.length}):\n` + warns.map((e, i) => `${i + 1}. ${e}`).join('\n'));
    if (!errs.length && !warns.length) lines.push(`Autoteste OK! Conexão com a edge function parece boa.`);
    lines.push(`\nDiagnósticos:\n` + infos.map((e) => `• ${e}`).join('\n'));
    lines.push(`\n👉 URL de diagnóstico manual (abra em nova aba para confirmar o deploy):\n   ${diagnosticPushFnUrl}?health=1`);

    setResult({
      type: errs.length ? 'error' : warns.length ? 'error' : 'success',
      msg: lines.join('\n'),
    });
    setSending(false);
  };

  if (authLoading) {
    return (
      <div className="page-enter space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl2 shadow-card p-5 h-28 animate-pulse bg-neutral-100" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl2 shadow-card p-6 h-96 animate-pulse bg-neutral-100" />
          <div className="bg-white rounded-xl2 shadow-card p-6 h-96 animate-pulse bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-enter flex items-center justify-center min-h-[60vh]">
        <div className="max-w-lg w-full bg-white rounded-xl2 shadow-card p-8 text-center space-y-5">
          <div className="inline-flex p-4 rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="font-display text-xl font-semibold text-neutral-800">Sessão não carregada</h2>
          <p className="text-neutral-600 leading-relaxed">
            Para disparar notificações, você precisa estar logado no painel administrador.
            Clique abaixo para fazer login.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => navigate('/admin/login')} className="btn-primary inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Ir para Login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn-ghost inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Send className="w-5 h-5 text-primary-500" /> Nova Notificação
            </h2>
            <button
              type="button"
              onClick={runSelfTest}
              disabled={sending}
              className="btn-ghost !px-3 !py-2 text-sm inline-flex items-center gap-2"
              title="Testa CORS, deploy e conectividade com a edge function push-send"
            >
              <RefreshCw className={`w-4 h-4 ${sending ? 'animate-spin' : ''}`} />
              Autoteste
            </button>
          </div>

          <div className="mb-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 space-y-1.5 break-all">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-700">Diagnóstico</span>
              <a
                href={diagnosticPushFnUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline inline-flex items-center gap-1 flex-shrink-0"
              >
                Abrir URL da função <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div>
              <span className="text-neutral-500">push-send:</span>{' '}
              <code className="bg-white border border-neutral-200 px-1.5 py-0.5 rounded text-[10px]">{diagnosticPushFnUrl}</code>
            </div>
            <div>
              <span className="text-neutral-500">Sua origem (SITE_ORIGIN recomendado):</span>{' '}
              <code className="bg-white border border-neutral-200 px-1.5 py-0.5 rounded text-[10px]">{window.location.origin}</code>
            </div>
          </div>

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
