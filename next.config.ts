const nextConfig = {
  output: 'export', // Gera a pasta "out" com HTML estático
  images: {
    unoptimized: true, // Obrigatório: desliga a otimização de imagem do Next.js
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
  // ❌ REMOVIDO: eslint (não é mais suportado aqui)
  typescript: {
    ignoreBuildErrors: true, // Mantido para acelerar o build
  },
};

export default nextConfig;