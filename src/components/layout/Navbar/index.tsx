'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react'; // 🔥 useRef importado
import { 
  ShoppingBag, 
  UtensilsCrossed, 
  Settings, 
  LogOut, 
  DollarSign,
  Bell 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isElectron } from '@/lib/isElectron';
import { supabase } from '@/services/supabase';
import styles from './styles.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  
  // 🔥 Refs para controle de áudio e estado anterior
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);
  const isFirstLoad = useRef(true);

  // Se estiver na área do cliente, esconde navbar
  if (pathname.startsWith('/pedido')) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  const inElectron = isElectron();

  // 🔥 Inicializa o objeto de áudio apenas uma vez
  useEffect(() => {
    // Garanta que o arquivo mensagem.mp3 esteja na pasta /public
    audioRef.current = new Audio('/mensagem.mp3');
    audioRef.current.load();
  }, []);

  // 🔥 Monitoramento de Notificações com Som
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('bot_notifications')
          .select('*', { count: 'exact', head: true }) // head: true é mais leve, traz só a contagem
          .eq('type', 'HUMAN_REQUEST')
          .eq('is_read', false);

        if (!error && count !== null) {
          // Lógica do som:
          // 1. Não toca na primeira carga da página (pra não irritar no F5)
          // 2. Toca se o número atual (count) for MAIOR que o anterior (prevCountRef)
          if (!isFirstLoad.current && count > prevCountRef.current) {
            try {
              audioRef.current?.play().catch(err => {
                console.warn('Bloqueio de autoplay ou erro de áudio:', err);
              });
            } catch (e) {
              console.error(e);
            }
          }

          // Atualiza as referências
          prevCountRef.current = count;
          setUnreadCount(count);
          isFirstLoad.current = false;
        }
      } catch (err) {
        console.error('Erro ao buscar notificações:', err);
      }
    };

    // Busca imediata
    fetchUnreadCount();
    
    // Repete a cada 5 segundos
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <h1>Painel <span style={{ color: 'var(--primary-color)' }}>Administrativo</span></h1>
      </div>

      <div className={styles.links}>
        <Link 
          href="/" 
          className={`${styles.link} ${isActive('/') ? styles.active : ''}`}
        >
          <ShoppingBag size={20} />
          <span>Pedidos</span>
        </Link>

        {/* 🔥 LINK DE NOTIFICAÇÕES COM BADGE */}
        <Link 
          href="/notifications" 
          className={`${styles.link} ${isActive('/notifications') ? styles.active : ''}`}
        >
          <div className={styles.iconWrapper}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
          </div>
          <span>Notificações</span>
        </Link>

        <Link 
          href="/products" 
          className={`${styles.link} ${isActive('/products') ? styles.active : ''}`}
        >
          <UtensilsCrossed size={20} />
          <span>Produtos</span>
        </Link>
        
        <Link 
          href="/finance" 
          className={`${styles.link} ${isActive('/finance') ? styles.active : ''}`}
        >
          <DollarSign size={20} />
          <span>Financeiro</span>
        </Link>
        
        <Link 
          href="/settings" 
          className={`${styles.link} ${isActive('/settings') ? styles.active : ''}`}
        >
          <Settings size={20} />
          <span>Configurações</span>
        </Link>
      </div>

      {!inElectron && (
        <button className={styles.logoutBtn} onClick={logout}>
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      )}
    </nav>
  );
}