# Tamanho e transparência dos tokens — 06/11/2026

## Como usar

Como mestre, selecione um token na camada ativa. Quatro alças aparecem nos cantos:

- Arraste um canto para redimensionar proporcionalmente, em passos do grid.
- Segure **Alt** durante o arraste para alterar largura e altura livremente.
- **Delete/Del** continua removendo a presença selecionada do cenário, preservando o cadastro do personagem.
- **Escape** cancela a prévia em andamento. O tamanho só é salvo ao soltar o ponteiro.

O redimensionamento do token é feito pelas alças, sem campos numéricos ou pop-up. Duplo clique sobre um token não abre o editor da imagem de fundo que possa estar atrás dele. Não foi adicionada alça de rotação aos tokens.

Imagens com transparência, como PNGs com canal alfa, agora são desenhadas diretamente sobre o mapa. Foram removidos o círculo colorido e a sombra que ficavam atrás da imagem. A cor de identificação aparece no nome abaixo do token, com contorno para leitura. Quando não existe imagem ou ela ainda não carregou, as iniciais ficam sobre um marcador neutro.

## Modelo e regras

Largura e altura são propriedades da presença em `tabletop_tokens`, e não do personagem. Cada cópia pode ter um tamanho diferente. Presenças anteriores e novas começam sem dimensões explícitas; nesse caso, a imagem mantém sua proporção e cabe em 80% da célula, como antes. O primeiro redimensionamento grava as duas dimensões.

As coordenadas do token continuam representando seu centro. Para reutilizar a geometria das alças, a interface calcula o retângulo a partir do centro, largura e altura. A imagem usa exatamente as dimensões salvas, permitindo deformação intencional com Alt. A seleção, o nome e as alças acompanham o retângulo atual; as alças têm tamanho visual independente do zoom. A área de clique também acompanha o token ampliado.

A proporção é mantida pelo mesmo cálculo usado em objetos: o canto oposto fica fixo e o lado maior é ajustado para múltiplos da célula. Em Nenhum, o passo é de um pixel. O tamanho mínimo é de 8 pixels por lado. O tamanho inicial de uma imagem ainda não redimensionada considera suas dimensões reais, inclusive imagens verticais/horizontais.

`POST /campaigns/:id/tabletop/tokens/:tokenId/resize` exige mestre, cenário ativo e campanha correspondente. Recebe o retângulo da prévia e salva centro e dimensões. O movimento mantém as permissões existentes: jogadores movem os tokens atribuídos a eles na camada Geral, mas o mestre redimensiona e remove presenças.

A migração idempotente adiciona dimensões opcionais, com validação de que ambas estejam presentes ou ambas ausentes. Triggers verificam os limites da imagem redimensionada ao mover o token e ao reduzir o cenário. A interface e a API limitam o centro de acordo com o tamanho completo do token, evitando que uma imagem ampliada seja arrastada para fora. Nos limites, a contenção tem prioridade sobre o encaixe, como já ocorria com os limites dos tokens menores.

## Validação

- `pnpm --filter @vtt/web test`: 14 testes aprovados, incluindo dimensões iniciais proporcionais, tamanho explícito e limites de movimento de tokens ampliados em grids quadrado, hexagonal e nenhum.
- `pnpm --filter @vtt/api test:characters`: aprovado. Novos casos verificam redimensionamento proporcional/livre, recusa de valores inválidos, isolamento por campanha e presença, permissão, persistência e limites no banco.
- Checagem de tipos e builds do workspace: aprovados.
- `pnpm --filter @vtt/api test:scenes`: aprovado, incluindo as regras de redução de cenário existentes.
- Teste completo de navegador aprovado: arrastar alças, usar Alt, recarregar e confirmar o tamanho, retornar ao tamanho inicial e verificar o duplo clique sem pop-up. A transparência é comparada com um pixel do mapa antes da colocação, usando um PNG RGBA de teste. A cor do nome é verificada nos pixels da captura.

As novas verificações de pixels evitam aceitar apenas a configuração salva quando o problema é visual. O gerador de PNG é um fixture sintético local, sem novos pacotes no projeto. O fluxo completo de navegador continua cobrindo Delete, preservação de personagens, duas sessões e o editor de cenários.
