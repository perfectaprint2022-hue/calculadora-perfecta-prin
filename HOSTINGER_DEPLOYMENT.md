# Hostinger — Calculadora Perfecta Print

## O que este pacote contém

Código-fonte do monorepo, API Node/Express, interface React/Vite, bibliotecas compartilhadas, schemas PostgreSQL e um exemplo de variáveis. O arquivo ZIP abre normalmente no WinRAR.

Não inclui segredos, `.env` real, dependências instaladas, builds, arquivos de Git nem dados do banco. Para preservar usuários e dados atuais, faça uma exportação e importação do banco separadamente.

## Requisitos de hospedagem

- Node.js 22 ou 24, pnpm 10 e PostgreSQL.
- A aplicação tem duas partes: interface estática e API em Node, com `/api` encaminhado para a API.
- A Hostinger oferece Node.js gerenciado em planos Business/Cloud; PostgreSQL próprio é suportado em VPS. Em Business/Cloud, use um PostgreSQL externo. Para controle completo de Nginx, API e PostgreSQL no mesmo servidor, use VPS.
- A API ainda contém middleware/proxy Clerk. As chaves não estão no ZIP; configure credenciais válidas no ambiente Hostinger ou revise essa integração antes de publicar fora do Replit.

Referências oficiais:
- [Hospedagem Node.js da Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Bancos compatíveis com os planos Hostinger](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/)

## Instalação em VPS Linux

1. Extraia o ZIP e entre na pasta `calculadora-perfecta-print`.
2. Configure as variáveis do `.env.example` no painel seguro do servidor. Use uma `SESSION_SECRET` aleatória e mantenha o mesmo valor entre reinicializações. `MASTER_PASSWORD` deve ter pelo menos 12 caracteres.
3. Instale dependências:

   ```sh
   corepack enable
   corepack prepare pnpm@10.26.1 --activate
   pnpm install --frozen-lockfile
   ```

4. Aponte `DATABASE_URL` para um PostgreSQL vazio e aplique o schema:

   ```sh
   pnpm --filter @workspace/db run push
   ```

   Faça backup antes de usar o comando em um banco que já contenha dados.

5. Gere os builds:

   ```sh
   pnpm --filter @workspace/api-server run build
   NODE_ENV=production BASE_PATH=/ PORT=8080 pnpm --filter @workspace/calculadora-etiquetas run build
   ```

6. Execute a API como serviço persistente:

   ```sh
   PORT=8080 NODE_ENV=production node artifacts/api-server/dist/index.mjs
   ```

7. Configure o servidor web para servir `artifacts/calculadora-etiquetas/dist/public`, usar `index.html` como fallback das rotas do app e encaminhar `/api/*` para `127.0.0.1:8080`, preservando o caminho `/api`.
8. Depois que o site estiver funcionando no servidor, configure HTTPS e atualize o DNS usando os registros fornecidos pela Hostinger. Se o CNAME atual aponta para o Replit, substitua-o somente na hora da migração.

No primeiro início com um banco sem master, `MASTER_USERNAME` e `MASTER_PASSWORD` provisionam a conta master. Mantenha os valores reais apenas no gerenciador de variáveis/segredos do servidor.
