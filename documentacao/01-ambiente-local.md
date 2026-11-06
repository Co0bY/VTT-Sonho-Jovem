# Ambiente local do VTT Sonho Jovem

## O que instalamos e por quê

| Recurso | Onde fica | Papel no projeto |
| --- | --- | --- |
| Ubuntu em WSL 2 | Windows | Executa as ferramentas Linux e mantém o código em `~/projetos/vtt-platform`. |
| Git, curl e build-essential | Ubuntu | Versionam o código, fazem requisições HTTP e disponibilizam compiladores para dependências nativas. |
| nvm, Node.js 26.13.0 e pnpm 12.18.0 | Usuário Linux | O nvm seleciona a versão do Node. O Node executa as aplicações e o pnpm resolve e instala as dependências. |
| VS Code e extensão WSL | Windows | Abrem o repositório com terminal e ferramentas do Ubuntu. |
| Docker Desktop e Compose | Windows, integrado ao Ubuntu | O Docker executa o PostgreSQL. O Compose descreve como subir o serviço de forma reproduzível. |
| PostgreSQL 17 | Contêiner | Armazena dados relacionais. O volume nomeado preserva os dados quando o contêiner é recriado. |

## Como a base foi organizada

O ZIP Starter 0.1 não foi localizado. A base foi implementada no clone do GitHub seguindo a arquitetura combinada. O workspace reúne `apps/web` (Vue 3, Quasar, Vue Router e Vite) e `apps/api` (NestJS, Express e o driver PostgreSQL `pg`). O TypeScript verifica tipos durante o desenvolvimento. O pnpm mantém um lockfile comum para que as instalações resolvam as mesmas versões.

O `compose.yaml` publica o PostgreSQL apenas no endereço local. O `.env.example` documenta a variável de senha para desenvolvimento e o `.env` real é ignorado pelo Git. Use a senha de exemplo somente no ambiente local. A configuração do Compose e da API compartilha o mesmo arquivo.

## Reproduzir no Ubuntu

Na primeira execução, crie o arquivo de configuração local. Se ele já existir, preserve seu conteúdo.

```bash
cd ~/projetos/vtt-platform
nvm use
test -f .env || cp .env.example .env
docker compose up -d --wait
pnpm install --frozen-lockfile
pnpm dev
```

O Compose espera o banco ficar saudável. O `pnpm dev` inicia as duas aplicações em paralelo. A API abre em `http://localhost:3000/health` e executa `SELECT 1` pelo pool de conexões. Se a consulta falhar, responde HTTP 503. A página em `http://localhost:9000` usa o botão **Verificar ambiente** para chamar essa rota pelo proxy local do Vite. O proxy existe no servidor de desenvolvimento.

Em outro terminal, confira o caminho completo e compile as duas aplicações.

```bash
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:9000/api/health
pnpm build
```

As duas consultas devem retornar `{"status":"ok","database":"up"}`. Se apenas a primeira funcionar, investigue o proxy do frontend. Se ambas retornarem 503, execute `docker compose ps` e consulte `docker compose logs postgres`. O comando `docker compose stop` pausa o banco e preserva o volume.

## Próxima fase

O primeiro marco valida frontend, API e banco. A próxima entrega adiciona a mesa PixiJS com grid ajustável, câmera, zoom e tokens arrastáveis. Prisma entra quando modelarmos os primeiros dados do jogo e Socket.IO quando sincronizarmos a mesa entre jogadores.
