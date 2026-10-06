'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Plus, Trash2, Search, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBotSetting, setBotSetting } from '@/services/botSettings';
import {
  IA_KEYS,
  normalizarConfig,
  normalizarFaq,
  normalizarMidias,
  novoId,
  type ConfigIA,
  type Midia,
  type PerguntaResposta,
} from '@/lib/bot/config';
import styles from './page.module.css';
import local from './Conhecimento.module.css';

export default function Conhecimento() {
  const [config, setConfig] = useState<ConfigIA | null>(null);
  const [faq, setFaq] = useState<PerguntaResposta[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [original, setOriginal] = useState('');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([getBotSetting(IA_KEYS.CONFIG), getBotSetting(IA_KEYS.FAQ), getBotSetting(IA_KEYS.MIDIAS)])
      .then(([c, f, m]) => {
        const cfg = normalizarConfig(c);
        const lista = normalizarFaq(f);
        setConfig(cfg);
        setFaq(lista);
        setMidias(normalizarMidias(m));
        setOriginal(JSON.stringify([cfg.sobreLoja, lista]));
      })
      .catch((e) => {
        console.error(e);
        toast.error('Não consegui carregar o conhecimento do atendente');
      });
  }, []);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return faq;
    return faq.filter((p) => `${p.pergunta} ${p.resposta}`.toLowerCase().includes(t));
  }, [faq, busca]);

  if (!config) {
    return <div className={styles.vazio}><Loader2 className={styles.spin} /></div>;
  }

  const alterado = JSON.stringify([config.sobreLoja, faq]) !== original;

  const editar = (id: string, mudanca: Partial<PerguntaResposta>) =>
    setFaq((lista) => lista.map((p) => (p.id === id ? { ...p, ...mudanca } : p)));

  const adicionar = () => {
    const nova: PerguntaResposta = { id: novoId(), pergunta: '', resposta: '', midias: [], ativo: true };
    setFaq((lista) => [nova, ...lista]);
    setBusca('');
  };

  const salvar = async () => {
    const limpas = faq.filter((p) => p.pergunta.trim() || p.resposta.trim());
    setSalvando(true);
    try {
      // Relê a config antes de gravar: a aba Comportamento grava a mesma
      // chave, e salvar a cópia velha daqui desfaria o que foi mudado lá
      const atual = normalizarConfig(await getBotSetting(IA_KEYS.CONFIG));
      const novaConfig = { ...atual, sobreLoja: config.sobreLoja };
      await Promise.all([setBotSetting(IA_KEYS.CONFIG, novaConfig), setBotSetting(IA_KEYS.FAQ, limpas)]);
      setConfig(novaConfig);
      setFaq(limpas);
      setOriginal(JSON.stringify([novaConfig.sobreLoja, limpas]));
      toast.success('Salvo! Vale a partir da próxima mensagem.');
    } catch (e) {
      console.error(e);
      toast.error('Não consegui salvar');
    } finally {
      setSalvando(false);
    }
  };

  const fotosAtivas = midias.filter((m) => m.ativo);

  return (
    <div className={styles.secao}>
      <div className={styles.card}>
        <div className={styles.campo}>
          <label htmlFor="sobre">Sobre a loja</label>
          <textarea
            id="sobre"
            className={styles.textarea}
            rows={7}
            value={config.sobreLoja}
            onChange={(e) => setConfig({ ...config, sobreLoja: e.target.value })}
          />
          <span className={styles.ajuda}>
            Endereço, como funciona, diferenciais. O cardápio, os preços, os bairros e os horários ele já lê sozinho do
            sistema — não precisa repetir aqui.
          </span>
        </div>
      </div>

      <div className={styles.secaoTopo}>
        <div>
          <h2>Perguntas e respostas ({faq.length})</h2>
          <p>Quando o cliente perguntar algo parecido, o atendente responde com o que está aqui. Dá para anexar fotos a uma resposta.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className={local.busca}>
            <Search size={15} />
            <input placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pergunta" />
          </div>
          <button type="button" className={styles.botao} onClick={adicionar}>
            <Plus size={16} /> Nova pergunta
          </button>
        </div>
      </div>

      {filtradas.length === 0 && <div className={styles.vazio}>Nenhuma pergunta {busca ? 'encontrada' : 'cadastrada'}.</div>}

      <div className={local.lista}>
        {filtradas.map((p) => (
          <div key={p.id} className={`${styles.card} ${local.item} ${p.ativo ? '' : local.inativo}`}>
            <div className={local.linha}>
              <input
                className={`${styles.input} ${local.pergunta}`}
                placeholder="Pergunta do cliente (ex: Tem borda recheada?)"
                value={p.pergunta}
                onChange={(e) => editar(p.id, { pergunta: e.target.value })}
                aria-label="Pergunta"
              />
              <button
                type="button"
                className={styles.botaoSec}
                onClick={() => editar(p.id, { ativo: !p.ativo })}
                title={p.ativo ? 'Desativar (o bot ignora)' : 'Ativar'}
              >
                {p.ativo ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button
                type="button"
                className={`${styles.botaoSec} ${styles.botaoPerigo}`}
                onClick={() => confirm('Apagar esta pergunta?') && setFaq((l) => l.filter((x) => x.id !== p.id))}
                title="Apagar"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <textarea
              className={styles.textarea}
              rows={2}
              placeholder="Resposta"
              value={p.resposta}
              onChange={(e) => editar(p.id, { resposta: e.target.value })}
              aria-label="Resposta"
            />
            {fotosAtivas.length > 0 && (
              <div className={local.fotos}>
                <ImageIcon size={14} />
                <span>Mandar junto:</span>
                {fotosAtivas.map((m) => {
                  const marcada = p.midias.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`${local.fotoChip} ${marcada ? local.fotoChipOn : ''}`}
                      onClick={() =>
                        editar(p.id, { midias: marcada ? p.midias.filter((x) => x !== m.id) : [...p.midias, m.id] })
                      }
                    >
                      {m.titulo}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.barraSalvar}>
        {alterado && <span className={styles.alterado}>Alterações não salvas</span>}
        <button type="button" className={styles.botao} onClick={salvar} disabled={!alterado || salvando}>
          {salvando ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />} Salvar
        </button>
      </div>
    </div>
  );
}
