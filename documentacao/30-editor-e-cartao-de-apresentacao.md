# Editor formatado e cartão de apresentação

## Comportamento

Descrição e anotações recebem um editor com negrito, itálico, sublinhado, tachado, listas com marcadores/numeradas, remoção de formatação e desfazer/refazer. O editor reutiliza QEditor do Quasar, com rótulos em português e atalhos de teclado. Ficha e Configurações da ficha continuam vazias.

O mestre mantém criação, controlador e seleção de camadas. O jogador pode editar os personagens que controla, sem alterar o controlador; criação, alteração de camadas e apresentação coletiva continuam exclusivas do mestre. A API verifica essas regras independentemente da interface e revalida o controlador com bloqueio da linha ao salvar.

Cada personagem no painel recebe um pequeno botão com ícone de cartão e tooltip **ver cartão de apresentação**. O pop-up mostra nome, imagens de Aparência/Token, cor e descrição formatada, sem inputs, controlador, anotações ou conteúdo da ficha. O mestre possui o botão **Exibir aos jogadores** no canto inferior direito.

## Apresentação para quem está online

A atualização existente de dois segundos também consulta um endpoint de apresentações e registra a presença do usuário. Sessões com atualização nos últimos dez segundos são consideradas online. O comando do mestre registra um evento com destinatários e um retrato do cartão naquele instante. Apenas jogadores que participam da campanha e estão online recebem o evento; outras mesas e usuários externos não recebem o conteúdo. O pop-up abre em até aproximadamente dois segundos em uma conexão saudável, e cada jogador pode fechá-lo. Apresentações consecutivas ficam em fila para não sobrescrever o cartão em leitura.

A primeira consulta apenas registra presença e obtém o cursor atual: entrar ou recarregar a mesa não reproduz apresentações anteriores. Consultas seguintes recebem os eventos novos e recentes destinados ao usuário. O cursor e a lista usam o mesmo snapshot SQL para evitar perda de eventos concorrentes. O mestre não recebe a apresentação que enviou nas outras sessões da própria conta.

Apresentar um personagem oculto permite aos destinatários carregar suas duas imagens durante uma hora, sem liberar sua ficha, anotações nem acesso à lista de personagens do mestre. Eventos anteriores a uma hora são limpos ao enviar outra apresentação naquela campanha. Imagens substituídas depois da apresentação seguem o ciclo normal de remoção; um novo envio apresenta a versão atualizada do cartão.

## Texto antigo e conteúdo formatado

Colunas `description_format` e `notes_format` distinguem texto simples anterior de HTML do editor. Textos antigos continuam literais e suas quebras de linha são preservadas ao abrir o editor. O salvamento envia o formato explicitamente, mantendo compatibilidade com clientes que enviam texto simples ou omitem os campos.

O servidor usa `sanitize-html` com lista restrita de elementos de formatação, sem atributos, scripts, imagens ou links no corpo. O navegador usa DOMPurify antes de exibir o conteúdo; colagem de HTML também é filtrada antes da inserção no editor. Os limites de 20.000 caracteres incluem a marcação. Os limites multipart foram ajustados para aceitar formato, textos e remoção das imagens na mesma edição.

Referências: [QEditor](https://quasar.dev/vue-components/editor/), [sanitize-html](https://github.com/apostrophecms/sanitize-html), [DOMPurify](https://github.com/cure53/DOMPurify).

## Verificação

Na mesa, abra a edição de um personagem, formate a descrição e as anotações e salve. Reabra para conferir persistência. Abra o cartão pelo ícone e confira a descrição formatada e ausência dos campos de edição. Com uma sessão de jogador aberta na mesma mesa, use Exibir aos jogadores e confira que só o cartão aparece. Feche-o, recarregue a sessão e confira que ele não reaparece. Como jogador, confira a ausência de Controlado por, dos seletores de camada e do botão de apresentação coletiva.

- Compilação da API e checagem de tipos aprovadas.
- Integração de personagens aprovada, incluindo formatação filtrada, edição pelo controlador, bloqueio de transferência pelo jogador, envio exclusivo do mestre, isolamento da campanha, destinatários online, cursor sem repetição, ausência de anotações no cartão e acesso temporário às imagens sem liberar ficha.
- Teste completo de navegador com duas sessões aprovado: formatação pelo botão de negrito persistida, cartão sem inputs, apresentação coletiva recebida pelo jogador, controles exclusivos do mestre, ausência de anotações na apresentação e ausência de reprodução após recarregar.
- Ambiente Docker reconstruído com as novas dependências; API e interface saudáveis.

Continuação na branch `feat/tokens-e-fichas-de-jogadores` e no PR #3, sem incluir as alterações locais anteriores de Docker, régua ou escala de tokens. Nenhum merge automático.
