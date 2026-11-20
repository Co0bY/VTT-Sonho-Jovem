# Técnicas de Shounen’s Dream na ficha

A segunda página do modelo oficial segue a disposição de `técnica teste.png`. Selecione o nível de 1 a 20, o elemento e o atributo usado na jogada. Nome, alcance e descrição são campos preenchidos para cada técnica. A primeira página também oferece seletores para os níveis de elemento.

## Regras usadas

- O livro revisado, nas páginas 26 e 27 do PDF, define 1d6 extra a cada 4 pontos de Ki ou Mana e lista níveis de 1 a 10. A ficha aplica essa proporção até 20 e exibe o custo máximo calculado. O botão usa esse custo integral na jogada.
- Rolar ataque soma os dados do atributo selecionado aos dados extras da técnica e conta 5 ou 6 como acertos. Nome, elemento, nível, custo, alcance, atributo e descrição acompanham a rolagem no chat.
- A regra de ataque da página 32 calcula o dano como 1d6, mais 1d6 a cada 4 pontos investidos, mais 1 ponto por acerto do ataque. Compare o ataque com a defesa na mesa e clique em **Rolar dano** após confirmar o acerto. O botão usa o último ataque bem-sucedido daquela técnica na ficha aberta, uma vez por ataque.
- O limite por elemento, o saldo de energia, a defesa e a aplicação do dano aos PV são administrados pela mesa. Cada técnica da ficha tem um seletor de elemento.

## Como o modelo guarda a regra

A API guarda os vínculos entre os campos por identificador em `techniques`, assim os rótulos e posições podem mudar sem quebrar a configuração. O custo é calculado a partir do nível e os dados são sorteados pelo servidor da mesa. Ao salvar uma ficha como modelo, os vínculos e as opções são mantidos e os campos preenchidos voltam em branco. A atualização do modelo oficial beneficia novas aplicações do modelo. Fichas copiadas anteriormente são independentes. Para atualizar uma delas, guarde os preenchimentos antes de usar **Substituir ficha pelo modelo**, que troca a ficha inteira.

## Como verificar

Aplique o modelo Shounen’s Dream a um personagem de teste e coloque 3 em Habilidade. Na página 2, preencha uma técnica Fogo com alcance CaC e descrição. O nível 1 mostra custo 4 e o nível 20 mostra 80. Com o nível 20, confirme no chat que o ataque rolou 23d6. Se acertar após a defesa, role 21d6 mais o número de acertos. Salve a ficha como modelo e verifique que uma nova cópia mantém os seletores e botões com os campos em branco.
