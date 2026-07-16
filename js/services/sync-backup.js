'use strict';

let manualSaveInflight = null;
let connectGoogleInflight = null;
let syncGoogleInflight = null;

/**
 * Amanda Estética — Salvamento manual, Google Drive, pasta local, backups e exportações.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

async function manualSave() {
    if (manualSaveInflight) return await manualSaveInflight;
    manualSaveInflight = (async () => {
      updateSaveStatus('Salvando…','warn');
      setCloudSyncStatus(window.GoogleDriveClinic?.isConfigured?.()?'syncing':'disconnected',window.GoogleDriveClinic?.isConfigured?.()?'Sincronizando com o Google':'Não sincronizado com o Google');
      await ClinicStorage.save(STATE);
      await ClinicStorage.createLocalBackup(STATE,'manual');
      const saved=['navegador'];
      const failures=[];

      if(window.GoogleDriveClinic?.isConfigured?.()){
        try{
          await GoogleDriveClinic.save(STATE,{backup:true,reason:'manual'});
          saved.push('Google Drive');
          setCloudSyncStatus('synced','Sincronizado com o Google');
        }catch(error){setCloudSyncStatus('failed','Não sincronizado com o Google');failures.push(`Google Drive: ${error.message}`);}
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
    })().finally(() => { manualSaveInflight = null; });
    return await manualSaveInflight;
  }

  async function connectGoogle() {
    if (connectGoogleInflight) return await connectGoogleInflight;
    connectGoogleInflight = (async () => {
      try{
        updateSaveStatus('Conectando ao Google…','warn');
        setCloudSyncStatus('syncing','Conectando ao Google');
        const connection=await GoogleDriveClinic.connect(true);
        await GoogleDriveClinic.save(STATE,{backup:true,reason:'primeira-conexao'});
        setCloudSyncStatus('synced','Sincronizado com o Google');
        updateSaveStatus('Google Drive conectado','ok');
        toast(`Conta ${connection.user.email} conectada e primeiro backup criado.`);
        renderView();
      }catch(error){
        setCloudSyncStatus('failed','Não sincronizado com o Google');
        updateSaveStatus('Salvo localmente','ok');
        toast(error.message,'error');
      }
    })().finally(() => { connectGoogleInflight = null; });
    return await connectGoogleInflight;
  }

  async function syncGoogle() {
    if (syncGoogleInflight) return await syncGoogleInflight;
    syncGoogleInflight = (async () => {
    try{
      setCloudSyncStatus('syncing','Sincronizando com o Google');
      updateSaveStatus('Sincronizando com Google…','warn');
      const result=await GoogleDriveClinic.sync(STATE,{interactive:true,backup:true,reason:'sincronizacao'});
      if(result.direction==='remote'){
        if(await confirmAction('O arquivo do Google Drive é mais recente. Deseja carregá-lo e substituir os dados deste navegador? Um backup local será criado antes.')){
          await ClinicStorage.createLocalBackup(STATE,'antes-de-carregar-google');
          STATE=result.state;
          data();
          await runIntegrityAudit({repair:true,save:false});
          await ClinicStorage.save(STATE);
          setCloudSyncStatus('synced','Sincronizado com o Google');
          updateSaveStatus('Dados carregados do Google Drive','ok');
          renderShell();
          toast('Dados mais recentes carregados do Google Drive.');
          return;
        }
        setCloudSyncStatus('failed','Não sincronizado com o Google');
        updateSaveStatus('Google Drive tem versão mais recente','warn');
        toast('Nada foi substituído. Use “Carregar do Drive” quando estiver pronta.','warn');
        return;
      }
      setCloudSyncStatus('synced','Sincronizado com o Google');
      updateSaveStatus('Google Drive sincronizado','ok');
      toast(result.created?'Arquivo da clínica criado no Google Drive.':'Sincronização com Google Drive concluída.');
      renderView();
    }catch(error){
      setCloudSyncStatus('failed','Não sincronizado com o Google');
      updateSaveStatus('Google Drive pendente','warn');
      toast(error.message,'error');
    }
    })().finally(() => { syncGoogleInflight = null; });
    return await syncGoogleInflight;
  }

  async function loadGoogle() {
    try{
      setCloudSyncStatus('syncing','Sincronizando com o Google');
      updateSaveStatus('Carregando do Google…','warn');
      const remote=await GoogleDriveClinic.load({interactive:true});
      if(!await confirmAction('Carregar o JSON do Google Drive substituirá os dados deste navegador. Um backup local será criado antes. Continuar?')){
        setCloudSyncStatus('failed','Não sincronizado com o Google');
        updateSaveStatus('Carregamento cancelado','warn');
        return;
      }
      await ClinicStorage.createLocalBackup(STATE,'antes-de-carregar-google');
      STATE=remote.state;
      data();
      await runIntegrityAudit({repair:true,save:false});
      await ClinicStorage.save(STATE);
      setCloudSyncStatus('synced','Sincronizado com o Google');
      updateSaveStatus('Dados carregados do Google Drive','ok');
      renderShell();
      toast('Dados carregados do Google Drive.');
    }catch(error){
      setCloudSyncStatus('failed','Não sincronizado com o Google');
      updateSaveStatus('Carregamento pendente','warn');
      toast(error.message,'error');
    }
  }

  async function disconnectGoogle() {
    if(!await confirmAction('Desconectar a conta e esquecer a pasta Google neste navegador? Nenhum arquivo será excluído do Drive.'))return;
    GoogleDriveClinic.disconnect();
    localStorage.removeItem('amanda_clinica_last_google_save');
    setCloudSyncStatus('disconnected','Não sincronizado com o Google');
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
        const useRemote=await confirmAction('O arquivo da pasta é mais recente. Deseja carregar os dados da pasta e substituir o que está neste navegador?');
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
      if(!await confirmAction('Carregar o JSON da pasta substituirá os dados deste navegador. Um backup local será criado antes. Continuar?'))return;
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

  
