'use strict';

/**
 * Amanda Estética — Pacotes, sessões, atendimentos, estoque e financeiro.
 * A v1.8.0 usa reconciliação relacional para evitar contagens e saldos duplicados.
 */

function openPackageForm(id='',prefill={}) {
  const existing=data().packages.find(p=>p.id===id);
  const realizedCount=existing ? packageRealizedAttendances(existing.id).length : 0;
  const legacyBaseline=existing?.sessionsBaseline !== undefined
    ? num(existing.sessionsBaseline)
    : Math.max(0,num(existing?.sessionsDone)-realizedCount);
  const p={startDate:todayIso(),sessionsPurchased:1,sessionsBaseline:0,status:'Não iniciado',packageValue:0,receivedValue:0,paymentMethod:'Pix',...prefill,...(existing||{}),sessionsBaseline:legacyBaseline};
  openModal({
    title:existing?'Editar pacote':'Novo pacote',
    sub:'Sessões pré-pagas de um protocolo vinculadas a uma cliente.',
    wide:true,
    content:`<div class="form-grid">
      ${selectField('Cliente','clientId',optionClients(p.clientId),p.clientId,{required:true})}
      ${selectField('Protocolo','protocolId',optionProtocols(p.protocolId),p.protocolId,{required:true})}
      ${field('Data de início','startDate',p.startDate,'date',{required:true})}
      ${field('Sessões compradas','sessionsPurchased',p.sessionsPurchased,'number',{min:1,required:true})}
      ${field('Sessões anteriores ao sistema','sessionsBaseline',p.sessionsBaseline,'number',{min:0,help:'Use somente para sessões já realizadas antes de começar a registrar atendimentos no aplicativo.'})}
      ${field('Sessões registradas no app','registeredSessions',realizedCount,'number',{readonly:true,help:'Calculado automaticamente pelos atendimentos realizados e vinculados ao pacote.'})}
      ${field('Valor do pacote','packageValue',p.packageValue,'number',{min:0,step:'0.01'})}
      ${field('Valor recebido','receivedValue',p.receivedValue,'number',{min:0,step:'0.01'})}
      ${selectField('Forma de recebimento','paymentMethod',['Pix','Dinheiro','Cartão de Débito','Cartão de Crédito','Transferência','Boleto','A definir'],p.paymentMethod,{blank:false})}
      ${selectField('Status','status',['Não iniciado','Em andamento','Concluído','Cancelado'],p.status,{blank:false})}
      ${field('Próximo retorno','nextReturn',p.nextReturn,'date')}
      ${textarea('Objetivo / área tratada','objective',p.objective,{rows:2,className:'span-2'})}
      ${textarea('Evolução percebida','evolution',p.evolution,{rows:3,className:'span-2'})}
      ${textarea('Resumo do resultado','resultSummary',p.resultSummary,{rows:3,className:'span-2'})}
      ${textarea('Observações','notes',p.notes,{rows:3,className:'span-2'})}
    </div><input type="hidden" name="id" value="${eattr(p.id||'')}">`,
    deleteAction:existing?'delete-package':'',
    deleteId:existing?.id||'',
    deleteText:'Excluir pacote',
    submitText:'Salvar pacote',
    onSubmit:async form=>{
      const o=formObject(form),client=findClient(o.clientId),protocol=findProtocol(o.protocolId);
      if(existing&&packageRealizedAttendances(existing.id).length&&(o.clientId!==existing.clientId||o.protocolId!==existing.protocolId))throw new Error('Cliente e protocolo não podem ser alterados depois que o pacote já possui sessões registradas.');
      const purchased=Math.max(1,num(o.sessionsPurchased));
      const baseline=Math.max(0,num(o.sessionsBaseline));
      if(baseline>purchased)throw new Error('As sessões anteriores ao sistema não podem superar o total de sessões compradas.');
      if(num(o.receivedValue)>num(o.packageValue)+0.0001)throw new Error('O valor recebido não pode ser maior que o valor total do pacote.');
      const item={...p,id:o.id||uid('PK'),clientId:o.clientId,clientName:client?.name||'',phone:client?.phone||'',protocolId:o.protocolId,protocolName:protocol?.name||'',startDate:o.startDate,sessionsPurchased:purchased,sessionsBaseline:baseline,status:o.status,packageValue:num(o.packageValue),receivedValue:num(o.receivedValue),paymentMethod:o.paymentMethod||'A definir',valuePerSession:num(o.packageValue)/purchased,nextReturn:o.nextReturn||'',objective:o.objective||'',evolution:o.evolution||'',resultSummary:o.resultSummary||'',notes:o.notes||'',financeManaged:true,updatedAt:nowIso()};
      const idx=data().packages.findIndex(x=>x.id===item.id);
      idx>=0?data().packages.splice(idx,1,item):data().packages.push(item);
      recalculatePackage(item);
      syncFinanceForPackage(item);
      await persist(existing?'Pacote editado':'Pacote criado',{detail:`${item.clientName} · ${item.protocolName}`});
      closeModal();renderView();toast('Pacote salvo; sessões e financeiro reconciliados.');
    }
  });
  const form=$('#app-modal-form');
  form.elements.protocolId.addEventListener('change',()=>{
    const protocol=findProtocol(form.elements.protocolId.value);
    if(protocol&&!existing)setMoneyFieldValue(form.elements.packageValue,protocol.price||0);
  });
}

function viewPackage(id) {
  const pkg=data().packages.find(p=>p.id===id); if(!pkg)return;
  recalculatePackage(pkg);
  const sessions=packageRealizedAttendances(pkg.id).slice().reverse();
  const balance=Math.max(0,num(pkg.packageValue)-num(pkg.receivedValue));
  openModal({
    title:`Pacote · ${pkg.clientName}`,
    wide:true,
    content:`<div class="package-detail-view">
      <div class="stats-grid compact-stats">
        ${statCard('Protocolo',pkg.protocolName||'—','','sparkles')}
        ${statCard('Sessões',`${num(pkg.sessionsDone)} de ${num(pkg.sessionsPurchased)}`,'','package')}
        ${statCard('Recebido',currency(pkg.receivedValue),'','wallet')}
        ${statCard('A receber',currency(balance),'','clock',balance?'warn':'')}
      </div>
      <section><h4>Sessões registradas</h4>${sessions.length?`<div class="list-panel">${sessions.map(att=>`<div class="list-row"><div class="date-badge"><strong>${formatDate(att.date).slice(0,5)}</strong></div><div class="row-main"><strong>${esc(att.protocolName)}</strong><span>${esc(att.evolution||att.notes||'Sem observações')}</span><small>${(att.inventoryMovements||[]).length+(att.disposableMovements||[]).length} item(ns) de estoque movimentado(s)</small></div><div>${chip(att.status,statusTone(att.status))}</div></div>`).join('')}</div>`:'<p class="muted">Nenhuma sessão registrada no aplicativo.</p>'}</section>
      <section><h4>Resultado e evolução</h4><p>${esc(pkg.evolution||pkg.resultSummary||pkg.notes||'Sem observações.')}</p></section>
    </div>`,
    extraFooter:`<button type="button" class="btn danger-soft" data-action="delete-package" data-id="${eattr(pkg.id)}">${icon('trash',17)} Excluir pacote</button>${!['Concluído','Cancelado'].includes(pkg.status)?`<button type="button" class="btn secondary" data-action="package-session" data-id="${eattr(pkg.id)}">${icon('plus',17)} Registrar sessão</button>`:''}<button type="button" class="btn secondary" data-action="edit-package" data-id="${eattr(pkg.id)}">${icon('edit',17)} Editar</button>`
  });
}

function openAttendanceForm(id='',prefill={}) {
  const existing=data().attendances.find(a=>a.id===id);
  const a={date:todayIso(),status:'Realizado',paid:true,paymentMethod:'Pix',chargedValue:0,duration:60,...prefill,...(existing||{})};
  openModal({
    title:existing?'Editar atendimento':'Novo atendimento',
    sub:'Sessão realizada, pagamento e evolução da cliente.',
    wide:true,
    content:`<div class="form-grid">
      ${field('Data','date',a.date,'date',{required:true})}
      ${selectField('Cliente','clientId',optionClients(a.clientId),a.clientId,{required:true})}
      ${selectField('Protocolo','protocolId',optionProtocols(a.protocolId),a.protocolId,{required:true})}
      ${selectField('Pacote (opcional)','packageId',optionPackages(a.clientId,a.packageId,a.protocolId),a.packageId)}
      ${field('Duração (min)','duration',a.duration,'number',{min:0,step:5})}
      ${field('Valor cobrado nesta sessão','chargedValue',a.chargedValue,'number',{min:0,step:'0.01',help:'Em sessões já pagas dentro de um pacote, deixe zero para não duplicar a receita.'})}
      ${selectField('Forma de pagamento','paymentMethod',['Pix','Dinheiro','Cartão de Débito','Cartão de Crédito à vista','Cartão de Crédito parcelado','Pacote','Cortesia'],a.paymentMethod)}
      ${field('Em quantas vezes','installments',a.installments||1,'number',{min:1,max:24,step:1,className:'installments-field'})}
      ${selectField('Status','status',['Realizado','Em andamento','Cancelado','Não compareceu'],a.status,{blank:false})}
      ${checkField('Pagamento recebido','paid',a.paid)}
      ${field('Próximo retorno','nextReturn',a.nextReturn,'date')}
      ${textarea('Evolução / resultado observado','evolution',a.evolution,{rows:4,className:'span-2'})}
      ${textarea('Observações','notes',a.notes,{rows:3,className:'span-2'})}
      <div class="stock-impact-preview span-2" id="attendance-stock-preview"></div>
    </div><input type="hidden" name="id" value="${eattr(a.id||'')}"><input type="hidden" name="appointmentId" value="${eattr(a.appointmentId||'')}">`,
    deleteAction:existing?'delete-attendance':'',
    deleteId:existing?.id||'',
    deleteText:'Excluir atendimento',
    submitText:'Salvar atendimento',
    onSubmit:async form=>{
      const o=formObject(form),client=findClient(o.clientId),protocol=findProtocol(o.protocolId);
      const linkedPackage=o.packageId?data().packages.find(pkg=>pkg.id===o.packageId):null;
      if(statusIsRealized(o.status)){
        const archivedProducts=(protocol?.products||[]).map(link=>findProductLocal(link.productId,link.productName)).filter(product=>product?.archived);
        if(archivedProducts.length)throw new Error(`Este protocolo usa produto(s) arquivado(s): ${archivedProducts.map(product=>product.name).join(', ')}. Atualize o protocolo ou reative o estoque antes de registrar a sessão.`);
        const archivedDisposables=(protocol?.disposables||[]).map(link=>findDisposableLocal(link.disposableId,link.disposableName)).filter(disposable=>disposable?.archived);
        if(archivedDisposables.length)throw new Error(`Este protocolo usa descartável(is) arquivado(s): ${archivedDisposables.map(disposable=>disposable.name).join(', ')}. Atualize o protocolo ou reative o estoque antes de registrar a sessão.`);
      }
      if(o.packageId&&!linkedPackage)throw new Error('O pacote selecionado não existe mais.');
      if(linkedPackage&&(linkedPackage.clientId!==o.clientId||linkedPackage.protocolId!==o.protocolId))throw new Error('O pacote selecionado não pertence à cliente e ao protocolo escolhidos.');
      if(linkedPackage&&normalize(linkedPackage.status)==='cancelado')throw new Error('Este pacote está cancelado e não aceita novas sessões.');
      if(linkedPackage&&statusIsRealized(o.status)){
        const alreadyRealized=packageRealizedAttendances(linkedPackage.id).filter(att=>att.id!==existing?.id).length;
        const used=Math.max(0,num(linkedPackage.sessionsBaseline))+alreadyRealized;
        if(used>=Math.max(1,num(linkedPackage.sessionsPurchased)))throw new Error('Todas as sessões deste pacote já foram utilizadas.');
      }
      let next=o.nextReturn||'';
      if(!next&&protocol?.returnDays){
        const dt=dateFromIso(o.date); dt.setDate(dt.getDate()+num(protocol.returnDays)); next=localIsoDate(dt);
      }
      const charged=num(o.chargedValue),baseCost=num(protocol?.cost);
      const item={...a,id:o.id||uid('AT'),date:o.date,clientId:o.clientId,clientName:client?.name||'',phone:client?.phone||'',protocolId:o.protocolId,protocolName:protocol?.name||'',packageId:o.packageId||'',duration:num(o.duration)||num(protocol?.duration),cost:baseCost,suggestedPrice:num(protocol?.price),chargedValue:charged,paymentMethod:o.paymentMethod||'',installments:o.paymentMethod==='Cartão de Crédito parcelado'?Math.max(1,num(o.installments)):1,paid:bool(o.paid),nextReturn:next,status:o.status,evolution:o.evolution||'',notes:o.notes||'',appointmentId:o.appointmentId||'',updatedAt:nowIso()};
      applyAttendanceInventory(existing,item);
      item.cost=Math.max(baseCost,num(item.inventoryCost)+num(item.disposableInventoryCost));
      item.profit=charged-item.cost;
      const idx=data().attendances.findIndex(x=>x.id===item.id);
      idx>=0?data().attendances.splice(idx,1,item):data().attendances.push(item);
      const packageIds=new Set([existing?.packageId,item.packageId].filter(Boolean));
      packageIds.forEach(recalculatePackage);
      if(item.appointmentId){
        const ap=data().appointments.find(x=>x.id===item.appointmentId);
        if(ap)ap.status=statusIsRealized(item.status)?'Concluído':item.status;
      }
      syncFinanceForAttendance(item);
      await persist(existing?'Atendimento editado':'Atendimento registrado',{detail:`${item.clientName} · ${item.protocolName}`});
      closeModal();renderView();toast('Atendimento salvo; estoque, pacote e financeiro atualizados.');
    }
  });
  const form=$('#app-modal-form');
  const refreshStockPreview=()=>{
    const protocol=findProtocol(form.elements.protocolId.value);
    const links=linkedProtocolProducts(protocol).filter(link=>link.qty>0);
    const disposableLinks=linkedProtocolDisposables(protocol).filter(link=>link.qty>0);
    const preview=form.querySelector('#attendance-stock-preview');
    if(!preview)return;
    const previousTotals=inventoryTotals(existing?.inventoryMovements||[]);
    const previousDisposableTotals=inventoryTotals((existing?.disposableMovements||[]).map(m=>({productId:m.disposableId,qty:m.qty})));
    const productSpans=links.map(link=>{const product=findProductLocal(link.productId,link.productName);const available=product?num(product.stock)+(previousTotals.get(link.productId)||0):0;const projected=available-num(link.qty);const enough=!!product&&projected>=-0.000001;return `<span class="${enough?'':'danger'}">${esc(link.productName)}: −${num(link.qty)} ${esc(link.unit||'')} · saldo previsto ${product?Math.max(0,projected):'sem vínculo'}</span>`;}).join('');
    const disposableSpans=disposableLinks.map(link=>{const disposable=findDisposableLocal(link.disposableId,link.disposableName);const available=disposable?num(disposable.stock)+(previousDisposableTotals.get(link.disposableId)||0):0;const projected=available-num(link.qty);const enough=!!disposable&&projected>=-0.000001;return `<span class="${enough?'':'danger'}">${esc(link.disposableName)}: −${num(link.qty)} ${esc(link.unit||'')} · saldo previsto ${disposable?Math.max(0,projected):'sem vínculo'}</span>`;}).join('');
    preview.innerHTML=(links.length||disposableLinks.length)?`<strong>Movimentação automática de estoque</strong><div>${productSpans}${disposableSpans}</div>`:'<strong>Estoque</strong><span>Este protocolo não possui produtos ou descartáveis com quantidade vinculada.</span>';
  };
  const autofill=()=>{
    const client=findClient(form.elements.clientId.value),protocol=findProtocol(form.elements.protocolId.value);
    if(protocol&&!existing){
      form.elements.duration.value=protocol.duration||60;
      if(!form.elements.packageId.value)setMoneyFieldValue(form.elements.chargedValue,protocol.price||0);
      if(protocol.returnDays){
        const dt=dateFromIso(form.elements.date.value);dt.setDate(dt.getDate()+num(protocol.returnDays));
        form.elements.nextReturn.value=localIsoDate(dt);
      }
    }
    const packSel=form.elements.packageId;
    const current=packSel.value||'';
    packSel.innerHTML='<option value="">Selecione</option>'+optionPackages(client?.id||'',current,protocol?.id||'').map(opt=>`<option value="${eattr(opt.value)}">${esc(opt.label)}</option>`).join('');
    packSel.value=current;
    if(packSel.value&&!existing){setMoneyFieldValue(form.elements.chargedValue,0);form.elements.paymentMethod.value='Pacote';}
    refreshStockPreview();
  };
  const refreshPaymentMethod=()=>{
    const installmentsField=form.querySelector('.installments-field');
    if(installmentsField)installmentsField.classList.toggle('is-hidden',form.elements.paymentMethod.value!=='Cartão de Crédito parcelado');
  };
  form.elements.paymentMethod.addEventListener('change',refreshPaymentMethod);
  refreshPaymentMethod();
  form.elements.clientId.addEventListener('change',autofill);
  form.elements.protocolId.addEventListener('change',autofill);
  form.elements.date.addEventListener('change',autofill);
  form.elements.packageId.addEventListener('change',()=>{
    const pkg=data().packages.find(item=>item.id===form.elements.packageId.value);
    if(pkg){
      form.elements.clientId.value=pkg.clientId;
      form.elements.protocolId.value=pkg.protocolId;
      setMoneyFieldValue(form.elements.chargedValue,0);
      form.elements.paymentMethod.value='Pacote';
    }
    refreshStockPreview();
  });
  refreshStockPreview();
}
