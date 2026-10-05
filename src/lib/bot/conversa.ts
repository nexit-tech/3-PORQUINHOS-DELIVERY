// src/lib/bot/conversa.ts
// Memória do atendente por telefone: o que foi dito e o que está no
// carrinho. Fica na tabela bot_conversas (migration 14).
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface Mensagem {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

export interface ItemCarrinho {
  productId: string;
  nome: string;
  quantidade: number;
  /** IDs das opções escolhidas. É com eles que o banco recalcula o preço. */
  optionIds: string[];
  /** "Metade 01: Calabresa" — o que sai no cupom da cozinha. */
  escolhas: string[];
  observacao: string;
  /** Só para mostrar ao cliente. Quem cobra é o create_order. */
  precoUnitario: number;
}

export interface Conversa {
  phone: string;
  nome: string | null;
  mensagens: Mensagem[];
  carrinho: ItemCarrinho[];
}

/** Quanto do histórico vai para o modelo. O resto fica no banco. */
const MAX_MENSAGENS = 30;

/**
 * Conversa parada por mais que isso começa do zero. O cliente que pediu
 * ontem não quer o carrinho de ontem, e um histórico velho só confunde.
 */
const HORAS_ATE_ESQUECER = 6;

export async function carregarConversa(phone: string): Promise<Conversa> {
  const { data, error } = await getSupabaseAdmin()
    .from('bot_conversas')
    .select('phone, nome, mensagens, carrinho, atualizado_em')
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw error;

  const vazia: Conversa = { phone, nome: data?.nome ?? null, mensagens: [], carrinho: [] };
  if (!data) return vazia;

  const parada = Date.now() - new Date(data.atualizado_em).getTime() > HORAS_ATE_ESQUECER * 3_600_000;
  if (parada) return vazia;

  return {
    phone,
    nome: data.nome,
    mensagens: (data.mensagens ?? []).slice(-MAX_MENSAGENS),
    carrinho: data.carrinho ?? [],
  };
}

export async function salvarConversa(conversa: Conversa) {
  const { error } = await getSupabaseAdmin()
    .from('bot_conversas')
    .upsert(
      {
        phone: conversa.phone,
        nome: conversa.nome,
        mensagens: conversa.mensagens.slice(-MAX_MENSAGENS),
        carrinho: conversa.carrinho,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'phone' }
    );

  if (error) throw error;
}
