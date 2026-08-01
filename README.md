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
| Painel | `/`, `/products`, `/finance`, `/settings`, `/notifications`, `/coupons` | Loja (protegido por login) |
| Cliente | `/pedido/*` | Público |
| API | `/api/webhook`, `/api/evolution`, `/api/cron/*` | Evolution API e agendador |
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
├── services/       supabase, evolution, notifications, messageBuffer, botSettings
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
| `10-somente-pagamento-online.sql` | Trigger que recusa pedido "pagar na entrega" | ✅ aplicado |
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
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | só no desktop | Credenciais do Supabase Auth com que o app Electron entra sozinho |
| `WEBHOOK_SECRET` | recomendado | Protege `/api/webhook`. Vazio = endpoint aberto |
| `CRON_SECRET` | recomendado | Protege `/api/cron/*`. Vazio = endpoint aberto |
| `INFINITEPAY_HANDLE` | só p/ pagamento online | Sua InfiniteTag, **sem o `$`**. Vazia = a opção "Pagar agora" nem aparece no checkout |
| `NEXT_PUBLIC_APP_URL` | só p/ pagamento online | Domínio público da loja. É dele que saem a `webhook_url` e a `redirect_url` |
| `INFINITEPAY_API_URL` | opcional | Sobrescreve a base da API (padrão `https://api.checkout.infinitepay.io`) |
| `EVOLUTION_API_URL` / `_KEY` / `_INSTANCE_NAME` | opcional | Envio de WhatsApp |
| `N8N_WEBHOOK_URL` | opcional | Destino das mensagens agrupadas pelo bot |
| `NEXT_PUBLIC_STORE_*` | opcional | Nome, telefone e site da loja no cupom e nas mensagens |
| `VIP_NUMBERS` | opcional | Números que o bot responde mesmo fora do horário |

### Webhook da Evolution API

Configure a URL com o segredo, de qualquer uma destas formas:

```
Authorization: Bearer <WEBHOOK_SECRET>
x-webhook-secret: <WEBHOOK_SECRET>
https://SEU-DOMINIO/api/webhook?secret=<WEBHOOK_SECRET>
```

---

## Pagamento online (InfinitePay)

> 💳 **A loja aceita SOMENTE pagamento pelo site.** Não existe "pagar na entrega" — nem
> maquininha, nem dinheiro. O checkout oferece uma opção só, e o
> [`10-somente-pagamento-online.sql`](supabase/10-somente-pagamento-online.sql) recusa no
> banco qualquer pedido `ON_DELIVERY`, porque a tela sozinha não segura quem abre o
> console. Consequência: **se a InfinitePay cair, a loja não registra pedido nenhum.**
> Para reverter, veja o cabeçalho daquele arquivo.

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

> Em **Authentication → Providers → Email**, desligue **"Enable Sign Ups"**. Senão qualquer
> pessoa cria conta, vira `authenticated` e ganha acesso total ao painel.

No **Electron não há tela de login**: o app roda na máquina do balcão e entra sozinho com
`ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env` empacotado. Quem tiver o instalador consegue
extrair essas credenciais — se isso for um problema, crie um usuário separado só para o
desktop.

## Pendência conhecida

O buffer de mensagens do bot ([`messageBuffer.ts`](src/services/messageBuffer.ts)) guarda
as mensagens em memória com `setTimeout` de 30s. No Railway funciona, mas o buffer se perde
a cada redeploy ou restart, e não sobrevive a múltiplas instâncias. Se for escalar, precisa
sair para Redis ou uma tabela.
