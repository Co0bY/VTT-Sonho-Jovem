# Redefinição de senha para contas existentes

## Entrega

Foi adicionado um e-mail específico de recuperação de senha, com o mesmo cabeçalho, símbolo em PNG incorporado, cores e assinatura do primeiro acesso. O assunto é **VTT Sonho Jovem — redefinição de senha**, o botão é **Redefinir minha senha** e o texto explica que a senha atual continua válida até a confirmação da troca.

O fluxo é acessível por **Esqueci minha senha**, na aba Entrar. O usuário informa o e-mail, recebe um link e define/confirma a nova senha. Após a alteração, deve entrar novamente. Solicitar o e-mail não altera a senha nem encerra sessões.

## Decisões

- Recuperação atende contas ativadas, identificadas por `password_hash IS NOT NULL`, incluindo quem já efetuou login. O sistema não registra um histórico de primeiro login; não foi criada uma exigência de login anterior que impediria a recuperação de uma conta já ativada.
- Contas pendentes continuam no fluxo de primeiro acesso. Solicitar recuperação não as ativa nem substitui seu link de ativação.
- `POST /auth/forgot-password` valida o endereço e retorna a mesma mensagem para conta ativada, pendente ou inexistente, sem divulgar pela resposta se o endereço está cadastrado. Não cria usuários. A latência e falhas operacionais de SMTP não são uniformizadas; a proteção não promete ocultar diferenças de tempo ou indisponibilidade.
- A tabela `password_reset_tokens` é separada de `password_setup_tokens`. Guarda somente SHA-256 de um token aleatório de 256 bits, com validade de 1 hora e um token por conta. Reenvio substitui o link anterior.
- O token vai no fragmento `#redefinir-senha=...`, que não é enviado no pedido HTTP da página. A tela o envia no corpo POST ao concluir.
- `POST /auth/reset-password` exige senha de 10 a 128 caracteres e confirmação idêntica. Links de ativação e de recuperação não são intercambiáveis.
- Troca de senha, consumo único do token e exclusão das sessões acontecem na mesma transação. Bloqueio da conta antes do token mantém a ordem de bloqueio do reenvio e permite apenas um consumo sob concorrência.
- O hash continua usando scrypt com salt aleatório. O envio reutiliza o template e a organização MIME compatível com MailHog, evitando duplicar o HTML.
- As rotas usam a verificação de origem e o limite por IP já existentes (30 tentativas em 15 minutos, em memória por processo, compartilhado com os demais fluxos de autenticação).
- Falha de SMTP reverte a transação do pedido, preservando o token anterior. Persiste a limitação já documentada de SMTP e banco não compartilharem uma transação distribuída.

## Validação

- `pnpm build`: frontend e backend compilados.
- `pnpm --filter @vtt/api test:integration`: fluxo anterior e nova suíte `test/password-reset.cjs` aprovados com PostgreSQL e MailHog reais.
- A suíte cobre conta ativada que já fez login, contas pendente/inexistente com resposta genérica, ausência de criação de conta e de envio indevido, preservação do link de primeiro acesso, e-mail HTML e imagem CID, armazenamento sem token em claro, validade de 1 hora, reenvio, expiração, senha curta, confirmação divergente, isolamento dos tipos de link, consumo concorrente único, rejeição de reutilização, encerramento de sessões e login apenas com a senha nova. Também verifica endereço inválido e origem não autorizada.
- Os testes usam contas e mensagens temporárias e as removem ao terminar. A verificação visual da interface permanece manual.
- Foi enviada e confirmada no MailHog uma mensagem **[Prévia de redefinição] VTT Sonho Jovem — redefinição de senha** para `usuario_teste@email.com`, o mesmo destinatário da validação anterior. A prévia utiliza token aleatório não persistido: permite avaliar o layout sem alterar a conta ou substituir links reais e não conclui a troca de senha.

## Como verificar

1. Inicie os serviços com `docker compose up -d` e a aplicação com `pnpm dev` no Ubuntu/WSL. Se a API não estiver em modo watch, reinicie para aplicar as novas rotas e criar a tabela.
2. Na tela de login em `http://127.0.0.1:9000`, clique em **Esqueci minha senha**.
3. Informe o e-mail de uma conta já ativada.
4. Abra a mensagem de redefinição em `http://127.0.0.1:8025` e confira a aba HTML.
5. Clique em **Redefinir minha senha**, informe e confirme uma senha de pelo menos 10 caracteres.
6. Entre com a nova senha. A senha antiga e o link já utilizado devem ser recusados. Sessões anteriores devem pedir login ao consultar novamente o servidor.
7. Para testar reenvio, solicite dois links antes da confirmação: apenas o segundo deve funcionar.
