// src/lib/bot/loja.ts
// O que o atendente sabe sobre a loja: cardápio, bairros e horário.
// Tudo lido do banco a cada resposta — preço mudado no painel vale na hora.
//
// Produtos e opções ganham códigos curtos (P3, P3.2.5) em vez do UUID. O
// modelo copia "P3.2.5" sem errar; um UUID de 36 caracteres ele às vezes
// troca uma letra, e o pedido falha. O código só vale dentro da mesma
// leitura: o carrinho guarda os UUIDs, nunca os códigos.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  DAY_KEYS,
  DAY_LABELS,
  getNextOpening,
  isStoreOpen,
  type DayHours,
} from '@/lib/storeHours';

export interface Opcao {
  codigo: string;
  id: string;
  nome: string;
  preco: number;
}

export interface Grupo {
  codigo: string;
  id: string;
  nome: string;
  min: number;
  max: number;
  opcoes: Opcao[];
}

export interface Produto {
  codigo: string;
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  grupos: Grupo[];
}

export interface Bairro {
  nome: string;
  taxa: number;
}

export interface Loja {
  produtos: Produto[];
  bairros: Bairro[];
  aberta: boolean;
  horarios: DayHours[];
}

const ordem = (a: any, b: any) =>
  (a?.order ?? 0) - (b?.order ?? 0) || String(a?.name ?? '').localeCompare(String(b?.name ?? ''));

export async function carregarLoja(): Promise<Loja> {
  const db = getSupabaseAdmin();

  const [produtos, categorias, vinculos, grupos, opcoes, zonas, horarios] = await Promise.all([
    db.from('products').select('id, category_id, name, description, price, active, order'),
    db.from('categories').select('id, name, order'),
    db.from('product_complements').select('product_id, group_id'),
    db.from('complement_groups').select('id, name, min_selection, max_selection'),
    db.from('complement_options').select('id, group_id, name, price, is_active'),
    db.from('delivery_zones').select('neighborhood, fee, active'),
    db.from('store_settings').select('day_of_week, is_open, open_time, close_time'),
  ]);

  for (const r of [produtos, categorias, vinculos, grupos, opcoes, zonas, horarios]) {
    if (r.error) throw r.error;
  }

  const categoriaPorId = new Map((categorias.data ?? []).map((c) => [c.id, c]));
  const grupoPorId = new Map((grupos.data ?? []).map((g) => [g.id, g]));

  const listaProdutos = (produtos.data ?? [])
    .filter((p) => p.active !== false)
    .sort((a, b) => {
      const ca = categoriaPorId.get(a.category_id);
      const cb = categoriaPorId.get(b.category_id);
      return ordem(ca, cb) || ordem(a, b) || String(a.id).localeCompare(String(b.id));
    })
    .map((p, i): Produto => {
      const codigo = `P${i + 1}`;
      const gruposDoProduto = (vinculos.data ?? [])
        .filter((v) => v.product_id === p.id)
        .map((v) => grupoPorId.get(v.group_id))
        .filter(Boolean)
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'pt-BR', { numeric: true }))
        .map((g: any, gi): Grupo => {
          const codigoGrupo = `${codigo}.${gi + 1}`;
          return {
            codigo: codigoGrupo,
            id: g.id,
            nome: g.name,
            min: g.min_selection ?? 0,
            max: g.max_selection ?? 1,
            opcoes: (opcoes.data ?? [])
              .filter((o) => o.group_id === g.id && o.is_active !== false)
              .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'))
              .map((o, oi) => ({
                codigo: `${codigoGrupo}.${oi + 1}`,
                id: o.id,
                nome: o.name,
                preco: Number(o.price) || 0,
              })),
          };
        });

      return {
        codigo,
        id: p.id,
        nome: p.name,
        descricao: p.description || '',
        preco: Number(p.price),
        categoria: categoriaPorId.get(p.category_id)?.name || 'Outros',
        grupos: gruposDoProduto,
      };
    });

  const listaHorarios = (horarios.data ?? []) as DayHours[];

  return {
    produtos: listaProdutos,
    bairros: (zonas.data ?? [])
      .filter((z) => z.active !== false)
      .map((z) => ({ nome: z.neighborhood, taxa: Number(z.fee) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    aberta: listaHorarios.length > 0 && isStoreOpen(listaHorarios),
    horarios: listaHorarios,
  };
}

export const moeda = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Sem acento, minúsculo, sem espaço sobrando: "Jacaré " == "jacare". */
export const normalizar = (texto: string) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * O create_order compara o bairro com o texto exato do banco, e alguns estão
 * cadastrados com espaço no fim ("Jacaré "). Aqui o que o cliente escreveu
 * vira o nome exato.
 */
export function acharBairro(loja: Loja, texto: string): Bairro | null {
  const alvo = normalizar(texto);
  if (!alvo) return null;
  return (
    loja.bairros.find((b) => normalizar(b.nome) === alvo) ??
    loja.bairros.find((b) => normalizar(b.nome).includes(alvo) || alvo.includes(normalizar(b.nome))) ??
    null
  );
}

export function textoHorarios(loja: Loja): string {
  const linhas = DAY_KEYS.map((dia) => {
    const d = loja.horarios.find((h) => h.day_of_week === dia);
    if (!d?.is_open) return `${DAY_LABELS[dia]}: fechado`;
    return `${DAY_LABELS[dia]}: ${(d.open_time || '').slice(0, 5)} às ${(d.close_time || '').slice(0, 5)}`;
  });

  if (!loja.aberta) {
    const proxima = getNextOpening(loja.horarios);
    if (proxima) linhas.push(`Próxima abertura: ${DAY_LABELS[proxima.dayKey]} às ${proxima.openTime}`);
  }

  return linhas.join('\n');
}

/** Cardápio em texto para o prompt. Opções aparecem no ver_opcoes. */
export function textoCardapio(loja: Loja): string {
  const porCategoria = new Map<string, Produto[]>();
  for (const p of loja.produtos) {
    porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), p]);
  }

  return [...porCategoria.entries()]
    .map(([categoria, produtos]) =>
      [
        `## ${categoria}`,
        ...produtos.map((p) => {
          const escolhas = p.grupos.length
            ? ` — escolhas: ${p.grupos.map((g) => `${g.nome} (${g.min === 0 ? 'opcional' : 'obrigatório'})`).join('; ')}`
            : '';
          const descricao = p.descricao ? ` — ${p.descricao}` : '';
          return `- ${p.codigo}: ${p.nome} — ${moeda(p.preco)}${descricao}${escolhas}`;
        }),
      ].join('\n')
    )
    .join('\n\n');
}

export function acharProduto(loja: Loja, codigo: string): Produto | undefined {
  const c = String(codigo || '').trim().toUpperCase();
  return loja.produtos.find((p) => p.codigo === c) ?? loja.produtos.find((p) => p.id === codigo);
}
