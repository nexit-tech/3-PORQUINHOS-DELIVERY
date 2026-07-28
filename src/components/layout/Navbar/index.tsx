'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  UtensilsCrossed,
  Settings,
  LogOut,
  DollarSign,
  Bell,
  Ticket
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isElectron } from '@/lib/isElectron';
import { supabase } from '@/services/supabase';
import styles from './styles.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);
  const isFirstLoad = useRef(true);

  // A Navbar some na área do cliente. IMPORTANTE: isso é uma flag, não um
  // `return null` antes dos hooks. Do jeito antigo os dois useEffect abaixo
  // ficavam depois do early return, então a quantidade de hooks mudava
  // conforme a rota — e o React quebra com "Rendered more hooks than during
  // the previous render" na primeira navegação entre /pedido e o painel.
  const hidden = pathname.startsWith('/pedido');

  const inElectron = isElectron();

  useEffect(() => {
    if (hidden) return;

    // Garanta que o arquivo mensagem.mp3 esteja na pasta /public
    audioRef.current = new Audio('/mensagem.mp3');
    audioRef.current.load();
  }, [hidden]);

  useEffect(() => {
    if (hidden) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('bot_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'HUMAN_REQUEST')
          .eq('is_read', false);

        if (error || count === null) return;

        // Não toca na primeira carga (senão apita a cada F5)
        if (!isFirstLoad.current && count > prevCountRef.current) {
          audioRef.current?.play().catch((err) => {
            console.warn('Bloqueio de autoplay ou erro de áudio:', err);
          });
        }

        prevCountRef.current = count;
        setUnreadCount(count);
        isFirstLoad.current = false;
      } catch (err) {
        console.error('Erro ao buscar notificações:', err);
      }
    };

    fetchUnreadCount();

    // Realtime no lugar de polling: antes era um SELECT a cada 5 segundos,
    // 24h por dia, em cada painel aberto. O intervalo longo fica só como
    // rede de segurança caso o websocket caia.
    const channel = supabase
      .channel('navbar-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bot_notifications' },
        () => fetchUnreadCount()
      )
      .subscribe();

    const fallback = setInterval(fetchUnreadCount, 60_000);

    return () => {
      clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [hidden]);

  if (hidden) return null;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

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
          href="/coupons"
          className={`${styles.link} ${isActive('/coupons') ? styles.active : ''}`}
        >
          <Ticket size={20} />
          <span>Cupons</span>
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
        <button className={styles.logoutBtn} onClick={() => logout()}>
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      )}
    </nav>
  );
}
