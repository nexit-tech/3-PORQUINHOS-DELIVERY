'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
// Importe seu componente de Modal visual aqui (estou usando um genérico como exemplo)
import Modal from '@/components/common/Modal'; 
import styles from './styles.module.css'; // Assumindo que você tem/criará um CSS básico

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Para recarregar a lista
}

export default function CategoryModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const { createCategory, loading } = useAdmin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await createCategory(name);
    if (success) {
      setName('');
      onSuccess();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Categoria">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label>Nome da Categoria</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
            placeholder="Ex: Pizzas, Bebidas..."
          />
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar Categoria'}
          </button>
        </div>
      </form>
    </Modal>
  );
}