import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { timingSafeEqual } from 'node:crypto';

/**
 * Login do painel: a tela pede só a senha, e ela é a ADMIN_PASSWORD do .env.
 *
 * A conferência é feita aqui, no servidor, porque o navegador não enxerga o
 * .env: variável sem o prefixo NEXT_PUBLIC_ não entra no bundle — e se
 * entrasse, a senha estaria à vista no código-fonte da página.
 *
 * Conferida a senha, o servidor abre uma sessão de verdade no Supabase Auth
 * com ADMIN_EMAIL/ADMIN_PASSWORD e grava os cookies dela na resposta. Essa
 * parte não é enfeite: desde que a RLS foi ligada, sem sessão o banco devolve
 * vazio para tudo (pedidos, produtos, financeiro) e o painel abre em branco.
 * É o mesmo caminho que o app desktop já faz sozinho.
 */

// Sem isso a rota vira estática no build e a senha do .env fica congelada
// dentro dela.
export const dynamic = 'force-dynamic';

// Trava simples de força bruta. A rota é pública (o middleware não pode
// protegê-la, é ela que dá acesso) e a senha do .env não passa pelo limite de
// tentativas do Supabase. É por processo e some no restart — não substitui um
// rate limit de verdade na frente do app, mas evita o caso óbvio.
const JANELA_MS = 5 * 60 * 1000;
const MAX_TENTATIVAS = 10;
const tentativas = new Map<string, { erros: number; desde: number }>();

function excedeuTentativas(ip: string) {
  const agora = Date.now();
  const registro = tentativas.get(ip);

  if (!registro || agora - registro.desde > JANELA_MS) return false;
  return registro.erros >= MAX_TENTATIVAS;
}

function registrarErro(ip: string) {
  const agora = Date.now();
  const registro = tentativas.get(ip);

  if (!registro || agora - registro.desde > JANELA_MS) {
    tentativas.set(ip, { erros: 1, desde: agora });
    return;
  }

  registro.erros += 1;
}

function senhaConfere(digitada: string, esperada: string) {
  const a = Buffer.from(digitada, 'utf8');
  const b = Buffer.from(esperada, 'utf8');

  // timingSafeEqual joga se os tamanhos diferem, então compara antes
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const senhaEsperada = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!senhaEsperada || !email || !supabaseUrl || !supabaseKey) {
    console.error(
      '[Login] .env incompleto. Precisa de ADMIN_EMAIL, ADMIN_PASSWORD, ' +
        'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
    return NextResponse.json(
      { ok: false, message: 'Servidor sem as variáveis do .env. Veja o log.' },
      { status: 500 }
    );
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'desconhecido';

  if (excedeuTentativas(ip)) {
    return NextResponse.json(
      { ok: false, message: 'Muitas tentativas. Espere 5 minutos.' },
      { status: 429 }
    );
  }

  let senha = '';
  try {
    const body = await request.json();
    senha = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ ok: false, message: 'Requisição inválida.' }, { status: 400 });
  }

  if (!senha || !senhaConfere(senha, senhaEsperada)) {
    registrarErro(ip);
    return NextResponse.json({ ok: false, message: 'Senha incorreta' }, { status: 401 });
  }

  // Senha do .env confere. Agora a sessão de verdade, para a RLS liberar.
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password: senhaEsperada });

  if (error) {
    // A senha bateu com o .env mas o Supabase recusou: o usuário do Auth está
    // com outra senha, ou não existe. Sem isso o painel entraria e abriria
    // vazio, o que é bem pior de diagnosticar.
    console.error('[Login] .env ok, mas o Supabase Auth recusou:', error.message);
    return NextResponse.json(
      {
        ok: false,
        message:
          'A senha do .env não abre o usuário no Supabase Auth. ' +
          'Confira ADMIN_EMAIL/ADMIN_PASSWORD e o usuário em Authentication -> Users.',
      },
      { status: 500 }
    );
  }

  tentativas.delete(ip);

  return NextResponse.json({ ok: true });
}
