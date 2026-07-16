'use strict';

/**
 * Amanda Estética — Produtos, financeiro, foto de perfil, perfil e dados da clínica.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function openProductForm(id='') {
    const existing=data().products.find(p=>p.id===id);
    const p=existing||{id:`P${String(data().products.length+1).padStart(3,'0')}`,category:'',name:'',brand:'',unit:'ml',packageQty:0,packageCost:0,usagePerService:0,stock:0,minStock:0,notes:''};
    openModal({
      title:existing?'Editar produto':'Novo produto',
      wide:true,
      content:`<div class="form-grid">
        ${field('Código','code',p.id,'text',{required:true})}
        ${field('Produto','name',p.name,'text',{required:true,className:'span-2'})}
        ${field('Categoria','category',p.category)}
        ${field('Marca','brand',p.brand)}
        ${field('Unidade','unit',p.unit)}
        ${field('Quantidade por embalagem','packageQty',p.packageQty,'number',{min:0,step:'0.01'})}
        ${field('Custo da embalagem','packageCost',p.packageCost,'number',{min:0,step:'0.01'})}
        ${field('Uso médio por atendimento','usagePerService',p.usagePerService,'number',{min:0,step:'0.01'})}
        ${field('Estoque atual','stock',p.stock,'number',{min:0,step:'0.01'})}
        ${field('Estoque mínimo','minStock',p.minStock,'number',{min:0,step:'0.01'})}
        ${textarea('Observações','notes',p.notes,{rows:3,className:'span-2'})}
      </div><input type="hidden" name="originalId" value="${eattr(p.id||'')}">`,
      deleteAction:existing?'delete-product':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir/arquivar produto',
      submitText:'Salvar produto',
      onSubmit:async form=>{
        const o=formObject(form),qty=num(o.packageQty),cost=num(o.packageCost),usage=num(o.usagePerService);
        const unitCost=qty?cost/qty:0;
        const item={...p,id:o.code.trim(),name:o.name.trim(),category:o.category||'',brand:o.brand||'',unit:o.unit||'',packageQty:qty,packageCost:cost,unitCost,usagePerService:usage,yield:usage?qty/usage:0,costPerService:unitCost*usage,stock:num(o.stock),minStock:num(o.minStock),notes:o.notes||'',updatedAt:nowIso()};
        if(!item.id)throw new Error('Informe o código do produto.');
        const duplicate=data().products.find(x=>x.id===item.id&&x.id!==o.originalId);
        if(duplicate)throw new Error('Já existe outro produto com esse código.');
        const idx=data().products.findIndex(x=>x.id===o.originalId);
        idx>=0?data().products.splice(idx,1,item):data().products.push(item);
        syncProductReferences(item,o.originalId||item.id);
        await persist(existing?'Produto editado':'Produto criado',{detail:item.name});
        closeModal();renderView();toast('Produto salvo.');
      }
    });
  }

  function openFinanceForm(id='',prefill={}) {
    const existing=data().finance.find(f=>f.id===id);
    const f={date:todayIso(),type:'income',status:'Pago',paymentMethod:'Pix',category:'Atendimento',...prefill,...(existing||{})};
    openModal({
      title:existing?'Editar lançamento':'Novo lançamento',
      wide:true,
      content:`<div class="form-grid">
        ${field('Data','date',f.date,'date',{required:true})}
        ${selectField('Tipo','type',[{value:'income',label:'Entrada'},{value:'expense',label:'Saída'}],f.type,{blank:false})}
        ${selectField('Categoria','category',['Atendimento','Produto','Marketing','Aluguel','Transporte','Imposto','Fornecedor','Outros'],f.category)}
        ${field('Descrição','description',f.description,'text',{required:true,className:'span-2'})}
        ${selectField('Cliente (opcional)','clientId',optionClients(f.clientId),f.clientId)}
        ${selectField('Forma de pagamento','paymentMethod',['Pix','Dinheiro','Cartão de Débito','Cartão de Crédito','Transferência','Boleto'],f.paymentMethod)}
        ${field('Valor','value',f.value,'number',{required:true,min:0,step:'0.01'})}
        ${selectField('Status','status',['Pago','Pendente','Cancelado'],f.status,{blank:false})}
        ${field('Centro de custo','costCenter',f.costCenter)}
        ${field('Origem','origin',f.origin||'Manual')}
        ${textarea('Observações','notes',f.notes,{rows:3,className:'span-2'})}
      </div><input type="hidden" name="id" value="${eattr(f.id||'')}">`,
      deleteAction:existing?'delete-finance':'',
      deleteId:existing?.id||'',
      deleteText:'Excluir lançamento',
      submitText:'Salvar lançamento',
      onSubmit:async form=>{
        const o=formObject(form),client=findClient(o.clientId);
        const item={...f,id:o.id||uid('FN'),date:o.date,type:o.type,category:o.category||'',description:o.description||'',clientId:o.clientId||'',clientName:client?.name||'',paymentMethod:o.paymentMethod||'',value:num(o.value),status:o.status,costCenter:o.costCenter||'',origin:o.origin||'Manual',notes:o.notes||'',updatedAt:nowIso()};
        const idx=data().finance.findIndex(x=>x.id===item.id);
        idx>=0?data().finance.splice(idx,1,item):data().finance.push(item);
        await persist(existing?'Financeiro editado':'Lançamento criado',{detail:`${item.description} · ${currency(item.value)}`});
        closeModal();renderView();toast('Lançamento salvo.');
      }
    });
  }

  async function decodeLocalImage(file) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file); } catch (_) { }
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      img.decoding='async';
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Não foi possível abrir a imagem.'));img.src=url;});
      return img;
    }finally{URL.revokeObjectURL(url);}
  }

  async function compressAvatarImage(file) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
    const source=await decodeLocalImage(file);
    const width=source.width||source.naturalWidth,height=source.height||source.naturalHeight;
    const side=Math.min(width,height);
    const sx=Math.max(0,(width-side)/2),sy=Math.max(0,(height-side)/2);
    const canvas=document.createElement('canvas');
    canvas.width=480;canvas.height=480;
    canvas.getContext('2d').drawImage(source,sx,sy,side,side,0,0,480,480);
    const dataUrl=canvas.toDataURL('image/jpeg',0.82);
    source.close?.();
    if(dataUrl.length>900_000)throw new Error('A foto do perfil ficou muito grande. Escolha uma imagem menor.');
    return dataUrl;
  }

  function openProfileForm(existing=activeProfile()) {
    const p=existing||{id:'',name:'',role:'',pin:'',avatarData:'',clinic:{}};
    openModal({
      title:existing?'Editar perfil':'Novo perfil',
      content:`<div class="profile-photo-editor">
        ${profileAvatar(p,'xlarge')}
        <div><strong>Foto do perfil</strong><span>Escolha uma foto quadrada ou retrato. O aplicativo recorta e comprime automaticamente.</span></div>
      </div>
      <div class="form-grid one-col">
        <label class="field"><span>Escolher foto</span><input type="file" name="avatarFile" accept="image/*"><small>A imagem fica dentro do backup JSON e aparece no menu, login e configurações.</small></label>
        ${p.avatarData?checkField('Remover foto atual','removeAvatar',false,'Ao salvar, o perfil volta a usar a inicial do nome.'):''}
        ${field('Nome completo','name',p.name,'text',{required:true})}
        ${field('Função','role',p.role)}
        ${field('PIN de acesso (opcional)','pin',p.pin,'password',{help:'Use apenas números ou uma senha curta que Amanda consiga lembrar.'})}
      </div>`,
      extraFooter:existing?`<button type="button" class="btn danger-soft" data-action="delete-profile" data-id="${eattr(p.id)}">${icon('trash',17)} Excluir perfil</button>`:'',
      submitText:'Salvar perfil',
      onSubmit:async form=>{
        const o=formObject(form);
        const file=form.elements.avatarFile?.files?.[0];
        let avatarData=p.avatarData||'';
        if(file){updateSaveStatus('Preparando foto…','warn');avatarData=await compressAvatarImage(file);}
        if(bool(o.removeAvatar))avatarData='';
        if(existing){p.name=o.name;p.role=o.role;p.pin=o.pin;p.avatarData=avatarData;}
        else{
          const id=uid('profile');
          const clinic={clinicName:o.name||'Nova clínica'};
          STATE.profiles.push({id,name:o.name,role:o.role,pin:o.pin,avatarData,color:'#c85f86',clinic,createdAt:nowIso()});
          STATE.dataByProfile[id]={clients:[],products:[],protocols:[],packages:[],appointments:[],attendances:[],anamneses:[],consents:[],photos:[],finance:[],settings:{autosaveFolder:true,autosaveGoogle:true,viewModesBySection:{clients:'cards',protocols:'cards',products:'list'},viewModes:{clients:'cards',protocols:'cards',products:'list'}},audit:[]};
          STATE.activeProfileId=id;
        }
        await persist(existing?'Perfil editado':'Perfil criado',{folder:false});
        closeModal();renderShell();toast('Perfil salvo.');
      }
    });
  }

  function openClinicForm() {
    const c=activeProfile().clinic||{};
    openModal({
      title:'Dados da clínica',
      wide:true,
      content:`<div class="form-grid">
        ${field('Nome profissional / clínica','clinicName',c.clinicName,'text',{required:true,className:'span-2'})}
        ${field('CPF/CNPJ','document',c.document)}
        ${field('CRBM','crbm',c.crbm)}
        ${field('Telefone / WhatsApp','phone',c.phone,'tel')}
        ${field('E-mail','email',c.email,'email')}
        ${field('Instagram','instagram',c.instagram)}
        ${field('Endereço','address',c.address)}
        ${field('Número','number',c.number)}
        ${field('Bairro','neighborhood',c.neighborhood)}
        ${field('Cidade / UF','city',c.city)}
        ${field('CEP','zip',c.zip)}
        ${textarea('Observação padrão','defaultNote',c.defaultNote,{rows:3,className:'span-2'})}
      </div>`,
      submitText:'Salvar dados',
      onSubmit:async form=>{
        activeProfile().clinic={...c,...formObject(form)};
        await persist('Dados da clínica editados');
        closeModal();renderView();toast('Dados da clínica salvos.');
      }
    });
  }

  
