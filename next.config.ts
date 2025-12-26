const nextConfig = {
  output: 'export', // Gera a pasta "out" com HTML estático
  images: {
    unoptimized: true, // Obrigatório: desliga a otimização de imagem do Next.js (que precisa de servidor)
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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;