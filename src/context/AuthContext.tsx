'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/services/supabase';
import { isElectron } from '@/lib/isElectron';
import { getEnv } from '@/lib/env';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (data.session) {
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // No Electron não existe tela de login: o app roda na máquina do balcão.
      // Mesmo assim ele precisa de uma sessão de verdade, senão a RLS bloqueia
      // tudo. Então ele entra sozinho com as credenciais do .env empacotado.
      if (isElectron()) {
        const email = getEnv('ADMIN_EMAIL');
        const password = getEnv('ADMIN_PASSWORD');

        if (email && password) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) console.error('[Auth] Falha no login automático do Electron:', error.message);
        } else {
          console.error('[Auth] ADMIN_EMAIL/ADMIN_PASSWORD ausentes no .env do Electron.');
        }
      }

      if (!active) return;
      setLoading(false);
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // A tela pede só a senha. Quem confere é /api/auth/login, no servidor, porque
  // o .env não existe no navegador. A rota devolve os cookies da sessão do
  // Supabase já gravados.
  const login = async (password: string) => {
    let res: Response;

    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch (err) {
      console.error('[Auth] Não consegui falar com /api/auth/login:', err);
      return { ok: false, message: 'Servidor fora do ar.' };
    }

    const data = await res.json().catch(() => ({}) as { ok?: boolean; message?: string });

    if (!res.ok || !data.ok) {
      return { ok: false, message: data.message || 'Senha incorreta' };
    }

    // Faz o cliente do navegador enxergar o cookie que a rota acabou de gravar
    await supabase.auth.getSession();
    setIsAuthenticated(true);
    return { ok: true };
  };

  const logout = async () => {
    if (isElectron()) {
      console.log('[Auth] Logout desabilitado no Electron');
      return;
    }

    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
