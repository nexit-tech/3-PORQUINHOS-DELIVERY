// src/components/admin/ReorderModal/index.tsx
'use client';

import { useState } from 'react';
import { GripVertical, X, Save } from 'lucide-react';
import styles from './styles.module.css';

interface ReorderModalProps {
  title: string;
  items: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (newOrder: Array<{ id: string; name: string }>) => void;
}

export default function ReorderModal({ title, items, onClose, onSave }: ReorderModalProps) {
  const [list, setList] = useState(items);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newList = [...list];
    const draggedItem = newList[draggedIndex];
    
    newList.splice(draggedIndex, 1);
    newList.splice(index, 0, draggedItem);
    
    setList(newList);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    console.log('🔘 Botão Salvar clicado');
    console.log('📋 Lista atual:', list);
    
    if (list.length === 0) {
      console.error('❌ Lista vazia, não pode salvar!');
      alert('Erro: Lista vazia!');
      return;
    }
    
    onSave(list);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </header>

        <div className={styles.hint}>
          <p>Arraste os itens para reordená-los</p>
        </div>

        <div className={styles.list}>
          {list.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`${styles.item} ${draggedIndex === index ? styles.dragging : ''}`}
            >
              <div className={styles.itemContent}>
                <GripVertical size={20} className={styles.gripIcon} />
                <span className={styles.order}>{index + 1}</span>
                <span className={styles.name}>{item.name}</span>
              </div>
            </div>
          ))}
        </div>

        <footer className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Cancelar
          </button>
          <button onClick={handleSave} className={styles.saveBtn}>
            <Save size={18} /> Salvar Ordem
          </button>
        </footer>
      </div>
    </div>
  );
}