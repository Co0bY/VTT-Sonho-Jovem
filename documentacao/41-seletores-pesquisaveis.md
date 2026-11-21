# Seletores pesquisáveis

Os campos de seleção da mesa, das camadas, dos cenários, dos personagens, das fichas e das macros usam o mesmo componente. Ele usa a paleta escura e lilás dos campos existentes, com tamanhos adequados aos painéis e às fichas sobre imagem.

Clique no campo e digite parte do nome da opção. A busca ignora diferenças de caixa e acentos, então **pes** encontra **Pés / feet (ft)**. Use as setas para navegar, Enter para selecionar e Esc para fechar. No campo **Visível para**, escolha várias opções na mesma lista e clique novamente em um nome para removê-lo.

O componente recebe separadamente o rótulo exibido e o valor persistido. Assim, a interface pode usar nomes amigáveis, como **Hexagonal**, mantendo o código esperado pela API. A seleção de uma lista da ficha ainda dispara a macro de mudança. O menu abre no documento em que o seletor está, inclusive na ficha destacada, e ajusta sua posição ao espaço livre da janela.

## Validação

O build, a checagem de tipos e os testes unitários passaram. A suíte de ficha no Chromium conferiu os seletores de tipos, os valores de lista, as macros e um menu dentro da ficha em nova janela. Um teste com sessões convidadas também confirmou a pesquisa e a seleção de dois jogadores em **Visível para**, a persistência e o modal em 390 px.
