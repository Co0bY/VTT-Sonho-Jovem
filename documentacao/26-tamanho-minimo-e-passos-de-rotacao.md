# Tamanho ao colocar/mover e passos de rotação — 06/11/2026

## Regras de uso

Ao adicionar um personagem ao mapa, arrastá-lo do painel ou mover uma presença existente, um token menor que a célula cresce proporcionalmente até seu **lado maior** alcançar o tamanho da célula. Um token que já tem lado maior igual ou superior à célula conserva as dimensões. Assim, uma imagem vertical de 20 × 40 passa para 32 × 64 em grid de 64 pixels; uma imagem de 100 × 50 permanece igual.

A regra é aplicada à presença no cenário, sem modificar o arquivo nem o cadastro do personagem. O mestre ainda pode reduzir uma presença pelas alças; ao arrastá-la novamente, o mínimo será reaplicado. Selecionar ou girar um token não o amplia por si só. O ajuste também ocorre no movimento por teclado e nos grids hexagonais, usando o tamanho da célula configurada. Em **Nenhum**, sem grid, não há ajuste automático.

As alças de rotação passam a girar em passos de **15 graus**. Segurar **Alt** libera o ângulo durante o gesto; soltar Alt volta ao encaixe de 15 graus, inclusive sem mover novamente o ponteiro. A mesma alça continua disponível em tokens, objetos e fundo do mapa. A edição numérica de imagens no pop-up mantém o fluxo próprio existente.

## Implementação

A API calcula e salva largura/altura ao colocar um personagem. Quando necessário, lê as dimensões da imagem de Token para preservar sua proporção. No movimento, usa as dimensões explícitas da presença ou as da imagem para tokens anteriores que ainda tenham tamanho automático. O ajuste é feito apenas para ampliar: não reduz presenças maiores.

O canvas aplica a mesma escala durante a prévia do arraste. O movimento real também envia a alteração quando o token termina no mesmo centro do grid, permitindo ampliar uma presença pequena mesmo que o encaixe não mude a posição final. Cliques de seleção sem arraste não criam uma atualização. A API valida novamente o tamanho e a posição; os limites consideram as dimensões resultantes.

A rotação no canvas usa uma função de encaixe em múltiplos de 15 graus. O estado de Alt acompanha a manipulação e é enviado como opção booleana `free` ao endpoint de rotação do token. A API também aplica os passos quando `free` não é verdadeiro, normaliza o ângulo e rejeita tipos inválidos para essa opção. Redimensionar não altera o ângulo de uma rotação livre já salva.

Não houve nova migração de schema: as regras usam as colunas de tamanho e rotação existentes. Valores anteriores são ajustados somente nas operações descritas, sem uma atualização em massa dos tokens cadastrados.

## Validação

- Testes de geometria: 17 aprovados. Incluem ampliação proporcional, preservação de tokens maiores, ausência de ampliação sem grid e rotação de 15 graus/livre com normalização de voltas.
- `pnpm --filter @vtt/api test:characters`: aprovado. Novos casos verificam colocação de imagem vertical, movimento de presença pequena e de token antigo, preservação de dimensões maiores, comportamento sem grid, rotação quantizada e opção de rotação livre.
- `pnpm --filter @vtt/api test:scenes`, checagem de tipos e build do workspace: aprovados.
- Teste completo de navegador aprovado: conferir colocação com uma célula, ampliação ao arrastar dentro da mesma célula, giro que aponta para 23° mas encaixa em 30°, giro livre em 23° com Alt e preservação após recarregar.
