import { NextResponse } from 'next/server';
import axios from 'axios';

// 🔥 Puxando as credenciais do .env de forma segura
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || '';
const API_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || '';

const api = axios.create({
  baseURL: EVOLUTION_URL,
  headers: {
    'apikey': API_KEY,
    'Content-Type': 'application/json',
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, phone, message } = body;

    let responseData;

    switch (action) {
      case 'check':
        try {
          const { data } = await api.get(`/instance/connectionState/${INSTANCE_NAME}`);
          responseData = data;
        } catch (error: any) {
          if (error.response?.status === 404) {
            responseData = { state: 'not_found' };
          } else {
            throw error;
          }
        }
        break;

      case 'create':
        const { data: createData } = await api.post('/instance/create', {
          instanceName: INSTANCE_NAME,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        });
        responseData = createData;
        break;

      case 'connect':
        const { data: connectData } = await api.get(`/instance/connect/${INSTANCE_NAME}`);
        responseData = connectData;
        break;

      case 'logout':
        await api.delete(`/instance/logout/${INSTANCE_NAME}`);
        responseData = { success: true };
        break;

      // 🔥 AÇÃO: ENVIAR MENSAGEM (Já configurada para envio direto)
      case 'send':
        if (!phone || !message) {
          return NextResponse.json({ error: 'Phone e message são obrigatórios' }, { status: 400 });
        }

        // Limpa o telefone (remove caracteres especiais)
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Envia a mensagem
        const { data: sendData } = await api.post(`/message/sendText/${INSTANCE_NAME}`, {
          number: `55${cleanPhone}@s.whatsapp.net`, // Formato: 55XXXXXXXXXXX@s.whatsapp.net
          text: message
        });
        
        responseData = sendData;
        break;

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Erro no Proxy Evolution:', error.response?.data || error.message);
    return NextResponse.json(
      { error: 'Erro ao comunicar com a Evolution API' }, 
      { status: 500 }
    );
  }
}