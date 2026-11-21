# Modelos de ficha

Na aba **Ficha** do personagem, abra **Modelos de ficha**. Para salvar o layout em sua biblioteca, informe um nome e use **Salvar como modelo**. A caixa **Global** vem desmarcada.

A tabela `modelos_ficha` registra o autor, o nome e a ficha. O campo `global` é um enum PostgreSQL com valores `S` e `N`, com padrão `N`. A API só disponibiliza cada modelo e suas imagens ao autor ou, se global, a qualquer usuário autenticado.

A cópia inclui páginas, fundos, configuração dos campos e macros. Os valores preenchidos são limpos para evitar compartilhar dados do personagem. Ao importar, o modelo substitui a ficha no formulário. Use **Salvar personagem** para gravar a nova ficha. As permissões de edição da mesa se aplicam a esse salvamento. As imagens importadas são copiadas para a mesa, de modo que a ficha salva tem seus próprios arquivos.

## Ficha oficial de Shounen’s Dream

O modelo global **Shounen’s Dream**, de **Sistema**, é instalado na inicialização do banco. IDs fixos e o bloqueio transacional das migrações impedem duplicatas quando a API reinicia. A conta técnica recebe um hash aleatório por instalação e o marcador `is_system` bloqueia login, sessões e recuperação de senha.

A fonte do layout foi `Shounens_Dream_Ficha_Editavel.pdf`. As posições foram medidas nos campos do PDF e convertidas para a escala do editor. Os três fundos são páginas renderizadas sem os controles do PDF. As legendas das escolhas exclusivas ficam nos controles da interface, que reproduzem o comportamento de Ki/Mana e Qualidade/Defeito. O limite das fichas multipágina passou a 120 campos para comportar os 107 da ficha oficial. Técnica e traço têm campos multilinha para efeitos, como no PDF.

| Página | Conteúdo |
| --- | --- |
| 1 | Identidade, PV e Ki/Mana atuais e máximos, cinco atributos e doze níveis de afinidade |
| 2 | Oito técnicas com nome, nível, elemento, custo, alcance e descrição |
| 3 | Oito qualidades ou defeitos com tipo, nome, custo e impacto narrativo |

### Regras do livro revisado

- Nas páginas 9–11, a criação distribui 10 pontos entre os cinco atributos, geralmente de 1 a 3, com zero permitido pelo mestre. PV máximo inicial é `10 + 5 × VIT`. Ki ou Mana máximo inicial é `8 + 4 × MEN`. A afinidade inicial soma 2 pontos. A ficha permite preencher esses valores manualmente.
- As páginas 11–15 apresentam afinidades primárias, evolução até o nível 10 e combinações terciárias. A página 1 preserva a ordem e os rótulos do PDF editável.
- A página 24 define testes com um d6 por ponto no atributo e sucessos nos resultados 5 ou 6. As cinco macros do modelo executam essa contagem ao clicar no botão ao lado do atributo. Se o total de dados é zero, use a regra manual: role 2d6 e considere apenas o menor resultado.
- A página 26 descreve o ganho de um dado por 4 pontos de Ki/Mana gastos, limitado pelo nível da técnica. Bônus situacionais, gastos de energia e dificuldade continuam a cargo da mesa.

### Como verificar

1. Entre em uma mesa e abra a aba **Ficha** de um personagem que você possa editar.
2. Abra **Modelos de ficha**, selecione **Shounen’s Dream · Global · Sistema** e clique em **Substituir ficha pelo modelo**.
3. Confira as três páginas, preencha um atributo e salve o personagem. Abra novamente a ficha e use o botão de rolagem ao lado do atributo para conferir os sucessos no chat.
4. Para testar a visibilidade, salve um modelo com **Global** desmarcado e outro com a opção marcada. Entre com outra conta e veja que apenas o segundo aparece para importação.

### Validação executada no WSL

- `pnpm --filter @vtt/web typecheck` e `pnpm --filter @vtt/web build` passaram.
- `pnpm --filter @vtt/api test:characters` passou. Cobre enum, visibilidade entre contas, acesso aos fundos, limpeza de valores e bloqueios da conta Sistema.
- `pnpm --filter @vtt/api test:integration` passou. Cobre cadastro, login e recuperação de usuários comuns após a mudança de autenticação.
- `pnpm --filter @vtt/api test:sheet-browser` passou no Chromium, com bibliotecas do sistema extraídas em diretório temporário. O teste salva um modelo, importa a ficha oficial, preenche escolhas exclusivas e texto multilinha, persiste os três fundos e verifica a rolagem de atributo no chat.
