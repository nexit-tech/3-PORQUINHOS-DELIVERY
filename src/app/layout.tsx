import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Navbar from '@/components/layout/Navbar';
import { AuthProvider } from '@/context/AuthContext'; // 🔥 NOVO
import './globals.css';

const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-montserrat'
});

export const metadata: Metadata = {
  title: '3 porquinhos - Gestão de Delivery',
  description: 'Gestão de Delivery 3 porquinhos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={montserrat.className}>
        <AuthProvider> {/* 🔥 ENVOLVE TUDO */}
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}