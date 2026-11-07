# Contexto para continuar o VTT

O VTT Sonho Jovem é uma mesa virtual com uma única base de código para hospedagem centralizada e self-hosted. O repositório é Co0bY/VTT-Sonho-Jovem e o clone fica em ~/projetos/vtt-platform no Ubuntu.

## Estado atual

O monorepo pnpm reúne Vue 3 com Quasar e NestJS. O PostgreSQL roda via Docker Compose. A tela inicial e a rota /health foram validadas no navegador e consultam o banco. Consulte os guias anteriores para reproduzir o ambiente. A autoria local do Git foi configurada e o estado acumulado foi organizado em commits Conventional Commits; consulte `13-organizacao-dos-commits.md`.

## Próxima entrega

Construir a primeira mesa PixiJS com grid ajustável, câmera, zoom e tokens arrastáveis. Manter a lógica da mesa separada da interface. Persistência, sincronização multiplayer, paredes, linha de visão e iluminação dinâmica entram em etapas posteriores. As paredes devem poder bloquear movimento e visão de forma independente.

## Codex no Ubuntu e no VS Code

Abra o repositório no VS Code conectado ao WSL ou inicie o Codex CLI no diretório do projeto. O AGENTS.md orienta o Codex a ler este resumo e seguir o modo mentoria. O contexto do repositório pode acompanhar o código entre clientes.

O pacote npm sem escopo chamado codex é um pacote antigo. Use o instalador oficial do Codex CLI no Linux como usuário normal. Valide com codex --version e abra o CLI com codex.

[Documentação oficial do CLI](https://learn.chatgpt.com/docs/codex/cli)

## Atualização — login e dashboard (05/11/2026)

O usuário autorizou iniciar a implementação após fornecer `VTT_INSTRUCOES_CODEX.md`. Foram adicionados cadastro/login/logout, sessões em cookie, dashboard, criação de campanhas e convites compartilháveis com aceite autenticado. Os dados são persistidos no PostgreSQL. A mesa PixiJS continua pendente. Consulte `05-login-mesas-e-convites.md` para decisões, execução, validações e limitações.

## Atualização — primeiro acesso por e-mail

Cadastro agora solicita somente nome/e-mail e envia link de uso único válido por 48 horas para definir a primeira senha. Não há login automático no cadastro. MailHog adicionado ao Compose para capturar e-mails localmente (interface em http://127.0.0.1:8025). Consulte `06-primeiro-acesso-e-mailhog.md`; esse fluxo substitui o cadastro com senha descrito na entrega anterior.

## Atualização — recuperação de senha

Contas já ativadas podem solicitar um e-mail próprio por **Esqueci minha senha**. O link de redefinição vale por 1 hora, é de uso único e separado do primeiro acesso. Confirmar a nova senha encerra as sessões anteriores. Os e-mails compartilham layout com logo incorporada e estrutura MIME compatível com MailHog. Consulte `07-email-primeiro-acesso-visual.md` e `08-redefinicao-de-senha.md` para decisões e validações.

## Atualização — protótipo da mesa virtual

A dashboard agora abre `/mesas/:id` pelo botão **Entrar na mesa**. O protótipo PixiJS tem grid, câmera/zoom, seleção, tokens com controlador, régua, chat e dados calculados no servidor. Grid, tokens e mensagens persistem no PostgreSQL e são atualizados entre participantes por polling de dois segundos. Autorização por campanha e controle de tokens são validados na API. Consulte `09-prototipo-mesa-virtual.md` para arquitetura, execução, testes e recursos ainda pendentes.

## Atualização — cenários e storage

O menu **Cenários** permite criar e editar vários cenários por campanha, definir escala/unidade por quadrado, enviar imagem de fundo e escolher qual cenário exibir ao grupo. Tokens agora são separados por cenário; o cenário do protótipo foi preservado na migração. Imagens de até 10 MB ficam em `storage/<UUID do proprietário>/<UUID da mesa>/cenarios/`; categorias `tokens/` e `outros/` são preparadas no primeiro upload. O conteúdo de storage é ignorado pelo Git e lido por rotas autenticadas. Consulte `10-cenarios-e-storage.md` para decisões, testes e uso.

## Atualização — correção de cenários e camadas

A duplicação de Cenário principal foi corrigida com nomes únicos por campanha, inicialização/reutilização correta e limpeza conservadora das cópias vazias. Cada mesa tem no mínimo uma cena. Criar/editar cenários agora usa pop-ups. Camadas Fundo, Mestre e Geral separam mapa/composição, conteúdo privado e interação dos jogadores; a API filtra conteúdo privado. Imagens adicionais são persistidas por cenário e podem ser movidas e redimensionadas por duplo clique. Consulte `11-cenarios-popups-e-camadas.md`.

## Atualização — dimensões do cenário

Criação e edição permitem definir largura/altura em pixels ou colunas/linhas do grid. Na camada Fundo, o pop-up de redimensionamento também edita o cenário e oferece ajuste ao tamanho da imagem. Dimensões são persistidas por cenário (128 a 16384 pixels por lado); tokens, objetos, câmera e grid usam esses limites. Reduções que deixariam conteúdo fora da área são recusadas sem perda de dados. Consulte `12-dimensoes-do-cenario.md`.

## Organização inicial do histórico Git

O usuário solicitou versionar o estado acumulado em commits descritivos no padrão Conventional Commits. A organização por infraestrutura, API, interface, testes e documentação está registrada em `13-organizacao-dos-commits.md`. Os arquivos locais de análise, uploads e segredos permanecem ignorados.

## Atualização — alças de tamanho e rotação

Imagens de objetos e fundo do mapa passam a ter alças nos cantos para redimensionar e uma alça circular para girar. Duplo clique abre o pop-up de medidas, agora com rotação em graus. Transformações são persistidas e respeitam as permissões de mestre/camada. Consulte `15-alcas-de-imagens.md` para uso, decisões e validações.

## Atualização — proporção, grid e exclusão

O arraste dos cantos de objetos e fundo agora preserva proporção em passos do grid. Alt libera o tamanho em pixels; o modal mantém a opção de medidas independentes e ganhou exclusão de objeto. Delete no tabuleiro exclui o token ou objeto selecionado, respeitando mestre/camada ativa. Consulte `16-proporcao-grid-e-exclusao.md` para regras e validações; esta entrega substitui o arraste livre por padrão descrito na entrega anterior.

## Atualização — cor e opacidade do grid

A edição de cenários permite selecionar a cor das linhas do grid e ajustar sua opacidade de 0 a 100% por campo numérico ou barra sincronizada. As configurações são persistidas por cenário e usadas no desenho da mesa. Padrões anteriores preservados: `#a29aad` e 16%. Consulte `17-aparencia-do-grid.md` para decisões, uso e validações.

## Atualização — tipos de grid

A edição de cenários oferece Quadrado, Hexagonal e Nenhum. Nenhum bloqueia cor/opacidade sem apagar seus valores e desativa o encaixe; Hexagonal desenha hexágonos e encaixa tokens em seus centros na interface e na API. Cenários anteriores preservam sua visibilidade. Consulte `18-tipos-de-grid.md` para regras, compatibilidade e validações.

## Atualização — troca direta do formato do grid

A mudança de tipo de grid agora reconstrói explicitamente a renderização, preservando câmera e imagens carregadas, e limpa as relações de máscaras antes de destruir os gráficos anteriores. O teste de navegador cobre trocas diretas entre Quadrado e Hexagonal, com e sem imagem de fundo e após recarregar em Hexagonal. Consulte `19-troca-direta-do-grid.md` para investigação e validação.

## Atualização — pastas de cenários

O painel Cenários permite criar, renomear, recolher e excluir pastas por campanha. Cada cenário pode ser movido pelo cartão ou associado a uma pasta na criação/edição. Excluir uma pasta mantém seus cenários em Sem pasta. A organização é restrita ao mestre e persistida no PostgreSQL. Consulte `20-pastas-de-cenarios.md` para uso, decisões e validações.

## Tutorial de instalação com prefixo INFO

O guia completo de WSL, Ubuntu, Docker Desktop, Node/pnpm, configuração e retomada está em `INFO-instalacao-projeto.md` e `INFO-instalacao-projeto.pdf`, sem numeração sequencial. O link compartilhado fornecido pelo usuário não disponibilizou o texto da conversa; o guia registra essa limitação e foi consolidado a partir do checkout e de fontes oficiais. PDF gerado em oito páginas A4, com texto pesquisável e links. Versões locais, estado dos contêineres e endpoints de saúde foram conferidos; a instalação limpa de Windows/WSL não foi refeita.

## Versionamento das atualizações

As entregas acumuladas foram organizadas em commits Conventional Commits por API, interface, testes e documentação, com publicação autorizada para `origin/main`. Consulte `21-versionamento-e-publicacao.md` para a sequência, validações utilizadas e forma de conferir o envio.

## Fluxo atual — branches e Pull Requests

A partir de agora, novas entregas usam branches temáticas, commits Conventional Commits, publicação em `origin` e PRs inicialmente em rascunho para `main`. Não desenvolver novas entregas diretamente em `main`; merge somente por solicitação explícita do usuário. O modo mentoria permanece ativo. A próxima frente foi aberta em `feat/tokens-e-fichas-de-jogadores`; o escopo funcional de tokens/fichas ainda será detalhado. As instruções persistem em `AGENTS.md` e o fluxo está explicado em `22-fluxo-de-branches-e-prs.md`.

## Atualização — personagens, aparência e token

A branch `feat/tokens-e-fichas-de-jogadores` separa personagens da campanha de suas presenças em cenários. O painel Personagens usa Aparência; o mapa usa a imagem de Token. Criar um personagem abre pop-up com os dois seletores no topo e não adiciona presença automaticamente. Cartões podem ser arrastados ou adicionados pelo botão. Cenários vazios são permitidos; remover presença ou excluir cenário preserva o personagem. Tokens anteriores são migrados sem perder posições ou controle. Consulte `23-personagens-aparencia-e-token.md` para uso, modelo, permissões e testes.

## Atualização — tamanho e transparência de tokens

Tokens no mapa recebem quatro alças de redimensionamento, com proporção/grid por padrão e Alt para tamanho livre. Dimensões são persistidas por presença; movimento e limites consideram o tamanho ampliado. O redimensionamento é só por arraste, sem pop-up. Imagens transparentes não têm círculo de cor nem sombra atrás; a identificação por cor passa para o nome abaixo do token. Delete mantém a remoção da presença sem apagar personagem. Consulte `24-tamanho-e-transparencia-dos-tokens.md` para regras e validações.

## Atualização — rotação e marcador sem imagem

Tokens selecionados agora têm alça circular para girar, com ângulo salvo por presença. O nome permanece horizontal; seleção e redimensionamento acompanham o giro. Sem imagem de Token, o marcador usa a cor de identificação e uma inicial; com imagem, a transparência continua preservada. Consulte `25-rotacao-e-marcador-dos-tokens.md` para uso, persistência e validações.

## Atualização — tamanho mínimo ao mover e giro em passos

Ao colocar ou mover tokens menores que uma célula, a presença cresce proporcionalmente até o lado maior alcançar a célula; tokens maiores são preservados. Sem grid, não há esse ajuste. As alças de rotação agora usam passos de 15 graus, com Alt para giro livre, e a API aplica essa regra aos tokens. Consulte `26-tamanho-minimo-e-passos-de-rotacao.md` para exemplos e validações.
