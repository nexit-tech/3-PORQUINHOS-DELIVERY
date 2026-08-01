'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ticket, Check, Copy, ArrowLeft } from 'lucide-react';
import { supabase } from '@/services/supabase';
import NexitFooter from '@/components/client/NexitFooter';
import type { AvailableCoupon } from '@/types/coupon';
import styles from './page.module.css';

/**
 * Cupons da loja, para o cliente.
 *
 * Não confundir com /coupons, que é a tela do admin e fica atrás do
 * login. Aqui os dados vêm de list_available_coupons — a mesma RPC do
 * seletor no checkout, liberada para visitante.
 *
 * Subtotal 0 de propósito: nesta tela ainda não há carrinho, então
 * `qualifies` não faz sentido. Quem valida de verdade é o create_order.
 */
export default function CuponsPage() {
  const [cupons, setCupons] = useState<AvailableCoupon[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    supabase
      .rpc('list_available_coupons', { p_subtotal: 0, p_delivery_fee: 0 })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (!error && Array.isArray(data)) setCupons(data as AvailableCoupon[]);
        setCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  const copiar = async (codigo: string) => {
    let deuCerto = false;

    try {
      await navigator.clipboard.writeText(codigo);
      deuCerto = true;
    } catch {
      // A Clipboard API exige contexto seguro. Num domínio sem HTTPS ela
      // simplesmente não existe, e antes disso o toque não fazia nada:
      // a tela mandava tocar para copiar e nada acontecia. O caminho
      // antigo ainda funciona nesses casos.
      try {
        const campo = document.createElement('textarea');
        campo.value = codigo;
        campo.setAttribute('readonly', '');
        campo.style.position = 'fixed';
        campo.style.top = '-1000px';
        campo.style.opacity = '0';
        document.body.appendChild(campo);
        campo.select();
        deuCerto = document.execCommand('copy');
        document.body.removeChild(campo);
      } catch {
        deuCerto = false;
      }
    }

    // Só confirma o que realmente aconteceu: dizer "copiado" sem ter
    // copiado faria o cliente colar o cupom anterior no checkout.
    if (deuCerto) {
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 1800);
    }
  };

  const moeda = (v: number) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const rotulo = (c: AvailableCoupon) => {
    if (c.discount_type === 'FREE_DELIVERY') return 'Frete grátis';
    if (c.discount_type === 'PERCENT') return `${Math.round(c.discount_value)}%`;
    return moeda(c.discount_value);
  };

  const validade = (c: AvailableCoupon) => {
    if (!c.expires_at) return null;
    const d = new Date(c.expires_at);
    return `Vale até ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  };

  return (
    <main className={styles.container}>
      <div className={styles.coluna}>
        <header className={styles.topo}>
          <Link href="/pedido" className={styles.voltar} aria-label="Voltar ao cardápio">
            <ArrowLeft size={20} />
          </Link>
          <h1>Cupons</h1>
          <div style={{ width: 38 }} />
        </header>

        <div className={styles.conteudo}>
          {carregando ? (
            <div className={styles.lista}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.esqueleto} />
              ))}
            </div>
          ) : cupons.length === 0 ? (
            <div className={styles.vazio}>
              <div className={styles.vazioIcone}>
                <Ticket size={30} />
              </div>
              <strong>Nenhum cupom agora</strong>
              <p>Assim que a loja soltar uma promoção, ela aparece aqui.</p>
              <Link href="/pedido" className={styles.vazioBotao}>
                Ver o cardápio
              </Link>
            </div>
          ) : (
            <>
              <p className={styles.explica}>
                Toque para copiar o código e cole na hora de finalizar o pedido.
              </p>

              <div className={styles.lista}>
                {cupons.map((c) => {
                  const texto = rotulo(c);
                  const foiCopiado = copiado === c.code;

                  return (
                    <button
                      key={c.code}
                      className={`${styles.cupom} ${foiCopiado ? styles.cupomCopiado : ''}`}
                      onClick={() => copiar(c.code)}
                      aria-label={`Copiar o cupom ${c.code}`}
                    >
                      <span className={styles.selo}>
                        {/* "Frete grátis" e "R$ 10,00" não cabem no mesmo
                            corpo de "10%" sem estourar o canhoto. */}
                        <strong
                          className={`${styles.seloValor} ${texto.length > 5 ? styles.seloLongo : ''}`}
                        >
                          {texto}
                        </strong>
                        {c.discount_type !== 'FREE_DELIVERY' && <small>OFF</small>}
                      </span>

                      <span className={styles.corpo}>
                        <strong className={styles.codigo}>{c.code}</strong>
                        {c.description && <small className={styles.desc}>{c.description}</small>}
                        <span className={`${styles.regras} ${foiCopiado ? styles.regrasCopiado : ''}`}>
                          {foiCopiado
                            ? 'Código copiado!'
                            : (c.min_order_value > 0
                                ? `Acima de ${moeda(c.min_order_value)}`
                                : 'Sem valor mínimo')
                              + (validade(c) ? ` · ${validade(c)}` : '')}
                        </span>
                      </span>

                      <span className={`${styles.acao} ${foiCopiado ? styles.acaoCopiado : ''}`}>
                        {foiCopiado ? <Check size={17} /> : <Copy size={16} />}
                      </span>

                      <span className={`${styles.recorte} ${styles.recorteTopo}`} aria-hidden="true" />
                      <span className={`${styles.recorte} ${styles.recorteBase}`} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <NexitFooter />
        </div>
      </div>
    </main>
  );
}
