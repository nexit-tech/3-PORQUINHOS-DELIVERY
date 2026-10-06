// src/lib/bot/configServidor.ts
// Lê a configuração do atendente (config.ts) do banco, no servidor.
// Cache curto: uma conversa movimentada não precisa reler a cada mensagem,
// e uma mudança no painel vale em no máximo 15s.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  IA_KEYS,
  normalizarConfig,
  normalizarFaq,
  normalizarMidias,
  normalizarTeste,
  type ConfigIA,
  type ModoTeste,
  type Midia,
  type PerguntaResposta,
} from './config';

export interface IA {
  config: ConfigIA;
  faq: PerguntaResposta[];
  midias: Midia[];
  teste: ModoTeste;
}

const VALIDADE_MS = 15_000;
let cache: { em: number; ia: IA } | null = null;

export async function carregarIA(): Promise<IA> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.ia;

  const { data, error } = await getSupabaseAdmin()
    .from('bot_settings')
    .select('key, value')
    .in('key', [IA_KEYS.CONFIG, IA_KEYS.FAQ, IA_KEYS.MIDIAS, IA_KEYS.TESTE]);

  if (error) throw error;

  const valor = (key: string) => data?.find((r) => r.key === key)?.value;
  const ia: IA = {
    config: normalizarConfig(valor(IA_KEYS.CONFIG)),
    faq: normalizarFaq(valor(IA_KEYS.FAQ)),
    midias: normalizarMidias(valor(IA_KEYS.MIDIAS)),
    teste: normalizarTeste(valor(IA_KEYS.TESTE)),
  };

  cache = { em: Date.now(), ia };
  return ia;
}
