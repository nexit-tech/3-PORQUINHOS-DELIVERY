'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Settings, LogOut, DollarSign } from 'lucide-react';
import styles from './styles.module.css';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <h1>Anota<span style={{ color: 'var(--primary-color)' }}>AI</span></h1>
      </div>

      <div className={styles.links}>
        <Link 
          href="/" 
          className={`${styles.link} ${isActive('/') ? styles.active : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>Pedidos</span>
        </Link>

        <Link 
          href="/products" 
          className={`${styles.link} ${isActive('/products') ? styles.active : ''}`}
        >
          <ShoppingBag size={20} />
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

      <button className={styles.logoutBtn}>
        <LogOut size={20} />
        <span>Sair</span>
      </button>
    </nav>
  );
}