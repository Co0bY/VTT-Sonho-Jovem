# Fichas com várias páginas e novos campos

Na mesa, abra **Personagens**, edite um personagem e escolha **Ficha → Editar ficha**. **Adicionar página** cria uma página independente. Use os botões numerados para alternar e o seletor de arquivo para colocar um fundo na página atual. São aceitas até cinco páginas e cem campos no total. Cada fundo pode ter até 10 MB em PNG, JPEG ou WebP.

Arraste o corpo de um campo para movê-lo. Selecione o campo para revelar a alça no canto inferior direito, que muda largura e altura. Também é possível usar as setas com foco no campo ou na alça, com Shift para avançar dez pixels. A posição e o tamanho respeitam os limites da página. **Destacar campo** dá contraste ao fundo transparente. **Ocultar rótulo** esconde o texto na ficha preenchível e preserva o nome acessível do controle.

| Tipo | Configuração e preenchimento |
| --- | --- |
| Texto e número | Valor digitado no campo. Números aceitam ponto ou vírgula decimal. |
| Barra | Escolha um máximo inteiro. Ao preencher, mova o controle de 0 até esse máximo. |
| Lista e opção única | Informe uma opção por linha. A lista recolhe as opções e o radio as mostra em grupo. |
| Caixa de seleção | Marque ou desmarque para guardar um valor booleano. |

Use **Concluir edição** para preencher os campos e **Salvar personagem** para gravar todas as páginas de uma vez. A versão 2 do JSON agrupa campos por página, preserva referências únicas na ficha inteira e associa imagens a IDs de página. Ao abrir uma ficha antiga, o editor reaproveita o fundo, as posições e os valores na primeira página. O servidor valida o layout, mantém os nomes internos dos arquivos sob seu controle e só serve os fundos ao mestre ou ao controlador do personagem.

Para validar, crie duas páginas com imagens distintas, arraste e redimensione um campo, configure uma barra e uma opção de cada tipo e preencha os valores. Salve e reabra a ficha para conferir os fundos, a aparência e os valores nas duas páginas.
