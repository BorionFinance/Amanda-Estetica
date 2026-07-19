'use strict';

/**
 * Amanda Estética — Tela de conexão/inicialização (V1.20.0).
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 *
 * Enquanto o AppLifecycle não chegar em READY, é ESTA tela que ocupa #root —
 * nunca o shell do aplicativo com dados possivelmente vazios/antigos. As
 * ações (tentar de novo, trocar de conta, ver dados salvos por último em
 * modo leitura, continuar mesmo com uma queda suspeita) ficam registradas
 * em CONNECTION_SCREEN_HANDLERS e são resolvidas pelo dispatcher central de
 * ações em 04-actions.js.
 */

const CONNECTION_MESSAGES = {
  BOOTING: { title: 'Abrindo o Amanda Estética…', sub: 'Preparando o aplicativo.' },
  AUTHENTICATING: { title: 'Conectando ao Google…', sub: 'Confirmando a conta autorizada da clínica.' },
  CONNECTING_TO_DRIVE: { title: 'Conectando ao Google Drive…', sub: 'Localizando a pasta da clínica.' },
  LOADING_REMOTE_DATABASE: { title: 'Carregando os dados da clínica…', sub: 'Buscando a base mais recente no Google Drive.' },
  VALIDATING_REMOTE_DATABASE: { title: 'Validando a base…', sub: 'Conferindo se os dados estão íntegros antes de abrir.' }
};

function connectionSpinnerHtml() {
  return `<div class="conn-spinner" aria-hidden="true"><span></span><span></span><span></span></div>`;
}

function renderConnectionLoadingScreen(lifecycleState) {
  const info = CONNECTION_MESSAGES[lifecycleState] || CONNECTION_MESSAGES.BOOTING;
  document.body.classList.add('login-page');
  $('#root').innerHTML = `<main class="conn-shell">
    <div class="conn-card">
      <div class="conn-brand"><div class="brand-mark">AB</div><small>Amanda Estética</small></div>
      ${connectionSpinnerHtml()}
      <h1>${esc(info.title)}</h1>
      <p>${esc(info.sub)}</p>
      <button type="button" class="amanda-quiet-link conn-cancel" data-action="cancel-drive-connection">Cancelar e voltar</button>
    </div>
  </main>`;
}

function renderConnectionErrorScreen({ title, message, actions, tone = 'warn' }) {
  document.body.classList.add('login-page');
  const buttons = actions.map(a => `<button type="button" class="btn ${a.primary ? 'primary' : 'secondary'}" data-action="${eattr(a.action)}">${esc(a.label)}</button>`).join('');
  $('#root').innerHTML = `<main class="conn-shell">
    <div class="conn-card conn-card-${tone}">
      <div class="conn-brand"><div class="brand-mark">AB</div><small>Amanda Estética</small></div>
      <div class="conn-status-icon ${tone}">${icon(tone === 'danger' ? 'x' : 'bell', 26)}</div>
      <h1>${esc(title)}</h1>
      <p>${esc(message)}</p>
      <div class="conn-actions">${buttons}</div>
    </div>
  </main>`;
}

function renderRecoveryRequiredScreen(details) {
  document.body.classList.add('login-page');
  const rows = (details.reasons || []).map(reason => {
    const label = window.DataGuard.humanCollectionName(reason.key);
    return `<div class="integrity-row danger"><span>${esc(label)}</span><strong>${reason.before} → ${reason.after}</strong></div>`;
  }).join('');
  $('#root').innerHTML = `<main class="conn-shell">
    <div class="conn-card conn-card-danger conn-card-wide">
      <div class="conn-brand"><div class="brand-mark">AB</div><small>Amanda Estética</small></div>
      <div class="conn-status-icon danger">${icon('bell', 26)}</div>
      <h1>A base do Google Drive parece menor que o esperado</h1>
      <p>Antes de continuar, confira se isto é mesmo o que você esperava. Nenhum dado foi alterado — esta é só uma checagem de segurança.</p>
      <div class="integrity-grid">${rows}</div>
      <div class="conn-actions">
        <button type="button" class="btn secondary" data-action="cancel-drive-connection">Cancelar e sair</button>
        <button type="button" class="btn danger" data-action="confirm-recovery-continue">Já confirmei, abrir mesmo assim</button>
      </div>
    </div>
  </main>`;
}

/**
 * Ponto único chamado sempre que o AppLifecycle muda de estado durante o
 * boot/login. Decide qual tela mostrar — nunca o shell com dados.
 */
function renderLifecycleScreen(lifecycleState, detail, context = {}) {
  if (lifecycleState === 'OFFLINE') {
    const actions = [{ action: 'retry-drive-connection', label: 'Tentar de novo', primary: true }];
    if (context.hasLocalCache) actions.push({ action: 'view-cached-readonly', label: 'Ver dados salvos por último (somente leitura)' });
    actions.push({ action: 'cancel-drive-connection', label: 'Sair' });
    renderConnectionErrorScreen({
      title: 'Sem conexão com o Google Drive',
      message: 'Para proteger os dados da clínica, cadastros e alterações ficam bloqueados até a conexão ser restabelecida.',
      actions, tone: 'warn'
    });
    return;
  }
  if (lifecycleState === 'ACCESS_DENIED') {
    renderConnectionErrorScreen({
      title: 'Conta Google não autorizada',
      message: detail || 'Esta conta Google não está autorizada a acessar o Amanda Estética.',
      actions: [
        { action: 'retry-drive-connection', label: 'Trocar de conta', primary: true },
        { action: 'cancel-drive-connection', label: 'Sair' }
      ],
      tone: 'danger'
    });
    return;
  }
  if (lifecycleState === 'SYNC_ERROR') {
    renderConnectionErrorScreen({
      title: 'Não foi possível carregar a base da clínica',
      message: detail || 'Ocorreu um erro ao conectar com o Google Drive. Nenhum dado foi alterado.',
      actions: [
        { action: 'retry-drive-connection', label: 'Tentar de novo', primary: true },
        { action: 'cancel-drive-connection', label: 'Sair' }
      ],
      tone: 'warn'
    });
    return;
  }
  if (lifecycleState === 'RECOVERY_REQUIRED') {
    renderRecoveryRequiredScreen(context.recovery || { reasons: [] });
    return;
  }
  renderConnectionLoadingScreen(lifecycleState);
}

/* ================================================================
   Orquestração da sessão autoritativa (V1.20.0)
   ================================================================ */

let CONNECTION_ATTEMPT_TOKEN = 0;
let RECOVERY_DECISION_RESOLVE = null;
let LAST_ENTRY_OPTIONS = { interactive: false };

function resolveRecoveryDecision(accepted) {
  const resolve = RECOVERY_DECISION_RESOLVE;
  RECOVERY_DECISION_RESOLVE = null;
  resolve?.(accepted);
}

function cancelConnectionAttempt() {
  CONNECTION_ATTEMPT_TOKEN += 1;
  resolveRecoveryDecision(false);
  sessionStorage.removeItem('amanda_clinica_unlocked');
  window.AppLifecycle?.set('BOOTING');
  renderLogin();
}

async function retryDriveConnection() {
  return await attemptDriveEntryAndEnter(LAST_ENTRY_OPTIONS);
}

function viewCachedReadOnly() {
  document.body.classList.add('read-only-mode');
  toast('Modo somente leitura: sem conexão com o Google Drive. Nenhuma alteração será sincronizada.', 'warn');
  CURRENT_VIEW = (location.hash || '#dashboard').slice(1);
  if (!VIEW_META[CURRENT_VIEW]) CURRENT_VIEW = 'dashboard';
  renderShell();
}

// Classifica o erro em um dos estados de tela: OFFLINE, ACCESS_DENIED ou
// SYNC_ERROR (genérico). Heurística simples e honesta — não finge saber mais
// do que sabe sobre a causa exata de uma falha de rede.
function classifyDriveError(error) {
  if (error?.name === 'DriveGuardError') {
    if (error.code === 'INVALID_REMOTE_SCHEMA') return { state: 'SYNC_ERROR', message: error.message };
    return { state: 'SYNC_ERROR', message: error.message };
  }
  const message = String(error?.message || '');
  if (/cancelad|recusou/i.test(message)) return { state: 'CANCELLED', message };
  if (error?.code === 'ACCESS_DENIED' || /não está autorizada/i.test(message)) return { state: 'ACCESS_DENIED', message };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { state: 'OFFLINE', message };
  if (/failed to fetch|typeerror|net::err|abort|network|falha ao (consultar|criar|salvar|carregar|validar)/i.test(message)) return { state: 'OFFLINE', message };
  return { state: 'SYNC_ERROR', message: message || 'Ocorreu um erro inesperado.' };
}

/**
 * Carrega e valida a base do Google Drive antes de liberar qualquer edição.
 * NUNCA renderiza o shell com dados — quem chama decide o que fazer com
 * `{ ok:true, usedState }` (ex.: completeProfileUnlock renderiza o shell e
 * finaliza a sessão) ou trata `{ ok:false, cancelled, error }`.
 */
async function establishAuthoritativeSession(options = {}) {
  const { interactive = false } = options;
  LAST_ENTRY_OPTIONS = options;
  const lc = window.AppLifecycle;
  const token = ++CONNECTION_ATTEMPT_TOKEN;
  const stillCurrent = () => token === CONNECTION_ATTEMPT_TOKEN;

  lc.resetForReconnect();
  try {
    lc.set('AUTHENTICATING', 'Confirmando a conta Google autorizada.');
    renderLifecycleScreen(lc.get(), lc.getDetail());

    lc.set('CONNECTING_TO_DRIVE');
    renderLifecycleScreen(lc.get(), lc.getDetail());

    lc.set('LOADING_REMOTE_DATABASE');
    renderLifecycleScreen(lc.get(), lc.getDetail());
    const remote = await window.GoogleDriveClinic.loadAuthoritative({ interactive });
    if (!stillCurrent()) return { ok: false, cancelled: true };

    lc.set('VALIDATING_REMOTE_DATABASE');
    renderLifecycleScreen(lc.get(), lc.getDetail());

    if (!remote.exists) {
      data();
      await runIntegrityAudit({ repair: true, save: false });
      recordCloudAuthoritativeMigrationOnce();
      const created = await window.GoogleDriveClinic.saveAuthoritative(STATE, { allowCreate: true, interactive, thorough: true, reason: 'primeira-conexao', alsoBackupNewContent: true });
      if (!stillCurrent()) return { ok: false, cancelled: true };
      lc.markRemoteLoaded(created.revision, created.workspaceId);
      lc.markRemoteValidated();
      lc.setLastKnownGoodCounts(created.counts);
      return { ok: true, usedState: STATE };
    }

    // Proteção extra: mesmo o conteúdo que ACABOU de chegar do Drive é
    // comparado com a última base confiável conhecida NESTE navegador. Pega
    // até o caso em que o problema já está do lado do Drive.
    const baseline = window.GoogleDriveClinic.readLastKnownGoodCounts(remote.workspaceId);
    const check = window.DataGuard.detectSuspiciousDrop(remote.counts, baseline);
    if (check.suspicious) {
      lc.set('RECOVERY_REQUIRED', 'A base do Drive está menor que a última base confiável conhecida.');
      renderLifecycleScreen(lc.get(), lc.getDetail(), { recovery: { reasons: check.reasons } });
      const proceed = await new Promise(resolve => { RECOVERY_DECISION_RESOLVE = resolve; });
      if (!stillCurrent()) return { ok: false, cancelled: true };
      if (!proceed) { cancelConnectionAttempt(); return { ok: false, cancelled: true }; }
    }

    STATE = remote.state;
    data();
    await runIntegrityAudit({ repair: true, save: false });
    recordCloudAuthoritativeMigrationOnce();
    await ClinicStorage.save(STATE);
    lc.markRemoteLoaded(remote.revision, remote.workspaceId);
    lc.markRemoteValidated();
    window.GoogleDriveClinic.recordKnownGoodCounts(remote.workspaceId, remote.counts);
    lc.setLastKnownGoodCounts(remote.counts);
    return { ok: true, usedState: STATE };
  } catch (error) {
    if (!stillCurrent()) return { ok: false, cancelled: true };
    const classified = classifyDriveError(error);
    if (classified.state === 'CANCELLED') {
      cancelConnectionAttempt();
      return { ok: false, cancelled: true };
    }
    console.warn('[AppLifecycle] Falha ao estabelecer sessão autoritativa:', error);
    lc.set(classified.state, classified.message);
    const hasLocalCache = !!(STATE?.dataByProfile && window.DataGuard.collectRecordCounts(STATE).__total > 0);
    renderLifecycleScreen(lc.get(), lc.getDetail(), { hasLocalCache });
    return { ok: false, error };
  }
}

let BORION_INTEROP_STARTED = false;

/**
 * Chamado sempre depois que o shell já foi renderizado com uma base
 * carregada e validada (ou, quando o Drive nunca foi configurado neste
 * navegador, logo depois do boot local). Libera edição, autosave e a
 * publicação da integração com o Borion Finance.
 */
function finalizeSessionReady() {
  const lc = window.AppLifecycle;
  if (!lc) return;
  lc.markHydrationFinished();
  lc.grantWritePermission();
  if (lc.get() !== 'READY') lc.set('READY');
  if (window.GoogleDriveClinic?.isConfigured?.()) {
    window.GoogleDriveClinic.startAutosaveLoop(() => STATE);
    window.GoogleDriveClinic.startLivePollLoop();
  }
  if (window.AmandaBorionInterop && !BORION_INTEROP_STARTED) {
    BORION_INTEROP_STARTED = true;
    window.AmandaBorionInterop.start(() => STATE);
  }
}

/**
 * Usado pela tela de erro/offline para tentar de novo com as mesmas opções
 * da tentativa anterior, e por qualquer fluxo que precise (re)entrar depois
 * de já estar logado (ex.: token expirou no meio da sessão).
 */
async function attemptDriveEntryAndEnter(options = {}) {
  const outcome = await establishAuthoritativeSession(options);
  if (!outcome.ok) return outcome;
  CURRENT_VIEW = (location.hash || '#dashboard').slice(1);
  if (!VIEW_META[CURRENT_VIEW]) CURRENT_VIEW = 'dashboard';
  if (CURRENT_VIEW === 'settings') resetSettingsSection();
  renderShell();
  finalizeSessionReady();
  return outcome;
}
