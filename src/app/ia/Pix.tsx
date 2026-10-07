'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Plus, X, ExternalLink, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/services/supabase';
import { getBotSetting, setBotSetting } from '@/services/botSettings';
import { normalizarPix, pixPronto, PIX_KEY, type PixConfig, type TipoChave } from '@/lib/bot/config';
import styles from './page.module.css';
import local from './Pix.module.css';

const TIPOS: { id: TipoChave; label: string; exemplo: string }[] = [
  { id: 'cpf', label: 'CPF', exemplo: '123.456.789-09' },
  { id: 'cnpj', label: 'CNPJ', exemplo: '12.345.678/0001-90' },
  { id: 'telefone', label: 'Telefone', exemplo: '(22) 99999-9999' },
  { id: 'email', label: 'E-mail', exemplo: 'pix@3porquinhos.com.br' },
  { id: 'aleatoria', label: 'Aleatória', exemplo: 'a1b2c3d4-...' },
];

interface Tentativa {
  id: number;
  order_id: number | null;
  outcome: string;
  reason: string | null;
  amount_cents: number | null;
  receipt_path: string | null;
  created_at: string;
  detalhe: { leitura?: { nome_recebedor?: string | null; nome_pagador?: string | null; data_hora?: string | null } } | null;
}

const moeda = (centavos: number | null) =>
  centavos == null ? '—' : (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Pix() {
  const [pix, setPix] = useState<PixConfig | null>(null);
  const [original, setOriginal] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [tentativas, setTentativas] = useState<Tentativa[]>([]);

  const carregarTentativas = useCallback(async () => {
    const { data } = await supabase
      .from('payment_attempts')
      .select('id, order_id, outcome, reason, amount_cents, receipt_path, created_at, detalhe')
      .eq('provider', 'pix_manual')
      .order('created_at', { ascending: false })
      .limit(30);
    setTentativas((data ?? []) as Tentativa[]);
  }, []);

  useEffect(() => {
    getBotSetting(PIX_KEY)
      .then((v) => {
        const p = normalizarPix(v);
        setPix(p);
        setOriginal(JSON.stringify(p));
      })
      .catch((e) => {
        console.error(e);
        toast.error('Não consegui carregar o Pix');
      });
    carregarTentativas();
    const intervalo = setInterval(carregarTentativas, 15_000);
    return () => clearInterval(intervalo);
  }, [carregarTentativas]);

  if (!pix) {
    return <div className={styles.vazio}><Loader2 className={styles.spin} /></div>;
  }

  const set = <K extends keyof PixConfig>(k: K, v: PixConfig[K]) => setPix({ ...pix, [k]: v });
  const alterado = JSON.stringify(pix) !== original;
  const tipo = TIPOS.find((t) => t.id === pix.tipoChave)!;

  const adicionarNome = () => {
    const n = novoNome.trim();
    if (!n) return;
    if (!pix.nomesRecebedor.some((x) => x.toLowerCase() === n.toLowerCase())) set('nomesRecebedor', [...pix.nomesRecebedor, n]);
    setNovoNome('');
  };

  const salvar = async () => {
    if (pix.ativo && !pixPronto(pix)) {
      toast.error('Para ligar, preencha a chave e pelo menos um nome de recebedor');
      return;
    }
    setSalvando(true);
    try {
      await setBotSetting(PIX_KEY, pix);
      setOriginal(JSON.stringify(pix));
      toast.success('Pix salvo! Vale a partir da próxima mensagem.');
    } catch (e) {
      console.error(e);
      toast.error('Não consegui salvar');
    } finally {
      setSalvando(false);
    }
  };

  const verComprovante = async (caminho: string) => {
    // Bucket privado: link assinado que vale 5 minutos
    const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(caminho, 300);
    if (error || !data?.signedUrl) return toast.error('Não consegui abrir o comprovante');
    window.open(data.signedUrl, '_blank');
  };

  return (
    <div className={styles.secao}>
      <div className={styles.aviso}>
        <ShieldAlert size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
        A IA confere valor, recebedor, data e hora do comprovante e se ele já foi usado — mas <strong>não vê o extrato do banco</strong>.
        Comprovante falso bem feito passa. Aprovado, o pedido vai direto para a cozinha. Vale dar uma olhada no app do banco de vez em quando
        e na lista abaixo.
      </div>

      <div className={styles.card}>
        <div className={styles.toggle}>
          <div>
            <strong>Aceitar Pix na chave pelo WhatsApp</strong>
            <span>O atendente oferece a chave, o cliente paga e manda o comprovante, e a IA confere.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pix.ativo}
            aria-label="Aceitar Pix na chave"
            className={`${styles.switch} ${pix.ativo ? styles.switchOn : ''}`}
            onClick={() => set('ativo', !pix.ativo)}
          />
        </div>

        <div className={local.grade}>
          <div className={styles.campo}>
            <label htmlFor="tipo">Tipo de chave</label>
            <select id="tipo" className={styles.select} value={pix.tipoChave} onChange={(e) => set('tipoChave', e.target.value as TipoChave)}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.campo}>
            <label htmlFor="chave">Chave Pix</label>
            <input id="chave" className={styles.input} placeholder={tipo.exemplo} value={pix.chave} onChange={(e) => set('chave', e.target.value)} />
          </div>

          <div className={styles.campo}>
            <label htmlFor="banco">Banco</label>
            <input id="banco" className={styles.input} placeholder="Ex: Nubank, Inter, Itaú" value={pix.banco} onChange={(e) => set('banco', e.target.value)} />
          </div>
        </div>

        <div className={styles.campo} style={{ marginTop: 14 }}>
          <span className={styles.rotulo}>Nome de quem recebe (como aparece no comprovante)</span>
          <span className={styles.ajuda}>
            Coloque o nome do titular da conta e, se for empresa, a razão social. A IA aceita abreviação do banco (ex: “NATAN S PEREIRA”).
          </span>
          <div className={local.nomes}>
            {pix.nomesRecebedor.map((n) => (
              <span key={n} className={local.nome}>
                {n}
                <button type="button" aria-label={`Tirar ${n}`} onClick={() => set('nomesRecebedor', pix.nomesRecebedor.filter((x) => x !== n))}>
                  <X size={13} />
                </button>
              </span>
            ))}
            <form
              className={local.addNome}
              onSubmit={(e) => {
                e.preventDefault();
                adicionarNome();
              }}
            >
              <input className={styles.input} placeholder="Nome completo do titular" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} aria-label="Nome do recebedor" />
              <button type="submit" className={styles.botaoSec}><Plus size={14} /> Adicionar</button>
            </form>
          </div>
        </div>
      </div>

      <div className={styles.barraSalvar}>
        {alterado && <span className={styles.alterado}>Alterações não salvas</span>}
        <button type="button" className={styles.botao} onClick={salvar} disabled={!alterado || salvando}>
          {salvando ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />} Salvar
        </button>
      </div>

      <div className={styles.secaoTopo}>
        <div>
          <h2>Últimos comprovantes</h2>
          <p>O que a IA leu e por que aprovou ou recusou.</p>
        </div>
      </div>

      {tentativas.length === 0 ? (
        <div className={styles.vazio}>Nenhum comprovante recebido ainda.</div>
      ) : (
        <div className={local.lista}>
          {tentativas.map((t) => {
            const ok = t.outcome === 'PAID';
            const l = t.detalhe?.leitura;
            return (
              <div key={t.id} className={`${styles.card} ${local.tentativa}`}>
                <div className={local.status}>
                  {ok ? <CheckCircle2 size={18} color="#059669" /> : <XCircle size={18} color="#dc2626" />}
                  <strong>Pedido #{t.order_id ?? '—'}</strong>
                  <span className={ok ? local.aprovado : local.recusado}>{ok ? 'Aprovado' : t.outcome === 'REJECTED_IA' ? 'Recusado pela IA' : t.outcome}</span>
                </div>
                <div className={local.info}>
                  <span>{moeda(t.amount_cents)}</span>
                  {l?.nome_pagador && <span>de {l.nome_pagador}</span>}
                  {l?.nome_recebedor && <span>para {l.nome_recebedor}</span>}
                  {l?.data_hora && <span>{l.data_hora}</span>}
                  <span className={local.quando}>{new Date(t.created_at).toLocaleString('pt-BR')}</span>
                </div>
                {!ok && t.reason && <p className={local.motivo}>{t.reason}</p>}
                {t.receipt_path && (
                  <button type="button" className={styles.botaoSec} onClick={() => verComprovante(t.receipt_path!)}>
                    <ExternalLink size={14} /> Ver comprovante
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
