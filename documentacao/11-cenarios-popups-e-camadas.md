# Cenários sem duplicação, pop-ups e camadas

## Correção das duplicações

As imagens `editar-cenario-virar-pop-up.png` e `bug-cenario-se-repetindo.png` foram analisadas. O banco tinha 22 registros chamados **Cenário principal** para a mesma campanha. Na transição do cenário único para vários cenários, a ausência de unicidade por nome permitia que a inserção automática antiga com `ON CONFLICT DO NOTHING` criasse novas cópias. A recuperação do cenário ativo também precisava reutilizar um registro existente antes de criar outro.

A correção inclui:

- Índice único de nome por campanha, ignorando espaços nas pontas e diferenças entre maiúsculas/minúsculas. Criação e edição retornam HTTP 409 para nomes repetidos, inclusive em chamadas concorrentes.
- Recuperação da cena ativa reutiliza a primeira cena existente. Uma nova campanha recebe exatamente um cenário inicial e uma referência ativa na mesma transação do banco, por trigger.
- Proteção no banco e na API para manter pelo menos um cenário por mesa. O botão de exclusão fica desabilitado quando só resta um. Excluir a campanha por cascade continua permitido.
- Exclusão de cenário pede confirmação na interface; caso o cenário excluído esteja ativo, outro é selecionado antes da remoção. Tokens/objetos desse cenário são removidos por cascade e suas imagens são limpas do storage.
- A migração remove apenas duplicatas vazias equivalentes, preservando o cenário ativo. Cópias com tokens, imagem ou configuração diferente são preservadas e recebem um sufixo para evitar perda de conteúdo.

Após a migração, a consulta de contagem confirmou **um** registro de Cenário principal na campanha local, em lugar dos 22 anteriores. A consulta não recria cenários.

## Criação e edição em pop-ups

A lista lateral agora contém cartões com **Editar**, **Exibir na mesa** e **Excluir**, além de **Novo cenário**. A criação abre um diálogo; após criar, abre a edição da nova cena. A edição de nome, escala, unidade, grid e imagem principal fica em outro diálogo, sem ocupar toda a barra lateral. Os erros da API aparecem no diálogo. Jogadores não recebem controles de edição.

## Três camadas

- **Fundo**: imagem principal do cenário, imagens adicionais de composição e tokens que o mestre mover para essa camada. Fica abaixo do grid.
- **Geral**: tokens e objetos visíveis ao grupo. Jogadores podem mover somente seus tokens dessa camada.
- **Mestre**: tokens, imagens e objetos privados. Somente o mestre recebe esses dados da API e consegue ler suas imagens. Não dependemos de esconder conteúdo com CSS. Para o mestre, itens dessa camada ficam semitransparentes quando ele edita outra camada.

O seletor **Camada de edição**, acima do tabuleiro, determina o que o mestre seleciona/move e em qual camada cria tokens e imagens. O painel **Camadas** permite enviar imagens adicionais, dar nome aos objetos e abrir seu redimensionamento. A lista de tokens oferece mudança de camada. Jogadores operam sempre na Geral e não podem modificar as camadas por chamadas diretas à API.

Objetos persistem em `tabletop_objects`, vinculados ao cenário e à campanha. Tokens anteriores recebem camada Geral. Imagens adicionais continuam em `storage/<proprietário>/<mesa>/cenarios/`, com o mesmo limite de 10 MB e as validações de PNG/JPEG/WebP. Cada imagem tem rota autenticada própria; uma requisição de jogador para uma imagem da camada Mestre retorna 404, sem expor seus metadados.

## Mover e redimensionar imagens

Na camada Fundo, com a ferramenta de seleção ativa, arrastar a imagem principal muda sua posição. Dar **dois cliques** abre o diálogo **Redimensionar imagem**, com X, Y, largura e altura em pixels. A opção **Manter proporção** fica ativa inicialmente. Imagens de composição têm o mesmo comportamento na camada em que estão; também podem trocar de camada no diálogo. O painel Camadas oferece o botão **Redimensionar** como alternativa ao duplo clique.

As dimensões e posições são persistidas no servidor, com tamanho mínimo de 8 pixels e limites do tabuleiro de 3200 × 2200 pixels. A imagem principal usa sua proporção original até receber a primeira transformação explícita. Substituir essa imagem reinicia a transformação. Para navegar sem mover o fundo, use a ferramenta de câmera ou arraste com o botão do meio/direito.

As mudanças chegam aos demais participantes pelo polling existente. Fundo/Geral são compartilhados; Mestre é filtrada no servidor. Um jogador que já tenha visto uma imagem na Geral não perde o conhecimento anterior se o mestre depois a mover para a camada privada.

## Como verificar

1. Entre em uma mesa e abra **Cenários**. Confirme que a cena não se repete ao esperar ou recarregar.
2. Tente criar outra com o mesmo nome: deve aparecer erro sem criar uma cópia. Com uma única cena, a exclusão deve ficar indisponível.
3. Clique em **Novo cenário** e **Editar** para verificar os pop-ups.
4. Envie uma imagem principal, salve e use **Exibir na mesa**.
5. Selecione **Fundo**, dê dois cliques na imagem, altere a largura e salve. Recarregue para confirmar persistência.
6. No painel **Camadas**, adicione outra imagem à Fundo. Arraste-a e dê dois cliques para redimensionar. O fundo principal continua separado.
7. Selecione **Mestre** e crie um token ou uma imagem privada. Abra uma segunda sessão com um jogador: ele não deve ver esses itens. Mover um token para Geral o torna disponível ao jogador responsável por ele.

## Validações

- Compilação do workspace e TypeScript dos componentes Vue.
- Testes de cenários: mínimo de uma cena pela API e por exclusão SQL direta, nomes únicos, leituras sem novas cenas, exclusão e troca de ativo, transformações válidas/inválidas, autorização de objetos, sigilo dos tokens/objetos e leitura privada das imagens, além dos uploads e limites anteriores.
- Testes de integração de autenticação, convites, chat, dados e tokens.
- Chromium com duas sessões: criação/edição por pop-ups, duplo clique na imagem principal e em objeto adicional, dimensões salvas, composição em Fundo e imagem secreta ausente dos dados do jogador. Mantidas as verificações de navegação, teclado, arraste e layout mobile.
- Captura da verificação em `analise-arquivo/prototipo-camadas-desktop.png`, ignorada pelo Git.

Comandos no Ubuntu/WSL: `pnpm build`, `pnpm --filter @vtt/web typecheck`, `pnpm --filter @vtt/api test:scenes`, `pnpm --filter @vtt/api test:integration` e `pnpm --filter @vtt/api test:browser`. O teste do navegador usa as bibliotecas temporárias documentadas na entrega anterior quando necessário.
