import { ReactNode } from 'react';
import styles from './styles.module.css';

interface ContainerProps {
  children: ReactNode;
  fluid?: boolean; // Nova prop opcional
}

export default function Container({ children, fluid = false }: ContainerProps) {
  return (
    // Se fluid for true, adiciona a classe .fluid, senão usa só .container
    <div className={`${styles.container} ${fluid ? styles.fluid : ''}`}>
      {children}
    </div>
  );
}