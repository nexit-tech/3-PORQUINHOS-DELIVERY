'use client';

import { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, CheckCircle, LogOut, Loader2 } from 'lucide-react';
import styles from './styles.module.css';

type ConnectionStatus = 'IDLE' | 'GENERATING' | 'WAITING_SCAN' | 'CONNECTED';

export default function WhatsappConnect() {
  const [status, setStatus] = useState<ConnectionStatus>('IDLE');
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleGenerate = () => {
    setStatus('GENERATING');
    // Simula delay de buscar o QR Code no backend
    setTimeout(() => {
      setQrCode('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AnoteAiDemo');
      setStatus('WAITING_SCAN');
    }, 1500);
  };

  // Simula o WebSocket avisando que conectou
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (status === 'WAITING_SCAN') {
      // Depois de 5 segundos exibindo o QR, "conecta" sozinho para demo
      timeout = setTimeout(() => {
        setStatus('CONNECTED');
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [status]);

  const handleDisconnect = () => {
    if (confirm('Tem certeza que deseja desconectar?')) {
      setStatus('IDLE');
      setQrCode(null);
    }
  };

  return (
    <div className={styles.container}>
      {status === 'CONNECTED' ? (
        // --- TELA DE CONECTADO ---
        <div className={styles.connectedState}>
          <div className={styles.successIcon}>
            <CheckCircle size={48} />
          </div>
          <h2>Tudo certo!</h2>
          <p>Seu WhatsApp está conectado e recebendo pedidos.</p>
          
          <div className={styles.deviceInfo}>
            <Smartphone size={20} className={styles.deviceIcon} />
            <div>
              <strong>WhatsApp Business</strong>
              <span>(11) 99999-9999</span>
            </div>
            <div className={styles.statusBadge}>Online</div>
          </div>

          <button onClick={handleDisconnect} className={styles.disconnectBtn}>
            <LogOut size={16} /> Desconectar
          </button>
        </div>
      ) : (
        // --- TELA DE QR CODE ---
        <div className={styles.connectState}>
          <header className={styles.header}>
            <h2>Conectar WhatsApp</h2>
            <p>Escaneie o QR Code com o seu celular para vincular a loja.</p>
          </header>

          <div className={styles.qrArea}>
            {status === 'IDLE' && (
              <div className={styles.placeholder}>
                <Smartphone size={48} style={{ opacity: 0.2 }} />
                <button onClick={handleGenerate} className={styles.generateBtn}>
                  Gerar QR Code
                </button>
              </div>
            )}

            {status === 'GENERATING' && (
              <div className={styles.loading}>
                <Loader2 size={32} className={styles.spin} />
                <span>Gerando código...</span>
              </div>
            )}

            {status === 'WAITING_SCAN' && qrCode && (
              <div className={styles.qrWrapper}>
                <img src={qrCode} alt="QR Code WhatsApp" className={styles.qrImage} />
                <div className={styles.scanInstruction}>
                  <Loader2 size={14} className={styles.spin} />
                  <span>Aguardando leitura...</span>
                </div>
              </div>
            )}
          </div>
          
          <div className={styles.steps}>
            <small>1. Abra o WhatsApp no seu celular</small>
            <small>2. Toque em menu (três pontos) ou Configurações</small>
            <small>3. Selecione "Aparelhos Conectados"</small>
            <small>4. Aponte a câmera para esta tela</small>
          </div>
        </div>
      )}
    </div>
  );
}