import { createClient } from '@supabase/supabase-js';
import CategoriaCliente from './CategoriaCliente';

/**
 * Casca de servidor da página de categoria.
 *
 * A tela em si é toda client (usa useParams e os hooks de produto), mas o
 * build do Electron roda com `output: 'export'`, e nesse modo o Next
 * recusa rota dinâmica sem `generateStaticParams()`. Como essa função não
 * pode ser exportada de um arquivo 'use client', a página virou este
 * componente de servidor com o conteúdo em CategoriaCliente.
 */

/**
 * Lista as categorias para o build estático.
 *
 * Só tem efeito no `output: 'export'` (Electron). No Railway, que roda em
 * standalone, dynamicParams continua ligado e qualquer id é renderizado
 * sob demanda — inclusive categoria criada depois do build.
 *
 * Falha aqui devolve lista vazia de propósito: um Supabase fora do ar, ou
 * um build sem as variáveis de ambiente, não pode derrubar o empacotamento
 * do app inteiro por causa de uma tela.
 */
export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return [];

  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.from('categories').select('id');

    if (error) throw error;

    return (data || []).map((c: { id: string | number }) => ({ id: String(c.id) }));
  } catch (e) {
    console.warn('[categoria] Não deu para listar as categorias no build:', e);
    return [];
  }
}

export default function CategoriaPage() {
  return <CategoriaCliente />;
}
