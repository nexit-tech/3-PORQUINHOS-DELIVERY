// src/lib/apiAuth.ts
// Proteção dos endpoints que não são chamados pelo navegador.
//
// Antes, /api/webhook e /api/cron/auto-unpause eram totalmente abertos:
// qualquer pessoa que soubesse a URL podia pausar o bot de qualquer número,
// encher a tela de notificações ou disparar o cron à vontade.

import { NextResponse } from 'next/server';

/** Comparação em tempo constante, para não vazar o segredo por timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Extrai o segredo enviado na requisição.
 * Aceita `Authorization: Bearer <segredo>`, o header `x-webhook-secret`
 * (mais fácil de configurar na Evolution API) ou `?secret=` na query.
 */
function extractSecret(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);

  const custom = request.headers.get('x-webhook-secret');
  if (custom) return custom;

  const url = new URL(request.url);
  return url.searchParams.get('secret');
}

/**
 * Devolve uma NextResponse 401 quando a requisição não está autorizada,
 * ou `null` quando pode seguir.
 *
 * Se a variável de ambiente não estiver definida, deixa passar e avisa no log
 * — assim ninguém fica com o bot fora do ar por ter esquecido de configurar.
 */
export function requireSecret(request: Request, envVar: string): NextResponse | null {
  const expected = process.env[envVar];

  if (!expected) {
    console.warn(
      `⚠️ ${envVar} não está configurada. Este endpoint está ABERTO. Defina a variável no .env.`
    );
    return null;
  }

  const provided = extractSecret(request);

  if (!provided || !safeEqual(provided, expected)) {
    console.warn(`🚫 Requisição bloqueada: segredo inválido (${envVar})`);
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }

  return null;
}
