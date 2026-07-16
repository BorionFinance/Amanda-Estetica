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
  function optionProducts() {
    return data().products.filter(x=>!x.archived).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(x=>({value:x.id,label:`${x.name}${x.unit?` (${x.unit})`:''}`}));
  }
  const UF_OPTIONS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const BLOOD_TYPE_OPTIONS=['A+','A-','B+','B-','AB+','AB-','O+','O-'];

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
    const c=existing||{id:'',name:'',phone:'',cpf:'',birthDate:'',bloodType:'',address:'',number:'',neighborhood:'',city:'',state:'',zip:'',instagram:'',allergies:'',medications:'',contraindications:'',profession:'',source:'',notes:''};
    let cepSuggestions=[];
    openModal({
      title:existing?'Editar cliente':'Nova cliente',
      wide:true,
      content:`<div class="form-grid">
        ${field('Nome completo','name',c.name,'text',{required:true,className:'span-2'})}
        ${field('Telefone / WhatsApp','phone',c.phone,'tel',{placeholder:'(00) 00000-0000'})}
        ${field('CPF','cpf',c.cpf,'text',{placeholder:'000.000.000-00'})}
        ${field('Data de nascimento','birthDate',c.birthDate,'date')}
        ${selectField('Tipo sanguíneo','bloodType',BLOOD_TYPE_OPTIONS,c.bloodType)}
        ${field('Endereço','address',c.address,'text',{className:'span-2'})}
        ${field('Número','number',c.number)}
        ${field('Bairro','neighborhood',c.neighborhood)}
        <label class="field"><span>Cidade</span><input name="city" list="client-city-options" value="${eattr(c.city)}" data-client-city><datalist id="client-city-options"></datalist></label>
        ${selectField('Estado','state',UF_OPTIONS,c.state,{blank:true,placeholder:'UF'})}
        ${field('CEP','zip',c.zip,'text',{placeholder:'00000-000'})}
        <div class="field span-2 cep-helper">
          <div class="cep-actions">
            <button type="button" class="btn ghost compact" data-cep-lookup>Completar pelo CEP</button>
            <button type="button" class="btn secondary compact" data-cep-suggest>Sugerir CEP pelo endereço</button>
          </div>
          <small>Digite o CEP para completar o endereço automaticamente, ou use Estado/Cidade/Rua para descobrir o CEP. Se o serviço estiver indisponível, os campos continuam editáveis manualmente.</small>
          <div class="cep-suggestion-list" data-cep-results></div>
        </div>
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
    const form=$('#app-modal-form');
    form.elements.phone.addEventListener('input',()=>{form.elements.phone.value=maskPhone(form.elements.phone.value);});
    form.elements.cpf.addEventListener('input',()=>{form.elements.cpf.value=maskDocument(form.elements.cpf.value);});
    form.elements.zip.addEventListener('input',()=>{
      form.elements.zip.value=maskZip(form.elements.zip.value);
      if(digitsOnly(form.elements.zip.value).length===8)lookupCep();
    });

    function setCepStatus(message){
      const box=form.querySelector('[data-cep-results]');
      if(box)box.innerHTML=message?`<small class="cep-status">${esc(message)}</small>`:'';
    }
    async function loadCitiesForState(uf,currentCity=''){
      const list=form.querySelector('#client-city-options');
      if(!list)return;
      if(!uf){list.innerHTML='';return;}
      try{
        const response=await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`,{cache:'force-cache'});
        if(!response.ok)return;
        const cities=await response.json();
        if(!Array.isArray(cities))return;
        list.innerHTML=cities.map(x=>`<option value="${eattr(x.nome)}"></option>`).join('');
      }catch(_){ /* IBGE indisponível: cidade continua editável livremente */ }
    }
    async function lookupCep(){
      const cep=digitsOnly(form.elements.zip.value);
      if(cep.length!==8){toast('Informe um CEP com 8 dígitos.','error');return;}
      setCepStatus('Consultando CEP…');
      let response;
      try{response=await fetch(`https://viacep.com.br/ws/${cep}/json/`);}
      catch(_){setCepStatus('Serviço de CEP indisponível. Preencha manualmente.');return;}
      if(!response.ok){setCepStatus('Serviço de CEP indisponível. Preencha manualmente.');return;}
      const result=await response.json();
      if(result.erro){setCepStatus('CEP não encontrado.');return;}
      form.elements.address.value=result.logradouro||form.elements.address.value;
      form.elements.neighborhood.value=result.bairro||form.elements.neighborhood.value;
      form.elements.city.value=result.localidade||form.elements.city.value;
      if(form.elements.state)form.elements.state.value=result.uf||form.elements.state.value;
      form.elements.zip.value=maskZip(cep);
      await loadCitiesForState(result.uf,result.localidade);
      setCepStatus('Endereço preenchido pelo CEP. Revise antes de salvar.');
    }
    async function lookupAddressCep(){
      const uf=form.elements.state.value,city=form.elements.city.value.trim(),street=form.elements.address.value.trim();
      if(!uf||!city||!street){toast('Informe Estado, Cidade e Rua para sugerir o CEP.','error');return;}
      setCepStatus('Consultando endereços…');
      let response;
      try{response=await fetch(`https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`);}
      catch(_){setCepStatus('Serviço de endereço indisponível. Preencha o CEP manualmente.');return;}
      if(!response.ok){setCepStatus('Serviço de endereço indisponível. Preencha o CEP manualmente.');return;}
      const result=await response.json();
      cepSuggestions=Array.isArray(result)?result.filter(x=>x.cep).slice(0,20):[];
      if(!cepSuggestions.length){setCepStatus('Nenhum CEP encontrado para esse endereço.');return;}
      if(cepSuggestions.length===1){applyCepSuggestion(0);return;}
      const box=form.querySelector('[data-cep-results]');
      if(box)box.innerHTML=cepSuggestions.map((x,i)=>`<button type="button" class="cep-result" data-apply-cep="${i}"><strong>${esc(x.logradouro||street)} · ${esc(maskZip(x.cep))}</strong><small>${esc([x.bairro,x.localidade,x.uf].filter(Boolean).join(' · '))}</small></button>`).join('');
    }
    function applyCepSuggestion(index){
      const x=cepSuggestions[num(index)];if(!x)return;
      form.elements.address.value=x.logradouro||form.elements.address.value;
      form.elements.neighborhood.value=x.bairro||form.elements.neighborhood.value;
      form.elements.city.value=x.localidade||form.elements.city.value;
      if(form.elements.state)form.elements.state.value=x.uf||form.elements.state.value;
      form.elements.zip.value=maskZip(x.cep);
      loadCitiesForState(x.uf,x.localidade);
      setCepStatus(`Selecionado: ${x.logradouro||'Endereço'} · ${maskZip(x.cep)}. Você ainda pode editar os campos.`);
    }
    form.querySelector('[data-cep-lookup]').addEventListener('click',lookupCep);
    form.querySelector('[data-cep-suggest]').addEventListener('click',lookupAddressCep);
    form.querySelector('[data-cep-results]').addEventListener('click',e=>{
      const btn=e.target.closest('[data-apply-cep]');
      if(!btn)return;
      applyCepSuggestion(btn.dataset.applyCep);
    });
    form.elements.state.addEventListener('change',()=>loadCitiesForState(form.elements.state.value,form.elements.city.value));
    if(c.state)loadCitiesForState(c.state,c.city);
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
    const p=existing||{id:'',name:'',duration:60,cost:0,extraCostPct:0,price:0,returnDays:30,birthdayGift:'',preparation:'',notes:'',products:[]};
    let linkedProducts=(p.products||[]).map(x=>({...x}));
    openModal({
      title:existing?'Editar protocolo':'Novo protocolo',
      wide:true,
      content:`<div class="form-grid">
        ${field('Código','code',p.id||`PR${String(data().protocols.length+1).padStart(3,'0')}`,'text',{required:true})}
        ${field('Nome do protocolo','name',p.name,'text',{required:true,className:'span-2'})}
        ${field('Duração (min)','duration',p.duration,'number',{min:0,step:5})}
        ${field('Preço padrão','price',p.price,'number',{min:0,step:'0.01'})}
        ${field('Intervalo de retorno (dias)','returnDays',p.returnDays,'number',{min:0})}
        ${field('Brinde de aniversário','birthdayGift',p.birthdayGift,'text',{className:'span-2'})}
        <div class="field span-2 linked-products-field">
          <span>Produtos vinculados</span>
          <div class="linked-products-list" data-linked-products-list></div>
          <div class="linked-products-picker is-hidden" data-linked-products-picker>
            <select data-picker-product><option value="">Selecione um produto</option>${optionProducts().map(opt=>`<option value="${eattr(opt.value)}">${esc(opt.label)}</option>`).join('')}</select>
            <input type="number" min="0" step="0.01" placeholder="Qtd. usada" data-picker-qty>
            <input type="number" min="0" step="0.01" placeholder="Custo (R$)" data-picker-cost>
            <div class="linked-products-picker-actions">
              <button type="button" class="btn ghost compact" data-picker-cancel>Cancelar</button>
              <button type="button" class="btn primary compact" data-picker-confirm>Adicionar</button>
            </div>
          </div>
          <button type="button" class="btn secondary compact" data-picker-open>${icon('plus',16)} Adicionar produto</button>
          <input type="hidden" name="productsJson" data-products-json>
          <small>A quantidade será descontada do estoque quando o atendimento for realizado.</small>
        </div>
        <p class="muted linked-products-subtotal" data-linked-cost-subtotal>Custo dos insumos vinculados: R$ 0,00</p>
        ${field('Extra para descartáveis (%)','extraCostPct',p.extraCostPct||0,'number',{min:0,max:100,step:'0.1',help:'Somado ao custo dos insumos para cobrir luvas, algodão e outros descartáveis.'})}
        ${field('Custo previsto (calculado)','cost',p.cost,'number',{readonly:true,help:'Insumos + percentual de descartáveis, calculado automaticamente.'})}
        ${textarea('Preparos / orientações','preparation',p.preparation,{rows:3,className:'span-2'})}
        ${textarea('Observações','notes',p.notes,{rows:3,className:'span-2'})}
      </div><input type="hidden" name="originalId" value="${eattr(p.id||'')}">`,
      deleteAction:existing?'delete-protocol':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir/arquivar protocolo',
      submitText:'Salvar protocolo',
      onSubmit:async form=>{
        const o=formObject(form);
        let rawProducts=[];
        try{ rawProducts=JSON.parse(o.productsJson||'[]'); }catch(_){ rawProducts=[]; }
        const products=rawProducts.map(x=>{
          const product=findProductLocal(x.productId,x.productName);
          if(!product)throw new Error(`O produto “${x.productName||x.productId}” não está mais cadastrado. Remova-o e adicione novamente.`);
          if(product.archived)throw new Error(`O produto “${product.name}” está arquivado. Reative-o antes de vincular ao protocolo.`);
          const qty=Math.max(0,num(x.qty));
          if(qty<=0)throw new Error(`Informe uma quantidade maior que zero para ${product.name}.`);
          const unitCost=num(product.unitCost);
          return {productId:product.id,productName:product.name,unit:product.unit||'',qty,unitCost,cost:num(x.cost)||(qty*unitCost)};
        });
        const productCost=products.reduce((sum,x)=>sum+num(x.cost),0);
        const extraCostPct=Math.max(0,num(o.extraCostPct));
        const effectiveCost=productCost*(1+extraCostPct/100);
        const item={...p,id:o.code.trim(),name:o.name.trim(),duration:num(o.duration),cost:effectiveCost,extraCostPct,price:num(o.price),profit:num(o.price)-effectiveCost,returnDays:num(o.returnDays),birthdayGift:o.birthdayGift||'',preparation:o.preparation||'',notes:o.notes||'',products,productCost,updatedAt:nowIso()};
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
    const form=$('#app-modal-form');
    const listEl=form.querySelector('[data-linked-products-list]');
    const jsonEl=form.querySelector('[data-products-json]');
    const subtotalEl=form.querySelector('[data-linked-cost-subtotal]');
    const costInput=form.elements.cost;
    const pctInput=form.elements.extraCostPct;
    const pickerBtn=form.querySelector('[data-picker-open]');
    const picker=form.querySelector('[data-linked-products-picker]');
    const pickerProduct=picker.querySelector('[data-picker-product]');
    const pickerQty=picker.querySelector('[data-picker-qty]');
    const pickerCost=picker.querySelector('[data-picker-cost]');
    let pickerCostTouched=false;

    function updateCostPreview(){
      const subtotal=linkedProducts.reduce((sum,x)=>sum+num(x.cost),0);
      const pct=Math.max(0,num(pctInput.value));
      const total=subtotal*(1+pct/100);
      subtotalEl.textContent=`Custo dos insumos vinculados: ${currency(subtotal)}`;
      setMoneyFieldValue(costInput,total);
    }
    function renderLinkedProducts(){
      listEl.innerHTML=linkedProducts.length
        ? linkedProducts.map((x,i)=>`<div class="linked-product-row" data-index="${i}">
            <span>${esc(x.productName)} — ${currency(x.cost)}</span>
            <button type="button" class="icon-btn tiny danger" data-remove-index="${i}" aria-label="Remover ${esc(x.productName)}">${icon('trash',14)}</button>
          </div>`).join('')
        : '<p class="muted linked-products-empty">Nenhum produto vinculado ainda.</p>';
      jsonEl.value=JSON.stringify(linkedProducts);
      updateCostPreview();
    }
    function resetPicker(){
      pickerProduct.value='';pickerQty.value='';pickerCost.value='';pickerCostTouched=false;
      picker.classList.add('is-hidden');pickerBtn.classList.remove('is-hidden');
    }
    function recomputePickerCost(){
      if(pickerCostTouched)return;
      const product=data().products.find(x=>x.id===pickerProduct.value);
      const qty=num(pickerQty.value);
      pickerCost.value=product&&qty?(qty*num(product.unitCost)).toFixed(2):'';
    }
    pickerBtn.addEventListener('click',()=>{picker.classList.remove('is-hidden');pickerBtn.classList.add('is-hidden');pickerProduct.focus();});
    picker.querySelector('[data-picker-cancel]').addEventListener('click',resetPicker);
    pickerProduct.addEventListener('change',()=>{pickerCostTouched=false;recomputePickerCost();});
    pickerQty.addEventListener('input',recomputePickerCost);
    pickerCost.addEventListener('input',()=>{pickerCostTouched=true;});
    picker.querySelector('[data-picker-confirm]').addEventListener('click',()=>{
      const product=data().products.find(x=>x.id===pickerProduct.value);
      if(!product){toast('Selecione um produto.','error');return;}
      const qty=num(pickerQty.value);
      if(qty<=0){toast('Informe uma quantidade maior que zero.','error');return;}
      const unitCost=num(product.unitCost);
      const cost=num(pickerCost.value)||(qty*unitCost);
      linkedProducts.push({productId:product.id,productName:product.name,unit:product.unit||'',qty,unitCost,cost});
      resetPicker();
      renderLinkedProducts();
    });
    listEl.addEventListener('click',e=>{
      const btn=e.target.closest('[data-remove-index]');
      if(!btn)return;
      linkedProducts.splice(num(btn.dataset.removeIndex),1);
      renderLinkedProducts();
    });
    pctInput.addEventListener('input',updateCostPreview);
    renderLinkedProducts();
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

  
