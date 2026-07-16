'use strict';

/**
 * Amanda Estética — Agenda e Clientes.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function statusTone(status) {
    const s = normalize(status);
    if (s.includes('cancel') || s.includes('atras') || s.includes('nao compareceu')) return 'danger';
    if (s.includes('confirm') || s.includes('realiz') || s.includes('conclu') || s.includes('pago')) return 'success';
    if (s.includes('pend') || s.includes('proximo') || s.includes('andamento')) return 'warn';
    return '';
  }

  function appointmentRow(a) {
    return `<div class="timeline-row">
      <div class="timeline-time">${esc(a.time || '--:--')}</div>
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <strong>${esc(a.clientName || 'Cliente')}</strong>
        <span>${esc(a.protocolName || 'Procedimento')}</span>
        <small>${chip(a.status || 'Agendado', statusTone(a.status))}</small>
      </div>
      <button class="icon-btn small" data-action="edit-appointment" data-id="${eattr(a.id)}">${icon('chevron',17)}</button>
    </div>`;
  }

  function renderAgenda() {
    const list = data().appointments
      .filter(a => containsSearch(a.clientName,a.protocolName,a.status,a.date,a.time))
      .sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const groups = {};
    list.forEach(a => (groups[a.date] ||= []).push(a));
    return `<section class="section-head">
      <div><span class="eyebrow">Organização da clínica</span><h2>Agenda de atendimentos</h2><p>Agende, confirme, reagende e transforme o horário em atendimento realizado.</p></div>
      <div class="head-actions"><button class="btn secondary" data-action="agenda-today">${icon('calendar',18)} Hoje</button><button class="btn primary" data-action="add-appointment">${icon('plus',18)} Agendar</button></div>
    </section>
    <div class="agenda-layout">
      <aside class="mini-summary">
        <div><strong>${data().appointments.filter(a=>a.date===todayIso()).length}</strong><span>Hoje</span></div>
        <div><strong>${upcomingAppointments(999).length}</strong><span>Próximos</span></div>
        <div><strong>${data().appointments.filter(a=>a.status==='Confirmado').length}</strong><span>Confirmados</span></div>
      </aside>
      <section class="agenda-list">
        ${Object.keys(groups).length ? Object.entries(groups).map(([date,items])=>`
          <div class="agenda-day" id="day-${date}">
            <header><div><span>${formatDate(date,true)}</span><strong>${formatDate(date)}</strong></div><small>${items.length} horário${items.length>1?'s':''}</small></header>
            <div>${items.map(a=>`<article class="appointment-card">
              <div class="appointment-time">${esc(a.time || '--:--')}<small>${num(a.duration)} min</small></div>
              <div class="appointment-main">
                <div class="appointment-title"><strong>${esc(a.clientName)}</strong>${chip(a.status,statusTone(a.status))}</div>
                <span>${esc(a.protocolName)}</span>
                <small>${a.phone ? `${icon('phone',14)} ${esc(a.phone)}` : ''}${a.value ? ` · ${currency(a.value)}` : ''}</small>
                ${a.preparation ? `<p>${esc(a.preparation)}</p>` : ''}
              </div>
              <div class="card-actions">
                ${['Agendado','Reagendado'].includes(a.status) ? `<button class="icon-btn small success" title="Confirmar" data-action="confirm-appointment" data-id="${eattr(a.id)}">${icon('check',16)}</button>`:''}
                ${!['Cancelado','Concluído'].includes(a.status) ? `<button class="icon-btn small" title="Registrar atendimento" data-action="appointment-to-attendance" data-id="${eattr(a.id)}">${icon('clipboard',16)}</button>`:''}
                <button class="icon-btn small" title="Editar" data-action="edit-appointment" data-id="${eattr(a.id)}">${icon('edit',16)}</button><button class="icon-btn small danger" title="Excluir" data-action="delete-appointment" data-id="${eattr(a.id)}">${icon('trash',16)}</button>
              </div>
            </article>`).join('')}</div>
          </div>`).join('') : emptyState('Agenda vazia','Cadastre o primeiro horário da clínica.','add-appointment','Novo agendamento')}
      </section>
    </div>`;
  }

  function renderClients() {
    const d = data();
    const mode = getViewMode('clients', 'cards');
    const archivedCount = d.clients.filter(c=>c.archived).length;
    const list = d.clients.filter(c => (CLIENT_FILTER.mode==='archived' ? !!c.archived : !c.archived)).filter(c => containsSearch(c.name,c.phone,c.cpf,c.city,c.profession)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const cards = list.map(c => {
      const atts=d.attendances.filter(a=>a.clientId===c.id || (!a.clientId&&a.clientName===c.name));
      const spent=d.finance.filter(f=>f.clientId===c.id&&canonicalFinanceType(f.type)==='income'&&isFinanceSettled(f)).reduce((sum,f)=>sum+num(f.value),0);
      const pack=d.packages.filter(p=>p.clientId===c.id && !['Concluído','Cancelado'].includes(p.status)).length;
      const waNumber=whatsappNumber(c.phone);
      const whatsapp=waNumber ? `https://wa.me/${waNumber}` : '';
      const archiveBtn=(size)=>c.archived
        ? `<button class="icon-btn ${size} success" data-action="toggle-client-archive" data-id="${eattr(c.id)}" title="Reativar cliente">${icon('refresh',size==='small'?16:14)}</button>`
        : `<button class="icon-btn ${size}" data-action="toggle-client-archive" data-id="${eattr(c.id)}" title="Desativar cliente">${icon('eyeOff',size==='small'?16:14)}</button>`;
      if(mode==='list') return `<article class="list-row client-directory-row ${c.archived?'is-archived':''}">
        ${profileAvatar({name:c.name},'small')}
        <button class="row-main text-button" data-action="view-client" data-id="${eattr(c.id)}"><strong>${esc(c.name)} ${c.archived?chip('Desativada','warn'):''}</strong><span>${esc(c.phone || 'Sem telefone')} · ${esc(c.city || 'Cidade não informada')}</span><small>${atts.length} atendimento${atts.length!==1?'s':''} · ${pack} pacote${pack!==1?'s':''} · ${currency(spent)} pago</small></button>
        <div class="row-actions">${whatsapp?`<a class="icon-btn small whatsapp" href="${whatsapp}" target="_blank" rel="noopener" title="Abrir WhatsApp">${icon('phone',16)}</a>`:''}${archiveBtn('small')}<button class="icon-btn small" data-action="edit-client" data-id="${eattr(c.id)}" title="Editar">${icon('edit',16)}</button><button class="icon-btn small" data-action="view-client" data-id="${eattr(c.id)}" title="Abrir ficha">${icon('chevron',16)}</button></div>
      </article>`;
      if(mode==='compact') return `<article class="client-compact-card ${c.archived?'is-archived':''}">
        <button class="compact-card-main" data-action="view-client" data-id="${eattr(c.id)}">
          <span class="compact-card-top">${profileAvatar({name:c.name},'small')}<span><strong>${esc(c.name)} ${c.archived?chip('Desativada','warn'):''}</strong><small>${esc(c.city || 'Cidade não informada')}</small></span></span>
          <span class="compact-contact">${icon('phone',13)} ${esc(c.phone || 'Sem telefone')}</span>
          <span class="compact-metrics"><span><b>${atts.length}</b> atend.</span><span><b>${pack}</b> pacotes</span><span><b>${currency(spent)}</b> pago</span></span>
        </button>
        <footer>${whatsapp?`<a class="icon-btn small whatsapp" href="${whatsapp}" target="_blank" rel="noopener" title="WhatsApp">${icon('phone',16)}</a>`:''}${archiveBtn('tiny')}<button class="icon-btn small" data-action="edit-client" data-id="${eattr(c.id)}" title="Editar">${icon('edit',16)}</button></footer>
      </article>`;
      return `<article class="client-card ${c.archived?'is-archived':''}">
        <button class="client-card-main" data-action="view-client" data-id="${eattr(c.id)}">
          ${profileAvatar({name:c.name})}
          <span class="client-info"><strong>${esc(c.name)} ${c.archived?chip('Desativada','warn'):''}</strong><small>${esc(c.phone || 'Sem telefone')}</small><small>${esc(c.city || 'Cidade não informada')}</small></span>
          ${icon('chevron',18)}
        </button>
        <div class="client-metrics"><span><strong>${atts.length}</strong> atend.</span><span><strong>${currency(spent)}</strong> pago</span><span><strong>${pack}</strong> pacotes</span></div>
        <div class="client-card-actions">
          ${whatsapp ? `<a class="btn text compact" href="${whatsapp}" target="_blank" rel="noopener">${icon('phone',16)} WhatsApp</a>`:''}
          ${archiveBtn('small')}
          <button class="icon-btn small" data-action="edit-client" data-id="${eattr(c.id)}">${icon('edit',16)}</button>
        </div>
      </article>`;
    }).join('');
    const containerClass = mode==='list' ? 'list-panel' : mode==='compact' ? 'compact-grid client-compact-grid' : 'card-grid clients-grid';
    return `<section class="section-head">
      <div><span class="eyebrow">Cadastro e histórico</span><h2>${list.length} cliente${list.length!==1?'s':''}</h2><p>Dados pessoais, histórico de procedimentos, pacotes e prontuário em um só cadastro.</p></div>
      <div class="head-actions">
        ${expandableFilterControl({
          ariaLabel:'Filtrar clientes',
          current:CLIENT_FILTER.mode,
          action:'set-client-filter',
          className:'client-filter-expandable',
          options:[
            {value:'active',icon:'users',label:'Ativas',attrs:'data-value="active"'},
            {value:'archived',icon:'eyeOff',label:`Desativadas${archivedCount?` (${archivedCount})`:''}`,attrs:'data-value="archived"'}
          ]
        })}
        ${viewModeSwitcher('clients',mode)}<button class="btn primary" data-action="add-client">${icon('plus',18)} Nova cliente</button>
      </div>
    </section>
    <section class="${containerClass}" data-view-content="clients">
      ${list.length ? cards : emptyState(
        CLIENT_FILTER.mode==='archived' ? 'Nenhuma cliente desativada' : 'Nenhuma cliente encontrada',
        CLIENT_FILTER.mode==='archived' ? 'Clientes desativadas mantêm todo o histórico e aparecem aqui.' : (SEARCH ? 'Tente pesquisar por outro nome ou telefone.' : 'Cadastre a primeira cliente.'),
        CLIENT_FILTER.mode==='archived' ? '' : 'add-client',
        'Cadastrar cliente'
      )}
    </section>`;
  }

  
