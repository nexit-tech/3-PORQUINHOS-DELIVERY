'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isElectron } from '@/lib/isElectron';
import { Lock, Loader2 } from 'lucide-react';
import { STORE_NAME } from '@/config/store';
import styles from './page.module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🔥 SE FOR ELECTRON, REDIRECIONA DIRETO PRO PAINEL
  useEffect(() => {
    if (isElectron()) {
      console.log('[Login] Electron detectado - Redirecionando para painel');
      router.replace('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(password);

    if (!result.ok) {
      setError(result.message || 'Senha incorreta');
      setLoading(false);
      return;
    }

    // Volta para a página que o middleware bloqueou, se houver.
    // Navegação cheia, não router.replace: o cookie da sessão foi gravado pelo
    // servidor, e é ele que o middleware lê na próxima requisição.
    const from = searchParams.get('from');
    const destino = from && from.startsWith('/') ? from : '/';
    window.location.replace(destino);
  };

  // 🔥 NÃO RENDERIZA NADA SE FOR ELECTRON (vai redirecionar)
  if (isElectron()) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Loader2 className={styles.spin} size={32} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <div className={styles.icon}>
            <Lock size={32} />
          </div>
          <h1>Painel Administrativo</h1>
          <p>{STORE_NAME} Delivery</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <div className={styles.inputIcon}>
              <Lock size={18} />
            </div>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button type="submit" className={styles.loginBtn} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className={styles.spin} size={18} />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <a href="/pedido" className={styles.link}>
            Ir para área do cliente →
          </a>
        </div>
      </div>
    </div>
  );
}

// useSearchParams exige Suspense no App Router
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <Loader2 className={styles.spin} size={32} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}