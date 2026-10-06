// src/lib/bot/config.ts
// Tudo do atendente que o dono da loja pode mudar pelo painel (página
// Atendente IA): jeito de falar, informações da loja, perguntas e
// respostas, fotos e regras. Fica em bot_settings, e o bot relê a cada
// resposta — mudou no painel, vale na próxima mensagem.
//
// Este arquivo roda nos dois lados (painel e servidor): nada de import de
// servidor aqui.

export const IA_KEYS = {
  CONFIG: 'ia_config',
  FAQ: 'ia_faq',
  MIDIAS: 'ia_midias',
  TESTE: 'ia_teste',
} as const;

/**
 * Modo teste: o bot só responde os números da lista. Serve para a loja
 * conversar com ele de verdade antes de soltar para os clientes.
 */
export interface ModoTeste {
  ativo: boolean;
  /** Só dígitos, com DDI (5522999998888). */
  numeros: string[];
}

/** Só dígitos, com DDI: é assim que o WhatsApp entrega o remetente. */
export const telefoneComDdi = (phone: string) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 12 ? d : `55${d}`;
};

/**
 * Nunca configurado = TESTE LIGADO e lista vazia: o bot não responde ninguém
 * até a loja colocar os números. Ligar para todos é decisão explícita.
 */
export function normalizarTeste(valor: unknown): ModoTeste {
  const v = (valor && typeof valor === 'object' ? valor : null) as Partial<ModoTeste> | null;
  if (!v) return { ativo: true, numeros: [] };
  const numeros = Array.isArray(v.numeros)
    ? [...new Set(v.numeros.map((n) => telefoneComDdi(String(n))).filter((n) => n.length >= 12))]
    : [];
  return { ativo: v.ativo !== false, numeros };
}

/** O bot responde este número com o modo de teste atual? */
export function liberadoNoTeste(teste: ModoTeste, phone: string): boolean {
  if (!teste.ativo) return true;
  const alvo = telefoneComDdi(phone);
  // Celular antigo pode estar no WhatsApp sem o 9: compara dos dois jeitos
  const sem9 = (n: string) => (n.length === 13 ? n.slice(0, 4) + n.slice(5) : n);
  return teste.numeros.some((n) => n === alvo || sem9(n) === sem9(alvo));
}

export interface ConfigIA {
  /** Como o atendente se apresenta, se perguntarem. */
  nomeAtendente: string;
  /** Tom e jeito de falar, em texto livre. */
  personalidade: string;
  /** Endereço, formas de atendimento, diferenciais: o que todo cliente pergunta. */
  sobreLoja: string;
  /** Regras extras que o dono quer que o bot siga. */
  instrucoesExtras: string;
  /** Pode montar e fechar pedido pela conversa? Desligado, manda o link do site. */
  fecharPedido: boolean;
  /** Com a loja fechada: true avisa o horário e tira dúvidas; false fica quieto. */
  responderFechado: boolean;
  /** Segundos de silêncio antes de responder, para juntar mensagens picadas. */
  esperaSegundos: number;
  /** Respostas por áudio são transcritas. */
  ouvirAudio: boolean;
}

export interface PerguntaResposta {
  id: string;
  pergunta: string;
  resposta: string;
  /** Fotos para mandar junto com esta resposta. */
  midias: string[];
  ativo: boolean;
}

export interface Midia {
  id: string;
  titulo: string;
  /** Quando o bot deve mandar ("quando pedirem o cardápio"). */
  quandoEnviar: string;
  url: string;
  ativo: boolean;
}

export const CONFIG_PADRAO: ConfigIA = {
  nomeAtendente: 'Atendente da 3 Porquinhos',
  personalidade:
    'Simpático, animado e direto, como um atendente de pizzaria que conhece bem o cardápio. Usa emoji com moderação (🍕❤️😊). Mensagens curtas de WhatsApp.',
  sobreLoja:
    'Ficamos em São Cristóvão, Cabo Frio. Trabalhamos somente com delivery e retirada (não tem como comer no local).\n' +
    'A pizza fica pronta em média de 20 a 40 minutos.\n' +
    'Pizza salgada: 35 cm, 8 fatias. Pizza doce: 25 cm, 4 fatias.\n' +
    'Muçarela e requeijão de verdade: nada de muçarela processada nem mistura com gordura vegetal.\n' +
    'Massa fina e crocante, gourmet, feita com ovos e leite.',
  instrucoesExtras: '',
  fecharPedido: true,
  responderFechado: true,
  esperaSegundos: 8,
  ouvirAudio: true,
};

let seq = 0;
export const novoId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const pr = (id: string, pergunta: string, resposta: string, midias: string[] = []): PerguntaResposta => ({
  id,
  pergunta,
  resposta,
  midias,
  ativo: true,
});

/** Perguntas e respostas que a loja mandou. Viram o ponto de partida no painel. */
export const FAQ_PADRAO: PerguntaResposta[] = [
  pr('onde', 'Onde fica a pizzaria?', 'São Cristóvão, Cabo Frio. Trabalhamos somente com delivery e retirada.'),
  pr('comer-local', 'Pode comer no local?', 'Poxa! 😔 Não. Trabalhamos somente com delivery e retirada.'),
  pr('tempo', 'Quanto tempo a pizza fica pronta?', 'Em média, de 20 a 40 minutos.'),
  pr('tamanho', 'Qual o tamanho das pizzas?', '🍕 Salgada: 35 cm, 8 fatias.\n🍕 Doce: 25 cm, 4 fatias.'),
  pr('2990-sabor', 'Qual é o sabor da pizza de R$ 29,90?', 'A pizza de R$ 29,90 é somente de muçarela.'),
  pr(
    '2990-dois',
    'A pizza de R$ 29,90 pode ser 2 sabores?',
    'Não. A pizza de R$ 29,90, 35 cm e 8 fatias, é somente muçarela. A partir das pizzas de R$ 34,90, você pode escolher 2 sabores.'
  ),
  pr('mucarela', 'A muçarela é de verdade?', 'Sim! ❤️ Trabalhamos com muçarela de verdade. Não utilizamos muçarela processada.'),
  pr('requeijao', 'O requeijão é de verdade?', 'Sim! ❤️ Só trabalhamos com requeijão de verdade. Zero mistura com gordura vegetal.'),
  pr('dinheiro', 'Aceita pagamento em dinheiro?', 'Sim! 💵'),
  pr(
    'cartao',
    'Aceita cartão de crédito?',
    'Sim! 💳 O cartão (e o Pix) é pelo link de pagamento online que eu mando aqui na conversa. Na entrega, só dinheiro.'
  ),
  pr('va', 'Aceita vale-alimentação?', 'Ainda não trabalhamos com vale-alimentação.'),
  pr('vr', 'Aceita vale-refeição?', 'Ainda não trabalhamos com vale-refeição.'),
  pr('ketchup', 'Pode enviar ketchup?', 'Sim! 😊 Sempre enviamos. Se quiser garantir, lembre o motoboy.'),
  pr(
    'maionese',
    'Pode enviar maionese temperada?',
    'Sim! 😊 A promoção da maionese temperada é exclusiva para pagamentos no Pix ou link de crédito online, mas vou enviar para você. ❤️'
  ),
  pr(
    'primeira-compra',
    'Tem promoção de primeira compra?',
    'Poxa! 😔 No momento não temos promoção de primeira compra. Mas você vai experimentar uma das melhores pizzas de Cabo Frio, com qualidade e preço justo. 🍕'
  ),
  pr(
    'promocao',
    'Qual é a promoção de hoje?',
    'Vou te enviar nosso cardápio digital e o cardápio físico para você conferir todas as opções. 📲 [mande o link do site e as fotos do cardápio]'
  ),
  pr(
    'cardapio',
    'Pode me enviar o cardápio?',
    'Claro! 😊 Vou te enviar o link do cardápio digital e o cardápio físico. [mande o link do site e as fotos do cardápio]'
  ),
  pr('borda', 'Tem borda recheada?', 'Ainda não trabalhamos com borda recheada.'),
  pr('massa-grossa', 'A massa é grossa?', 'Não! Nossa massa é fina e crocante. 😋'),
  pr('massa-gourmet', 'A massa é gourmet?', 'Sim! ❤️ Nossa massa é gourmet, preparada com ovos e leite.'),
  pr('refri', 'Quais refrigerantes vocês têm?', 'Trabalhamos com:\n• Coca-Cola\n• Coca-Cola Zero\n• Guaraná\n• Guaraná Zero'),
  pr('lata', 'Tem Coca-Cola em lata?', 'Ainda não trabalhamos com refrigerante em lata.'),
  pr('suco', 'Tem suco?', 'Ainda não trabalhamos com sucos.'),
  pr('guarana-natural', 'Tem guaraná natural?', 'Ainda não trabalhamos com guaraná natural.'),
  pr(
    'pizza-menor',
    'Tem pizza menor?',
    'No momento trabalhamos somente com:\n🍕 Pizza salgada: 35 cm, 8 fatias\n🍫 Pizza doce: 25 cm, 4 fatias'
  ),

  // --- Pedido ---
  pr('como-pedir', 'Como faço para pedir?', 'Você pode fazer seu pedido pelo nosso cardápio digital ou aqui mesmo comigo. [mande o link do site]'),
  pr('pedir-whatsapp', 'Posso fazer meu pedido pelo WhatsApp?', 'Sim! 😊 Podemos te ajudar pelo WhatsApp.'),
  pr('retirada', 'Posso retirar a pizza na pizzaria?', 'Sim! Temos a opção de retirada em São Cristóvão.'),
  pr('sabor-doce', 'Posso escolher o sabor da pizza doce?', 'Sim! Temos opções de pizzas doces disponíveis no cardápio. [mostre os sabores com ver_opcoes]'),
  pr(
    'trocar-ingrediente',
    'Posso trocar algum ingrediente da pizza?',
    'Algumas alterações são possíveis. Me diga qual ingrediente você gostaria de trocar que verifico para você. [anote o pedido de troca na observação do item; se não souber se dá, chame um atendente]'
  ),
  pr('tirar-ingrediente', 'Posso tirar algum ingrediente?', 'Sim, podemos retirar ingredientes. 😊 [anote na observação do item, ex: "sem cebola"]'),
  pr(
    'acrescentar',
    'Posso acrescentar ingredientes?',
    'Algumas opções podem ser acrescentadas. Me diga o que deseja adicionar. [use as opções de "Turbinar Pizza" do produto; o que não estiver lá, não prometa]'
  ),

  // --- Pagamento ---
  pr('pix', 'Aceita Pix?', 'Sim! Aceitamos Pix. 💚 [o Pix é pelo link de pagamento online]'),
  pr(
    'pagar-entrega',
    'Posso pagar na entrega?',
    'Sim! Na entrega aceitamos dinheiro. 💵 Pix e cartão são pelo link de pagamento online, antes de sair.'
  ),
  pr(
    'cartao-entrega',
    'Posso pagar com cartão na entrega?',
    'O cartão é pelo link de pagamento online que eu te mando aqui. 💳 Na entrega, só dinheiro.'
  ),
  pr(
    'pagar-antes',
    'Preciso pagar antes de receber?',
    'Não necessariamente. Temos opções de pagamento online e pagamento em dinheiro na entrega.'
  ),

  // --- Entrega ---
  pr(
    'entrega-endereco',
    'Vocês entregam no meu endereço?',
    'Me envie seu bairro para verificarmos a disponibilidade da entrega. [confira com consultar_bairro]'
  ),
  pr(
    'custo-entrega',
    'Quanto custa a entrega?',
    'O valor depende da região. Me informe seu bairro que verifico para você. [confira com consultar_bairro e diga a taxa]'
  ),
  pr(
    'entrega-bairro',
    'Vocês entregam no bairro X?',
    '[confira o bairro com consultar_bairro e responda na hora se entrega e quanto custa]'
  ),
  pr(
    'acompanhar',
    'Posso acompanhar a entrega?',
    'Sim! Você recebe aqui no WhatsApp cada etapa: quando o pedido é aceito, quando sai para entrega e quando é finalizado. 😊'
  ),

  // --- Produto ---
  pr('fatias', 'Quantos pedaços vêm na pizza?', 'As pizzas salgadas têm 8 fatias e as doces têm 4 fatias.'),
  pr(
    'serve-quantos',
    'A pizza serve quantas pessoas?',
    'A pizza salgada de 35 cm tem 8 fatias e pode variar conforme a fome e o perfil das pessoas. 😋'
  ),
  pr('leite', 'A massa contém leite?', 'Sim. Nossa massa gourmet é preparada com ovos e leite.'),
  pr('ovos', 'A massa contém ovos?', 'Sim. Nossa massa gourmet é preparada com ovos e leite.'),
  pr('qualidade', 'Vocês usam produtos de boa qualidade?', 'Sim! Trabalhamos com ingredientes selecionados e valorizamos produtos de qualidade.'),
  pr('sem-lactose', 'Vocês fazem pizza sem lactose?', 'No momento não trabalhamos com uma opção específica sem lactose.'),
  pr(
    'vegetariana',
    'Vocês fazem pizza vegetariana?',
    'Temos opções no cardápio que não levam carne. Posso te mostrar as opções disponíveis. [mostre os sabores sem carne do cardápio]'
  ),

  // --- Funcionamento ---
  // Sem horário escrito aqui de propósito: o bot lê a grade real (Configurações
  // → Horários). Horário fixo no texto ficaria errado no dia em que mudar.
  pr('abrem', 'Que horas vocês abrem?', '[responda com o horário de hoje, da seção Horários]'),
  pr('aberto-hoje', 'Vocês estão funcionando hoje?', '[diga se hoje abre e em que horário, da seção Horários]'),
  pr(
    'antes-abrir',
    'Posso fazer o pedido antes de vocês abrirem?',
    'O atendimento começa no horário de abertura. [diga o horário de hoje; com a loja fechada não dá para fechar pedido]'
  ),

  // --- Atendimento humano e problemas ---
  pr(
    'falar-pessoa',
    'Quero falar com uma pessoa.',
    'Claro! Vou encaminhar seu atendimento para um de nossos atendentes. 😊 [use chamar_atendente]'
  ),
  pr(
    'problema-pedido',
    'Tenho um problema com meu pedido.',
    'Sinto muito! 😔 Vou encaminhar você para um atendente para verificarmos o que aconteceu. [use chamar_atendente]'
  ),
  pr(
    'atrasado',
    'Meu pedido está atrasado.',
    'Vou verificar o status do seu pedido e te ajudar. [use meus_pedidos e diga o status; se passou da previsão ou o cliente estiver chateado, use chamar_atendente]'
  ),
  pr(
    'veio-errado',
    'Meu pedido veio errado.',
    'Sinto muito pelo ocorrido! 😔 Vou encaminhar para um atendente verificar e resolver para você. [use chamar_atendente]'
  ),
  pr(
    'cancelar',
    'Quero cancelar meu pedido.',
    'Vou encaminhar seu atendimento para verificarmos a possibilidade de cancelamento. [use chamar_atendente]'
  ),
];

export function normalizarConfig(valor: unknown): ConfigIA {
  const v = (valor && typeof valor === 'object' ? valor : {}) as Partial<ConfigIA>;
  const espera = Math.round(Number(v.esperaSegundos));
  return {
    nomeAtendente: typeof v.nomeAtendente === 'string' ? v.nomeAtendente : CONFIG_PADRAO.nomeAtendente,
    personalidade: typeof v.personalidade === 'string' ? v.personalidade : CONFIG_PADRAO.personalidade,
    sobreLoja: typeof v.sobreLoja === 'string' ? v.sobreLoja : CONFIG_PADRAO.sobreLoja,
    instrucoesExtras: typeof v.instrucoesExtras === 'string' ? v.instrucoesExtras : CONFIG_PADRAO.instrucoesExtras,
    fecharPedido: typeof v.fecharPedido === 'boolean' ? v.fecharPedido : CONFIG_PADRAO.fecharPedido,
    responderFechado: typeof v.responderFechado === 'boolean' ? v.responderFechado : CONFIG_PADRAO.responderFechado,
    esperaSegundos: Number.isFinite(espera) && espera >= 0 && espera <= 60 ? espera : CONFIG_PADRAO.esperaSegundos,
    ouvirAudio: typeof v.ouvirAudio === 'boolean' ? v.ouvirAudio : CONFIG_PADRAO.ouvirAudio,
  };
}

/** Nunca salvo = as perguntas padrão. Lista salva (mesmo vazia) = a do dono. */
export function normalizarFaq(valor: unknown): PerguntaResposta[] {
  if (!Array.isArray(valor)) return FAQ_PADRAO;
  return valor
    .filter((p) => p && typeof p.pergunta === 'string')
    .map((p) => ({
      id: String(p.id || novoId()),
      pergunta: String(p.pergunta),
      resposta: String(p.resposta || ''),
      midias: Array.isArray(p.midias) ? p.midias.map(String) : [],
      ativo: p.ativo !== false,
    }));
}

export function normalizarMidias(valor: unknown): Midia[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((m) => m && typeof m.url === 'string' && m.url)
    .map((m) => ({
      id: String(m.id || novoId()),
      titulo: String(m.titulo || 'Foto'),
      quandoEnviar: String(m.quandoEnviar || ''),
      url: String(m.url),
      ativo: m.ativo !== false,
    }));
}
