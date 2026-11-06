# Apresentação do e-mail de primeiro acesso

## Decisões — 05/11/2026

- O e-mail agora contém HTML com cabeçalho escuro, detalhes em lilás, botão para definir a senha e assinatura “Atenciosamente, Equipe VTT Sonho Jovem”. A redação explica a ativação em tom mais formal.
- O símbolo de estrela da interface foi representado em PNG e incorporado como imagem inline por CID. O arquivo `apps/api/src/email-logo.ts` guarda o PNG em base64 para acompanhar a compilação, sem depender de cópia de arquivos ou de uma URL pública. Não havia um arquivo de logo no repositório; o símbolo segue a identidade já utilizada na página.
- Tabelas de apresentação, estilos inline, fontes de sistema e largura máxima de 600 px favorecem a compatibilidade entre leitores de e-mail. A renderização pode variar entre clientes.
- A versão em texto simples continua disponível, com o mesmo link e assinatura. O HTML inclui também o endereço para copiar. O endereço é escapado no HTML, preservando os parâmetros de primeiro acesso e convite.
- Validade de 48 horas, uso único, reenvio e fluxo de autenticação permanecem os mesmos.

## Validação

- `pnpm --filter @vtt/api test:integration`: aprovado, incluindo compilação TypeScript, entrega SMTP real ao MailHog, ativação, reenvio e regressão de mesas/convites. A primeira execução ficou impedida pelo sandbox de acessar a porta do PostgreSQL; a execução com acesso local passou.
- Verificação local do objeto enviado ao transporte: HTML e texto simples presentes, assinatura da equipe, referência CID, conteúdo PNG e URL com convite escapada corretamente aprovados.
- Verificação visual em clientes de e-mail permanece manual.
- A pedido do usuário, foi enviada uma prévia para a conta existente `usuario_teste@email.com`, capturada e confirmada no MailHog com assunto iniciado por `[Validação de layout]`. O envio reutilizou o template com um token aleatório não persistido: não altera a conta nem invalida os links existentes; o botão desta prévia não ativa a conta. A consulta inicial pelo assunto não reconheceu a codificação MIME do cabeçalho; a confirmação foi feita pela mensagem mais recente, sem repetir o envio.

## Como conferir

1. Com a API em execução (`pnpm dev`) e os serviços locais ativos, abra a aba **Criar conta**.
2. Cadastre um endereço de teste ou solicite novamente o link de uma conta ainda pendente.
3. Abra `http://127.0.0.1:8025` e selecione a nova mensagem. Mensagens antigas não são alteradas.
4. Confira a aba HTML: símbolo de estrela, cabeçalho, botão, instruções e assinatura. Confira também a alternativa em texto simples.
5. Clique em **Definir minha senha** e confirme que a tela de primeiro acesso abre normalmente.

## Correção de compatibilidade com MailHog

A captura enviada pelo usuário mostrou cabeçalhos MIME e sequências como `=C3=A0` na aba HTML, além de imagem e estilos quebrados. A entrega SMTP estava correta, mas o teste anterior não verificava a escolha da parte HTML pelo visualizador.

O MailHog procura `text/html` em todo o cabeçalho Content-Type. Assim, selecionava o contêiner `multipart/related; type="text/html"` antes de chegar à parte HTML real e não decodificava o conteúdo quoted-printable. Além disso, seu mapa de imagens CID examina apenas o primeiro nível das partes MIME. Causa confirmada pela mensagem capturada e pelo [código do visualizador MailHog](https://github.com/mailhog/MailHog-UI/blob/master/assets/js/controllers.js), nas funções `findMatchingMIME` e `selectMessage`.

O transporte agora utiliza um plugin `stream` do Nodemailer para organizar a mensagem como `multipart/related; type="multipart/alternative"`, contendo as alternativas texto/HTML e a logo como partes irmãs. A primeira parte contém as alternativas e a imagem fica no nível resolvido pelo MailHog. A estrutura preserva a imagem CID, a codificação de transporte e a alternativa em texto simples. Não foram removidos acentos, estilos nem conteúdo da mensagem.

Validação: `pnpm --filter @vtt/api test:integration` aprovado. O teste agora reproduz a busca de HTML do MailHog e confirma seleção de uma parte `text/html`, decodificação dos acentos, atributos de estilo, assinatura, referência CID e download da imagem com assinatura PNG correta, além das verificações anteriores de autenticação e convites. A inspeção visual final permanece manual.

Uma nova prévia com assunto **[Layout corrigido] VTT Sonho Jovem — defina sua senha de primeiro acesso** foi enviada para `usuario_teste@email.com` e confirmada no MailHog. Como a anterior, usa token aleatório não persistido, sem modificar a conta. Abra essa nova mensagem para avaliar o layout; as mensagens anteriores continuam com a estrutura antiga.
