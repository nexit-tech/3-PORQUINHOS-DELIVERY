'use client';

import { useState } from 'react';
import { 
  ShoppingBag, ClipboardList, Package, User, CreditCard, 
  Calendar, MapPin, Receipt, CheckCircle, Clock 
} from 'lucide-react';
import Modal from '@/components/common/Modal';
import styles from './styles.module.css';

interface DetailedStatsProps {
  products: any[];
  orders: any[];
}

const MOCK_ORDER_ITEMS = [
  { qtd: 1, name: 'Pizza Grande Calabresa', obs: 'Sem cebola', total: 49.90 },
  { qtd: 2, name: 'Coca Cola 2L', obs: '', total: 24.00 },
];

export default function DetailedStats({ products, orders }: DetailedStatsProps) {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PRODUCTS'>('ORDERS');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
  };

  return (
    <div className={styles.container}>
      {/* ABAS */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'ORDERS' ? styles.active : ''}`}
          onClick={() => setActiveTab('ORDERS')}
        >
          <ClipboardList size={18} /> Histórico de Pedidos
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'PRODUCTS' ? styles.active : ''}`}
          onClick={() => setActiveTab('PRODUCTS')}
        >
          <ShoppingBag size={18} /> Produtos Mais Vendidos
        </button>
      </div>

      {/* CONTEÚDO */}
      <div className={styles.content}>
        {activeTab === 'ORDERS' && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Pagamento</th>
                <th>Valor Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(t => (
                <tr 
                  key={t.id} 
                  onClick={() => handleOrderClick(t)} 
                  className={styles.clickableRow}
                  title="Ver detalhes"
                >
                  <td className={styles.idCell}>{t.id}</td>
                  <td>{t.date.split('-').reverse().join('/')}</td>
                  <td style={{fontWeight: 600}}>{t.customer}</td>
                  <td>{t.method}</td>
                  <td className={styles.valueCell}>R$ {t.total.toFixed(2)}</td>
                  <td><span className={styles.statusBadge}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'PRODUCTS' && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Produto</th>
                <th>Vendas (Qtd)</th>
                <th>Faturamento Total</th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod, index) => (
                <tr key={prod.id}>
                  <td><span className={styles.rankBadge}>#{index + 1}</span></td>
                  <td style={{ fontWeight: 600 }}>{prod.name}</td>
                  <td>{prod.qtd} un.</td>
                  <td className={styles.valueCell}>R$ {prod.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL REFORMULADO --- */}
      {selectedOrder && (
        <Modal 
          title={`Pedido ${selectedOrder.id}`} 
          onClose={() => setSelectedOrder(null)}
        >
          <div className={styles.modalBody}>
            
            {/* TOPO: STATUS E DADOS PRINCIPAIS */}
            <div className={styles.receiptHeader}>
              <div className={styles.statusRow}>
                <span className={styles.bigStatusBadge}>
                  <CheckCircle size={16} /> {selectedOrder.status}
                </span>
                <span className={styles.dateLabel}>
                  {selectedOrder.date.split('-').reverse().join('/')} às 19:30
                </span>
              </div>
              
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.label}><User size={14}/> Cliente</span>
                  <p>{selectedOrder.customer}</p>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}><CreditCard size={14}/> Pagamento</span>
                  <p>{selectedOrder.method}</p>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}><MapPin size={14}/> Tipo</span>
                  <p>Entrega</p>
                </div>
              </div>
            </div>

            {/* LISTA DE ITENS ESTILO CUPOM */}
            <div className={styles.itemsSection}>
              <div className={styles.sectionTitle}>
                <Package size={16}/> Resumo do Pedido
              </div>
              <div className={styles.itemsList}>
                {MOCK_ORDER_ITEMS.map((item, i) => (
                  <div key={i} className={styles.itemRow}>
                    <div className={styles.qtdBox}>{item.qtd}x</div>
                    <div className={styles.itemDetails}>
                      <span className={styles.itemName}>{item.name}</span>
                      {item.obs && <span className={styles.itemObs}>{item.obs}</span>}
                    </div>
                    <span className={styles.itemPrice}>R$ {item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RODAPÉ DE TOTAIS */}
            <div className={styles.summarySection}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>R$ {(selectedOrder.total - 5).toFixed(2)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Taxa de Entrega</span>
                <span>R$ 5,00</span>
              </div>
              <div className={styles.dividerDotted} />
              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalValue}>R$ {selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>

            {/* BOTÃO DE IMPRIMIR (OPCIONAL/DECORATIVO) */}
            <button className={styles.printBtn}>
              <Receipt size={18} /> Imprimir Comprovante
            </button>

          </div>
        </Modal>
      )}
    </div>
  );
}