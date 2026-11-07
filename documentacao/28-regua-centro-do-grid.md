# Régua no centro das células

## Comportamento e decisões

A régua encaixa suas duas pontas no centro das células, independentemente da opção de encaixe dos tokens. Cada passo vale a escala definida no cenário (por exemplo, 1,5 m, 3 m, 4,5 m). No grid quadrado, uma diagonal custa um passo, assim como um movimento horizontal ou vertical. No hexagonal, a distância conta o caminho mínimo entre células.

Alt libera ambas as pontas nas posições reais do ponteiro e usa distância euclidiana. Pressionar ou soltar Alt durante o arraste recalcula a régua mesmo sem mover o mouse. Sem grid, a medição é sempre livre. A indicação da ferramenta explica o atalho. A régua funciona mesmo sobre alças de uma seleção anterior.

A lógica está em `measureRuler`, separada do componente PixiJS. A distância livre anterior permanece disponível em `distance`.

## Validação

- `pnpm --filter @vtt/web test`: 19 testes aprovados, incluindo centros, mesma célula, diagonal, escala alternativa, Alt, ausência de grid e hexágonos.
- `pnpm --filter @vtt/web exec quasar prepare` seguido de `pnpm --filter @vtt/web typecheck`: aprovado. O prepare gera a configuração local necessária em uma worktree nova.
- Verificação manual sugerida: abrir uma mesa em http://127.0.0.1:9000, selecionar a régua e arrastar entre células com escala de 1,5 m. Conferir as pontas nos centros e valores em múltiplos de 1,5. Segurar/soltar Alt durante o arraste e conferir o modo livre. Repetir com zoom e câmera deslocada, grid hexagonal e sem grid.
- Interação no navegador ainda não automatizada nesta entrega.

## Branch e publicação

Entrega preparada em `feat/regua-centro-do-grid`, na worktree `/tmp/vtt-regua`, a partir de `origin/main` atualizada. Ajuste também aplicado ao checkout em execução, preservando alterações locais anteriores.

Após autenticação do GitHub CLI pelo navegador com a conta Co0bY, a branch foi publicada em `origin`. PR em rascunho para `main`: https://github.com/Co0bY/VTT-Sonho-Jovem/pull/2. Nenhum merge realizado.

## Encerramento ao soltar

A régua é exibida somente enquanto o ponteiro está pressionado. Soltar o botão ou cancelar o gesto limpa linha, pontas e distância no mesmo redesenho. A captura do ponteiro mantém o encerramento ao soltar fora do tabuleiro. A ferramenta permanece selecionada para iniciar outra medição.

Validação: checagem de tipos e `git diff --check` aprovados. Para conferir no navegador, arrastar a régua e soltar dentro e fora do tabuleiro, com e sem Alt; a marcação deve desaparecer. Interação no navegador ainda não automatizada.
