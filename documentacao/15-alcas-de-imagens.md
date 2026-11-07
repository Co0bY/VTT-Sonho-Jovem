# Alças de tamanho e rotação — 06/11/2026

## Uso

Como mestre, escolha a ferramenta de seleção e a camada da imagem. Clique no objeto para exibir quatro alças quadradas nos cantos e uma alça circular acima dele. Arraste os cantos para mudar largura/altura; arraste a alça circular para girar ao redor do centro. Para editar o mapa principal, selecione a camada Fundo e clique na imagem do mapa. Duplo clique abre o pop-up com posição, tamanho e rotação em graus.

A transformação tem prévia durante o arraste e é persistida ao soltar. Escape e cancelamento do ponteiro descartam a prévia. O pop-up mantém a opção de proporção; o arraste dos cantos altera as duas dimensões livremente.

## Decisões

- A geometria fica em `apps/web/src/tabletop/geometry.ts`: conversão de pontos, seleção de retângulos girados e redimensionamento com o canto oposto fixo. Isso mantém o cálculo independente do PixiJS e permite testes diretos.
- Rotação em graus, ao redor do centro, padrão zero para imagens existentes. Objetos recebem coluna `rotation` com migração idempotente; o fundo usa o JSON de transformação existente. A API valida ângulos finitos e normaliza para o intervalo de 0 a menos de 360 graus.
- As permissões existentes continuam validadas pela API. Alças só aparecem para o mestre na camada ativa. O tamanho visual das alças acompanha o zoom para manter a interação utilizável.
- A atualização periódica só recentraliza a câmera quando largura ou altura realmente mudam; substituir os dados do cenário sem mudar dimensões não interrompe o gesto.
- A centralização reserva margem de 70 pixels por lado para reduzir sobreposição com os controles da mesa.
- Os limites existentes continuam sendo calculados sobre posição e dimensões antes da rotação. Imagens giradas podem ter cantos visuais além desses limites; girar não aumenta automaticamente o cenário. Redimensionamento respeita o mínimo de 8 pixels por lado.

## Validação

- `pnpm --filter @vtt/web test`: seis testes aprovados, incluindo seleção girada e preservação do canto oposto nas quatro alças em vários ângulos.
- `pnpm --filter @vtt/web typecheck`: aprovado.
- Builds de frontend e API: aprovados.
- `pnpm --filter @vtt/api test:scenes`: aprovado, com persistência de rotação, normalização de ângulo negativo e rejeição de ângulos inválidos para objeto e fundo.
- Teste de navegador aprovado: arraste real dos cantos e das alças de rotação do objeto e do fundo, persistência após recarregar e reabertura do pop-up com ângulo salvo. Também passou o fluxo existente de duas sessões, permissões, camada privada e layout mobile. O teste aguarda o fechamento do diálogo e o término do salvamento antes do próximo gesto.

O Chromium do Playwright inicialmente não abriu pela ausência de `libnspr4`, `libnss3` e `libasound2t64` no WSL. Para a validação, os pacotes foram baixados e extraídos em `/tmp/vtt-browser-libs`, sem instalação global. Comando usado: `LD_LIBRARY_PATH=/tmp/vtt-browser-libs/usr/lib/x86_64-linux-gnu pnpm --filter @vtt/api test:browser`.
