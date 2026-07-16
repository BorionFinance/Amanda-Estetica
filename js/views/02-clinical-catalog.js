'use strict';

/**
 * Amanda Estética — Protocolos, pacotes, atendimentos, anamneses, consentimentos, fotos e produtos.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function renderProtocols() {
    const mode = getViewMode('protocols', 'cards');
    const list = data().protocols.filter(p => containsSearch(p.name,p.id,p.preparation,p.notes)).sort((a,b)=>Number(!!a.archived)-Number(!!b.archived)||a.name.localeCompare(b.name,'pt-BR'));
    const cards = list.map(p=>{
      const profit=num(p.price)-num(p.cost);
      if(mode==='list') return `<article class="list-row protocol-list-row ${p.archived?'is-archived':''}">
        <div class="protocol-icon">${icon('sparkles',19)}</div>
        <button class="row-main text-button" data-action="view-protocol" data-id="${eattr(p.id)}"><strong>${esc(p.name)} ${p.archived?chip('Arquivado','warn'):''}</strong><span>${esc(p.id)} · ${num(p.duration)} min · ${p.returnDays?`retorno em ${num(p.returnDays)} dias`:'sem retorno definido'}</span><small>${esc(p.preparation || p.notes || 'Sem observações')}</small></button>
        <div class="protocol-list-values"><span><small>Custo</small><strong>${currency(p.cost)}</strong></span><span><small>Preço</small><strong>${currency(p.price)}</strong></span><span><small>Lucro</small><strong>${currency(profit)}</strong></span></div>
        <div class="row-actions">${p.archived?`<button class="icon-btn small success" data-action="toggle-protocol-archive" data-id="${eattr(p.id)}" title="Reativar">${icon('refresh',16)}</button>`:''}<button class="icon-btn small" data-action="edit-protocol" data-id="${eattr(p.id)}">${icon('edit',16)}</button><button class="icon-btn small" data-action="view-protocol" data-id="${eattr(p.id)}">${icon('chevron',16)}</button></div>
      </article>`;
      if(mode==='compact') return `<article class="protocol-compact-card ${p.archived?'is-archived':''}">
        <header><div class="protocol-icon small-icon">${icon('sparkles',17)}</div><div><small>${esc(p.id)}</small><h3>${esc(p.name)} ${p.archived?chip('Arquivado','warn'):''}</h3></div><span class="row-actions">${p.archived?`<button class="icon-btn tiny success" data-action="toggle-protocol-archive" data-id="${eattr(p.id)}">${icon('refresh',14)}</button>`:''}<button class="icon-btn tiny" data-action="edit-protocol" data-id="${eattr(p.id)}">${icon('edit',14)}</button></span></header>
        <div class="compact-protocol-values"><span><small>${num(p.duration)} min</small><strong>${currency(p.price)}</strong></span><span><small>Lucro</small><strong>${currency(profit)}</strong></span></div>
        <footer><span>${p.returnDays?`${num(p.returnDays)} dias p/ retorno`:'Sem retorno'}</span><button class="btn text compact" data-action="view-protocol" data-id="${eattr(p.id)}">Detalhes</button></footer>
      </article>`;
      return `<article class="protocol-card ${p.archived?'is-archived':''}">
        <header><div class="protocol-icon">${icon('sparkles',22)}</div><div><small>${esc(p.id)}</small><h3>${esc(p.name)} ${p.archived?chip('Arquivado','warn'):''}</h3></div><span class="row-actions">${p.archived?`<button class="icon-btn small success" data-action="toggle-protocol-archive" data-id="${eattr(p.id)}">${icon('refresh',16)}</button>`:''}<button class="icon-btn small" data-action="edit-protocol" data-id="${eattr(p.id)}">${icon('edit',16)}</button></span></header>
        <div class="protocol-numbers">
          <span><small>Duração</small><strong>${num(p.duration)} min</strong></span>
          <span><small>Custo</small><strong>${currency(p.cost)}</strong></span>
          <span><small>Preço</small><strong>${currency(p.price)}</strong></span>
          <span><small>Lucro</small><strong>${currency(profit)}</strong></span>
        </div>
        <div class="protocol-footer">
          <span>${p.returnDays ? `Retorno em ${num(p.returnDays)} dias` : 'Sem retorno definido'}</span>
          <button class="btn text compact" data-action="view-protocol" data-id="${eattr(p.id)}">Detalhes ${icon('chevron',15)}</button>
        </div>
      </article>`;
    }).join('');
    const containerClass = mode==='list' ? 'list-panel' : mode==='compact' ? 'compact-grid protocol-compact-grid' : 'card-grid protocols-grid';
    return `<section class="section-head">
      <div><span class="eyebrow">Procedimentos e preços</span><h2>Protocolos</h2><p>Defina duração, custo, preço, retorno e preparos de cada procedimento.</p></div>
      <div class="head-actions">${viewModeSwitcher('protocols',mode)}<button class="btn primary" data-action="add-protocol">${icon('plus',18)} Novo protocolo</button></div>
    </section>
    <section class="${containerClass}" data-view-content="protocols">
      ${list.length ? cards : emptyState('Nenhum protocolo','Crie os procedimentos oferecidos pela clínica.','add-protocol','Criar protocolo')}
    </section>`;
  }

  function renderPackages() {
    const d=data();
    const list=d.packages.filter(p=>containsSearch(p.clientName,p.protocolName,p.status,p.objective)).sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));
    return `<section class="section-head">
      <div><span class="eyebrow">Tratamentos em sequência</span><h2>Pacotes e sessões</h2><p>Acompanhe sessões compradas, realizadas, saldo e evolução do tratamento.</p></div>
      <button class="btn primary" data-action="add-package">${icon('plus',18)} Novo pacote</button>
    </section>
    <section class="packages-list">
      ${list.length ? list.map(p=>{
        const total=Math.max(1,num(p.sessionsPurchased));
        const done=Math.min(total,num(p.sessionsDone));
        const remaining=Math.max(0,total-done);
        const pct=Math.round(done/total*100);
        return `<article class="package-card">
          <header><div class="package-title"><small>${esc(p.id)}</small><h3>${esc(p.clientName)}</h3><span>${esc(p.protocolName)}</span></div><div class="package-status">${chip(p.status,statusTone(p.status))}</div></header>
          <div class="package-progress"><div><span style="width:${pct}%"></span></div><small>${done} de ${total} sessões · ${remaining} restante${remaining!==1?'s':''}</small></div>
          <div class="package-details">
            <span><small>Início</small><strong>${formatDate(p.startDate)}</strong></span>
            <span><small>Recebido</small><strong>${currency(p.receivedValue)}</strong></span>
            <span><small>Próximo retorno</small><strong>${formatDate(p.nextReturn)}</strong></span>
          </div>
          ${p.evolution ? `<p class="note">${esc(p.evolution)}</p>`:''}
          <footer>
            ${!['Concluído','Cancelado'].includes(p.status)?`<button class="btn secondary compact" data-action="package-session" data-id="${eattr(p.id)}">${icon('plus',16)} Registrar sessão</button>`:''}
            <div class="row-actions"><button class="icon-btn small" data-action="view-package" data-id="${eattr(p.id)}" title="Detalhes">${icon('chevron',16)}</button><button class="icon-btn small" data-action="edit-package" data-id="${eattr(p.id)}">${icon('edit',16)}</button></div>
          </footer>
        </article>`;
      }).join('') : emptyState('Nenhum pacote','Cadastre um tratamento com múltiplas sessões.','add-package','Criar pacote')}
    </section>`;
  }

  function renderAttendances() {
    ensureUiFilters();
    const all=data().attendances;
    let filtered=all;
    if(ATTENDANCE_FILTER.mode==='day') filtered=all.filter(a=>a.date===ATTENDANCE_FILTER.date);
    if(ATTENDANCE_FILTER.mode==='month') filtered=all.filter(a=>String(a.date||'').startsWith(ATTENDANCE_FILTER.month));
    const list=filtered.filter(a=>containsSearch(a.clientName,a.protocolName,a.status,a.paymentMethod,a.date)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const filterLabel=ATTENDANCE_FILTER.mode==='day' ? `do dia ${formatDate(ATTENDANCE_FILTER.date)}` : ATTENDANCE_FILTER.mode==='month' ? `de ${new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(dateFromIso(`${ATTENDANCE_FILTER.month}-01`))}` : 'de todo o histórico';
    return `<section class="section-head attendance-section-head">
      <div><span class="eyebrow">Evolução clínica</span><h2 id="attendance-result-title">${list.length} atendimento${list.length!==1?'s':''}</h2><p id="attendance-result-description">Exibindo atendimentos ${filterLabel}. Registre cada sessão, valor cobrado, retorno e observações.</p></div>
      <div class="head-actions attendance-head-actions">
        ${expandableFilterControl({
          ariaLabel:'Filtrar atendimentos',
          current:ATTENDANCE_FILTER.mode,
          action:'set-attendance-filter',
          className:'attendance-filter-expandable',
          options:[
            {value:'all',icon:'list',label:'Todos',attrs:'data-value="all"'},
            {value:'day',icon:'calendar',label:'Dia',attrs:'data-value="day"'},
            {value:'month',icon:'grid',label:'Mês',attrs:'data-value="month"'}
          ]
        })}
        <span class="attendance-period-slot">
          ${ATTENDANCE_FILTER.mode==='day'?`<label class="inline-filter"><span>Data</span><input id="attendance-date-filter" type="date" value="${eattr(ATTENDANCE_FILTER.date)}"></label>`:''}
          ${ATTENDANCE_FILTER.mode==='month'?`<label class="inline-filter"><span>Mês</span><input id="attendance-month-filter" type="month" value="${eattr(ATTENDANCE_FILTER.month)}"></label>`:''}
        </span>
        <button class="btn primary" data-action="add-attendance">${icon('plus',18)} Novo atendimento</button>
      </div>
    </section>
    <section class="list-panel" data-view-content="attendances">
      ${list.length ? list.map(a=>`<article class="list-row attendance-row">
        <div class="date-badge"><strong>${formatDate(a.date).slice(0,5)}</strong><small>${dateFromIso(a.date)?.getFullYear() || ''}</small></div>
        <div class="row-main"><strong>${esc(a.clientName)}</strong><span>${esc(a.protocolName)}${a.packageId?' · sessão de pacote':''}</span><small>${esc(a.evolution || a.notes || 'Sem observações')} · ${(a.inventoryMovements||[]).length} item(ns) de estoque</small></div>
        <div class="row-value"><strong>${currency(a.chargedValue)}</strong><small>${a.paid ? 'Pago' : 'Pendente'} · ${esc(a.paymentMethod || '—')}</small></div>
        <div>${chip(a.status,statusTone(a.status))}</div>
        <div class="row-actions"><button class="icon-btn small" data-action="edit-attendance" data-id="${eattr(a.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-attendance" data-id="${eattr(a.id)}">${icon('trash',16)}</button></div>
      </article>`).join('') : emptyState('Nenhum atendimento neste filtro','Altere o período ou registre um novo atendimento.','add-attendance','Registrar atendimento')}
    </section>`;
  }

  function renderAnamneses() {
    const list=data().anamneses.filter(a=>containsSearch(a.clientName,a.complaint,a.objective,a.date)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return `<section class="section-head">
      <div><span class="eyebrow">Avaliação inicial</span><h2>Fichas de anamnese</h2><p>Contraindicações, hábitos, pele, objetivos e histórico de cada cliente.</p></div>
      <button class="btn primary" data-action="add-anamnesis">${icon('plus',18)} Nova anamnese</button>
    </section>
    <section class="card-grid">
      ${list.length ? list.map(a=>`<article class="record-card">
        <header><div class="record-icon">${icon('heart',21)}</div><div><small>${formatDate(a.date)}</small><h3>${esc(a.clientName)}</h3></div></header>
        <div class="record-tags">${a.skinType?chip(a.skinType):''}${a.sensitivity?chip(`Sensibilidade: ${a.sensitivity}`):''}${a.pregnant==='Sim'?chip('Gestante/lactante','warn'):''}${a.allergies?chip('Alergias','danger'):''}</div>
        <p><strong>Queixa:</strong> ${esc(a.complaint || 'Não informada')}</p>
        <footer><button class="btn text compact" data-action="view-anamnesis" data-id="${eattr(a.id)}">Abrir ficha ${icon('chevron',15)}</button><div class="row-actions"><button class="icon-btn small" data-action="edit-anamnesis" data-id="${eattr(a.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-anamnesis" data-id="${eattr(a.id)}">${icon('trash',16)}</button></div></footer>
      </article>`).join('') : emptyState('Nenhuma anamnese','Crie a primeira ficha clínica completa.','add-anamnesis','Criar anamnese')}
    </section>`;
  }

  function renderConsents() {
    const list=data().consents.filter(c=>containsSearch(c.clientName,c.protocolName,c.date,c.accepted?'aceito':'pendente')).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return `<section class="section-head">
      <div><span class="eyebrow">Documentos</span><h2>Consentimentos</h2><p>Gere, registre aceite e imprima termos vinculados à cliente e ao procedimento.</p></div>
      <button class="btn primary" data-action="add-consent">${icon('plus',18)} Novo termo</button>
    </section>
    <section class="list-panel">
      ${list.length ? list.map(c=>`<article class="list-row">
        <div class="record-icon">${icon('signature',20)}</div>
        <div class="row-main"><strong>${esc(c.clientName)}</strong><span>${esc(c.protocolName)}</span><small>${formatDate(c.date)} · ${esc(c.signatureName || 'Sem assinatura')}</small></div>
        <div>${chip(c.accepted ? 'Aceito' : 'Pendente', c.accepted ? 'success':'warn')}</div>
        <div class="row-actions"><button class="icon-btn small" data-action="print-consent" data-id="${eattr(c.id)}" title="Imprimir">${icon('download',16)}</button><button class="icon-btn small" data-action="edit-consent" data-id="${eattr(c.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-consent" data-id="${eattr(c.id)}" title="Excluir">${icon('trash',16)}</button></div>
      </article>`).join('') : emptyState('Nenhum consentimento','Gere um termo para um procedimento.','add-consent','Gerar termo')}
    </section>`;
  }

  const PHOTO_PHASE_ORDER = ['Antes','Depois','Retorno','Comparativo'];

  function photoThumb(p, sizeClass='') {
    if (!p) return `<div class="photo-frame ${sizeClass} empty-slot">${icon('image',26)}<span>Sem foto</span></div>`;
    const src = p.imageData || p.url;
    return `<div class="photo-frame ${sizeClass}">${src ? `<img src="${eattr(src)}" alt="${eattr(p.clientName)}" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('broken')">` : `<div>${icon('image',26)}<span>Sem imagem</span></div>`}</div>`;
  }

  function photoSessionsFor(clientId, protocolId) {
    const photos = data().photos.filter(p => p.clientId===clientId && (protocolId==='_none' ? !p.protocolId : p.protocolId===protocolId));
    const byDate = {};
    photos.forEach(p => { (byDate[p.date||'—'] ||= []).push(p); });
    return Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).map(date => {
      const items = byDate[date].sort((a,b)=>PHOTO_PHASE_ORDER.indexOf(a.phase)-PHOTO_PHASE_ORDER.indexOf(b.phase));
      const antes = items.find(p=>p.phase==='Antes');
      const depois = items.find(p=>p.phase==='Depois');
      const extras = items.filter(p=>p!==antes && p!==depois);
      return { date, antes, depois, extras, all: items };
    });
  }

  function renderPhotos() {
    if (!PHOTO_NAV.clientId) return renderPhotoClients();
    if (!PHOTO_NAV.protocolId) return renderPhotoProtocols(PHOTO_NAV.clientId);
    return renderPhotoSessions(PHOTO_NAV.clientId, PHOTO_NAV.protocolId);
  }

  function renderPhotoClients() {
    const grouped = {};
    data().photos.forEach(p => { if(!p.clientId) return; (grouped[p.clientId] ||= { clientId:p.clientId, clientName:p.clientName, items:[] }).items.push(p); });
    const list = Object.values(grouped).filter(g=>containsSearch(g.clientName)).sort((a,b)=>(a.clientName||'').localeCompare(b.clientName||'','pt-BR'));
    return `<section class="section-head">
      <div><span class="eyebrow">Evolução visual</span><h2>Fotos antes e depois</h2><p>Organizadas por cliente, protocolo e sessão.</p></div>
      <button class="btn primary" data-action="add-photo">${icon('plus',18)} Nova foto</button>
    </section>
    <section class="photo-grid photo-folder-grid">
      ${list.length ? list.map(g=>{
        const cover = g.items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
        return `<button type="button" class="photo-card photo-folder" data-action="photo-open-client" data-id="${eattr(g.clientId)}">
          ${photoThumb(cover)}
          <div class="photo-info"><h3>${esc(g.clientName)}</h3><span>${g.items.length} foto${g.items.length===1?'':'s'}</span></div>
        </button>`;
      }).join('') : emptyState('Nenhuma foto registrada','Adicione uma foto de antes, depois ou comparativo.','add-photo','Adicionar foto')}
    </section>`;
  }

  function renderPhotoProtocols(clientId) {
    const client = findClient(clientId);
    const photos = data().photos.filter(p=>p.clientId===clientId);
    const grouped = {};
    photos.forEach(p => { const key=p.protocolId||'_none'; (grouped[key] ||= { protocolId:key, protocolName:p.protocolName||'Sem protocolo', items:[] }).items.push(p); });
    const list = Object.values(grouped).sort((a,b)=>(a.protocolName||'').localeCompare(b.protocolName||'','pt-BR'));
    return `<section class="section-head">
      <div><button type="button" class="breadcrumb-back" data-action="photo-back-clients">${icon('chevron',16)} ${esc(client?.name||'Cliente')}</button>
      <span class="eyebrow">Protocolos fotografados</span><h2>${esc(client?.name||'Cliente')}</h2></div>
      <button class="btn primary" data-action="add-photo">${icon('plus',18)} Nova foto</button>
    </section>
    <section class="photo-grid photo-folder-grid">
      ${list.length ? list.map(g=>{
        const cover = g.items.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
        return `<button type="button" class="photo-card photo-folder" data-action="photo-open-protocol" data-id="${eattr(g.protocolId)}">
          ${photoThumb(cover)}
          <div class="photo-info"><h3>${esc(g.protocolName)}</h3><span>${g.items.length} foto${g.items.length===1?'':'s'}</span></div>
        </button>`;
      }).join('') : emptyState('Nenhuma foto neste cliente','Registre a primeira foto desta cliente.','add-photo','Adicionar foto')}
    </section>`;
  }

  function renderPhotoSessions(clientId, protocolId) {
    const client = findClient(clientId);
    const protocol = protocolId!=='_none' ? findProtocol(protocolId) : null;
    const protocolName = protocol?.name || 'Sem protocolo';
    const sessions = photoSessionsFor(clientId, protocolId);
    return `<section class="section-head">
      <div><button type="button" class="breadcrumb-back" data-action="photo-open-client" data-id="${eattr(clientId)}">${icon('chevron',16)} ${esc(client?.name||'Cliente')}</button>
      <span class="eyebrow">${esc(client?.name||'')}</span><h2>${esc(protocolName)}</h2><p>Sessões agrupadas por data. Antes e depois pareados automaticamente — ajuste a fase da foto pra corrigir o par.</p></div>
      <button class="btn primary" data-action="add-photo">${icon('plus',18)} Nova foto</button>
    </section>
    <section class="photo-session-list">
      ${sessions.length ? sessions.map(s => `<article class="photo-session-card">
        <header><strong>${formatDate(s.date)}</strong>${s.antes && s.depois ? chip('Par completo','success') : chip('Sem par completo','warn')}</header>
        <div class="photo-session-pair">
          <div class="photo-session-slot">${photoThumb(s.antes,'session-thumb')}<small>Antes</small></div>
          <div class="photo-session-slot">${photoThumb(s.depois,'session-thumb')}<small>Depois</small></div>
        </div>
        <div class="photo-session-items">
          ${s.all.map(p=>`<div class="photo-session-item">
            <span>${esc(p.phase||'Registro')}${p.area?` · ${esc(p.area)}`:''}</span>
            <div><button class="icon-btn small" data-action="edit-photo" data-id="${eattr(p.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-photo" data-id="${eattr(p.id)}">${icon('trash',16)}</button></div>
          </div>`).join('')}
        </div>
      </article>`).join('') : emptyState('Nenhuma foto neste protocolo','Registre a primeira sessão deste protocolo.','add-photo','Adicionar foto')}
    </section>`;
  }

  function renderProducts() {
    const mode=getViewMode('products','list');
    const list=data().products.filter(p=>containsSearch(p.name,p.brand,p.category,p.id)).sort((a,b)=>Number(!!a.archived)-Number(!!b.archived)||a.name.localeCompare(b.name,'pt-BR'));
    const low=list.filter(p=>num(p.stock)<=num(p.minStock)).length;
    const cards=list.map(p=>{
      const isLow=num(p.stock)<=num(p.minStock);
      if(mode==='list') return `<article class="list-row product-row ${isLow?'low-stock':''} ${p.archived?'is-archived':''}">
        <div class="record-icon">${icon('flask',20)}</div>
        <div class="row-main"><strong>${esc(p.name)} ${p.archived?chip('Arquivado','warn'):''}</strong><span>${esc([p.brand,p.category].filter(Boolean).join(' · '))}</span><small>${esc(p.id)} · custo/atend. ${currency(p.costPerService)}</small></div>
        <div class="stock-control"><button class="icon-btn tiny" data-action="stock-minus" data-id="${eattr(p.id)}">−</button><strong>${num(p.stock)}</strong><button class="icon-btn tiny" data-action="stock-plus" data-id="${eattr(p.id)}">+</button><small>mín. ${num(p.minStock)}</small></div>
        <div>${isLow?chip('Repor','danger'):chip('OK','success')}</div>
        <div class="row-actions">${p.archived?`<button class="icon-btn small success" data-action="toggle-product-archive" data-id="${eattr(p.id)}" title="Reativar">${icon('refresh',16)}</button>`:''}<button class="icon-btn small" data-action="edit-product" data-id="${eattr(p.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-product" data-id="${eattr(p.id)}">${icon('trash',16)}</button></div>
      </article>`;
      if(mode==='compact') return `<article class="product-compact-card ${isLow?'low-stock':''} ${p.archived?'is-archived':''}">
        <header><div class="record-icon small-icon">${icon('flask',17)}</div><div><small>${esc(p.id)}</small><h3>${esc(p.name)}</h3></div><span class="row-actions">${p.archived?`<button class="icon-btn tiny success" data-action="toggle-product-archive" data-id="${eattr(p.id)}">${icon('refresh',14)}</button>`:''}<button class="icon-btn tiny" data-action="edit-product" data-id="${eattr(p.id)}">${icon('edit',14)}</button><button class="icon-btn tiny danger" data-action="delete-product" data-id="${eattr(p.id)}">${icon('trash',14)}</button></span></header>
        <p>${esc([p.brand,p.category].filter(Boolean).join(' · ') || 'Sem categoria')}</p>
        <div class="compact-stock"><span><small>Estoque</small><strong>${num(p.stock)}</strong></span><span><small>Mínimo</small><strong>${num(p.minStock)}</strong></span><span><small>Custo/atend.</small><strong>${currency(p.costPerService)}</strong></span></div>
        <footer><div class="stock-control compact"><button class="icon-btn tiny" data-action="stock-minus" data-id="${eattr(p.id)}">−</button><strong>${num(p.stock)}</strong><button class="icon-btn tiny" data-action="stock-plus" data-id="${eattr(p.id)}">+</button></div>${isLow?chip('Repor','danger'):chip('OK','success')}</footer>
      </article>`;
      return `<article class="product-card ${isLow?'low-stock':''} ${p.archived?'is-archived':''}">
        <header><div class="record-icon">${icon('flask',20)}</div><div><small>${esc(p.id)}</small><h3>${esc(p.name)}</h3><span>${esc([p.brand,p.category].filter(Boolean).join(' · ') || 'Sem categoria')}</span></div><span class="row-actions">${p.archived?`<button class="icon-btn small success" data-action="toggle-product-archive" data-id="${eattr(p.id)}">${icon('refresh',16)}</button>`:''}<button class="icon-btn small" data-action="edit-product" data-id="${eattr(p.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" data-action="delete-product" data-id="${eattr(p.id)}">${icon('trash',16)}</button></span></header>
        <div class="product-card-values"><span><small>Estoque atual</small><strong>${num(p.stock)}</strong></span><span><small>Estoque mínimo</small><strong>${num(p.minStock)}</strong></span><span><small>Custo/atendimento</small><strong>${currency(p.costPerService)}</strong></span></div>
        <footer><div class="stock-control"><button class="icon-btn tiny" data-action="stock-minus" data-id="${eattr(p.id)}">−</button><strong>${num(p.stock)}</strong><button class="icon-btn tiny" data-action="stock-plus" data-id="${eattr(p.id)}">+</button></div>${isLow?chip('Precisa repor','danger'):chip('Estoque OK','success')}</footer>
      </article>`;
    }).join('');
    const containerClass=mode==='list'?'list-panel':mode==='compact'?'compact-grid product-compact-grid':'card-grid products-grid';
    return `<section class="section-head">
      <div><span class="eyebrow">Materiais da clínica</span><h2>Produtos e estoque</h2><p>${low ? `${low} produto${low>1?'s':''} precisa${low>1?'m':''} de atenção.` : 'Estoque sem alertas no momento.'}</p></div>
      <div class="head-actions">${viewModeSwitcher('products',mode)}<button class="btn primary" data-action="add-product">${icon('plus',18)} Novo produto</button></div>
    </section>
    <section class="${containerClass}" data-view-content="products">
      ${list.length ? cards : emptyState('Nenhum produto','Cadastre produtos, custos e quantidade em estoque.','add-product','Cadastrar produto')}
    </section>`;
  }

  
