'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { isElectron } from '@/lib/isElectron'; // 🔥 NOVO
import { Lock, User, Loader2 } from 'lucide-react';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
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

    const success = await login(username, password);

    if (!success) {
      setError('Usuário ou senha incorretos');
      setLoading(false);
    }
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
          <p>3 Porquinhos Delivery</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <div className={styles.inputIcon}>
              <User size={18} />
            </div>
            <input
              type="text"
              placeholder="Usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

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
              disabled={loading}
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