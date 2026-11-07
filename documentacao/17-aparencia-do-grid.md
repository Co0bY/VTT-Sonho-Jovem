# Aparência do grid por cenário — 06/11/2026

## Como usar

Como mestre, abra **Cenários → Editar** no cenário desejado. Em **Aparência das linhas do grid**:

- **Cor das linhas do grid** abre o seletor de cores. **Código da cor do grid** permite digitar `#RRGGBB`.
- **Opacidade das linhas do grid (%)** permite digitar um inteiro entre 0 e 100 ou ajustar a barra ao lado. Ambos os controles editam o mesmo valor.
- Clique em **Salvar cenário** para aplicar. 0% deixa as linhas transparentes; 100% deixa as linhas opacas. A configuração **Mostrar grid** continua controlando a visibilidade.

As configurações pertencem ao cenário e são compartilhadas com os participantes pela atualização existente da mesa. É possível configurar a aparência de um cenário que ainda não esteja em exibição.

## Decisões

Foram usados controles HTML nativos para cor, número e intervalo, com rótulos acessíveis e suporte ao teclado. O campo de porcentagem e a barra compartilham o mesmo estado Vue, evitando divergência entre os valores.

A API armazena `grid_color` em hexadecimal e `grid_opacity` entre 0 e 1; a interface converte a opacidade para porcentagem. A migração idempotente adiciona as colunas sem mudar o visual anterior: cor `#a29aad` e opacidade de 16%. Esses também são os padrões dos novos cenários.

As alterações usam a rota existente de configuração de cenários, restrita ao mestre. A API valida formato da cor, tipo numérico e intervalo da opacidade. Campos omitidos preservam os valores atuais, permitindo continuar usando configurações e fluxos anteriores. O PixiJS passa a usar a cor e a opacidade do cenário ao desenhar as linhas.

## Validação

- Checagem de tipos do frontend e builds da API e do frontend: aprovados.
- `pnpm --filter @vtt/api test:scenes`: aprovado. Verifica padrões, isolamento por cenário, persistência, normalização hexadecimal, valores 0 e 1, preservação de campos omitidos e rejeição de cores/opacidades inválidas.
- Teste de navegador aprovado, verificando escolher a cor, digitar a porcentagem, ajustar a barra pelo teclado, verificar sincronização e reabrir o cenário com os valores salvos. Captura do modal em `analise-arquivo/aparencia-grid.png` (artefato local ignorado pelo Git).
