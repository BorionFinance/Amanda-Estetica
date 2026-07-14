'use strict';

/**
 * Amanda Estética — Anamneses, consentimentos, impressão e fotos.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function openAnamnesisForm(id='',prefill={}) {
    const existing=data().anamneses.find(a=>a.id===id);
    const a={date:todayIso(),professional:activeProfile()?.name||'Amanda',...prefill,...(existing||{})};
    const yesNo=['Não','Sim'];
    openModal({
      title:existing?'Editar anamnese':'Nova anamnese',
      wide:true,
      content:`<div class="form-grid">
        ${selectField('Cliente','clientId',optionClients(a.clientId),a.clientId,{required:true})}
        ${field('Data','date',a.date,'date',{required:true})}
        ${field('Profissional','professional',a.professional)}
        ${field('Tipo de pele','skinType',a.skinType)}
        ${field('Fototipo','phototype',a.phototype)}
        ${field('Sensibilidade','sensitivity',a.sensitivity)}
        ${textarea('Queixa principal','complaint',a.complaint,{required:true,rows:3,className:'span-2'})}
        ${textarea('Objetivo do tratamento','objective',a.objective,{rows:3,className:'span-2'})}
        ${textarea('Alergias','allergies',a.allergies,{rows:2})}
        ${textarea('Medicação contínua','medications',a.medications,{rows:2})}
        ${selectField('Gestante / lactante','pregnant',yesNo,a.pregnant,{blank:false})}
        ${selectField('Marcapasso','pacemaker',yesNo,a.pacemaker,{blank:false})}
        ${selectField('Diabetes','diabetes',yesNo,a.diabetes,{blank:false})}
        ${selectField('Hipertensão','hypertension',yesNo,a.hypertension,{blank:false})}
        ${selectField('Acne ativa','activeAcne',yesNo,a.activeAcne,{blank:false})}
        ${selectField('Rosácea','rosacea',yesNo,a.rosacea,{blank:false})}
        ${field('Uso de protetor solar','sunscreen',a.sunscreen)}
        ${field('Ingestão de água','waterIntake',a.waterIntake)}
        ${field('Sono','sleep',a.sleep)}
        ${field('Tabagismo','smoking',a.smoking)}
        ${field('Álcool','alcohol',a.alcohol)}
        ${textarea('Procedimentos anteriores','previousProcedures',a.previousProcedures,{rows:3,className:'span-2'})}
        ${textarea('Hábitos relevantes','habits',a.habits,{rows:3,className:'span-2'})}
        ${textarea('Observações clínicas','notes',a.notes,{rows:4,className:'span-2'})}
        ${checkField('Cliente confirmou a veracidade das informações','confirmed',a.confirmed,'Registre somente após revisar a ficha com a cliente.')}
      </div><input type="hidden" name="id" value="${eattr(a.id||'')}">`,
      submitText:'Salvar anamnese',
      onSubmit:async form=>{
        const o=formObject(form),client=findClient(o.clientId);
        const item={...a,...o,id:o.id||uid('AN'),clientId:o.clientId,clientName:client?.name||'',phone:client?.phone||'',confirmed:bool(o.confirmed),updatedAt:nowIso()};
        const idx=data().anamneses.findIndex(x=>x.id===item.id);
        idx>=0?data().anamneses.splice(idx,1,item):data().anamneses.push(item);
        await persist(existing?'Anamnese editada':'Anamnese criada',{detail:item.clientName});
        closeModal();renderView();toast('Anamnese salva.');
      }
    });
  }

  function viewAnamnesis(id) {
    const a=data().anamneses.find(x=>x.id===id);if(!a)return;
    const fields=[
      ['Data',formatDate(a.date)],['Profissional',a.professional],['Queixa principal',a.complaint],['Objetivo',a.objective],
      ['Tipo de pele',a.skinType],['Fototipo',a.phototype],['Sensibilidade',a.sensitivity],['Alergias',a.allergies],
      ['Gestante/lactante',a.pregnant],['Marcapasso',a.pacemaker],['Diabetes',a.diabetes],['Hipertensão',a.hypertension],
      ['Acne ativa',a.activeAcne],['Rosácea',a.rosacea],['Medicamentos',a.medications],['Procedimentos anteriores',a.previousProcedures],
      ['Hábitos',a.habits],['Observações',a.notes]
    ];
    openModal({title:`Anamnese · ${a.clientName}`,wide:true,content:`<dl class="details-grid anamnesis-detail">${fields.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd></div>`).join('')}</dl>`,extraFooter:`<button type="button" class="btn danger-soft" data-action="delete-anamnesis" data-id="${eattr(a.id)}">${icon('trash',17)} Excluir ficha</button><button type="button" class="btn secondary" data-action="edit-anamnesis" data-id="${eattr(a.id)}">${icon('edit',17)} Editar ficha</button>`});
  }

  function consentText(clientName,protocolName) {
    return `Declaro que fui orientada sobre o procedimento de ${protocolName || 'estética'}, suas indicações, contraindicações, cuidados antes e depois, possíveis reações e necessidade de comunicar qualquer intercorrência. Autorizo a profissional a registrar minha evolução clínica e manter meus dados exclusivamente para fins de atendimento, respeitando o sigilo profissional. Confirmo que forneci informações verdadeiras sobre meu estado de saúde e tive oportunidade de esclarecer minhas dúvidas antes do procedimento.`;
  }

  function openConsentForm(id='',prefill={}) {
    const existing=data().consents.find(c=>c.id===id);
    const c={date:todayIso(),accepted:false,...prefill,...(existing||{})};
    openModal({
      title:existing?'Editar consentimento':'Novo consentimento',
      wide:true,
      content:`<div class="form-grid">
        ${selectField('Cliente','clientId',optionClients(c.clientId),c.clientId,{required:true})}
        ${selectField('Procedimento','protocolId',optionProtocols(c.protocolId),c.protocolId,{required:true})}
        ${field('Data','date',c.date,'date',{required:true})}
        ${field('Nome da assinatura','signatureName',c.signatureName,'text',{className:'span-2'})}
        ${textarea('Texto do termo','text',c.text||consentText(c.clientName,c.protocolName),{rows:10,className:'span-2',required:true})}
        ${checkField('Cliente leu e aceitou o termo','accepted',c.accepted)}
      </div><input type="hidden" name="id" value="${eattr(c.id||'')}">`,
      submitText:'Salvar termo',
      onSubmit:async form=>{
        const o=formObject(form),client=findClient(o.clientId),protocol=findProtocol(o.protocolId);
        if(bool(o.accepted)&&!String(o.signatureName||'').trim())throw new Error('Informe o nome da assinatura para registrar o aceite.');
        const item={...c,id:o.id||uid('TC'),clientId:o.clientId,clientName:client?.name||'',protocolId:o.protocolId,protocolName:protocol?.name||'',date:o.date,signatureName:o.signatureName||'',text:o.text,accepted:bool(o.accepted),updatedAt:nowIso()};
        const idx=data().consents.findIndex(x=>x.id===item.id);
        idx>=0?data().consents.splice(idx,1,item):data().consents.push(item);
        await persist(existing?'Consentimento editado':'Consentimento criado',{detail:`${item.clientName} · ${item.protocolName}`});
        closeModal();renderView();toast('Consentimento salvo.');
      }
    });
    const form=$('#app-modal-form');
    const textField=form.elements.text;
    textField.dataset.generated=existing&&c.text?'0':'1';
    textField.addEventListener('input',()=>{textField.dataset.generated='0';},{once:true});
    const refreshText=()=>{
      const cl=findClient(form.elements.clientId.value),pr=findProtocol(form.elements.protocolId.value);
      if(textField.dataset.generated==='1'||!textField.value.trim())textField.value=consentText(cl?.name,pr?.name);
      if(!form.elements.signatureName.value)form.elements.signatureName.value=cl?.name||'';
    };
    form.elements.clientId.addEventListener('change',refreshText);
    form.elements.protocolId.addEventListener('change',refreshText);
  }

  function printConsent(id) {
    const c=data().consents.find(x=>x.id===id);if(!c)return;
    const clinic=activeProfile().clinic||{};
    const client=findClient(c.clientId,c.clientName)||{};
    const w=window.open('','_blank','width=850,height=900');
    if(!w){toast('O navegador bloqueou a janela de impressão.','warn');return;}
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Consentimento - ${esc(c.clientName)}</title><style>
      body{font-family:Arial,sans-serif;color:#2f2530;max-width:760px;margin:40px auto;line-height:1.65;padding:0 30px}header{border-bottom:2px solid #c85f86;padding-bottom:18px;margin-bottom:30px}h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin-top:32px}.muted{color:#6d6068}.box{background:#fff4f7;padding:18px;border-radius:10px;margin:18px 0}.sign{margin-top:70px;display:grid;grid-template-columns:1fr 1fr;gap:50px}.line{border-top:1px solid #333;text-align:center;padding-top:8px}@media print{body{margin:0 auto}.no-print{display:none}}</style></head><body>
      <header><h1>${esc(clinic.clinicName||'Amanda Braz Estética Avançada')}</h1><div class="muted">${esc([clinic.phone,clinic.email,clinic.city].filter(Boolean).join(' · '))}</div></header>
      <h2>Termo de consentimento</h2>
      <div class="box"><strong>Cliente:</strong> ${esc(c.clientName)}<br><strong>CPF:</strong> ${esc(client.cpf||'Não informado')}<br><strong>Procedimento:</strong> ${esc(c.protocolName)}<br><strong>Data:</strong> ${formatDate(c.date)}</div>
      <p>${esc(c.text).replace(/\n/g,'<br>')}</p>
      <p><strong>Status:</strong> ${c.accepted?'Aceito pela cliente':'Pendente de aceite'}</p>
      <div class="sign"><div class="line">${esc(c.signatureName||c.clientName)}<br><span class="muted">Cliente</span></div><div class="line">${esc(activeProfile().name)}<br><span class="muted">Profissional</span></div></div>
      <p class="muted" style="margin-top:55px">${esc(clinic.city||'')} · ${formatDate(c.date)}</p>
      <button class="no-print" onclick="window.print()" style="margin-top:25px;padding:12px 18px;background:#c85f86;color:white;border:0;border-radius:8px">Imprimir / Salvar em PDF</button>
    </body></html>`);
    w.document.close();
  }

  async function decodeClinicalImage(file) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file); } catch (_) { }
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.decoding='async';
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Não foi possível abrir a imagem.'));img.src=url;});
      return img;
    }finally{URL.revokeObjectURL(url);}
  }

  async function compressImage(file) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
    const source = await decodeClinicalImage(file);
    const width=source.width||source.naturalWidth,height=source.height||source.naturalHeight;
    const max=1200,scale=Math.min(1,max/Math.max(width,height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.78);
    source.close?.();
    if(dataUrl.length>2_800_000)throw new Error('A imagem ficou muito grande. Use uma foto menor.');
    return dataUrl;
  }

  function openPhotoForm(id='',prefill={}) {
    const existing=data().photos.find(p=>p.id===id);
    const p={date:todayIso(),phase:'Antes',authorization:false,...prefill,...(existing||{})};
    openModal({
      title:existing?'Editar foto':'Nova foto',
      wide:true,
      content:`<div class="form-grid">
        ${selectField('Cliente','clientId',optionClients(p.clientId),p.clientId,{required:true})}
        ${selectField('Protocolo','protocolId',optionProtocols(p.protocolId),p.protocolId)}
        ${field('Data','date',p.date,'date',{required:true})}
        ${selectField('Fase','phase',['Antes','Depois','Retorno','Comparativo'],p.phase,{blank:false})}
        ${field('Área tratada','area',p.area,'text',{className:'span-2'})}
        <label class="field span-2"><span>Imagem</span><input type="file" name="imageFile" accept="image/*"><small>A foto é comprimida e incluída no backup JSON. Para muitas fotos, acompanhe o tamanho dos backups.</small></label>
        ${field('Link externo (opcional)','url',p.url,'url',{className:'span-2'})}
        ${textarea('Resultado percebido','result',p.result,{rows:3,className:'span-2'})}
        ${textarea('Observações técnicas','notes',p.notes,{rows:3,className:'span-2'})}
        ${checkField('Autorização para uso da imagem','authorization',p.authorization)}
      </div><input type="hidden" name="id" value="${eattr(p.id||'')}">`,
      submitText:'Salvar foto',
      onSubmit:async form=>{
        const o=formObject(form),client=findClient(o.clientId),protocol=findProtocol(o.protocolId);
        const file=form.elements.imageFile.files[0];
        let imageData=p.imageData||'';
        if(file){updateSaveStatus('Comprimindo foto…','warn');imageData=await compressImage(file);}
        const item={...p,id:o.id||uid('FT'),clientId:o.clientId,clientName:client?.name||'',protocolId:o.protocolId||'',protocolName:protocol?.name||'',date:o.date,phase:o.phase,area:o.area||'',url:o.url||'',imageData,result:o.result||'',notes:o.notes||'',authorization:bool(o.authorization),updatedAt:nowIso()};
        const idx=data().photos.findIndex(x=>x.id===item.id);
        idx>=0?data().photos.splice(idx,1,item):data().photos.push(item);
        await persist(existing?'Foto editada':'Foto registrada',{detail:`${item.clientName} · ${item.phase}`});
        closeModal();renderView();toast('Foto salva.');
      }
    });
  }

  
