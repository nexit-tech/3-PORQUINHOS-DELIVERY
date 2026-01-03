import type { NextConfig } from "next";

// Verifica se estamos construindo para Electron
const isElectron = process.env.IS_ELECTRON === 'true';

const nextConfig: NextConfig = {
  // Se for Electron, usa 'export' (HTML estático). 
  // Se for Railway/Web, usa 'undefined' (Servidor Node.js padrão com suporte a API).
  output: isElectron ? 'export' : undefined,

  images: {
    unoptimized: true, // Mantém true para evitar custos/erros de processamento de imagem
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'nathan-supabase-3-porquinhos.7rdajt.easypanel.host',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Adiciona cabeçalhos para permitir acesso CORS na API se necessário
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;