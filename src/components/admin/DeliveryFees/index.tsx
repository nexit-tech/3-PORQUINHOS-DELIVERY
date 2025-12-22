'use client';

import { useState } from 'react';
import { Plus, Trash2, MapPin } from 'lucide-react'; // Removi 'Bike' pois não usa mais no header
import styles from './styles.module.css';

interface DeliveryFee {
  id: string;
  name: string;
  price: number;
}

export default function DeliveryFees() {
  const [fees, setFees] = useState<DeliveryFee[]>([
    { id: '1', name: 'Centro / Até 2km', price: 5.00 },
    { id: '2', name: 'Bairros Vizinhos (2-5km)', price: 8.00 },
    { id: '3', name: 'Zona Rural', price: 15.00 },
  ]);

  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePriceInput = (value: string) => {
    const numeric = value.replace(/\D/g, '');
    const float = Number(numeric) / 100;
    setNewPrice(float.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  const addFee = () => {
    if (!newName || !newPrice) return;
    
    const rawPrice = Number(newPrice.replace(/\D/g, '')) / 100;
    
    const newFee: DeliveryFee = {
      id: Math.random().toString(),
      name: newName,
      price: rawPrice
    };

    setFees([...fees, newFee]);
    setNewName('');
    setNewPrice('');
  };

  const removeFee = (id: string) => {
    setFees(fees.filter(f => f.id !== id));
  };

  return (
    <div className={styles.container}>
      {/* Header removido para não duplicar com o Modal */}

      <div className={styles.content}>
        <div className={styles.list}>
          {fees.map(fee => (
            <div key={fee.id} className={styles.row}>
              <div className={styles.info}>
                <MapPin size={16} className={styles.icon} />
                <span className={styles.name}>{fee.name}</span>
              </div>
              
              {/* Container de Ações: Preço + Lixeira alinhados */}
              <div className={styles.actions}>
                <span className={styles.price}>{formatCurrency(fee.price)}</span>
                <button onClick={() => removeFee(fee.id)} className={styles.deleteBtn} title="Remover taxa">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          
          {fees.length === 0 && (
            <p className={styles.empty}>Nenhuma taxa cadastrada.</p>
          )}
        </div>

        <div className={styles.addBoxWrapper}>
          <div className={styles.addBox}>
            <h3>Adicionar Nova Área</h3>
            <div className={styles.formRow}>
              <input 
                placeholder="Nome da Área (Ex: Centro)" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={styles.inputName}
              />
              <input 
                placeholder="R$ 0,00" 
                value={newPrice}
                onChange={e => handlePriceInput(e.target.value)}
                className={styles.inputPrice}
              />
              <button onClick={addFee} className={styles.addBtn}>
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <button className={styles.saveBtn} onClick={() => alert('Taxas salvas!')}>
          Salvar Alterações
        </button>
      </footer>
    </div>
  );
}