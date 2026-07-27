import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔥 MUDANÇA PRINCIPAL: De 'export' para 'standalone'
  // Isso permite que APIs e Cron Jobs funcionem no Railway
  output: 'standalone',
  
  // ❌ REMOVIDO: distDir: 'out' (não é usado no modo standalone)

  // Lint continua fora do build (não vale travar deploy por warning),
  // mas roda com `npm run lint`.
  eslint: { ignoreDuringBuilds: true },

  // Antes era `ignoreBuildErrors: true`: erro de tipo passava direto para
  // produção. O projeto está com `tsc --noEmit` limpo, então dá para exigir.
  typescript: { ignoreBuildErrors: false },
  
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'nathan-supabase-3-porquinhos.7rdajt.easypanel.host' },
    ],
  },
};

export default nextConfig;