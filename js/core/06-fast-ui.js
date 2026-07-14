'use strict';

/**
 * Amanda Estética v1.5.7 — atualizações parciais e filtros expansíveis.
 * Trocas de filtro/visualização não recriam a página inteira.
 */

function liquidIndexForValue(value) {
  if (value === 'cards' || value === 'day') return 1;
  if (value === 'compact' || value === 'month') return 2;
  return 0;
}

function updateLiquidControl(control, value) {
  if (!control) return;
  control.dataset.liquidIndex = String(liquidIndexForValue(value));
  control.dataset.filterValue = value;
  let selectedButton = null;
  control.querySelectorAll('[data-liquid-value]').forEach(button => {
    const active = button.dataset.liquidValue === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) selectedButton = button;
  });

  if (control.matches('[data-expandable-filter]') && selectedButton) {
    const trigger = control.querySelector('.expandable-filter-trigger');
    const currentIcon = control.querySelector('[data-expandable-current-icon]');
    const currentLabel = control.querySelector('[data-expandable-current-label]');
    const optionIcon = selectedButton.querySelector('.expandable-filter-option-icon');
    const label = selectedButton.title || selectedButton.textContent.trim();
    if (currentIcon && optionIcon) currentIcon.innerHTML = optionIcon.innerHTML;
    if (currentLabel) currentLabel.textContent = label;
    if (trigger) trigger.title = label;
  }
}

function collapseExpandableFilter(control, { suppressHover = true } = {}) {
  if (!control) return;
  control.classList.remove('is-open');
  control.querySelector('.expandable-filter-trigger')?.setAttribute('aria-expanded','false');
  if (!suppressHover) return;
  control.classList.add('is-suppressed');
  control.dataset.suppressUntil = String(Date.now() + 520);
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    control.querySelector(':focus')?.blur?.();
    window.setTimeout(()=>{
      if (Date.now() >= Number(control.dataset.suppressUntil || 0)) {
        control.classList.remove('is-suppressed');
        delete control.dataset.suppressUntil;
      }
    },560);
  }
}

function toggleExpandableFilter(control) {
  if (!control) return;
  control.classList.remove('is-suppressed');
  const open = !control.classList.contains('is-open');
  document.querySelectorAll('[data-expandable-filter].is-open').forEach(other => {
    if (other !== control) collapseExpandableFilter(other,{suppressHover:false});
  });
  control.classList.toggle('is-open',open);
  control.querySelector('.expandable-filter-trigger')?.setAttribute('aria-expanded',open?'true':'false');
}

function htmlFragment(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content;
}

function decoratePartialContent(section) {
  if (!section?.matches?.('.clients-grid,.card-grid,.products-grid,.photo-grid,.packages-list,.agenda-list,.compact-grid,.list-panel,.stats-grid')) return;
  if (section.matches('.stats-grid')) {
    section.querySelectorAll(':scope > *').forEach(item=>item.classList.add('is-visible'));
    return;
  }
  section.classList.add('ios-scroll-stack','ios-universal-stack');
  const mobile = window.matchMedia('(max-width:860px)').matches || document.documentElement.classList.contains('ui-smartphone');
  const limit = section.matches('.list-panel') ? (mobile ? 28 : 42) : (mobile ? 20 : 32);
  Array.from(section.children).slice(0, limit).forEach((item, index) => {
    item.classList.add('ios-stack-card','ios-universal-stack-item','is-visible');
    item.style.setProperty('--stack-order', String(index + 1));
    item.style.setProperty('--stack-index', String(index));
    item.style.setProperty('--stack-offset', `${Math.min(index, 3) * (mobile ? 5 : 6)}px`);
  });
}

function updateContentSection(current, incoming) {
  if (!current || !incoming) return;
  const oldHeight = current.getBoundingClientRect().height;
  if (oldHeight > 0) current.style.minHeight = `${Math.round(oldHeight)}px`;
  current.classList.add('content-refreshing');
  current.className = incoming.className;
  current.dataset.viewContent = incoming.dataset.viewContent || current.dataset.viewContent || '';
  current.innerHTML = incoming.innerHTML;
  decoratePartialContent(current);
  current.classList.add('content-refreshing');
  requestAnimationFrame(() => {
    current.classList.remove('content-refreshing');
    current.style.minHeight = '';
  });
}

function refreshViewModeContent(view, mode) {
  const page = $('#page');
  if (!page) return;
  const renderers = { clients:renderClients, protocols:renderProtocols, products:renderProducts };
  const renderer = renderers[view];
  if (!renderer) return;
  updateLiquidControl(page.querySelector(`.view-switcher-expandable[data-view-section="${view}"]`), mode);
  const fragment = htmlFragment(renderer());
  const incoming = fragment.querySelector(`[data-view-content="${view}"]`);
  const current = page.querySelector(`[data-view-content="${view}"]`);
  updateContentSection(current, incoming);
}

function refreshAttendanceContent() {
  const page = $('#page');
  if (!page || CURRENT_VIEW !== 'attendances') return;
  const fragment = htmlFragment(renderAttendances());
  const incomingTitle = fragment.querySelector('#attendance-result-title');
  const incomingDescription = fragment.querySelector('#attendance-result-description');
  const incomingPeriod = fragment.querySelector('.attendance-period-slot');
  const incomingContent = fragment.querySelector('[data-view-content="attendances"]');

  const title = page.querySelector('#attendance-result-title');
  const description = page.querySelector('#attendance-result-description');
  const period = page.querySelector('.attendance-period-slot');
  if (title && incomingTitle) title.textContent = incomingTitle.textContent;
  if (description && incomingDescription) description.textContent = incomingDescription.textContent;
  if (period && incomingPeriod) period.replaceChildren(...Array.from(incomingPeriod.childNodes).map(node => node.cloneNode(true)));
  updateLiquidControl(page.querySelector('.attendance-filter-expandable[data-expandable-filter]'), ATTENDANCE_FILTER.mode);
  updateContentSection(page.querySelector('[data-view-content="attendances"]'), incomingContent);
}


function refreshFinanceContent() {
  const page = $('#page');
  if (!page || CURRENT_VIEW !== 'finance') return;
  const fragment = htmlFragment(renderFinance());
  const incomingDescription = fragment.querySelector('#finance-period-description');
  const incomingMonth = fragment.querySelector('.finance-month-slot');
  const incomingStats = fragment.querySelector('[data-view-content="finance-stats"]');
  const incomingList = fragment.querySelector('[data-view-content="finance"]');

  const description = page.querySelector('#finance-period-description');
  const monthSlot = page.querySelector('.finance-month-slot');
  if (description && incomingDescription) description.textContent = incomingDescription.textContent;
  if (monthSlot && incomingMonth) monthSlot.replaceChildren(...Array.from(incomingMonth.childNodes).map(node => node.cloneNode(true)));
  updateLiquidControl(page.querySelector('.finance-filter-expandable[data-expandable-filter]'), FINANCE_FILTER.scope);
  updateContentSection(page.querySelector('[data-view-content="finance-stats"]'), incomingStats);
  updateContentSection(page.querySelector('[data-view-content="finance"]'), incomingList);
}
