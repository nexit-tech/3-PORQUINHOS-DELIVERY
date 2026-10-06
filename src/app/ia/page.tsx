'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, MessageSquare, BookOpen, Image as ImageIcon, SlidersHorizontal, Power, Wifi, WifiOff, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { BOT_SETTING_KEYS, getBotFlag, getBotSetting, setBotFlag } from '@/services/botSettings';
import Conversas from './Conversas';
import Conhecimento from './Conhecimento';
import Fotos from './Fotos';
import Comportamento from './Comportamento';
import styles from './page.module.css';

type Aba = 'conversas' | 'conhecimento' | 'fotos' | 'comportamento';

const ABAS: { id: Aba; label: string; icon: typeof Bot }[] = [
  { id: 'conversas', label: 'Conversas', icon: MessageSquare },
  { id: 'conhecimento', label: 'Conhecimento', icon: BookOpen },
  { id: 'fotos', label: 'Fotos', icon: ImageIcon },
  { id: 'comportamento', label: 'Comportamento', icon: SlidersHorizontal },
];

interface StatusServidor {
  estado?: string;
  numero?: string | null;
  ia?: boolean;
  at?: string;
}

const formatarNumero = (n?: string | null) =>
  n?.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') ?? '';

/**
 * Página do atendente do WhatsApp (ChatGPT). Tudo aqui é lido e gravado
 * direto no banco (bot_settings, bot_conversas, bot_paused_numbers), então
 * funciona igual no navegador e no app desktop.
 */
export default function AtendentePage() {
  const [aba, setAba] = useState<Aba>('conversas');
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [status, setStatus] = useState<StatusServidor | null>(null);

  const carregarStatus = useCallback(async () => {
    try {
      const [ativo, s] = await Promise.all([
        getBotFlag(BOT_SETTING_KEYS.BOT_ACTIVE, true),
        getBotSetting<StatusServidor>('whatsapp_status:principal'),
      ]);
      setLigado(ativo);
      setStatus(s);
    } catch (erro) {
      console.error('Erro ao ler status do atendente:', erro);
    }
  }, []);

  useEffect(() => {
    carregarStatus();
    const intervalo = setInterval(carregarStatus, 10_000);
    return () => clearInterval(intervalo);
  }, [carregarStatus]);

  const alternar = async () => {
    if (ligado === null) return;
    const novo = !ligado;
    const pergunta = novo
      ? 'Ligar o atendente? Ele volta a responder os clientes no WhatsApp.'
      : 'Desligar o atendente? Ele para de responder TODOS os clientes (os avisos de andamento do pedido continuam).';
    if (!confirm(pergunta)) return;

    setLigado(novo);
    try {
      await setBotFlag(BOT_SETTING_KEYS.BOT_ACTIVE, novo);
      toast.success(novo ? 'Atendente ligado' : 'Atendente desligado');
    } catch (erro) {
      console.error(erro);
      setLigado(!novo);
      toast.error('Não consegui salvar. Tente de novo.');
    }
  };

  // Servidor renova o status a cada minuto; mais velho que 3 min = fora do ar
  const servidorVivo = Boolean(status?.at && Date.now() - new Date(status.at).getTime() < 3 * 60_000);
  const whatsappOk = servidorVivo && status?.estado === 'conectado';
  const iaOk = servidorVivo && status?.ia === true;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titulo}>
          <div className={styles.tituloIcone}><Bot size={26} /></div>
          <div>
            <h1>Atendente IA</h1>
            <p>O ChatGPT que atende seus clientes no WhatsApp. Tudo que ele sabe e faz se configura aqui.</p>
          </div>
        </div>

        <button
          className={`${styles.botaoLiga} ${ligado ? styles.ligado : styles.desligado}`}
          onClick={alternar}
          disabled={ligado === null}
          aria-pressed={Boolean(ligado)}
        >
          <Power size={18} />
          {ligado === null ? '...' : ligado ? 'Atendente LIGADO' : 'Atendente DESLIGADO'}
        </button>
      </header>

      <div className={styles.chips}>
        <span className={`${styles.chip} ${whatsappOk ? styles.chipOk : styles.chipAlerta}`}>
          {whatsappOk ? <Wifi size={14} /> : <WifiOff size={14} />}
          {!servidorVivo
            ? 'Servidor sem sinal'
            : whatsappOk
              ? `WhatsApp conectado ${formatarNumero(status?.numero)}`
              : 'WhatsApp desconectado — conecte em Configurações pelo navegador'}
        </span>
        {servidorVivo && (
          <span className={`${styles.chip} ${iaOk ? styles.chipOk : styles.chipAlerta}`}>
            <Sparkles size={14} />
            {iaOk ? 'ChatGPT configurado' : 'Falta a chave da OpenAI no servidor (OPENAI_API_KEY)'}
          </span>
        )}
      </div>

      <nav className={styles.abas} role="tablist">
        {ABAS.map(({ id, label, icon: Icone }) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            className={`${styles.aba} ${aba === id ? styles.abaAtiva : ''}`}
            onClick={() => setAba(id)}
          >
            <Icone size={17} />
            {label}
          </button>
        ))}
      </nav>

      <section className={styles.conteudo}>
        {aba === 'conversas' && <Conversas />}
        {aba === 'conhecimento' && <Conhecimento />}
        {aba === 'fotos' && <Fotos />}
        {aba === 'comportamento' && <Comportamento />}
      </section>
    </div>
  );
}
