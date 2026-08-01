'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Flame, Plus, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/services/supabase';
import styles from './styles.module.css';

interface TopProduto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  vendidos: number;
}

/**
 * Vitrine das mais vendidas.
 *
 * UM card só, no lugar fixo, trocando de conteúdo por fade a cada 3s —
 * não é carrossel que desliza. Os itens ficam empilhados no mesmo espaço
 * e só um aparece por vez.
 *
 * O ranking vem da RPC top_produtos, que devolve só o agregado (ver
 * supabase/11-mais-vendidos.sql). Se a loja ainda não vendeu nada, a
 * seção não aparece — nenhum número é inventado.
 */
export default function MaisVendidas({
  onEscolher,
}: {
  onEscolher: (produtoId: string) => void;
}) {
  const [itens, setItens] = useState<TopProduto[]>([]);
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const retomarRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;

    supabase.rpc('top_produtos', { p_limite: 3 }).then(({ data, error }) => {
      if (!vivo || error || !Array.isArray(data)) return;
      setItens(data as TopProduto[]);
    });

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (itens.length < 2 || pausado) return;

    // Quem pediu menos animação no sistema não recebe troca sozinha.
    const menosMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (menosMovimento) return;

    const t = setInterval(() => {
      setAtual((i) => (i + 1) % itens.length);
    }, 3000);

    return () => clearInterval(t);
  }, [itens.length, pausado]);

  // Limpa o timer de retomada ao desmontar, senão ele dispara depois do
  // componente sair e o React reclama de setState em nada.
  useEffect(() => {
    return () => {
      if (retomarRef.current) clearTimeout(retomarRef.current);
    };
  }, []);

  /** Ao escolher na mão, segura a troca automática por um tempo. */
  const irPara = (i: number) => {
    setAtual(i);
    setPausado(true);
    if (retomarRef.current) clearTimeout(retomarRef.current);
    retomarRef.current = setTimeout(() => setPausado(false), 8000);
  };

  if (itens.length === 0) return null;

  const moeda = (v: number) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <section className={styles.secao} aria-label="Mais vendidas">
      <div className={styles.cabecalho}>
        <h2>
          Mais vendidas <Flame size={16} />
        </h2>

        <div className={styles.pontos}>
          {itens.map((_, i) => (
            <button
              key={i}
              className={`${styles.ponto} ${i === atual ? styles.pontoAtivo : ''}`}
              onClick={() => irPara(i)}
              aria-label={`Ver item ${i + 1} de ${itens.length}`}
            />
          ))}
        </div>
      </div>

      {/* Palco de altura fixa. Os cards ficam empilhados aqui dentro e
          apenas o da vez fica visível — é isso que faz a troca ser um
          fade no lugar, e não um deslizamento. */}
      <div className={styles.palco}>
        {itens.map((p, i) => {
          const visivel = i === atual;

          return (
            <article
              key={p.id}
              className={`${styles.card} ${visivel ? styles.visivel : ''}`}
              onClick={() => visivel && onEscolher(p.id)}
              role="button"
              tabIndex={visivel ? 0 : -1}
              aria-hidden={!visivel}
              onKeyDown={(e) => {
                if (visivel && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onEscolher(p.id);
                }
              }}
            >
              {p.image_url ? (
                <Image
                  src={p.image_url}
                  alt={p.name}
                  fill
                  sizes="(max-width: 700px) 100vw, 640px"
                  className={styles.foto}
                  priority={i === 0}
                  quality={80}
                />
              ) : (
                <div className={styles.semFoto}>
                  <UtensilsCrossed size={32} />
                </div>
              )}

              <span className={styles.veu} aria-hidden="true" />

              {i === 0 && <span className={styles.coroa}>Nº 1 da casa</span>}

              <div className={styles.conteudo}>
                <h3 className={styles.nome}>{p.name}</h3>
                <div className={styles.base}>
                  <span className={styles.preco}>{moeda(p.price)}</span>
                  <span className={styles.botao}>
                    <Plus size={16} strokeWidth={2.8} />
                    Adicionar
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
