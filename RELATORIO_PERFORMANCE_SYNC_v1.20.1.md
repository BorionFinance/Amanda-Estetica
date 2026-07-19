# Amanda Estética Clínica v1.20.1 — Sincronização mais rápida (fotos e autosave)

## O que você reportou

Uma foto levando 1-2 minutos para sincronizar, e precisar esperar terminar antes de fechar o app (senão "volta pra onde tava").

## Causa — e parte da culpa foi minha, não só do Google Drive

A correção v1.20.0 (proteção contra sobrescrita) fez o autosave passar a:

1. baixar o arquivo inteiro do Drive para conferir revisão/contagem antes de gravar;
2. copiar esse conteúdo inteiro para um snapshot de segurança;
3. subir o conteúdo novo;
4. baixar de novo para conferir se gravou certo.

Isso é **4 transferências do arquivo inteiro por salvamento** — e como as fotos ("Fotos antes e depois") são guardadas em qualidade original, como texto base64 dentro desse mesmo arquivo único, cada foto nova deixa esse arquivo maior, e cada uma dessas 4 transferências fica mais lenta. Antes da v1.20.0 era só 1 transferência (a gravação em si); a correção de segurança multiplicou isso por 4 sem eu perceber o efeito no tempo de espera. Isso é o motivo real do "demorou bastante".

## Correção (v1.20.1)

- **Revisão, workspace e contagem de registros agora também ficam gravados como metadados do próprio arquivo no Drive** (`appProperties`), junto com o conteúdo, na mesma requisição. Isso permite conferir se é seguro salvar consultando só os metadados — sem baixar o arquivo inteiro.
- **O autosave de rotina (o que roda ~2 segundos depois de qualquer edição, incluindo adicionar uma foto) não baixa mais o conteúdo inteiro nem tira snapshot antes de gravar.** Ele confere a segurança pelos metadados (rápido) e sobe o conteúdo novo — só isso. As mesmas proteções contra base vazia/reduzida continuam ativas o tempo todo, só ficaram mais rápidas de checar.
- **Snapshot do conteúdo anterior e releitura de confirmação continuam acontecendo**, só que agora reservados para os salvamentos explícitos e mais raros: "Salvar agora", conectar pela primeira vez, "Sincronizar", restaurar backup. Nesses, a espera extra faz sentido porque são ações pontuais, não uma foto atrás da outra.
- 2 testes novos comprovam isso automaticamente: um confirma que uma gravação de rotina não baixa o conteúdo completo em nenhum momento; outro confirma que a proteção contra base vazia continua funcionando mesmo sem essa etapa extra. 31 testes automatizados no total, todos passando.

Isso deveria trazer o tempo de espera de volta para perto do que era antes da v1.20.0 — o autosave passou a fazer, na prática, a mesma 1 transferência de antes (mais uma consulta de metadados, bem menor).

## O que ainda pesa, e é uma decisão sua

O tamanho da PRÓPRIA foto continua sendo o maior fator: ela é guardada em resolução e qualidade originais, sem nenhuma compressão. Uma foto de celular moderno pode passar de 5-10 MB antes mesmo de virar base64 (que ainda deixa o texto uns 33% maior). Isso não tem como ficar rápido só ajustando o número de idas e vindas ao Drive — o arquivo em si precisa subir, e isso depende do upload da internet do local.

Se quiser, posso adicionar uma compressão/redimensionamento leve antes de guardar a foto (ex.: limitar a maior dimensão a algo como 2000-2400px e ajustar a qualidade do JPEG), o que costuma cortar o tamanho em 70-90% sem perda visível em tela — inclusive para comparar antes/depois de perto. Isso é uma escolha sua sobre qualidade x velocidade, por isso não fiz sozinho.

## Versão

- `index.html`, `sw.js`, `manifest.json`: **v1.20.1**.
- Cache do Service Worker: `amanda-clinica-v1.20.1-fast-sync`.
- Arquivos alterados nesta rodada: `js/services/google-drive.js`, `js/services/sync-backup.js`, `js/core/10-connection-lifecycle.js`, `js/core/05-events-boot.js` (só a versão do registro do Service Worker), `index.html`, `sw.js`, `manifest.json`, mais os testes.
