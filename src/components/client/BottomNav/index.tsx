'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, ClipboardList } from 'lucide-react';
import styles from './styles.module.css';
import { useCart } from '@/context/CartContext'; // Opcional: Para mostrar badge do carrinho

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount } = useCart(); // Se quiser mostrar o contador

  // --- ROTAS ONDE A NAVBAR DEVE SUMIR ---
  // Checkout (Endereço e Pagamento) já tem seus próprios rodapés
  const hiddenRoutes = [
    '/pedido/checkout/endereco',
    '/pedido/checkout/pagamento'
  ];

  // Se a rota atual incluir qualquer uma das rotas proibidas, não renderiza nada
  if (hiddenRoutes.some(route => pathname.includes(route))) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <nav className={styles.navbar}>
      <Link href="/pedido" className={`${styles.navItem} ${isActive('/pedido') ? styles.active : ''}`}>
        <Home size={24} />
        <span>Início</span>
      </Link>

      <Link href="/pedido/historico" className={`${styles.navItem} ${isActive('/pedido/historico') ? styles.active : ''}`}>
        <ClipboardList size={24} />
        <span>Pedidos</span>
      </Link>

      <Link href="/pedido/carrinho" className={`${styles.navItem} ${isActive('/pedido/carrinho') ? styles.active : ''}`}>
        <div className={styles.cartIconWrapper}>
          <ShoppingBag size={24} />
          {/* Badge de contador (Opcional, mas fica legal) */}
          {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
        </div>
        <span>Carrinho</span>
      </Link>
    </nav>
  );
}