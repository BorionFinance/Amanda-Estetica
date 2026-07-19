# Amanda Estética Clínica v1.20.0 — Proteção de Dados (Google Drive, cache local e sobrescrita)

## Base utilizada

- Amanda Estética Clínica v1.19.1 — Fix Piscar Assinatura.
- Não houve alteração no formato visual, nas telas de cadastro, prontuários, agenda, estoque ou financeiro.
- O formato de `STATE` ganhou três campos novos e aditivos (`workspaceId`, `databaseRevision`, `recordCounts`, `dataHash`) — nenhum campo existente foi removido ou renomeado.

## Causa raiz encontrada

O aplicativo tinha **dois problemas independentes**, e os dois precisavam ser corrigidos juntos:

### 1. O boot nunca conferia o Google Drive antes de liberar edição

`boot()` (`js/core/05-events-boot.js`) carregava o estado do IndexedDB/`localStorage` deste navegador e, se estivesse vazio ou ausente, caía direto no seed vazio (`AMANDA_INITIAL_DATA`). Em seguida, se a sessão já estivesse "desbloqueada", o app renderizava o shell inteiro e ligava o autosave — **sem nunca ter consultado o Google Drive**. Um navegador limpo, um celular reconfigurado ou um IndexedDB corrompido abriam o app com zero clientes, zero agendamentos, zero lançamentos, como se fosse uma base nova e legítima.

### 2. O salvamento no Google Drive era incondicional

Esse era o ponto mais grave. `scheduleGoogleDriveSave()` (`js/core/01-state-utils.js`), chamada automaticamente ~1,9 segundo depois de **qualquer** edição, executava:

```js
await GoogleDriveClinic.save(STATE);
```

E `GoogleDriveClinic.save()` (`js/services/google-drive.js`) ia direto ao arquivo principal no Drive e o sobrescrevia — sem comparar contagem de registros, sem checar revisão, sem checar se o arquivo já existia com dados. `manualSave()`, `connectGoogle()` e o Ctrl+S caíam no mesmo caminho.

A única proteção existente era o método `sync()`, usado no login com Google, que comparava `updatedAt` (data/hora) do lado local com o remoto. Essa proteção **não segurava o caso real**: `ClinicStorage.save()` grava `state.updatedAt = new Date().toISOString()` a cada salvamento local — inclusive a auditoria automática de integridade que roda no próprio `boot()`. Ou seja, bastava o app abrir (mesmo sem nenhuma ação da pessoa) para o `updatedAt` local virar "agora", parecendo mais recente que a base real do Drive salva minutos ou horas antes. A entrada "Entrar sem login" nem chamava `sync()` — pulava direto para o shell editável com o que quer que estivesse em memória.

**Nenhuma dessas duas falhas dependia de bug de rede ou coincidência rara** — bastava abrir o app com o cache local vazio (o que já aconteceu de verdade, segundo o relato) e fazer qualquer edição para a base real do Drive começar a ser substituída.

## O que foi corrigido

### Google Drive passou a ser a fonte oficial da verdade

- O cache local (IndexedDB/`localStorage`) deixou de ser suficiente para liberar edição. Ele continua existindo — para abrir mais rápido, para os backups locais e para o modo "ver dados salvos por último (somente leitura)" quando o Drive está inacessível — mas nunca mais decide sozinho o que vai para o Drive.
- Sempre que o Google Drive já foi conectado neste navegador, **os dois pontos de entrada da tela de login** ("Entrar com Google" e "Entrar sem login") agora passam pela mesma validação contra o Drive antes de liberar qualquer tela editável. "Entrar sem login" continua existindo como atalho rápido, mas roda a validação de forma silenciosa (sem popup) em vez de pular direto para o shell.
- Uma sessão retomada (F5 no meio do uso) também revalida contra o Drive — não confia apenas na flag de sessão salva no navegador.

### Nova máquina de estados de inicialização

Arquivo novo `js/services/app-lifecycle.js`, com os 11 estados pedidos: `BOOTING`, `AUTHENTICATING`, `CONNECTING_TO_DRIVE`, `LOADING_REMOTE_DATABASE`, `VALIDATING_REMOTE_DATABASE`, `READY`, `SAVING`, `SYNC_ERROR`, `ACCESS_DENIED`, `OFFLINE`, `RECOVERY_REQUIRED`.

Quatro travas — `remoteDatabaseLoaded`, `remoteDatabaseValidated`, `initialHydrationFinished`, `writePermissionGranted` — precisam **todas** estar ligadas, e o estado precisa ser `READY`, para que `canWrite()` retorne verdadeiro. Cada função de salvamento reconfere essas travas na hora, não confia em quem chamou já ter checado.

Enquanto o estado não é `READY`, uma tela de conexão ocupa a tela inteira (`js/core/10-connection-lifecycle.js` + `css/190-connection-lifecycle.css`) — nunca o shell com dados. Estados de erro mostram opções seguras: tentar de novo, trocar de conta, ver dados salvos por último em modo leitura, ou sair.

### Controle de revisão substitui a comparação por data/hora

Cada gravação do arquivo principal agora carrega `databaseRevision` (um número que sobe 1 a cada gravação bem-sucedida) e `workspaceId` (identificador fixo da base). Antes de gravar, o app relê a revisão atual do Drive e compara com a revisão que a sessão efetivamente carregou:

- Se a sessão nunca carregou nenhuma revisão confirmada, **o Drive sempre vence** — nunca o contrário.
- Se outra aba/dispositivo já gravou uma revisão mais nova, a gravação é recusada (`STALE_REVISION`) em vez de sobrescrever por cima.
- Se o `workspaceId` do conteúdo não bate com o da pasta, a gravação é recusada (`WORKSPACE_MISMATCH`).

Isso substitui — e é bem mais confiável do que — a comparação por `updatedAt` que causava o problema relatado.

### Proteção contra base zerada ou reduzida

Antes de qualquer gravação no arquivo principal (Drive ou pasta local), a contagem de clientes, agendamentos, atendimentos, produtos, descartáveis, protocolos, pacotes, anamneses, consentimentos, fotos e lançamentos financeiros da gravação é comparada com a base atual:

- Qualquer coleção que tinha registros e cairia para zero → gravação bloqueada.
- Qualquer coleção com 5+ registros que cairia mais de 40% numa única gravação → gravação bloqueada.
- Exclusões legítimas e pequenas continuam funcionando normalmente (o limite é sobre quedas bruscas, não sobre excluir alguns registros de propósito).

Mensagem mostrada quando bloqueia (bem próxima da sugerida no pedido):

> "Salvamento bloqueado por segurança: clientes: 120 → 0 · agendamentos: 840 → 0 · lançamentos financeiros: 1320 → 0. Os dados desta sessão parecem vazios ou incompletos, enquanto o Google Drive tem uma base maior. Nenhuma informação foi substituída."

A mesma proteção roda mesmo **depois** de carregar o Drive: a contagem que acabou de chegar é comparada com a última base confiável conhecida deste navegador. Se o próprio arquivo do Drive parecer suspeito (por exemplo, se ele já tiver sido corrompido por uma sessão anterior, antes desta correção existir), a tela de **Recuperação necessária** aparece mostrando a comparação antes de deixar continuar — nunca abre silenciosamente.

### Escrita segura com snapshot e conferência

Toda gravação do arquivo principal no Drive agora segue esta ordem: reconferir revisão remota → checar contagem suspeita → **gravar uma cópia do conteúdo anterior** na pasta `Backups` (rodízio de 30 arquivos `prewrite-N.json`, sobrescrevendo o mais antigo) → gravar o novo conteúdo → **reler o que foi gravado** e confirmar que a revisão bate. A mesma checagem de contagem suspeita foi adicionada também ao caminho da pasta local (File System Access API), que tinha exatamente o mesmo risco que o Drive antes desta correção.

### Recuperação — navegar e restaurar backups do Google Drive

Nova tela em Configurações → Backup manual → **"Backups no Google Drive"**: lista os arquivos dos três rodízios (autosave, forcesave, prewrite) com data. Ao escolher um, mostra a contagem de registros antes de restaurar e pede confirmação. Restaurar cria automaticamente um backup de segurança do que está no Drive no momento, e a base restaurada assume a revisão seguinte (não sobrescreve silenciosamente por baixo do controle de revisão).

### Migração do cache antigo

Na primeira abertura desta versão, uma marca (`amanda_cloud_authoritative_migration_v1`) é gravada uma única vez no `localStorage`, e um registro aparece na auditoria interna do app ("Proteção de dados atualizada (V1.20.0)"). O cache antigo não é apagado — só deixou de ser tratado como base principal.

### Service Worker

O `sw.js` já ignorava chamadas de outra origem (`request.url.startsWith(self.location.origin)`), então as chamadas à API do Google Drive nunca foram cacheadas — esse ponto já estava correto antes desta correção. Foram adicionados apenas os arquivos novos à lista de pré-cache e a versão do cache foi trocada (`amanda-clinica-v1.20.0-data-protection`), o que já força a limpeza do cache antigo no `activate` (mecanismo que já existia).

## O que continua local (nunca decide sozinho o que vai para o Drive)

- Preferências visuais (tema, modo de interface, posição do FAB, filtros).
- Cópia de recuperação em IndexedDB/`localStorage` (renderização rápida e apoio para o modo somente leitura).
- Backups locais criados manualmente (inalterado).
- Token de autenticação do Google e cache de IDs de pasta/arquivo (necessários pela própria biblioteca do Google).

## Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `js/services/data-guard.js` *(novo)* | Contagem de registros, detecção de queda suspeita, hash estável. Módulo puro, testado em Node. |
| `js/services/app-lifecycle.js` *(novo)* | Máquina de estados de inicialização e as travas de gravação. |
| `js/core/10-connection-lifecycle.js` *(novo)* | Tela de conexão/erro/recuperação e orquestração da sessão autoritativa. |
| `css/190-connection-lifecycle.css` *(novo)* | Estilo da tela de conexão e do modo somente leitura. |
| `js/services/google-drive.js` | `saveAuthoritative`/`loadAuthoritative` (núcleo da correção), revisão, workspace, snapshot, listagem de backups. `save`/`sync`/autosave rotativo passaram a usar o novo pipeline. |
| `js/services/storage.js` | Mesma checagem de queda suspeita aplicada à pasta local (File System Access API). |
| `js/services/sync-backup.js` | `connectGoogle` passou a usar `sync()` em vez de `save()` direto (evita sobrescrever uma pasta que já tinha base). Nova tela de backups do Drive. |
| `js/core/01-state-utils.js` | `persist()` só agenda sincronização remota se `AppLifecycle.canWrite()`. Mensagens claras para os novos códigos de erro. |
| `js/core/04-actions.js` | Login com Google e "Entrar sem login" passam pela validação do Drive antes de liberar o shell. Novas ações da tela de conexão. |
| `js/core/05-events-boot.js` | `boot()` reescrito: Drive é a fonte da verdade quando já configurado; cria o `AppLifecycle`. |
| `js/views/03-finance-settings.js` | Botão "Backups no Google Drive" em Configurações. |
| `index.html` / `sw.js` / `manifest.json` | Novos arquivos incluídos, versões atualizadas para 1.20.0. |

## Testes automatizados (rodam de verdade, incluídos em `/tests`)

Não tenho acesso de rede às APIs do Google a partir daqui, então não dá para testar o OAuth real e o Picker do Drive neste ambiente — isso só um teste manual no seu navegador consegue cobrir (checklist abaixo). O que **dá** para testar de verdade, e foi testado, rodando o código de produção de verdade (não uma reimplementação):

- **21 testes de lógica pura** (`data-guard.test.js`, `app-lifecycle.test.js`): contagem de registros, detecção de queda suspeita (zerada e >40%), tolerância a exclusões pequenas, hash estável, todas as transições e travas da máquina de estados.
- **8 testes de ponta a ponta** (`google-drive-guard.simulation.test.js`) rodando o `js/services/google-drive.js` real dentro de um sandbox Node (`vm`), contra um Google Drive falso em memória:
  1. Primeira sincronização cria a base com revisão 1.
  2. **Reprodução exata do incidente relatado**: sessão nova com base local vazia tenta gravar por cima de uma base do Drive com 120 clientes/840 agendamentos/1320 lançamentos → gravação bloqueada, base do Drive continua intacta.
  3. Sessão nova (sem revisão conhecida) sempre prefere o remoto.
  4. Revisão obsoleta (duas abas) bloqueia a segunda gravação.
  5. `workspaceId` incompatível bloqueia a gravação.
  6. Exclusão pequena e legítima é permitida normalmente.
  7. Gravação cria snapshot do conteúdo anterior antes de substituir.
  8. Falha de rede durante a gravação não deixa a revisão remota mudar.

Para rodar: `node --test tests/*.test.js` (Node 18+, sem dependências externas).

## Checklist de testes manuais (precisam do seu navegador/conta Google — não pude rodar aqui)

- [ ] **Navegador com cache vazio, Drive com dados**: limpar dados do site, abrir o app, entrar com Google → confirmar que os dados do Drive aparecem e nenhuma base vazia é enviada.
- [ ] **"Entrar sem login" com Drive já configurado**: confirmar que a validação roda (mesmo sem popup) antes de liberar edição.
- [ ] **Duas abas**: editar em uma, tentar salvar pela outra com a revisão antiga → confirmar bloqueio e mensagem clara.
- [ ] **Sem internet**: abrir o app offline com Drive configurado → confirmar tela de "sem conexão", nenhuma edição liberada, opção de ver dados salvos por último em modo leitura.
- [ ] **Celular da Amanda**: repetir o cenário que gerou o alerta original (Syncthing/cache limpo) e confirmar que a tela de conexão aparece em vez do app abrir zerado.
- [ ] **Backups no Google Drive**: abrir Configurações → Backups no Google Drive, pré-visualizar um arquivo e restaurar.
- [ ] **Atualização do Service Worker**: instalar a versão anterior, publicar esta, confirmar que o cache antigo é removido (comportamento já existente, só validar que continua funcionando com os arquivos novos).

## Versão

- `index.html`, `sw.js`, `manifest.json`: **v1.20.0**.
- Cache do Service Worker: `amanda-clinica-v1.20.0-data-protection`.
