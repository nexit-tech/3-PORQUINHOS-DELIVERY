'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isElectron } from '@/lib/isElectron';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Verifica autenticação ao carregar
  useEffect(() => {
    // 🔥 SE ESTIVER NO ELECTRON, AUTENTICA AUTOMATICAMENTE
    if (isElectron()) {
      console.log('[Auth] Electron detectado - Login automático');
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // Se for web, verifica token normal
    const token = localStorage.getItem('admin_token');
    if (token === 'authenticated') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Redireciona se não estiver autenticado (exceto rotas públicas)
  useEffect(() => {
    if (loading) return;

    const isPublicRoute = pathname.startsWith('/pedido') || pathname === '/login';

    // 🔥 NO ELECTRON, NUNCA REDIRECIONA PARA LOGIN
    if (isElectron()) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router, loading]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('admin_token', 'authenticated');
        setIsAuthenticated(true);
        router.push('/');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    }
  };

  const logout = () => {
    // 🔥 NO ELECTRON, NÃO FAZ NADA (não pode sair)
    if (isElectron()) {
      console.log('[Auth] Logout desabilitado no Electron');
      return;
    }

    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    router.push('/login');
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