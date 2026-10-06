'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Save, Upload, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/services/supabase';
import { getBotSetting, setBotSetting } from '@/services/botSettings';
import { IA_KEYS, normalizarMidias, novoId, type Midia } from '@/lib/bot/config';
import styles from './page.module.css';
import local from './Fotos.module.css';

// Mesmo bucket público das fotos de produto, numa pasta própria. Tem que ser
// público: o servidor baixa a foto pela URL para mandar no WhatsApp.
const BUCKET = 'produtos';
const PASTA = 'atendente';
const MAX_MB = 5;

export default function Fotos() {
  const [midias, setMidias] = useState<Midia[] | null>(null);
  const [original, setOriginal] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getBotSetting(IA_KEYS.MIDIAS)
      .then((m) => {
        const lista = normalizarMidias(m);
        setMidias(lista);
        setOriginal(JSON.stringify(lista));
      })
      .catch((e) => {
        console.error(e);
        toast.error('Não consegui carregar as fotos');
      });
  }, []);

  if (!midias) {
    return <div className={styles.vazio}><Loader2 className={styles.spin} /></div>;
  }

  const alterado = JSON.stringify(midias) !== original;
  const editar = (id: string, mudanca: Partial<Midia>) =>
    setMidias((l) => l!.map((m) => (m.id === id ? { ...m, ...mudanca } : m)));

  const gravar = async (lista: Midia[]) => {
    await setBotSetting(IA_KEYS.MIDIAS, lista);
    setOriginal(JSON.stringify(lista));
  };

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setEnviando(true);
    const novas: Midia[] = [];

    try {
      for (const arquivo of Array.from(arquivos)) {
        if (!arquivo.type.startsWith('image/')) {
          toast.error(`${arquivo.name}: só imagem (JPG, PNG, WEBP)`);
          continue;
        }
        if (arquivo.size > MAX_MB * 1024 * 1024) {
          toast.error(`${arquivo.name}: maior que ${MAX_MB} MB`);
          continue;
        }

        const id = novoId();
        const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const caminho = `${PASTA}/${id}.${ext}`;

        const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type });
        if (error) throw error;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
        novas.push({
          id,
          titulo: arquivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          quandoEnviar: '',
          url: data.publicUrl,
          ativo: true,
        });
      }

      if (novas.length) {
        // Upload já gravado no storage: salva a lista na hora, senão a foto
        // fica órfã se a pessoa sair da página sem clicar em Salvar
        const lista = [...novas, ...midias];
        setMidias(lista);
        await gravar(lista);
        toast.success(novas.length === 1 ? 'Foto enviada. Dê um nome e diga quando mandar.' : `${novas.length} fotos enviadas`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Falha ao enviar a foto');
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = '';
    }
  };

  const remover = async (m: Midia) => {
    if (!confirm(`Apagar a foto "${m.titulo}"?`)) return;
    const lista = midias.filter((x) => x.id !== m.id);
    try {
      await gravar(lista);
      setMidias(lista);
      const caminho = m.url.split(`/${BUCKET}/`)[1];
      if (caminho) await supabase.storage.from(BUCKET).remove([decodeURIComponent(caminho)]);
    } catch (e) {
      console.error(e);
      toast.error('Não consegui apagar');
    }
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await gravar(midias);
      toast.success('Fotos salvas!');
    } catch (e) {
      console.error(e);
      toast.error('Não consegui salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={styles.secao}>
      <div className={styles.secaoTopo}>
        <div>
          <h2>Fotos que o atendente pode mandar</h2>
          <p>
            Cardápio físico, tabela de sabores, promoção do dia… Dê um nome e diga quando mandar. Também dá para prender uma foto
            a uma resposta na aba Conhecimento.
          </p>
        </div>
        <button type="button" className={styles.botao} onClick={() => input.current?.click()} disabled={enviando}>
          {enviando ? <Loader2 size={16} className={styles.spin} /> : <Upload size={16} />} Enviar fotos
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => enviar(e.target.files)} />
      </div>

      {midias.length === 0 ? (
        <button type="button" className={`${styles.vazio} ${local.soltar}`} onClick={() => input.current?.click()}>
          <Upload size={28} />
          <span>Nenhuma foto ainda. Clique para enviar (até {MAX_MB} MB cada).</span>
        </button>
      ) : (
        <div className={local.grade}>
          {midias.map((m) => (
            <div key={m.id} className={`${styles.card} ${local.foto} ${m.ativo ? '' : local.inativa}`}>
              <img src={m.url} alt={m.titulo} className={local.imagem} />
              <input
                className={styles.input}
                value={m.titulo}
                onChange={(e) => editar(m.id, { titulo: e.target.value })}
                placeholder="Nome (ex: Cardápio físico)"
                aria-label="Nome da foto"
              />
              <textarea
                className={styles.textarea}
                rows={2}
                value={m.quandoEnviar}
                onChange={(e) => editar(m.id, { quandoEnviar: e.target.value })}
                placeholder="Quando mandar (ex: quando pedirem o cardápio ou a promoção do dia)"
                aria-label="Quando mandar"
              />
              <div className={local.acoes}>
                <button type="button" className={styles.botaoSec} onClick={() => editar(m.id, { ativo: !m.ativo })}>
                  {m.ativo ? <><Eye size={14} /> Ativa</> : <><EyeOff size={14} /> Desativada</>}
                </button>
                <button type="button" className={`${styles.botaoSec} ${styles.botaoPerigo}`} onClick={() => remover(m)}>
                  <Trash2 size={14} /> Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.barraSalvar}>
        {alterado && <span className={styles.alterado}>Alterações não salvas</span>}
        <button type="button" className={styles.botao} onClick={salvar} disabled={!alterado || salvando}>
          {salvando ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />} Salvar
        </button>
      </div>
    </div>
  );
}
