# Personagens da campanha, Aparência e Token — 06/11/2026

Entrega na branch `feat/tokens-e-fichas-de-jogadores`, acompanhada pelo PR #1. O painel antes chamado Tokens passa a ser **Personagens**. Esta etapa implementa a identidade visual do personagem e sua colocação nos cenários.

## Como usar

1. Abra **Personagens** no painel lateral e clique em **+ Novo personagem**, ou use o botão + da barra da mesa.
2. No pop-up, os dois seletores do topo são **Aparência** e **Token**. Aparência é o retrato do painel; Token é a imagem desenhada no mapa. Ambos aceitam PNG, JPEG e WebP de até 10 MB, com os limites de imagem já usados pelo storage.
3. Preencha o nome e escolha quem controla o personagem. A cor identifica o personagem quando não há imagem. As duas imagens são opcionais; nesse caso, as iniciais identificam o personagem.
4. Clique em **Criar personagem**. Ele passa a existir na campanha, ainda fora do mapa.
5. Arraste o cartão do personagem para dentro do mapa ou use **Adicionar ao mapa**, que posiciona o token no centro visível da câmera. São respeitados encaixe e camada ativa.
6. Use **Editar** para trocar aparência, token, nome, cor ou controlador. As presenças já colocadas acompanham a mudança. Os dois arquivos são independentes: trocar o token preserva a aparência.
7. Remover uma presença pelo × do painel ou por Delete no tabuleiro mantém o cadastro do personagem. Ele pode ser colocado novamente, inclusive em outro cenário.

Um personagem pode ter mais de uma presença no mesmo mapa ou aparecer em vários cenários. O painel mostra quantas presenças existem no mapa atual e permite selecionar, mudar a camada ou remover cada uma. Cenários podem permanecer vazios; trocar de cenário não adiciona personagens automaticamente. A antiga sugestão central de adicionar o primeiro token para começar foi removida.

## Modelo e migração

`tabletop_characters` guarda os personagens por campanha, com nome, controlador, cor e dois arquivos opcionais. `tabletop_tokens.character_id` referencia o personagem; posição, cenário e camada continuam pertencendo à presença no mapa. Uma chave estrangeira composta impede referências entre campanhas diferentes.

A migração converte cada token anterior em um personagem, preservando seu nome, controlador, cor, posição e camada. Não agrupa tokens pelo nome, pois nomes iguais podem representar personagens diferentes. O cadastro novo não depende de `scene_id`. Excluir um cenário apaga suas presenças, mas preserva personagens e suas imagens.

Para compatibilidade, o endpoint JSON anterior de criação de tokens continua funcionando: um trigger cria o personagem correspondente somente quando um token legado é inserido. Leituras e abertura de cenários não criam tokens nem personagens. As migrações são idempotentes e executadas na transação de inicialização existente.

O cadastro foi separado em `apps/api/src/characters.ts`; a interface usa `CharacterDialog.vue` e `CharactersPanel.vue`. A geometria da mesa continua independente da interface e usa a câmera para converter o ponto do drop em coordenadas do cenário.

## Imagens e permissões

Aparências são salvas em `storage/<proprietário>/<campanha>/outros/`; tokens em `storage/<proprietário>/<campanha>/tokens/`. A API valida MIME real, dimensões e limite por arquivo. Os dois uploads são coordenados: se o segundo falhar, o primeiro é removido. Arquivos substituídos ou removidos são limpos após confirmar a atualização do banco.

As URLs autenticadas incluem o nome versionado do arquivo, permitindo que o canvas descarte a textura anterior ao trocar o token. O PixiJS desenha a imagem de Token preservando sua proporção, com iniciais como alternativa. O painel sempre usa a URL de Aparência. Se uma imagem do mapa falhar ao carregar, a seleção e o movimento continuam disponíveis com as iniciais.

Foram mantidas as permissões de edição existentes: o mestre cadastra, edita e coloca personagens; jogadores veem seus personagens e movem as presenças atribuídas a eles na camada Geral. A API valida o controlador como participante da campanha. Um participante pode ler uma imagem se for o mestre, o controlador do personagem ou se houver uma presença visível no cenário ativo. Presenças exclusivas da camada Mestre não expõem imagens a outros jogadores.

Atualizações de personagem e presenças são transacionais. O posicionamento usa uma trava de leitura no personagem para não inserir metadados antigos durante uma edição concorrente.

## Validações

- `pnpm --filter @vtt/web typecheck`: aprovado.
- `pnpm --filter @vtt/web test`: doze testes de geometria aprovados.
- `pnpm build`: API e frontend compilados.
- `pnpm --filter @vtt/api test:characters`: aprovado. Verifica cadastro sem imagens/sem presença, duas imagens distintas, armazenamento real, múltiplas presenças, troca de cenário, edição sincronizada, permissões, sigilo, uploads inválidos, limpeza de arquivos, exclusão de cenário e compatibilidade dos tokens anteriores.
- `pnpm --filter @vtt/api test:scenes`: aprovado, preservando grids, pastas, camadas e limites.
- `pnpm --filter @vtt/api test:integration`: aprovado, incluindo autenticação, tokens anteriores, SMTP e recuperação de senha.
- Teste completo de navegador aprovado: criar pelo pop-up, mostrar Aparência no painel, adicionar e arrastar o Token em outro cenário, editar sua imagem, remover a presença e manter o cadastro, além de reescolher o mesmo arquivo após remoção e verificar o modal em viewport móvel. Capturas locais: `analise-arquivo/novo-personagem.png` e `analise-arquivo/personagem-no-mapa.png`.

O Chromium usa as bibliotecas temporárias do ambiente, como documentado nas entregas anteriores. Os fixtures usam campanhas e diretórios temporários; as capturas permanecem ignoradas pelo Git.
