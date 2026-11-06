# Organização inicial do histórico Git

O usuário solicitou commits descritivos segundo Conventional Commits. Como o repositório ainda não tinha commits e todos os arquivos do projeto estavam sem rastreamento, o estado atual foi organizado por responsabilidade, sem reconstruir artificialmente versões anteriores das funcionalidades.

## Convenção

Formato: `tipo(escopo): descrição`, com linha em branco antes do corpo. Os títulos usam verbos no infinitivo em português e o corpo registra comportamento, decisões relevantes e validações. Não foram encontrados arquivos commitlint ou regras locais adicionais de nomenclatura. Não há marcador de breaking change porque esta é a primeira versão registrada no repositório.

## Sequência

1. `build(workspace): configurar monorepo pnpm e infraestrutura local`
   Configuração do workspace, Node/pnpm, manifests, lockfile, compiladores, Quasar, Nest, PostgreSQL, MailHog e regras de arquivos ignorados.
2. `feat(api): implementar contas, campanhas e cenários com camadas`
   Autenticação e e-mails; campanhas e convites; chat e dados; cenários, uploads e camadas; correção das duplicações; mínimo de uma cena; dimensões dinâmicas e proteção do conteúdo.
3. `feat(web): integrar dashboard e editor de mesa com cenários`
   Login e primeiro acesso; dashboard; PixiJS; painéis, pop-ups, camadas, objetos, régua e dimensões em pixels/quadrados.
4. `test(vtt): validar autenticação, cenários e interação na mesa`
   Integração real da API, geometria e Chromium com duas sessões, incluindo arquivos temporários e limpeza dos fixtures.
5. `docs(projeto): registrar arquitetura, decisões e validações`
   Instruções de colaboração, contexto e guias acumulados de desenvolvimento, execução e verificação.

Os commits registram a composição atual do projeto; correções como duplicação de cenários são descritas no corpo do commit que introduz o módulo correspondente, pois não existe versão anterior rastreada para um commit `fix` separado.

## Validações utilizadas

As verificações concluídas nas entregas anteriores cobrem `pnpm build`, `pnpm --filter @vtt/web typecheck`, `pnpm --filter @vtt/web test`, `pnpm --filter @vtt/api test:integration`, `pnpm --filter @vtt/api test:scenes` e `pnpm --filter @vtt/api test:browser`. A organização dos commits não altera o código dessas entregas.

Antes de registrar o histórico, foi conferida a lista de arquivos a versionar e a exclusão de `.env`, dependências, builds, capturas de análise e uploads locais. Em `analise-arquivo/` e `storage/`, somente o `.gitignore` integra o histórico. A autoria deve usar o nome/e-mail fornecidos pelo usuário, sem alteração de configuração global. Não há envio ao remoto neste pedido.

## Execução

Autoria configurada somente neste repositório com o nome e e-mail informados pelo usuário. Os primeiros quatro commits foram registrados como `89d28a0` (infraestrutura), `98a45f8` (API), `82846ac` (interface) e `efd4c61` (testes). Este registro integra o quinto commit, de documentação. Os títulos foram conferidos no formato Conventional Commits e com até 72 caracteres; todos os commits têm corpo descritivo. O índice foi verificado com `git diff --cached --check` antes de cada registro. Não houve alteração das configurações globais nem publicação no remoto.
