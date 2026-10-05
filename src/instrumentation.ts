// Roda uma vez quando o servidor Next sobe. É daqui que o WhatsApp reconecta
// sozinho depois de um deploy, sem ninguém abrir o painel.
//
// O import fica DENTRO do if de propósito: o Next compila este arquivo também
// para o runtime edge, e só elimina o Baileys (que precisa de 'crypto', 'fs'
// etc.) do bundle edge quando a condição é escrita assim.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ligarWhatsapp, whatsappHabilitado } = await import('./lib/whatsapp/servidor');

    if (whatsappHabilitado()) {
      // Sem await: o servidor não pode deixar de subir porque o WhatsApp demorou
      ligarWhatsapp({ soComSessao: true }).catch((erro) =>
        console.error('Erro ao ligar o WhatsApp no boot:', erro)
      );
    }
  }
}
