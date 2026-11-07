# Fluxo de branches e Pull Requests — 06/11/2026

O usuário definiu que as próximas entregas devem ocorrer em branches publicadas no GitHub, acompanhadas de Pull Requests. A preferência foi registrada no `AGENTS.md` para persistir entre sessões deste repositório. O modo mentoria continua ativo: explicações em português sobre o que mudou, por que foi escolhido e como verificar, com decisões e validações documentadas.

## Convenções e rotina

1. Conferir o estado local e atualizar as referências remotas. Iniciar uma branch temática a partir de `main` atualizada, preservando qualquer trabalho em andamento.
2. Usar nomes como `feat/descricao`, `fix/descricao` e `docs/descricao`, com palavras em minúsculas separadas por hífen. Essa é a convenção de branches adotada pelo projeto; Conventional Commits define o formato das mensagens de commit, não uma regra obrigatória para nomes de branches.
3. Implementar a entrega e registrar commits `tipo(escopo): descrição`, com escopo e corpo proporcionais à mudança.
4. Publicar com upstream em `origin` e abrir um PR em rascunho para `main` quando houver alterações concretas para revisão. A autorização para esses passos já foi dada pelo usuário.
5. Atualizar o PR durante o trabalho. O título e a descrição devem refletir o comportamento final, a validação executada e as pendências reais. Não descrever uma funcionalidade planejada como implementada.
6. Fazer verificações adequadas à mudança e preparar o PR para revisão ao concluir a entrega. O merge depende de pedido explícito do usuário.

## Primeira branch deste fluxo

- Branch: `feat/tokens-e-fichas-de-jogadores`.
- Base inicial: `main`, sincronizada com `origin/main` em `2b6e201`.
- Escopo planejado: próximas alterações de tokens e fichas de jogadores, a detalhar com o usuário.
- Conteúdo inicial: registro do fluxo de desenvolvimento e da manutenção do modo mentoria. Nenhuma funcionalidade de fichas é introduzida apenas pela abertura da branch.
- Validação desta preparação: branch criada a partir da base atualizada, revisão do diff de documentação e `git diff --check`. Não há alteração de aplicação que exija repetir os testes funcionais.

O PR começa em rascunho e deve ter seu título e descrição atualizados conforme as funcionalidades forem implementadas. Esse fluxo não configura, por si só, regras de proteção de branch nem pipelines no GitHub.
