import axios from 'axios';

// Agora chamamos NOSSA PRÓPRIA rota interna (api/evolution)
// Isso evita o erro de CORS
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
    // Ajuste aqui dependendo de como sua versão retorna (base64 ou code)
    return response.data.base64 || response.data.code || response.data.qrcode;
  },

  async logoutInstance() {
    await api.post('', { action: 'logout' });
  }
};