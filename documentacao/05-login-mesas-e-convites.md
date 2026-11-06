# Login, dashboard e convites — 05/11/2026

## Autorização e escopo

O usuário autorizou iniciar o desenvolvimento de login funcional, cadastro, dashboard, criação de mesas e convites. Essa solicitação substitui a restrição anterior de preparar somente o ambiente registrada em `VTT_INSTRUCOES_CODEX.md`.

Esta entrega permite organizar campanhas e seus participantes. A mesa gráfica, mapas, tokens, chat e multiplayer durante o jogo ainda não estão implementados. Convites são compartilhados por link; não há envio de e-mail nesta etapa.

## Decisões

- Preservamos Vue/Quasar, NestJS e PostgreSQL existentes, sem novas dependências. A interface tem login/cadastro e dashboard responsiva com busca, filtros de papel e criação de campanha.
- Cada campanha tem um mestre, nome, sistema e descrição. Jogadores entram por convite autenticado. As permissões são verificadas no servidor, inclusive ao listar mesas e gerar convites.
- Senhas usam `scrypt` assíncrono com salt aleatório individual e comparação constante. Não retornamos hashes para o navegador. Referência: https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
- Sessões duram sete dias e usam cookie HttpOnly, SameSite=Lax, com Secure em produção. O banco guarda somente o hash do token; logout o invalida no servidor. O navegador não armazena credenciais em localStorage.
- Cadastro/login têm limite inicial de 30 tentativas por IP a cada 15 minutos, em memória por processo. Mutações verificam a origem quando enviada pelo navegador. Para implantação futura, configurar HTTPS, WEB_ORIGIN e proxy de mesma origem para `/api`; a configuração atual de proxy do Quasar é de desenvolvimento. Limitação: múltiplas instâncias exigirão limitador compartilhado e configuração de proxy confiável.
- Convites possuem 256 bits aleatórios, hash no banco e validade de sete dias. Podem ser usados por vários jogadores; quem recebe o link obtém acesso como jogador. Aceite repetido é idempotente e o mestre não vira jogador da própria campanha.
- O schema inicial está em `apps/api/src/database.ts`, criado em transação com lock na inicialização. Não apaga tabelas existentes. O projeto ainda não tinha Prisma nem migrações: antes de evoluir esse schema, introduzir migrações versionadas. Chaves estrangeiras e unicidade protegem os vínculos: https://www.postgresql.org/docs/17/ddl-constraints.html

## Como executar

No Ubuntu/WSL, na raiz, com o Node da `.nvmrc` e pnpm:

```bash
nvm use
pnpm install --frozen-lockfile
docker compose up -d
pnpm dev
```

Mantenha `.env` local com POSTGRES_PASSWORD correspondente ao banco já criado. Não altere essa senha sem ajustar o banco. A API escuta em `127.0.0.1:3000`; `PORT` permite uma porta alternativa para testes. Abra http://127.0.0.1:9000 no navegador.

1. Crie uma conta com nome, e-mail e senha de 10 a 128 caracteres.
2. Crie uma mesa, informando nome, sistema e descrição opcional.
3. Clique em **Convidar jogadores** e copie o link.
4. Abra o link em uma janela anônima. Cadastre outra conta ou faça login, depois clique em **Aceitar convite**.
5. A segunda conta verá a mesa com papel de jogador; a primeira, como mestre. O convite deve continuar na URL durante cadastro/login.
6. Atualize a página para verificar a sessão; saia e entre novamente para verificar persistência.
7. Verifique busca, filtros, mensagens de erro, navegação por teclado e layout em celular.

## Validação executada

- `pnpm build`: backend TypeScript e frontend Quasar/Vite compilados com sucesso.
- `pnpm --filter @vtt/api test:integration`: teste real contra PostgreSQL local, com API isolada na porta 3101. Cria duas contas temporárias e limpa apenas os registros dessa execução ao terminar.
- Cobertura: rota protegida sem sessão (401), senha curta (400), cadastro duplicado (409), senha errada (401), restauração de sessão, origem externa (403), criação inválida (400), criação persistida, isolamento da listagem, geração de convite pelo mestre, bloqueio de geração por jogador (403), convite sem autenticação (401), link inválido/expirado (404), entrada como jogador, aceite idempotente, contagem de participantes, logout e login com e-mail normalizado.
- PostgreSQL no Docker foi encontrado saudável. Node 26.13.0 e pnpm 12.18.0 já estavam instalados via NVM; não houve instalação global ou mudança no Windows.
- O frontend foi compilado; a inspeção visual e interação em navegador ainda precisam seguir o roteiro acima. Não havia navegador automatizado disponível nesta sessão.

## Próximos incrementos

A mesa PixiJS permanece como entrega futura. Também ficam para etapas posteriores recuperação/verificação de e-mail, revogação de convites e gestão de participantes, além da preparação para publicação em produção.
