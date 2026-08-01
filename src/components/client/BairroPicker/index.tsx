'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Search, Check, X, Loader2, ChevronDown } from 'lucide-react';
import styles from './styles.module.css';

export interface DeliveryZone {
  id: string;
  neighborhood: string;
  fee: number;
}

interface Props {
  zones: DeliveryZone[];
  selected: DeliveryZone | null;
  loading: boolean;
  onSelect: (zone: DeliveryZone) => void;
}

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Faixa dos acentos que o NFD separa da letra (U+0300 a U+036F).
 * Montada por código em vez de literal: escrita direta, a regex fica com
 * caracteres combinantes invisíveis no editor e some numa troca de encoding.
 */
const ACENTOS = new RegExp(
  '[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']',
  'g'
);

/** Compara sem acento e sem caixa: quem digita "sao jose" acha "São José". */
const normaliza = (s: string) =>
  s.normalize('NFD').replace(ACENTOS, '').toLowerCase();

/**
 * Escolha do bairro de entrega numa folha que sobe do rodapé.
 *
 * Era um dropdown inline. O rodapé desta tela é `position: fixed` com o
 * resumo e o botão de pagamento, e a lista de bairros abria por baixo dele:
 * a partir do quinto item o cliente não conseguia nem ver nem tocar no
 * resto. Nenhum ajuste de padding resolve para uma lista que muda de
 * tamanho conforme a loja cadastra zonas.
 *
 * Mesmo padrão do CouponPicker — portal, overlay, alça e rolagem própria —
 * para as duas escolhas do checkout se comportarem igual.
 */
export default function BairroPicker({ zones, selected, loading, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busca, setBusca] = useState('');
  const itemSelecionado = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Trava o scroll do fundo e fecha no Esc enquanto a folha está aberta.
  useEffect(() => {
    if (!open) return;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onEsc);

    // Reabriu já tendo escolhido? Mostra a escolha atual sem obrigar a rolar.
    itemSelecionado.current?.scrollIntoView({ block: 'center' });

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtrados = useMemo(() => {
    const termo = normaliza(busca.trim());
    if (!termo) return zones;
    return zones.filter((z) => normaliza(z.neighborhood).includes(termo));
  }, [zones, busca]);

  // Busca só quando a lista justifica. Com poucos bairros o campo é ruído
  // — e no celular ainda rouba a primeira linha da folha.
  const mostrarBusca = zones.length > 8;

  const fechar = () => {
    setOpen(false);
    setBusca('');
  };

  const escolher = (zona: DeliveryZone) => {
    onSelect(zona);
    fechar();
  };

  const folha = (
    // A folha vai para o document.body, fora do <div class="loja"> do
    // layout. Sem este invólucro os tokens da loja não chegariam aqui e a
    // folha sairia sem cor. Ele não pinta nada: só tem filho fixed.
    <div className="loja">
      <div
        className={styles.overlay}
        onClick={(e) => e.target === e.currentTarget && fechar()}
      >
        <div className={styles.folha} role="dialog" aria-modal="true" aria-label="Bairro de entrega">
          <div className={styles.alca} />

          <header className={styles.cabecalho}>
            <div>
              <h3>Bairro de entrega</h3>
              <span>
                {zones.length === 1
                  ? '1 bairro atendido'
                  : `${zones.length} bairros atendidos`}
              </span>
            </div>
            <button type="button" onClick={fechar} className={styles.fechar} aria-label="Fechar">
              <X size={22} />
            </button>
          </header>

          {mostrarBusca && (
            <div className={styles.buscaBox}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar bairro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar bairro"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className={styles.limpar}
                  aria-label="Limpar busca"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          )}

          <div className={styles.corpo}>
            {filtrados.length === 0 ? (
              <div className={styles.vazio}>
                <MapPin size={22} />
                <strong>Não atendemos esse bairro</strong>
                <p>Confira a escrita ou veja a lista completa.</p>
                <button type="button" onClick={() => setBusca('')} className={styles.vazioBotao}>
                  Ver todos os bairros
                </button>
              </div>
            ) : (
              <ul className={styles.lista}>
                {filtrados.map((zona) => {
                  const ativo = selected?.id === zona.id;

                  return (
                    <li key={zona.id}>
                      <button
                        type="button"
                        ref={ativo ? itemSelecionado : null}
                        className={`${styles.item} ${ativo ? styles.itemAtivo : ''}`}
                        onClick={() => escolher(zona)}
                      >
                        <span className={styles.itemNome}>
                          {ativo && <Check size={15} className={styles.itemCheck} />}
                          {zona.neighborhood}
                        </span>
                        <span className={styles.itemTaxa}>
                          {zona.fee > 0 ? moeda(zona.fee) : 'Grátis'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={styles.gatilho}
        onClick={() => !loading && setOpen(true)}
        disabled={loading}
      >
        {loading ? (
          <span className={styles.gatilhoVazio}>Carregando bairros...</span>
        ) : selected ? (
          <span className={styles.gatilhoInfo}>
            <span className={styles.gatilhoNome}>{selected.neighborhood}</span>
            <span className={styles.gatilhoTaxa}>
              Taxa: {selected.fee > 0 ? moeda(selected.fee) : 'Grátis'}
            </span>
          </span>
        ) : (
          <span className={styles.gatilhoVazio}>Selecione um bairro</span>
        )}

        {loading ? (
          <Loader2 size={20} className={styles.girando} />
        ) : (
          <ChevronDown size={20} className={styles.seta} />
        )}
      </button>

      {mounted && open && createPortal(folha, document.body)}
    </>
  );
}
