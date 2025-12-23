'use client';

import { useState } from 'react';
import SettingsCard from '@/components/admin/SettingsCard';
import Modal from '@/components/common/Modal';
import OpeningHours from '@/components/admin/OpeningHours';
import DeliveryFees from '@/components/admin/DeliveryFees';
import PaymentSettings from '@/components/admin/PaymentSettings';
import WhatsappConnect from '@/components/admin/WhatsappConnect'; 
import { Clock, Bike, Printer, CreditCard, MessageCircle } from 'lucide-react';
import styles from './page.module.css';

type SettingType = 'HOURS' | 'FEES' | 'PRINTER' | 'PAYMENTS' | 'WHATSAPP' | null;

export default function SettingsPage() {
  const [activeSetting, setActiveSetting] = useState<SettingType>(null);

  const renderModalContent = () => {
    switch (activeSetting) {
      case 'HOURS': return <OpeningHours />;
      case 'FEES': return <DeliveryFees />;
      case 'PAYMENTS': return <PaymentSettings />;
      case 'WHATSAPP': return <WhatsappConnect />;
      case 'PRINTER': 
        return (
          <div style={{padding: 40, textAlign: 'center', color: '#888'}}>
            <Printer size={48} style={{marginBottom: 16, opacity: 0.5}}/>
            <h3>Configuração de Impressora</h3>
            <p>Em breve você poderá conectar sua impressora térmica aqui.</p>
          </div>
        );
      default: return null;
    }
  };

  const getModalTitle = () => {
    switch (activeSetting) {
      case 'HOURS': return 'Horário de Funcionamento';
      case 'FEES': return 'Taxas de Entrega';
      case 'PAYMENTS': return 'Formas de Pagamento';
      case 'WHATSAPP': return 'Conexão WhatsApp';
      case 'PRINTER': return 'Impressoras';
      default: return '';
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1>Configurações</h1>
        <p>Gerencie o funcionamento da sua loja.</p>
      </header>

      <div className={styles.grid}>
        <SettingsCard 
          title="Conectar WhatsApp" 
          description="Vincule seu número para receber pedidos automaticamente."
          icon={MessageCircle}
          statusColor="green"
          onClick={() => setActiveSetting('WHATSAPP')}
        />

        <SettingsCard 
          title="Horários" 
          description="Defina quando sua loja abre e fecha."
          icon={Clock}
          statusColor="green"
          onClick={() => setActiveSetting('HOURS')}
        />
        
        <SettingsCard 
          title="Taxas de Entrega" 
          description="Configure valores por bairro ou km."
          icon={Bike}
          statusColor="blue"
          onClick={() => setActiveSetting('FEES')}
        />

        <SettingsCard 
          title="Impressão" 
          description="Impressoras térmicas."
          icon={Printer}
          statusColor="gray"
          onClick={() => setActiveSetting('PRINTER')}
        />
      </div>

      {activeSetting && (
        <Modal title={getModalTitle()} onClose={() => setActiveSetting(null)}>
          {renderModalContent()}
        </Modal>
      )}
    </div>
  );
}