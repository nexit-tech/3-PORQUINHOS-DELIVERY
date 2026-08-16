import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Login do painel. A tela pede só a senha: não há campo de usuário.
 *
 * O e-mail sai do .env (ADMIN_EMAIL) — é por isso que a tela não precisa
 * perguntar. A senha digitada vai para o Supabase Auth, que é quem valida.
 *
 * Por que quem valida é o Supabase e não uma comparação com ADMIN_PASSWORD:
 * o painel só funciona com uma sessão de verdade (com a RLS ligada, sem sessão
 * o banco devolve vazio para tudo e a tela abre em branco), e quem emite essa
 * sessão é o Supabase. Se o servidor conferisse a senha contra o .env, passaria
 * a existir a mesma senha em três lugares — .env, variáveis do Railway e
 * Supabase — e bastaria um deles ficar para trás para o login parar. Foi
 * exatamente isso que aconteceu em 16/08/2026: o Railway tinha uma senha antiga
 * e ninguém entrava. Com um dono só da verdade, isso não se repete.
 *
 * ADMIN_PASSWORD continua no .env porque o app desktop usa: lá não há tela de
 * login, o Electron entra sozinho.
 *
 * Rodar isto no servidor, e não no navegador, tem um segundo motivo: a chamada
 * do supabase-js no navegador usa uma trava compartilhada entre abas, e quando
 * ela fica presa o login trava em "Entrando..." para sempre, sem erro nenhum.
 * Do lado do servidor esse problema não existe.
 */

// Sem isso a rota vira estática no build e o e-mail do .env fica congelado nela
export const dynamic = 'force-dynamic';

// Trava simples de força bruta, por processo, que zera no restart. Não
// substitui um rate limit na frente do app — o Supabase também tem o dele,
// mas esta responde antes e sem custo de rede.
const JANELA_MS = 5 * 60 * 1000;
const MAX_TENTATIVAS = 10;
const tentativas = new Map<string, { erros: number; desde: number }>();

function excedeuTentativas(ip: string) {
  const registro = tentativas.get(ip);

  if (!registro || Date.now() - registro.desde > JANELA_MS) return false;
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

export async function POST(request: Request) {
  const email = process.env.ADMIN_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !supabaseUrl || !supabaseKey) {
    console.error(
      '[Login] Faltam variáveis de ambiente: ADMIN_EMAIL, ' +
        'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.'
    );
    return NextResponse.json(
      { ok: false, message: 'Servidor sem as variáveis de ambiente. Veja o log.' },
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

  if (!senha) {
    return NextResponse.json({ ok: false, message: 'Digite a senha.' }, { status: 400 });
  }

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

  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    registrarErro(ip);

    // "Email not confirmed" não é senha errada: é o usuário criado sem o
    // Auto Confirm, num projeto sem SMTP. Dizer "senha incorreta" aí manda a
    // pessoa procurar no lugar errado.
    const mensagem =
      error.message === 'Invalid login credentials'
        ? 'Senha incorreta'
        : `Supabase recusou: ${error.message}`;

    return NextResponse.json({ ok: false, message: mensagem }, { status: 401 });
  }

  tentativas.delete(ip);

  return NextResponse.json({ ok: true });
}
