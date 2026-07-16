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
      deleteAction:existing?'delete-anamnesis':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir anamnese',
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
      deleteAction:existing?'delete-consent':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir consentimento',
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
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#c85f86"><title>Consentimento · ${esc(c.clientName)} · Amanda Estética</title><style>
      :root{--rose:#c85f86;--rose-dark:#a9476b;--ink:#332a2f;--muted:#786a71;--line:rgba(214,186,198,.58);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink)}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 12%,#ffe4ef 0,transparent 28%),radial-gradient(circle at 88% 86%,#f3d9e5 0,transparent 30%),linear-gradient(180deg,#fcf7fa,#f8eff4);padding:28px}.print-shell{max-width:860px;margin:0 auto}.app-bar{position:sticky;top:14px;z-index:3;display:flex;align-items:center;gap:12px;padding:13px 15px;margin-bottom:18px;background:rgba(255,255,255,.72);backdrop-filter:blur(20px) saturate(145%);border:1px solid rgba(255,255,255,.72);border-radius:20px;box-shadow:0 18px 45px rgba(117,73,91,.15)}.brand{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(145deg,#fff6f9,#f4d4df);border:1px solid #ecc8d5;color:var(--rose-dark);font-family:Georgia,serif;font-weight:800}.app-bar-copy{min-width:0;flex:1}.app-bar strong,.app-bar small{display:block}.app-bar small{color:var(--muted);font-size:12px;margin-top:2px}.print-btn{border:0;border-radius:14px;padding:11px 16px;background:linear-gradient(180deg,#dc6796,#c65583);color:#fff;font-weight:750;box-shadow:0 12px 28px rgba(200,95,134,.28);cursor:pointer}.document{background:rgba(255,255,255,.86);border:1px solid rgba(255,255,255,.78);border-radius:26px;padding:42px;box-shadow:0 28px 70px rgba(117,73,91,.16);line-height:1.72}.document header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid rgba(200,95,134,.30);padding-bottom:22px;margin-bottom:30px}.document h1{font-size:27px;margin:0 0 5px;letter-spacing:-.035em}.document h2{font-size:20px;margin:30px 0 12px}.muted{color:var(--muted)}.box{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;background:linear-gradient(135deg,rgba(255,244,248,.95),rgba(250,226,236,.78));padding:20px;border:1px solid rgba(234,200,214,.68);border-radius:18px;margin:20px 0}.box span{display:block}.box small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.status{display:inline-flex;padding:7px 11px;border-radius:999px;background:${c.accepted?'#e7f4ed':'#fff1df'};color:${c.accepted?'#3f765d':'#9b662c'};font-size:12px;font-weight:750}.sign{margin-top:76px;display:grid;grid-template-columns:1fr 1fr;gap:58px}.line{border-top:1px solid #4e4349;text-align:center;padding-top:10px}.document-footer{margin-top:58px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}@media(max-width:650px){body{padding:12px}.app-bar{top:8px}.app-bar-copy small{display:none}.print-btn{padding:10px 12px}.document{padding:24px 20px;border-radius:20px}.document header{display:block}.box,.sign{grid-template-columns:1fr}.sign{gap:50px}}@media print{body{background:#fff;padding:0}.no-print{display:none!important}.document{max-width:none;border:0;border-radius:0;box-shadow:none;padding:0}.print-shell{max-width:none}.box{break-inside:avoid}.sign{break-inside:avoid}}
    </style></head><body><main class="print-shell"><div class="app-bar no-print"><div class="brand">AB</div><div class="app-bar-copy"><strong>Amanda Estética</strong><small>Documento preparado no aplicativo</small></div><button class="print-btn" onclick="window.print()">Imprimir / Salvar em PDF</button></div><article class="document">
      <header><div><h1>${esc(clinic.clinicName||'Amanda Braz Estética Avançada')}</h1><div class="muted">${esc([clinic.phone,clinic.email,clinic.city].filter(Boolean).join(' · '))}</div></div><div class="muted">Consentimento clínico</div></header>
      <h2>Termo de consentimento</h2>
      <div class="box"><span><small>Cliente</small><strong>${esc(c.clientName)}</strong></span><span><small>CPF</small><strong>${esc(client.cpf||'Não informado')}</strong></span><span><small>Procedimento</small><strong>${esc(c.protocolName)}</strong></span><span><small>Data</small><strong>${formatDate(c.date)}</strong></span></div>
      <p>${esc(c.text).replace(/\n/g,'<br>')}</p>
      <p><span class="status">${c.accepted?'Aceito pela cliente':'Pendente de aceite'}</span></p>
      <div class="sign"><div class="line">${esc(c.signatureName||c.clientName)}<br><span class="muted">Cliente</span></div><div class="line">${esc(activeProfile().name)}<br><span class="muted">Profissional</span></div></div>
      <footer class="document-footer">${esc(clinic.city||'')} · ${formatDate(c.date)} · Gerado pelo Amanda Estética</footer>
    </article></main></body></html>`);
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
      deleteAction:existing?'delete-photo':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir foto',
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

  
