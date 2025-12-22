import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Navbar from '@/components/layout/Navbar'; // <--- Importe aqui
import './globals.css';

const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-montserrat'
});

export const metadata: Metadata = {
  title: 'AnotaAI Clone',
  description: 'Gestão de Delivery',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={montserrat.className}>
        <Navbar /> {/* <--- Adicione aqui antes do children */}
        {children}
      </body>
    </html>
  );
}