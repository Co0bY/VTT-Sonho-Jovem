# VTT Virtual — Contexto e instruções para o Codex

> Documento consolidado da conversa. Data: 05/11/2026. Idioma do projeto e comunicação: português brasileiro.

## 1. Objetivo

Construir uma plataforma **VTT (Virtual Tabletop)** completa, inspirada em Roll20, Foundry VTT e recursos do Firecast, com implementação própria, modular, capaz de hospedar campanhas e suportar sistemas de RPG genéricos e autorais (incluindo, futuramente, Shounen's Dreams). A arquitetura deve ser **híbrida**: mesma base de código utilizável como serviço centralizado (cloud) e como instalação **self-hosted** por mestres.

**Situação atual:** somente preparar e validar o ambiente. O usuário pediu explicitamente desenvolvimento em fases e que **não seja iniciado o código da VTT ainda** sem autorização. O trabalho será realizado no **computador pessoal com Windows 11**, e não no computador de trabalho. Existe lembrete para iniciar o projeto no sábado, **07/11/2026, pela manhã (~10h, Brasília)**. O usuário posteriormente autorizou começar a preparação do ambiente antes da data.

## 2. Escopo funcional desejado

- Gestão de contas, campanhas, participantes e papéis (mestre/jogador).
- Mesa com mapas importados, câmera com pan/zoom, tokens, seleção e movimentação.
- Grid configurável: quadrado, hexagonal ou desligado; tamanho, offset/alinhamento, cor, opacidade, calibração sobre mapas importados, snap-to-grid e medição de distâncias.
- **Paredes:** mestre desenha segmentos/obstáculos; propriedades independentes de bloqueio de movimento e bloqueio de visão; portas com estado aberto/fechado; possibilidade futura de janelas e obstáculos especiais.
- **Linha de visão:** cálculo geométrico a partir dos tokens, respeitando paredes; jogador só vê o permitido por seus tokens e permissões.
- **Iluminação dinâmica:** fontes de luz em tokens e no cenário (tochas, lanternas, magias), com alcance, intensidade e cor; escuridão/penumbra; fontes que acompanham tokens; Fog of War.
- Chat, rolagem de dados (XdY), histórico, macros e fichas personalizáveis.
- Suporte futuro a sistemas de RPG plugáveis, inventários, efeitos e automações.
- Multiplayer em tempo real com permissões e persistência.

**Princípio de arquitetura:** grid, paredes, visibilidade e iluminação devem ser módulos separados, embora integrados. Separar a geometria/cálculos da camada de renderização. Separar engine da mesa da interface Vue.

## 3. Stack proposta

| Camada | Escolha de planejamento |
|---|---|
| Frontend | Vue 3 + Quasar + TypeScript; Tailwind CSS opcional |
| Renderização da mesa | PixiJS |
| Backend | Node.js + NestJS |
| Tempo real | Socket.IO |
| Banco | PostgreSQL |
| ORM | Prisma |
| Arquivos | Sistema local no self-hosted; storage compatível com S3 na cloud |
| Monorepo | pnpm workspaces |
| Infra local | Docker Compose |
| Testes | Vitest e Playwright |
| Escala futura | Redis, se necessário |

Não tratar todas as tecnologias como já instaladas ou a arquitetura como validada em execução. Confirmar versões compatíveis e fixá-las no repositório quando iniciar implementação.

## 4. Estrutura sugerida do monorepo

```text
vtt-platform/
├── apps/
│   ├── web/                  # Vue + Quasar
│   └── api/                  # NestJS
├── packages/
│   ├── shared/               # Tipos, contratos e validações
│   ├── dice-engine/          # Rolagens e regras de dados
│   ├── tabletop-engine/      # Estado e lógica da mesa
│   └── game-system/          # Extensões de sistemas RPG
├── infra/
│   └── docker/
├── docs/
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

**Pasta dedicada discutida:** `C:\Projetos\VTT-Virtual` para documentos/arquivos auxiliares no Windows. Para código executado via WSL 2, **preferir diretório dentro do filesystem Linux**, por exemplo `~/projetos/vtt-platform`, por desempenho e compatibilidade; não manter projeto Node intensivo em `/mnt/c` sem motivo. Confirmar com usuário antes de criar caminhos alternativos. Não afirmar que as pastas já existem.

## 5. MVP 0.1 e fases

**MVP jogável inicial:**
1. Cadastro/login; criação e acesso a campanhas; convites.
2. Upload e exibição de mapas; grid quadrado configurável; câmera/zoom; tokens arrastáveis e seleção múltipla.
3. Sincronização de movimentos, presença e permissões de mestre/jogador.
4. Chat com histórico; rolagens de dados XdY; medição de distâncias.

**Depois do MVP:** grid hexagonal, editor de paredes, portas, linha de visão, Fog of War, iluminação dinâmica, fichas personalizadas, macros avançadas, sistemas plugáveis, inventário, áudio/vídeo. Embora posteriores, prever interfaces/módulos na arquitetura desde o começo.

**Sprints estimados:** (1) monorepo/Docker/banco/autenticação; (2) campanhas/cenas; (3) PixiJS/mapas/grid/câmera; (4) tokens; (5) multiplayer/permissões; (6) dados/chat/testes. Estimativa anterior: 6–12 semanas para MVP, sem compromisso de prazo.

## 6. Arquitetura multiplayer e segurança

- O servidor é autoridade sobre estado da sessão, permissões, movimentos e rolagens compartilhadas.
- Fluxo de token: frontend emite `token:move`; servidor valida acesso, altera estado, transmite `token:moved` e persiste; reconexão reidrata estado oficial.
- Não confiar em dados ou permissões enviados pelo navegador.
- Gerar resultados de dados compartilhados com aleatoriedade segura do servidor.
- Separar contratos de APIs/eventos em pacote compartilhado; validar payloads e autenticação.
- Em cloud e self-hosted, manter o mesmo núcleo; variar configuração, armazenamento e implantação. Nunca expor segredos `.env` no repositório.

Entidades iniciais propostas: `users`, `campaigns`, `campaign_members`, `scenes`, `tokens`, `assets`, `chat_messages`, `characters`.

## 7. Ambiente pessoal Windows 11 — tutorial de preparação

**Objetivo:** Windows 11 como host; Ubuntu via WSL 2 como ambiente de desenvolvimento; Docker Desktop com integração WSL; VS Code no Windows conectado ao WSL. Insomnia e Beekeeper Studio instalados no Windows para testar API e banco.

### 7.1 Diagnóstico antes de instalar

No **PowerShell** (admin somente quando necessário):

```powershell
wsl --status
wsl -l -v
docker --version
git --version
node --version
npm --version
code --version
```

Se algum comando falhar, registrar; não significa que tudo precisa ser reinstalado. Verificar memória RAM, virtualização, espaço em disco, versões já instaladas e se reinicialização é necessária.

### 7.2 WSL 2 + Ubuntu (se ausente)

PowerShell como administrador:

```powershell
wsl --install
```

Reiniciar quando solicitado; abrir Ubuntu e configurar usuário; confirmar `wsl -l -v` com versão 2.

Documentação: https://learn.microsoft.com/windows/wsl/install

### 7.3 Docker Desktop

Download oficial: https://www.docker.com/products/docker-desktop/

Instalar para a arquitetura correta; usar backend WSL 2; habilitar integração Ubuntu em Settings > Resources > WSL Integration. Verificar virtualização e requisitos do Docker Desktop.

No Ubuntu/WSL:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

**Não instalar Docker Engine duplicado dentro do Ubuntu** quando usar integração do Docker Desktop. Solicitar consentimento antes de instalações que exigem administrador/reboot.

### 7.4 Git, build tools, Node LTS e pnpm no Ubuntu

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

NVM: verificar a versão atual e instruções oficiais antes de executar script remoto. Na conversa anterior foi apresentado o exemplo:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Após reabrir shell:

```bash
nvm install --lts
nvm use --lts
npm install -g pnpm
node -v
npm -v
pnpm -v
git --version
```

Links: https://nodejs.org/en/download e https://pnpm.io/installation . Preferir `corepack`/configuração de versão fixa quando o projeto for inicializado, se compatível.

### 7.5 VS Code

Download oficial: https://code.visualstudio.com/download

Instalar no Windows; instalar extensão WSL; no terminal Ubuntu, depois de confirmar a localização correta:

```bash
mkdir -p ~/projetos/vtt-platform
cd ~/projetos/vtt-platform
code .
```

**Não executar scaffold do projeto ainda sem solicitação.**

### 7.6 Ferramentas Windows para API e banco

- **Insomnia:** https://insomnia.rest/download — testar REST, autenticação, requisições e respostas.
- **Beekeeper Studio:** https://www.beekeeperstudio.io/get — cliente SQL gráfico para PostgreSQL.
- **PostgreSQL Windows:** https://www.postgresql.org/download/windows/ — link disponibilizado, **mas instalação nativa não é necessária** se o banco rodar em Docker; evitar duplicidade e conflito na porta 5432.

Conexão **ilustrativa/futura** do Beekeeper, não credenciais já criadas:

```text
Host: localhost
Porta: 5432
Database: vtt_db
Usuário: vtt_user
Senha: valor definido posteriormente no .env
```

Acessar banco no Windows requer publicação segura da porta do container no host; em ambiente local, preferir bind a `127.0.0.1` e senha forte.

### 7.7 Abrir sites no Opera GX (opcional)

Foi sugerido PowerShell, assumindo caminho padrão (pode variar):

```powershell
$opera = "$env:LOCALAPPDATA\Programs\Opera GX\launcher.exe"
& $opera "https://insomnia.rest/download" "https://www.postgresql.org/download/windows/" "https://www.beekeeperstudio.io/get"
```

Se não existir esse executável, localizar a instalação antes de executar. Não afirmar que o navegador já foi controlado ou que sites foram abertos.

## 8. Checklist de preparação

- [ ] Confirmar computador pessoal Windows 11 e recursos disponíveis.
- [ ] Inspecionar instalações existentes e versões.
- [ ] Verificar WSL 2 + Ubuntu.
- [ ] Instalar/configurar Docker Desktop e integração Ubuntu, se necessário.
- [ ] Testar `docker compose` e `hello-world`.
- [ ] Verificar Git, Node LTS e pnpm no WSL.
- [ ] Instalar/configurar VS Code com extensão WSL.
- [ ] Definir e criar pasta dedicada com autorização do usuário.
- [ ] Instalar Insomnia e Beekeeper Studio no Windows, se desejado.
- [ ] Decidir se PostgreSQL será apenas containerizado (recomendado).
- [ ] Registrar resultados e pendências.
- [ ] **Não iniciar desenvolvimento da VTT sem nova autorização.**

## 9. Orientações para o Codex ao receber este documento

1. Comece inspecionando o sistema **real** em que está rodando: Windows/WSL/Ubuntu, privilégios, ferramentas, caminhos e permissões. Não presuma acesso ao Windows a partir do Ubuntu.
2. Confirme que está na máquina pessoal, e não em máquina de trabalho, antes de alterar configurações.
3. Reutilize ferramentas existentes e evite instalações redundantes. Antes de qualquer mudança administrativa, instalação global, reboot ou alteração de rede, explique e peça aprovação.
4. Faça apenas a **preparação do ambiente**, com testes e documentação dos resultados; o usuário ainda não quer implementar a plataforma.
5. Se o Codex estiver rodando somente no Ubuntu, descreva as etapas que precisam ser feitas manualmente no Windows (Docker Desktop, VS Code, Insomnia, Beekeeper), sem fingir que foram executadas.
6. Mantenha a distinção entre **decisões**, **propostas** e **itens não verificados**.
7. Ao concluir, entregue um resumo de ferramentas instaladas, versões, comandos testados, pasta efetivamente criada e pendências para o início do desenvolvimento.

## 10. Estado e histórico importantes

- Houve discussão sobre um ZIP de starter e comandos `pnpm install`/`pnpm dev` em mensagem anterior; **não considerar que o starter foi baixado, instalado ou executado**. A prioridade mudou para planejamento e preparação.
- O usuário pediu links oficiais para Insomnia, PostgreSQL e Beekeeper, e perguntou como abrir no Opera GX.
- O usuário explicitou a preferência por **trabalhar em fases** e preservar o computador de trabalho.
- O projeto foi pensado inicialmente como `vtt-platform`, com uma pasta Windows sugerida `C:\Projetos\VTT-Virtual`; nomes podem ser confirmados antes de implementação.
- Lembrete do início do projeto foi confirmado para 07/11/2026, por volta das 10h, horário de Brasília.

---

**Próxima ação esperada:** diagnosticar o ambiente Ubuntu/WSL atual, confirmar o diretório dedicado e preparar somente as dependências faltantes, solicitando permissão para operações de instalação. Não começar o código da VTT nesta etapa.
