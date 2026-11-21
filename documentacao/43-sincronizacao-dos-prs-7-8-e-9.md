# Sincronização dos PRs 7, 8 e 9

A base local foi atualizada por fast-forward para `3e83536`, que contém o PR #12. Cada branch foi sincronizada com essa base, preservando seu histórico remoto.

- **PR #7 — modelos e técnicas.** A resolução combina os modelos e as técnicas de Shounen’s Dream com as macros encadeadas, os seletores pesquisáveis e a visibilidade da ficha. A ficha em janela separada mantém seu fluxo de edição e os seletores abrem nessa janela. O limite para fichas e modelos novos é de 120 campos. Fichas existentes maiores podem manter a quantidade já salva.
- **PR #8 — dados 3D e chat.** A resolução preserva o Canvas, o áudio, o d8 atualizado, a remoção por clique e a paginação, junto com as mudanças da base. O resultado tem a mesma árvore de arquivos da versão que já estava em uso na mesa local.
- **PR #9 — atalhos de rolagem.** O PR #12 já incorporou os atalhos e as opções por campo. Após a sincronização, a branch do PR #9 e a `main` têm os mesmos arquivos.

No PR #7 passaram build, tipagem, 24 testes unitários, integração de personagens e a suíte de ficha no Chromium, incluindo o modelo oficial, rolagens de técnica e cinco escolhas de macro. No PR #8 passaram tipagem, 25 testes unitários e a suíte da mesa no Chromium, incluindo os dados 3D e a paginação. No PR #9 a árvore foi comparada diretamente com a `main`.
