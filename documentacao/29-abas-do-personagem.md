# Abas de criação e edição de personagens

O formulário abre sempre em **Cartão de visita**, com Aparência, Token, nome, controlador, cor e descrição. **Anotações** contém apenas seu editor de texto. **Ficha** e **Configurações da ficha** ficam vazias conforme solicitado. As ações de salvar/cancelar são compartilhadas entre as quatro abas e a troca de aba mantém textos e imagens ainda não salvos.

Os editores usam texto simples multilinha, sem interpretar HTML. Cada campo permite até 20.000 caracteres. A API valida o limite e normaliza quebras de linha de formulários multipart para LF, preservando linhas em branco. PostgreSQL recebe duas colunas de texto, com padrão vazio para personagens existentes e limites também no banco. Uma edição antiga que não envie os campos preserva seu conteúdo; enviar texto vazio apaga o campo.

As permissões existentes continuam: somente o mestre cria/edita; mestre e controlador recebem os dados do personagem conforme a filtragem já existente. Anotações pertencem ao personagem e não são notas privadas por usuário. Ficha e configurações não salvam dados nesta etapa.

## Verificação

Na aplicação, abra **Novo personagem**, confira as quatro abas, preencha nome, descrição e anotações, alterne entre as abas e salve. Reabra pelo botão de edição para conferir persistência. Ficha e Configurações da ficha devem continuar vazias. Cancele uma edição e confira que ela não foi salva.

- Compilação da API, checagem de tipos da interface e `git diff --cached --check` aprovados.
- Teste de integração de personagens aprovado: textos vazios iniciais, descrição/anotações salvas, recuperação pelo controlador, preservação quando omitidos, exclusão explícita, rejeição acima de 20.000 caracteres e regressões de imagens/permissões/tokens.
- Teste completo de navegador aprovado, incluindo abas, conteúdo vazio de ficha/configurações, recuperação dos textos na edição e layout mobile sem transbordamento.
- O Chromium local exigiu bibliotecas ausentes (NSPR, NSS e ALSA). Pacotes Ubuntu foram baixados e extraídos em `/tmp/vtt-browser-libs`, sem instalação no sistema. Execução do teste com `LD_LIBRARY_PATH=/tmp/vtt-browser-libs/extracted/usr/lib/x86_64-linux-gnu pnpm --filter @vtt/api test:browser`.

Entrega na branch `feat/tokens-e-fichas-de-jogadores`, preservando alterações locais anteriores de Docker, régua e tokens. PR novo para esta continuação; nenhum merge automático.
