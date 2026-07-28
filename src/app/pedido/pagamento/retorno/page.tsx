'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { whatsappLink } from '@/config/store';
import styles from './page.module.css';

type Estado = 'verificando' | 'pago' | 'pendente' | 'erro';

function Retorno() {
  const router = useRouter();
  const params = useSearchParams();
  const { clearCart } = useCart();

  const [estado, setEstado] = useState<Estado>('verificando');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);

  const orderNsu = params.get('order_nsu');
  const transactionNsu = params.get('transaction_nsu');
  const slug = params.get('slug');
  const receiptUrl = params.get('receipt_url');

  // O carrinho só é limpo quando o pagamento confirma. Se o cliente
  // desistiu no checkout, ele volta e ainda tem o pedido montado.
  const jaLimpou = useRef(false);

  // Uma vez confirmado, nada mais pode tirar a tela do estado "pago".
  //
  // O bug que isto conserta: antes o polling era um timer paralelo que
  // começava a contar antes da primeira resposta. Com o payment_check
  // lento, várias requisições ficavam no ar; se uma resposta ATRASADA
  // com paid:false chegasse depois de uma paid:true, ela derrubava a tela
  // de volta para "verificando" — e como o contador já tinha estourado,
  // nada mais era agendado. O cliente que PAGOU ficava no spinner para
  // sempre, com o carrinho já apagado, e refazia o pedido.
  const confirmado = useRef(false);

  useEffect(() => {
    if (!orderNsu) {
      setEstado('erro');
      setMensagem('Não identificamos o pedido.');
      return;
    }

    if (confirmado.current) return;

    let cancelado = false;
    const controller = new AbortController();

    (async () => {
      try {
        const resposta = await fetch('/api/pagamento/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNsu, transactionNsu, slug }),
          signal: controller.signal,
        });

        const dados = await resposta.json();
        if (cancelado || confirmado.current) return;

        if (dados.paid) {
          confirmado.current = true;
          if (!jaLimpou.current) {
            jaLimpou.current = true;
            clearCart();
          }
          setEstado('pago');
          return;
        }

        setMensagem(dados.reason ?? null);

        // Pix leva alguns segundos para compensar: vale insistir um pouco
        // antes de dizer que não foi. O próximo ciclo é encadeado AQUI,
        // depois da resposta — nunca em timer paralelo.
        if (rodada >= 5) {
          setEstado('pendente');
        } else {
          setTimeout(() => {
            if (!cancelado && !confirmado.current) setRodada((n) => n + 1);
          }, 3000);
        }
      } catch (error: any) {
        if (cancelado || error?.name === 'AbortError') return;

        console.error(error);
        setMensagem('Não conseguimos falar com o servidor.');

        if (rodada >= 5) {
          setEstado('erro');
        } else {
          setTimeout(() => {
            if (!cancelado && !confirmado.current) setRodada((n) => n + 1);
          }, 3000);
        }
      }
    })();

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [orderNsu, transactionNsu, slug, rodada, clearCart]);

  if (estado === 'pago') {
    return (
      <main className={styles.container}>
        <div className={`${styles.card} ${styles.sucesso}`}>
          <div className={styles.iconOk}><CheckCircle2 size={44} /></div>
          <h1>Pagamento confirmado!</h1>
          <p>
            Seu pedido <strong>#{orderNsu}</strong> já foi enviado para a cozinha.
            Você pode acompanhar o preparo em Meus Pedidos.
          </p>

          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noreferrer" className={styles.linkSecundario}>
              <ExternalLink size={15} /> Ver comprovante
            </a>
          )}

          <button className={styles.botao} onClick={() => router.replace('/pedido/historico')}>
            Acompanhar meu pedido
          </button>
        </div>
      </main>
    );
  }

  if (estado === 'verificando') {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <Loader2 size={40} className={styles.spin} />
          <h1>Confirmando seu pagamento...</h1>
          <p>Isso costuma levar alguns segundos. Não feche esta página.</p>
        </div>
      </main>
    );
  }

  if (estado === 'pendente') {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <div className={styles.iconAviso}><Clock size={40} /></div>
          <h1>Ainda não recebemos a confirmação</h1>
          <p>
            Se você concluiu o pagamento, ele deve cair em instantes — o pedido entra
            na cozinha automaticamente assim que confirmar.
          </p>
          {mensagem && <span className={styles.detalhe}>{mensagem}</span>}

          <button
            className={styles.botao}
            onClick={() => { setRodada(0); setEstado('verificando'); }}
          >
            Verificar de novo
          </button>

          <a href={whatsappLink(`Oi! Paguei o pedido ${orderNsu} mas não confirmou`)}
             target="_blank" rel="noreferrer" className={styles.linkSecundario}>
            Falar com a loja
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconErro}><XCircle size={40} /></div>
        <h1>Não conseguimos confirmar</h1>
        <p>{mensagem || 'Houve um problema ao verificar o pagamento.'}</p>

        <button
          className={styles.botao}
          onClick={() => { setRodada(0); setEstado('verificando'); }}
        >
          Tentar novamente
        </button>

        <Link href="/pedido" className={styles.linkSecundario}>Voltar ao cardápio</Link>
      </div>
    </main>
  );
}

export default function RetornoPagamentoPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.container}>
          <div className={styles.card}>
            <Loader2 size={40} className={styles.spin} />
            <h1>Carregando...</h1>
          </div>
        </main>
      }
    >
      <Retorno />
    </Suspense>
  );
}
