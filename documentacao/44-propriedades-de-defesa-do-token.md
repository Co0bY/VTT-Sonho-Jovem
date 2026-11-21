# Defesa e Observação do token

Na mesa, clique com o botão direito em um token da camada ativa para abrir **Propriedades do token**. Pelo teclado, selecione o token, mantenha o foco no mapa e use **Shift + F10**. Arrastar com o botão direito movimenta a câmera.

- **Defesa** pode guardar a Classe de Armadura (CA).
- **Observação** pode guardar a Percepção passiva.

Os campos são opcionais e aceitam números inteiros, incluindo zero. Deixe um campo em branco e salve para limpar seu valor. Cada presença tem seus próprios valores no cenário. O mestre pode editar os tokens das camadas em que trabalha. Jogadores podem editar apenas os tokens que controlam na camada Geral.

O backend valida os valores e a permissão de edição no cenário ativo. O PostgreSQL guarda os dois valores em colunas que aceitam nulo, portanto tokens existentes aparecem inicialmente com os campos vazios. A consulta da mesa fornece os valores somente a quem pode editar as propriedades.

## Validação

Build, tipagem e integração da API passaram. A integração conferiu permissões, visibilidade, rejeição de frações, gravação de zero e limpeza de um dos campos.
Os 28 testes unitários e a suíte da mesa no Chromium passaram. A suíte abriu o painel por clique direito, salvou os números e confirmou que eles reapareceram ao reabrir. Também verificou que cancelar descarta alterações e que o arraste com o botão direito não abre o painel.

## Barras, auras, condições, imagem e visão

O painel separa os ajustes em abas. **Propriedades** inclui três barras de valor e máximo. Cada barra preenchida aparece acima do token. Em **Auras**, configure até duas áreas com raio na unidade do cenário, forma circular ou quadrada, cor e opacidade. **Condições** oferece pesquisa, seleção múltipla, marcadores coloridos e a opção de limpar todos. **Imagem** mostra a prévia e permite ajustar a opacidade e o espelhamento da presença atual.

Na aba **Visão e luz**, configure o alcance sob luz intensa, fraca e na escuridão. O token também pode emitir luz intensa e fraca. Os ângulos de visão e luz acompanham a rotação do token e as distâncias usam a escala do cenário. A névoa aparece para o jogador quando ele controla um token com **Possui visão** na camada Geral. Ela acompanha as áreas visíveis no momento. Paredes e memória de exploração ficam para uma etapa futura.

O menu do navegador podia receber o evento após o painel já ter aberto. O mapa agora cancela o evento também nessa transição e descarta o registro do gesto ao iniciar outro clique. O arraste com o botão direito permanece como controle de câmera.

O PostgreSQL guarda as opções por presença. O servidor valida as novas propriedades e mantém a compatibilidade com clientes que enviam só Defesa e Observação. A consulta da mesa fornece as propriedades visuais necessárias para renderizar o mapa.

Para verificar, abra as propriedades por clique direito, configure uma barra e uma aura, marque uma condição e ajuste a luz. Salve e reabra o painel. Em outra sessão, use um token próprio com visão habilitada para conferir a área descoberta e a parte coberta pela névoa.

Na versão ampliada, passaram build, tipagem, 30 testes unitários, integração da API e a suíte da mesa no Chromium. A suíte conferiu o cancelamento do evento redirecionado para o diálogo, salvou as opções das cinco abas e verificou a névoa em uma segunda sessão.
