'use strict';

/**
 * Amanda Estética — Estado global, utilitários, persistência, modos de interface e filtros.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

let STATE = null;
  let CURRENT_VIEW = 'dashboard';
  let SEARCH = '';
  let modalSubmitHandler = null;
  let folderSaveTimer = null;
  let googleSaveTimer = null;
  let folderSaveIdle = null;
  let googleSaveIdle = null;
  let deferredInstallPrompt = null;
  let ATTENDANCE_FILTER = { mode: 'all', date: '', month: '' };
  let CLIENT_FILTER = { mode: 'active' };
  let PHOTO_NAV = { clientId: '', protocolId: '' };
  let PHOTO_STATUS_FILTER = 'active';
  let PHOTO_VIEWER_NAV = null;
  let FINANCE_FILTER = { scope: 'all', month: '' };
  let PRODUCTS_TAB = 'products';
  let PRICE_HISTORY_MODAL_STATE = null;
  let VIEW_TRANSITIONING = false;
  let CLOCK_TIMER = null;
  let PICKER_STATE = null;
  let FAB_DRAG_STATE = null;
  let CLOUD_SYNC_STATE = 'disconnected';
  let CLOUD_SYNC_LABEL = 'Não sincronizado com o Google';
  let ACTIVE_CONFIRM_CLOSE = null;
  const NAV_ORDER = ['dashboard','agenda','clients','protocols','packages','attendances','anamneses','consents','photos','products','finance','settings'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const eattr = esc;
  const num = value => Number(String(value ?? '').replace(',', '.')) || 0;
  const bool = value => value === true || value === 'true' || value === 'on' || value === 'Sim' || value === 'sim';
  const localIsoDate = (date = new Date()) => {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const todayIso = () => localIsoDate();
  const nowIso = () => new Date().toISOString();
  const DATE_FORMAT_SHORT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const DATE_FORMAT_WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const CURRENCY_FORMAT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const CLOCK_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const CLOCK_DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  function dateFromIso(value) {
    if (!value) return null;
    const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value, withWeekday = false) {
    const d = dateFromIso(value);
    if (!d) return '—';
    return (withWeekday ? DATE_FORMAT_WEEKDAY : DATE_FORMAT_SHORT).format(d);
  }

  function formatDateTime(value) {
    const d = dateFromIso(value);
    if (!d) return '—';
    return DATE_TIME_FORMAT.format(d);
  }

  function currency(value) {
    return CURRENCY_FORMAT.format(Number(value) || 0);
  }

  function greetingForNow(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function formatClock(date = new Date()) {
    return CLOCK_FORMAT.format(date);
  }

  function formatClockDate(date = new Date()) {
    return CLOCK_DATE_FORMAT.format(date);
  }

  function clinicAddress(profile = activeProfile()) {
    const c = profile?.clinic || {};
    return [c.address, c.number, c.neighborhood, c.city].filter(Boolean).join(', ') || 'Endereço não informado';
  }

  function dashboardPrivacyEnabled() {
    return !!data()?.settings?.dashboardPrivacy;
  }

  function privacyValue(value) {
    return dashboardPrivacyEnabled()
      ? '<span class="privacy-value is-hidden" aria-label="Valor oculto">••••</span>'
      : `<span class="privacy-value">${esc(value)}</span>`;
  }

  function pickerDisplay(type, value) {
    if (!value) return type === 'time' ? 'Selecionar horário' : 'Selecionar data';
    if (type === 'time') return String(value).slice(0, 5);
    return formatDate(value);
  }

  function normalize(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function containsSearch(...values) {
    if (!SEARCH) return true;
    const q = normalize(SEARCH);
    return values.some(v => normalize(v).includes(q));
  }

  function whatsappNumber(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    return `55${digits}`;
  }

  function digitsOnly(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function maskPhone(value) {
    const d = digitsOnly(value).slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }

  function maskDocument(value) {
    const d = digitsOnly(value).slice(0, 11);
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  function maskZip(value) {
    return digitsOnly(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
  }

  function activeProfile() {
    return (STATE.profiles || []).find(p => p.id === STATE.activeProfileId) || STATE.profiles?.[0];
  }

  const VIEW_MODE_DEFAULTS = Object.freeze({
    clients: 'cards',
    protocols: 'cards',
    products: 'list',
    disposables: 'list'
  });

  function productsActiveTabKey() {
    return PRODUCTS_TAB === 'disposables' ? 'disposables' : 'products';
  }

  function currentAddAction() {
    if (CURRENT_VIEW === 'products' && productsActiveTabKey() === 'disposables') return 'add-disposable';
    return VIEW_META[CURRENT_VIEW]?.add || null;
  }

  function normalizeSectionViewModes(settings) {
    settings ||= {};
    const legacy = settings.viewModes && typeof settings.viewModes === 'object' ? settings.viewModes : {};
    const scoped = settings.viewModesBySection && typeof settings.viewModesBySection === 'object'
      ? settings.viewModesBySection
      : {};
    Object.entries(VIEW_MODE_DEFAULTS).forEach(([section, fallback]) => {
      const candidate = scoped[section] ?? legacy[section];
      scoped[section] = ['list', 'cards', 'compact'].includes(candidate) ? candidate : fallback;
    });
    settings.viewModesBySection = scoped;
    // Mantém o campo antigo apenas como espelho de compatibilidade com backups anteriores.
    settings.viewModes = { ...scoped };
    return scoped;
  }

  function data() {
    const pid = activeProfile()?.id;
    if (!pid) return null;
    if (STATE.activeProfileId !== pid) STATE.activeProfileId = pid;
    if (!STATE.dataByProfile[pid]) {
      STATE.dataByProfile[pid] = {
        clients: [], products: [], disposables: [], protocols: [], packages: [], appointments: [],
        attendances: [], anamneses: [], consents: [], photos: [], finance: [],
        settings: { autosaveFolder: true, autosaveGoogle: true }, audit: []
      };
    }
    const d = STATE.dataByProfile[pid];
    ['clients','products','disposables','protocols','packages','appointments','attendances','anamneses','consents','photos','finance','audit']
      .forEach(key => { if (!Array.isArray(d[key])) d[key] = []; });
    d.settings ||= { autosaveFolder: true, autosaveGoogle: true };
    normalizeSectionViewModes(d.settings);
    if (!['auto','smartphone','pro'].includes(d.settings.interfaceMode)) d.settings.interfaceMode = 'auto';
    if (!d.settings.fabPosition || typeof d.settings.fabPosition !== 'object') d.settings.fabPosition = { side: 'right', topRatio: .78 };
    if (typeof d.settings.autosaveFolder !== 'boolean') d.settings.autosaveFolder = true;
    if (typeof d.settings.autosaveGoogle !== 'boolean') d.settings.autosaveGoogle = true;
    if (!Array.isArray(d.settings.productCategories)) {
      const used = new Set(d.products.map(x => String(x.category || '').trim()).filter(Boolean));
      d.settings.productCategories = [...used];
    }
    if (!Array.isArray(d.settings.productBrands)) {
      const used = new Set(d.products.map(x => String(x.brand || '').trim()).filter(Boolean));
      d.settings.productBrands = [...used];
    }
    if (!Array.isArray(d.settings.financeCategories)) {
      const defaults = ['Atendimento','Produto','Marketing','Aluguel','Transporte','Imposto','Fornecedor','Outros'];
      const used = d.finance.map(x => String(x.category || '').trim()).filter(Boolean);
      d.settings.financeCategories = [...new Set([...defaults, ...used])];
    }
    if (!Array.isArray(d.settings.costCenters)) {
      const defaults = ['Recepção','Sala de procedimentos','Estoque','Administrativo','Marketing'];
      const used = d.finance.map(x => String(x.costCenter || '').trim()).filter(Boolean);
      d.settings.costCenters = [...new Set([...defaults, ...used])];
    }
    if (!Array.isArray(d.settings.photoAreas)) {
      const defaults = ['Rosto','Colo','Abdômen','Glúteos','Pernas','Braços','Corpo todo'];
      const used = d.photos.map(x => String(x.area || '').trim()).filter(Boolean);
      d.settings.photoAreas = [...new Set([...defaults, ...used])];
    }
    if (!Array.isArray(d.settings.skinTypes)) {
      const defaults = ['Seca','Oleosa','Mista','Normal','Sensível','Desidratada'];
      const used = d.anamneses.map(x => String(x.skinType || '').trim()).filter(Boolean);
      d.settings.skinTypes = [...new Set([...defaults, ...used])];
    }
    if (!Array.isArray(d.settings.disposableCategories)) {
      const defaults = ['Luvas','Agulhas','Gaze','Algodão','Máscaras','Toucas','Seringas','Espátulas','Proteção','Aplicação','Higienização','Outros'];
      const used = d.disposables.map(x => String(x.category || '').trim()).filter(Boolean);
      d.settings.disposableCategories = [...new Set([...defaults, ...used])];
    }
    if (!Array.isArray(d.settings.disposableUnits)) {
      d.settings.disposableUnits = ['Unidade','Par','Caixa','Pacote','Rolo','Folha','Grama','Mililitro','Centímetro','Metro','Outros'];
    }
    normalizeSettingsCatalogsV118(d);
    seedLegacyPriceHistory(d);
    return d;
  }

  function dedupeSettingListPreservingOrder(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).reduce((result, rawValue) => {
      const value = String(rawValue ?? '').trim();
      if (!value) return result;
      const key = normalize(value);
      if (!key || seen.has(key)) return result;
      seen.add(key);
      result.push(value);
      return result;
    }, []);
  }

  function normalizeSettingsCatalogsV118(d) {
    if (d.settings.catalogsNormalizedV118) return;
    ['productCategories','productBrands','disposableCategories','disposableUnits','financeCategories','costCenters','photoAreas','skinTypes']
      .forEach(key => { d.settings[key] = dedupeSettingListPreservingOrder(d.settings[key]); });
    d.settings.catalogsNormalizedV118 = true;
  }

  /* V1.17.0 — cria retroativamente a primeira entrada do histórico de preços
     para produtos e descartáveis cadastrados antes desta atualização, sem
     apagar nada e sem duplicar a cada carregamento (controlado por uma flag
     em settings). Compatível com perfis e backups antigos. */
  function seedLegacyPriceHistory(d) {
    if (d.settings.priceHistorySeeded) return;
    const seedOne = item => {
      if (!Array.isArray(item.priceHistory)) item.priceHistory = [];
      if (item.priceHistory.length) return;
      item.priceHistory.push({
        id: uid('PH'),
        date: item.createdAt || item.updatedAt || nowIso(),
        totalValue: num(item.packageCost),
        packageQuantity: num(item.packageQty),
        unit: item.unit || '',
        unitCost: num(item.unitCost),
        supplier: item.supplier || '',
        source: 'migrated-registration'
      });
    };
    d.products.forEach(seedOne);
    d.disposables.forEach(seedOne);
    d.settings.priceHistorySeeded = true;
  }

  function addAudit(action, detail = '') {
    const d = data();
    d.audit.unshift({ id: uid('audit'), date: nowIso(), action, detail });
    d.audit = d.audit.slice(0, 200);
  }

  // V1.20.0 — registra, uma única vez por navegador, a migração para o novo
  // modelo em que o Google Drive é a fonte oficial da verdade (ver
  // CORREÇÃO CRÍTICA no topo de google-drive.js e 05-events-boot.js).
  const CLOUD_AUTHORITATIVE_MIGRATION_KEY = 'amanda_cloud_authoritative_migration_v1';
  function recordCloudAuthoritativeMigrationOnce() {
    if (localStorage.getItem(CLOUD_AUTHORITATIVE_MIGRATION_KEY)) return;
    localStorage.setItem(CLOUD_AUTHORITATIVE_MIGRATION_KEY, nowIso());
    try { addAudit('Proteção de dados atualizada (V1.20.0)', 'Google Drive passou a ser a fonte oficial da base; o cache local deste navegador deixou de ser usado como base principal.'); }
    catch (_) { /* sem perfil ativo ainda — a marca em localStorage já é suficiente */ }
  }

  async function persist(reason = '', options = {}) {
    if (reason) addAudit(reason, options.detail || '');
    await ClinicStorage.save(STATE);
    if (window.AmandaBorionInterop) AmandaBorionInterop.schedule(STATE); // protected interop seam
    // V1.20.0 — nenhuma gravação remota é agendada enquanto a base do Google
    // Drive não estiver carregada, validada e hidratada nesta sessão. O dado
    // ainda fica salvo neste navegador (linha acima); só a sincronização com
    // o Drive/pasta é que espera a conexão voltar.
    if (window.AppLifecycle && !window.AppLifecycle.canWrite()) {
      updateSaveStatus('Sem conexão · alteração não sincronizada', 'warn');
      toast('Sem conexão com o Google Drive. Esta alteração ficou só neste navegador até reconectar.', 'warn');
      return;
    }
    if (window.GoogleDriveClinic?.isConfigured?.()) GoogleDriveClinic.markAutosaveDirty();
    updateSaveStatus('Salvo localmente', 'ok');
    if (data().settings.autosaveFolder !== false && options.folder !== false) scheduleFolderSave();
    if (data().settings.autosaveGoogle !== false && options.google !== false) scheduleGoogleDriveSave();
  }

  function scheduleFolderSave() {
    clearTimeout(folderSaveTimer);
    if (folderSaveIdle && 'cancelIdleCallback' in window) cancelIdleCallback(folderSaveIdle);
    folderSaveIdle = null;
    folderSaveTimer = setTimeout(() => {
      const run = async () => {
        folderSaveIdle = null;
        try {
          const handle = await ClinicStorage.getFolderHandle();
          if (!handle) return;
          if (!(await ClinicStorage.ensurePermission(handle, false))) {
            updateSaveStatus('Pasta precisa de autorização', 'warn');
            return;
          }
          await ClinicStorage.saveToFolder(STATE, { handle });
          updateSaveStatus('Drive sincronizado', 'ok');
        } catch (error) {
          console.warn('[Amanda Clínica] Autosave da pasta falhou:', error);
          if (error?.code === 'SUSPICIOUS_WRITE') {
            updateSaveStatus('Salvamento na pasta bloqueado por segurança', 'warn');
            toast(error.message, 'error');
          } else {
            updateSaveStatus('Salvo local · Drive pendente', 'warn');
          }
        }
      };
      if ('requestIdleCallback' in window) folderSaveIdle = requestIdleCallback(run, { timeout: 2400 });
      else setTimeout(run, 0);
    }, 1500);
  }

  function scheduleGoogleDriveSave() {
    clearTimeout(googleSaveTimer);
    if (googleSaveIdle && 'cancelIdleCallback' in window) cancelIdleCallback(googleSaveIdle);
    googleSaveIdle = null;
    googleSaveTimer = setTimeout(() => {
      const run = async () => {
        googleSaveIdle = null;
        try {
          if (!window.GoogleDriveClinic?.isConfigured()) { setCloudSyncStatus('disconnected'); return; }
          if (window.AppLifecycle && !window.AppLifecycle.canWrite()) { setCloudSyncStatus('failed', 'Não sincronizado com o Google'); return; }
          setCloudSyncStatus('syncing','Sincronizando com o Google');
          await GoogleDriveClinic.save(STATE);
          setCloudSyncStatus('synced','Sincronizado com o Google');
          updateSaveStatus('Google Drive sincronizado', 'ok');
        } catch (error) {
          console.warn('[Amanda Clínica] Autosave do Google Drive falhou:', error);
          setCloudSyncStatus('failed','Não sincronizado com o Google');
          if (error?.code === 'SUSPICIOUS_WRITE') {
            updateSaveStatus('Salvamento bloqueado por segurança', 'warn');
            toast(error.message, 'error');
          } else if (error?.code === 'STALE_REVISION') {
            updateSaveStatus('Google Drive foi atualizado em outro lugar', 'warn');
            toast('Outro dispositivo ou aba salvou antes. Use "Sincronizar com o Google" para carregar a versão mais recente antes de continuar editando.', 'warn');
          } else if (error?.code === 'WORKSPACE_MISMATCH') {
            updateSaveStatus('Pasta do Google Drive incorreta', 'warn');
            toast(error.message, 'error');
          } else {
            updateSaveStatus('Salvo local · Google pendente', 'warn');
          }
        }
      };
      if ('requestIdleCallback' in window) googleSaveIdle = requestIdleCallback(run, { timeout: 3000 });
      else setTimeout(run, 0);
    }, 1900);
  }

  function cloudSyncSnapshot() {
    if (CLOUD_SYNC_STATE === 'disconnected' && window.GoogleDriveClinic?.isConfigured?.()) {
      const hasLastSave = !!localStorage.getItem('amanda_clinica_last_google_save');
      return { state:hasLastSave?'synced':'syncing', label:hasLastSave?'Sincronizado com o Google':'Google conectado; aguardando sincronização' };
    }
    return { state:CLOUD_SYNC_STATE, label:CLOUD_SYNC_LABEL };
  }

  function setCloudSyncStatus(state = 'disconnected', label = '') {
    CLOUD_SYNC_STATE = ['synced','syncing','failed','disconnected'].includes(state) ? state : 'disconnected';
    CLOUD_SYNC_LABEL = label || ({synced:'Sincronizado com o Google',syncing:'Sincronizando com o Google',failed:'Não sincronizado com o Google',disconnected:'Não sincronizado com o Google'}[CLOUD_SYNC_STATE]);
    document.querySelectorAll('[data-cloud-sync-indicator]').forEach(el => {
      el.className = `cloud-sync-indicator ${CLOUD_SYNC_STATE}`;
      el.title = CLOUD_SYNC_LABEL;
      el.setAttribute('aria-label',CLOUD_SYNC_LABEL);
      el.dataset.cloudSyncIndicator = CLOUD_SYNC_STATE;
    });
    document.querySelectorAll('[data-cloud-sync-label]').forEach(el => { el.textContent = CLOUD_SYNC_LABEL; });
  }

  function updateSaveStatus(text, tone = '') {
    const el = $('#save-status');
    if (el) {
      el.textContent = text;
      el.dataset.tone = tone;
    }
  }

  function toast(message, tone = 'ok') {
    const root = $('#toast-root');
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.innerHTML = `<span>${tone === 'error' ? '!' : tone === 'warn' ? '•' : '✓'}</span><div>${esc(message)}</div>`;
    root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 250);
    }, 3200);
  }

  function confirmAction(message, options = {}) {
    if (ACTIVE_CONFIRM_CLOSE) ACTIVE_CONFIRM_CLOSE(false);

    const root = $('#confirm-root') || (() => {
      const node = document.createElement('div');
      node.id = 'confirm-root';
      node.setAttribute('aria-live', 'assertive');
      document.body.appendChild(node);
      return node;
    })();

    const destructive = options.tone === 'danger' || /excluir|apagar|substituir|desconectar|esquecer|cancelad|restaurar/i.test(String(message));
    const title = options.title || (destructive ? 'Confirmar ação' : 'Confirmação');
    const confirmText = options.confirmText || (destructive ? 'Confirmar' : 'Continuar');
    const cancelText = options.cancelText || 'Cancelar';
    const iconName = destructive ? 'trash' : 'sparkles';

    return new Promise(resolve => {
      let settled = false;
      const template = document.createElement('template');
      template.innerHTML = `<div class="app-confirm-backdrop" data-confirm-backdrop>
        <section class="app-confirm-dialog ${destructive ? 'is-danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-message">
          <div class="app-confirm-brand"><span>${icon('sparkles',14)}</span><small>Amanda Estética</small></div>
          <div class="app-confirm-icon">${icon(iconName,25)}</div>
          <div class="app-confirm-copy">
            <h2 id="app-confirm-title">${esc(title)}</h2>
            <p id="app-confirm-message">${esc(message)}</p>
          </div>
          <footer class="app-confirm-actions">
            <button type="button" class="btn ghost" data-confirm-cancel>${esc(cancelText)}</button>
            <button type="button" class="btn ${destructive ? 'danger' : 'primary'}" data-confirm-accept>${destructive ? icon('check',17) : icon('sparkles',17)} ${esc(confirmText)}</button>
          </footer>
        </section>
      </div>`;
      root.replaceChildren(template.content.cloneNode(true));
      document.body.classList.add('app-confirm-open');
      const backdrop = root.firstElementChild;
      const dialog = backdrop?.querySelector('.app-confirm-dialog');
      const accept = backdrop?.querySelector('[data-confirm-accept]');
      const cancel = backdrop?.querySelector('[data-confirm-cancel]');

      const finish = result => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeyDown, true);
        document.body.classList.remove('app-confirm-open');
        backdrop?.classList.remove('is-open');
        backdrop?.classList.add('is-closing');
        ACTIVE_CONFIRM_CLOSE = null;
        window.setTimeout(() => {
          if (root.firstElementChild === backdrop) root.replaceChildren();
        }, 170);
        resolve(Boolean(result));
      };

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish(false);
        }
        if (event.key === 'Enter' && document.activeElement !== cancel) {
          event.preventDefault();
          event.stopImmediatePropagation();
          finish(true);
        }
      };

      ACTIVE_CONFIRM_CLOSE = finish;
      accept?.addEventListener('click', () => finish(true));
      cancel?.addEventListener('click', () => finish(false));
      backdrop?.addEventListener('click', event => {
        if (event.target === backdrop) finish(false);
      });
      dialog?.addEventListener('click', event => event.stopPropagation());
      document.addEventListener('keydown', onKeyDown, true);

      requestAnimationFrame(() => {
        backdrop?.classList.add('is-open');
        accept?.focus({preventScroll:true});
      });
    });
  }

  function cancelConfirmAction() {
    if (ACTIVE_CONFIRM_CLOSE) ACTIVE_CONFIRM_CLOSE(false);
  }

  function emptyState(title, text, action = '', label = 'Adicionar') {
    return `<div class="empty-state">
      <div class="empty-illustration">${icon('sparkles', 34)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${action ? `<button class="btn primary" data-action="${action}">${icon('plus',18)} ${esc(label)}</button>` : ''}
    </div>`;
  }

  function chip(text, tone = '') {
    return `<span class="chip ${tone}">${esc(text || '—')}</span>`;
  }

  function statCard(label, value, sub, iconName, tone = '') {
    return `<article class="stat-card ${tone}">
      <div class="stat-icon">${icon(iconName, 22)}</div>
      <div><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    </article>`;
  }

  function profileAvatar(profile, size = '') {
    const classes = ['profile-avatar', size, profile?.avatarData ? 'has-photo' : ''].filter(Boolean).join(' ');
    if (profile?.avatarData) return `<span class="${classes}"><img src="${eattr(profile.avatarData)}" alt="Foto de ${eattr(profile.name || 'perfil')}" decoding="async"></span>`;
    return `<span class="${classes}">${esc((profile?.name || 'A').slice(0, 1).toUpperCase())}</span>`;
  }

  function getViewMode(view, fallback = 'cards') {
    const settings = data().settings;
    const modes = normalizeSectionViewModes(settings);
    const sectionFallback = VIEW_MODE_DEFAULTS[view] || fallback;
    return ['list', 'cards', 'compact'].includes(modes[view]) ? modes[view] : sectionFallback;
  }

  function setViewModePreference(view, mode) {
    if (!Object.prototype.hasOwnProperty.call(VIEW_MODE_DEFAULTS, view)) return false;
    if (!['list', 'cards', 'compact'].includes(mode)) return false;
    const settings = data().settings;
    const modes = normalizeSectionViewModes(settings);
    modes[view] = mode;
    settings.viewModesBySection = { ...modes };
    settings.viewModes = { ...modes };
    return true;
  }

  function expandableFilterControl({ ariaLabel, current, options, action, className = '', sharedAttrs = '', containerAttrs = '' }) {
    const selected = options.find(option => option.value === current) || options[0];
    return `<div class="expandable-filter ${className}" data-expandable-filter data-filter-value="${eattr(selected.value)}" ${containerAttrs} role="group" aria-label="${eattr(ariaLabel)}">
      <button type="button" class="expandable-filter-trigger" data-action="toggle-expandable-filter" aria-expanded="false" title="${eattr(selected.label)}">
        <span data-expandable-current-icon>${icon(selected.icon || 'more',18)}</span>
        <span class="sr-only" data-expandable-current-label>${esc(selected.label)}</span>
      </button>
      <div class="expandable-filter-options" role="presentation">
        ${options.map(option => `<button type="button" class="expandable-filter-option ${option.value === current ? 'active' : ''}" data-action="${eattr(action)}" data-liquid-value="${eattr(option.value)}" ${sharedAttrs} ${option.attrs || ''} aria-pressed="${option.value === current ? 'true' : 'false'}" title="${eattr(option.label)}">
          <span class="expandable-filter-option-icon">${icon(option.icon || 'more',17)}</span><span>${esc(option.label)}</span>
        </button>`).join('')}
      </div>
    </div>`;
  }

  function viewModeSwitcher(view, current) {
    const options = [
      { value:'list', icon:'list', label:'Lista', attrs:`data-view="${eattr(view)}" data-mode="list"` },
      { value:'cards', icon:'columns', label:'Colunas', attrs:`data-view="${eattr(view)}" data-mode="cards"` },
      { value:'compact', icon:'grid', label:'Quadrados', attrs:`data-view="${eattr(view)}" data-mode="compact"` }
    ];
    return expandableFilterControl({
      ariaLabel:'Modo de visualização',
      current,
      options,
      action:'set-view-mode',
      className:'view-switcher-expandable',
      sharedAttrs:`data-view="${eattr(view)}"`,
      containerAttrs:`data-view-section="${eattr(view)}"`
    });
  }


  function interfaceMode() {
    const mode = data()?.settings?.interfaceMode;
    return ['auto','smartphone','pro'].includes(mode) ? mode : 'auto';
  }

  function applyInterfaceMode() {
    const root = document.documentElement;
    root.classList.remove('ui-auto','ui-smartphone','ui-pro');
    root.classList.add(`ui-${interfaceMode()}`);
  }

  function interfaceModeSelector() {
    const current = interfaceMode();
    const options = [
      ['auto','auto','Automático','Reconhece o tamanho da tela'],
      ['smartphone','smartphone','Smartphone','Interface móvel e navegação inferior'],
      ['pro','desktop','Pro','Interface completa para computador']
    ];
    return `<div class="ios-device-mode" role="group" aria-label="Modo de interface">
      ${options.map(([mode,iconName,label,description])=>`<button type="button" class="ios-device-mode-option ${current===mode?'active':''}" data-action="set-interface-mode" data-mode="${mode}" aria-pressed="${current===mode?'true':'false'}">
        <span class="ios-device-mode-icon">${icon(iconName,20)}</span>
        <span><strong>${label}</strong><small>${description}</small></span>
        <span class="ios-mode-check">${icon('check',15)}</span>
      </button>`).join('')}
    </div>`;
  }

  function applyFabPosition() {
    const fab = $('.fab');
    if (!fab) return;
    const saved = data()?.settings?.fabPosition || { side:'right', topRatio:.78 };
    const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar')) || 60;
    const minTop = topbar + 16;
    const bottomGuard = 104 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0);
    const maxTop = Math.max(minTop, window.innerHeight - bottomGuard - 58);
    const ratio = Math.min(1, Math.max(0, Number(saved.topRatio) || .78));
    const top = minTop + (maxTop - minTop) * ratio;
    fab.style.top = `${Math.round(top)}px`;
    fab.style.bottom = 'auto';
    fab.style.left = saved.side === 'left' ? 'max(14px, env(safe-area-inset-left))' : 'auto';
    fab.style.right = saved.side === 'left' ? 'auto' : 'max(14px, env(safe-area-inset-right))';
  }

  function ensureUiFilters() {
    ATTENDANCE_FILTER.date ||= todayIso();
    ATTENDANCE_FILTER.month ||= todayIso().slice(0, 7);
    if (!FINANCE_FILTER.month) {
      const latest = data().finance.map(f => String(f.date || '').slice(0, 7)).filter(v => /^\d{4}-\d{2}$/.test(v)).sort().pop();
      FINANCE_FILTER.month = latest || todayIso().slice(0, 7);
    }
  }

  
