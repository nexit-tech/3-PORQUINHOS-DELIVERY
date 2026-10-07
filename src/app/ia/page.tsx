'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  MessageSquare,
  BookOpen,
  Image as ImageIcon,
  SlidersHorizontal,
  Power,
  Wifi,
  WifiOff,
  Sparkles,
  FlaskConical,
  Users,
  X,
  Plus,
  QrCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BOT_SETTING_KEYS, getBotFlag, getBotSetting, setBotFlag, setBotSetting } from '@/services/botSettings';
import { IA_KEYS, normalizarTeste, telefoneComDdi, type ModoTeste } from '@/lib/bot/config';
import Conversas from './Conversas';
import Conhecimento from './Conhecimento';
import Fotos from './Fotos';
import Comportamento from './Comportamento';
import Pix from './Pix';
import styles from './page.module.css';

type Aba = 'conversas' | 'conhecimento' | 'fotos' | 'pix' | 'comportamento';
type Modo = 'desligado' | 'teste' | 'todos';

const ABAS: { id: Aba; label: string; icon: typeof Bot }[] = [
  { id: 'conversas', label: 'Conversas', icon: MessageSquare },
  { id: 'conhecimento', label: 'Conhecimento', icon: BookOpen },
  { id: 'fotos', label: 'Fotos', icon: ImageIcon },
  { id: 'pix', label: 'Pix', icon: QrCode },
  { id: 'comportamento', label: 'Comportamento', icon: SlidersHorizontal },
];

const MODOS: { id: Modo; label: string; icon: typeof Bot }[] = [
  { id: 'desligado', label: 'Desligado', icon: Power },
  { id: 'teste', label: 'Teste', icon: FlaskConical },
  { id: 'todos', label: 'Ligado para todos', icon: Users },
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
  const [teste, setTeste] = useState<ModoTeste | null>(null);
  const [status, setStatus] = useState<StatusServidor | null>(null);
  const [novoNumero, setNovoNumero] = useState('');

  const carregarStatus = useCallback(async () => {
    try {
      const [ativo, s, t] = await Promise.all([
        getBotFlag(BOT_SETTING_KEYS.BOT_ACTIVE, true),
        getBotSetting<StatusServidor>('whatsapp_status:principal'),
        getBotSetting(IA_KEYS.TESTE),
      ]);
      setLigado(ativo);
      setStatus(s);
      setTeste(normalizarTeste(t));
    } catch (erro) {
      console.error('Erro ao ler status do atendente:', erro);
    }
  }, []);

  useEffect(() => {
    carregarStatus();
    const intervalo = setInterval(carregarStatus, 10_000);
    return () => clearInterval(intervalo);
  }, [carregarStatus]);

  const modo: Modo | null =
    ligado === null || teste === null ? null : !ligado ? 'desligado' : teste.ativo ? 'teste' : 'todos';

  const mudarModo = async (novo: Modo) => {
    if (!teste || novo === modo) return;
    if (novo === 'todos' && !confirm('Ligar para TODOS? O atendente passa a responder qualquer cliente que mandar mensagem.')) return;
    if (novo === 'desligado' && !confirm('Desligar o atendente? Ele para de responder (os avisos de andamento do pedido continuam).')) return;

    const antes = { ligado, teste };
    const novoTeste = { ...teste, ativo: novo === 'teste' };
    setLigado(novo !== 'desligado');
    setTeste(novoTeste);

    try {
      await Promise.all([
        setBotFlag(BOT_SETTING_KEYS.BOT_ACTIVE, novo !== 'desligado'),
        setBotSetting(IA_KEYS.TESTE, novoTeste),
      ]);
      toast.success(
        novo === 'desligado'
          ? 'Atendente desligado'
          : novo === 'teste'
            ? 'Modo teste: só os números da lista'
            : 'Atendente ligado para todos'
      );
    } catch (erro) {
      console.error(erro);
      setLigado(antes.ligado);
      setTeste(antes.teste);
      toast.error('Não consegui salvar. Tente de novo.');
    }
  };

  const salvarNumeros = async (numeros: string[]) => {
    if (!teste) return;
    const novoTeste = { ...teste, numeros };
    setTeste(novoTeste);
    try {
      await setBotSetting(IA_KEYS.TESTE, novoTeste);
    } catch (erro) {
      console.error(erro);
      toast.error('Não consegui salvar a lista');
      carregarStatus();
    }
  };

  const adicionarNumero = () => {
    if (!teste) return;
    const digitos = novoNumero.replace(/\D/g, '');
    if (digitos.length < 10) {
      toast.error('Digite o celular com DDD');
      return;
    }
    const numero = telefoneComDdi(digitos);
    if (teste.numeros.includes(numero)) {
      toast('Esse número já está na lista');
      return;
    }
    salvarNumeros([...teste.numeros, numero]);
    setNovoNumero('');
    toast.success('Número adicionado ao teste');
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

        <div className={styles.modos} role="radiogroup" aria-label="Modo do atendente">
          {MODOS.map(({ id, label, icon: Icone }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={modo === id}
              disabled={modo === null}
              className={`${styles.modo} ${modo === id ? styles[`modo_${id}`] : ''}`}
              onClick={() => mudarModo(id)}
            >
              <Icone size={16} /> {label}
            </button>
          ))}
        </div>
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

      {modo === 'teste' && teste && (
        <div className={styles.teste}>
          <div className={styles.testeTexto}>
            <FlaskConical size={18} />
            <div>
              <strong>Modo teste</strong>
              <span>
                O atendente só responde os celulares abaixo. Todo o resto é ignorado, como se ele estivesse desligado.
                Quando estiver tudo certo, mude para “Ligado para todos”.
              </span>
            </div>
          </div>

          <div className={styles.testeNumeros}>
            {teste.numeros.length === 0 && (
              <span className={styles.testeVazio}>Nenhum número ainda: o atendente não responde ninguém.</span>
            )}
            {teste.numeros.map((n) => (
              <span key={n} className={styles.numeroChip}>
                {formatarNumero(n)}
                <button
                  type="button"
                  aria-label={`Tirar ${formatarNumero(n)} do teste`}
                  onClick={() => salvarNumeros(teste.numeros.filter((x) => x !== n))}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
            <form
              className={styles.testeAdicionar}
              onSubmit={(e) => {
                e.preventDefault();
                adicionarNumero();
              }}
            >
              <input
                className={styles.input}
                placeholder="(22) 99999-9999"
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                aria-label="Celular para o teste"
              />
              <button type="submit" className={styles.botao}>
                <Plus size={15} /> Adicionar
              </button>
            </form>
          </div>
        </div>
      )}

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
        {aba === 'pix' && <Pix />}
        {aba === 'comportamento' && <Comportamento />}
      </section>
    </div>
  );
}
