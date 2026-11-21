# Defesa e Observação do token

Na mesa, clique com o botão direito em um token da camada ativa para abrir **Propriedades do token**. Pelo teclado, selecione o token, mantenha o foco no mapa e use **Shift + F10**. Arrastar com o botão direito movimenta a câmera.

- **Defesa** pode guardar a Classe de Armadura (CA).
- **Observação** pode guardar a Percepção passiva.

Os campos são opcionais e aceitam números inteiros, incluindo zero. Deixe um campo em branco e salve para limpar seu valor. Cada presença tem seus próprios valores no cenário. O mestre pode editar os tokens das camadas em que trabalha. Jogadores podem editar apenas os tokens que controlam na camada Geral.

O backend valida os valores e a permissão de edição no cenário ativo. O PostgreSQL guarda os dois valores em colunas que aceitam nulo, portanto tokens existentes aparecem inicialmente com os campos vazios. A consulta da mesa fornece os valores somente a quem pode editar as propriedades.

## Validação

Build, tipagem e integração da API passaram. A integração conferiu permissões, visibilidade, rejeição de frações, gravação de zero e limpeza de um dos campos.
