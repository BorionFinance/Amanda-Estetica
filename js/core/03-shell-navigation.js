'use strict';

/**
 * Amanda Estética — Tela de bloqueio, shell, cabeçalhos, navegação, transições e relógio.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function renderLogin(animationClass = '') {
    const profile = activeProfile();
    const hasPin = !!profile?.pin;
    document.body.classList.add('login-page');
    document.body.classList.remove('sidebar-open');
    $('#root').innerHTML = `<main class="login-shell ${animationClass}">
      <button class="login-offline-entry" type="button" data-action="enter-profile-offline" data-id="${eattr(profile?.id || '')}" title="Acesso direto temporário para testes">Entrar sem senha</button>
      <div class="login-signature-stage" data-login-signature aria-hidden="true">
        <img class="login-signature-frame" width="668" height="1000" alt="" aria-hidden="true" decoding="async" fetchpriority="high">
      </div>
      <section class="login-brand">
        <div class="login-brand-copy">
          <span class="eyebrow">Clínica em nuvem</span>
          <h1>Amanda Estética</h1>
          <p>Agenda, prontuários, protocolos, fotos e financeiro em um único lugar.</p>
        </div>
      </section>
      <section class="login-card login-card-clear">
        <button class="login-profile-summary login-profile-direct" type="button" data-action="enter-profile" data-id="${eattr(profile?.id || '')}" aria-label="Entrar sem senha como ${eattr(profile?.name || 'Amanda')}">
          ${profileAvatar(profile)}
          <span><strong>${esc(profile?.name || 'Amanda')}</strong><small>${esc(profile?.clinic?.clinicName || 'Amanda Braz Estética Avançada')}</small></span>
        </button>
        <button class="btn primary login-google-entry" type="button" data-action="enter-profile-google" data-id="${eattr(profile?.id || '')}">
          <span class="google-entry-mark" aria-hidden="true">G</span>
          <span>Entrar com Google</span>
        </button>
        <div class="pin-hint">Toque no perfil para entrar sem senha ou use o Google para testar Drive, backups e sincronização.</div>
      </section>
      <div id="login-auth-layer" class="login-auth-layer" aria-live="polite"></div>
      <footer class="login-footer">Modo de teste temporário: entrada sem senha. O login Google continua disponível para Drive e backups.</footer>
    </main>`;
    window.requestAnimationFrame(() => window.startLoginSignatureAnimation?.());
    window.requestAnimationFrame(() => window.startLoginParticles?.());
  }


  let SCREEN_SWAP_TIMER = 0;
  let SCREEN_SWAP_ACTIVE = false;

  function swapScreen({ currentSelector, exitClass, enterClass, renderNext }) {
    if (SCREEN_SWAP_ACTIVE) return;
    SCREEN_SWAP_ACTIVE = true;
    clearTimeout(SCREEN_SWAP_TIMER);
    document.body.classList.add('screen-transitioning');
    const current = document.querySelector(currentSelector);
    let swapped = false;

    const finishSwap = () => {
      if (swapped) return;
      swapped = true;
      renderNext(enterClass);
      SCREEN_SWAP_TIMER = window.setTimeout(() => {
        document.body.classList.remove('screen-transitioning');
        document.querySelector(`.${enterClass}`)?.classList.remove(enterClass);
        SCREEN_SWAP_ACTIVE = false;
      }, 260);
    };

    if (!current) {
      finishSwap();
      return;
    }
    current.classList.add(exitClass);
    current.addEventListener('animationend', finishSwap, { once:true });
    SCREEN_SWAP_TIMER = window.setTimeout(finishSwap, 190);
  }

  function renderShell(animationClass = '') {
    applyInterfaceMode();
    document.body.classList.remove('login-page','sidebar-open');
    const profile = activeProfile();
    const cloudSync = cloudSyncSnapshot();
    const navGroups = [
      ['Clínica', ['dashboard','agenda','clients','protocols','packages','attendances']],
      ['Prontuário', ['anamneses','consents','photos']],
      ['Gestão', ['products','finance','settings']]
    ];
    const sideNav = navGroups.map(([group, views]) => `
      <div class="nav-group"><span>${group}</span>
        ${views.map(v => `<button class="nav-item ${CURRENT_VIEW === v ? 'active' : ''}" data-nav="${v}">
          ${icon(VIEW_META[v].icon,19)}<span>${esc(VIEW_META[v].title)}</span>
        </button>`).join('')}
      </div>`).join('');

    $('#root').innerHTML = `<div class="app-shell ${animationClass}">
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">AB</div>
          <div><strong>Amanda Estética <span class="pro-sync-wrap"><em class="pro-badge">PRO</em><span class="cloud-sync-indicator ${cloudSync.state}" data-cloud-sync-indicator="${cloudSync.state}" title="${eattr(cloudSync.label)}" aria-label="${eattr(cloudSync.label)}"></span></span></strong><small>Gestão da clínica</small></div>
        </div>
        <nav>${sideNav}
          <button class="sidebar-cloud-save" data-action="quick-cloud-save" title="Salvar os dados no Google Drive">
            ${icon('upload',18)}<span><strong>Salvar na nuvem</strong><small data-cloud-sync-label>${esc(cloudSync.label)}</small></span>
          </button>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-profile-row">
            <button class="profile-mini" data-action="profile-menu">
              ${profileAvatar(profile,'small')}
              <span><strong>${esc(profile?.name || 'Amanda')}</strong><small>${esc(profile?.role || 'Perfil principal')}</small></span>
              ${icon('more',18)}
            </button>
            <button class="icon-btn small sidebar-lock" data-action="lock-app" title="Bloquear aplicativo" aria-label="Bloquear aplicativo">${icon('lock',16)}</button>
          </div>
        </div>
      </aside>
      <div class="sidebar-scrim" data-action="toggle-sidebar"></div>
      <section class="app-main">
        <header class="topbar">
          <button class="icon-btn menu-btn view-menu-btn" data-action="toggle-sidebar" aria-label="Abrir menu" title="Abrir menu"><span id="menu-view-icon">${icon(VIEW_META[CURRENT_VIEW].icon,21)}</span></button>
          <div class="topbar-title">
            <div><h1 id="view-title">${esc(VIEW_META[CURRENT_VIEW].title)}</h1><small id="save-status">Salvo localmente</small></div>
          </div>
          <label class="global-search">
            ${icon('search',18)}
            <input id="global-search-input" type="search" placeholder="Buscar clientes, protocolos e atendimentos" value="${eattr(SEARCH)}">
          </label>
          <button class="icon-btn" data-action="manual-save" title="Salvar agora">${icon('save',21)}</button>
          <span id="top-add-slot" class="top-add-slot">${VIEW_META[CURRENT_VIEW].add ? `<button class="top-add btn primary compact" data-action="${VIEW_META[CURRENT_VIEW].add}">${icon('plus',18)} <span>Novo</span></button>` : ''}</span>
          <button class="top-profile" data-action="profile-menu" title="Abrir perfil">${profileAvatar(profile,'small')}</button>
        </header>
        <main id="page" class="page"></main>
        <nav class="mobile-bottom-nav">
          ${[['agenda','Agenda'],['clients','Clientes'],['protocols','Protocolos'],['attendances','Atender']].map(([v,l]) =>
            `<button class="${CURRENT_VIEW===v?'active':''}" data-nav="${v}">${icon(VIEW_META[v].icon,21)}<span>${l}</span></button>`).join('')}
          <button data-action="toggle-sidebar">${icon('more',22)}<span>Mais</span></button>
        </nav>
      </section>
    </div>
    <div id="fab-slot">${VIEW_META[CURRENT_VIEW].add ? `<button class="fab" data-action="${VIEW_META[CURRENT_VIEW].add}" aria-label="Adicionar" title="Arraste para reposicionar" data-draggable-fab>${icon('plus',28)}</button>` : ''}</div>`;
    // A tela inteira já é animada quando há screen-enter-*; evitar uma segunda
    // animação simultânea na página reduz bastante o custo de composição.
    renderView();
    startLiveClock();
    requestAnimationFrame(applyFabPosition);
  }

  function updateShellChrome() {
    const title = $('#view-title');
    if (title) title.textContent = VIEW_META[CURRENT_VIEW].title;
    const menuViewIcon = $('#menu-view-icon');
    if (menuViewIcon) menuViewIcon.innerHTML = icon(VIEW_META[CURRENT_VIEW].icon,21);
    $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === CURRENT_VIEW));
    $$('.mobile-bottom-nav [data-nav]').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === CURRENT_VIEW));
    const topAdd = $('#top-add-slot');
    if (topAdd) topAdd.innerHTML = VIEW_META[CURRENT_VIEW].add ? `<button class="top-add btn primary compact" data-action="${VIEW_META[CURRENT_VIEW].add}">${icon('plus',18)} <span>Novo</span></button>` : '';
    const fabSlot = $('#fab-slot');
    if (fabSlot) fabSlot.innerHTML = VIEW_META[CURRENT_VIEW].add ? `<button class="fab" data-action="${VIEW_META[CURRENT_VIEW].add}" aria-label="Adicionar" title="Arraste para reposicionar" data-draggable-fab>${icon('plus',28)}</button>` : '';
    const searchInput = $('#global-search-input');
    if (searchInput && searchInput.value !== SEARCH) searchInput.value = SEARCH;
    requestAnimationFrame(applyFabPosition);
  }

  function renderView(animationClass = '') {
    const page = $('#page');
    if (!page) return;
    updateShellChrome();
    const renderers = {
      dashboard: renderDashboard,
      agenda: renderAgenda,
      clients: renderClients,
      protocols: renderProtocols,
      packages: renderPackages,
      attendances: renderAttendances,
      anamneses: renderAnamneses,
      consents: renderConsents,
      photos: renderPhotos,
      products: renderProducts,
      finance: renderFinance,
      settings: renderSettings
    };
    page.innerHTML = (renderers[CURRENT_VIEW] || renderDashboard)();
    if (animationClass) {
      page.classList.remove('page-enter-left','page-enter-right','page-enter-soft','page-exit-left','page-exit-right');
      page.classList.add(animationClass);
      setTimeout(() => page.classList.remove(animationClass), 420);
    }
    applyScrollEffects(page);
    const scroller = $('.app-main');
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
    updateLiveClock();
  }

  let SCROLL_OBSERVER = null;

  function applyScrollEffects(root) {
    if (!root) return;
    if (SCROLL_OBSERVER) {
      SCROLL_OBSERVER.disconnect();
      SCROLL_OBSERVER = null;
    }

    const stackContainers = root.querySelectorAll('.agenda-list,.packages-list,.clients-grid,.card-grid,.products-grid,.photo-grid,.compact-grid,.list-panel,.ios-settings-main,.ios-settings-aside');
    stackContainers.forEach(container => {
      container.classList.add('ios-scroll-stack','ios-universal-stack');
      const children = Array.from(container.children).filter(item =>
        item.matches('.agenda-day,.client-card,.protocol-card,.package-card,.record-card,.photo-card,.product-card,.client-compact-card,.protocol-compact-card,.product-compact-card,.list-row,.ios-settings-group,.ios-security-note')
      );
      const mobileStack = window.matchMedia('(max-width: 860px)').matches || document.documentElement.classList.contains('ui-smartphone');
      const isSettings = container.matches('.ios-settings-main,.ios-settings-aside');
      const isList = container.matches('.list-panel');
      const maxStackCards = isSettings ? 9 : isList ? (mobileStack ? 28 : 42) : (mobileStack ? 20 : 32);
      children.slice(0,maxStackCards).forEach((item, index) => {
        item.classList.add('ios-stack-card','ios-universal-stack-item');
        item.style.setProperty('--stack-order', String(index + 1));
        item.style.setProperty('--stack-index', String(index));
        item.style.setProperty('--stack-offset', `${Math.min(index, 3) * (mobileStack ? 5 : 6)}px`);
      });
    });

    // Cards sticky já têm movimento próprio no scroll. Aplicar também uma
    // transição de transform neles criava camadas concorrentes e travava a tela.
    const revealSelector = CURRENT_VIEW === 'settings'
      ? '.ios-settings-heading,.ios-profile-hero'
      : '.section-head,.pro-card,.panel,.list-panel,.agenda-day,.client-card,.protocol-card,.package-card,.record-card,.photo-card,.product-card,.client-compact-card,.protocol-compact-card,.product-compact-card,.stat-card';
    const allRevealItems = Array.from(root.querySelectorAll(revealSelector))
      .filter(item => !item.classList.contains('ios-stack-card'));
    const revealItems = allRevealItems.slice(0, CURRENT_VIEW === 'settings' ? 2 : 18);
    revealItems.forEach((item, index) => {
      item.classList.add('ios-scroll-reveal');
      item.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 18}ms`);
    });
    allRevealItems.slice(revealItems.length).forEach(item => item.classList.add('is-visible'));

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealItems.forEach(item => item.classList.add('is-visible'));
      return;
    }

    const scroller = $('.app-main') || null;
    SCROLL_OBSERVER = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        SCROLL_OBSERVER?.unobserve(entry.target);
      });
    }, { root: scroller, rootMargin: '80px 0px 80px 0px', threshold: 0.01 });
    revealItems.forEach(item => SCROLL_OBSERVER.observe(item));
  }

  function navTo(view, options = {}) {
    if (!VIEW_META[view] || view === CURRENT_VIEW || VIEW_TRANSITIONING) return;
    const oldIndex = NAV_ORDER.indexOf(CURRENT_VIEW);
    const newIndex = NAV_ORDER.indexOf(view);
    const forward = newIndex >= oldIndex;
    const page = $('#page');
    const finish = () => {
      CURRENT_VIEW = view;
      SEARCH = '';
      if (!options.fromHash) history.replaceState(null, '', `#${view}`);
      renderView(forward ? 'page-enter-right' : 'page-enter-left');
      VIEW_TRANSITIONING = false;
    };
    if (!page) { CURRENT_VIEW = view; renderShell(); return; }
    VIEW_TRANSITIONING = true;
    page.classList.add(forward ? 'page-exit-left' : 'page-exit-right');
    setTimeout(finish, 180);
  }

  function updateLiveClock() {
    const now = new Date();
    const clock = $('#live-clock');
    const date = $('#live-date');
    const greeting = $('#dashboard-greeting');
    if (clock) clock.textContent = formatClock(now);
    if (date) date.textContent = formatClockDate(now);
    if (greeting) greeting.textContent = `${greetingForNow(now)}, ${activeProfile()?.name || 'Amanda'}.`;
  }

  function startLiveClock() {
    clearInterval(CLOCK_TIMER);
    updateLiveClock();
    CLOCK_TIMER = setInterval(updateLiveClock, 30000);
  }

  
