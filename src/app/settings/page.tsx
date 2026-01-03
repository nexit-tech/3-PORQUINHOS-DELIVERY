// src/app/settings/page.tsx
'use client';

import { useState } from 'react';
import SettingsCard from '@/components/admin/SettingsCard';
import Modal from '@/components/common/Modal';
import OpeningHours from '@/components/admin/OpeningHours';
import DeliveryFees from '@/components/admin/DeliveryFees';
import PaymentSettings from '@/components/admin/PaymentSettings';
import WhatsappConnect from '@/components/admin/WhatsappConnect';
import BotManagement from '@/components/admin/BotManagement';
import { Clock, Bike, Printer, CreditCard, MessageCircle, Bot } from 'lucide-react';
import styles from './page.module.css';
import { PrinterSettings } from '@/components/admin/PrinterSettings';

type SettingType = 'HOURS' | 'FEES' | 'PRINTER' | 'PAYMENTS' | 'WHATSAPP' | 'BOT' | null;

export default function SettingsPage() {
  const [activeSetting, setActiveSetting] = useState<SettingType>(null);

  const renderModalContent = () => {
    switch (activeSetting) {
      case 'HOURS': return <OpeningHours />;
      case 'FEES': return <DeliveryFees />;
      case 'PAYMENTS': return <PaymentSettings />;
      case 'WHATSAPP': return <WhatsappConnect />;
      case 'PRINTER': return <PrinterSettings />;
      case 'BOT': return <BotManagement />;
    }
  };

  const getModalTitle = () => {
    switch (activeSetting) {
      case 'HOURS': return 'Horário de Funcionamento';
      case 'FEES': return 'Taxas de Entrega';
      case 'PAYMENTS': return 'Formas de Pagamento';
      case 'WHATSAPP': return 'Conexão WhatsApp';
      case 'PRINTER': return 'Impressoras';
      case 'BOT': return 'Controle de Bot';
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
          title="Controle de Bot" 
          description="Pause o bot para números específicos e veja solicitações de atendimento."
          icon={Bot}
          statusColor="blue"
          onClick={() => setActiveSetting('BOT')}
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