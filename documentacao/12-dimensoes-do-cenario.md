# Dimensões do cenário em pixels e quadrados

## O que mudou

Os pop-ups de criação e edição agora permitem definir **largura**, **altura**, **colunas de quadrados**, **linhas de quadrados** e tamanho da célula. Largura e altura em pixels são persistidas no PostgreSQL. Cenários existentes continuam com 3200 × 2200 pixels.

A largura é independente da escala de distância do jogo: pixels definem a área visual; a distância por quadrado e sua unidade continuam definindo a medida da régua.

O componente `SceneDimensionsFields.vue` centraliza o comportamento:

- Editar colunas/linhas multiplica a quantidade pelo tamanho da célula. Exemplo: 40 × 30 quadrados de 64 pixels = 2560 × 1920 pixels.
- Editar pixels recalcula o número de colunas/linhas, arredondando para cima. Quando a dimensão não é múltipla da célula, a interface informa que a última célula pode ser parcial. Isso permite manter exatamente o tamanho de uma imagem.
- Alterar a célula preserva os pixels e recalcula as quantidades.
- Cada lado aceita inteiros de 128 a 16384 pixels; a célula permanece entre 32 e 128 pixels. As mesmas regras são validadas na API.

## Redimensionamento na camada Fundo

Ao dar dois cliques no fundo principal ou em um objeto da camada Fundo, o diálogo mostra também as dimensões e quantidades do cenário. O mestre pode editá-las ali e salvar junto com a transformação da imagem.

O botão **Ajustar cenário ao tamanho da imagem** copia a largura e a altura atuais da imagem para o cenário e posiciona essa imagem em X=0, Y=0. O valor copiado é o tamanho que está sendo editado no diálogo, não necessariamente a resolução original do arquivo. As dimensões propostas ainda precisam respeitar os limites do cenário.

Para imagens em Mestre/Geral, o diálogo informa o tamanho do cenário, mas os campos de alteração de cenário ficam disponíveis na camada Fundo. A edição continua restrita ao mestre.

## Persistência e proteção do conteúdo

`tabletop_scenes` ganhou colunas `width` e `height`. A resposta da API também inclui `columns` e `rows` derivados. Movimentação de tokens, criação/transformação de objetos, ajuste da câmera e renderização do grid passam a usar o tamanho daquele cenário, substituindo os limites fixos de 3200 × 2200.

Diminuir a área não apaga nem reposiciona conteúdo silenciosamente: se tokens, objetos ou um fundo transformado ficarem fora dos novos limites, o servidor recusa a alteração com orientação para reposicionar/redimensionar os itens. A atualização conjunta de imagem e cenário é atômica, inclusive para objetos de composição: se houver erro, nenhuma parte é salva.

Triggers verificam limites dos itens contra o cenário e validam o conteúdo ao término das alterações de dimensão. A proteção também cobre chamadas concorrentes. Os limites antigos nas coordenadas dos tokens foram substituídos por essa validação dinâmica. A inicialização padrão e a proteção de no mínimo um cenário por mesa foram mantidas.

O zoom mínimo foi ampliado para 2%, permitindo enquadrar cenários maiores. Alterar largura/altura ajusta o enquadramento da câmera. Rótulos usam escala de exibição independente para evitar gerar texturas enormes quando o cenário está muito afastado.

## Como verificar

1. Abra uma mesa → **Cenários** → **Novo cenário**.
2. Defina célula de 64 pixels, 40 colunas e 30 linhas. Confira 2560 × 1920 pixels, crie e reabra a edição para confirmar os valores salvos.
3. Altere a largura ou altura em pixels e confira a atualização das quantidades de quadrados. Salve e exiba o cenário.
4. Na camada **Fundo**, dê dois cliques em uma imagem. Altere largura/altura, use **Ajustar cenário ao tamanho da imagem** e salve. Confira o novo tamanho do tabuleiro e recarregue para verificar persistência.
5. Se houver outros itens fora da nova área proposta, a alteração deve ser recusada. Reposicione-os e tente novamente.

## Validação

- `pnpm build` e `pnpm --filter @vtt/web typecheck`.
- `pnpm --filter @vtt/web test`: transformações de câmera e limites de zoom atualizados.
- `pnpm --filter @vtt/api test:scenes`: criação com tamanho personalizado; colunas/linhas derivados; tamanhos inválidos; permissões; expansão para 5120 × 3072; token além do limite antigo; redução protegida; criação de objeto em cenário pequeno; alteração conjunta das dimensões de objeto/cenário; transformação do fundo com tamanho e célula; rollback ao reduzir com conteúdo fora da área.
- `pnpm --filter @vtt/api test:browser`: criação por quantidade de quadrados, conferência das dimensões no editor, ajuste conjunto da imagem e do cenário para 1600 × 1100, renderização e funcionamento dos objetos após o novo enquadramento, além da regressão das camadas e duas sessões.
- Testes de integração anteriores de autenticação, mesa, chat e tokens mantidos.
