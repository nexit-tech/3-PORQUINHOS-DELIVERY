import type { Metadata } from "next";
import BottomNav from "@/components/client/BottomNav";
import { CartProvider } from "@/context/CartContext"; // Importe o Provider criado

export const metadata: Metadata = {
  title: "3 Porquinhos - Pedido",
  description: "Faça seu pedido",
};

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider> {/* ENVOLVENDO AQUI */}
      <div style={{ paddingBottom: '80px', minHeight: '100vh', background: 'var(--background)' }}>
        {children}
        <BottomNav />
      </div>
    </CartProvider>
  );
}