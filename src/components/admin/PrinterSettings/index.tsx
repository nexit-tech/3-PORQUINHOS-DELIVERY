'use client';

import { useState, useEffect } from 'react';
import { Printer, Check, Settings2, FileText } from 'lucide-react';
import { printReceipt } from '@/utils/printReceipt';
import styles from './styles.module.css';

// Mock de pedido para teste
const TEST_ORDER: any = {
  id: 'TESTE-123',
  customer: { name: 'Cliente Teste', phone: '11999999999' },
  address: { street: 'Rua das Flores', number: '123', neighborhood: 'Centro', city: 'São Paulo' },
  items: [
    { quantity: 2, price: 25.00, product: { name: 'X-Bacon' }, observation: 'Sem cebola' },
    { quantity: 1, price: 8.00, product: { name: 'Coca Cola' } }
  ],
  total: 58.00,
  deliveryFee: 5.00,
  paymentMethod: 'credit_card'
};

export default function PrinterSettings() {
  const [copies, setCopies] = useState(1);
  const [autoPrint, setAutoPrint] = useState(true);

  // Carregar configurações salvas
  useEffect(() => {
    const savedCopies = localStorage.getItem('printer_copies');
    const savedAuto = localStorage.getItem('printer_auto');
    if (savedCopies) setCopies(Number(savedCopies));
    if (savedAuto) setAutoPrint(savedAuto === 'true');
  }, []);

  const handleSave = () => {
    localStorage.setItem('printer_copies', String(copies));
    localStorage.setItem('printer_auto', String(autoPrint));
    alert('Configurações de impressão salvas!');
  };

  const handleTestPrint = () => {
    printReceipt(TEST_ORDER, 1);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleWrapper}>
          <div className={styles.iconBox}>
            <Printer size={24} />
          </div>
          <div>
            <h3>Impressora Térmica</h3>
            <p>Configure a impressão automática de pedidos</p>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        
        {/* Controle de Cópias */}
        <div className={styles.row}>
          <label>Número de Cópias:</label>
          <div className={styles.counter}>
            <button onClick={() => setCopies(c => Math.max(1, c - 1))}>-</button>
            <span>{copies}</span>
            <button onClick={() => setCopies(c => c + 1)}>+</button>
          </div>
        </div>

        {/* Toggle Auto Print */}
        <div className={styles.row}>
          <label className={styles.checkboxLabel}>
            <input 
              type="checkbox" 
              checked={autoPrint} 
              onChange={e => setAutoPrint(e.target.checked)} 
            />
            <span>Imprimir automaticamente ao aceitar pedido</span>
          </label>
        </div>

        <div className={styles.actions}>
          <button onClick={handleTestPrint} className={styles.testBtn}>
            <FileText size={18} />
            Testar Impressão
          </button>
          
          <button onClick={handleSave} className={styles.saveBtn}>
            <Check size={18} />
            Salvar Config
          </button>
        </div>
        
        <p className={styles.hint}>
          * Ao clicar em imprimir, selecione sua impressora térmica na janela do sistema e verifique as margens.
        </p>
      </div>
    </div>
  );
}