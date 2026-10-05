'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './styles.module.css';
import { QrCode, Wifi, WifiOff, Loader2, Smartphone, ScanLine, MonitorSmartphone } from 'lucide-react';
import { isElectron } from '@/lib/isElectron';

// A conexão vive no servidor (src/lib/whatsapp). Esta tela só pede para
// conectar, mostra o QR Code que o servidor gerou e acompanha o estado.
type Estado = 'loading' | 'desligado' | 'conectando' | 'qrcode' | 'conectado' | 'indisponivel';

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
      setStatus(await chamar('GET'));
    } catch (e: any) {
      setErro(e.message);
      setStatus({ estado: 'desligado', qr: null, numero: null });
    }
  }, []);

  useEffect(() => {
    if (isElectron()) {
      setDesktop(true);
      return;
    }
    atualizar();
  }, [atualizar]);

  // Enquanto espera a leitura do QR, acompanha de perto: o QR troca a cada
  // ~20s e, lido, a tela tem que virar "conectado" sem precisar de F5.
  const aguardando = status.estado === 'qrcode' || status.estado === 'conectando';
  useEffect(() => {
    if (!aguardando) return;
    const intervalo = setInterval(atualizar, 2500);
    return () => clearInterval(intervalo);
  }, [aguardando, atualizar]);

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
            <div className={styles.placeholderIcon}><MonitorSmartphone size={40} /></div>
            <p className={styles.stateText}>
              No app do computador não dá para conectar.<br />
              Abra o painel pelo navegador, em Configurações → Conectar WhatsApp.
            </p>
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
