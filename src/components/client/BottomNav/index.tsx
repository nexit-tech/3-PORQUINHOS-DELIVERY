'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, ClipboardList, Ticket } from 'lucide-react';
import styles from './styles.module.css';
import { useCart } from '@/context/CartContext'; // Opcional: Para mostrar badge do carrinho

export default function BottomNav() {
  const pathname = usePathname();
  const { cartCount } = useCart(); // Se quiser mostrar o contador

  // --- ROTAS ONDE A NAVBAR DEVE SUMIR ---
  // Checkout (Endereço e Pagamento) já tem seus próprios rodapés
  // O carrinho entrou aqui: ele já tem rodapé próprio com o total e o
  // botão de confirmar. Duas barras empilhadas no pé da tela competiam
  // pela atenção e a nav ainda tapava o último item da lista.
  const hiddenRoutes = [
    '/pedido/checkout/endereco',
    '/pedido/checkout/pagamento'
  ];

  // No carrinho a nav só some quando HÁ itens: aí o rodapé de confirmar
  // assume o pé da tela e duas barras competiriam. Com o carrinho vazio
  // não existe rodapé nenhum, e sem a nav o cliente ficaria numa tela
  // sem saída a não ser um único botão.
  const noCarrinho = pathname.includes('/pedido/carrinho');
  if (noCarrinho && cartCount > 0) return null;

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

      <Link href="/pedido/cupons" className={`${styles.navItem} ${isActive('/pedido/cupons') ? styles.active : ''}`}>
        <Ticket size={24} />
        <span>Cupons</span>
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