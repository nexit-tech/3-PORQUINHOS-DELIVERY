'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css';
import { QrCode, Wifi, WifiOff, Loader2, Smartphone, ScanLine, ExternalLink, ServerCrash } from 'lucide-react';
import { isElectron } from '@/lib/isElectron';
import { getBotSetting } from '@/services/botSettings';

// A conexão vive no servidor (src/lib/whatsapp). Esta tela só pede para
// conectar, mostra o QR Code que o servidor gerou e acompanha o estado.
type Estado = 'loading' | 'desligado' | 'conectando' | 'qrcode' | 'conectado' | 'indisponivel' | 'sem_servidor';

interface Status {
  estado: Estado;
  qr: string | null;
  numero: string | null;
  motivo?: string;
}

async function chamar(metodo: 'GET' | 'POST', action?: string): Promise<Status> {
  const resposta = await fetch('/api/whatsapp', {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: action ? JSON.stringify({ action }) : undefined,
    cache: 'no-store',
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.error || 'Erro no WhatsApp');
  return dados;
}

/**
 * O desktop não fala com o servidor, só com o Supabase. O servidor grava o
 * status em bot_settings (ver STATUS_KEY em lib/whatsapp/conexao.ts) e
 * renova a cada minuto; status mais velho que isto = servidor fora do ar.
 */
const STATUS_KEY = 'whatsapp_status:principal';
const STATUS_VELHO_MS = 3 * 60_000;

async function statusPeloBanco(): Promise<Status> {
  const salvo = await getBotSetting<{ estado?: Estado; numero?: string | null; at?: string }>(STATUS_KEY);
  const velho = !salvo?.at || Date.now() - new Date(salvo.at).getTime() > STATUS_VELHO_MS;
  if (velho) return { estado: 'sem_servidor', qr: null, numero: null };
  return { estado: salvo!.estado ?? 'desligado', qr: null, numero: salvo!.numero ?? null };
}

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://delivery.tresporquinhos.com').replace(/\/+$/, '');

const formatarNumero = (n: string | null) =>
  n?.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') ?? '';

export default function WhatsappConnect() {
  const [status, setStatus] = useState<Status>({ estado: 'loading', qr: null, numero: null });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O desktop não tem rotas de API: a conexão é feita pelo painel web
  const [desktop, setDesktop] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      setStatus(isElectron() ? await statusPeloBanco() : await chamar('GET'));
    } catch (e: any) {
      setErro(e.message);
      setStatus({ estado: 'desligado', qr: null, numero: null });
    }
  }, []);

  useEffect(() => {
    setDesktop(isElectron());
    atualizar();
  }, [atualizar]);

  // Enquanto espera a leitura do QR, acompanha de perto: o QR troca a cada
  // ~20s e, lido, a tela tem que virar "conectado" sem precisar de F5.
  // No desktop acompanha sempre: a conexão é feita em outro lugar (navegador)
  // e esta tela tem que refletir quando ela acontecer.
  const aguardando = status.estado === 'qrcode' || status.estado === 'conectando';
  useEffect(() => {
    if (!aguardando && !desktop) return;
    const intervalo = setInterval(atualizar, desktop ? 5000 : 2500);
    return () => clearInterval(intervalo);
  }, [aguardando, desktop, atualizar]);

  const handleConectar = async () => {
    setLoading(true);
    setErro(null);
    try {
      setStatus(await chamar('POST', 'connect'));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDesconectar = async () => {
    if (!confirm('Desconectar o WhatsApp? Os clientes param de receber o andamento dos pedidos.')) return;
    setLoading(true);
    setErro(null);
    try {
      setStatus(await chamar('POST', 'logout'));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const online = status.estado === 'conectado';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <div className={styles.iconBox}>
            <Smartphone size={24} className={styles.brandIcon} />
          </div>
          <div>
            <h3>Conexão WhatsApp</h3>
            <p>Envia o andamento do pedido para o cliente</p>
          </div>
        </div>

        <div className={styles.statusBadge}>
          {online ? (
            <span className={styles.connected}><Wifi size={14} /> Online</span>
          ) : (
            <span className={styles.disconnected}><WifiOff size={14} /> Offline</span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {desktop && (
          <div className={styles.stateContainer}>
            {status.estado === 'loading' ? (
              <Loader2 className={styles.spin} size={32} />
            ) : status.estado === 'conectado' ? (
              <>
                <div className={styles.successIcon}><Wifi size={32} /></div>
                <h4>Tudo pronto!</h4>
                <p className={styles.stateText}>
                  Conectado{status.numero ? ` ao ${formatarNumero(status.numero)}` : ''}.<br />
                  Os clientes recebem o andamento do pedido no WhatsApp.
                </p>
              </>
            ) : status.estado === 'sem_servidor' ? (
              <>
                <div className={styles.placeholderIcon}><ServerCrash size={40} /></div>
                <p className={styles.stateText}>
                  O servidor da loja não deu sinal nos últimos minutos.<br />
                  Abra o painel no navegador para conferir.
                </p>
              </>
            ) : (
              <>
                <div className={styles.placeholderIcon}><QrCode size={40} /></div>
                <p className={styles.stateText}>
                  {status.estado === 'qrcode'
                    ? 'Tem um QR Code esperando leitura no navegador.'
                    : 'Nenhum WhatsApp conectado.'}
                  <br />
                  O QR Code é gerado e lido pelo painel no navegador.
                </p>
              </>
            )}

            {status.estado !== 'loading' && (
              <button
                onClick={() => window.open(`${SITE}/settings`, '_blank')}
                className={status.estado === 'conectado' ? styles.cancelBtn : styles.primaryBtn}
              >
                <ExternalLink size={18} />
                {status.estado === 'conectado' ? 'Gerenciar no navegador' : 'Abrir no navegador para conectar'}
              </button>
            )}
          </div>
        )}

        {!desktop && (status.estado === 'loading' || (status.estado === 'conectando' && !status.qr)) && (
          <div className={styles.stateContainer}>
            <Loader2 className={styles.spin} size={32} />
            <p className={styles.stateText}>
              {status.estado === 'loading' ? 'Verificando conexão...' : 'Conectando ao WhatsApp...'}
            </p>
          </div>
        )}

        {!desktop && status.estado === 'indisponivel' && (
          <div className={styles.stateContainer}>
            <div className={styles.placeholderIcon}><WifiOff size={40} /></div>
            <p className={styles.stateText}>{status.motivo}</p>
          </div>
        )}

        {!desktop && online && (
          <div className={styles.stateContainer}>
            <div className={styles.successIcon}><Wifi size={32} /></div>
            <h4>Tudo pronto!</h4>
            <p className={styles.stateText}>
              Conectado{status.numero ? ` ao ${formatarNumero(status.numero)}` : ''}.<br />
              Os clientes recebem no WhatsApp quando o pedido é aceito, sai para entrega,
              é finalizado ou cancelado.
            </p>
            <button onClick={handleDesconectar} disabled={loading} className={styles.disconnectBtn}>
              {loading ? 'Desconectando...' : 'Desconectar'}
            </button>
          </div>
        )}

        {!desktop && status.estado === 'desligado' && (
          <div className={styles.stateContainer}>
            <div className={styles.emptyState}>
              <div className={styles.placeholderIcon}><QrCode size={40} /></div>
              <p className={styles.stateText}>
                Nenhum WhatsApp conectado.<br />
                Gere o QR Code e leia com o celular da loja.
              </p>
              <button onClick={handleConectar} disabled={loading} className={styles.primaryBtn}>
                {loading ? (
                  <><Loader2 className={styles.spinBtn} size={18} /> Gerando...</>
                ) : (
                  <><ScanLine size={18} /> Gerar QR Code</>
                )}
              </button>
            </div>
          </div>
        )}

        {!desktop && status.estado === 'qrcode' && status.qr && (
          <div className={styles.stateContainer}>
            <div className={styles.qrWrapper}>
              <p className={styles.instructionText}>
                No celular da loja: WhatsApp → Aparelhos conectados → Conectar um aparelho
              </p>
              <div className={styles.qrFrame}>
                <img src={status.qr} alt="QR Code do WhatsApp" />
                <div className={styles.scanLine}></div>
              </div>
              <button onClick={handleDesconectar} className={styles.cancelBtn}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {erro && <p className={styles.stateText} role="alert">⚠️ {erro}</p>}
      </div>
    </div>
  );
}
