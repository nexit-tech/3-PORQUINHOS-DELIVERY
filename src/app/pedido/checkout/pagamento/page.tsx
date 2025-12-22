'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Banknote, QrCode, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import styles from './page.module.css';

export default function PagamentoPage() {
  const router = useRouter();
  const { cartSubtotal, deliveryFee, placeOrder } = useCart();
  
  const [method, setMethod] = useState('pix');
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [changeValue, setChangeValue] = useState('');

  const total = cartSubtotal + deliveryFee;

  const handlePreFinish = () => {
    if (method === 'cash') {
      setIsCashModalOpen(true);
    } else {
      finalizeOrder(getMethodLabel(method));
    }
  };

  const finalizeOrder = (paymentDetails: string) => {
    placeOrder(paymentDetails);
    router.push('/pedido/historico');
  };

  const getMethodLabel = (key: string) => {
    switch (key) {
      case 'pix': return 'Pix (Na entrega)';
      case 'card': return 'Cartão (Na entrega)';
      case 'cash': return 'Dinheiro (Na entrega)';
      default: return key;
    }
  };

  const confirmChange = () => {
    if (!changeValue) {
      alert('Digite o valor para o troco');
      return;
    }
    const val = parseFloat(changeValue.replace(',', '.'));
    if (val < total) {
      alert(`O valor deve ser maior que o total do pedido (${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`);
      return;
    }
    finalizeOrder(`Dinheiro (Troco para R$ ${changeValue})`);
  };

  const confirmNoChange = () => {
    finalizeOrder('Dinheiro (Sem troco)');
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido/checkout/endereco" className={styles.iconBtn}><ArrowLeft size={24} /></Link>
        <h1>Pagamento</h1>
        <div style={{width: 24}}/>
      </header>

      <div className={styles.content}>
        <h2 className={styles.sectionTitle}>Pagamento na Entrega</h2>
        <p className={styles.subtitle}>Escolha como deseja pagar ao receber seu pedido.</p>
        
        <div className={styles.options}>
          {/* PIX NA ENTREGA */}
          <button 
            className={`${styles.option} ${method === 'pix' ? styles.active : ''}`}
            onClick={() => setMethod('pix')}
          >
            <div className={styles.iconBox}><QrCode size={24} /></div>
            <div className={styles.info}>
              <span>Pix</span>
              <small>Pague ao entregador</small>
            </div>
            <div className={styles.radio}>{method === 'pix' && <div className={styles.dot}/>}</div>
          </button>

          {/* CARTÃO NA ENTREGA */}
          <button 
            className={`${styles.option} ${method === 'card' ? styles.active : ''}`}
            onClick={() => setMethod('card')}
          >
            <div className={styles.iconBox}><CreditCard size={24} /></div>
            <div className={styles.info}>
              <span>Cartão</span>
              <small>Levamos a maquininha</small>
            </div>
            <div className={styles.radio}>{method === 'card' && <div className={styles.dot}/>}</div>
          </button>

          {/* DINHEIRO NA ENTREGA */}
          <button 
            className={`${styles.option} ${method === 'cash' ? styles.active : ''}`}
            onClick={() => setMethod('cash')}
          >
            <div className={styles.iconBox}><Banknote size={24} /></div>
            <div className={styles.info}>
              <span>Dinheiro</span>
              <small>Precisa de troco?</small>
            </div>
            <div className={styles.radio}>{method === 'cash' && <div className={styles.dot}/>}</div>
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.totalRow}>
          <span>Total a pagar</span>
          <span className={styles.totalValue}>
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
        <button className={styles.finishBtn} onClick={handlePreFinish}>
          Fazer Pedido
        </button>
      </div>

      {/* MODAL DE TROCO (Mantido igual) */}
      {isCashModalOpen && (
        <div className={styles.modalOverlay} onClick={(e) => {
          if(e.target === e.currentTarget) setIsCashModalOpen(false);
        }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Pagamento em Dinheiro</h3>
              <button onClick={() => setIsCashModalOpen(false)}><X size={24} /></button>
            </div>
            <div className={styles.modalBody}>
              <p>Você vai precisar de troco?</p>
              <button className={styles.noChangeBtn} onClick={confirmNoChange}>
                Não preciso de troco
              </button>
              <div className={styles.divider}><span>OU</span></div>
              <div className={styles.changeInputGroup}>
                <label>Preciso de troco para:</label>
                <div className={styles.inputWrapper}>
                  <span>R$</span>
                  <input 
                    type="number" 
                    placeholder="Ex: 50,00" 
                    value={changeValue}
                    onChange={(e) => setChangeValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <button className={styles.confirmChangeBtn} onClick={confirmChange}>
                  Confirmar Valor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}