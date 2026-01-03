'use client';

import { useState } from 'react';
import styles from './styles.module.css';

interface CategoryModalProps {
  isOpen?: boolean; 
  onClose: () => void;
  onSave: (name: string) => Promise<void> | void;
}

export default function CategoryModal({ isOpen = true, onClose, onSave }: CategoryModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // Se for controlado por boolean externo
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSave(name);
      setName('');
      // onClose será chamado pelo pai após sucesso, ou aqui se preferir
      // Mas geralmente o pai controla o fechamento
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar categoria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>Nova Categoria</h2>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </header>
        
        <form onSubmit={handleSubmit} className={styles.body}>
          <div className={styles.inputGroup}>
            <label>Nome da Categoria</label>
            <input 
              autoFocus
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="Ex: Lanches, Bebidas..."
            />
          </div>

          <footer className={styles.footer}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={styles.saveBtn}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}