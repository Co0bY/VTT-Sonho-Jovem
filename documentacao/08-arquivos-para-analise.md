# Arquivos locais para análise

A pasta `analise-arquivo/` recebe prints e outros arquivos temporários para análise durante o desenvolvimento.

Seu `.gitignore` ignora todo o conteúdo, incluindo subpastas, com exceção do próprio `.gitignore`. Assim a estrutura pode ser versionada sem incluir os arquivos analisados.

Validação: `git check-ignore --no-index analise-arquivo/print.png analise-arquivo/subpasta/arquivo.txt` confirmou que ambos são ignorados. `git status --short --untracked-files=all -- analise-arquivo/` mostra somente o `.gitignore` como arquivo novo.

Para usar, salve o arquivo nessa pasta e informe seu caminho na conversa, por exemplo: `analise-arquivo/print.png`.
