import { useState } from 'react';
import { 
  Clock, 
  MapPin, 
  User, 
  CheckCircle, 
  XCircle, 
  Printer, 
  ChevronDown, 
  ChevronUp,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

// Tipagem simples do Pedido (ajuste conforme seu Typescript real)
interface OrderItem {
  id: string;
  quantity: number;
  product: {
    name: string;
    price: number;
  };
  observation?: string;
  extras?: any[];
}

interface Order {
  id: string;
  code: string; // Ex: #1234
  customer_name: string;
  customer_phone?: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivery' | 'completed' | 'cancelled';
  total: number;
  payment_method: string;
  created_at: string;
  delivery_address?: string;
  items: OrderItem[];
  type: 'delivery' | 'pickup' | 'table';
}

interface OrderCardProps {
  order: Order;
  onStatusChange?: () => void;
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Formata moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formata data
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // --- LÓGICA DE IMPRESSÃO TÉRMICA ---
  const handlePrint = () => {
    // Cria um iframe oculto para impressão
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Gera o HTML do Cupom
    const receiptContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; width: 300px; font-size: 12px; margin: 0; padding: 10px; color: #000; }
            .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
            .title { font-size: 16px; font-weight: bold; }
            .info { font-size: 11px; margin-bottom: 5px; }
            .items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .items th { text-align: left; border-bottom: 1px dashed #000; }
            .item-row td { padding: 4px 0; vertical-align: top; }
            .qty { width: 30px; font-weight: bold; }
            .price { text-align: right; }
            .total { border-top: 1px dashed #000; padding-top: 5px; font-weight: bold; font-size: 14px; text-align: right; }
            .footer { margin-top: 15px; text-align: center; font-size: 10px; }
            .obs { font-style: italic; font-size: 10px; margin-left: 30px; display: block; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">PEDIDO ${order.code || order.id.slice(0, 4)}</div>
            <div class="info">${new Date().toLocaleDateString('pt-BR')} - ${formatTime(order.created_at)}</div>
            <div class="info">Cliente: ${order.customer_name}</div>
            <div class="info">Tel: ${order.customer_phone || 'N/A'}</div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th>Qtd</th>
                <th>Item</th>
                <th style="text-align: right;">R$</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr class="item-row">
                  <td class="qty">${item.quantity}x</td>
                  <td>
                    ${item.product.name}
                    ${item.observation ? `<br/><span class="obs">Obs: ${item.observation}</span>` : ''}
                  </td>
                  <td class="price">${formatCurrency(item.product.price * item.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            TOTAL: ${formatCurrency(order.total)}
          </div>
          
          <div style="margin-top: 10px; font-size: 11px;">
            <strong>Pagamento:</strong> ${order.payment_method}<br/>
            <strong>Tipo:</strong> ${order.type === 'delivery' ? 'Entrega' : 'Retirada'}
          </div>

          ${order.delivery_address ? `
            <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 5px;">
              <strong>Entrega:</strong><br/>
              ${order.delivery_address}
            </div>
          ` : ''}

          <div class="footer">
            --- Fim do Pedido ---
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(receiptContent);
    doc.close();

    // Aguarda carregar e imprime
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove o iframe após a impressão (pequeno delay para garantir)
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  };

  // --- AÇÕES DO PEDIDO ---

  const updateOrderStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success(`Pedido atualizado para: ${newStatus}`);
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    // 1. Dispara a impressão automática
    handlePrint();
    
    // 2. Atualiza status para 'preparing' (Em Preparo)
    await updateOrderStatus('preparing');
  };

  const handleCancelOrder = async () => {
    if (window.confirm('Tem certeza que deseja cancelar este pedido?')) {
      await updateOrderStatus('cancelled');
    }
  };

  // Cores baseadas no status
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      preparing: 'bg-blue-100 text-blue-800 border-blue-200',
      ready: 'bg-green-100 text-green-800 border-green-200',
      delivery: 'bg-purple-100 text-purple-800 border-purple-200',
      completed: 'bg-gray-100 text-gray-800 border-gray-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendente',
      preparing: 'Em Preparo',
      ready: 'Pronto',
      delivery: 'Em Entrega',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className={`bg-white border rounded-xl shadow-sm transition-all duration-200 overflow-hidden ${isExpanded ? 'ring-2 ring-primary-color/20' : ''}`}>
      
      {/* HEADER DO CARD (Resumo) */}
      <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-gray-900">
              #{order.code || order.id.slice(0, 4)}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Clock size={14} />
            {formatTime(order.created_at)}
          </span>
        </div>

        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <User size={16} className="text-gray-400" />
              {order.customer_name}
            </div>
            <div className="text-sm text-gray-500 pl-6">
              {order.items.length} {order.items.length === 1 ? 'item' : 'itens'} • {formatCurrency(order.total)}
            </div>
          </div>
          
          <button className="text-gray-400 hover:text-primary-color transition-colors">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* CONTEÚDO EXPANDIDO (Detalhes) */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-fadeIn">
          
          {/* Endereço */}
          {order.delivery_address && (
            <div className="mb-4 flex gap-2 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
              <MapPin size={16} className="text-primary-color shrink-0 mt-0.5" />
              <span>{order.delivery_address}</span>
            </div>
          )}

          {/* Lista de Itens */}
          <div className="space-y-3 mb-6">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Itens do Pedido</h4>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-sm">
                <div className="flex gap-2">
                  <span className="font-medium text-gray-900 w-6">{item.quantity}x</span>
                  <div className="flex flex-col">
                    <span className="text-gray-700">{item.product.name}</span>
                    {item.observation && (
                      <span className="text-xs text-gray-500 italic">Obs: {item.observation}</span>
                    )}
                  </div>
                </div>
                <span className="text-gray-600">{formatCurrency(item.product.price * item.quantity)}</span>
              </div>
            ))}
            
            <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between items-center font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
              {order.payment_method === 'credit_card' ? <CreditCard size={14} /> : <DollarSign size={14} />}
              <span className="uppercase">{order.payment_method.replace('_', ' ')}</span>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {order.status === 'pending' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancelOrder(); }}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50"
                >
                  <XCircle size={18} />
                  Recusar
                </button>
                
                <button
                  onClick={(e) => { e.stopPropagation(); handleAcceptOrder(); }}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-primary-color hover:bg-primary-dark shadow-sm hover:shadow transition-all disabled:opacity-50"
                >
                  {loading ? 'Processando...' : (
                    <>
                      <CheckCircle size={18} />
                      Aceitar & Imprimir
                    </>
                  )}
                </button>
              </>
            )}

            {/* Ações para outros status */}
            {order.status === 'preparing' && (
               <button
                 onClick={() => updateOrderStatus('ready')}
                 className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all"
               >
                 Marcar como Pronto
               </button>
            )}

            {order.status === 'ready' && (
               <button
                 onClick={() => updateOrderStatus('delivery')}
                 className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-all"
               >
                 Saiu para Entrega
               </button>
            )}

            {order.status === 'delivery' && (
               <button
                 onClick={() => updateOrderStatus('completed')}
                 className="col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-all"
               >
                 Concluir Pedido
               </button>
            )}
            
            {/* Botão de Reimpressão manual (sempre visível) */}
            <button
              onClick={(e) => { e.stopPropagation(); handlePrint(); }}
              className="col-span-2 mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
            >
              <Printer size={14} />
              Reimprimir Cupom
            </button>
          </div>
        </div>
      )}
    </div>
  );
}