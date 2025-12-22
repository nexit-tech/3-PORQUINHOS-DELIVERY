'use client';
import { X } from 'lucide-react';
import styles from './styles.module.css';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <button onClick={onClose} className={styles.closeBtn}><X size={24}/></button>
        </header>
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}