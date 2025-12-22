'use client';

import { useState } from 'react';
import { CreditCard, Trash2, Plus, Banknote, QrCode, Wallet } from 'lucide-react';
import styles from './styles.module.css';

interface PaymentMethod {
  id: string;
  name: string;
}

const INITIAL_METHODS: PaymentMethod[] = [
  { id: '1', name: 'Cartão de Crédito' },
  { id: '2', name: 'Cartão de Débito' },
  { id: '3', name: 'Pix' },
  { id: '4', name: 'Dinheiro' },
];

export default function PaymentSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>(INITIAL_METHODS);
  const [newMethodName, setNewMethodName] = useState('');

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('pix')) return <QrCode size={20} color="#10b981" />;
    if (n.includes('dinheiro') || n.includes('cash')) return <Banknote size={20} color="#85bb65" />;
    if (n.includes('vale') || n.includes('refeição')) return <Wallet size={20} color="#f59e0b" />;
    return <CreditCard size={20} color="var(--primary-color)" />;
  };

  const addMethod = () => {
    if (!newMethodName.trim()) return;
    
    const newMethod: PaymentMethod = {
      id: Math.random().toString(),
      name: newMethodName
    };

    setMethods([...methods, newMethod]);
    setNewMethodName('');
  };

  const removeMethod = (id: string) => {
    setMethods(methods.filter(m => m.id !== id));
  };

  return (
    <div className={styles.container}>
      {/* HEADER REMOVIDO PARA EVITAR DUPLICIDADE COM O MODAL */}
      
      <div className={styles.content}>
        <div className={styles.list}>
          {methods.map(method => (
            <div key={method.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.iconBox}>
                  {getIcon(method.name)}
                </div>
                <span className={styles.name}>{method.name}</span>
              </div>
              <button onClick={() => removeMethod(method.id)} className={styles.deleteBtn}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {methods.length === 0 && (
            <p className={styles.empty}>Nenhuma forma de pagamento ativa.</p>
          )}
        </div>

        <div className={styles.addBoxWrapper}>
          <div className={styles.addBox}>
            <input 
              placeholder="Nova forma de pagamento (Ex: Vale Refeição)" 
              value={newMethodName}
              onChange={e => setNewMethodName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMethod()}
              className={styles.inputName}
            />
            <button onClick={addMethod} className={styles.addBtn} disabled={!newMethodName}>
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={() => alert('Pagamentos salvos!')}>
          Salvar Alterações
        </button>
      </footer>
    </div>
  );
}