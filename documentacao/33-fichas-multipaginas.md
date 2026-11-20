# Fichas com várias páginas e novos campos

Na mesa, abra **Personagens**, edite um personagem e escolha **Ficha → Editar ficha**. **Adicionar página** cria uma página independente. Use os botões numerados para alternar e o seletor de arquivo para colocar um fundo na página atual. São aceitas até cinco páginas e cem campos no total. Cada fundo pode ter até 10 MB em PNG, JPEG ou WebP.

Arraste o corpo de um campo para movê-lo. Selecione o campo para revelar as quatro alças de redimensionamento. Também é possível usar as setas com foco no campo ou em uma alça, com Shift para avançar dez pixels. A posição e o tamanho respeitam os limites da página. **Destacar campo** dá contraste ao fundo transparente. **Ocultar rótulo** esconde o texto na ficha preenchível e preserva o nome acessível do controle.

| Tipo | Configuração e preenchimento |
| --- | --- |
| Texto e número | Valor digitado no campo. Números aceitam ponto ou vírgula decimal. |
| Barra | Escolha um máximo inteiro. Ao preencher, mova o controle de 0 até esse máximo. |
| Lista e opção única | Informe uma opção por linha. A lista recolhe as opções e o radio as mostra em grupo. |
| Caixa de seleção | Marque ou desmarque para guardar um valor booleano. |

Use **Concluir edição** para preencher os campos e **Salvar personagem** para gravar todas as páginas de uma vez. A versão 2 do JSON agrupa campos por página, preserva referências únicas na ficha inteira e associa imagens a IDs de página. Ao abrir uma ficha antiga, o editor reaproveita o fundo, as posições e os valores na primeira página. O servidor valida o layout, mantém os nomes internos dos arquivos sob seu controle e só serve os fundos ao mestre ou ao controlador do personagem.

Para validar, crie duas páginas com imagens distintas, arraste e redimensione um campo, configure uma barra e uma opção de cada tipo e preencha os valores. Salve e reabra a ficha para conferir os fundos, a aparência e os valores nas duas páginas.

## Validações executadas

- `pnpm build`, `pnpm --filter @vtt/web typecheck` e `pnpm --filter @vtt/web test` passaram, incluindo os 19 testes de geometria.
- `pnpm --filter @vtt/api test:characters` verificou a atualização de fichas antigas, a autorização de imagens, a remoção isolada de um fundo e a rejeição de valores inválidos.
- `pnpm --filter @vtt/api test:sheet-browser` verificou upload de dois fundos, movimentação e redimensionamento, destaque, rótulo oculto, preenchimento dos quatro novos tipos e recuperação após falha simulada ao salvar.
- No Ubuntu (WSL), as bibliotecas ausentes do Chromium do Playwright foram extraídas em diretório temporário e usadas via `LD_LIBRARY_PATH`, sem instalação de pacotes do sistema.
- `pnpm --filter @vtt/api test:browser` passou na regressão completa da mesa, incluindo criação do personagem pela ficha, arraste por ponteiro, movimento por teclado e reabertura como jogador controlador.

## Posicionamento sobre uma ficha impressa

Em **Editar ficha**, clique em **Adicionar campo** e desenhe o retângulo diretamente sobre a caixa impressa. Um clique insere um campo de 120 × 24 px. Com o quadro em foco, Enter insere esse mesmo tamanho e Esc cancela. Ao adicionar sobre uma imagem de fundo, o rótulo fica oculto inicialmente para aproveitar o texto já impresso. A propriedade **Ocultar rótulo** pode ser alterada depois.

Clique no campo ou escolha seu nome no seletor **Campo selecionado**. O contorno e o preenchimento violeta indicam a seleção enquanto você edita as propriedades. Arraste pelo centro para mover ou por qualquer canto para ajustar a área. O tamanho mínimo é de 12 × 12 px e o máximo segue os limites da página, o que permite encaixar tanto um atributo como Força quanto uma faixa larga como Tipos de Dano.

O teste focado no navegador desenhou e persistiu um campo de 35 × 22 px e outro com 700 px de largura, confirmou o destaque durante a edição do rótulo e redimensionou a barra por dois cantos opostos. O build, a checagem de tipos, a integração de personagens e a regressão de navegador da mesa também passaram.

## Conferir o valor durante o posicionamento

Selecione um campo e clique em **Editar valor no campo**. Digite ou altere o valor diretamente sobre a imagem, com o campo ainda realçado. Use as alças para ajustar o tamanho e clique em **Mover campo** ou pressione Esc para voltar a ajustar a posição. O valor faz parte do mesmo rascunho e é gravado com **Salvar personagem**.

O teste de navegador digitou um valor dentro do campo no modo de edição, conferiu o realce, retomou o modo de movimentação com Esc e verificou o valor após uma falha simulada, nova tentativa e reabertura.
