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

  function renderTagManager(title, settingsKey, help='') {
    const items = data().settings[settingsKey] || [];
    return `<div class="tag-manager">
      <strong>${esc(title)}</strong>${help ? `<small>${esc(help)}</small>` : ''}
      <div class="tag-list">${items.length ? items.map(x => `<span class="tag-chip">${esc(x)}<button type="button" class="icon-btn tiny" data-action="remove-setting-tag" data-key="${eattr(settingsKey)}" data-value="${eattr(x)}" aria-label="Remover ${esc(x)}">${icon('x',12)}</button></span>`).join('') : '<span class="muted tag-empty">Nenhum cadastrado ainda.</span>'}</div>
      <div class="tag-add-row"><input type="text" placeholder="Adicionar..." data-tag-input><button type="button" class="btn secondary compact" data-action="add-setting-tag" data-key="${eattr(settingsKey)}">${icon('plus',15)} Adicionar</button></div>
    </div>`;
  }

  function renderSettings() {
    const p=activeProfile();
    const d=data();
    const c=p.clinic || {};
    const lastFolder=localStorage.getItem('amanda_clinica_last_folder_save');
    const lastGoogle=localStorage.getItem('amanda_clinica_last_google_save');
    const googleUser=window.GoogleDriveClinic?.cachedUser?.();
    const googleConfigured=window.GoogleDriveClinic?.isConfigured?.() || false;
    return `<section class="ios-settings-page">
      <header class="ios-settings-heading">
        <div><span class="eyebrow">Sistema e dados</span><h2>Configurações</h2><p>Gerencie sua clínica com praticidade.</p></div>
        <button class="ios-round-action" data-action="manual-save" title="Salvar agora">${icon('save',21)}</button>
      </header>

      <article class="ios-profile-hero">
        <div class="ios-profile-photo">${profileAvatar(p,'xlarge')}<button data-action="edit-profile" title="Alterar foto">${icon('camera',15)}</button></div>
        <div><h3>${esc(p.name)}</h3><strong>${esc(c.clinicName || 'Amanda Estética')}</strong><p>${esc(p.role || 'Proprietária da clínica')}</p></div>
        <button class="ios-chevron-button" data-action="edit-profile" aria-label="Editar perfil">${icon('chevron',22)}</button>
      </article>

      <div class="ios-settings-layout">
        <div class="ios-settings-main">
          <section class="ios-settings-group interface-mode-settings">
            <h3>Modo de interface</h3>
            <div class="ios-interface-card">
              <div class="ios-interface-copy"><strong>Como o aplicativo deve aparecer</strong><small>Escolha manualmente ou deixe o sistema reconhecer o dispositivo.</small></div>
              ${interfaceModeSelector()}
            </div>
          </section>

          <section class="ios-settings-group">
            <h3>Perfil e clínica</h3>
            <div class="ios-settings-list">
              <button data-action="edit-profile"><span class="ios-setting-icon">${icon('users',18)}</span><span><strong>Perfil</strong><small>Nome, função, foto e senha de acesso</small></span>${icon('chevron',18)}</button>
              <button data-action="edit-clinic"><span class="ios-setting-icon">${icon('home',18)}</span><span><strong>Dados da clínica</strong><small>Contato, endereço e informações profissionais</small></span>${icon('chevron',18)}</button>
              <button data-action="create-profile"><span class="ios-setting-icon">${icon('plus',18)}</span><span><strong>Novo perfil</strong><small>Estrutura pronta para novos acessos</small></span>${icon('chevron',18)}</button>
              <button data-action="lock-app"><span class="ios-setting-icon">${icon('lock',18)}</span><span><strong>Bloquear aplicativo</strong><small>Voltar à tela de entrada com animação reversa</small></span>${icon('chevron',18)}</button>
            </div>
          </section>

          <section class="ios-settings-group">
            <h3>Marcas e categorias</h3>
            <div class="tag-manager-grid">
              ${renderTagManager('Categorias de produtos','productCategories')}
              ${renderTagManager('Marcas','productBrands','Mantidas em ordem alfabética.')}
              ${renderTagManager('Categorias financeiras','financeCategories')}
              ${renderTagManager('Centros de custo','costCenters','Em qual área da clínica a entrada ou saída se originou.')}
            </div>
          </section>

          <section class="ios-settings-group">
            <h3>Google Drive</h3>
            <div class="ios-cloud-card">
              <div class="ios-cloud-status"><span class="sync-dot ${googleConfigured?'online':''}"></span><div><strong>${googleConfigured?'Google Drive conectado':'Google Drive não conectado'}</strong><small>${googleUser?`${esc(googleUser.email)}${lastGoogle?` · último envio ${formatDateTime(lastGoogle)}`:''}`:'Conecte a conta privada da clínica.'}</small></div></div>
              <div class="ios-action-grid">
                <button class="btn primary" data-action="connect-google">${icon('folder',17)} ${googleConfigured?'Trocar pasta':'Conectar'}</button>
                <button class="btn secondary" data-action="sync-google">${icon('refresh',17)} Sincronizar</button>
                <button class="btn secondary" data-action="load-google">${icon('upload',17)} Carregar</button>
                <button class="btn ghost" data-action="disconnect-google">${icon('x',17)} Desconectar</button>
              </div>
              ${checkField('Salvar automaticamente no Google Drive','autosaveGoogle',d.settings.autosaveGoogle!==false,'Cada alteração também atualiza o JSON na pasta privada escolhida.')}
            </div>
          </section>

          <section class="ios-settings-group">
            <h3>Pasta do computador</h3>
            <div class="ios-cloud-card">
              <div class="ios-cloud-status"><span class="sync-dot ${lastFolder?'online':''}"></span><div><strong>${lastFolder?'Pasta configurada':'Pasta não conectada'}</strong><small>${lastFolder?`Último envio: ${formatDateTime(lastFolder)}`:'Alternativa para a pasta sincronizada pelo Google Drive para computador.'}</small></div></div>
              <div class="ios-action-grid">
                <button class="btn primary" data-action="connect-folder">${icon('folder',17)} Conectar</button>
                <button class="btn secondary" data-action="sync-folder">${icon('refresh',17)} Sincronizar</button>
                <button class="btn secondary" data-action="load-folder">${icon('upload',17)} Carregar</button>
                <button class="btn ghost" data-action="disconnect-folder">${icon('x',17)} Esquecer</button>
              </div>
              ${checkField('Salvar automaticamente nessa pasta','autosaveFolder',d.settings.autosaveFolder!==false,'Cada alteração também atualiza o JSON da pasta autorizada.')}
            </div>
          </section>

          <section class="ios-settings-group">
            <h3>Backup e segurança</h3>
            <div class="ios-settings-list">
              <button data-action="manual-save"><span class="ios-setting-icon">${icon('save',18)}</span><span><strong>Salvar agora</strong><small>Força uma cópia imediata dos dados</small></span>${icon('chevron',18)}</button>
              <button data-action="export-json"><span class="ios-setting-icon">${icon('download',18)}</span><span><strong>Exportar JSON</strong><small>Baixar uma cópia independente</small></span>${icon('chevron',18)}</button>
              <button data-action="import-json"><span class="ios-setting-icon">${icon('upload',18)}</span><span><strong>Importar JSON</strong><small>Restaurar ou migrar uma base</small></span>${icon('chevron',18)}</button>
              <button data-action="show-backups"><span class="ios-setting-icon">${icon('clock',18)}</span><span><strong>Backups locais</strong><small>Consultar cópias mantidas neste dispositivo</small></span>${icon('chevron',18)}</button>
              <button data-action="show-integrity-report"><span class="ios-setting-icon">${icon('check',18)}</span><span><strong>Verificar integridade</strong><small>Confere vínculos, sessões, estoque e financeiro automático</small></span>${icon('chevron',18)}</button>
            </div>
            <input id="json-file-input" type="file" accept=".json,application/json" hidden>
          </section>
        </div>

        <aside class="ios-settings-aside">
          <section class="ios-settings-group sticky-group">
            <h3>Dados da clínica</h3>
            <div class="ios-clinic-summary">
              <div><span>Clínica</span><strong>${esc(c.clinicName || '—')}</strong></div>
              <div><span>Telefone</span><strong>${esc(c.phone || '—')}</strong></div>
              <div><span>E-mail</span><strong>${esc(c.email || '—')}</strong></div>
              <div><span>CRBM</span><strong>${esc(c.crbm || '—')}</strong></div>
              <div class="wide"><span>Endereço</span><strong>${esc([c.address,c.number,c.neighborhood,c.city].filter(Boolean).join(', ') || '—')}</strong></div>
              <button class="btn secondary" data-action="edit-clinic">Editar dados</button>
            </div>
          </section>
          <section class="ios-settings-group">
            <h3>Resumo da base</h3>
            <div class="ios-database-stats">
              ${[['Clientes',d.clients.length,'users'],['Protocolos',d.protocols.length,'clipboard'],['Produtos',d.products.length,'flask'],['Pacotes',d.packages.length,'package'],['Atendimentos',d.attendances.length,'calendar'],['Anamneses',d.anamneses.length,'heart'],['Termos',d.consents.length,'signature'],['Fotos',d.photos.length,'camera']].map(([l,v,i])=>`<div><span>${icon(i,18)}</span><strong>${v}</strong><small>${l}</small></div>`).join('')}
            </div>
          </section>
          <div class="ios-security-note">${icon('check',17)} <span><strong>Dados clínicos protegidos</strong><small>Restrinja o acesso à pasta e mantenha o dispositivo protegido.</small></span></div>
        </aside>
      </div>
    </section>`;
  }

  
