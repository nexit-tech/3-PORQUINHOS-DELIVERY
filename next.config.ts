import type { NextConfig } from "next";

// ✅ A variável decide sozinha se é App ou Site
const isElectron = process.env.IS_ELECTRON === 'true';

const nextConfig: NextConfig = {
  // Se for Electron, gera estático (pasta out). Se for Site, gera dinâmico.
  output: isElectron ? 'export' : undefined,

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