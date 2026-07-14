'use strict';

/**
 * Amanda Estética — Cálculos de resumo e renderização da Visão Geral.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function upcomingAppointments(limit = 8) {
    const now = new Date();
    return data().appointments
      .filter(a => {
        const dt = dateFromIso(`${a.date}T${a.time || '00:00'}`);
        return dt && dt >= new Date(now.getTime() - 60 * 60 * 1000) && !['Cancelado','Concluído'].includes(a.status);
      })
      .sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .slice(0, limit);
  }

  function dueReturns() {
    const today = todayIso();
    const inSeven = new Date();
    inSeven.setDate(inSeven.getDate()+7);
    const max = localIsoDate(inSeven);
    return data().attendances
      .filter(a => a.status === 'Realizado' && a.nextReturn && a.nextReturn <= max && a.nextReturn >= '2000-01-01')
      .sort((a,b) => a.nextReturn.localeCompare(b.nextReturn));
  }

  function birthdaysThisMonth() {
    const month = new Date().getMonth()+1;
    return data().clients
      .filter(c => c.birthDate && Number(c.birthDate.slice(5,7)) === month)
      .sort((a,b) => a.birthDate.slice(8,10).localeCompare(b.birthDate.slice(8,10)));
  }

  function lowStockProducts() {
    return data().products.filter(p => !p.archived && Number(p.stock) <= Number(p.minStock));
  }

  function canonicalFinanceType(value) {
    const text = normalize(value);
    return /(expense|saida|despesa|custo|pagamento)/.test(text) ? 'expense' : 'income';
  }

  function financeStatusText(value) {
    return normalize(value || 'Pago');
  }

  function isFinanceCanceled(entry) {
    return /(cancel|estorn|anulad)/.test(financeStatusText(entry.status));
  }

  function isFinancePending(entry) {
    return /(pendent|abert|a receber|nao pago|aguard)/.test(financeStatusText(entry.status));
  }

  function isFinanceSettled(entry) {
    return !isFinanceCanceled(entry) && !isFinancePending(entry);
  }

  function summarizeFinance(entries) {
    const valid = entries.filter(entry => !isFinanceCanceled(entry));
    const paidIncome = valid.filter(entry => canonicalFinanceType(entry.type) === 'income' && isFinanceSettled(entry));
    const paidExpense = valid.filter(entry => canonicalFinanceType(entry.type) === 'expense' && isFinanceSettled(entry));
    const pendingIncome = valid.filter(entry => canonicalFinanceType(entry.type) === 'income' && isFinancePending(entry));
    const income = paidIncome.reduce((sum, entry) => sum + num(entry.value), 0);
    const expense = paidExpense.reduce((sum, entry) => sum + num(entry.value), 0);
    const pending = pendingIncome.reduce((sum, entry) => sum + num(entry.value), 0);
    return {
      entries,
      income,
      expense,
      pending,
      balance: income - expense,
      paidIncomeCount: paidIncome.length,
      paidExpenseCount: paidExpense.length,
      pendingCount: pendingIncome.length
    };
  }

  function monthFinance(ym = todayIso().slice(0, 7)) {
    return summarizeFinance(data().finance.filter(f => String(f.date || '').startsWith(ym)));
  }

  function renderDashboard() {
    const d = data();
    const profile = activeProfile();
    const month = monthFinance();
    const today = todayIso();
    const todays = d.appointments.filter(a => a.date === today).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const future = upcomingAppointments(5);
    const activePackages = d.packages.filter(p => num(p.sessionsDone) < num(p.sessionsPurchased) && !['Concluído','Cancelado'].includes(p.status));
    const clientWithAttendance = new Set(d.attendances.map(a => a.clientId || a.clientName).filter(Boolean)).size;
    const birthdays = birthdaysThisMonth().length;
    const clientFill = d.clients.length ? Math.max(18, Math.min(360, Math.round((clientWithAttendance / d.clients.length) * 360))) : 18;
    const privacy = dashboardPrivacyEnabled();
    const recentAlerts = [
      ...dueReturns().slice(0,2).map(r => ({icon:'clock', title:`Retorno de ${r.clientName}`, text:`${formatDate(r.nextReturn)} · ${r.protocolName}`, tone:r.nextReturn < today ? 'danger':'warn'})),
      ...lowStockProducts().slice(0,2).map(p => ({icon:'flask', title:`Estoque baixo: ${p.name}`, text:`Atual ${p.stock} · mínimo ${p.minStock}`, tone:'warn'}))
    ].slice(0,4);

    return `<section class="pro-dashboard-heading">
      <div class="dashboard-greeting-block">
        <span class="eyebrow">Amanda Estética Pro</span>
        <div class="dashboard-greeting-line"><h2 id="dashboard-greeting">${esc(greetingForNow())}, ${esc(profile?.name || 'Amanda')}.</h2><button class="dashboard-privacy-button" data-action="toggle-dashboard-privacy" title="${privacy?'Mostrar números':'Ocultar números'}" aria-label="${privacy?'Mostrar números':'Ocultar números'}">${icon(privacy?'eyeOff':'eye',20)}</button></div>
        <p>Visão completa da clínica, com praticidade e elegância.</p>
      </div>
      <div class="dashboard-heading-actions">
        <div class="live-time-card" aria-label="Data e hora atuais"><small id="live-date">${esc(formatClockDate())}</small><time id="live-clock">${esc(formatClock())}</time></div>
        <button class="btn primary" data-action="add-appointment">${icon('plus',18)} Novo agendamento</button>
      </div>
    </section>
    <section class="pro-dashboard-grid ${privacy?'dashboard-private':''}">
      <article class="pro-card pro-agenda-card">
        <header class="pro-card-header"><div>${icon('calendar',19)}<h3>Agenda de hoje</h3></div><button class="btn text compact" data-nav="agenda">Ver agenda ${icon('chevron',15)}</button></header>
        <div class="pro-agenda-list">
          ${todays.length ? todays.slice(0,5).map(a=>`<button class="pro-agenda-row" data-action="edit-appointment" data-id="${eattr(a.id)}">
            <time>${privacyValue(a.time || '--:--')}</time>
            <span class="pro-mini-avatar">${esc((a.clientName||'A').slice(0,1).toUpperCase())}</span>
            <span class="pro-agenda-copy"><strong>${esc(a.clientName || 'Cliente')}</strong><small>${esc(a.protocolName || 'Procedimento')}</small></span>
            ${chip(a.status || 'Agendado', statusTone(a.status))}
          </button>`).join('') : `<div class="ios-empty">Sua agenda está livre hoje.</div>`}
        </div>
        ${todays.length>5 ? `<button class="pro-card-footer" data-nav="agenda">+ ${privacyValue(todays.length-5)} agendamento${todays.length-5>1?'s':''} para hoje ${icon('chevron',14)}</button>` : ''}
      </article>

      <article class="pro-card pro-clients-card">
        <header class="pro-card-header"><div>${icon('users',19)}<h3>Resumo de clientes</h3></div></header>
        <div class="client-overview">
          <div class="client-ring" style="--client-fill:${clientFill}deg"><div><strong>${privacyValue(d.clients.length)}</strong><small>Clientes totais</small></div></div>
          <dl class="client-overview-list">
            <div><dt>Com atendimentos</dt><dd>${privacyValue(clientWithAttendance)}</dd></div>
            <div><dt>Aniversariantes</dt><dd>${privacyValue(birthdays)}</dd></div>
            <div><dt>Protocolos</dt><dd>${privacyValue(d.protocols.length)}</dd></div>
            <div><dt>Fotos clínicas</dt><dd>${privacyValue(d.photos.length)}</dd></div>
          </dl>
        </div>
        <button class="pro-card-footer" data-nav="clients">Ver todas as clientes ${icon('chevron',14)}</button>
      </article>

      <article class="pro-card pro-profile-card pro-profile-static-card">
        <div class="pro-profile-head">
          ${profileAvatar(profile,'xlarge')}
          <div><span class="eyebrow">Perfil principal</span><h3>${esc(profile?.name || 'Amanda')}</h3></div>
        </div>
        <div class="pro-profile-static">
          <div><span>Nome completo</span><strong>${esc(profile?.name || 'Amanda')}</strong></div>
          <div><span>Endereço</span><strong>${esc(clinicAddress(profile))}</strong></div>
        </div>
      </article>

      <article class="pro-card pro-packages-card">
        <header class="pro-card-header"><div>${icon('package',19)}<h3>Pacotes ativos</h3></div><button class="btn text compact" data-nav="packages">Ver todos ${icon('chevron',15)}</button></header>
        <div class="pro-package-list">
          ${activePackages.length ? activePackages.slice(0,4).map(pkg=>{
            const total=Math.max(1,num(pkg.sessionsPurchased));
            const done=Math.min(total,num(pkg.sessionsDone));
            const pct=Math.round((done/total)*100);
            return `<button class="pro-package-row" data-action="edit-package" data-id="${eattr(pkg.id)}">
              <span class="pro-package-icon">${icon('package',17)}</span>
              <span><strong>${esc(pkg.protocolName || pkg.name || 'Pacote')}</strong><small>${esc(pkg.clientName || '')}</small></span>
              <span class="pro-package-progress"><small>${privacyValue(done)} de ${privacyValue(total)} sessões</small><i><b style="width:${pct}%"></b></i></span>
              ${icon('more',16)}
            </button>`;
          }).join('') : `<div class="ios-empty">Nenhum pacote ativo no momento.</div>`}
        </div>
      </article>

      <article class="pro-card pro-finance-card">
        <header class="pro-card-header"><div>${icon('wallet',19)}<h3>Financeiro · resumo do mês</h3></div><button class="btn text compact" data-nav="finance">Ver financeiro</button></header>
        <div class="pro-finance-grid">
          <div><span>${icon('chart',18)}</span><small>Recebimentos</small><strong>${privacyValue(currency(month.income))}</strong></div>
          <div><span>${icon('wallet',18)}</span><small>Saídas</small><strong>${privacyValue(currency(month.expense))}</strong></div>
          <div><span>${icon('clock',18)}</span><small>Pendências</small><strong>${privacyValue(currency(month.pending))}</strong></div>
          <div><span>${icon('sparkles',18)}</span><small>Resultado</small><strong class="${month.balance<0?'negative':'positive'}">${privacyValue(currency(month.balance))}</strong></div>
        </div>
      </article>

      <article class="pro-card pro-activity-card">
        <header class="pro-card-header"><div>${icon('sparkles',19)}<h3>Próximos movimentos</h3></div></header>
        <div class="pro-activity-list">
          ${future.length ? future.map(a=>`<button data-action="edit-appointment" data-id="${eattr(a.id)}"><span>${icon('calendar',17)}</span><span><strong>${esc(a.clientName || 'Cliente')}</strong><small>${privacy ? 'Data e horário ocultos' : `${formatDate(a.date)} · ${esc(a.time || '')}`} · ${esc(a.protocolName || '')}</small></span></button>`).join('') : `<div class="ios-empty">Nenhum agendamento futuro.</div>`}
          ${recentAlerts.map(a=>`<div class="${a.tone}"><span>${icon(a.icon,17)}</span><span><strong>${esc(a.title)}</strong><small>${privacy ? 'Informação numérica oculta' : esc(a.text)}</small></span></div>`).join('')}
        </div>
      </article>
    </section>`;
  }

  
