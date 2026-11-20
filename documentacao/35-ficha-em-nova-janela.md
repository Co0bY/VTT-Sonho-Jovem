# Ficha em uma nova janela

O modal do personagem usa a mesma largura e altura nas quatro abas, com limites proporcionais à tela. O botão no canto superior direito exibe um ícone de abertura externa e o tooltip “Abrir ficha em nova janela”.

A nova janela mostra a ficha do personagem aberto. O Vue usa Teleport para mover o editor existente entre a mesa e a janela, mantendo a página selecionada, as imagens de fundo e as alterações em andamento. Ao fechar a janela, o editor volta à aba Ficha. O botão Salvar personagem continua no modal da mesa. Se o navegador bloquear a abertura, o modal informa como liberar o pop-up.

## Como conferir

1. Na mesa, abra Personagens e edite um personagem. Alterne entre as abas e confira que o modal mantém suas dimensões.
2. Passe o mouse sobre o ícone no canto superior direito e clique. Redimensione a janela pelo navegador.
3. Mude de página ou altere um campo na janela. Feche a janela e confira que a ficha voltou à mesa com o estado preservado.
4. Salve pelo modal se quiser persistir as alterações.

A checagem de tipos e o build do frontend passaram. O teste `pnpm --filter @vtt/api test:sheet-browser` inclui a conferência do tamanho do modal, o carregamento do fundo ainda em rascunho na nova janela e o retorno do editor ao modal.

O teste de navegador passou no Chromium. O Ubuntu estava sem as bibliotecas NSPR, NSS e ALSA exigidas pelo navegador. Para executar a validação, os pacotes foram extraídos em uma pasta temporária e disponibilizados ao processo via `LD_LIBRARY_PATH`.
