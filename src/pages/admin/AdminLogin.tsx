import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User as UserIcon, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function AdminLogin() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === 'signup') {
      setError('Conta criada! Faça login para continuar.');
      setMode('login');
    } else {
      navigate('/admin/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero-gradient px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="btn-ghost mb-6 text-neutral-600">
          <ArrowLeft className="w-4 h-4" /> Voltar à loja
        </Link>

        <div className="bg-white rounded-xl3 shadow-modal p-8">
          <div className="text-center mb-8">
            <img src="/image.png" alt="Mamajula" className="h-16 w-auto object-contain mx-auto mb-4" />
            <h1 className="font-display text-2xl font-semibold text-neutral-800">
              {mode === 'login' ? 'Painel Administrativo' : 'Criar Conta'}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {mode === 'login' ? 'Acesse o painel de gestão' : 'Crie sua conta de administrador'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="admin@mamajula.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-neutral-500">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button onClick={() => setMode('signup')} className="text-primary-600 font-medium hover:underline">
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={() => setMode('login')} className="text-primary-600 font-medium hover:underline">
                  Fazer login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
