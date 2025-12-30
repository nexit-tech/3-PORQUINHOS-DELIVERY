// src/components/client/StoreClosedAlert/index.tsx
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XCircle } from 'lucide-react';
import styles from './styles.module.css';

interface StoreClosedAlertProps {
  onClose: () => void;
}

export default function StoreClosedAlert({ onClose }: StoreClosedAlertProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Fecha automaticamente após 3 segundos
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconBox}>
          <XCircle size={48} />
        </div>
        
        <h2>Loja fechada no momento</h2>
        <p>Volte em breve para fazer seu pedido! 🍕❤️</p>
      </div>
    </div>,
    document.body
  );
}