'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import styles from './styles.module.css';

interface CategoryModalProps {
  onClose: () => void;
  onSave: (name: string) => void;
}

export default function CategoryModal({ onClose, onSave }: CategoryModalProps) {
  const [name, setName] = useState('');

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>Nova Categoria</h2>
          <button onClick={onClose} className={styles.closeBtn}><X size={20}/></button>
        </header>
        
        <div className={styles.body}>
          <div className={styles.inputGroup}>
            <label>Nome da Categoria</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ex: Lanches, Bebidas..." 
              autoFocus
            />
          </div>
        </div>

        <footer className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>Cancelar</button>
          <button 
            onClick={() => { if(name) { onSave(name); onClose(); } }} 
            className={styles.saveBtn}
          >
            Salvar Categoria
          </button>
        </footer>
      </div>
    </div>
  );
}