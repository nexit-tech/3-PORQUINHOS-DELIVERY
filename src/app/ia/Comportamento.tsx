'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { BOT_SETTING_KEYS, getBotSetting, setBotSetting } from '@/services/botSettings';
import { CONFIG_PADRAO, IA_KEYS, normalizarConfig, type ConfigIA } from '@/lib/bot/config';
import styles from './page.module.css';

const PAUSA_PADRAO = '⏸️ Um atendente vai te responder em breve!';

function Interruptor({ ligado, onChange, titulo, descricao }: {
  ligado: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className={styles.toggle}>
      <div>
        <strong>{titulo}</strong>
        <span>{descricao}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={titulo}
        className={`${styles.switch} ${ligado ? styles.switchOn : ''}`}
        onClick={() => onChange(!ligado)}
      />
    </div>
  );
}

export default function Comportamento() {
  const [config, setConfig] = useState<ConfigIA | null>(null);
  const [pausa, setPausa] = useState('');
  const [original, setOriginal] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([getBotSetting(IA_KEYS.CONFIG), getBotSetting<{ text?: string }>(BOT_SETTING_KEYS.PAUSE_MESSAGE)])
      .then(([c, p]) => {
        const cfg = normalizarConfig(c);
        // O banco antigo guardava "\n" escrito, não a quebra de linha
        const textoPausa = (p?.text || PAUSA_PADRAO).replace(/\\n/g, '\n');
        setConfig(cfg);
        setPausa(textoPausa);
        setOriginal(JSON.stringify([cfg, textoPausa]));
      })
      .catch((e) => {
        console.error(e);
        toast.error('Não consegui carregar as configurações');
      });
  }, []);

  if (!config) {
    return <div className={styles.vazio}><Loader2 className={styles.spin} /></div>;
  }

  const set = <K extends keyof ConfigIA>(k: K, v: ConfigIA[K]) => setConfig({ ...config, [k]: v });
  const alterado = JSON.stringify([config, pausa]) !== original;

  const salvar = async () => {
    setSalvando(true);
    try {
      // "Sobre a loja" é editado na aba Conhecimento: mantém o que está no banco
      const atual = normalizarConfig(await getBotSetting(IA_KEYS.CONFIG));
      await Promise.all([
        setBotSetting(IA_KEYS.CONFIG, { ...config, sobreLoja: atual.sobreLoja }),
        setBotSetting(BOT_SETTING_KEYS.PAUSE_MESSAGE, { text: pausa }),
      ]);
      setOriginal(JSON.stringify([config, pausa]));
      toast.success('Salvo! Vale a partir da próxima mensagem.');
    } catch (e) {
      console.error(e);
      toast.error('Não consegui salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={styles.secao}>
      <div className={styles.card}>
        <div className={styles.secao}>
          <div className={styles.campo}>
            <label htmlFor="nome">Nome do atendente</label>
            <input id="nome" className={styles.input} value={config.nomeAtendente} onChange={(e) => set('nomeAtendente', e.target.value)} />
            <span className={styles.ajuda}>Como ele se apresenta se o cliente perguntar.</span>
          </div>

          <div className={styles.campo}>
            <label htmlFor="pers">Jeito de falar</label>
            <textarea id="pers" className={styles.textarea} rows={3} value={config.personalidade} onChange={(e) => set('personalidade', e.target.value)} />
            <span className={styles.ajuda}>Tom, formalidade, uso de emoji. Ex: “descontraído, chama o cliente pelo nome, usa 🍕”.</span>
          </div>

          <div className={styles.campo}>
            <label htmlFor="extras">Regras extras</label>
            <textarea
              id="extras"
              className={styles.textarea}
              rows={5}
              value={config.instrucoesExtras}
              placeholder={'Ex:\n- Sempre ofereça um refrigerante quando o cliente pedir só pizza.\n- Aos domingos, lembre que a pizza doce sai com 10% de desconto no site.'}
              onChange={(e) => set('instrucoesExtras', e.target.value)}
            />
            <span className={styles.ajuda}>Qualquer coisa que você queira que ele faça ou evite. Escreva como se estivesse explicando para um funcionário novo.</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <Interruptor
          titulo="Fechar pedido pela conversa"
          descricao="Ligado: ele monta o carrinho, pega endereço e pagamento e manda o pedido para a cozinha. Desligado: tira dúvidas e manda o link do site para finalizar."
          ligado={config.fecharPedido}
          onChange={(v) => set('fecharPedido', v)}
        />
        <Interruptor
          titulo="Responder com a loja fechada"
          descricao="Ligado: avisa quando a loja abre e tira dúvidas (sem fechar pedido). Desligado: não responde nada fora do horário."
          ligado={config.responderFechado}
          onChange={(v) => set('responderFechado', v)}
        />
        <Interruptor
          titulo="Ouvir mensagens de voz"
          descricao="Transcreve o áudio do cliente e responde. Desligado: pede para o cliente escrever."
          ligado={config.ouvirAudio}
          onChange={(v) => set('ouvirAudio', v)}
        />

        <div className={styles.toggle}>
          <div style={{ flex: 1 }}>
            <strong>Esperar antes de responder: {config.esperaSegundos}s</strong>
            <span>Cliente costuma mandar várias mensagens seguidas. Esperar um pouco junta tudo numa resposta só.</span>
            <input
              type="range"
              min={0}
              max={30}
              value={config.esperaSegundos}
              onChange={(e) => set('esperaSegundos', Number(e.target.value))}
              style={{ width: '100%', marginTop: 10, accentColor: 'var(--primary-color)' }}
              aria-label="Segundos de espera"
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.campo}>
          <label htmlFor="pausa">Mensagem quando o cliente pede um atendente</label>
          <textarea id="pausa" className={styles.textarea} rows={3} value={pausa} onChange={(e) => setPausa(e.target.value)} />
          <span className={styles.ajuda}>Enviada quando o cliente escreve “quero falar com atendente”. Depois disso o bot fica 24h fora da conversa.</span>
        </div>
      </div>

      <div className={styles.barraSalvar}>
        {alterado && <span className={styles.alterado}>Alterações não salvas</span>}
        <button
          type="button"
          className={styles.botaoSec}
          onClick={() => {
            if (confirm('Voltar o jeito de falar e as regras para o padrão?')) {
              setConfig({ ...CONFIG_PADRAO, sobreLoja: config.sobreLoja });
            }
          }}
        >
          <RotateCcw size={15} /> Padrão
        </button>
        <button type="button" className={styles.botao} onClick={salvar} disabled={!alterado || salvando}>
          {salvando ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />} Salvar
        </button>
      </div>
    </div>
  );
}
