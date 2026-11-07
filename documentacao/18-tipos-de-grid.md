# Grid quadrado, hexagonal ou nenhum — 06/11/2026

## Uso

Em **Cenários → Editar → Tipo de grid**, o mestre pode escolher:

- **Quadrado:** grade retangular existente.
- **Hexagonal:** hexágonos regulares com ponta voltada para cima.
- **Nenhum:** sem linhas e sem encaixe de tokens. Os campos de cor, código hexadecimal, porcentagem e barra de opacidade ficam desabilitados, mantendo os valores. O encaixe também fica bloqueado e sua preferência é preservada para quando um grid for reativado.

Ao voltar para Quadrado ou Hexagonal, os controles são habilitados novamente. Clique em **Salvar cenário** para aplicar. O tipo pertence ao cenário e é compartilhado com os participantes.

## Decisões

- `grid_type` aceita somente `square`, `hex` e `none`. Uma migração idempotente preserva cenários existentes: grid visível vira Quadrado e grid oculto vira Nenhum. Novos cenários começam em Quadrado.
- `grid_visible` continua presente para compatibilidade com os fluxos anteriores. Nas respostas acompanha o tipo; requisições antigas que alteram visibilidade continuam funcionando. A interface usa o novo seletor no lugar de Mostrar grid.
- Cor e opacidade mantêm os dados salvos. Como controles de cor e barra não suportam `readonly` nativo, o grupo usa `fieldset disabled`, que bloqueia edição por mouse e teclado. Nenhuma alteração é feita nesses valores ao trocar o tipo.
- O tamanho da célula indica a largura entre lados paralelos do hexágono; a distância vertical entre centros de linhas consecutivas é `largura × √3 / 2`. Frontend e API usam o mesmo cálculo de centros, inclusive para movimentos por teclado e limites da mesa. Desativar encaixe em um grid mantém movimento livre.
- O desenho hexagonal evita repetir arestas compartilhadas, respeita cor/opacidade, é recortado aos limites do cenário e considera a região visível da câmera. A geometria fica separada da renderização PixiJS.
- Sem grid, as alças de imagem continuam proporcionais, em passos de um pixel. Alt continua liberando a proporção. A régua mantém a escala por tamanho da célula e a medida euclidiana; não foi introduzida contagem de passos hexagonais.
- Dimensões em colunas/linhas do editor continuam convertendo unidades retangulares de tamanho da célula para pixels. Elas não representam contagem exata de hexágonos nas bordas.

## Validação

- `pnpm --filter @vtt/web test`: doze testes aprovados, incluindo centros hexagonais, estabilidade após arredondamento, limites, movimento sem grid e arestas regulares sem duplicação.
- `pnpm --filter @vtt/api test:scenes`: aprovado. Verifica os três tipos, rejeição de valores inválidos, permissão do mestre, persistência, compatibilidade de visibilidade e encaixe hexagonal/movimento livre no servidor.
- Checagem de tipos e builds do frontend e da API: aprovados.
- Teste de navegador aprovado: salvar Nenhum, verificar bloqueio dos quatro controles, reabrir o cenário, reativar Hexagonal, verificar os valores preservados e confirmar o tipo recebido pelo jogador. Captura local em `analise-arquivo/grid-hexagonal.png`.
