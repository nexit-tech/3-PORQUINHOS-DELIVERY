// src/lib/whatsapp/servidor.ts
// Ponto único para ligar o WhatsApp do servidor: a conexão, o envio dos
// status de pedido e o atendente (bot) andam juntos.
import { conectarWhatsapp, definirReceptor, ligarPublicacaoDeStatus } from './conexao';
import { ligarNotificador } from './notificador';
import { humanoAssumiu, receberMensagem } from '@/lib/bot/atendimento';
import { botConfigurado, transcrever } from '@/lib/bot/agente';
import { carregarIA } from '@/lib/bot/configServidor';

/**
 * Ligado por padrão só em produção. No `npm run dev`, o servidor local usa o
 * mesmo banco da produção: se abrisse a sessão 'principal' daqui, o WhatsApp
 * veria o mesmo aparelho conectado em dois lugares e derrubaria a loja.
 * Para testar local: WHATSAPP_ENABLED=true e WHATSAPP_SESSION=teste.
 */
export function whatsappHabilitado(): boolean {
  const flag = process.env.WHATSAPP_ENABLED;
  if (flag) return flag === 'true';
  return process.env.NODE_ENV === 'production';
}

function ligarAtendente() {
  definirReceptor({
    async mensagem({ phone, nome, texto, audio, outraMidia }) {
      let conteudo = texto;

      const ouvir = audio && botConfigurado() && (await carregarIA()).config.ouvirAudio;
      if (!conteudo && audio && !ouvir) {
        conteudo = '[o cliente mandou um áudio; a loja desligou a escuta de áudio — peça para escrever]';
      }

      if (!conteudo && audio && ouvir) {
        try {
          const transcrito = await transcrever(audio);
          if (transcrito) conteudo = `[mensagem de voz] ${transcrito}`;
        } catch (erro) {
          console.error('Erro ao transcrever áudio:', erro);
        }
        if (!conteudo) conteudo = '[o cliente mandou um áudio que não deu para entender]';
      }

      if (!conteudo && outraMidia) {
        conteudo = '[o cliente mandou uma foto, figurinha ou arquivo, sem texto — você só lê texto e áudio]';
      }

      if (conteudo) await receberMensagem(phone, conteudo, nome);
    },
    lojaRespondeu: humanoAssumiu,
  });
}

export async function ligarWhatsapp(opcoes?: { soComSessao?: boolean }) {
  ligarPublicacaoDeStatus();
  ligarNotificador();
  ligarAtendente();
  return conectarWhatsapp(opcoes);
}
