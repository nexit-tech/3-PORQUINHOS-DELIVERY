'use client';

import { useState } from 'react';
import {
  ShoppingBag, ClipboardList, Package, User, CreditCard,
  MapPin, CheckCircle
} from 'lucide-react';
import Modal from '@/components/common/Modal';
import type { FinanceOrder, ProductStat } from '@/hooks/useFinance';
import { STORE_TZ } from '@/lib/storeHours';
import styles from './styles.module.css';

interface DetailedStatsProps {
  products: ProductStat[];
  orders: FinanceOrder[];
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDate = (key: string) => key.split('-').reverse().join('/');

const formatTime = (iso: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: STORE_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DetailedStats({ products, orders }: DetailedStatsProps) {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PRODUCTS'>('ORDERS');
  const [selectedOrder, setSelectedOrder] = useState<FinanceOrder | null>(null);

  const items = selectedOrder?.items ?? [];
  const deliveryFee = selectedOrder?.deliveryFee ?? 0;
  const discount = selectedOrder?.discount ?? 0;
  // total = subtotal + frete - desconto  =>  subtotal = total - frete + desconto
  const subtotal = (selectedOrder?.total ?? 0) - deliveryFee + discount;
  const isPickup = !selectedOrder?.address || selectedOrder.address.includes('RETIRADA');

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
                  onClick={() => setSelectedOrder(t)}
                  className={styles.clickableRow}
                  title="Ver detalhes"
                >
                  <td className={styles.idCell}>{t.id}</td>
                  <td>{formatDate(t.date)}</td>
                  <td style={{ fontWeight: 600 }}>{t.customer}</td>
                  <td>{t.method}</td>
                  <td className={styles.valueCell}>{formatMoney(t.total)}</td>
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
                  <td className={styles.valueCell}>{formatMoney(prod.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DETALHE DO PEDIDO */}
      {selectedOrder && (
        <Modal
          title={`Pedido ${selectedOrder.id}`}
          onClose={() => setSelectedOrder(null)}
        >
          <div className={styles.modalBody}>

            <div className={styles.receiptHeader}>
              <div className={styles.statusRow}>
                <span className={styles.bigStatusBadge}>
                  <CheckCircle size={16} /> {selectedOrder.status}
                </span>
                <span className={styles.dateLabel}>
                  {formatDate(selectedOrder.date)} às {formatTime(selectedOrder.createdAt)}
                </span>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.label}><User size={14} /> Cliente</span>
                  <p>{selectedOrder.customer}</p>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}><CreditCard size={14} /> Pagamento</span>
                  <p>{selectedOrder.method}</p>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.label}><MapPin size={14} /> {isPickup ? 'Retirada' : 'Entrega'}</span>
                  <p>{isPickup ? 'Cliente retirou na loja' : selectedOrder.address}</p>
                </div>
              </div>
            </div>

            {/* ITENS REAIS DO PEDIDO */}
            <div className={styles.itemsSection}>
              <div className={styles.sectionTitle}>
                <Package size={16} /> Resumo do Pedido
              </div>
              <div className={styles.itemsList}>
                {items.length === 0 ? (
                  <p style={{ padding: '12px', color: 'var(--text-light)' }}>
                    Este pedido não tem itens registrados.
                  </p>
                ) : (
                  items.map((item: any, i: number) => (
                    <div key={item.id || i} className={styles.itemRow}>
                      <div className={styles.qtdBox}>{item.quantity}x</div>
                      <div className={styles.itemDetails}>
                        <span className={styles.itemName}>{item.product_name}</span>
                        {item.observation && (
                          <span className={styles.itemObs} style={{ whiteSpace: 'pre-line' }}>
                            {item.observation}
                          </span>
                        )}
                      </div>
                      <span className={styles.itemPrice}>{formatMoney(Number(item.total_price))}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TOTAIS REAIS */}
            <div className={styles.summarySection}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className={styles.summaryRow}>
                  <span>Taxa de Entrega</span>
                  <span>{formatMoney(deliveryFee)}</span>
                </div>
              )}
              {selectedOrder.discount > 0 && (
                <div className={styles.summaryRow} style={{ color: '#059669', fontWeight: 700 }}>
                  <span>Cupom {selectedOrder.couponCode}</span>
                  <span>- {formatMoney(selectedOrder.discount)}</span>
                </div>
              )}
              <div className={styles.dividerDotted} />
              <div className={styles.totalRow}>
                <span>Total</span>
                <span className={styles.totalValue}>{formatMoney(selectedOrder.total)}</span>
              </div>
            </div>

          </div>
        </Modal>
      )}
    </div>
  );
}
