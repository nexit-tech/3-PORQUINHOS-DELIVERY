import styles from './styles.module.css';

/**
 * Assinatura da Nexit no rodapé da loja.
 *
 * Fica no fim do conteúdo de cada página do cliente, acima da navegação
 * flutuante. Discreto de propósito: é crédito, não anúncio — se competir
 * com o botão de finalizar pedido, atrapalha a venda da loja.
 */
export default function NexitFooter() {
  return (
    <footer className={styles.rodape}>
      <a
        href="https://www.nexit.tech"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        powered by <strong>nexit.tech</strong>
      </a>
    </footer>
  );
}
