# Amanda Estética Clínica v1.21.0 — Atualização ao vivo entre dispositivos + indicador de envio de foto

## O que você pediu

O mesmo "ecossistema" que funcionou no teste de fogo do Borion (celular, tablet e computador todos se atualizando sozinhos): editar em um aparelho e os outros, já abertos, se atualizarem sozinhos em segundos — sem precisar sair do Amanda Estética e entrar de novo. E, como fotos demoram mais para sincronizar (sem compressão, qualidade original), uma barrinha/animação visível mostrando que o envio ainda está em andamento.

## Como funciona agora

- A cada **6 segundos**, se este dispositivo não tem nenhuma gravação local pendente, ele confere só a **revisão** do arquivo principal no Google Drive (a mesma checagem de metadados — `appProperties` — que a v1.20.1 já usa para o autosave rápido; nenhum conteúdo é baixado à toa).
- Se a revisão mudou — sinal de que outro dispositivo salvou —, busca o conteúdo novo e atualiza a tela sozinho: cliente, protocolo, agenda, atendimento, produto/estoque e financeiro aparecem atualizados sem sair do app.
- Confere também **na hora** que você volta pro app (troca de aba, tira do celular do segundo plano), sem esperar os 6 segundos.
- Aparece um aviso pequeno: "Atualizado com uma alteração feita em outro dispositivo."

### As mesmas travas de segurança do Borion, adaptadas aqui

- **Nunca roda com uma gravação sua ainda não confirmada no Drive** — só depois que ela termina (com sucesso ou falha) é que o live-poll volta a rodar. Isso evita que a atualização automática apague por engano algo que você acabou de salvar antes de ele sincronizar.
- **Nunca aplica em cima de um modal aberto, do diálogo de confirmação, do seletor de data/hora ou de um campo em edição.** Se pintar uma atualização nesse momento, ela é **adiada**, não descartada — a checagem seguinte, poucos segundos depois, aplica sozinha assim que você fechar o modal ou parar de digitar.
- **Nunca roda com a aba em segundo plano** (economiza bateria no celular).
- **Nunca roda antes da sessão estar totalmente pronta e validada** (mesma trava `AppLifecycle.canWrite()` da correção de segurança anterior) — a atualização ao vivo é só mais uma camada em cima da proteção que já existia, não substitui nada dela.

## Fotos: indicador visual de envio

Fotos continuam sendo guardadas em qualidade original (sem compressão — igual já era), então continuam sendo a parte mais pesada para sincronizar. Agora, ao salvar uma foto nova, aparece uma barrinha na parte de baixo da tela:

1. **"Lendo a imagem…"** com uma barra de progresso real (baseada no tamanho do arquivo) enquanto o navegador processa o arquivo.
2. **"Enviando foto para o Google Drive…"** com uma animação contínua enquanto o envio de verdade acontece.
3. **"Foto enviada ao Google Drive."** (verde) quando confirma, ou um aviso claro se não conseguir agora (nesse caso ela tenta de novo sozinha em instantes — você pode continuar usando o app normalmente).

O modal fecha na hora (você não fica preso esperando), mas a barrinha continua visível embaixo até o envio realmente terminar — é o sinal de "ainda não fechei o app" que você pediu. Para tudo o mais (cliente, protocolo, agenda, atendimento, produto, financeiro) o salvamento continua **silencioso e em segundo plano**, como já era.

## Por que isso não arrisca a proteção contra perda de dados

A atualização ao vivo usa exatamente o mesmo pipeline protegido da v1.20.0/v1.20.1 — ela só CHAMA `loadAuthoritative()` (a mesma função que o boot usa), então herda automaticamente: validação de schema, contagem de registros, e a revisão numérica. Não é um caminho novo e separado — é o mesmo caminho seguro, só verificado com mais frequência.

## Testado

`tests/google-drive-live-update.test.js` — 8 casos rodando o `js/services/google-drive.js` real contra um Google Drive falso em memória: nada muda quando não há novidade; busca e aplica quando outro "dispositivo" salvou; sessão sem revisão conhecida não faz nada; gravação local pendente bloqueia; aba em segundo plano não faz nada; modal aberto adia (sem descartar); campo em edição adia; nunca roda antes da sessão estar pronta. Mais um teste de ponta a ponta simulando o formulário de foto de verdade (arquivo real, cliente real, salvamento completo) confirmando que o indicador aparece e mostra a mensagem certa. 39 testes automatizados no total, todos passando, incluindo os 31 que já existiam.

## Checklist manual (precisa de dois dispositivos reais — não pude simular aqui)

- [ ] Editar um cliente/protocolo/agendamento no computador com o celular já aberto no Amanda Estética → confirmar que aparece sozinho em até ~6 segundos.
- [ ] Repetir trocando quem edita e quem recebe (celular → computador).
- [ ] Adicionar uma foto e observar a barrinha até "Foto enviada ao Google Drive.".
- [ ] Abrir um formulário de cadastro num dispositivo enquanto outro salva algo — confirmar que a tela não muda debaixo do formulário aberto, e que atualiza assim que fechar.

## Versão

- `index.html`, `sw.js`, `manifest.json`: **v1.21.0**.
- Cache do Service Worker: `amanda-clinica-v1.21.0-live-sync`.

## Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `js/services/google-drive.js` | Novo `startLivePollLoop`/`stopLivePollLoop`/`checkForRemoteUpdate`. Checa metadados a cada 6s e aplica a atualização com segurança. |
| `js/core/01-state-utils.js` | Novo `hasPendingGoogleDriveSave()` — rastreia se existe uma gravação local ainda não resolvida, usado pelo live-poll. |
| `js/core/10-connection-lifecycle.js` | Inicia o live-poll junto do autosave quando a sessão fica pronta (`finalizeSessionReady`). |
| `js/core/04-actions.js` | Para o live-poll ao bloquear o app (`lock-app`), igual já acontecia com o autosave. |
| `js/forms/02-records-media.js` | Indicador visual de envio de foto (`showPhotoUploadProgress`), progresso real de leitura do arquivo, e acompanhamento do envio ao Drive. |
| `css/200-photo-upload-progress.css` *(novo)* | Estilo da barrinha de envio de foto. |
| `index.html` / `sw.js` / `manifest.json` | Novo arquivo incluído, versões atualizadas para 1.21.0. |
