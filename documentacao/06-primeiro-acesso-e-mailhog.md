# Primeiro acesso por e-mail e MailHog

## Mudança solicitada

O cadastro passa a solicitar apenas nome e e-mail. Não cria sessão nem libera a dashboard nessa etapa. A API envia um link para definição de senha com validade de dois dias (48 horas). O usuário define e confirma sua senha e, depois, entra normalmente. Contas já cadastradas com senha continuam funcionando.

## Decisões

- MailHog instalado como serviço Docker Compose, imagem `mailhog/mailhog:v1.0.1`. SMTP em `127.0.0.1:1025`; caixa de entrada web em `http://127.0.0.1:8025`. As portas ficam restritas ao computador local. As mensagens são capturadas para testes, sem envio externo automático. O armazenamento padrão em memória é temporário: recriar/reiniciar o container pode apagar mensagens.
- Nodemailer envia por SMTP; configuração está em `.env.example`. Os padrões locais já conectam ao MailHog sem credenciais, sem necessidade de editar o `.env` existente. A API roda no Ubuntu, fora dos containers. Se for containerizada futuramente, usar `SMTP_HOST=mailhog` na mesma rede Docker.
- `password_hash` aceita NULL para contas pendentes. As contas anteriores não são apagadas nem têm sua senha alterada.
- `password_setup_tokens` guarda somente SHA-256 de token aleatório de 256 bits e sua expiração. O link leva o token no fragmento da URL, evitando enviá-lo no pedido HTTP da página e no Referer. O frontend o envia no corpo POST apenas ao definir a senha.
- A criação e o aceite são transacionais. Uso único é garantido por consumo atômico no banco, inclusive sob concorrência. A definição de senha requer confirmação e mantém o hash scrypt existente.
- Repetir o cadastro de uma conta pendente reenvia o e-mail e substitui o token: somente o link mais recente funciona. Contas ativas não têm sua senha redefinida pelo cadastro. Recuperação de senha de contas ativas continua sendo um fluxo futuro separado.
- Se o SMTP falhar, a transação é revertida e a interface informa erro de envio; não há mensagem falsa de sucesso. Limitação: SMTP e PostgreSQL não compartilham transação distribuída. Uma falha excepcional no commit depois do envio pode produzir link inutilizável; reenviar resolve. Fila/outbox fica para evolução posterior.
- Convites de mesa acompanham o link de primeiro acesso, inclusive ao trocar de navegador. Após definir a senha e entrar, o jogador ainda confirma o aceite da mesa.

Referências consultadas: [MailHog](https://github.com/mailhog/MailHog) e [SMTP do Nodemailer](https://nodemailer.com/smtp).

## Como verificar

No Ubuntu/WSL, na raiz:

```bash
nvm use
pnpm install --frozen-lockfile
docker compose up -d
pnpm dev
```

Se a API já estava aberta durante a instalação da dependência, reinicie `pnpm dev`.

1. Abra `http://127.0.0.1:9000` e clique em **Criar conta**.
2. Informe apenas nome e e-mail. Não deve aparecer campo de senha nem entrar automaticamente.
3. Abra `http://127.0.0.1:8025` e selecione a mensagem destinada ao e-mail informado. Um endereço fictício serve, porque o MailHog captura as mensagens localmente.
4. Abra o link da mensagem, defina e confirme a senha (10 a 128 caracteres).
5. Entre com o e-mail e a senha criada. A dashboard fica disponível.
6. Tente reutilizar o link: deve ser recusado. Para reenviar antes de ativar a conta, informe novamente nome e e-mail na aba **Criar conta**; o link anterior deixa de funcionar.

## Validação

- `pnpm build`: compilação do backend e frontend aprovada.
- `pnpm --filter @vtt/api test:integration`: aprovado com PostgreSQL e SMTP real no MailHog. Inclui cadastro sem senha e sem cookie, login bloqueado antes da ativação, chegada do e-mail, expiração configurada em 48 horas, token desconhecido/expirado/reutilizado, senha curta, confirmação divergente, reenvio e invalidação do token anterior, consumo único sob duas requisições concorrentes e manutenção dos fluxos de mesas/convites.
- O teste usa destinatários temporários e remove somente os dados e mensagens dessa execução, preservando as demais mensagens da caixa.
- A interface foi compilada; a verificação visual em navegador permanece manual pelo roteiro acima.
