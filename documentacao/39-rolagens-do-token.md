# Atalhos de rolagem no token selecionado

Ao selecionar um token no mapa, a faixa abaixo do nome do cenário mostra a cor, o nome e os botões de rolagem disponíveis. Clique em uma área vazia do cenário para desmarcar o token.

Para mostrar um botão, abra **Ficha → Editar ficha → Propriedades do campo**, marque **Possui atalho no token** e salve o personagem. O campo também precisa ter uma regra **Clique → Rolar**. Campos novos e antigos sem a opção marcada ficam sem botão. Desmarcar a opção oculta o atalho e preserva a regra na ficha. O texto do botão é o rótulo do campo e a rolagem usa o valor salvo, inclusive em fichas com mais de uma página. O atalho usa a mesma preparação da rolagem e o mesmo envio ao chat da ficha. O mestre e o jogador que controla o personagem veem os atalhos, de acordo com o acesso existente à ficha.

Para conferir com Iovilus, marque a opção nos campos desejados, salve, selecione seu token e clique em **Poder (FÍS)**, **Habilidade**, **Vitalidade**, **Mentalidade** ou **Encanto**. Com os valores salvos durante a validação, esses atalhos enviam respectivamente de 1d6 a 5d6 ao chat e contam resultados de 5 a 6 como sucessos.

## Validação

O build e a checagem de tipos passaram. No Chromium, uma campanha temporária recebeu uma cópia da ficha cadastrada de Iovilus. O teste conferiu a cor, o nome e os cinco botões, clicou em cada um e verificou os grupos de dados no chat e na API. Outra sessão selecionou o mesmo token e viu apenas a cor e o nome. A campanha original permaneceu intacta.

## Barra compacta e ativação por campo

A barra usa fonte, marcadores e espaçamento menores. Os botões continuam ocupando pelo menos 24 px de altura. No Chromium, marquei e desmarquei a opção em **Poder (FÍS)** numa cópia da ficha real de Iovilus. Após salvar e recarregar, apenas o campo marcado apareceu e rolou 1d6 no chat. Ao desmarcar e salvar, o botão sumiu.

A ficha de Iovilus tem 115 campos, incluindo texto multilinha e dados de técnicas. A API mantém o limite de 120 para fichas novas e permite salvar fichas existentes acima desse limite até sua quantidade já armazenada. O salvamento preserva os dados de técnicas já cadastrados. A integração da API cobre os valores verdadeiro e falso, a rejeição de texto no lugar do booleano e o salvamento de uma ficha existente acima do limite.
