# Atualização direta do formato do grid — 06/11/2026

## Relato e investigação

Foi relatado que trocar Quadrado por Hexagonal (ou o inverso) mantinha o desenho anterior até salvar Nenhum como etapa intermediária. A primeira execução isolada com troca direta não reproduziu a falha. A API retornou o tipo salvo corretamente; por isso, a alteração foi concentrada no ciclo de renderização, sem mudar dados, permissões ou configurações salvas.

## Alteração

A mesa agora observa explicitamente `scene.grid_type` e reconstrói o container de renderização do cenário após a atualização das propriedades. Assim, a mudança de formato descarta os elementos gráficos e o estado de máscara do formato anterior. A câmera e as texturas carregadas são preservadas: a troca não precisa recarregar o mapa nem recentralizar a mesa.

A limpeza também desvincula as máscaras antes de destruir os elementos gráficos que elas referenciam. Isso dá uma ordem explícita ao descarte dos recursos do grid hexagonal. Uma transformação em andamento é cancelada quando o tipo de grid muda.

## Como verificar

1. Abra uma mesa com grid Quadrado, edite o cenário, escolha Hexagonal e salve.
2. Volte diretamente para Quadrado e salve, sem selecionar Nenhum.
3. Repita com uma imagem principal de fundo.
4. Salve Hexagonal, recarregue a página e troque diretamente para Quadrado.

A troca deve atualizar o desenho após o salvamento, mantendo posição e zoom da câmera.

## Validação

O teste de navegador foi ampliado para repetir as trocas `Quadrado → Hexagonal → Quadrado`, comparar capturas reais do canvas, repetir com imagem de fundo e recarregar a página com Hexagonal já salvo. A comparação verifica que o canvas hexagonal difere do quadrado e que o retorno ao quadrado recupera a mesma imagem de referência, incluindo o enquadramento.

O comando de navegador usa as bibliotecas temporárias descritas em `15-alcas-de-imagens.md`.

Resultados: checagem de tipos e build do frontend aprovados; teste completo de navegador aprovado com as novas comparações visuais, sem erros de página. `git diff --check` também aprovado.
