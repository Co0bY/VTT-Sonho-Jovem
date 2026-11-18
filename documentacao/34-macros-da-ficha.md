# Macros da ficha

Na aba **Configurações da ficha**, as regras conectam um campo, um evento e uma ação. O campo deve existir na aba **Ficha** e ter uma referência única, como `for` ou `frase`.

- Em **Blocos**, arraste um campo para a área de criação. Arraste um evento ou uma ação sobre a regra para alterar seus blocos. Os seletores fazem as mesmas alterações por teclado ou toque.
- Em **Editor de texto**, cada linha representa uma regra. Alterações válidas aparecem nos blocos e edições nos blocos aparecem no texto. Se houver um erro, o editor indica a linha e preserva as últimas regras válidas até a correção.

```text
quando for clique rolar d6
quando frase enter chat
quando postura mudanca chat
```

**Clique** dispara ao clicar no controle. **Enter** usa o valor atual. **Modificação** dispara ao confirmar a alteração, como ao escolher uma opção ou sair de um campo de texto alterado. `rolar d6` usa o número do campo como quantidade de dados, entre 1 e 50. `chat` publica o valor como texto. Há uma ação por combinação de campo e evento, com até 100 regras. Linhas em branco e comentários iniciados com `#` são aceitos. Ao voltar dos blocos para o texto, o editor gera as regras em formato padronizado.

Salve o personagem e reabra a ficha para executar as regras durante o preenchimento. Os eventos do editor de layout e do preenchimento de prévia do layout não enviam mensagens. A rolagem usa o serviço de dados da mesa, que calcula o resultado no servidor. As regras são guardadas com a ficha e referenciam o ID estável do campo. Renomear uma referência atualiza sua forma textual, e excluir um campo remove suas regras.

## Validações

- `pnpm --filter @vtt/api build` e `pnpm --filter @vtt/web typecheck` compilaram os contratos da API e da interface. `pnpm --filter @vtt/web test` passou nos 19 testes de geometria.
- `pnpm --filter @vtt/api test:characters` rejeitou campo inexistente, evento desconhecido, faces fora do intervalo e regras duplicadas.
- `pnpm --filter @vtt/api test:sheet-browser` arrastou blocos, conferiu ambas as conversões, corrigiu uma regra inválida, salvou e reabriu a ficha. Verificou no chat uma rolagem com 12 dados, uma mensagem literal iniciada por `/roll` e o evento de mudança de um select.
- `pnpm --filter @vtt/api test:browser` passou na regressão completa da mesa. As suítes de navegador usaram as bibliotecas temporárias do Chromium no WSL, sem `sudo`.

## Várias rolagens e operações

Em uma regra com a ação **Rolar dados**, use **Adicionar rolagem** para configurar outro grupo. Para cada grupo, escolha **Valor do input** ou **Definir valor**, informe as faces do dado e selecione como calcular o resultado dos dados. A quantidade deve estar entre 1 e 50, com 2 a 1.000 faces, em até 10 grupos.

Um grupo pode retornar o maior dado, o menor dado, a soma, a subtração, o produto ou a divisão. Subtração e divisão seguem a ordem em que os dados ou grupos aparecem, começando pelo primeiro. Com mais de um grupo, **Mostrar separados** é o padrão. Se você escolher uma operação entre grupos, o chat também mostra o resultado combinado. O servidor calcula as rolagens e os resultados.

```text
quando for clique rolar d6 maior, 3d20 menor combinar dividir
quando ataque enter rolar 2d8 multiplicar, 1d4
```

`d6` usa o valor do campo. `3d20` lança três dados de vinte faces. O modificador após cada grupo define o cálculo dentro dele, com soma por padrão. `combinar` aplica uma operação aos resultados dos grupos. As regras anteriores, como `quando for clique rolar d6`, continuam funcionando.

A integração verificou subtração, multiplicação e soma reproduzindo os resultados a partir das faces registradas, além da rejeição de uma quantidade sem resolução. O teste focado verificou quantidades fixa e variável no mesmo evento, retorno do maior e menor valor, divisão entre grupos, sincronização com a DSL e exibição no chat.
