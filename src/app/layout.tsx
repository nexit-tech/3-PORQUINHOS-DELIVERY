import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Navbar from '@/components/layout/Navbar';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
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
      <head>
        {/* Precisa ser síncrono mesmo: no Electron o server.js gera este arquivo
            em memória e o Supabase lê window.__RUNTIME_CONFIG__ na primeira
            renderização. Com defer/async, a config chegaria tarde demais. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/runtime-config.js" />
      </head>
      <body className={montserrat.className}>
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
        {/* Sem isso os toast.success/error do painel não renderizam em lugar nenhum */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontFamily: 'inherit', fontSize: '0.9rem' },
          }}
        />
      </body>
    </html>
  );
}