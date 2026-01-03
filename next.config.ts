import type { NextConfig } from "next";

const isElectron = process.env.IS_ELECTRON === 'true';

const nextConfig: NextConfig = {
  output: isElectron ? 'export' : undefined,

  // 🔥 DESABILITA VERIFICAÇÕES NO BUILD (Railway)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // Já estava, mas confirmando
  },

  images: {
    unoptimized: true,
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