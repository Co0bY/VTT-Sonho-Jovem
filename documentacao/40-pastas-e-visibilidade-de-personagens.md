# Pastas e visibilidade de personagens

O mestre pode criar pastas na aba **Personagens** e mover cada ficha pelo seletor **Pasta** do seu cartão. As pastas são independentes das de cenários e podem ser recolhidas. Excluir uma pasta envia suas fichas para **Sem pasta**. O PostgreSQL aplica essa regra pela chave estrangeira e impede associar uma ficha à pasta de outra campanha.

**Minimizar lista** troca os cartões por linhas com a cor e o nome. Um duplo clique abre a edição para o mestre e o controlador ou a leitura para um convidado. Em telas de toque e com navegação por teclado, a ativação do botão abre o personagem. **Expandir lista** recupera as ações, incluindo o seletor de pasta.

No **Cartão de visita**, o mestre pode selecionar vários jogadores em **Visível para** e salvar. **Controlado por** continua definindo quem edita a ficha junto com o mestre. Os jogadores selecionados podem abrir o cartão e navegar nas páginas da ficha em leitura. A API omite anotações, macros e a lista de convidados para quem tem acesso de leitura. Uma ficha com a lista vazia continua disponível ao mestre e ao controlador. As pastas só aparecem para os jogadores quando contêm alguma ficha visível para eles.

As regras do mapa e das apresentações continuam seguindo suas permissões próprias. Conceder ou revogar acesso à ficha não coloca nem retira tokens. O plano de fundo da ficha exige o mesmo acesso à ficha que a aba **Personagens**.

## Como verificar

1. Como mestre, crie uma pasta e mova um personagem pelo seletor no cartão. Minimize a lista e abra a edição por duplo clique.
2. Marque dois jogadores em **Visível para** e salve. Em outra sessão, abra a ficha e navegue até outra página. Os valores ficam em leitura.
3. Exclua a pasta e confira a ficha em **Sem pasta**. Revogue o acesso de um jogador e confira que a ficha sai da aba dele. O token continua conforme as regras da camada no mapa.

A checagem de tipos, o build e os 19 testes unitários passaram. A integração da API cobriu criação, duplicidade, movimentação, exclusão, autorização, fundo privado e independência dos tokens. No Chromium, duas sessões convidadas receberam o acesso pelo multisseletor. O teste também validou a lista compacta, o duplo clique, a leitura multipáginas e a exclusão de pasta preservando a ficha.
