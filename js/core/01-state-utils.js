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
  let deferredInstallPrompt = null;
  let ATTENDANCE_FILTER = { mode: 'all', date: '', month: '' };
  let FINANCE_FILTER = { scope: 'all', month: '' };
  let VIEW_TRANSITIONING = false;
  let CLOCK_TIMER = null;
  let PICKER_STATE = null;
  let FAB_DRAG_STATE = null;
  let CLOUD_SYNC_STATE = 'disconnected';
  let CLOUD_SYNC_LABEL = 'Não sincronizado com o Google';
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

  function activeProfile() {
    return (STATE.profiles || []).find(p => p.id === STATE.activeProfileId) || STATE.profiles?.[0];
  }

  const VIEW_MODE_DEFAULTS = Object.freeze({
    clients: 'cards',
    protocols: 'cards',
    products: 'list'
  });

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
        clients: [], products: [], protocols: [], packages: [], appointments: [],
        attendances: [], anamneses: [], consents: [], photos: [], finance: [],
        settings: { autosaveFolder: true, autosaveGoogle: true }, audit: []
      };
    }
    const d = STATE.dataByProfile[pid];
    ['clients','products','protocols','packages','appointments','attendances','anamneses','consents','photos','finance','audit']
      .forEach(key => { if (!Array.isArray(d[key])) d[key] = []; });
    d.settings ||= { autosaveFolder: true, autosaveGoogle: true };
    normalizeSectionViewModes(d.settings);
    if (!['auto','smartphone','pro'].includes(d.settings.interfaceMode)) d.settings.interfaceMode = 'auto';
    if (!d.settings.fabPosition || typeof d.settings.fabPosition !== 'object') d.settings.fabPosition = { side: 'right', topRatio: .78 };
    if (typeof d.settings.autosaveFolder !== 'boolean') d.settings.autosaveFolder = true;
    if (typeof d.settings.autosaveGoogle !== 'boolean') d.settings.autosaveGoogle = true;
    return d;
  }

  function addAudit(action, detail = '') {
    const d = data();
    d.audit.unshift({ id: uid('audit'), date: nowIso(), action, detail });
    d.audit = d.audit.slice(0, 200);
  }

  async function persist(reason = '', options = {}) {
    if (reason) addAudit(reason, options.detail || '');
    await ClinicStorage.save(STATE);
    if (window.AmandaBorionInterop) AmandaBorionInterop.schedule(STATE); // protected interop seam
    updateSaveStatus('Salvo localmente', 'ok');
    if (data().settings.autosaveFolder !== false && options.folder !== false) scheduleFolderSave();
    if (data().settings.autosaveGoogle !== false && options.google !== false) scheduleGoogleDriveSave();
  }

  function scheduleFolderSave() {
    clearTimeout(folderSaveTimer);
    folderSaveTimer = setTimeout(async () => {
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
        updateSaveStatus('Salvo local · Drive pendente', 'warn');
      }
    }, 1300);
  }

  function scheduleGoogleDriveSave() {
    clearTimeout(googleSaveTimer);
    googleSaveTimer = setTimeout(async () => {
      try {
        if (!window.GoogleDriveClinic?.isConfigured()) { setCloudSyncStatus('disconnected'); return; }
        setCloudSyncStatus('syncing','Sincronizando com o Google');
        await GoogleDriveClinic.save(STATE);
        setCloudSyncStatus('synced','Sincronizado com o Google');
        updateSaveStatus('Google Drive sincronizado', 'ok');
      } catch (error) {
        console.warn('[Amanda Clínica] Autosave do Google Drive falhou:', error);
        setCloudSyncStatus('failed','Não sincronizado com o Google');
        updateSaveStatus('Salvo local · Google pendente', 'warn');
      }
    }, 1800);
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

  function confirmAction(message) {
    return window.confirm(message);
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

  
