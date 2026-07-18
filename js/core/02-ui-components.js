'use strict';

/**
 * Amanda Estética — Campos, formulários, modais e seletores iOS de data e hora.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */


let MODAL_SEQUENCE = 0;
let MODAL_CLOSE_TIMER = 0;
let MODAL_FOCUS_TIMER = 0;

const MONEY_FIELD_PATTERN = /(valor|custo|preço|preco|recebido|cobrado|financeiro|saldo|pagamento|r\$)/i;
const MONEY_NAME_PATTERN = /(^|_)(value|cost|price|amount|total|received|charged)(_|$)|^(packageCost|packageValue|receivedValue|chargedValue)$/i;

function parseMoneyInputValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (/R\$|,/.test(text)) {
    const normalized = text.replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
    return Number(normalized) || 0;
  }
  return Number(text) || 0;
}

function formatMoneyInputValue(value = 0) {
  const cents = Math.max(0, Math.round(parseMoneyInputValue(value) * 100));
  const integer = Math.floor(cents / 100).toLocaleString('pt-BR', { minimumIntegerDigits:2 });
  return `${integer},${String(cents % 100).padStart(2,'0')}`;
}

function formatMoneyInputFromDigits(value = '') {
  const digits = String(value).replace(/\D/g,'');
  const cents = Number(digits || 0);
  const integer = Math.floor(cents / 100).toLocaleString('pt-BR', { minimumIntegerDigits:2 });
  return `${integer},${String(cents % 100).padStart(2,'0')}`;
}

function setMoneyFieldValue(input, value) {
  if (!input) return;
  input.value = formatMoneyInputValue(value);
  input.dataset.moneyValue = String(parseMoneyInputValue(value));
}

function isMoneyField(label, name, type, options = {}) {
  return options.money === true || (type === 'number' && (MONEY_FIELD_PATTERN.test(String(label)) || MONEY_NAME_PATTERN.test(String(name))));
}

function field(label, name, value = '', type = 'text', options = {}) {
    const required = options.required ? 'required' : '';
    const min = options.min !== undefined ? `min="${options.min}"` : '';
    const max = options.max !== undefined ? `max="${options.max}"` : '';
    const step = options.step !== undefined ? `step="${options.step}"` : '';
    const placeholder = options.placeholder ? `placeholder="${eattr(options.placeholder)}"` : '';
    const cls = options.className || '';
    const readonly = options.readonly ? 'readonly' : '';
    const labelText = `${esc(label)}${options.required ? ' *' : ''}`;
    const money = isMoneyField(label, name, type, options);
    if (type === 'date' || type === 'time') {
      return `<label class="field ios-wheel-field ${cls}">
        <span>${labelText}</span>
        <span class="ios-picker-control">
          <input class="ios-native-picker" type="${type}" name="${eattr(name)}" value="${eattr(value)}" ${required} ${min} ${max} ${step} ${readonly}>
          <button type="button" class="ios-wheel-trigger" data-action="open-wheel-picker" data-input-name="${eattr(name)}" data-picker-type="${type}">
            <span data-picker-label-for="${eattr(name)}">${esc(pickerDisplay(type, value))}</span>${icon('chevron',17)}
          </button>
        </span>
        ${options.help ? `<small>${esc(options.help)}</small>` : ''}
      </label>`;
    }
    const renderedType = money ? 'text' : type;
    const renderedValue = money ? formatMoneyInputValue(value) : value;
    const moneyAttrs = money ? 'inputmode="numeric" autocomplete="off" data-money-input data-money-value="'+eattr(parseMoneyInputValue(value))+'"' : '';
    return `<label class="field ${cls} ${money ? 'money-field' : ''}">
      <span>${labelText}</span>
      <input type="${renderedType}" name="${eattr(name)}" value="${eattr(renderedValue)}" ${required} ${money ? '' : `${min} ${max} ${step}`} ${placeholder} ${readonly} ${moneyAttrs}>
      ${options.help ? `<small>${esc(options.help)}</small>` : ''}
    </label>`;
  }

  function textarea(label, name, value = '', options = {}) {
    return `<label class="field ${options.className || ''}">
      <span>${esc(label)}${options.required ? ' *' : ''}</span>
      <textarea name="${eattr(name)}" rows="${options.rows || 3}" ${options.required ? 'required' : ''} placeholder="${eattr(options.placeholder || '')}">${esc(value)}</textarea>
      ${options.help ? `<small>${esc(options.help)}</small>` : ''}
    </label>`;
  }

  function selectField(label, name, optionsList, current = '', options = {}) {
    const list = optionsList.map(opt => {
      const value = typeof opt === 'object' ? opt.value : opt;
      const text = typeof opt === 'object' ? opt.label : opt;
      return `<option value="${eattr(value)}" ${String(value) === String(current) ? 'selected' : ''}>${esc(text)}</option>`;
    }).join('');
    return `<label class="field ${options.className || ''}">
      <span>${esc(label)}${options.required ? ' *' : ''}</span>
      <select name="${eattr(name)}" ${options.required ? 'required' : ''}>
        ${options.blank === false ? '' : `<option value="">${esc(options.placeholder || 'Selecione')}</option>`}
        ${list}
      </select>
    </label>`;
  }

  function selectFieldWithAdd(label, name, optionsList, current = '', options = {}) {
    const values = optionsList.map(opt => String(typeof opt === 'object' ? opt.value : opt));
    const extra = current && !values.includes(String(current)) ? [current] : [];
    const list = [...optionsList, ...extra].map(opt => {
      const value = typeof opt === 'object' ? opt.value : opt;
      const text = typeof opt === 'object' ? opt.label : opt;
      return `<option value="${eattr(value)}" ${String(value) === String(current) ? 'selected' : ''}>${esc(text)}</option>`;
    }).join('');
    return `<div class="field-with-add ${options.className || ''}">
      <label class="field">
        <span>${esc(label)}${options.required ? ' *' : ''}</span>
        <select name="${eattr(name)}" data-quick-select="${eattr(name)}" ${options.required ? 'required' : ''}>
          ${options.blank === false ? '' : `<option value="">${esc(options.placeholder || 'Selecione')}</option>`}
          ${list}
          <option value="__new__">➕ Criar novo(a)...</option>
        </select>
      </label>
      <div class="quick-add-box is-hidden" data-quick-add-box="${eattr(name)}">
        <input type="text" placeholder="Nome do(a) novo(a) ${esc(options.itemLabel || label.toLowerCase())}" data-quick-add-input>
        <button type="button" class="btn secondary compact" data-quick-add-confirm>Adicionar</button>
      </div>
      ${options.help ? `<small>${esc(options.help)}</small>` : ''}
    </div>`;
  }

  async function wireQuickAddSelect(form, name, settingsKey, { sort = false, label = 'item' } = {}) {
    const select = form.elements[name];
    const box = form.querySelector(`[data-quick-add-box="${CSS.escape(name)}"]`);
    if (!select || !box) return;
    const input = box.querySelector('[data-quick-add-input]');
    const confirmBtn = box.querySelector('[data-quick-add-confirm]');
    select.addEventListener('change', () => {
      if (select.value === '__new__') { box.classList.remove('is-hidden'); input.focus(); }
      else box.classList.add('is-hidden');
    });
    confirmBtn.addEventListener('click', async () => {
      const value = input.value.trim();
      if (!value) { input.focus(); return; }
      const list = data().settings[settingsKey] || (data().settings[settingsKey] = []);
      const duplicate = list.find(x => normalize(x) === normalize(value));
      const finalValue = duplicate || value;
      if (!duplicate) {
        list.push(value);
        await persist(`Novo(a) ${label} cadastrado(a)`, { detail: finalValue });
      }
      select.innerHTML = `<option value="">Selecione</option>${list.map(x => `<option value="${eattr(x)}" ${x === finalValue ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__new__">➕ Criar novo(a)...</option>`;
      select.value = finalValue;
      box.classList.add('is-hidden');
      input.value = '';
      toast(duplicate ? `"${finalValue}" já estava cadastrado(a).` : `${finalValue} adicionado(a).`);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); } });
  }

  function checkField(label, name, checked = false, help = '') {
    return `<label class="check-field">
      <input type="checkbox" name="${eattr(name)}" ${checked ? 'checked' : ''}>
      <span><strong>${esc(label)}</strong>${help ? `<small>${esc(help)}</small>` : ''}</span>
    </label>`;
  }

  function formObject(form) {
    const object = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('[data-money-input][name]').forEach(input => {
      object[input.name] = String(parseMoneyInputValue(input.value));
    });
    return object;
  }

  function openModal({ title, sub = '', content, submitText = 'Salvar', cancelText = 'Cancelar', onSubmit, wide = false, extraFooter = '', deleteAction = '', deleteId = '', deleteText = 'Excluir' }) {
    const sequence = ++MODAL_SEQUENCE;
    clearTimeout(MODAL_CLOSE_TIMER);
    clearTimeout(MODAL_FOCUS_TIMER);
    modalSubmitHandler = onSubmit || null;
    const root = $('#modal-root');
    const template = document.createElement('template');
    const hasSecondaryRow = (deleteAction && deleteId) || extraFooter;
    template.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
      <section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${eattr(title)}">
        <header class="modal-header">
          <div><h2>${esc(title)}</h2>${sub ? `<p class="modal-sub">${esc(sub)}</p>` : ''}</div>
          <button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('x',22)}</button>
        </header>
        <form id="app-modal-form">
          <div class="modal-body">${content}</div>
          <footer class="modal-footer">
            ${hasSecondaryRow ? `<div class="modal-footer-secondary">
              ${deleteAction && deleteId ? `<button type="button" class="btn danger-soft modal-delete-action" data-action="${eattr(deleteAction)}" data-id="${eattr(deleteId)}">${icon('trash',17)} ${esc(deleteText)}</button>` : ''}
              ${extraFooter}
            </div>` : ''}
            <div class="modal-footer-primary">
              <button type="button" class="btn ghost" data-action="close-modal">${esc(cancelText)}</button>
              ${onSubmit ? `<button type="submit" class="btn primary">${icon('check',18)} ${esc(submitText)}</button>` : ''}
            </div>
          </footer>
        </form>
      </section>
    </div>`;
    root.replaceChildren(template.content.cloneNode(true));
    document.body.classList.add('modal-open');
    const backdrop = root.firstElementChild;
    requestAnimationFrame(() => {
      if (sequence !== MODAL_SEQUENCE || !backdrop?.isConnected) return;
      backdrop.classList.add('is-open');
    });
    if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(max-width:600px)').matches) {
      MODAL_FOCUS_TIMER = window.setTimeout(() => {
        if (sequence !== MODAL_SEQUENCE) return;
        $('#app-modal-form input:not([type="hidden"]), #app-modal-form select, #app-modal-form textarea')?.focus({preventScroll:true});
      }, 190);
    }
  }

  function closeModal() {
    const root = $('#modal-root');
    const backdrop = root?.firstElementChild;
    const sequence = ++MODAL_SEQUENCE;
    clearTimeout(MODAL_CLOSE_TIMER);
    clearTimeout(MODAL_FOCUS_TIMER);
    modalSubmitHandler = null;
    if (!backdrop) {
      document.body.classList.remove('modal-open');
      return;
    }
    backdrop.classList.remove('is-open');
    backdrop.classList.add('is-closing');
    MODAL_CLOSE_TIMER = window.setTimeout(() => {
      if (sequence !== MODAL_SEQUENCE) return;
      root.replaceChildren();
      document.body.classList.remove('modal-open');
    }, 150);
  }

  function ensurePickerRoot() {
    let root = $('#picker-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'picker-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function wheelColumn(name, items, selected) {
    return `<div class="ios-wheel-column" data-wheel="${eattr(name)}">
      <div class="ios-wheel-spacer"></div>
      ${items.map(item => `<button type="button" class="ios-wheel-item ${String(item.value) === String(selected) ? 'selected' : ''}" data-wheel-value="${eattr(item.value)}">${esc(item.label)}</button>`).join('')}
      <div class="ios-wheel-spacer"></div>
    </div>`;
  }

  function closeWheelPicker() {
    const root = ensurePickerRoot();
    const sheet = $('.ios-wheel-sheet', root);
    const backdrop = $('.ios-wheel-backdrop', root);
    sheet?.classList.add('closing');
    backdrop?.classList.add('closing');
    setTimeout(() => { root.innerHTML = ''; PICKER_STATE = null; }, 220);
  }

  function setWheelSelection(column, value, smooth = false) {
    if (!column) return;
    const items = $$('.ios-wheel-item', column);
    const index = Math.max(0, items.findIndex(item => String(item.dataset.wheelValue) === String(value)));
    items.forEach((item, i) => item.classList.toggle('selected', i === index));
    column.scrollTo({ top: index * 44, behavior: smooth ? 'smooth' : 'auto' });
    if (PICKER_STATE) PICKER_STATE.values[column.dataset.wheel] = items[index]?.dataset.wheelValue;
  }

  function openWheelPicker(input, type) {
    if (!input || !['date','time'].includes(type)) return;
    const root = ensurePickerRoot();
    const now = new Date();
    const current = input.value || (type === 'date' ? todayIso() : `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    let columns = '';
    let values = {};
    if (type === 'date') {
      const [year, month, day] = current.split('-').map(Number);
      values = { day: String(day || now.getDate()), month: String(month || now.getMonth() + 1), year: String(year || now.getFullYear()) };
      const days = Array.from({length:31}, (_,i)=>({value:String(i+1),label:String(i+1).padStart(2,'0')}));
      const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((label,i)=>({value:String(i+1),label}));
      const years = Array.from({length:121}, (_,i)=>({value:String(1920+i),label:String(1920+i)}));
      columns = wheelColumn('day', days, values.day) + wheelColumn('month', months, values.month) + wheelColumn('year', years, values.year);
    } else {
      const [hour, minute] = current.split(':').map(Number);
      values = { hour: String(Number.isFinite(hour) ? hour : now.getHours()), minute: String(Number.isFinite(minute) ? minute : now.getMinutes()) };
      const hours = Array.from({length:24}, (_,i)=>({value:String(i),label:String(i).padStart(2,'0')}));
      const minutes = Array.from({length:60}, (_,i)=>({value:String(i),label:String(i).padStart(2,'0')}));
      columns = wheelColumn('hour', hours, values.hour) + wheelColumn('minute', minutes, values.minute);
    }
    PICKER_STATE = { input, type, values };
    root.innerHTML = `<div class="ios-wheel-backdrop" data-picker-backdrop>
      <section class="ios-wheel-sheet" role="dialog" aria-modal="true" aria-label="${type === 'date' ? 'Selecionar data' : 'Selecionar horário'}">
        <header><button type="button" data-action="close-wheel-picker">Cancelar</button><strong>${type === 'date' ? 'Data' : 'Horário'}</strong><button type="button" class="confirm" data-action="confirm-wheel-picker">OK</button></header>
        <div class="ios-wheel-stage"><div class="ios-wheel-selection"></div>${columns}${type === 'time' ? '<span class="ios-wheel-colon">:</span>' : ''}</div>
      </section>
    </div>`;
    requestAnimationFrame(() => {
      $$('[data-wheel]', root).forEach(column => {
        setWheelSelection(column, values[column.dataset.wheel], false);
        $$('.ios-wheel-item', column).forEach(item => item.addEventListener('click', () => setWheelSelection(column, item.dataset.wheelValue, true)));
        let timer;
        column.addEventListener('scroll', () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            const items = $$('.ios-wheel-item', column);
            const index = Math.max(0, Math.min(items.length - 1, Math.round(column.scrollTop / 44)));
            items.forEach((item, i) => item.classList.toggle('selected', i === index));
            if (PICKER_STATE) PICKER_STATE.values[column.dataset.wheel] = items[index]?.dataset.wheelValue;
          }, 70);
        }, {passive:true});
      });
    });
  }

  function confirmWheelPicker() {
    if (!PICKER_STATE) return;
    const { input, type, values } = PICKER_STATE;
    if (type === 'date') {
      const year = Number(values.year), month = Number(values.month), rawDay = Number(values.day);
      const maxDay = new Date(year, month, 0).getDate();
      const day = Math.min(rawDay, maxDay);
      input.value = `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    } else {
      input.value = `${String(values.hour).padStart(2,'0')}:${String(values.minute).padStart(2,'0')}`;
    }
    input.dispatchEvent(new Event('change', { bubbles:true }));
    const form = input.closest('form');
    const label = form?.querySelector(`[data-picker-label-for="${input.name}"]`);
    if (label) label.textContent = pickerDisplay(type, input.value);
    closeWheelPicker();
  }

  
