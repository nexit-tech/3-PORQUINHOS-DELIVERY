// src/lib/whatsapp/authState.ts
// Onde a sessão do WhatsApp fica guardada: na tabela whatsapp_auth.
//
// É a mesma coisa que o useMultiFileAuthState do Baileys faz em disco, só que
// no Supabase. Em disco não serve: o Railway apaga o sistema de arquivos a
// cada deploy, e a loja teria que ler o QR Code de novo toda vez.
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from 'baileys';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Baileys = typeof import('baileys');

const TABELA = 'whatsapp_auth';

export async function carregarSessao(baileys: Baileys, session: string) {
  const { BufferJSON, initAuthCreds, proto } = baileys;
  const db = getSupabaseAdmin();

  // O jsonb não guarda Buffer: o replacer vira { type: 'Buffer', data } e o
  // reviver desfaz. Ida e volta por string para passar pelos dois.
  const serializar = (valor: unknown) => JSON.parse(JSON.stringify(valor, BufferJSON.replacer));
  const desserializar = (valor: unknown) => JSON.parse(JSON.stringify(valor), BufferJSON.reviver);

  const ler = async (ids: string[]): Promise<Map<string, any>> => {
    const resultado = new Map<string, any>();
    if (ids.length === 0) return resultado;

    const { data, error } = await db
      .from(TABELA)
      .select('id, value')
      .eq('session', session)
      .in('id', ids);

    if (error) throw error;

    for (const linha of data ?? []) resultado.set(linha.id, desserializar(linha.value));
    return resultado;
  };

  const linhaCreds = (await ler(['creds'])).get('creds');
  const creds: AuthenticationCreds = linhaCreds ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const chaves = ids.map((id) => `${type}-${id}`);
        const encontrados = await ler(chaves);

        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const id of ids) {
          let valor = encontrados.get(`${type}-${id}`);
          if (type === 'app-state-sync-key' && valor) {
            valor = proto.Message.AppStateSyncKeyData.fromObject(valor);
          }
          data[id] = valor;
        }
        return data;
      },

      set: async (data) => {
        const gravar: { session: string; id: string; value: unknown; updated_at: string }[] = [];
        const apagar: string[] = [];
        const agora = new Date().toISOString();

        for (const categoria in data) {
          const itens = (data as any)[categoria] as Record<string, unknown>;
          for (const id in itens) {
            const chave = `${categoria}-${id}`;
            const valor = itens[id];
            if (valor) gravar.push({ session, id: chave, value: serializar(valor), updated_at: agora });
            else apagar.push(chave);
          }
        }

        if (gravar.length > 0) {
          const { error } = await db.from(TABELA).upsert(gravar, { onConflict: 'session,id' });
          if (error) throw error;
        }

        if (apagar.length > 0) {
          const { error } = await db.from(TABELA).delete().eq('session', session).in('id', apagar);
          if (error) throw error;
        }
      },
    },
  };

  const saveCreds = async () => {
    const { error } = await db
      .from(TABELA)
      .upsert(
        { session, id: 'creds', value: serializar(creds), updated_at: new Date().toISOString() },
        { onConflict: 'session,id' }
      );
    if (error) throw error;
  };

  return { state, saveCreds };
}

/** Desconectar de verdade: sem apagar, o próximo start tentaria as chaves velhas. */
export async function apagarSessao(session: string) {
  const { error } = await getSupabaseAdmin().from(TABELA).delete().eq('session', session);
  if (error) throw error;
}
