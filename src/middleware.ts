import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Proteção real do painel: quem valida a sessão é o servidor, lendo o cookie
// do Supabase Auth. Antes a única barreira era um redirect no navegador, e o
// "token" era a string 'authenticated' gravada no localStorage.
//
// Este arquivo é removido durante o build do Electron (build-electron.js),
// porque middleware não é compatível com output: 'export'. Lá o app roda na
// máquina do balcão e faz login sozinho com as credenciais do .env.

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem as variáveis, createServerClient lança e TODA página vira erro 500 —
  // inclusive a de login, deixando o painel inacessível sem explicação.
  if (!supabaseUrl || !supabaseKey) {
    console.error('🚨 Middleware: variáveis do Supabase ausentes. Painel liberado sem checagem.');
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // O Supabase renova o token sozinho; é preciso repassar os cookies
          // novos tanto para a request quanto para a response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return response;

  const { pathname } = request.nextUrl;

  // Rotas de API respondem 401; páginas vão para o login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/',
    '/products/:path*',
    '/finance/:path*',
    '/settings/:path*',
    '/notifications/:path*',
    // /api/evolution envia mensagem de WhatsApp para qualquer número:
    // estava aberto para a internet inteira
    '/api/evolution/:path*',
  ],
};
