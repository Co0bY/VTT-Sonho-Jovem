# Retomada do ambiente — 06/11/2026

Executado `docker compose up -d` no Ubuntu (WSL) para garantir que os serviços de desenvolvimento estejam iniciados, preservando o volume existente do banco.

Validação: `docker compose ps` mostrou PostgreSQL saudável e MailHog em execução. `docker compose exec -T postgres pg_isready -U vtt -d vtt` confirmou que o banco aceita conexões.

PostgreSQL disponível em `127.0.0.1:5432`; interface do MailHog em http://127.0.0.1:8025.

O Compose contém apenas banco e e-mail local. Para iniciar API e interface, executar `pnpm dev` na raiz do workspace.

Após relato de indisponibilidade na porta 9000, foi confirmado que frontend e API não estavam escutando. Executado `pnpm dev` na raiz para iniciar ambos em modo de desenvolvimento. Validação por HTTP: frontend em http://127.0.0.1:9000 retornou 200; API em http://127.0.0.1:3000/health retornou `{"status":"ok","database":"up"}`. Manter o processo de desenvolvimento em execução durante o trabalho.
