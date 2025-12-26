'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShoppingBag, 
  UtensilsCrossed, 
  Settings, 
  LogOut, 
  DollarSign 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext'; // 🔥 NOVO
import styles from './styles.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { logout } = useAuth(); // 🔥 NOVO

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

      {/* 🔥 BOTÃO DE SAIR AGORA FUNCIONAL */}
      <button className={styles.logoutBtn} onClick={logout}>
        <LogOut size={20} />
        <span>Sair</span>
      </button>
    </nav>
  );
}