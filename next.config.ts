import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔥 MUDANÇA PRINCIPAL: De 'export' para 'standalone'
  // Isso permite que APIs e Cron Jobs funcionem no Railway
  output: 'standalone',
  
  // ❌ REMOVIDO: distDir: 'out' (não é usado no modo standalone)

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'nathan-supabase-3-porquinhos.7rdajt.easypanel.host' },
    ],
  },
};

export default nextConfig;