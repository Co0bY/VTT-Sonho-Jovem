# Pastas de cenários — 06/11/2026

## Como usar

No painel lateral **Cenários**, o mestre pode:

- Clicar em **+ Nova pasta**, informar o nome e criar uma pasta.
- Recolher ou expandir cada pasta pelo cabeçalho, que também mostra a quantidade de cenários.
- Usar o seletor abaixo de cada cartão para mover o cenário para outra pasta ou para **Sem pasta**. A alteração é salva imediatamente.
- Escolher **Pasta do novo cenário** durante a criação, ou **Pasta do cenário** na edição e salvar junto com as demais configurações.
- Renomear uma pasta pelo botão de lápis ou excluí-la pelo botão ×. Excluir uma pasta move seus cenários para **Sem pasta**, sem apagar cenários, mapas, tokens ou a seleção do cenário ativo.

Cada cenário pertence a uma pasta por vez. As pastas têm um único nível e são salvas por campanha. Os cenários já existentes começam em Sem pasta. Os nomes de cenários continuam únicos na campanha, como antes. Pastas vazias são mantidas e podem ser usadas depois. O estado recolhido/expandido é local ao painel e não é persistido após recarregar.

## Decisões

A organização usa a tabela `tabletop_scene_folders`, com nomes únicos por campanha sem diferenciar maiúsculas/minúsculas, e a coluna opcional `tabletop_scenes.folder_id`. A migração é idempotente. Uma chave estrangeira composta impede associar cenário a uma pasta de outra campanha, inclusive fora da API. A exclusão usa `ON DELETE SET NULL (folder_id)`, preservando todos os cenários.

As rotas de criar, renomear, excluir e mover validam sessão, mutação e permissão de mestre. Pasta e cenário devem pertencer à campanha da rota. A lista de pastas é devolvida apenas ao mestre; jogadores continuam vendo somente o cenário em exibição. Mover um cenário não o ativa nem muda seu conteúdo.

A página da mesa reutiliza o mecanismo existente de salvar e atualizar o estado. O seletor do cartão reverte o valor exibido se o servidor recusar a movimentação. Criação e edição usam seletores nativos com rótulos acessíveis. Não há arraste entre pastas nesta entrega.

## Validação

- Checagem de tipos e builds do frontend e da API: aprovados.
- `pnpm --filter @vtt/api test:scenes`: aprovado. Inclui criar/renomear pastas, nomes duplicados e vazios, isolamento e permissões, associação na criação/edição, movimentação, proteção por chave estrangeira e exclusão de pasta preenchida preservando os cenários e o cenário ativo.
- Teste de navegador aprovado: criar, recolher/expandir, renomear, recarregar, mover entre pastas e excluir uma pasta preenchida sem perder o cenário.
