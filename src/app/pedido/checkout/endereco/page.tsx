'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Search, User, Phone } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import styles from './page.module.css';

const NEIGHBORHOODS = [
  { name: 'Centro', fee: 5.00 },
  { name: 'Jardim das Flores', fee: 8.00 },
  { name: 'Vila Nova', fee: 10.00 },
  { name: 'Industrial', fee: 12.00 },
  { name: 'Bairro Alto', fee: 15.00 },
  { name: 'Residencial Lagos', fee: 7.00 },
];

export default function EnderecoPage() {
  const router = useRouter();
  const { 
    setAddress, setDeliveryFee, cartSubtotal, 
    setCustomerName, setCustomerPhone
  } = useCart();

  // Estados
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  
  // Dropdown
  const [selectedHood, setSelectedHood] = useState(NEIGHBORHOODS[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setDeliveryFee(selectedHood.fee);
  }, [selectedHood, setDeliveryFee]);

  const filteredHoods = useMemo(() => {
    return NEIGHBORHOODS.filter(h => 
      h.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handlePhoneChange = (txt: string) => {
    let val = txt.replace(/\D/g, '');
    val = val.replace(/^(\d{2})(\d)/g, '($1) $2');
    val = val.replace(/(\d)(\d{4})$/, '$1-$2');
    setPhone(val);
  };

  const handleNext = () => {
    if (!name || !phone || !street || !number) {
      alert('Preencha os campos obrigatórios!');
      return;
    }
    setCustomerName(name);
    setCustomerPhone(phone);
    setAddress({ street, number, complement, neighborhood: selectedHood.name });
    router.push('/pedido/checkout/pagamento');
  };

  const total = cartSubtotal + selectedHood.fee;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <Link href="/pedido/carrinho" className={styles.iconBtn}>
          <ArrowLeft size={24} />
        </Link>
        <h1>Dados de Entrega</h1>
        <div style={{width: 24}}/>
      </header>

      <div className={styles.form}>
        
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

        {/* ENDEREÇO */}
        <div className={styles.sectionHeader}>Endereço</div>

        <div className={styles.inputGroup} style={{ zIndex: isDropdownOpen ? 100 : 1 }}>
          <label>Bairro de Entrega</label>
          <div className={styles.comboboxWrapper}>
            <button 
              className={styles.comboboxTrigger} 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className={styles.triggerInfo}>
                <span className={styles.hoodName}>{selectedHood.name}</span>
                <span className={styles.hoodFee}>
                  Taxa: {selectedHood.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <ChevronDown size={20} className={styles.chevron} />
            </button>

            {isDropdownOpen && (
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
                      key={hood.name}
                      className={styles.listItem}
                      onClick={() => {
                        setSelectedHood(hood);
                        setIsDropdownOpen(false);
                        setSearchTerm('');
                      }}
                    >
                      <span>{hood.name}</span>
                      <small>{hood.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small>
                    </button>
                  ))}
                  {filteredHoods.length === 0 && (
                    <div className={styles.emptySearch}>Nenhum bairro encontrado</div>
                  )}
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
      </div>

      {/* FOOTER */}
      <div className={styles.footerSummary}>
        <div className={styles.summaryLine}>
          <span>Subtotal</span>
          <span>{cartSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div className={styles.summaryLine}>
          <span>Taxa ({selectedHood.name})</span>
          <span className={styles.feeValue}>+ {selectedHood.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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