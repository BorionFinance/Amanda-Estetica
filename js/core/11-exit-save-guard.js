'use strict';

/**
 * Amanda Estética v1.23.1 — Guardião de saída (mesma ideia do ExitSaveGuard do
 * Borion Finance).
 *
 * O problema real que isto resolve
 * --------------------------------
 * O app é cloud-only: o dado só existe de verdade depois que o Google Drive
 * confirma a gravação. O salvamento normal tem um debounce curto (180 ms) e a
 * chamada de rede leva mais um tanto. No celular, quando a Amanda troca de app
 * ou fecha o PWA logo depois de mexer em alguma coisa, o navegador congela a
 * página: o timer do debounce nunca dispara e a requisição em voo é cortada.
 * Resultado prático — o famoso "fantasma": ela exclui algo, atualiza, e o item
 * volta; ou cadastra algo, atualiza, e some. Não é a sincronização "voltando
 * atrás": é a alteração que nunca chegou a sair do aparelho.
 *
 * O que este módulo faz
 * ---------------------
 * Nos momentos em que o navegador ainda deixa código rodar antes de congelar a
 * página (`visibilitychange` -> hidden, `pagehide`, `freeze`, `blur` no celular
 * e `beforeunload` no desktop), dispara IMEDIATAMENTE a gravação pendente, sem
 * esperar o debounce (window.flushGoogleDriveSaveNow, definido em
 * 01-state-utils.js).
 *
 * O que este módulo NÃO faz
 * -------------------------
 * Não mostra o diálogo nativo "Sair do site?" — o pedido foi justamente poder
 * fechar na hora, sem atrito. Também não guarda cópia local dos dados clínicos:
 * o app é cloud-only por decisão de segurança e isso continua valendo.
 */

(() => {
  'use strict';

  let lastFlushAt = 0;
  const MIN_GAP_MS = 250;

  function hasPendingWork() {
    try {
      if (typeof window.hasPendingGoogleDriveSave === 'function' && window.hasPendingGoogleDriveSave()) return true;
    } catch (_) { }
    return false;
  }

  function flush(reason) {
    try {
      if (!hasPendingWork()) return false;
      const now = Date.now();
      if (now - lastFlushAt < MIN_GAP_MS) return false;
      lastFlushAt = now;
      if (typeof window.flushGoogleDriveSaveNow !== 'function') return false;
      window.flushGoogleDriveSaveNow(reason);
      return true;
    } catch (error) {
      console.warn('[Amanda Clínica] Guardião de saída não conseguiu forçar o salvamento:', error);
      return false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('segundo-plano');
  });

  // No celular o `pagehide` costuma ser o último evento confiável antes de o
  // sistema descartar a página do PWA.
  window.addEventListener('pagehide', () => flush('pagehide'));

  // Chrome/Android dispara `freeze` ao congelar uma aba em segundo plano.
  document.addEventListener('freeze', () => flush('freeze'), { capture: true });

  // Fechar/atualizar no desktop: envia e sai, sem diálogo de confirmação.
  window.addEventListener('beforeunload', () => { flush('beforeunload'); });

  // Trocar de app no celular nem sempre gera visibilitychange na hora; o blur
  // da janela chega antes em vários navegadores.
  window.addEventListener('blur', () => {
    if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) flush('blur-mobile');
  });

  window.AmandaExitSaveGuard = { flush, hasPendingWork };
})();
