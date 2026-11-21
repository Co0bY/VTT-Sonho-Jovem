# Dados 3D e som da mesa

Cada nova rolagem do chat aparece no tabuleiro como uma sequência curta de dados. O efeito vale para comandos, atalhos e macros com um ou mais grupos. A animação usa os valores sorteados pelo servidor e termina mostrando essas faces. Participantes que já estão na mesa veem as novas rolagens na próxima sincronização.

## Decisões

O Canvas projeta sólidos 3D com iluminação simples. d4, d6, d8, d10, d12 e d20 têm suas próprias formas. d2 aparece como moeda e outras quantidades de faces, como d100, usam um marcador numerado. O efeito exibe até 30 dados por mensagem. O chat continua mostrando todos os dados, modificadores e resultados.

O áudio é sintetizado pela Web Audio API. O navegador libera o som após a primeira interação com a mesa. O controle de nota musical permite silenciar e guarda essa preferência no navegador. A configuração do sistema para reduzir movimento faz as faces finais aparecerem diretamente. Recarregar a tela ou abrir o histórico não reproduz rolagens antigas.

## Como verificar

Envie `/roll 2d6+3` no chat e compare as duas faces do efeito com as duas faces da mensagem. O modificador aparece no total. Teste d4, d10 e d20 para conferir as formas. Depois silencie o som, faça outra rolagem e confira que o efeito visual continua.

## Paginação do chat

Ao abrir ou recarregar a mesa, o chat fica no fim e mostra até 50 mensagens. Role até o topo para carregar as 50 anteriores. O botão **Carregar mensagens anteriores** oferece a mesma ação pelo teclado e permite repetir a tentativa em caso de falha. Ao receber a página, a interface mede a posição da primeira mensagem já carregada e ajusta a rolagem para mantê-la no mesmo ponto.

O identificador da mensagem funciona como cursor. `GET /campaigns/:id/tabletop/messages?before=ID` busca os registros anteriores dentro da mesma campanha. O PostgreSQL busca até 51 registros usando o índice já existente. O registro extra indica se ainda há histórico. Uma mensagem nova não altera o cursor usado para percorrer páginas antigas.

A atualização periódica usa `GET /campaigns/:id/tabletop?after=ID` para receber as mensagens posteriores e mantê-las junto das páginas já carregadas. A API serializa os envios por campanha antes de alocar o ID para manter a ordem observável pelo cursor. A fila de animação recebe somente as mensagens novas dessa sincronização. Se você estiver no histórico, novas mensagens são acrescentadas ao fim sem interromper a leitura.

Para verificar no navegador, abra uma mesa com mais de 100 mensagens. Confira as 50 mais recentes ao abrir, carregue duas páginas subindo ao topo e envie uma mensagem em outra sessão enquanto lê. Depois, recarregue e confirme que o chat volta às 50 mais recentes. O cenário automatizado usa `pnpm --filter @vtt/api test:browser`.
