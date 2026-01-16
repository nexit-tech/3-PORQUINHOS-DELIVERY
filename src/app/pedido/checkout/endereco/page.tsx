'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Search, User, Phone, Loader2, MapPin, Store } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/services/supabase';
import Link from 'next/link';
import styles from './page.module.css';

interface DeliveryZone {
  id: string;
  neighborhood: string;
  fee: number;
}

export default function EnderecoPage() {
  const router = useRouter();
  const { 
    setAddress, setDeliveryFee, cartSubtotal, 
    setCustomerName, setCustomerPhone
  } = useCart();

  // Estados dos dados pessoais
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // 🔥 NOVO: Estado para tipo de entrega
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');

  // Estados do endereço
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  
  const [neighborhoods, setNeighborhoods] = useState<DeliveryZone[]>([]);
  const [selectedHood, setSelectedHood] = useState<DeliveryZone | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchZones() {
      try {
        setLoadingZones(true);
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .eq('active', true)
          .order('neighborhood', { ascending: true });

        if (error) throw error;

        if (data) {
          setNeighborhoods(data);
          if (data.length > 0) {
            setSelectedHood(data[0]);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar bairros:', error);
      } finally {
        setLoadingZones(false);
      }
    }

    fetchZones();
  }, []);

  // Ajusta a taxa de entrega baseado na escolha (Delivery ou Retirada)
  useEffect(() => {
    if (deliveryType === 'pickup') {
      setDeliveryFee(0);
    } else if (selectedHood) {
      setDeliveryFee(selectedHood.fee);
    }
  }, [selectedHood, deliveryType, setDeliveryFee]);

  const filteredHoods = useMemo(() => {
    return neighborhoods.filter(h => 
      h.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [neighborhoods, searchTerm]);

  const handlePhoneChange = (txt: string) => {
    let val = txt.replace(/\D/g, '');
    val = val.replace(/^(\d{2})(\d)/g, '($1) $2');
    val = val.replace(/(\d)(\d{4})$/, '$1-$2');
    setPhone(val);
  };

  const handleNext = () => {
    if (!name || !phone) {
      alert('Preencha seu nome e telefone!');
      return;
    }

    if (deliveryType === 'delivery' && (!street || !number || !selectedHood)) {
      alert('Preencha os campos de endereço para entrega!');
      return;
    }
    
    setCustomerName(name);
    setCustomerPhone(phone);

    // 🔥 LÓGICA DE PREENCHIMENTO AUTOMÁTICO PARA RETIRADA
    if (deliveryType === 'pickup') {
      setAddress({ 
        street: 'RETIRAR NO LOCAL', 
        number: 'S/N', 
        complement: 'Cliente retira na loja', 
        neighborhood: 'RETIRADA' 
      });
    } else {
      setAddress({ 
        street, 
        number, 
        complement, 
        neighborhood: selectedHood!.neighborhood 
      });
    }
    
    router.push('/pedido/checkout/pagamento');
  };

  const currentFee = deliveryType === 'pickup' ? 0 : (selectedHood?.fee || 0);
  const total = cartSubtotal + currentFee;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido/carrinho" className={styles.iconBtn}>
          <ArrowLeft size={24} />
        </Link>
        <h1>Dados do Pedido</h1>
        <div style={{width: 24}}/>
      </header>

      <div className={styles.form}>
        
        {/* SELETOR DE TIPO DE ENTREGA */}
        <div className={styles.deliverySelector}>
          <button 
            className={`${styles.typeBtn} ${deliveryType === 'delivery' ? styles.activeType : ''}`}
            onClick={() => setDeliveryType('delivery')}
          >
            <MapPin size={20} />
            Entrega
          </button>
          <button 
            className={`${styles.typeBtn} ${deliveryType === 'pickup' ? styles.activeType : ''}`}
            onClick={() => setDeliveryType('pickup')}
          >
            <Store size={20} />
            Retirada
          </button>
        </div>

        {/* DADOS PESSOAIS */}
        <div className={styles.sectionHeader}>Seus Dados</div>
        
        <div className={styles.inputGroup}>
          <label>Nome Completo</label>
          <div className={styles.inputIconWrapper}>
            <User size={18} className={styles.inputIcon} />
            <input 
              type="text" 
              placeholder="Ex: João Silva" 
              value={name}
              onChange={e => setName(e.target.value)}
              className={styles.inputWithIcon}
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label>Celular / WhatsApp</label>
          <div className={styles.inputIconWrapper}>
            <Phone size={18} className={styles.inputIcon} />
            <input 
              type="text" 
              placeholder="(XX) XXXXX-XXXX" 
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              maxLength={15}
              className={styles.inputWithIcon}
              inputMode="tel"
            />
          </div>
        </div>

        <div className={styles.divider} />

        {/* CAMPOS DE ENDEREÇO (SÓ APARECEM SE FOR DELIVERY) */}
        {deliveryType === 'delivery' ? (
          <>
            <div className={styles.sectionHeader}>Endereço de Entrega</div>

            <div className={styles.inputGroup} style={{ zIndex: isDropdownOpen ? 100 : 1 }}>
              <label>Bairro de Entrega</label>
              <div className={styles.comboboxWrapper}>
                <button 
                  className={styles.comboboxTrigger} 
                  onClick={() => !loadingZones && setIsDropdownOpen(!isDropdownOpen)}
                  disabled={loadingZones}
                >
                  {loadingZones ? (
                    <div className={styles.triggerInfo}>
                      <span className={styles.hoodName}>Carregando bairros...</span>
                    </div>
                  ) : selectedHood ? (
                    <div className={styles.triggerInfo}>
                      <span className={styles.hoodName}>{selectedHood.neighborhood}</span>
                      <span className={styles.hoodFee}>
                        Taxa: {selectedHood.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.hoodName}>Selecione um bairro</span>
                  )}
                  
                  {loadingZones ? <Loader2 className={styles.spin} size={20} /> : <ChevronDown size={20} className={styles.chevron} />}
                </button>

                {isDropdownOpen && !loadingZones && (
                  <div className={styles.dropdown}>
                    <div className={styles.searchBox}>
                      <Search size={16} color="#71717a" />
                      <input 
                        type="text" 
                        placeholder="Buscar bairro..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className={styles.list}>
                      {filteredHoods.map(hood => (
                        <button
                          key={hood.id}
                          className={styles.listItem}
                          onClick={() => {
                            setSelectedHood(hood);
                            setIsDropdownOpen(false);
                            setSearchTerm('');
                          }}
                        >
                          <span>{hood.neighborhood}</span>
                          <small>{hood.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Rua / Avenida</label>
              <input 
                type="text" 
                placeholder="Ex: Av. Principal" 
                value={street}
                onChange={e => setStreet(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Número</label>
                <input 
                  type="text" 
                  placeholder="123" 
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  className={styles.input}
                  inputMode="numeric"
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Complemento</label>
                <input 
                  type="text" 
                  placeholder="Ap 101" 
                  value={complement}
                  onChange={e => setComplement(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          </>
        ) : (
          <div className={styles.pickupInfo}>
            <Store size={32} />
            <div>
              <strong>Retirada na Loja</strong>
              <p>Você deverá buscar seu pedido em nosso balcão quando estiver pronto.</p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className={styles.footerSummary}>
        <div className={styles.summaryLine}>
          <span>Subtotal</span>
          <span>{cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div className={styles.summaryLine}>
          <span>Taxa {deliveryType === 'delivery' && selectedHood ? `(${selectedHood.neighborhood})` : '(Retirada)'}</span>
          <span className={styles.feeValue}>
            {deliveryType === 'delivery' ? `+ ${currentFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : 'Grátis'}
          </span>
        </div>
        <div className={`${styles.summaryLine} ${styles.totalLine}`}>
          <span>Total</span>
          <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        
        <button className={styles.finishBtn} onClick={handleNext}>
          Ir para Pagamento
        </button>
      </div>
    </main>
  );
}