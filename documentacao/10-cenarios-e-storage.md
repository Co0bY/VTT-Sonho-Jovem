# Cenários, escala e armazenamento de imagens

## Entrega

O menu **Cenários** substitui a configuração de cenário único no painel da mesa. O mestre pode listar os cenários da campanha, criar novos, selecionar um para editar e ativá-lo com **Exibir na mesa**. Preparar um cenário não altera automaticamente a tela dos jogadores.

Cada cenário tem nome, tamanho visual da célula em pixels, distância por quadrado, unidade, visibilidade do grid, encaixe e imagem de fundo. Unidades disponíveis: milímetros, centímetros, metros, quilômetros, polegadas, pés/feet, jardas e milhas. A régua multiplica a distância em células pelo valor configurado e mostra a unidade correspondente: uma célula com escala 5 ft mede 5 ft; alterar para 100 cm passa a medir 100 cm. A troca de unidade redefine a escala declarada, sem converter automaticamente o valor numérico.

Os tokens pertencem ao cenário em que foram criados. Trocar o cenário ativo não apaga os tokens do anterior. O chat continua pertencendo à mesa. Jogadores recebem somente o cenário em exibição e não têm acesso às imagens dos cenários preparados pelo mestre.

## Storage

Criamos `storage/.gitignore` com `*` e `!.gitignore`. Todo upload é ignorado pelo Git, mantendo apenas o arquivo de regras versionável. O armazenamento padrão resolve a raiz do repositório a partir do caminho da API, sem depender do diretório de execução. `STORAGE_ROOT` permite usar outro caminho, inclusive um diretório temporário nos testes.

```text
storage/
├── .gitignore
└── <UUID do mestre proprietário>/
    └── <UUID da mesa>/
        ├── cenarios/
        │   └── <UUID gerado pelo servidor>.png
        ├── tokens/
        └── outros/
```

As categorias são criadas no primeiro upload da mesa. O identificador usado é o do proprietário da mesa, não um caminho enviado pelo navegador. A categoria `tokens` está preparada para o upload futuro de imagens de tokens; esse recurso visual ainda não foi implementado. Nome, escala e vínculo entre cenário e arquivo ficam no PostgreSQL, enquanto os bytes da imagem ficam no storage. A persistência completa depende de conservar ambos.

## Upload e leitura

- Limite inicial de **10 MB por imagem**, implementado como 10 × 1024 × 1024 bytes. O formulário e o interceptor multipart do servidor validam o limite; requisições acima dele são recusadas com HTTP 413.
- PNG, JPEG e WebP, com formato e dimensões verificados a partir dos bytes usando `image-size`, sem confiar apenas no nome do arquivo. Arquivos com conteúdo ou MIME incompatível são recusados.
- Limites de decodificação: 8192 pixels por lado e 32 megapixels, para controlar o tamanho da textura no navegador. O formulário informa esses limites.
- Os nomes físicos são UUIDs gerados pelo servidor; o nome original não compõe o caminho de gravação.
- Upload e configuração exigem papel de mestre. A imagem é lida por rota autenticada da API; não expomos a pasta como diretório público. Participantes só podem ler a imagem do cenário ativo; o mestre também pode consultar as imagens dos cenários preparados.
- Substituir um fundo atualiza a referência no banco e remove o arquivo anterior dessa imagem. Falhas na conexão ou na atualização do banco limpam o novo arquivo. Não há exclusão geral de arquivos/campanhas por esta entrega.
- PixiJS carrega a imagem por requisição autenticada, preserva a proporção e a centraliza no tabuleiro de 3200 × 2200 pixels, abaixo do grid e dos tokens. Margens podem aparecer quando a proporção da imagem difere da do tabuleiro.

## Migração e organização

`database.ts` aplica uma migração transacional, sob o lock de inicialização já existente. A chave do cenário deixa de ser a campanha e passa a ser seu próprio UUID. O cenário anterior é preservado, com nome inicial **Cenário principal**, distância 1,5 m e os tokens vinculados a ele. Uma tabela separada registra qual cenário está ativo por campanha; chaves compostas impedem associar um cenário/token à campanha errada. A migração é aplicada apenas quando a coluna identificadora do cenário ainda não existe.

`scenes.ts` concentra busca, configuração e apresentação dos cenários. `storage.ts` centraliza os caminhos, a validação de imagem e o limite compartilhável com o futuro upload de tokens. `ScenesMenu.vue` reúne lista e editor; a régua continua em `geometry.ts`, recebendo a escala como parâmetro.

Referências consultadas: [upload no NestJS](https://docs.nestjs.com/techniques/file-upload) e [recursos de imagem no PixiJS](https://pixijs.com/8.x/guides/components/assets).

## Como verificar

1. Inicie o ambiente no Ubuntu/WSL com `nvm use`, `pnpm install --frozen-lockfile`, `docker compose up -d` e `pnpm dev`.
2. Entre em uma mesa como mestre e abra **Cenários**.
3. Crie um cenário, selecione-o, configure por exemplo **5** em **Distância por quadrado** e **Pés / feet (ft)** na unidade. Salve.
4. Selecione uma imagem de até 10 MB no campo de fundo. O upload salva imediatamente, independentemente do botão de configuração.
5. Use **Exibir na mesa**. A imagem e a escala passam a valer para todos os participantes, acompanhando o polling de dois segundos.
6. Use a régua entre pontos separados por uma célula: o resultado deve mostrar 5 ft. Confira o arquivo em `storage/<mestre>/<mesa>/cenarios/`.
7. Volte ao cenário anterior e confirme que os tokens continuam nele. Recarregue a página para validar a persistência.
8. Como jogador, confirme que não é possível criar/editar/ativar cenários ou enviar imagens. Apenas o cenário exibido aparece para o jogador.

## Validações

- `pnpm build` e `pnpm --filter @vtt/web typecheck`.
- `pnpm --filter @vtt/web test`: geometria e régua com escalas configuráveis.
- `pnpm --filter @vtt/api test:integration`: regressão de autenticação, e-mail, recuperação, mesa, tokens, chat e dados após a migração.
- `pnpm --filter @vtt/api test:scenes`: criação sem ativação imediata, escalas/unidades válidas e inválidas, isolamento dos tokens, permissões de mestre/jogador/não participante, envio multipart real, rejeição acima de 10 MB, formato/MIME inválidos, armazenamento por proprietário/mesa/categoria, substituição do arquivo e leitura autenticada. Usa pasta temporária em `/tmp` e limpa apenas os próprios fixtures.
- `pnpm --filter @vtt/api test:browser`: criação/edição de cenário pela interface, upload de PNG, renderização no PixiJS e ativação compartilhada entre duas sessões, além das verificações anteriores de tokens/chat e layout mobile. A biblioteca temporária do Chromium nesta sessão usa o mesmo `LD_LIBRARY_PATH` documentado em `09-prototipo-mesa-virtual.md`.
- `git check-ignore` confirma que mapas e imagens de tokens dentro de `storage/` são ignorados. O único arquivo da pasta oferecido para versionamento é `.gitignore`.
