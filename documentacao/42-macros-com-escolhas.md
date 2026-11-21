# Rolagens com outro campo e macros com escolhas

Em **Configurações da ficha → Blocos**, configure uma ação **Rolar dados**. Em **Quantidade de dados → Valor do input**, selecione **Input atual** para usar o campo que disparou a regra ou **Outro input** para escolher um campo da ficha. A referência funciona entre páginas. A rolagem lê a quantidade ao executar e aceita inteiros de 1 a 50. Atalhos de rolagem no token usam os valores salvos da ficha.

Para criar um fluxo, use a ação **Abrir seletor**, dê um título ao seletor e configure cada opção. Os blocos conectados mostram qual ação pertence a qual opção. Uma opção pode rolar dados, enviar uma mensagem ao chat, atualizar outro campo ou abrir o próximo seletor. É possível voltar à escolha anterior ou cancelar durante a execução. O editor aceita até 16 seletores por caminho e 12 opções por seletor.

## Sincronização entre blocos e texto

Os dois modos editam as mesmas regras. Por exemplo, esta rolagem de d8 lê a quantidade no campo de referência `poder`:

```text
quando ataque clique rolar d8 de poder
```

Um seletor usa JSON para preservar os ramos dentro da regra. Um ramo com outro seletor contém um objeto `label` e `options`; uma ação final usa uma linha curta de macro.

```text
quando ataque clique escolher {"label":"Qual ataque?","options":[{"label":"Físico","action":"rolar d8 de poder"},{"label":"Aguardar","action":"chat \"Aguardando\""}]}
```

As referências vêm da opção **Referência do campo**. O backend valida os campos referenciados e a estrutura em profundidade antes de salvar. Quando a rolagem chega ao chat, ela já contém as quantidades resolvidas. A API continua sorteando os resultados e validando os limites de dados.

## Como verificar

1. Crie dois campos em uma ficha, preencha o segundo com `3` e configure o primeiro com **Clique → Rolar dados → Valor do input → Outro input**. Aponte para o segundo campo. Confira `d6 de <referência>` no editor de texto.
2. Mude a ação para **Abrir seletor**. Dê um nome a cada opção e encadeie cinco seletores configurando **Abrir próximo seletor** em um ramo. Configure o ramo alternativo para enviar uma mensagem fixa.
3. Abra **Editor de texto**, altere as faces da ação final, volte a **Blocos** e confira o valor. Salve, clique no campo e percorra os dois caminhos. A rolagem ou mensagem só é enviada ao alcançar uma ação final.

## Validação

Build, tipagem e 21 testes unitários passaram. O teste de ficha no Chromium criou cinco níveis em Blocos, editou a ação final no texto e conferiu seu retorno aos blocos. Depois executou o ramo alternativo no chat e percorreu os cinco seletores para rolar 40d4, usando o valor salvo de um campo em outra página. A integração da API verifica a persistência, a rejeição de referências inválidas e o limite de profundidade.
