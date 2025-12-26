import axios from 'axios';

const api = axios.create({
  baseURL: '/api/evolution', 
});

export const evolutionService = {
  async getConnectionState() {
    const response = await api.post('', { action: 'check' });
    return response.data;
  },

  async createInstance() {
    const response = await api.post('', { action: 'create' });
    return response.data;
  },

  async connectInstance() {
    const response = await api.post('', { action: 'connect' });
    return response.data.base64 || response.data.code || response.data.qrcode;
  },

  async logoutInstance() {
    await api.post('', { action: 'logout' });
  },

  // 🔥 NOVO: Envia mensagem via WhatsApp
  async sendMessage(phone: string, message: string) {
    const response = await api.post('', { 
      action: 'send', 
      phone, 
      message 
    });
    return response.data;
  }
};