'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ExternalLink, MessageCircle } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useTempoEntrega } from '@/hooks/useTempoEntrega';
import CronometroEntrega from '@/components/client/CronometroEntrega';
import { whatsappLink } from '@/config/store';
import styles from './page.module.css';

const ETAPAS = [
  { status: 'PENDING', label: 'Recebido' },
  { status: 'PREPARING', label: 'Em preparo' },
  { status: 'DELIVERING', label: 'A caminho' },
  { status: 'COMPLETED', label: 'Entregue' },
];

const ETAPAS_RETIRADA = [
  { status: 'PENDING', label: 'Recebido' },
  { status: 'PREPARING', label: 'Em preparo' },
  { status: 'DELIVERING', label: 'Pronto' },
  { status: 'COMPLETED', label: 'Retirado' },
];

/**
 * Tela que o cliente vê assim que fecha o pedido (dinheiro) ou o pagamento
 * online confirma. Fica aberta acompanhando: o status e o cronômetro se
 * atualizam sozinhos.
 */
function Confirmado() {
  const params = useSearchParams();
  const id = Number(params.get('id'));
  const comprovante = params.get('comprovante');

  const minutos = useTempoEntrega();
  const { orders } = useOrders();
  const pedido = orders.find((o) => o.id === id);

  // Enquanto a lista não chega, o cronômetro conta da hora em que a tela
  // abriu — o pedido acabou de nascer, a diferença é de segundos.
  const [abertoEm] = useState(() => new Date().toISOString());
  const inicio = pedido?.placedAt ?? abertoEm;

  const retirada = (pedido?.customerAddress ?? '').toUpperCase().includes('RETIRADA');
  const etapas = retirada ? ETAPAS_RETIRADA : ETAPAS;
  const status = pedido?.status ?? 'PENDING';
  const etapaAtual = Math.max(0, etapas.findIndex((e) => e.status === status));
  const cancelado = status === 'CANCELED';

  const ajuda = useMemo(
    () => whatsappLink(`Oi! Preciso de ajuda com o pedido ${id || ''}`.trim()),
    [id]
  );

  return (
    <main className={styles.container}>
      <section className={`${styles.hero} ${cancelado ? styles.heroCancelado : ''}`}>
        <div className={styles.selo} aria-hidden="true">
          <Check size={44} strokeWidth={3.5} />
        </div>
        <h1 className={styles.titulo}>
          {cancelado ? 'Pedido cancelado' : (<>Pedido<br />realizado!</>)}
        </h1>
        {id > 0 && <p className={styles.numero}>Pedido #{id}</p>}
      </section>

      <section className={styles.conteudo}>
        {cancelado ? (
          <div className={styles.card}>
            <p className={styles.texto}>
              A loja cancelou este pedido. Se foi engano ou se ele já estava pago, fale com a
              gente que a gente resolve.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.card}>
              <CronometroEntrega
                inicio={inicio}
                minutos={minutos}
                status={status}
                retirada={retirada}
              />

              <ol className={styles.etapas}>
                {etapas.map((etapa, i) => (
                  <li
                    key={etapa.status}
                    className={
                      i < etapaAtual ? styles.feita : i === etapaAtual ? styles.atual : undefined
                    }
                  >
                    <span className={styles.ponto} aria-hidden="true" />
                    {etapa.label}
                  </li>
                ))}
              </ol>
            </div>

            <p className={styles.whats}>
              <MessageCircle size={16} />
              Você recebe cada passo do pedido no seu WhatsApp.
            </p>
          </>
        )}

        <div className={styles.acoes}>
          <Link href="/pedido/historico" className={styles.botao}>
            Ver meus pedidos
          </Link>

          {comprovante && (
            <a href={comprovante} target="_blank" rel="noreferrer" className={styles.link}>
              <ExternalLink size={15} /> Ver comprovante do pagamento
            </a>
          )}

          <a href={ajuda} target="_blank" rel="noreferrer" className={styles.link}>
            Falar com a loja
          </a>

          <Link href="/pedido" className={styles.link}>
            Voltar ao cardápio
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function PedidoConfirmadoPage() {
  return (
    <Suspense fallback={<main className={styles.container} />}>
      <Confirmado />
    </Suspense>
  );
}
