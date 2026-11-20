# Ficha em uma nova janela

O modal do personagem usa a mesma largura e altura nas quatro abas, com limites proporcionais à tela. O botão no canto superior direito exibe um ícone de abertura externa e o tooltip “Abrir ficha em nova janela”.

Ao abrir a ficha em uma nova janela, o modal fecha e a mesa volta a aceitar interações. O Vue usa Teleport para mover o formulário existente, mantendo a página selecionada, os fundos e as alterações em andamento. As abas e o botão **Salvar personagem** ficam disponíveis no pop-up. Fechar o pop-up encerra a edição. Se o navegador bloquear a abertura, o modal permanece aberto e informa como liberar o pop-up.

Os campos com macro de clique ganham um botão com ícone de d20 ao lado do controle. O botão executa a ação configurada e o tooltip identifica o campo.

## Como conferir

1. Na mesa, abra Personagens e edite um personagem. Alterne entre as abas e confira que o modal mantém suas dimensões.
2. Passe o mouse sobre o ícone no canto superior direito e clique. Redimensione a janela pelo navegador.
3. Confira que a mesa está livre para uso enquanto o pop-up está aberto. Alterne entre abas e edite a ficha pela nova janela.
4. Use o d20 ao lado de um campo com macro de clique e confira a execução. Salve pelo pop-up para persistir as alterações. Após salvar ou fechar a janela, o modal continua fechado.

O teste `pnpm --filter @vtt/api test:sheet-browser` verifica as dimensões do modal, o desbloqueio da mesa, o carregamento de fundo em rascunho, o salvamento pelo pop-up e a execução de macro pelo d20.

O teste de navegador passou no Chromium. O Ubuntu estava sem as bibliotecas NSPR, NSS e ALSA exigidas pelo navegador. Para executar a validação, os pacotes foram extraídos em uma pasta temporária e disponibilizados ao processo via `LD_LIBRARY_PATH`.
