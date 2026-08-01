'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import Image from 'next/image'; 
import { Minus, Plus, Check, ChevronLeft } from 'lucide-react';
import { useCart, CartItem } from '@/context/CartContext';
import { Product, ComplementOption, ComplementGroup } from '@/types/product';
import styles from './styles.module.css';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  initialData?: CartItem | null;
}

export default function ProductModal({ product, onClose, initialData }: ProductModalProps) {
  const { addToCart, editCartItem } = useCart();

  // --- 1. TODOS OS HOOKS PRIMEIRO (SEM 'IF' NO MEIO) ---
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [selections, setSelections] = useState<Record<string, ComplementOption[]>>({});
  const [isClosing, setIsClosing] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    setMounted(true);
    if (initialData) {
      setQuantity(initialData.quantity);
      setObservation(initialData.observation || '');
      
      if ((initialData as any).selections) {
        setSelections((initialData as any).selections);
      }
    }
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = ''; 
    };
  }, [initialData]);

  // MOVI OS USEMEMO PARA CÁ (ANTES DO RETURN)
  const unitPrice = useMemo(() => {
    if (!product) return 0; // Proteção interna
    let price = product.price;
    Object.values(selections).flat().forEach(opt => { price += Number(opt.price); });
    return price;
  }, [product, selections]);

  const total = unitPrice * quantity;

  const isValid = useMemo(() => {
    if (!product || !product.complements) return true;
    return product.complements.every(group => {
      const selectedCount = (selections[group.id] || []).length;
      return selectedCount >= group.min;
    });
  }, [product, selections]);

  // Quanto da foto ainda aparece: 1 = inteira, 0 = escondida. Encolhe
  // conforme o cliente rola a lista de sabores, liberando tela para a
  // escolha — que é o que ele veio fazer.
  const [fotoVisivel, setFotoVisivel] = useState(1);

  // Referências dos grupos, para pular ao próximo depois de escolher.
  const gruposRef = useRef<Record<string, HTMLDivElement | null>>({});
  const corpoRef = useRef<HTMLDivElement | null>(null);

  // --- 2. AGORA SIM O RETURN CONDICIONAL ---
  if (!product || !mounted) return null;

  // --- LÓGICA DE FUNÇÕES ---
  const handleToggleOption = (group: ComplementGroup, option: ComplementOption) => {
    setSelections(prev => {
      const currentSelected = prev[group.id] || [];
      const isSelected = currentSelected.find(o => o.id === option.id);
      if (isSelected) {
        return { ...prev, [group.id]: currentSelected.filter(o => o.id !== option.id) };
      }
      if (group.max === 1) {
        // Escolha única: já está resolvido, então leva ao próximo grupo.
        // Só quando é uma NOVA escolha — se o cliente está trocando de
        // ideia num grupo lá atrás, pular seria sequestrar a rolagem.
        if (!isSelected) irParaProximoGrupo(group.id);
        return { ...prev, [group.id]: [option] };
      } else {
        if (currentSelected.length >= group.max) return prev; 
        return { ...prev, [group.id]: [...currentSelected, option] };
      }
    });
  };

  /** Rola até o grupo seguinte ao informado. */
  const irParaProximoGrupo = (grupoAtualId: string) => {
    const grupos = product.complements || [];
    const i = grupos.findIndex((g) => g.id === grupoAtualId);
    const proximo = grupos[i + 1];
    if (!proximo || !corpoRef.current) return;

    const alvo = gruposRef.current[proximo.id];
    if (!alvo) return;

    // Espera o React pintar a marcação antes de rolar, senão a animação
    // começa da posição antiga e dá um solavanco.
    requestAnimationFrame(() => {
      const corpo = corpoRef.current;
      if (!corpo) return;
      corpo.scrollTo({
        top: alvo.offsetTop - corpo.offsetTop - 8,
        behavior: 'smooth',
      });
    });
  };

  /** Encolhe a foto conforme a lista rola. */
  const aoRolar = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    // 190px de rolagem consomem a foto inteira. Menos que isso e ela
    // sumia com um toque de scroll; mais, e nunca terminava de sair.
    const restante = Math.min(1, Math.max(0, 1 - y / 190));
    setFotoVisivel((antes) => (Math.abs(antes - restante) > 0.01 ? restante : antes));
  };

  const handleSave = () => {
    if (!isValid) {
      alert('Verifique os itens obrigatórios!');
      return;
    }
    
    const allSelectedOptions = Object.values(selections).flat().map(opt => ({ name: opt.name, price: opt.price }));
    const flavors = allSelectedOptions.map(o => o.name); 
    
    const itemPayload = { 
      quantity, 
      observation, 
      customizations: allSelectedOptions, 
      flavors: flavors, 
      extras: [], 
      totalPrice: total,
      selections: selections 
    };

    if (initialData) {
      editCartItem(initialData.uuid, itemPayload);
      handleClose();
    } else {
      addToCart({
        product: { ...product, desc: product.description || '' } as any, 
        ...itemPayload
      });
      setShowToast(true);
      setTimeout(() => handleClose(), 1500);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => { 
    if ((e.target as HTMLElement).closest(`.${styles.body}`)) return; 
    setIsDragging(true); 
    startY.current = e.touches[0].clientY; 
  };
  
  const handleTouchMove = (e: React.TouchEvent) => { 
    if (!isDragging) return; 
    const diff = e.touches[0].clientY - startY.current; 
    if (diff > 0) setOffsetY(diff); 
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);

    if (offsetY > 150) {
      handleClose();
    } else {
      setOffsetY(0);
    }
  };
  
  const handleClose = () => { 
    setIsClosing(true); 
    setTimeout(() => { 
      onClose(); 
      setIsClosing(false); 
      setOffsetY(0); 
      setShowToast(false); 
    }, 300); 
  };

  // --- RENDERIZAÇÃO VIA PORTAL ---
  // A classe .loja precisa vir junto: o portal monta no document.body, fora
  // da árvore do layout, então nenhum token de loja.css chega aqui sozinho —
  // inclusive a regra que mantém os campos em 16px para o Safari do iOS não
  // dar zoom ao focar a observação.
  return createPortal(
    <div className={`loja ${styles.overlay} ${isClosing ? styles.fadeOut : ''}`} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      {showToast && <div className={styles.toast}><Check size={20} /><span>Adicionado!</span></div>}
      
      {/* Página cheia: sem transform de arrasto. O gesto de puxar para
          baixo saiu junto com a alça — em página, arrastar o conteúdo
          para fechar não é comportamento esperado. Quem fecha é o
          botão de voltar. */}
      <div className={styles.modal}>

        <div className={styles.dragHeader}>
          <div className={styles.dragHandle} />
          
          <div className={styles.imageHeader}>
             {/* Voltar sobre a foto. A alça de arrastar só existe no
                 toque — no desktop não havia saída além do clique fora,
                 que ninguém adivinha. */}
             <button
               className={styles.voltar}
               onClick={handleClose}
               aria-label="Voltar ao cardápio"
             >
               <ChevronLeft size={22} strokeWidth={2.6} />
             </button>

             <div
               className={styles.imgPlaceholder}
               style={{
                 height: `${320 * fotoVisivel}px`,
                 opacity: 0.25 + 0.75 * fotoVisivel,
               }}
             >
               {product.image && (
                 <Image 
                   src={product.image} 
                   alt={product.name}
                   fill
                   sizes="(max-width: 768px) 100vw, 400px" 
                   priority={true} 
                   quality={60} 
                   className={styles.modalImage}
                 />
               )}
             </div>
          </div>

          <div
            className={styles.headerInfo}
            style={{
              // A folha só precisa subir por cima da foto ENQUANTO existe
              // foto. Com -24px fixo, ao encolher ela puxava o conteúdo
              // para fora do topo e cortava o título.
              marginTop: `${-24 * fotoVisivel}px`,
              // E abre espaço para o botão de voltar conforme a foto some,
              // senão ele fica em cima da descrição.
              paddingTop: `${22 + (1 - fotoVisivel) * 30}px`,
            }}
          >
            <h2>{product.name}</h2>
            <p className={styles.desc}>{product.description}</p>
          </div>
        </div>

        <div className={styles.body} ref={corpoRef} onScroll={aoRolar}>
          {product.complements?.map(group => {
            const currentSelected = selections[group.id] || [];
            const count = currentSelected.length;
            const isSatisfied = count >= group.min;
            const isMaxReached = count >= group.max;

            return (
              <div
                key={group.id}
                className={styles.group}
                ref={(el) => {
                  gruposRef.current[group.id] = el;
                }}
              >
                <div className={styles.groupHeader}>
                  <div className={styles.groupTitleRow}>
                    <h3>{group.name}</h3>
                    {!isSatisfied && <span className={styles.requiredBadge}>Obrigatório</span>}
                  </div>
                  <span className={styles.limitBadge}>{group.min > 0 ? `Min: ${group.min}` : ''} {group.max > 1 ? `Max: ${group.max}` : (group.max === 1 ? 'Escolha 1' : '')}</span>
                </div>
                <div className={styles.optionsList}>
                  {group.options.map(option => {
                    const isSelected = currentSelected.some(o => o.id === option.id);
                    const disabled = !isSelected && isMaxReached && group.max > 1;
                    return (
                      <label key={option.id} className={`${styles.optionRow} ${disabled ? styles.disabledRow : ''}`}>
                        <div className={styles.optionInfo}>
                          <span className={styles.optionTitle}>{option.name}</span>
                          {option.price > 0 && <span className={styles.optionPrice}>+ {option.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                        </div>
                        <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>{isSelected && <Check size={12} color="white" />}</div>
                        <input type="checkbox" hidden checked={isSelected} onChange={() => handleToggleOption(group, option)} disabled={disabled} />
                      </label>
                    );
                  })}
                </div>
                <div className={styles.divider} />
              </div>
            );
          })}
          <div className={styles.group}>
            <div className={styles.groupHeader}><h3>Observações</h3></div>
            <textarea className={styles.textarea} placeholder="Ex: Sem cebola..." rows={3} value={observation} onChange={(e) => setObservation(e.target.value)} />
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.quantityControl}>
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className={styles.qtdBtn}><Minus size={18}/></button>
            <span className={styles.qtdNumber}>{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)} className={styles.qtdBtn}><Plus size={18}/></button>
          </div>
          <button className={styles.addBtn} onClick={handleSave} disabled={!isValid} style={{ opacity: isValid ? 1 : 0.6 }}>
            <span>{initialData ? 'Atualizar' : 'Adicionar'}</span>
            <span className={styles.totalPrice}>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}