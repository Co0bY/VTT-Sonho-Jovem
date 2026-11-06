# Registro da base local

## 5 de novembro de 2026

- PostgreSQL 17.11 iniciou com a imagem oficial `postgres:17`. O Compose confirmou o estado saudável.
- O pnpm instalou Vue, Quasar, Vue Router, NestJS, o driver `pg` e as ferramentas de compilação. O arquivo `pnpm-lock.yaml` registra as versões exatas de todas as dependências.
- O pnpm exigiu aprovação para dois scripts de instalação. Autorizamos `@parcel/watcher` e `esbuild` no workspace porque preparam binários usados pela cadeia de desenvolvimento. A autorização fica versionada para a próxima instalação.
- Ajustamos o Webpack transitivo do Nest CLI para resolver a incompatibilidade de versão apontada por `pnpm peers check`. O ajuste está limitado à dependência do CLI.
- `pnpm install --frozen-lockfile`, `pnpm peers check` e `pnpm build` passaram. A API e o proxy do frontend retornaram `{"status":"ok","database":"up"}`. O resultado verifica a comunicação entre os três serviços.
- O primeiro commit depende da configuração de nome e e-mail do Git no Ubuntu. A configuração pode ser feita apenas neste repositório com `git config --local`.
