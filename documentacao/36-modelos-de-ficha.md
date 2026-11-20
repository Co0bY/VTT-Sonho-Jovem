# Modelos de ficha

Na aba **Ficha** do personagem, abra **Modelos de ficha**. Para salvar o layout em sua biblioteca, informe um nome e use **Salvar como modelo**. A caixa **Global** vem desmarcada.

A tabela `modelos_ficha` registra o autor, o nome e a ficha. O campo `global` é um enum PostgreSQL com valores `S` e `N`, com padrão `N`. A API só disponibiliza cada modelo e suas imagens ao autor ou, se global, a qualquer usuário autenticado.

A cópia inclui páginas, fundos, configuração dos campos e macros. Os valores preenchidos são limpos para evitar compartilhar dados do personagem. Ao importar, o modelo substitui a ficha no formulário. Use **Salvar personagem** para gravar a nova ficha. As permissões de edição da mesa se aplicam a esse salvamento. As imagens importadas são copiadas para a mesa, de modo que a ficha salva tem seus próprios arquivos.
