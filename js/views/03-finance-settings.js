'use strict';

/**
 * Amanda Estética — Financeiro e Configurações.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function renderFinance() {
    ensureUiFilters();
    const d=data();
    const scope=FINANCE_FILTER.scope;
    const base=scope==='month' ? d.finance.filter(f=>String(f.date||'').startsWith(FINANCE_FILTER.month)) : d.finance.slice();
    const summary=summarizeFinance(base);
    const list=base.filter(f=>containsSearch(f.description,f.clientName,f.category,f.paymentMethod,f.status,f.date)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const monthly=scope==='month';
    const periodText=monthly ? new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(dateFromIso(`${FINANCE_FILTER.month}-01`)) : 'todo o histórico da clínica';
    return `<section class="section-head finance-section-head">
      <div><span class="eyebrow">Controle básico</span><h2>Financeiro</h2><p id="finance-period-description">Visualizando ${periodText}. Lançamentos cancelados não entram nos totais.</p></div>
      <div class="head-actions finance-head-actions">
        ${expandableFilterControl({
          ariaLabel:'Período financeiro',
          current:scope,
          action:'set-finance-scope',
          className:'finance-filter-expandable',
          options:[
            {value:'all',icon:'chart',label:'Visão geral',attrs:'data-value="all"'},
            {value:'month',icon:'calendar',label:'Mensal',attrs:'data-value="month"'}
          ]
        })}
        <span class="finance-month-slot">${monthly?`<label class="inline-filter"><span>Mês</span><input id="finance-month-filter" type="month" value="${eattr(FINANCE_FILTER.month)}"></label>`:''}</span>
        <button class="btn secondary" data-action="export-finance-csv">${icon('download',18)} CSV</button>
        <button class="btn primary" data-action="add-finance">${icon('plus',18)} Lançamento</button>
      </div>
    </section>
    <section class="stats-grid finance-stats" data-view-content="finance-stats">
      ${statCard(monthly?'Entradas no mês':'Entradas recebidas',currency(summary.income),`${summary.paidIncomeCount} lançamento${summary.paidIncomeCount!==1?'s':''} pago${summary.paidIncomeCount!==1?'s':''}`,'wallet')}
      ${statCard(monthly?'Saídas no mês':'Saídas pagas',currency(summary.expense),`${summary.paidExpenseCount} custo${summary.paidExpenseCount!==1?'s':''} contabilizado${summary.paidExpenseCount!==1?'s':''}`,'wallet','danger')}
      ${statCard(monthly?'Resultado do mês':'Resultado geral',currency(summary.balance),summary.balance>=0?'Positivo':'Negativo','wallet',summary.balance<0?'danger':'')}
      ${statCard('A receber',currency(summary.pending),`${summary.pendingCount} pendência${summary.pendingCount!==1?'s':''}`,'clock','warn')}
    </section>
    <section class="list-panel" data-view-content="finance">
      ${list.length ? list.map(f=>{
        const type=canonicalFinanceType(f.type);
        return `<article class="list-row finance-row ${isFinanceCanceled(f)?'is-canceled':''}">
          <div class="finance-type ${type}">${type==='income'?'＋':'−'}</div>
          <div class="row-main"><strong>${esc(f.description || f.category)}</strong><span>${esc([f.clientName,f.category].filter(Boolean).join(' · '))}</span><small>${formatDate(f.date)} · ${esc(f.paymentMethod || '—')} · ${esc(f.origin || 'Manual')}</small></div>
          <div class="row-value ${type}"><strong>${type==='income'?'+':'−'} ${currency(f.value)}</strong><small>${esc(f.status || 'Pago')}</small></div>
          <div class="row-actions">${f.sourceLocked||f.attendanceId||f.packageFinanceKind?`<span class="source-lock" title="Gerado automaticamente">${icon('lock',16)}</span>`:`<button class="icon-btn small" data-action="edit-finance" data-id="${eattr(f.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-finance" data-id="${eattr(f.id)}">${icon('trash',16)}</button>`}</div>
        </article>`;
      }).join('') : emptyState('Nenhum lançamento neste período','Altere a visualização ou adicione uma entrada ou saída.','add-finance','Novo lançamento')}
    </section>`;
  }

  const SETTINGS_SECTIONS = Object.freeze({
    overview: { label:'Resumo da base', icon:'chart' },
    profile: { label:'Perfil e clínica', icon:'users' },
    personalization: { label:'Personalização', icon:'settings' },
    catalogs: { label:'Marcas e categorias', icon:'layers' },
    backup: { label:'Backup e segurança', icon:'save' }
  });

  let SETTINGS_SECTION = 'overview';
  let SETTINGS_ORDERING_KEY = '';

  const SETTINGS_TAG_REFERENCES = Object.freeze({
    productCategories: { collection:'products', field:'category', label:'categoria de produto' },
    productBrands: { collection:'products', field:'brand', label:'marca de produto' },
    disposableCategories: { collection:'disposables', field:'category', label:'categoria de descartável' },
    disposableUnits: { collection:'disposables', field:'unit', label:'unidade de descartável' },
    financeCategories: { collection:'finance', field:'category', label:'categoria financeira' },
    costCenters: { collection:'finance', field:'costCenter', label:'centro de custo' },
    photoAreas: { collection:'photos', field:'area', label:'área tratada' },
    skinTypes: { collection:'anamneses', field:'skinType', label:'tipo de pele' }
  });

  function normalizeSettingsSection(value) {
    return SETTINGS_SECTIONS[value] ? value : 'overview';
  }

  function setSettingsSection(section) {
    SETTINGS_SECTION = normalizeSettingsSection(section);
    SETTINGS_ORDERING_KEY = '';
    renderView('page-enter-soft');
    requestAnimationFrame(() => {
      const target = document.querySelector('.settings-section-content');
      if (!target) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block:'start', behavior:reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function resetSettingsSection() {
    SETTINGS_SECTION = 'overview';
    SETTINGS_ORDERING_KEY = '';
  }

  function settingsTagReference(settingsKey) {
    return SETTINGS_TAG_REFERENCES[settingsKey] || null;
  }

  function settingsTagUsage(settingsKey, value) {
    const ref = settingsTagReference(settingsKey);
    if (!ref) return [];
    const list = data()[ref.collection];
    if (!Array.isArray(list)) return [];
    const target = normalize(value);
    return list.filter(item => normalize(item?.[ref.field]) === target);
  }

  function replaceSettingsTagReferences(settingsKey, oldValue, newValue) {
    const ref = settingsTagReference(settingsKey);
    if (!ref) return 0;
    const list = data()[ref.collection];
    if (!Array.isArray(list)) return 0;
    const target = normalize(oldValue);
    let changed = 0;
    list.forEach(item => {
      if (normalize(item?.[ref.field]) !== target) return;
      item[ref.field] = newValue;
      item.updatedAt = nowIso();
      changed += 1;
    });
    return changed;
  }

  async function moveSettingTag(settingsKey, fromIndex, toIndex) {
    const list = data().settings[settingsKey];
    if (!Array.isArray(list)) return;
    if (fromIndex < 0 || fromIndex >= list.length) return;
    if (toIndex < 0 || toIndex >= list.length) return;
    if (fromIndex === toIndex) return;
    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    await persist('Ordem das configurações alterada', { detail:`${settingsKey}: ${item}` });
    renderView();
    toast(`Ordem de “${item}” atualizada.`);
  }

  function toggleSettingsTagOrdering(settingsKey) {
    const list = data().settings[settingsKey];
    if (!Array.isArray(list)) return;
    SETTINGS_ORDERING_KEY = SETTINGS_ORDERING_KEY === settingsKey ? '' : settingsKey;
    renderView('page-enter-soft');
  }

  function openRenameSettingTag(settingsKey, value) {
    const list = data().settings[settingsKey];
    const index = Array.isArray(list) ? list.findIndex(item => item === value) : -1;
    if (index < 0) return;
    const ref = settingsTagReference(settingsKey);
    const usageCount = settingsTagUsage(settingsKey, value).length;
    openModal({
      title:'Renomear item',
      sub:usageCount ? `${usageCount} registro(s) vinculado(s) também serão atualizados.` : 'A nova identificação será usada nos próximos cadastros.',
      content:`<div class="form-grid one-col">
        ${field('Novo nome','name',value,'text',{required:true})}
      </div>`,
      submitText:'Salvar nome',
      onSubmit:async form => {
        const nextValue = String(formObject(form).name || '').trim();
        if (!nextValue) throw new Error('Digite um nome válido.');
        const duplicate = list.find((item, itemIndex) => itemIndex !== index && normalize(item) === normalize(nextValue));
        if (duplicate) throw new Error(`“${duplicate}” já está cadastrado.`);
        const previousValue = list[index];
        list[index] = nextValue;
        const updated = replaceSettingsTagReferences(settingsKey, previousValue, nextValue);
        await persist('Item das configurações renomeado', { detail:`${previousValue} → ${nextValue} · ${updated} vínculo(s)` });
        closeModal();
        renderView();
        toast(`${nextValue} salvo e ${updated} vínculo(s) atualizado(s).`);
      }
    });
  }

  async function removeSettingTagSafely(settingsKey, value) {
    const list = data().settings[settingsKey];
    if (!Array.isArray(list)) return;
    const index = list.findIndex(item => item === value);
    if (index < 0) return;
    const usage = settingsTagUsage(settingsKey, value);
    if (!usage.length) {
      const confirmed = await confirmAction(`Excluir “${value}” desta lista?`, { title:'Excluir item', confirmText:'Excluir', tone:'danger' });
      if (!confirmed) return;
      list.splice(index, 1);
      await persist('Item removido das configurações', { detail:`${settingsKey}: ${value}` });
      renderView();
      toast(`${value} excluído.`);
      return;
    }

    const alternatives = list.filter(item => item !== value);
    const ref = settingsTagReference(settingsKey);
    if (!alternatives.length) {
      openModal({
        title:'Item em uso',
        sub:'A exclusão foi bloqueada para proteger os dados.',
        content:`<div class="settings-blocked-delete">${icon('lock',22)}<p>“${esc(value)}” está vinculado a <strong>${usage.length} registro(s)</strong>. Cadastre outro ${esc(ref?.label || 'item')} e substitua os vínculos antes de excluir.</p></div>`,
        cancelText:'Fechar'
      });
      return;
    }

    openModal({
      title:'Substituir antes de excluir',
      sub:`“${value}” está vinculado a ${usage.length} registro(s).`,
      content:`<div class="form-grid one-col">
        <div class="settings-linked-warning">${icon('refresh',20)}<p>Escolha o item que substituirá “${esc(value)}” em todos os registros vinculados.</p></div>
        ${selectField('Substituir por','replacement',alternatives,'',{required:true})}
      </div>`,
      submitText:'Substituir e excluir',
      onSubmit:async form => {
        const replacement = String(formObject(form).replacement || '').trim();
        if (!replacement || !alternatives.includes(replacement)) throw new Error('Escolha um item substituto.');
        const updated = replaceSettingsTagReferences(settingsKey, value, replacement);
        const currentIndex = list.findIndex(item => item === value);
        if (currentIndex >= 0) list.splice(currentIndex, 1);
        await persist('Item substituído e removido das configurações', { detail:`${value} → ${replacement} · ${updated} vínculo(s)` });
        closeModal();
        renderView();
        toast(`${updated} vínculo(s) movido(s) para ${replacement}.`);
      }
    });
  }

  function renderSettingsMenu() {
    const current = SETTINGS_SECTIONS[normalizeSettingsSection(SETTINGS_SECTION)];
    const options = Object.entries(SETTINGS_SECTIONS).map(([key, section]) => `<button type="button" class="settings-menu-item ${SETTINGS_SECTION===key?'active':''}" data-action="set-settings-section" data-section="${key}" ${SETTINGS_SECTION===key?'aria-current="page"':''}>${icon(section.icon,18)}<span>${esc(section.label)}</span>${icon('chevron',16)}</button>`).join('');
    return `<aside class="settings-mini-menu" aria-label="Seções das configurações">
      <nav>${options}</nav>
    </aside>
    <details class="settings-mobile-menu">
      <summary>${icon(current.icon,18)}<span>${esc(current.label)}</span>${icon('chevron',16)}</summary>
      <nav>${options}</nav>
    </details>`;
  }

  function renderSettingsProfileHero(p, c, compact=false) {
    return `<article class="ios-profile-hero settings-profile-hero ${compact?'is-compact':''}">
      <div class="ios-profile-photo">${profileAvatar(p,'xlarge')}<button type="button" data-action="edit-profile" title="Alterar foto" aria-label="Alterar foto">${icon('camera',15)}</button></div>
      <div><span class="settings-active-profile">Perfil ativo</span><h3>${esc(p.name)}</h3><strong>${esc(c.clinicName || 'Amanda Estética')}</strong><p>${esc(p.role || 'Proprietária da clínica')}</p></div>
      <button type="button" class="ios-chevron-button" data-action="edit-profile" aria-label="Editar perfil">${icon('chevron',22)}</button>
    </article>`;
  }

  function renderSettingsOverview() {
    const p=activeProfile();
    const d=data();
    const c=p.clinic || {};
    const stats=[
      ['Clientes',d.clients.length,'users'],
      ['Protocolos',d.protocols.length,'clipboard'],
      ['Produtos',d.products.length,'flask'],
      ['Descartáveis',d.disposables.length,'layers'],
      ['Pacotes',d.packages.length,'package'],
      ['Agendamentos',d.appointments.length,'calendar'],
      ['Atendimentos',d.attendances.length,'clipboard'],
      ['Anamneses',d.anamneses.length,'heart'],
      ['Termos de consentimento',d.consents.length,'signature'],
      ['Fotos',d.photos.length,'camera']
    ];
    return `<div class="settings-section-stack">
      ${renderSettingsProfileHero(p,c)}
      <section class="settings-panel">
        <header class="settings-panel-heading"><div><span class="eyebrow">Consulta rápida</span><h3>Dados da clínica</h3><p>Informações principais do perfil ativo.</p></div></header>
        <div class="ios-clinic-summary settings-clinic-summary">
          <div><span>Clínica</span><strong>${esc(c.clinicName || '—')}</strong></div>
          <div><span>Telefone</span><strong>${esc(c.phone || '—')}</strong></div>
          <div><span>E-mail</span><strong>${esc(c.email || '—')}</strong></div>
          <div><span>CRBM</span><strong>${esc(c.crbm || '—')}</strong></div>
          <div class="wide"><span>Endereço</span><strong>${esc([c.address,c.number,c.neighborhood,c.city].filter(Boolean).join(', ') || '—')}</strong></div>
          <button type="button" class="btn secondary" data-action="set-settings-section" data-section="profile">Gerenciar perfil e clínica</button>
        </div>
      </section>
      <section class="settings-panel">
        <header class="settings-panel-heading"><div><span class="eyebrow">Base atual</span><h3>Resumo da base</h3><p>Contadores calculados diretamente dos dados deste perfil.</p></div></header>
        <div class="ios-database-stats settings-database-stats">${stats.map(([label,value,iconName])=>`<div><span>${icon(iconName,18)}</span><strong>${value}</strong><small>${esc(label)}</small></div>`).join('')}</div>
      </section>
    </div>`;
  }

  function renderSettingsProfileClinic() {
    const p=activeProfile();
    const c=p.clinic || {};
    return `<div class="settings-section-stack">
      <section class="settings-section-intro"><span class="eyebrow">Acessos e cadastro</span><h3>Perfil e clínica</h3><p>Gerencie os perfis e os dados profissionais sem alterar a estrutura dos registros.</p></section>
      ${renderSettingsProfileHero(p,c,true)}
      <section class="settings-panel">
        <header class="settings-panel-heading"><div><h3>Perfil ativo</h3><p>Foto, nome, função e PIN de acesso.</p></div><span class="settings-pin-status ${p.pin?'has-pin':''}">${icon(p.pin?'lock':'users',15)} ${p.pin?'PIN configurado':'Sem PIN'}</span></header>
        <div class="ios-settings-list settings-action-list">
          <button type="button" data-action="edit-profile"><span class="ios-setting-icon">${icon('edit',18)}</span><span><strong>Editar perfil</strong><small>Alterar nome, função, foto e PIN</small></span>${icon('chevron',18)}</button>
          <button type="button" data-action="create-profile"><span class="ios-setting-icon">${icon('plus',18)}</span><span><strong>Novo perfil</strong><small>Criar uma base independente e completa</small></span>${icon('chevron',18)}</button>
        </div>
      </section>
      <section class="settings-panel">
        <header class="settings-panel-heading"><div><h3>Dados da clínica</h3><p>Contato, registro profissional, endereço e observação padrão.</p></div></header>
        <div class="ios-clinic-summary settings-clinic-summary">
          <div><span>Clínica</span><strong>${esc(c.clinicName || '—')}</strong></div>
          <div><span>CPF/CNPJ</span><strong>${esc(c.document || '—')}</strong></div>
          <div><span>CRBM</span><strong>${esc(c.crbm || '—')}</strong></div>
          <div><span>Telefone</span><strong>${esc(c.phone || '—')}</strong></div>
          <div><span>E-mail</span><strong>${esc(c.email || '—')}</strong></div>
          <div class="wide"><span>Endereço</span><strong>${esc([c.address,c.number,c.neighborhood,c.city,c.zip].filter(Boolean).join(', ') || '—')}</strong></div>
          <button type="button" class="btn primary" data-action="edit-clinic">Editar dados da clínica</button>
        </div>
      </section>
    </div>`;
  }

  function renderSettingsPersonalization() {
    return `<div class="settings-section-stack">
      <section class="settings-section-intro"><span class="eyebrow">Aparência do dispositivo</span><h3>Personalização</h3><p>Ajuste a forma como o aplicativo aparece neste dispositivo.</p></section>
      <section class="settings-panel">
        <header class="settings-panel-heading"><div><h3>Modo de interface</h3><p>Escolha manualmente ou deixe o sistema reconhecer o tamanho da tela.</p></div></header>
        <div class="ios-interface-card settings-interface-card">${interfaceModeSelector()}</div>
      </section>
    </div>`;
  }

  function renderTagManager(title, settingsKey, help='') {
    const items = data().settings[settingsKey] || [];
    const ordering = SETTINGS_ORDERING_KEY === settingsKey;
    return `<section class="tag-manager" data-settings-tag-manager="${eattr(settingsKey)}">
      <header class="tag-manager-heading"><div><strong>${esc(title)}</strong>${help ? `<small>${esc(help)}</small>` : ''}</div><button type="button" class="btn ${ordering?'primary':'secondary'} compact" data-action="toggle-setting-order" data-key="${eattr(settingsKey)}">${icon(ordering?'check':'layers',15)} ${ordering?'Concluir ordem':'Organizar ordem'}</button></header>
      <div class="settings-tag-items ${ordering?'is-ordering':''}">${items.length ? items.map((item,index) => `<article class="settings-tag-item" data-settings-tag-item data-key="${eattr(settingsKey)}" data-index="${index}">
        ${ordering?`<button type="button" class="settings-tag-drag" data-tag-drag-handle data-key="${eattr(settingsKey)}" data-index="${index}" aria-label="Arrastar ${esc(item)}">${icon('menu',17)}</button><span class="settings-tag-position" aria-label="Posição ${index+1}">${index+1}</span>`:''}
        <span class="settings-tag-name">${esc(item)}</span>
        <div class="settings-tag-actions">${ordering?`<button type="button" class="icon-btn tiny" data-action="move-setting-tag" data-key="${eattr(settingsKey)}" data-index="${index}" data-direction="up" ${index===0?'disabled':''} aria-label="Mover ${esc(item)} para cima">↑</button><button type="button" class="icon-btn tiny" data-action="move-setting-tag" data-key="${eattr(settingsKey)}" data-index="${index}" data-direction="down" ${index===items.length-1?'disabled':''} aria-label="Mover ${esc(item)} para baixo">↓</button>`:`<button type="button" class="icon-btn tiny" data-action="edit-setting-tag" data-key="${eattr(settingsKey)}" data-value="${eattr(item)}" aria-label="Editar ${esc(item)}">${icon('edit',13)}</button><button type="button" class="icon-btn tiny danger" data-action="remove-setting-tag" data-key="${eattr(settingsKey)}" data-value="${eattr(item)}" aria-label="Excluir ${esc(item)}">${icon('trash',13)}</button>`}</div>
      </article>`).join('') : '<span class="muted tag-empty">Nenhum cadastrado ainda.</span>'}</div>
      ${ordering?'':`<div class="tag-add-row"><input type="text" placeholder="Adicionar..." data-tag-input aria-label="Novo item em ${esc(title)}"><button type="button" class="btn secondary compact" data-action="add-setting-tag" data-key="${eattr(settingsKey)}">${icon('plus',15)} Adicionar</button></div>`}
    </section>`;
  }

  function renderCatalogGroup(title, iconName, managers, open=false) {
    return `<details class="settings-catalog-group" ${open?'open':''}>
      <summary><span>${icon(iconName,19)}</span><strong>${esc(title)}</strong>${icon('chevron',17)}</summary>
      <div class="tag-manager-grid">${managers.join('')}</div>
    </details>`;
  }

  function renderSettingsCatalogs() {
    return `<div class="settings-section-stack">
      <section class="settings-section-intro"><span class="eyebrow">Cadastros auxiliares</span><h3>Marcas e categorias</h3><p>Adicione, renomeie, exclua com segurança e escolha a ordem exibida nos formulários.</p></section>
      <div class="settings-catalog-groups">
        ${renderCatalogGroup('Produtos','flask',[renderTagManager('Categorias de produtos','productCategories'),renderTagManager('Marcas de produtos','productBrands')],true)}
        ${renderCatalogGroup('Descartáveis','layers',[renderTagManager('Categorias de descartáveis','disposableCategories'),renderTagManager('Unidades de descartáveis','disposableUnits')])}
        ${renderCatalogGroup('Financeiro','wallet',[renderTagManager('Categorias financeiras','financeCategories'),renderTagManager('Centros de custo','costCenters','Em qual área da clínica a entrada ou saída se originou.')])}
        ${renderCatalogGroup('Clínica e prontuários','heart',[renderTagManager('Áreas tratadas nas fotos','photoAreas','Usadas ao registrar fotos de antes e depois.'),renderTagManager('Tipos de pele','skinTypes','Usados na anamnese.')])}
      </div>
    </div>`;
  }

  function renderSettingsGoogleDrive() {
    const d=data();
    const lastGoogle=localStorage.getItem('amanda_clinica_last_google_save');
    const googleUser=window.GoogleDriveClinic?.cachedUser?.();
    const googleConfigured=window.GoogleDriveClinic?.isConfigured?.() || false;
    return `<section class="settings-backup-block">
      <header><span class="settings-backup-icon">${icon('upload',19)}</span><div><h3>Google Drive</h3><p>${googleConfigured?'Conta e pasta privadas conectadas.':'Conecte a conta privada da clínica.'}</p></div></header>
      <div class="ios-cloud-card">
        <div class="ios-cloud-status"><span class="sync-dot ${googleConfigured?'online':''}"></span><div><strong>${googleConfigured?'Google Drive conectado':'Google Drive não conectado'}</strong><small>${googleUser?`${esc(googleUser.email)}${lastGoogle?` · último envio ${formatDateTime(lastGoogle)}`:''}`:'O aplicativo continua funcionando localmente quando estiver offline.'}</small></div></div>
        <div class="ios-action-grid">
          <button type="button" class="btn primary" data-action="connect-google">${icon('folder',17)} ${googleConfigured?'Trocar pasta':'Conectar'}</button>
          <button type="button" class="btn secondary" data-action="sync-google">${icon('refresh',17)} Sincronizar</button>
          <button type="button" class="btn secondary" data-action="load-google">${icon('upload',17)} Carregar</button>
          <button type="button" class="btn ghost" data-action="disconnect-google">${icon('x',17)} Desconectar</button>
        </div>
        ${checkField('Salvar automaticamente no Google Drive','autosaveGoogle',d.settings.autosaveGoogle!==false,'Cada alteração também atualiza o JSON na pasta privada escolhida.')}
      </div>
    </section>`;
  }

  function renderSettingsFolderBackup() {
    const d=data();
    const lastFolder=localStorage.getItem('amanda_clinica_last_folder_save');
    return `<section class="settings-backup-block">
      <header><span class="settings-backup-icon">${icon('folder',19)}</span><div><h3>Pasta do computador</h3><p>Usa a File System Access API e mantém a pasta autorizada pelo navegador.</p></div></header>
      <div class="ios-cloud-card">
        <div class="ios-cloud-status"><span class="sync-dot ${lastFolder?'online':''}"></span><div><strong>${lastFolder?'Pasta configurada':'Pasta não conectada'}</strong><small>${lastFolder?`Último envio: ${formatDateTime(lastFolder)}`:'O navegador poderá pedir permissão novamente depois de reiniciar.'}</small></div></div>
        <div class="ios-action-grid">
          <button type="button" class="btn primary" data-action="connect-folder">${icon('folder',17)} Conectar pasta</button>
          <button type="button" class="btn secondary" data-action="sync-folder">${icon('refresh',17)} Sincronizar</button>
          <button type="button" class="btn secondary" data-action="load-folder">${icon('upload',17)} Carregar</button>
          <button type="button" class="btn ghost" data-action="disconnect-folder">${icon('x',17)} Esquecer pasta</button>
        </div>
        ${checkField('Salvar automaticamente nessa pasta','autosaveFolder',d.settings.autosaveFolder!==false,'Cada alteração também atualiza o JSON da pasta autorizada.')}
      </div>
    </section>`;
  }

  function renderSettingsManualBackup() {
    return `<section class="settings-backup-block">
      <header><span class="settings-backup-icon">${icon('save',19)}</span><div><h3>Backup manual</h3><p>Exporte, importe e restaure cópias independentes da base.</p></div></header>
      <div class="ios-settings-list settings-action-list">
        <button type="button" data-action="create-local-backup"><span class="ios-setting-icon">${icon('save',18)}</span><span><strong>Criar backup local</strong><small>Gera uma cópia imediata neste dispositivo</small></span>${icon('chevron',18)}</button>
        <button type="button" data-action="export-json"><span class="ios-setting-icon">${icon('download',18)}</span><span><strong>Exportar JSON</strong><small>Baixar uma cópia independente</small></span>${icon('chevron',18)}</button>
        <button type="button" data-action="import-json"><span class="ios-setting-icon">${icon('upload',18)}</span><span><strong>Importar JSON</strong><small>Cria backup preventivo antes de substituir a base</small></span>${icon('chevron',18)}</button>
        <button type="button" data-action="show-backups"><span class="ios-setting-icon">${icon('clock',18)}</span><span><strong>Backups locais</strong><small>Consultar e restaurar cópias deste dispositivo</small></span>${icon('chevron',18)}</button>
        <button type="button" data-action="show-drive-backups"><span class="ios-setting-icon">${icon('folder',18)}</span><span><strong>Backups no Google Drive</strong><small>Consultar e restaurar cópias salvas na nuvem</small></span>${icon('chevron',18)}</button>
      </div>
    </section>`;
  }

  function renderSettingsSecurity() {
    const p=activeProfile();
    return `<section class="settings-backup-block">
      <header><span class="settings-backup-icon">${icon('lock',19)}</span><div><h3>Segurança</h3><p>Proteja o acesso ao aplicativo e verifique a integridade da base.</p></div></header>
      <div class="ios-settings-list settings-action-list">
        <button type="button" data-action="lock-app"><span class="ios-setting-icon">${icon('lock',18)}</span><span><strong>Bloquear aplicativo</strong><small>Voltar à tela de entrada</small></span>${icon('chevron',18)}</button>
        <button type="button" data-action="edit-profile"><span class="ios-setting-icon">${icon('edit',18)}</span><span><strong>${p.pin?'Alterar PIN do perfil':'Definir PIN do perfil'}</strong><small>O PIN permanece armazenado no perfil atual</small></span>${icon('chevron',18)}</button>
        <button type="button" data-action="show-integrity-report"><span class="ios-setting-icon">${icon('check',18)}</span><span><strong>Verificar integridade</strong><small>Confere vínculos, sessões, estoque e financeiro automático</small></span>${icon('chevron',18)}</button>
      </div>
      <div class="ios-security-note settings-security-note">${icon('check',18)}<span><strong>Dados clínicos exigem proteção</strong><small>Use bloqueio no dispositivo e restrinja o acesso à pasta do Google Drive. Backups não substituem a segurança física e a proteção da conta.</small></span></div>
    </section>`;
  }

  function renderSettingsBackupSecurity() {
    return `<div class="settings-section-stack">
      <section class="settings-section-intro"><span class="eyebrow">Continuidade e proteção</span><h3>Backup e segurança</h3><p>Todos os recursos de sincronização, restauração e proteção estão reunidos aqui.</p></section>
      <div class="settings-backup-grid">${renderSettingsGoogleDrive()}${renderSettingsFolderBackup()}${renderSettingsManualBackup()}${renderSettingsSecurity()}</div>
    </div>`;
  }

  function renderSettingsSectionContent() {
    const section = normalizeSettingsSection(SETTINGS_SECTION);
    const renderers = {
      overview:renderSettingsOverview,
      profile:renderSettingsProfileClinic,
      personalization:renderSettingsPersonalization,
      catalogs:renderSettingsCatalogs,
      backup:renderSettingsBackupSecurity
    };
    return renderers[section]();
  }

  function renderSettings() {
    SETTINGS_SECTION = normalizeSettingsSection(SETTINGS_SECTION);
    return `<section class="ios-settings-page settings-page-v118">
      <header class="ios-settings-heading settings-heading-v118">
        <div><span class="eyebrow">Sistema e dados</span><h2>Configurações</h2><p>Gerencie sua clínica com praticidade.</p></div>
        <button type="button" class="ios-round-action" data-action="manual-save" title="Salvar agora" aria-label="Salvar agora">${icon('save',21)}</button>
      </header>
      <div class="settings-workspace">
        ${renderSettingsMenu()}
        <main class="settings-section-content" data-settings-section="${eattr(SETTINGS_SECTION)}">${renderSettingsSectionContent()}</main>
      </div>
      <input id="json-file-input" type="file" accept=".json,application/json" hidden>
    </section>`;
  }

