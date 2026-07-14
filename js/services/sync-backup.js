'use strict';

/**
 * Amanda Estética — Salvamento manual, Google Drive, pasta local, backups e exportações.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

async function manualSave() {
    updateSaveStatus('Salvando…','warn');
    await ClinicStorage.save(STATE);
    await ClinicStorage.createLocalBackup(STATE,'manual');
    const saved=['navegador'];
    const failures=[];

    if(window.GoogleDriveClinic?.isConfigured?.()){
      try{
        await GoogleDriveClinic.save(STATE,{backup:true,reason:'manual'});
        saved.push('Google Drive');
      }catch(error){failures.push(`Google Drive: ${error.message}`);}
    }

    try{
      const handle=await ClinicStorage.getFolderHandle();
      if(handle){
        await ClinicStorage.saveToFolder(STATE,{handle,requestPermission:true,backup:true,reason:'manual'});
        saved.push('pasta do computador');
      }
    }catch(error){failures.push(`Pasta: ${error.message}`);}

    if(failures.length){
      updateSaveStatus('Salvo local · sincronização parcial','warn');
      toast(`Backup salvo em ${saved.join(' e ')}. ${failures.join(' · ')}`,'warn');
    }else{
      updateSaveStatus(saved.length>1?'Backup completo salvo':'Salvo localmente','ok');
      toast(`Backup salvo em ${saved.join(' e ')}.`);
    }
  }

  async function connectGoogle() {
    try{
      updateSaveStatus('Conectando ao Google…','warn');
      const connection=await GoogleDriveClinic.connect(true);
      await GoogleDriveClinic.save(STATE,{backup:true,reason:'primeira-conexao'});
      updateSaveStatus('Google Drive conectado','ok');
      toast(`Conta ${connection.user.email} conectada e primeiro backup criado.`);
      renderView();
    }catch(error){
      updateSaveStatus('Salvo localmente','ok');
      toast(error.message,'error');
    }
  }

  async function syncGoogle() {
    try{
      updateSaveStatus('Sincronizando com Google…','warn');
      const result=await GoogleDriveClinic.sync(STATE,{interactive:true,backup:true,reason:'sincronizacao'});
      if(result.direction==='remote'){
        if(confirmAction('O arquivo do Google Drive é mais recente. Deseja carregá-lo e substituir os dados deste navegador? Um backup local será criado antes.')){
          await ClinicStorage.createLocalBackup(STATE,'antes-de-carregar-google');
          STATE=result.state;
          data();
          await runIntegrityAudit({repair:true,save:false});
          await ClinicStorage.save(STATE);
          updateSaveStatus('Dados carregados do Google Drive','ok');
          renderShell();
          toast('Dados mais recentes carregados do Google Drive.');
          return;
        }
        updateSaveStatus('Google Drive tem versão mais recente','warn');
        toast('Nada foi substituído. Use “Carregar do Drive” quando estiver pronta.','warn');
        return;
      }
      updateSaveStatus('Google Drive sincronizado','ok');
      toast(result.created?'Arquivo da clínica criado no Google Drive.':'Sincronização com Google Drive concluída.');
      renderView();
    }catch(error){
      updateSaveStatus('Google Drive pendente','warn');
      toast(error.message,'error');
    }
  }

  async function loadGoogle() {
    try{
      updateSaveStatus('Carregando do Google…','warn');
      const remote=await GoogleDriveClinic.load({interactive:true});
      if(!confirmAction('Carregar o JSON do Google Drive substituirá os dados deste navegador. Um backup local será criado antes. Continuar?')){
        updateSaveStatus('Carregamento cancelado','warn');
        return;
      }
      await ClinicStorage.createLocalBackup(STATE,'antes-de-carregar-google');
      STATE=remote.state;
      data();
      await runIntegrityAudit({repair:true,save:false});
      await ClinicStorage.save(STATE);
      updateSaveStatus('Dados carregados do Google Drive','ok');
      renderShell();
      toast('Dados carregados do Google Drive.');
    }catch(error){
      updateSaveStatus('Carregamento pendente','warn');
      toast(error.message,'error');
    }
  }

  async function disconnectGoogle() {
    if(!confirmAction('Desconectar a conta e esquecer a pasta Google neste navegador? Nenhum arquivo será excluído do Drive.'))return;
    GoogleDriveClinic.disconnect();
    localStorage.removeItem('amanda_clinica_last_google_save');
    updateSaveStatus('Google Drive desconectado','warn');
    renderView();
    toast('Conta Google desconectada deste navegador.');
  }

  async function connectFolder() {
    try{
      updateSaveStatus('Conectando pasta…','warn');
      const handle=await ClinicStorage.connectFolder();
      await ClinicStorage.saveToFolder(STATE,{handle,backup:true,reason:'primeira-conexao'});
      updateSaveStatus('Drive conectado','ok');
      toast(`Pasta “${handle.name}” conectada e backup criado.`);
      renderView();
    }catch(error){toast(error.message,'error');updateSaveStatus('Salvo localmente','ok');}
  }

  async function syncFolder() {
    try{
      updateSaveStatus('Sincronizando…','warn');
      let handle=await ClinicStorage.getFolderHandle();
      if(!handle)handle=await ClinicStorage.connectFolder();
      if(!(await ClinicStorage.ensurePermission(handle,true)))throw new Error('Acesso à pasta não autorizado.');
      let remote=null;
      try{remote=await ClinicStorage.readFromFolder({handle});}catch(error){if(error.name!=='NotFoundError')console.warn(error);}
      if(remote?.state?.updatedAt && new Date(remote.state.updatedAt)>new Date(STATE.updatedAt)){
        const useRemote=confirmAction('O arquivo da pasta é mais recente. Deseja carregar os dados da pasta e substituir o que está neste navegador?');
        if(useRemote){
          await ClinicStorage.createLocalBackup(STATE,'antes-de-carregar-drive');
          STATE=remote.state;data();await runIntegrityAudit({repair:true,save:false});await ClinicStorage.save(STATE);updateSaveStatus('Dados carregados do Drive','ok');renderShell();toast('Dados mais recentes carregados da pasta.');return;
        }
      }
      await ClinicStorage.saveToFolder(STATE,{handle,backup:true,reason:'sincronizacao'});
      updateSaveStatus('Drive sincronizado','ok');toast('Sincronização concluída.');
    }catch(error){updateSaveStatus('Sincronização pendente','warn');toast(error.message,'error');}
  }

  async function loadFolder() {
    try{
      let handle=await ClinicStorage.getFolderHandle();
      if(!handle)handle=await ClinicStorage.connectFolder();
      const remote=await ClinicStorage.readFromFolder({handle,requestPermission:true});
      if(!confirmAction('Carregar o JSON da pasta substituirá os dados deste navegador. Um backup local será criado antes. Continuar?'))return;
      await ClinicStorage.createLocalBackup(STATE,'antes-de-carregar-pasta');
      STATE=remote.state;data();await runIntegrityAudit({repair:true,save:false});await ClinicStorage.save(STATE);renderShell();toast('Dados carregados da pasta.');
    }catch(error){toast(error.message,'error');}
  }

  async function showBackups() {
    const list=await ClinicStorage.listLocalBackups();
    openModal({title:'Backups locais',wide:true,content:list.length?`<div class="backup-list">${list.map(b=>`<div><span>${icon('save',18)}</span><div><strong>${formatDateTime(b.createdAt)}</strong><small>${esc(b.reason)}</small></div><button type="button" class="btn secondary compact" data-action="restore-backup" data-id="${eattr(b.id)}">Restaurar</button></div>`).join('')}</div>`:`<p class="muted">Nenhum backup local criado ainda.</p>`});
  }

  function exportFinanceCsv() {
    const rows=[['Data','Tipo','Categoria','Descrição','Cliente','Forma de pagamento','Valor','Status','Origem']];
    data().finance.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(f=>rows.push([f.date,f.type==='income'?'Entrada':'Saída',f.category,f.description,f.clientName,f.paymentMethod,f.value,f.status,f.origin]));
    const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`Financeiro_Amanda_${todayIso()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  
