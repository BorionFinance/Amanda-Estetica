(() => {
  'use strict';

  /**
   * Amanda Estética — Máquina de estados da inicialização.
   *
   * Enquanto o estado não for READY, a aplicação não pode:
   *   - iniciar autosave;
   *   - liberar formulários de cadastro/edição/exclusão;
   *   - executar qualquer gravação no Google Drive ou na pasta local.
   *
   * As travas (`remoteDatabaseLoaded`, `remoteDatabaseValidated`,
   * `initialHydrationFinished`, `writePermissionGranted`) existem para que
   * cada função de salvamento possa reconferir, na hora, se é seguro
   * escrever — nunca basta o estado geral dizer "READY"; a função que
   * salva também verifica as travas de novo antes de agir.
   */

  const STATES = Object.freeze([
    'BOOTING',
    'AUTHENTICATING',
    'CONNECTING_TO_DRIVE',
    'LOADING_REMOTE_DATABASE',
    'VALIDATING_REMOTE_DATABASE',
    'READY',
    'SAVING',
    'SYNC_ERROR',
    'ACCESS_DENIED',
    'OFFLINE',
    'RECOVERY_REQUIRED'
  ]);

  function createLifecycle() {
    let state = 'BOOTING';
    let detail = '';
    let remoteDatabaseLoaded = false;
    let remoteDatabaseValidated = false;
    let initialHydrationFinished = false;
    let writePermissionGranted = false;
    let currentRemoteRevision = null;
    let workspaceId = null;
    let lastKnownGoodCounts = null;
    const listeners = new Set();

    function set(next, nextDetail = '') {
      if (!STATES.includes(next)) throw new Error(`Estado de inicialização desconhecido: "${next}".`);
      state = next;
      detail = nextDetail;
      listeners.forEach(fn => {
        try { fn(state, detail); } catch (error) { console.error('[AppLifecycle] listener falhou:', error); }
      });
    }

    function on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    // Nenhuma gravação pode acontecer sem TODAS as travas liberadas —
    // reconferido dentro da própria função que salva, não só por quem chama.
    function canWrite() {
      return state === 'READY' &&
        remoteDatabaseLoaded &&
        remoteDatabaseValidated &&
        initialHydrationFinished &&
        writePermissionGranted;
    }

    // Levemente mais permissivo que canWrite: permite continuar considerando
    // a sessão "utilizável" enquanto uma gravação anterior está em voo.
    function canEdit() {
      return canWrite() || state === 'SAVING';
    }

    return {
      STATES,
      set,
      on,
      get: () => state,
      getDetail: () => detail,
      canWrite,
      canEdit,
      markRemoteLoaded(revision, ws) {
        remoteDatabaseLoaded = true;
        if (revision !== undefined) currentRemoteRevision = revision;
        if (ws) workspaceId = ws;
      },
      markRemoteValidated() { remoteDatabaseValidated = true; },
      markHydrationFinished() { initialHydrationFinished = true; },
      grantWritePermission() { writePermissionGranted = true; },
      revokeWritePermission() { writePermissionGranted = false; },
      resetForReconnect() {
        remoteDatabaseLoaded = false;
        remoteDatabaseValidated = false;
        initialHydrationFinished = false;
        writePermissionGranted = false;
      },
      getRevision: () => currentRemoteRevision,
      setRevision(revision) { currentRemoteRevision = revision; },
      getWorkspaceId: () => workspaceId,
      setWorkspaceId(ws) { workspaceId = ws; },
      getLastKnownGoodCounts: () => lastKnownGoodCounts,
      setLastKnownGoodCounts(counts) { lastKnownGoodCounts = counts; }
    };
  }

  const api = { STATES, createLifecycle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AppLifecycleFactory = api;
})();
