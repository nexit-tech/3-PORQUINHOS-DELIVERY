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
| Painel | `/`, `/products`, `/finance`, `/settings`, `/notifications` | Loja (protegido por login) |
| Cliente | `/pedido/*` | Público |
| API | `/api/auth/*`, `/api/webhook`, `/api/evolution`, `/api/cron/*` | Navegador e Evolution API |

```
src/
├── app/            páginas e rotas de API
├── components/     admin/, client/, common/, layout/
├── config/store.ts nome, telefone e números VIP da loja
├── context/        AuthContext, CartContext
├── hooks/          useProducts, useAdminOrders, useOrders, useFinance, useStoreStatus
├── lib/            storeHours, session, printerSettings, apiAuth, env, isElectron
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
| `05-admin-user.sql` | Cria o usuário admin no Supabase Auth | ⏳ pendente |
| `04-rls-pedidos.sql` | Liga a RLS e tranca o acesso | ⏳ pendente — **só depois do deploy** |
| `06-service-role.sql` | Conferência: RLS, políticas e Realtime | — |

Os aplicados são todos **aditivos**: criam função ou tabela e não mudam o comportamento
do código que já está em produção.

> ⚠️ **O `04` não pode ser aplicado antes do deploy do código novo.** Ele bloqueia o
> INSERT direto em `orders`, e o código atualmente em produção insere direto — a loja
> pararia de aceitar pedidos na hora.
>
> Ordem correta: `05` (criar usuário) → deploy do código novo → confirmar que o login
> funciona → preencher `SUPABASE_SERVICE_ROLE_KEY` → `04`.

### Tabelas

`orders`, `order_items`, `products`, `categories`, `complement_groups`, `complement_options`,
`product_complements`, `delivery_zones`, `store_settings`, `bot_settings`,
`bot_paused_numbers`, `bot_notifications`, `order_notifications`.

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
