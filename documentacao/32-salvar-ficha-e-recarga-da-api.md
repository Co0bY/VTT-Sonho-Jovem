# Salvar ficha em edição e recarga da API

## Correção

Ao clicar em **Salvar personagem**, depois de validar os campos, o formulário encerra o modo de edição da ficha e envia o personagem inteiro, incluindo fundo, layout, referências e valores. Não é necessário clicar antes em Concluir edição. Se a requisição falhar, o formulário permanece aberto em preenchimento, preservando os dados e o arquivo local para nova tentativa.

O erro `Unexpected file field - sheet` vinha do processo em execução. O código-fonte e o JavaScript compilado do contêiner já aceitavam o campo `sheet`, mas os logs mostravam `EADDRINUSE` na porta 3000. Um processo Node antigo estava órfão, com pai no pnpm, enquanto a nova instância falhava ao tentar usar a porta. Assim, o endpoint de saúde respondia, mas a versão antiga continuava atendendo os uploads.

O script `dev` da API agora usa `nest start --watch --no-shell`: a CLI passa a gerenciar diretamente o processo Node, em vez do shell intermediário. As imagens foram reconstruídas e os serviços recriados sem apagar volumes. Duas recargas reais subsequentes trocaram o PID da API, mantendo uma única instância e a saúde da aplicação.

## Validação

- `pnpm --filter @vtt/web typecheck`: aprovado.
- `docker compose up -d --build --wait`: aprovado.
- Duas alterações temporárias e reversíveis em um arquivo de origem confirmaram recargas com novo PID, sem processo órfão nem conflito de porta. O arquivo foi restaurado e a API continuou saudável.
- Novo teste `pnpm --filter @vtt/api test:sheet-browser` usa a aplicação realmente servida em http://127.0.0.1:9000, com fixtures temporárias. Cria um personagem, envia fundo, adiciona Força/for e clica em Salvar personagem ainda no modo de edição. Simula uma falha HTTP, verifica o fim da edição e a preservação do fundo/campos, preenche o valor 15 e salva novamente ainda em edição. Confere resposta 201, imagem acessível e dados recuperados ao reabrir. A limpeza remove apenas as fixtures criadas pelo teste.
- No WSL desta sessão, executar o teste com `LD_LIBRARY_PATH=/tmp/vtt-browser-libs/extracted/usr/lib/x86_64-linux-gnu pnpm --filter @vtt/api test:sheet-browser`, devido às bibliotecas temporárias já usadas para Chromium. `VTT_TEST_ORIGIN` permite apontar para outro endereço local da aplicação. O teste exige a aplicação iniciada e o PostgreSQL local configurado no `.env`.

Entrega na branch `feat/tokens-e-fichas-de-jogadores`, com atualização do PR #3 e sem merge automático.
