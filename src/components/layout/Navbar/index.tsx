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
import styles from './styles.module.css';

export default function Navbar() {
  const pathname = usePathname();

  // --- TRAVA DE SEGURANÇA ---
  // Se estiver na área do cliente (/pedido), esconde essa navbar de admin!
  if (pathname.startsWith('/pedido')) {
    return null;
  }

  // Função para verificar ativo
  const isActive = (path: string) => {
    // Se for a Home (Dashboard de Pedidos), tem que ser exato
    if (path === '/') {
      return pathname === '/';
    }
    // Nas outras rotas, pode começar com o path
    return pathname.startsWith(path);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <h1>Painel <span style={{ color: 'var(--primary-color)' }}>Administrativo</span></h1>
      </div>

      <div className={styles.links}>
        {/* PEDIDOS (Home) */}
        <Link 
          href="/" 
          className={`${styles.link} ${isActive('/') ? styles.active : ''}`}
        >
          <ShoppingBag size={20} />
          <span>Pedidos</span>
        </Link>

        {/* PRODUTOS */}
        <Link 
          href="/products" 
          className={`${styles.link} ${isActive('/products') ? styles.active : ''}`}
        >
          <UtensilsCrossed size={20} />
          <span>Produtos</span>
        </Link>
        
        {/* FINANCEIRO */}
        <Link 
          href="/finance" 
          className={`${styles.link} ${isActive('/finance') ? styles.active : ''}`}
        >
          <DollarSign size={20} />
          <span>Financeiro</span>
        </Link>
        
        {/* CONFIGURAÇÕES */}
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