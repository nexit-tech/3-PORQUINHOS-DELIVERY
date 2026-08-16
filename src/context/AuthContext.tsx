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

  // A tela pede só a senha. Quem valida é /api/auth/login, no servidor: de lá
  // sai o e-mail (do .env) e volta o cookie da sessão já gravado.
  //
  // Nada de chamar o supabase-js aqui. A trava que ele usa para sincronizar a
  // sessão entre abas pode ficar presa, e aí o login trava em "Entrando..."
  // para sempre, sem erro nenhum no console. O timeout abaixo é a segunda
  // garantia: preso ou não, a tela volta a responder.
  const login = async (password: string) => {
    let res: Response;

    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      const expirou = err instanceof DOMException && err.name === 'TimeoutError';
      console.error('[Auth] Falha ao chamar /api/auth/login:', err);
      return {
        ok: false,
        message: expirou
          ? 'O servidor não respondeu em 20s. Tente de novo.'
          : 'Não consegui falar com o servidor.',
      };
    }

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };

    if (!res.ok || !data.ok) {
      return { ok: false, message: data.message || 'Senha incorreta' };
    }

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
