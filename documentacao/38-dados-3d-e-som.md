# Dados 3D e som da mesa

Cada nova rolagem do chat aparece no tabuleiro como uma sequência curta de dados. O efeito vale para comandos, atalhos e macros com um ou mais grupos. A animação usa os valores sorteados pelo servidor. As faces finais ficam visíveis até o próximo clique na mesa, inclusive em um controle que você queira usar. Se houver outra rolagem aguardando, ela começa após o clique. O Canvas para de redesenhar assim que a animação termina. Participantes que já estão na mesa veem as novas rolagens na próxima sincronização.

## Decisões

O Canvas projeta sólidos 3D com iluminação simples. d4, d6, d8, d10, d12 e d20 têm suas próprias formas. d2 aparece como moeda e outras quantidades de faces, como d100, usam um marcador numerado. O efeito exibe até 30 dados por mensagem. O chat continua mostrando todos os dados, modificadores e resultados.

O áudio é sintetizado pela Web Audio API. O navegador libera o som após a primeira interação com a mesa. O controle de nota musical permite silenciar e guarda essa preferência no navegador. A configuração do sistema para reduzir movimento faz as faces finais aparecerem diretamente. Recarregar a tela ou abrir o histórico não reproduz rolagens antigas.

## Como verificar

Envie `/roll 2d6+3` no chat e compare as duas faces do efeito com as duas faces da mensagem. O modificador aparece no total. Teste d4, d10 e d20 para conferir as formas. Aguarde as faces pararem e clique no título ou no campo do chat. Confira que os dados somem e que o campo ainda recebe foco normalmente. Depois silencie o som, faça outra rolagem e confira que o efeito visual continua.

## Paginação do chat

Ao abrir ou recarregar a mesa, o chat fica no fim e mostra até 50 mensagens. Role até o topo para carregar as 50 anteriores. O botão **Carregar mensagens anteriores** oferece a mesma ação pelo teclado e permite repetir a tentativa em caso de falha. Ao receber a página, a interface mede a posição da primeira mensagem já carregada e ajusta a rolagem para mantê-la no mesmo ponto.

O identificador da mensagem funciona como cursor. `GET /campaigns/:id/tabletop/messages?before=ID` busca os registros anteriores dentro da mesma campanha. O PostgreSQL busca até 51 registros usando o índice já existente. O registro extra indica se ainda há histórico. Uma mensagem nova não altera o cursor usado para percorrer páginas antigas.

A atualização periódica usa `GET /campaigns/:id/tabletop?after=ID` para receber as mensagens posteriores e mantê-las junto das páginas já carregadas. A API serializa os envios por campanha antes de alocar o ID para manter a ordem observável pelo cursor. A fila de animação recebe somente as mensagens novas dessa sincronização. Se você estiver no histórico, novas mensagens são acrescentadas ao fim sem interromper a leitura.

Para verificar no navegador, abra uma mesa com mais de 100 mensagens. Confira as 50 mais recentes ao abrir, carregue duas páginas subindo ao topo e envie uma mensagem em outra sessão enquanto lê. Depois, recarregue e confirme que o chat volta às 50 mais recentes. O cenário automatizado usa `pnpm --filter @vtt/api test:browser`.

## Validação na retomada

- `docker compose up -d --build` iniciou PostgreSQL e MailHog. Com `pnpm dev` no Ubuntu, a interface respondeu em `http://127.0.0.1:9000` e `/api/health` retornou `database: up`.
- `pnpm build`, `pnpm --filter @vtt/web typecheck`, os 22 testes de `pnpm --filter @vtt/web test` e `pnpm --filter @vtt/api test:characters` passaram.
- `pnpm --filter @vtt/api test:browser` passou no Chromium. A suíte verificou Canvas, reprodução e silêncio, sincronização entre sessões e histórico sem animação. Com 125 mensagens de teste, verificou também a abertura com 50, a posição ao carregar páginas anteriores e receber uma mensagem nova, e o retorno a 50 após recarregar.
- O Chromium deste Ubuntu precisou de `libnspr4`, `libnss3` e `libasound2t64`. Para a validação, extraí os pacotes em uma pasta temporária e usei `LD_LIBRARY_PATH` no comando de teste.
- Após o ajuste de permanência, a suíte de navegador confirmou que o Canvas segue visível após o tempo anterior de remoção e desaparece ao clicar no título ou no campo do chat. O campo recebe foco normalmente. Build, checagem de tipos e os 22 testes unitários também passaram.
- O d8 ganhou uma pose final inclinada e uma projeção com mais profundidade. O octaedro mantém suas proporções, mas exibe faces vizinhas mais largas durante o giro e quando para. O teste unitário mede a área relativa das faces projetadas e confere o número final. O Chromium exibiu o dado durante o giro e após a parada e confirmou a remoção por clique. Build, checagem de tipos e os 23 testes unitários passaram.
