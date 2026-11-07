# Proporção, grid e exclusão — 06/11/2026

## Comportamento

A referência `analise-arquivo/expansão-dinamica.png` mostra uma imagem de personagem deformada no redimensionamento. As alças dos objetos e do fundo agora mantêm a proporção atual por padrão, com tamanho em passos do grid do cenário.

O lado maior é arredondado para um múltiplo da célula e o outro acompanha a mesma escala. Exemplo: uma imagem de 320 × 220 pixels pode passar para 384 × 264 com grid de 64 pixels. Arredondar ambos os lados independentemente distorceria a imagem. O canto oposto permanece fixo, inclusive com rotação. O tamanho mínimo continua sendo 8 pixels por lado.

- **Arrastar um canto:** escala proporcional em passos do grid. Essa regra vale mesmo quando o encaixe de movimento dos tokens está desativado.
- **Alt + arrastar um canto:** tamanho livre em pixels, permitindo mudar largura e altura independentemente. Pressionar ou soltar Alt durante o gesto recalcula a prévia, mesmo sem mover o ponteiro.
- **Duplo clique:** abre o modal. Desmarcar **Manter proporção** libera medidas independentes. A opção volta marcada ao abrir outra edição.
- **Excluir objeto** no modal: remove a imagem selecionada da mesa e seu arquivo. O fundo principal não recebe esse botão; excluir objeto não exclui o cenário.
- **Delete/Del**, com foco no tabuleiro e seleção na camada ativa: exclui o token ou objeto selecionado. Apenas o mestre pode excluir. Campos de texto e diálogos não acionam o atalho. Repetição automática da tecla é ignorada.
- **Escape:** continua cancelando a transformação em andamento e desfazendo a seleção.

## Implementação

A geometria recebe opções de proporção e célula, sem depender de eventos do navegador. A mesa envia o estado de Alt ao cálculo e emite o pedido de exclusão para a página. A página reutiliza a ação de exclusão de token existente e a nova rota de objetos.

`POST /campaigns/:id/tabletop/objects/:objectId/remove` exige sessão, validação de mutação e permissão de mestre. O DELETE no banco é limitado à campanha e ao cenário ativo. Após excluir o registro, a API remove o arquivo do storage; uma falha de limpeza é registrada no servidor, sem restaurar um objeto que já foi excluído. Objetos de outra campanha/cenário não são removidos.

Os limites do cenário continuam seguindo posição e dimensões antes da rotação, conforme a entrega anterior. Não há expansão automática da área do cenário ao arrastar imagens.

## Validação

- `pnpm --filter @vtt/web test`: nove testes aprovados. Incluem proporção/grid em imagens horizontais e verticais, quatro cantos e diferentes rotações, mínimo de tamanho e modo livre.
- `pnpm --filter @vtt/web typecheck`: aprovado.
- Builds de frontend e API: aprovados.
- `pnpm --filter @vtt/api test:scenes`: aprovado. Inclui exclusão autorizada, bloqueio de jogador e usuário externo, isolamento por campanha, remoção do arquivo, imagem indisponível após exclusão e exclusão repetida com 404.

`LD_LIBRARY_PATH=/tmp/vtt-browser-libs/usr/lib/x86_64-linux-gnu pnpm --filter @vtt/api test:browser`: aprovado, com proporção/grid no objeto e no fundo, Alt para deformação livre, exclusão pelo modal, Delete em imagem e token e Delete em um campo do modal sem excluir o objeto. Usa as bibliotecas temporárias descritas em `15-alcas-de-imagens.md`.
