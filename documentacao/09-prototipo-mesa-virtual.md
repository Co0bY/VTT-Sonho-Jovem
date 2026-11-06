# Protótipo inicial da mesa virtual

## Pedido e referências

O usuário autorizou criar o acesso **Entrar na mesa** na dashboard e um protótipo de mesa com grid, chat e ferramentas de jogo. As referências `analise-arquivo/layout-dashboard.png` e `analise-arquivo/layout-mesa-grid.png` foram abertas e analisadas. Usamos a organização da referência: ferramentas à esquerda, cenário central e painel lateral à direita, mantendo a identidade visual existente do Sonho Jovem. Os arquivos de referência continuam ignorados pelo Git.

## O que funciona

- **Entrar na mesa** em todos os cartões, para mestres e jogadores. Abre `/mesas/:id`, com link de volta à dashboard.
- A API exige sessão e participação na campanha; conhecer o endereço não libera acesso. Uma sessão expirada oferece retorno ao login, com destino de volta à mesa após autenticação.
- Cenário PixiJS 8, separado da interface Vue: grid quadrado, câmera com pan, zoom ancorado no cursor (20% a 250%), ajuste do cenário à tela, seleção e arraste de tokens. Movimento por teclado: selecione o token e use as setas. No celular, arraste com um dedo e use os botões de zoom; o painel lateral pode ser recolhido.
- Mestres criam tokens com nome, cor e controlador escolhido entre os participantes. Podem mover e remover todos os tokens. Jogadores movem somente os tokens atribuídos a eles. A API verifica essas permissões, mesmo se o navegador for manipulado.
- Grid de 32 a 128 pixels, com visibilidade e encaixe configuráveis pelo mestre. O encaixe considera o centro da célula e mantém tokens dentro dos limites de um cenário de 3200 × 2200 pixels. Alterar o tamanho do grid não reposiciona automaticamente tokens existentes: o novo encaixe é aplicado na próxima movimentação.
- Régua de distância euclidiana: uma célula equivale a 1,5 metro. Câmera, régua e seleção são individuais.
- Chat persistido, com os 100 registros mais recentes por campanha. Enter envia; Shift + Enter quebra linha. Textos são renderizados como texto, sem HTML.
- Comandos `/roll XdY`, `/r XdY` e modificadores como `/roll 2d6+3`, além de botões d4/d6/d8/d10/d12/d20. Limites de 1 a 50 dados e 2 a 1000 faces. O servidor calcula cada resultado com `crypto.randomInt`; resultados enviados pelo navegador são desconsiderados.
- Painéis de chat, tokens, participantes e configuração do cenário. A lista de participantes indica vínculo com a campanha, não presença online.
- PostgreSQL persiste grid, tokens e mensagens. Atualização compartilhada por consulta a cada dois segundos. Erros de conexão são mostrados; o estado não é descartado em uma falha transitória. Não há promessa de sincronização instantânea nesta versão.

## Arquitetura e decisões

`TabletopPage.vue` integra API e interface. `TabletopBoard.vue` cuida da renderização e entrada de ponteiro/teclado. `tabletop/geometry.ts` contém transformações de câmera, encaixe e distância independentes de Vue/PixiJS. `tabletop/types.ts` reúne os contratos do frontend.

A API aplica autorização em cada leitura/mutação e mantém a posição oficial. Regras de posição, limites e dados estão em `tabletop-rules.ts`. O schema inicial é aditivo: `tabletop_scenes`, `tabletop_tokens`, `tabletop_messages` e índices em `database.ts`. Apagar uma campanha remove seus registros de mesa por cascade; não há comando de exclusão de campanha nesta interface.

A rota da mesa carrega o PixiJS sob demanda, evitando incluí-lo na entrada de login/dashboard. Aplicação Pixi, observador de tamanho, temporizadores e requisições são encerrados ao sair da página. Ao redimensionar, a câmera preserva o ponto central do cenário.

Escolhemos polling para validar primeiro o ciclo completo com persistência e permissões. Socket.IO, eventos incrementais, controle de concorrência de movimentação e histórico paginado serão evoluções posteriores. Movimentos concorrentes autorizados usam a última atualização aceita pelo servidor.

Referência técnica consultada: [Application do PixiJS 8](https://pixijs.com/8.x/guides/components/application).

## Como usar

No Ubuntu/WSL, com o banco e a API configurados:

```bash
nvm use
pnpm install --frozen-lockfile
docker compose up -d
pnpm dev
```

1. Entre em http://127.0.0.1:9000 e clique em **Entrar na mesa** no cartão de uma campanha.
2. Como mestre, use **Adicionar token**, informe nome/cor e selecione o controlador.
3. Arraste o token no grid. Arraste o fundo para navegar ou use a ferramenta de câmera. Roda do mouse aproxima/afasta; o botão de ajuste centraliza o cenário.
4. No chat, envie uma mensagem e experimente `/roll 2d6+3`.
5. Abra a mesma mesa em uma janela anônima com um jogador convidado: ele verá as alterações em até aproximadamente dois segundos e moverá somente seus próprios tokens.
6. Recarregue para conferir persistência; teste grid e encaixe no painel **Cenário**. Use a régua arrastando entre dois pontos.

## Validações

- `pnpm build`: compilação do backend e frontend.
- `pnpm --filter @vtt/web typecheck`: validação TypeScript dos arquivos Vue e do renderer PixiJS.
- `pnpm --filter @vtt/web test`: geometria, zoom mantendo o ponto sob o cursor, limites/encaixe e distância.
- `pnpm --filter @vtt/api test:integration`: regressão de autenticação/e-mail/recuperação e fluxo real no PostgreSQL. Inclui acesso sem sessão, tentativa por não participante, permissões do grid e dos tokens, isolamento entre campanhas, posições inválidas, persistência, chat e resultados de dados calculados pelo servidor.
- `pnpm --filter @vtt/api test:browser`: Chromium com duas sessões e processos isolados (API 3104, frontend 9014). Testa navegação dashboard → mesa, renderização, criação de token, movimento por teclado e arraste real, chat e dados compartilhados, bloqueio de configuração para jogador, atualização de grid pelo mestre, recarga e viewport de celular sem overflow horizontal. Os fixtures temporários são removidos ao terminar.
- Capturas de validação em `analise-arquivo/prototipo-mesa-desktop.png` e `analise-arquivo/prototipo-mesa-mobile.png`, ignoradas pelo Git.

O Chromium foi baixado com Playwright. Como faltavam bibliotecas no Ubuntu, libnspr4, libnss3 e libasound2t64 foram baixadas e extraídas em `/tmp/vtt-browser-libs`, sem instalação administrativa. Nesta sessão o teste de navegador foi executado com `LD_LIBRARY_PATH=/tmp/vtt-browser-libs/extracted/usr/lib/x86_64-linux-gnu`. Para reproduzir em outro ambiente, o Chromium e suas bibliotecas precisam estar disponíveis (`pnpm --filter @vtt/web exec playwright install chromium`).

## Limites e próximas etapas

O cenário inicial é um tabuleiro neutro. Importação de mapas e imagens para tokens, editor de paredes, portas, visão, iluminação, fog of war, fichas, camadas e áudio/vídeo ainda não fazem parte deste protótipo. A geometria continua separada da renderização para evoluir esses módulos conforme o contexto do projeto. Não foram criados botões aparentando executar esses recursos futuros.
