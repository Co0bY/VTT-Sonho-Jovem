# Rotação e marcador dos tokens — 06/11/2026

## Uso

Como mestre, selecione o token na camada ativa e arraste a **alça circular** acima dele para girar. Os quatro cantos continuam redimensionando, com proporção/grid por padrão e Alt para tamanho livre. Delete remove somente a presença no mapa; Escape cancela a prévia em andamento.

O ângulo pertence à presença no cenário. Girar uma cópia não altera outras cópias nem o cadastro do personagem. O nome fica horizontal e abaixo da área visual girada para continuar legível. As alças e a área de seleção acompanham a rotação.

Quando o personagem não possui imagem de Token, o marcador usa sua cor de identificação como fundo e uma inicial branca. O nome continua usando a mesma cor. Quando existe uma imagem, ela é desenhada diretamente: áreas transparentes continuam mostrando o mapa, sem esse fundo colorido. Durante uma falha/carregamento de imagem cadastrada, o marcador temporário permanece neutro.

## Implementação

A migração adiciona `tabletop_tokens.rotation`, com padrão zero e restrição de 0 até menos de 360 graus. `POST /campaigns/:id/tabletop/tokens/:tokenId/rotate` exige mestre e limita a atualização ao cenário ativo e à campanha da rota. A API aceita apenas números finitos e normaliza ângulos negativos ou maiores que uma volta.

A rotação tem endpoint próprio para preservar centro e dimensões, inclusive quando o token ainda usa o tamanho automático da imagem. O redimensionamento mantém o ângulo atual quando ele não é enviado e salva o ângulo da geometria quando as alças são usadas. O helper de normalização também é reutilizado pelos objetos e fundo.

No PixiJS, o conteúdo do token fica em um container visual girado e o nome permanece em um container sem rotação. A geometria reaproveita os cálculos de seleção e redimensionamento de imagens giradas, mantendo o canto oposto fixo. A posição vertical do nome considera a altura projetada da imagem.

Os limites de cenário continuam baseados em centro e dimensões sem rotação, como na implementação anterior dos objetos: girar não amplia automaticamente o cenário nem introduz colisão. As permissões de movimento e exclusão existentes foram preservadas.

## Validações

- Checagem de tipos do frontend: aprovada.
- `pnpm --filter @vtt/web test`: 15 testes aprovados, incluindo seleção e redimensionamento de token com rotação.
- `pnpm --filter @vtt/api test:characters`: aprovado. Novos casos cobrem permissão, campanha, ângulos inválidos, normalização, isolamento entre cópias, preservação de posição/tamanho automático e conservação do ângulo ao redimensionar.
- `pnpm --filter @vtt/api test:scenes` e build do workspace: aprovados.
- Teste completo de navegador aprovado: girar pela alça, verificar persistência ao recarregar e voltar à orientação inicial. A captura local `analise-arquivo/token-rotacionado.png` registra o estado girado.
- A verificação de pixels do marcador sem imagem usa uma cor distinta do mapa, para confirmar o fundo de identificação. A verificação anterior de PNG transparente continua presente.

Esta entrega complementa o guia 24: tokens agora têm alça de rotação e o marcador sem imagem voltou a usar a cor do personagem. Imagens com transparência mantêm o comportamento daquele guia.
