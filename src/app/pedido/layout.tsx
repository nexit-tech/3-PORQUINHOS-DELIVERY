import type { Metadata } from "next";
import BottomNav from "@/components/client/BottomNav";
import { CartProvider } from "@/context/CartContext";
import "./loja.css";

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
    <CartProvider>
      {/* A classe .loja carrega os tokens visuais da loja (ver loja.css).
          O painel admin não passa por aqui e segue com as variáveis
          antigas do globals.css. */}
      <div className="loja">
        {children}
        <BottomNav />
      </div>
    </CartProvider>
  );
}
