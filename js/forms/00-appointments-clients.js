'use strict';

/**
 * Amanda Estética — Seletores auxiliares, agenda, clientes e protocolos.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function optionClients(current='') {
    return data().clients.filter(c=>!c.archived||c.id===current).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(c=>({value:c.id,label:c.name}));
  }
  function optionProtocols(current='') {
    return data().protocols.filter(p=>!p.archived||p.id===current).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(p=>({value:p.id,label:p.name}));
  }
  function optionPackages(clientId='', current='', protocolId='') {
    return data().packages
      .filter(p=>(!clientId||p.clientId===clientId)&&(!protocolId||p.protocolId===protocolId)&&(!['Concluído','Cancelado'].includes(p.status)||p.id===current))
      .map(p=>({value:p.id,label:`${p.clientName} · ${p.protocolName} (${Math.max(0,num(p.sessionsPurchased)-num(p.sessionsDone))} restantes)`}));
  }

  function findClient(id,name='') {
    return data().clients.find(c=>c.id===id) || data().clients.find(c=>c.name===name);
  }
  function findProtocol(id,name='') {
    return data().protocols.find(p=>p.id===id) || data().protocols.find(p=>p.name===name);
  }

  function openAppointmentForm(id='', prefill={}) {
    const existing=data().appointments.find(a=>a.id===id);
    const a={date:todayIso(),time:'09:00',status:'Agendado',duration:60,value:0,...prefill,...(existing||{})};
    openModal({
      title: existing?'Editar agendamento':'Novo agendamento',
      wide:true,
      content:`<div class="form-grid">
        ${field('Data','date',a.date,'date',{required:true})}
        ${field('Hora','time',a.time,'time',{required:true})}
        ${selectField('Cliente','clientId',optionClients(a.clientId),a.clientId,{required:true})}
        ${selectField('Protocolo','protocolId',optionProtocols(a.protocolId),a.protocolId,{required:true})}
        ${selectField('Pacote (opcional)','packageId',optionPackages(a.clientId,a.packageId,a.protocolId),a.packageId)}
        ${field('Duração (min)','duration',a.duration,'number',{min:0,step:5})}
        ${field('Valor previsto','value',a.value,'number',{min:0,step:'0.01'})}
        ${selectField('Status','status',['Agendado','Confirmado','Reagendado','Cancelado','Concluído'],a.status,{blank:false})}
        ${checkField('Confirmado pela cliente','confirmed',a.confirmed)}
        ${checkField('É atendimento de aniversário','birthday',a.birthday)}
        ${textarea('Preparos / orientações','preparation',a.preparation,{rows:3})}
        ${textarea('Observações','notes',a.notes,{rows:3})}
      </div><input type="hidden" name="id" value="${eattr(a.id||'')}">`,
      deleteAction:existing?'delete-appointment':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir agendamento',
      submitText:'Salvar agendamento',
      onSubmit: async form=>{
        const o=formObject(form);
        const client=findClient(o.clientId);
        const protocol=findProtocol(o.protocolId);
        const linkedPackage=o.packageId?data().packages.find(p=>p.id===o.packageId):null;
        if(linkedPackage&&(linkedPackage.clientId!==o.clientId||linkedPackage.protocolId!==o.protocolId))throw new Error('O pacote selecionado não pertence à cliente e ao protocolo escolhidos.');
        const item={
          id:o.id||uid('AG'), date:o.date, time:o.time, clientId:o.clientId,
          clientName:client?.name||'', phone:client?.phone||'', protocolId:o.protocolId,
          protocolName:protocol?.name||'', packageId:o.packageId||'', duration:num(o.duration),
          value:num(o.value), status:o.status, confirmed:bool(o.confirmed), birthday:bool(o.birthday),
          preparation:o.preparation||'', notes:o.notes||'', updatedAt:nowIso()
        };
        const idx=data().appointments.findIndex(x=>x.id===item.id);
        idx>=0?data().appointments.splice(idx,1,item):data().appointments.push(item);
        await persist(existing?'Agendamento editado':'Agendamento criado',{detail:`${item.clientName} · ${item.protocolName}`});
        closeModal(); renderView(); toast('Agendamento salvo.');
      }
    });
    const form=$('#app-modal-form');
    const clientSel=form.elements.clientId, protocolSel=form.elements.protocolId;
    const autofill=()=>{
      const c=findClient(clientSel.value);
      const p=findProtocol(protocolSel.value);
      if(p){
        if(!existing){ form.elements.duration.value=p.duration||60; setMoneyFieldValue(form.elements.value,p.price||0); }
        if(!form.elements.preparation.value) form.elements.preparation.value=p.preparation||'';
      }
      const packageSel=form.elements.packageId;
      const selectedPackage=packageSel.value||'';
      packageSel.innerHTML='<option value="">Selecione</option>'+optionPackages(c?.id||'',selectedPackage,p?.id||'').map(opt=>`<option value="${eattr(opt.value)}">${esc(opt.label)}</option>`).join('');
      packageSel.value=selectedPackage;
      if(packageSel.value&&!existing)setMoneyFieldValue(form.elements.value,0);
    };
    clientSel.addEventListener('change',autofill);
    protocolSel.addEventListener('change',autofill);
    form.elements.packageId.addEventListener('change',()=>{if(form.elements.packageId.value&&!existing)setMoneyFieldValue(form.elements.value,0);});
  }

  function openClientForm(id='') {
    const existing=data().clients.find(c=>c.id===id);
    const c=existing||{id:'',name:'',phone:'',cpf:'',birthDate:'',bloodType:'',address:'',number:'',neighborhood:'',city:'',zip:'',instagram:'',allergies:'',medications:'',contraindications:'',profession:'',source:'',notes:''};
    openModal({
      title:existing?'Editar cliente':'Nova cliente',
      wide:true,
      content:`<div class="form-grid">
        ${field('Nome completo','name',c.name,'text',{required:true,className:'span-2'})}
        ${field('Telefone / WhatsApp','phone',c.phone,'tel')}
        ${field('CPF','cpf',c.cpf)}
        ${field('Data de nascimento','birthDate',c.birthDate,'date')}
        ${field('Tipo sanguíneo','bloodType',c.bloodType)}
        ${field('Endereço','address',c.address,'text',{className:'span-2'})}
        ${field('Número','number',c.number)}
        ${field('Bairro','neighborhood',c.neighborhood)}
        ${field('Cidade','city',c.city)}
        ${field('CEP','zip',c.zip)}
        ${field('Instagram','instagram',c.instagram)}
        ${field('Profissão','profession',c.profession)}
        ${field('Como conheceu','source',c.source,'text',{className:'span-2'})}
        ${textarea('Alergias','allergies',c.allergies,{rows:2})}
        ${textarea('Medicamentos','medications',c.medications,{rows:2})}
        ${textarea('Contraindicações','contraindications',c.contraindications,{rows:2})}
        ${textarea('Observações','notes',c.notes,{rows:2})}
      </div><input type="hidden" name="id" value="${eattr(c.id||'')}">`,
      deleteAction:existing?'delete-client':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir cliente',
      submitText:'Salvar cliente',
      onSubmit:async form=>{
        const o=formObject(form);
        const previousId=c.id||'';
        const duplicateCpf=o.cpf&&data().clients.find(x=>x.id!==previousId&&normalize(x.cpf)===normalize(o.cpf));
        if(duplicateCpf)throw new Error(`CPF já cadastrado para ${duplicateCpf.name}.`);
        const item={...c,...o,id:o.id||uid('C'),updatedAt:nowIso()};
        const idx=data().clients.findIndex(x=>x.id===item.id);
        idx>=0?data().clients.splice(idx,1,item):data().clients.push(item);
        syncClientReferences(item,previousId);
        await persist(existing?'Cliente editada':'Cliente criada',{detail:item.name});
        closeModal(); renderView(); toast('Cliente salva.');
      }
    });
  }

  function viewClient(id) {
    const c=findClient(id);
    if(!c)return;
    const d=data();
    const atts=d.attendances.filter(a=>a.clientId===c.id||a.clientName===c.name).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const packs=d.packages.filter(p=>p.clientId===c.id||p.clientName===c.name);
    const anam=d.anamneses.filter(a=>a.clientId===c.id||a.clientName===c.name);
    const photos=d.photos.filter(p=>p.clientId===c.id||p.clientName===c.name);
    const consents=d.consents.filter(p=>p.clientId===c.id||p.clientName===c.name);
    const appointments=d.appointments.filter(p=>p.clientId===c.id||p.clientName===c.name);
    openModal({
      title:c.name,
      wide:true,
      content:`<div class="client-detail-head">
        <span class="profile-avatar large">${esc(c.name.slice(0,1))}</span>
        <div><h3>${esc(c.name)}</h3><span>${esc(c.phone||'Sem telefone')} · ${esc(c.city||'Cidade não informada')}</span></div>
        ${whatsappNumber(c.phone)?`<a class="btn secondary compact" href="https://wa.me/${whatsappNumber(c.phone)}" target="_blank" rel="noopener">${icon('phone',16)} WhatsApp</a>`:''}
      </div>
      <div class="quick-actions">
        <button type="button" class="btn secondary compact" data-action="client-new-attendance" data-id="${eattr(c.id)}">${icon('clipboard',16)} Atendimento</button>
        <button type="button" class="btn secondary compact" data-action="client-new-anamnesis" data-id="${eattr(c.id)}">${icon('heart',16)} Anamnese</button>
        <button type="button" class="btn secondary compact" data-action="client-new-package" data-id="${eattr(c.id)}">${icon('package',16)} Pacote</button>
        <button type="button" class="btn secondary compact" data-action="client-new-photo" data-id="${eattr(c.id)}">${icon('image',16)} Foto</button>
        <button type="button" class="btn secondary compact" data-action="client-new-appointment" data-id="${eattr(c.id)}">${icon('calendar',16)} Agendar</button>
        <button type="button" class="btn secondary compact" data-action="client-new-consent" data-id="${eattr(c.id)}">${icon('signature',16)} Consentimento</button>
      </div>
      <div class="detail-tabs">
        <section><h4>Dados</h4><dl class="details-grid">
          <div><dt>CPF</dt><dd>${esc(c.cpf||'—')}</dd></div><div><dt>Nascimento</dt><dd>${formatDate(c.birthDate)}</dd></div>
          <div><dt>Endereço</dt><dd>${esc([c.address,c.number,c.neighborhood,c.city].filter(Boolean).join(', ')||'—')}</dd></div><div><dt>Profissão</dt><dd>${esc(c.profession||'—')}</dd></div>
          <div><dt>Alergias</dt><dd>${esc(c.allergies||'—')}</dd></div><div><dt>Contraindicações</dt><dd>${esc(c.contraindications||'—')}</dd></div>
        </dl></section>
        <section><h4>Histórico recente</h4>${atts.length?atts.slice(0,8).map(a=>`<div class="mini-record"><span>${formatDate(a.date)}</span><strong>${esc(a.protocolName)}</strong><small>${currency(a.chargedValue)}</small></div>`).join(''):'<p class="muted">Sem atendimentos.</p>'}</section>
        <section><h4>Resumo clínico</h4><div class="database-stats"><div><strong>${atts.length}</strong><span>Atendimentos</span></div><div><strong>${packs.length}</strong><span>Pacotes</span></div><div><strong>${anam.length}</strong><span>Anamneses</span></div><div><strong>${photos.length}</strong><span>Fotos</span></div><div><strong>${consents.length}</strong><span>Termos</span></div><div><strong>${appointments.length}</strong><span>Agenda</span></div></div></section>
      </div>`,
      submitText:'',
      extraFooter:`<button type="button" class="btn danger-soft" data-action="delete-client" data-id="${eattr(c.id)}">${icon('trash',17)} Excluir cliente</button><button type="button" class="btn secondary" data-action="edit-client" data-id="${eattr(c.id)}">${icon('edit',17)} Editar cadastro</button>`
    });
  }

  function openProtocolForm(id='') {
    const existing=findProtocol(id);
    const p=existing||{id:'',name:'',duration:60,cost:0,price:0,returnDays:30,birthdayGift:'',preparation:'',notes:'',products:[]};
    const productText=(p.products||[]).map(x=>`${x.productId||x.productName} | ${num(x.qty)||0}${x.cost?` | ${x.cost}`:''}`).join('\n');
    openModal({
      title:existing?'Editar protocolo':'Novo protocolo',
      wide:true,
      content:`<div class="form-grid">
        ${field('Código','code',p.id||`PR${String(data().protocols.length+1).padStart(3,'0')}`,'text',{required:true})}
        ${field('Nome do protocolo','name',p.name,'text',{required:true,className:'span-2'})}
        ${field('Duração (min)','duration',p.duration,'number',{min:0,step:5})}
        ${field('Custo previsto','cost',p.cost,'number',{min:0,step:'0.01'})}
        ${field('Preço padrão','price',p.price,'number',{min:0,step:'0.01'})}
        ${field('Intervalo de retorno (dias)','returnDays',p.returnDays,'number',{min:0})}
        ${field('Brinde de aniversário','birthdayGift',p.birthdayGift,'text',{className:'span-2'})}
        <label class="field span-2"><span>Produtos vinculados</span><textarea name="productsText" rows="7" placeholder="Código ou nome | quantidade usada | custo opcional">${esc(productText)}</textarea><small>Exemplo: P001 | 2,5. A quantidade será descontada do estoque quando o atendimento for realizado.</small></label>
        ${textarea('Preparos / orientações','preparation',p.preparation,{rows:3,className:'span-2'})}
        ${textarea('Observações','notes',p.notes,{rows:3,className:'span-2'})}
      </div><input type="hidden" name="originalId" value="${eattr(p.id||'')}">`,
      deleteAction:existing?'delete-protocol':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir/arquivar protocolo',
      submitText:'Salvar protocolo',
      onSubmit:async form=>{
        const o=formObject(form);
        const products=(o.productsText||'').split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{
          const [reference,qtyText,costText]=line.split('|').map(x=>x.trim());
          const product=findProductLocal(reference,reference);
          if(!product)throw new Error(`O produto “${reference}” não está cadastrado. Cadastre-o no estoque antes de vinculá-lo.`);
          if(product.archived)throw new Error(`O produto “${product.name}” está arquivado. Reative-o antes de vincular ao protocolo.`);
          const qty=Math.max(0,num(qtyText));
          if(qty<=0)throw new Error(`Informe uma quantidade maior que zero para ${product.name}.`);
          const unitCost=num(product.unitCost);
          return {productId:product.id,productName:product.name,unit:product.unit||'',qty,unitCost,cost:num(costText)||(qty*unitCost)};
        });
        const productCost=products.reduce((sum,x)=>sum+num(x.cost),0);
        const effectiveCost=Math.max(num(o.cost),productCost);
        const item={...p,id:o.code.trim(),name:o.name.trim(),duration:num(o.duration),cost:effectiveCost,price:num(o.price),profit:num(o.price)-effectiveCost,returnDays:num(o.returnDays),birthdayGift:o.birthdayGift||'',preparation:o.preparation||'',notes:o.notes||'',products,productCost,updatedAt:nowIso()};
        if(!item.id)throw new Error('Informe o código do protocolo.');
        const duplicate=data().protocols.find(x=>x.id===item.id&&x.id!==o.originalId);
        if(duplicate)throw new Error('Já existe outro protocolo com esse código.');
        const idx=data().protocols.findIndex(x=>x.id===o.originalId);
        idx>=0?data().protocols.splice(idx,1,item):data().protocols.push(item);
        syncProtocolReferences(item,o.originalId||item.id);
        await persist(existing?'Protocolo editado':'Protocolo criado',{detail:item.name});
        closeModal();renderView();toast('Protocolo salvo.');
      }
    });
  }

  function viewProtocol(id) {
    const p=findProtocol(id); if(!p)return;
    openModal({title:p.name,wide:true,content:`<div class="protocol-detail">
      <div class="stats-grid compact-stats">${statCard('Duração',`${num(p.duration)} min`,'','clock')}${statCard('Custo',currency(p.cost),'','wallet')}${statCard('Preço',currency(p.price),'','wallet')}${statCard('Lucro',currency(num(p.price)-num(p.cost)),'','wallet')}</div>
      <section><h4>Produtos, estoque e custos</h4>${(p.products||[]).length?`<div class="responsive-table"><table><thead><tr><th>Produto</th><th>Uso/sessão</th><th>Estoque atual</th><th>Custo</th></tr></thead><tbody>${linkedProtocolProducts(p).map(x=>{const product=findProductLocal(x.productId,x.productName);return `<tr><td data-label="Produto">${esc(x.productName)} ${x.linked?'':chip('Sem vínculo','warn')}</td><td data-label="Uso/sessão">${num(x.qty)||'—'} ${esc(x.unit||'')}</td><td data-label="Estoque atual">${product?`${num(product.stock)} ${esc(product.unit||'')}`:'—'}</td><td data-label="Custo">${currency(x.cost)}</td></tr>`;}).join('')}</tbody></table></div><p class="muted">Custo dos insumos vinculados: ${currency((p.products||[]).reduce((sum,x)=>sum+num(x.cost),0))}.</p>`:'<p class="muted">Nenhum produto vinculado.</p>'}</section>
      <section><h4>Orientações</h4><p>${esc(p.preparation||'Nenhuma orientação cadastrada.')}</p></section>
      <section><h4>Retorno</h4><p>${p.returnDays?`Sugerido em ${num(p.returnDays)} dias.`:'Sem intervalo definido.'}</p></section>
    </div>`,extraFooter:`<button type="button" class="btn danger-soft" data-action="delete-protocol" data-id="${eattr(p.id)}">${icon('trash',17)} Excluir/arquivar</button><button type="button" class="btn secondary" data-action="edit-protocol" data-id="${eattr(p.id)}">${icon('edit',17)} Editar</button>`});
  }

  
