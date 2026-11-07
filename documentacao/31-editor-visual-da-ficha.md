# Editor visual da ficha de personagem

## Uso

A aba **Ficha** tem dois modos. No modo de preenchimento, os inputs recebem seus valores. **Editar ficha** permite enviar uma imagem de fundo, adicionar campos, arrastá-los pela alça e editar suas propriedades. **Concluir edição** volta ao preenchimento sem fechar o personagem. **Salvar personagem** persiste tudo; **Cancelar** descarta as alterações locais.

Cada campo tem rótulo, referência, tipo Texto/Número, posição, largura e valor. Por exemplo, rótulo **Força** com referência **for**. A referência é um identificador único na ficha: começa com letra minúscula e aceita letras sem acento, números e sublinhado. Ela fica disponível para a futura configuração da ficha; não há fórmulas, execução de código ou associação automática nesta etapa. A aba Configurações da ficha permanece vazia conforme o escopo anterior.

O arraste mantém o campo dentro da página. Focando a alça, as setas movem um pixel e Shift+setas movem dez pixels. É possível excluir um campo e remover ou substituir o fundo sem apagar os outros campos. O editor inicia em preenchimento ao reabrir o personagem.

A ficha usa uma página em coordenadas próprias, independente do cenário e do zoom da mesa. A área interna tem rolagem horizontal/vertical para trabalhar com uma página maior que a tela. O fundo define a proporção da página ao ser enviado; as posições verticais existentes são ajustadas proporcionalmente. Alturas extremas são limitadas a 300–4000 pixels. A largura padrão é 800 pixels; campos têm altura de 64 pixels e largura ajustável entre 80 e 600 pixels. Rótulos aceitam 60 caracteres e referências, 64. Até 100 campos por personagem e 1.000 caracteres por valor.

## Persistência e acesso

`tabletop_characters` recebe `sheet` (JSONB com versão, dimensões e campos) e `sheet_background_file`. Registros anteriores recebem ficha vazia, sem alterar os demais dados. O salvamento valida a estrutura, os tipos, referências e IDs únicos, valores numéricos e limites da página antes de escrever arquivos. Campos desconhecidos do JSON não são preservados. Omitir a ficha em um cliente antigo mantém o conteúdo atual.

A imagem de fundo segue as regras de PNG/JPEG/WebP até 10 MB e os limites já existentes de resolução; fica na categoria `outros`. Aparência, Token e Fundo da ficha podem ser enviados juntos e são identificados pelo tipo de upload, independentemente da categoria de storage. Substituição/remoção limpa os arquivos anteriores; falhas limpam os uploads novos.

Mestre e controlador editam a ficha conforme as permissões do personagem. O fundo da ficha é exclusivo deles: um token visível ou a apresentação coletiva de um cartão não dá acesso ao fundo, aos campos nem aos valores da ficha.

## Validação

- Compilação da API e checagem de tipos da interface aprovadas.
- Integração de personagens aprovada: ficha padrão, persistência de rótulo/referência/posição/valor, omissão compatível, envio de três imagens distintas, acesso do controlador, remoção de fundo preservando campos, rejeição de referências duplicadas/inválidas, número inválido e posições/tamanhos fora dos limites; sigilo mesmo após apresentação do cartão.
- Teste completo de navegador aprovado, incluindo upload do fundo, criação de Força/for, arraste real, movimento por teclado, preenchimento e reabertura nas sessões de mestre e jogador. Captura local em `analise-arquivo/editor-ficha.png` (ignorada pelo Git).
- Para verificar manualmente: criar/editar um personagem → Ficha → Editar ficha → enviar fundo → Adicionar campo → rótulo Força/referência for → arrastar → Concluir edição → preencher → Salvar personagem. Reabrir e conferir fundo, posição e valor.

Continuação da branch `feat/tokens-e-fichas-de-jogadores` e do PR #3. Alterações locais anteriores de infraestrutura, régua e escala de tokens são preservadas fora desta entrega. Nenhum merge automático.
