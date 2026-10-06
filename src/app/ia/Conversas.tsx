'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pause, Play, MessageCircle, ChevronDown, ChevronUp, Trash2, Plus, AlertTriangle, Bot, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/services/supabase';
import styles from './page.module.css';
import local from './Conversas.module.css';

interface MensagemSalva {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

interface Pausa {
  id: string;
  phone: string;
  is_paused: boolean;
  auto_paused?: boolean;
  auto_unpause_at?: string | null;
  notes?: string | null;
}

interface Linha {
  phone: string;
  nome: string | null;
  mensagens: MensagemSalva[];
  atualizadoEm: string | null;
  pausa: Pausa | null;
  pediuAtendente: boolean;
}

type Filtro = 'todas' | 'pausadas' | 'atendente';

const DURACOES: { label: string; horas: number | null }[] = [
  { label: '1 hora', horas: 1 },
  { label: '3 horas', horas: 3 },
  { label: '24 horas', horas: 24 },
  { label: 'Até eu retomar', horas: null },
];

/** Só dígitos, com DDI: é assim que o bot grava. */
const comDdi = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length >= 12 ? d : `55${d}`;
};

const formatar = (phone: string) =>
  comDdi(phone).replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');

const hora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';

/** Pausa automática que já venceu não conta mais: o bot reativa sozinho. */
const pausaValendo = (p: Pausa | null) =>
  Boolean(p?.is_paused && !(p.auto_paused && p.auto_unpause_at && new Date(p.auto_unpause_at) <= new Date()));

export default function Conversas() {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [aberta, setAberta] = useState<string | null>(null);
  const [menuPausa, setMenuPausa] = useState<string | null>(null);
  const [novoNumero, setNovoNumero] = useState('');
  const [novaNota, setNovaNota] = useState('');

  const carregar = useCallback(async () => {
    const [conversas, pausas, avisos] = await Promise.all([
      supabase.from('bot_conversas').select('phone, nome, mensagens, atualizado_em').order('atualizado_em', { ascending: false }).limit(80),
      supabase.from('bot_paused_numbers').select('id, phone, is_paused, auto_paused, auto_unpause_at, notes'),
      supabase.from('bot_notifications').select('phone').eq('type', 'HUMAN_REQUEST'),
    ]);

    // Tabela da migration 14 ainda não criada: mostra só as pausas
    setSemTabela(Boolean(conversas.error));

    const pausaPor = new Map<string, Pausa>();
    for (const p of (pausas.data ?? []) as Pausa[]) pausaPor.set(comDdi(p.phone), p);
    const pediram = new Set((avisos.data ?? []).map((a) => comDdi(a.phone)));

    const mapa = new Map<string, Linha>();
    for (const c of conversas.data ?? []) {
      const phone = comDdi(c.phone);
      mapa.set(phone, {
        phone,
        nome: c.nome,
        mensagens: c.mensagens ?? [],
        atualizadoEm: c.atualizado_em,
        pausa: pausaPor.get(phone) ?? null,
        pediuAtendente: pediram.has(phone),
      });
    }
    // Número pausado à mão que nunca conversou com o bot também aparece
    for (const [phone, p] of pausaPor) {
      if (!mapa.has(phone)) {
        mapa.set(phone, { phone, nome: null, mensagens: [], atualizadoEm: null, pausa: p, pediuAtendente: pediram.has(phone) });
      }
    }

    setLinhas([...mapa.values()]);
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 10_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  const visiveis = useMemo(() => {
    if (!linhas) return [];
    return linhas.filter((l) =>
      filtro === 'pausadas' ? pausaValendo(l.pausa) : filtro === 'atendente' ? l.pediuAtendente : true
    );
  }, [linhas, filtro]);

  const pausar = async (phone: string, horas: number | null, nota = 'Pausado pelo painel') => {
    setMenuPausa(null);
    const { error } = await supabase.from('bot_paused_numbers').upsert(
      {
        phone,
        is_paused: true,
        paused_at: new Date().toISOString(),
        auto_paused: horas !== null,
        auto_unpause_at: horas !== null ? new Date(Date.now() + horas * 3_600_000).toISOString() : null,
        notes: nota,
      },
      { onConflict: 'phone' }
    );
    if (error) return toast.error('Não consegui pausar');
    toast.success(horas ? `Bot pausado por ${horas}h nessa conversa` : 'Bot pausado até você retomar');
    carregar();
  };

  const retomar = async (l: Linha) => {
    if (!l.pausa) return;
    const { error } = await supabase
      .from('bot_paused_numbers')
      .update({ is_paused: false, auto_unpause_at: null, auto_paused: false })
      .eq('id', l.pausa.id);
    if (error) return toast.error('Não consegui retomar');
    // Atendimento resolvido: tira o aviso de "pediu atendente"
    await supabase.from('bot_notifications').delete().eq('type', 'HUMAN_REQUEST').in('phone', [l.phone, l.phone.slice(2)]);
    toast.success('Bot de volta nessa conversa');
    carregar();
  };

  const apagarHistorico = async (l: Linha) => {
    if (!confirm('Apagar o histórico e o carrinho dessa conversa? O bot começa do zero com esse cliente.')) return;
    const { error } = await supabase.from('bot_conversas').delete().eq('phone', l.phone);
    if (error) return toast.error('Não consegui apagar');
    toast.success('Histórico apagado');
    carregar();
  };

  const adicionar = async () => {
    const digitos = novoNumero.replace(/\D/g, '');
    if (digitos.length < 10) return toast.error('Digite o número com DDD');
    await pausar(comDdi(digitos), null, novaNota.trim() || 'Pausado pelo painel');
    setNovoNumero('');
    setNovaNota('');
  };

  if (!linhas) {
    return <div className={styles.vazio}><Loader2 className={styles.spin} /></div>;
  }

  const contagem = {
    todas: linhas.length,
    pausadas: linhas.filter((l) => pausaValendo(l.pausa)).length,
    atendente: linhas.filter((l) => l.pediuAtendente).length,
  };

  return (
    <div className={styles.secao}>
      {semTabela && (
        <div className={styles.aviso}>
          O histórico das conversas ainda não está disponível: falta rodar a migração <code>14-bot-conversas.sql</code> no banco.
          As pausas funcionam normalmente.
        </div>
      )}

      <div className={local.topo}>
        <div className={local.filtros}>
          {(['todas', 'atendente', 'pausadas'] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`${local.filtro} ${filtro === f ? local.filtroAtivo : ''}`}
              onClick={() => setFiltro(f)}
            >
              {f === 'todas' ? 'Todas' : f === 'atendente' ? 'Pediram atendente' : 'Bot pausado'}
              <span>{contagem[f]}</span>
            </button>
          ))}
        </div>

        <div className={local.adicionar}>
          <input className={styles.input} placeholder="(22) 99999-9999" value={novoNumero} onChange={(e) => setNovoNumero(e.target.value)} aria-label="Número para pausar" />
          <input className={styles.input} placeholder="Motivo (ex: fornecedor)" value={novaNota} onChange={(e) => setNovaNota(e.target.value)} aria-label="Motivo" />
          <button type="button" className={styles.botaoSec} onClick={adicionar} title="O bot nunca responde esse número até você retomar">
            <Plus size={15} /> Pausar número
          </button>
        </div>
      </div>

      {visiveis.length === 0 && (
        <div className={styles.vazio}>
          {filtro === 'todas' ? 'Nenhuma conversa ainda. Assim que um cliente mandar mensagem, ela aparece aqui.' : 'Nada por aqui.'}
        </div>
      )}

      <div className={local.lista}>
        {visiveis.map((l) => {
          const pausado = pausaValendo(l.pausa);
          const ultima = l.mensagens[l.mensagens.length - 1];
          const expandida = aberta === l.phone;

          return (
            <div key={l.phone} className={`${styles.card} ${local.linha} ${l.pediuAtendente ? local.alerta : ''}`}>
              <div className={local.cabeca}>
                <div className={local.quem}>
                  <strong>{l.nome || formatar(l.phone)}</strong>
                  {l.nome && <span>{formatar(l.phone)}</span>}
                </div>

                <div className={local.selos}>
                  {l.pediuAtendente && (
                    <span className={`${local.selo} ${local.seloAlerta}`}><AlertTriangle size={12} /> Pediu atendente</span>
                  )}
                  {pausado ? (
                    <span className={`${local.selo} ${local.seloPausa}`}>
                      <Pause size={12} />
                      {l.pausa?.auto_unpause_at ? `Bot pausado até ${hora(l.pausa.auto_unpause_at)}` : 'Bot pausado'}
                    </span>
                  ) : (
                    <span className={`${local.selo} ${local.seloAtivo}`}><Bot size={12} /> Bot respondendo</span>
                  )}
                </div>
              </div>

              {ultima && (
                <p className={local.previa}>
                  <span>{ultima.role === 'user' ? 'Cliente' : 'Bot'}:</span> {ultima.content.slice(0, 160)}
                  {ultima.content.length > 160 ? '…' : ''}
                  <em>{hora(ultima.at)}</em>
                </p>
              )}
              {!ultima && l.pausa?.notes && <p className={local.previa}>{l.pausa.notes}</p>}

              <div className={local.acoes}>
                {pausado ? (
                  <button type="button" className={styles.botaoSec} onClick={() => retomar(l)}>
                    <Play size={14} /> Retomar bot
                  </button>
                ) : (
                  <div className={local.menuWrap}>
                    <button type="button" className={styles.botaoSec} onClick={() => setMenuPausa(menuPausa === l.phone ? null : l.phone)}>
                      <Pause size={14} /> Pausar bot
                    </button>
                    {menuPausa === l.phone && (
                      <div className={local.menu}>
                        {DURACOES.map((d) => (
                          <button key={d.label} type="button" onClick={() => pausar(l.phone, d.horas)}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <a className={styles.botaoSec} href={`https://wa.me/${l.phone}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} /> Abrir no WhatsApp
                </a>

                {l.mensagens.length > 0 && (
                  <button type="button" className={styles.botaoSec} onClick={() => setAberta(expandida ? null : l.phone)}>
                    {expandida ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {l.mensagens.length} mensagens
                  </button>
                )}

                {l.mensagens.length > 0 && (
                  <button type="button" className={`${styles.botaoSec} ${styles.botaoPerigo}`} onClick={() => apagarHistorico(l)} title="Apagar histórico">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {expandida && (
                <div className={local.chat}>
                  {l.mensagens.map((m, i) => (
                    <div key={i} className={`${local.bolha} ${m.role === 'user' ? local.cliente : local.bot}`}>
                      <span className={local.autor}>
                        {m.role === 'user' ? <User size={11} /> : <Bot size={11} />} {m.role === 'user' ? 'Cliente' : 'Bot'} · {hora(m.at)}
                      </span>
                      {m.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
