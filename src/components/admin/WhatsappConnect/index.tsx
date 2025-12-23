'use client';

import { useState, useEffect, useCallback } from 'react';
import { evolutionService } from '@/services/evolution';
import styles from './styles.module.css';
import { QrCode, Wifi, WifiOff, Loader2, Smartphone, ScanLine } from 'lucide-react';

export default function WhatsappConnect() {
  const [status, setStatus] = useState<'loading' | 'disconnected' | 'qrcode' | 'connected'>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const data = await evolutionService.getConnectionState();

      if (data.state === 'not_found') {
        await evolutionService.createInstance();
        setStatus('disconnected');
      } else if (data.instance?.state === 'open') {
        setStatus('connected');
        setQrCode(null);
      } else if (data.instance?.state === 'close' || data.instance?.state === 'connecting') {
        setStatus('disconnected'); 
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus('disconnected');
    }
  }, []);

  const handleGenerateQR = async () => {
    setLoading(true);
    try {
      await checkStatus();
      const qrBase64 = await evolutionService.connectInstance();
      if (qrBase64) {
        setQrCode(qrBase64);
        setStatus('qrcode');
      }
    } catch (error) {
      alert('Erro ao gerar QR Code. Verifique a API.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar?')) return;
    setLoading(true);
    try {
      await evolutionService.logoutInstance();
      setStatus('disconnected');
      setQrCode(null);
    } catch (error) {
      alert('Erro ao desconectar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      if (status === 'qrcode' || status === 'loading') {
        checkStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [checkStatus, status]);

  return (
    <div className={styles.container}>
      {/* Cabeçalho do Card */}
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <div className={styles.iconBox}>
            <Smartphone size={24} className={styles.brandIcon} />
          </div>
          <div>
            <h3>Conexão WhatsApp</h3>
            <p>Gerencie a conexão do seu delivery</p>
          </div>
        </div>
        
        <div className={styles.statusBadge}>
          {status === 'connected' ? (
            <span className={styles.connected}>
              <Wifi size={14} /> Online
            </span>
          ) : (
            <span className={styles.disconnected}>
              <WifiOff size={14} /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Área de Conteúdo Principal */}
      <div className={styles.content}>
        
        {/* Loading */}
        {status === 'loading' && (
          <div className={styles.stateContainer}>
            <Loader2 className={styles.spin} size={32} />
            <p className={styles.stateText}>Verificando conexão...</p>
          </div>
        )}

        {/* Conectado */}
        {status === 'connected' && (
          <div className={styles.stateContainer}>
            <div className={styles.successIcon}>
              <Wifi size={32} />
            </div>
            <h4>Tudo pronto!</h4>
            <p className={styles.stateText}>
              O sistema está conectado e pronto para enviar mensagens.
            </p>
            <button onClick={handleDisconnect} className={styles.disconnectBtn}>
              Desconectar Sessão
            </button>
          </div>
        )}

        {/* Desconectado ou QR Code */}
        {(status === 'disconnected' || status === 'qrcode') && (
          <div className={styles.stateContainer}>
            {!qrCode ? (
              // Estado Vazio (Antes de gerar QR)
              <div className={styles.emptyState}>
                <div className={styles.placeholderIcon}>
                  <QrCode size={40} />
                </div>
                <p className={styles.stateText}>
                  Nenhum dispositivo conectado.<br/>
                  Gere um QR Code para iniciar.
                </p>
                <button 
                  onClick={handleGenerateQR} 
                  disabled={loading}
                  className={styles.primaryBtn}
                >
                  {loading ? (
                    <>
                      <Loader2 className={styles.spinBtn} size={18} /> Gerando...
                    </>
                  ) : (
                    <>
                      <ScanLine size={18} /> Gerar Novo QR Code
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Exibição do QR Code
              <div className={styles.qrWrapper}>
                <p className={styles.instructionText}>
                  Abra o WhatsApp no seu celular e escaneie:
                </p>
                <div className={styles.qrFrame}>
                  <img src={qrCode} alt="QR Code WhatsApp" />
                  <div className={styles.scanLine}></div>
                </div>
                <button onClick={() => setQrCode(null)} className={styles.cancelBtn}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}