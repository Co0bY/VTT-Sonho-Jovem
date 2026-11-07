# Versionamento e publicação das atualizações — 06/11/2026

O usuário autorizou criar commits Conventional Commits e fazer push. A branch de trabalho é `main`, com destino em `origin/main` no repositório `Co0bY/VTT-Sonho-Jovem`. O `git fetch origin` confirmou que não havia divergência antes dos novos commits. A autoria local existente foi preservada.

## Organização dos commits

As alterações acumuladas foram agrupadas por responsabilidade, seguindo a organização já usada no histórico, sem reconstruir versões intermediárias dos mesmos arquivos:

1. `feat(api): persistir rotação, grids e pastas de cenários` — `f0c78be`.
2. `feat(web): adicionar alças de imagens, grids e pastas de cenários` — `e35b9d4`.
3. `test(vtt): cobrir transformações, grids e organização de cenários` — `0b4a6d1`.
4. `docs(projeto): registrar melhorias e guia de instalação em PDF` — inclui este registro, os guias das entregas, o contexto atualizado e o tutorial `INFO-instalacao-projeto` em Markdown e PDF.

Os corpos dos commits descrevem o comportamento e as validações relevantes. Os títulos seguem `tipo(escopo): descrição`, sem indicação de mudança incompatível.

## Validações utilizadas

As entregas já haviam concluído build da API/frontend, checagem de tipos do frontend, doze testes de geometria, testes da API de cenários/permissões e testes completos no navegador com duas sessões. O PDF foi verificado como oito páginas A4 com texto pesquisável e teve páginas renderizadas para revisão visual. Os registros de cada entrega estão nos guias 14 a 20 e no tutorial INFO.

Nesta organização do histórico, `git diff --check` e `git diff --cached --check` foram usados para verificar o conteúdo antes dos commits. A lista de arquivos foi revisada: `.env`, dependências, builds, uploads e capturas locais permanecem ignorados. Não houve mudança de código após as validações funcionais que exigisse repeti-las.

## Publicação

Comando de envio: `git push origin main`, sem force push. A confirmação do envio deve comparar `git rev-parse HEAD` com a referência `refs/heads/main` devolvida por `git ls-remote origin refs/heads/main` e conferir `git status -sb`. O hash do próprio commit de documentação fica disponível em `git log`, evitando uma referência circular neste arquivo.
