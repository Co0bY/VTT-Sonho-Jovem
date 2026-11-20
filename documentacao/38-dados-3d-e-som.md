# Dados 3D e som da mesa

Cada nova rolagem do chat aparece no tabuleiro como uma sequência curta de dados. O efeito vale para comandos, atalhos e macros com um ou mais grupos. A animação usa os valores sorteados pelo servidor e termina mostrando essas faces. Participantes que já estão na mesa veem as novas rolagens na próxima sincronização.

## Decisões

O Canvas projeta sólidos 3D com iluminação simples. d4, d6, d8, d10, d12 e d20 têm suas próprias formas. d2 aparece como moeda e outras quantidades de faces, como d100, usam um marcador numerado. O efeito exibe até 30 dados por mensagem. O chat continua mostrando todos os dados, modificadores e resultados.

O áudio é sintetizado pela Web Audio API. O navegador libera o som após a primeira interação com a mesa. O controle de nota musical permite silenciar e guarda essa preferência no navegador. A configuração do sistema para reduzir movimento faz as faces finais aparecerem diretamente. Recarregar a tela ou abrir o histórico não reproduz rolagens antigas.

## Como verificar

Envie `/roll 2d6+3` no chat e compare as duas faces do efeito com as duas faces da mensagem. O modificador aparece no total. Teste d4, d10 e d20 para conferir as formas. Depois silencie o som, faça outra rolagem e confira que o efeito visual continua.
