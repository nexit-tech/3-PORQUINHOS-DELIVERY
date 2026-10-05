// src/lib/tempoEntrega.ts
// Prazo de entrega que a loja promete, em minutos. Configurado no painel
// (Configurações → Tempo de entrega) e guardado em bot_settings.
//
// É dele que saem o cronômetro da tela "Pedido realizado" e a previsão que
// vai na mensagem de WhatsApp.

export const TEMPO_ENTREGA_KEY = 'delivery_minutes';
export const TEMPO_ENTREGA_PADRAO = 40;

/** Aceita só um número de minutos que faça sentido; o resto vira o padrão. */
export function normalizarMinutos(valor: unknown): number {
  const minutos = Math.round(Number((valor as any)?.minutes ?? valor));
  if (!Number.isFinite(minutos) || minutos < 5 || minutos > 240) return TEMPO_ENTREGA_PADRAO;
  return minutos;
}

/** Horário em que o prazo vence: "20:45". */
export function previsaoDeEntrega(inicio: string | Date, minutos: number): string {
  const fim = new Date(new Date(inicio).getTime() + minutos * 60_000);
  return fim.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}
