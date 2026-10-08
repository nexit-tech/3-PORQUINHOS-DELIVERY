# 3 Porquinhos Delivery

Sistema de gestão de delivery: painel administrativo, loja para o cliente e bot de WhatsApp.
Next.js 15 (App Router) + Supabase, com uma versão desktop empacotada em Electron.

---

## Como rodar

```bash
npm install
cp .env.example .env   # (ou edite o .env direto)
npm run dev            # http://localhost:3000
```

Sem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` preenchidos, o app sobe
mas não carrega dado nenhum.

---

## Estrutura

| Área | Rotas | Quem usa |
|---|---|---|
| Painel | `/`, `/ia`, `/products`, `/finance`, `/settings`, `/notifications`, `/coupons` | Loja (protegido por login) |
| Cliente | `/pedido/*` | Público |
| API | `/api/whatsapp`, `/api/loja/*`, `/api/cron/*` | Painel, loja e agendador |
| Pagamento | `/api/pagamento/{status,criar-link,verificar,infinitepay}` | Navegador e InfinitePay |

```
src/
├── app/            páginas e rotas de API
├── components/     admin/, client/, common/, layout/
├── config/store.ts nome, telefone e números VIP da loja
├── context/        AuthContext, CartContext
├── hooks/          useProducts, useAdminOrders, useOrders, useFinance, useStoreStatus, useCoupons
├── lib/            storeHours, printerSettings, apiAuth, env, isElectron,
│                   supabaseAdmin, infinitepay, confirmarPagamento
├── lib/whatsapp/   conexão por QR (Baileys) e envio do andamento do pedido
├── lib/bot/        atendente do WhatsApp (ChatGPT) e suas ferramentas
├── services/       supabase, botSettings
├── utils/          printReceipt
└── middleware.ts   protege as rotas do painel
```

---

## Banco de dados

Os arquivos em [`supabase/`](supabase/) precisam ser rodados **à mão no SQL Editor**, na ordem:

Projeto: **Delivery 3 porquinhos** (`tgugjefgwwluycrkhcss`, sa-east-1).

| Arquivo | O que faz | Situação |
|---|---|---|
| `00-realtime.sql` | Publica `products`, `categories` e `complement_options` no Realtime | ✅ aplicado |
| `01-bot-settings-unique.sql` | Conferência de `bot_settings` (o banco já estava certo) | ✅ aplicado |
| `02-order-notifications.sql` | Trava que impede notificação de WhatsApp duplicada | ✅ aplicado |
| `03-create-order-rpc.sql` | Cria `is_store_open()` e `create_order()` | ✅ aplicado |
| `03b-get-orders-by-phone.sql` | Cria `get_orders_by_phone()` | ✅ aplicado |
| `05-admin-user.sql` | Cria o usuário admin no Supabase Auth | ✅ aplicado (1 usuário em `auth.users`) |
| `07-cupons.sql` | Cria `coupons`, `coupon_redemptions` e `evaluate_coupon()` | ✅ aplicado |
| `08-pagamento-online.sql` | Eixo `payment_status`, `get_order_for_payment()` e `mark_order_paid()` | ✅ aplicado |
| `09-pagamento-correcoes.sql` | Correções da revisão adversarial + `payment_attempts` | ✅ aplicado |
| `04-rls-pedidos.sql` | Liga a RLS e tranca o acesso | ✅ aplicado |
| `10-somente-pagamento-online.sql` | Trigger que recusa pedido "pagar na entrega" | ⚠️ substituída pela `12` |
| `12-aceitar-dinheiro.sql` | Libera dinheiro na entrega; recusa as outras formas fora do site | ⏳ **rodar no banco** |
| `13-whatsapp-sessao.sql` | Tabela `whatsapp_auth`, onde fica a sessão do WhatsApp conectado por QR | ✅ aplicado |
| `14-bot-conversas.sql` | Tabela `bot_conversas`: histórico e carrinho do atendente do WhatsApp | ✅ aplicado |
| `15-pix-na-chave.sql` | `mark_order_paid_pix()`, colunas de auditoria em `payment_attempts`, bucket privado `comprovantes` | ✅ aplicado |
| `16-cartao-na-entrega.sql` | A trava da `12` passa a aceitar cartão na entrega (maquininha), além de dinheiro | ✅ aplicado |
| `06-service-role.sql` | Conferência: RLS, políticas e Realtime | — |

Os aplicados são todos **aditivos**: criam função ou tabela e não mudam o comportamento
do código que já está em produção.

> ⚠️ **O `04` bloqueia o INSERT direto em `orders`** — todo pedido tem que passar por
> `create_order()`. Se algum dia restaurar um backup anterior, a ordem é: `05` (criar
> usuário) → deploy do código novo → confirmar que o login e os pedidos funcionam →
> preencher `SUPABASE_SERVICE_ROLE_KEY` → `04`. Aplicar antes do deploy derruba a loja.

### Tabelas

`orders`, `order_items`, `products`, `categories`, `complement_groups`, `complement_options`,
`product_complements`, `delivery_zones`, `store_settings`, `bot_settings`,
`bot_paused_numbers`, `bot_notifications`, `order_notifications`,
`coupons`, `coupon_redemptions`, `payment_attempts`.

---

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | Conexão com o Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | sim, após a RLS | Usada pelo webhook e pelo cron, que rodam sem usuário logado |
| `ADMIN_EMAIL` | sim | Quem o painel autentica. A tela de login pede só a senha porque o e-mail sai daqui |
| `ADMIN_PASSWORD` | só no desktop | O Electron entra sozinho com ela. Não é usada para validar o login no navegador |
| `WEBHOOK_SECRET` | recomendado | Protege `/api/webhook`. Vazio = endpoint aberto |
| `CRON_SECRET` | recomendado | Protege `/api/cron/*`. Vazio = endpoint aberto |
| `INFINITEPAY_HANDLE` | só p/ pagamento online | Sua InfiniteTag, **sem o `$`**. Vazia = a opção "Pagar agora" nem aparece no checkout |
| `NEXT_PUBLIC_APP_URL` | só p/ pagamento online | Domínio público da loja. É dele que saem a `webhook_url` e a `redirect_url` |
| `INFINITEPAY_API_URL` | opcional | Sobrescreve a base da API (padrão `https://api.checkout.infinitepay.io`) |
| `WHATSAPP_ENABLED` | opcional | Liga o WhatsApp por QR neste servidor. Padrão: ligado em produção, desligado no `npm run dev` |
| `WHATSAPP_SESSION` | opcional | Nome da sessão em `whatsapp_auth` (padrão `principal`). Use outro nome para testar local |
| `OPENAI_API_KEY` | p/ o bot | Atendente do WhatsApp (ChatGPT). Vazia = o bot não responde ninguém |
| `OPENAI_MODEL` | opcional | Modelo do atendente (padrão `gpt-4.1-mini`) |
| `OPENAI_TRANSCRIBE_MODEL` | opcional | Transcrição das mensagens de voz (padrão `gpt-4o-mini-transcribe`) |
| `NEXT_PUBLIC_STORE_*` | opcional | Nome, telefone e site da loja no cupom e nas mensagens |

---

## Pagamento online (InfinitePay)

> 💳 **A loja aceita pagamento pelo site (Pix/cartão) ou DINHEIRO na entrega/retirada.**
> Pix e cartão na mão do entregador não existem: dependem de maquininha e de uma
> conferência que ninguém faz na porta. Quem garante isso é o
> [`12-aceitar-dinheiro.sql`](supabase/12-aceitar-dinheiro.sql), que recusa no banco
> qualquer pedido `ON_DELIVERY` cujo `payment_method` não comece com "Dinheiro" — a tela
> sozinha não segura quem abre o console. Ele substitui a regra da
> [`10`](supabase/10-somente-pagamento-online.sql), que recusava *todo* `ON_DELIVERY`.
>
> Efeito colateral bem-vindo: **InfinitePay fora do ar não para mais a loja** — o checkout
> cai para dinheiro e o pedido entra igual.

Para ligar, basta preencher as duas variáveis e reiniciar. Não há nada a cadastrar no
painel da InfinitePay: a `webhook_url` vai junto em cada link de cobrança criado.

```
INFINITEPAY_HANDLE=suatag        # sem o "$"
NEXT_PUBLIC_APP_URL=https://seu-dominio.com.br
```

`/api/pagamento/status` responde `{"enabled": false}` enquanto a handle estiver vazia, e
o checkout esconde a opção "Pagar agora" — o cliente não chega a escolher algo que falharia
no fim do fluxo.

**Não funciona em `localhost`**: a InfinitePay chama o webhook de fora. Para testar local,
suba um túnel (`ngrok http 3000`) e ponha a URL do túnel em `NEXT_PUBLIC_APP_URL`.

### Como o fluxo se sustenta

| Etapa | Onde |
|---|---|
| Pedido nasce em `AWAITING` — invisível para a cozinha | `create_order()` |
| Link de cobrança, com itens lidos **do banco** | [`api/pagamento/criar-link`](src/app/api/pagamento/criar-link/route.ts) |
| Aviso da operadora (não confiável, sem assinatura) | [`api/pagamento/infinitepay`](src/app/api/pagamento/infinitepay/route.ts) |
| Cliente volta do checkout e a tela pergunta | [`api/pagamento/verificar`](src/app/api/pagamento/verificar/route.ts) |
| Confirmação real, servidor-a-servidor | [`confirmarPagamento.ts`](src/lib/confirmarPagamento.ts) → `payment_check` |
| Reconferência de valor e gravação idempotente | `mark_order_paid()` |

Dois detalhes que parecem redundância e não são:

- **O webhook não prova nada.** Ele chega sem assinatura, então qualquer um poderia postar
  `{"order_nsu": 1408, "paid": true}`. Quem diz se está pago é o `payment_check`, numa
  chamada que sai do nosso servidor para o deles.
- **Webhook e tela de retorno chamam a mesma função.** O webhook pode falhar em entregar
  e o cliente pode fechar a aba antes de voltar. Como `confirmarPagamento` é idempotente,
  os dois chegarem é o caso normal, não um problema.

`payment_status` é um eixo separado de `status`: um responde "o dinheiro entrou?" e o outro,
"onde está na cozinha?". Existem estados que um campo só não representa — pago mas não
aceito, aceito mas não pago, criado e abandonado no checkout.

Pedido pago que acabar cancelado levanta `payment_needs_refund` com `payment_conflict_reason`,
em vez de sumir do painel. Toda tentativa fica registrada em `payment_attempts`.

---

## WhatsApp por QR Code (andamento do pedido)

O servidor conecta no WhatsApp da loja como um "aparelho conectado", igual ao WhatsApp
Web, usando a biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys). Não passa
por Evolution, Z-API nem API oficial.

Para ligar: rodar o `13-whatsapp-sessao.sql`, fazer o deploy e, no painel web,
**Configurações → Conectar WhatsApp → Gerar QR Code**. No celular da loja:
WhatsApp → Aparelhos conectados → Conectar um aparelho.

| Peça | Onde |
|---|---|
| Conexão, QR e reconexão automática | [`lib/whatsapp/conexao.ts`](src/lib/whatsapp/conexao.ts) |
| Sessão salva no banco (sobrevive a deploy) | [`lib/whatsapp/authState.ts`](src/lib/whatsapp/authState.ts) |
| Envio do status: aceito, saiu/pronto, finalizado, cancelado | [`lib/whatsapp/notificador.ts`](src/lib/whatsapp/notificador.ts) |
| Liga tudo quando o servidor sobe | [`instrumentation.ts`](src/instrumentation.ts) |

- **Quem envia é o servidor**, consultando o banco a cada 15s. Não depende de painel
  aberto, e funciona igual se a loja usa o app desktop. Se o WhatsApp cair, as mensagens
  dos pedidos das últimas 6h saem quando ele voltar.
- **Não manda nada no `PENDING`.** O telefone é digitado sem verificação; mandar mensagem
  quando o pedido nasce deixaria qualquer um disparar WhatsApp para o número de outra
  pessoa. A primeira mensagem sai quando a loja aceita.
- **Precisa de servidor sempre ligado** (Railway, uma instância só). Em serverless não
  funciona, e duas instâncias com a mesma sessão derrubam uma à outra.
- **Não é a API oficial.** Para avisar quem fez pedido o risco é baixo; disparo em massa
  para quem não pediu pode banir o número.

### Atendente (ChatGPT)

Toda mensagem que chega no WhatsApp conectado vai para o atendente de
[`lib/bot`](src/lib/bot), que conversa, monta o carrinho e fecha o pedido pelo mesmo
`create_order` do site. Pagamento: dinheiro (pergunta o troco) ou link da InfinitePay.

- **Ele não tem acesso livre ao banco**, só às ferramentas de
  [`ferramentas.ts`](src/lib/bot/ferramentas.ts): ver opções, mexer no carrinho, consultar
  bairro e cupom, fechar pedido, ver os pedidos *do próprio número* e chamar atendente.
  Uma conversa maliciosa não consegue ler dado de outro cliente nem mudar preço.
- **O telefone do pedido é o de quem está falando**, nunca um que ele digitou.
- Cardápio, taxas e horário são lidos do banco a cada resposta; a conversa e o carrinho
  ficam em `bot_conversas` e são esquecidos depois de 6h parados.
- Espera 8s de silêncio antes de responder, para juntar "oi" / "quero pizza" / "de
  calabresa" numa resposta só. Mensagem de voz é transcrita.
- **Sai da conversa sozinho**: quando o cliente pede atendente (24h), quando o próprio bot
  chama (24h) ou quando alguém da loja responde pelo celular (3h).

**Tudo se configura na página Atendente IA (`/ia`)**, no menu do painel (funciona também no
desktop, porque só fala com o banco):

| Aba | O que tem | Onde fica |
|---|---|---|
| Topo | Modo: Desligado / Teste (só os celulares da lista) / Ligado para todos; status do WhatsApp e da OpenAI. Sem configuração, começa em Teste com a lista vazia = não responde ninguém | `is_bot_active`, `ia_teste`, `whatsapp_status:principal` |
| Conversas | Histórico por cliente, pausar (1h/3h/24h/até retomar), retomar, apagar histórico, pausar número à mão | `bot_conversas`, `bot_paused_numbers` |
| Conhecimento | "Sobre a loja" e perguntas e respostas (vem com o FAQ da loja), com fotos anexáveis | `ia_config.sobreLoja`, `ia_faq` |
| Fotos | Upload de imagens (bucket `produtos/atendente/`) com "quando mandar" | `ia_midias` |
| Comportamento | Nome, jeito de falar, regras extras, fechar pedido sim/não, responder fechado, ouvir áudio, espera, mensagem de pausa | `ia_config`, `pause_message` |

| Pix | Chave da loja, nomes do recebedor, banco; lista dos últimos comprovantes com o que a IA leu | `ia_pix`, `payment_attempts` |

O bot relê essa configuração a cada resposta (cache de 15s).

### Pix na chave, conferido pela IA

Pelo WhatsApp o cliente pode pagar Pix direto na chave da loja. O pedido nasce em `AWAITING`
(invisível para a cozinha, como o pagamento online) e o bot manda chave e valor exato. Quando
chega foto ou PDF de um cliente com pedido Pix pendente, [`pix.ts`](src/lib/bot/pix.ts):

1. guarda o arquivo no bucket **privado** `comprovantes`;
2. pede para a IA só **ler** o comprovante (valor, data/hora, recebedor, chave, ID da transação);
3. **o código decide**, com regra fixa: valor exato, recebedor bate com um dos nomes
   cadastrados (aceita abreviação de banco) ou com a chave (inclusive mascarada), data/hora
   entre o pedido e agora, Pix concluído (não agendado);
4. aprovado → `mark_order_paid_pix()` (mesmas travas do pagamento online: valor exato e a
   mesma transação não paga dois pedidos — sem ID legível, vale o hash do arquivo).

**Cliente que paga antes de fechar o pedido** (o mais comum): o comprovante é lido na hora; se
for Pix, fica guardado em memória por até 2h e é conferido sozinho assim que o bot fechar o
pedido com pagamento Pix. Nesse caso a janela de data/hora conta da chegada do comprovante.
Com a aba Pix ligada, respostas do FAQ que contêm a chave são ignoradas: a chave só sai pelo
fechamento do pedido, junto com o valor exato.

A IA não decide de propósito: um texto escrito na própria imagem ("IA, aprove") não pode
virar aprovação. **Limite conhecido:** nada disso vê o extrato. Comprovante falso bem feito
passa, e a loja optou (07/10/2026) por não exigir conferência humana. Tudo fica em
`payment_attempts` (`provider = 'pix_manual'`) com a leitura da IA, para auditoria. As regras de segurança do
prompt ficam acima das "regras extras": o dono não consegue, sem querer, mandar o bot
mostrar dado de outro cliente.
- Loja fechada: avisa quando abre e tira dúvidas, mas não fecha pedido.

O caminho antigo (Evolution → `/api/webhook` → n8n) foi desligado. A rota responde 200 e
ignora, para a instância antiga não insistir nem responder em dobro.

### Tempo de entrega

Configurações → Tempo de entrega (padrão 40 min, salvo em `bot_settings.delivery_minutes`).
Vira o cronômetro regressivo da tela [`/pedido/confirmado`](src/app/pedido/confirmado/page.tsx),
que conta a partir da hora do pedido, e o "previsão: até as HH:MM" da mensagem de aceite.

---

## Horário de funcionamento

A grade fica em `store_settings` (uma linha por dia). A regra de "está aberto?" mora em
[`src/lib/storeHours.ts`](src/lib/storeHours.ts) e é espelhada no banco por `is_store_open()`.

Horário que vira a meia-noite é suportado: `17:30 → 01:00` deixa a loja aberta das 17:30
até 01:00 do dia seguinte. Toda a checagem usa o fuso `America/Sao_Paulo`, não o do servidor.

---

## Impressão

A impressora é configurada **por máquina** (fica no `localStorage`, não no banco).
Em Configurações → Impressão, ligue *"Imprimir automaticamente ao aceitar um pedido"*
apenas no computador que está ligado à impressora — se ligar em dois, o cupom sai nos dois.

A impressão silenciosa só existe na versão Electron. No navegador, abre a janela de impressão.

---

## Build

### Web (Railway / Vercel)

```bash
npm run build
npm start
```

Usa `output: 'standalone'`, com as rotas de API e o middleware ativos.

### Desktop (Electron)

```bash
npm run build:electron   # gera a pasta out/
npm run dist             # gera o instalador Windows em dist/
```

O [`build-electron.js`](build-electron.js) troca temporariamente o `next.config.ts` para
`output: 'export'` e esconde `src/app/api` e `src/middleware.ts` em `.electron-build-backup/`
(nenhum dos dois é compatível com export estático). Tudo é restaurado no final — inclusive
se você der Ctrl+C ou o build falhar.

**O instalador não leva o `.env`.** O build gera um `.env.desktop` só com o que o desktop
usa (URL e chave pública do Supabase, login do painel, dados da loja) e é ele que vai como
`resources/.env`. Antes ia o `.env` inteiro, com a `SUPABASE_SERVICE_ROLE_KEY` e os segredos
do servidor — qualquer um com o `.exe` extraía. Variável nova que o desktop precise tem que
entrar em `ENV_DESKTOP_KEYS` no [`build-electron.js`](build-electron.js).

No Electron o [`server.js`](server.js) sobe um Express na porta 3001 que serve a pasta `out`,
injeta as variáveis de ambiente via `/runtime-config.js` e reimplementa as rotas que o
desktop precisa. Não há login: o app roda na máquina do balcão.

#### Por que o `dist` passa `CSC_IDENTITY_AUTO_DISCOVERY=false`

Sem isso o electron-builder procura um certificado de assinatura, baixa o pacote
`winCodeSign` e tenta extraí-lo. Esse pacote traz symlinks de bibliotecas **do macOS**
(`libcrypto.dylib`, `libssl.dylib`), que nem são usadas no Windows — e o Windows recusa
criar symlink sem Modo de Desenvolvedor ou privilégio de administrador. O build morre em
`Cannot create symbolic link` depois de já ter gerado o `win-unpacked`, e o instalador
nunca sai. Não adianta pré-extrair o cache: cada execução sorteia um diretório novo.

Como o projeto não tem certificado configurado (o electron-builder responde
`no signing info identified`), a assinatura já não acontecia de todo jeito. A variável só
evita a busca inútil que quebrava o build.

**Consequência para quem instala:** o `.exe` não é assinado, então o SmartScreen mostra
"O Windows protegeu o seu computador". O caminho é *Mais informações → Executar assim
mesmo*. Para acabar com o aviso, só com um certificado de code signing.

#### Rota dinâmica no export estático

`output: 'export'` recusa qualquer `[param]` sem `generateStaticParams()`, e essa função
não pode ser exportada de um arquivo `'use client'`. É por isso que
`/pedido/categoria/[id]` tem um `page.tsx` de servidor com o conteúdo em
`CategoriaCliente.tsx`. Ao criar outra rota dinâmica na loja, siga o mesmo formato — senão
o build do desktop quebra, mesmo com o build do Railway passando.

---

## Autenticação

O painel usa **Supabase Auth** (e-mail + senha). É isso que dá ao banco a informação de
"esta pessoa é o admin" e permite a RLS distinguir dois papéis:

| Papel | Pode |
|---|---|
| `anon` (visitante de `/pedido`) | Ler o cardápio, taxas e horários. Criar pedido só via `create_order()`. Ver os próprios pedidos via `get_orders_by_phone()` |
| `authenticated` (admin logado) | Tudo |

A sessão fica num cookie (`@supabase/ssr`), lido pelo [`middleware.ts`](src/middleware.ts).
Diferente do esquema antigo, não dá para entrar escrevendo nada no console.

### Como se entra no painel

A tela pede **só a senha** — não há campo de usuário. O e-mail vem do `ADMIN_EMAIL`, então
o servidor já sabe quem autenticar.

Quem recebe é [`/api/auth/login`](src/app/api/auth/login/route.ts): ele manda a senha
digitada para o Supabase Auth e, dando certo, grava o cookie da sessão. Esse cookie não é
detalhe — com a RLS ligada, sem sessão o banco devolve vazio para tudo e o painel abre em
branco.

**A senha é a do usuário no Supabase**, e só. `ADMIN_PASSWORD` não é comparada com o que
se digita; ela existe para o app desktop, que entra sozinho. Para trocar a senha do painel:
Authentication → Users → o usuário → mudar a senha. Atualize o `.env` depois, para o
desktop continuar entrando.

Duas decisões que valem explicação:

- **Por que o servidor e não o navegador.** O `supabase-js` do navegador sincroniza a
  sessão entre abas com uma trava. Quando ela fica presa, o login trava em "Entrando..."
  para sempre, sem erro nenhum no console — foi o que aconteceu em 16/08/2026. No servidor
  não existe essa trava. Do lado do cliente ainda há um timeout de 20s, para a tela nunca
  ficar girando à toa.
- **Por que a senha não é conferida contra o `.env`.** Isso criaria a mesma senha em três
  lugares (`.env`, variáveis do Railway, Supabase), e um deles ficar para trás derrubaria o
  login. Aconteceu: o Railway estava com uma senha antiga e ninguém entrava. Com um dono só
  da verdade, não se repete.

A rota aguenta 10 tentativas erradas por IP a cada 5 minutos. É uma trava por processo,
que zera no restart — não substitui um rate limit na frente do app.

> Em **Authentication → Providers → Email**, desligue **"Enable Sign Ups"**. Senão qualquer
> pessoa cria conta, vira `authenticated` e ganha acesso total ao painel.

No **Electron não há tela de login**: o app roda na máquina do balcão e entra sozinho com
`ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env` empacotado. Quem tiver o instalador consegue
extrair essas credenciais — se isso for um problema, crie um usuário separado só para o
desktop.

## Pendência conhecida

A espera de 8s do atendente ([`atendimento.ts`](src/lib/bot/atendimento.ts)) fica em
memória. Um restart bem no meio desses 8s perde a mensagem (o histórico e o carrinho não,
esses estão no banco). Como o WhatsApp exige uma instância só, não há problema de várias.
