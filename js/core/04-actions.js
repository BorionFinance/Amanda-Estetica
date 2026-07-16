'use strict';

/**
 * Amanda Estética — Central de ações e entrada/bloqueio de perfil.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

async function handleAction(action, el) {
    const id=el.dataset.id||'';
    const map={
      'toggle-sidebar':()=>document.body.classList.toggle('sidebar-open'),
      'close-modal':closeModal,
      'open-wheel-picker':()=>{const form=el.closest('form')||$('#app-modal-form');const input=form?.elements?.[el.dataset.inputName];openWheelPicker(input,el.dataset.pickerType);},
      'close-wheel-picker':closeWheelPicker,
      'confirm-wheel-picker':confirmWheelPicker,
      'enter-profile':()=>enterProfile(id),
      'enter-profile-google':()=>enterProfileWithGoogle(id,el),
      'enter-profile-offline':()=>enterProfileOffline(id),
      'lock-app':()=>{sessionStorage.removeItem('amanda_clinica_unlocked');sessionStorage.removeItem('amanda_clinica_auth_mode');sessionStorage.removeItem('amanda_clinica_auth_email');swapScreen({currentSelector:'.app-shell',exitClass:'screen-exit-right',enterClass:'screen-enter-left',renderNext:renderLogin});},
      'create-profile':()=>openProfileForm(null),
      'profile-menu':()=>navTo('settings'),
      'edit-profile':()=>openProfileForm(activeProfile()),
      'delete-profile':()=>deleteProfileRecord(id),
      'edit-clinic':openClinicForm,
      'switch-profile':async()=>{STATE.activeProfileId=id;await ClinicStorage.save(STATE);renderShell();toast('Perfil alterado.');},
      'toggle-expandable-filter':()=>toggleExpandableFilter(el.closest('[data-expandable-filter]')),
      'set-view-mode':async()=>{const view=el.dataset.view,mode=el.dataset.mode;if(!setViewModePreference(view,mode))return;const control=el.closest('[data-expandable-filter],[data-liquid-control]');updateLiquidControl(control,mode);collapseExpandableFilter(control);refreshViewModeContent(view,mode);await persist('',{folder:true});},
      'set-interface-mode':async()=>{const mode=el.dataset.mode;if(!['auto','smartphone','pro'].includes(mode))return;data().settings.interfaceMode=mode;await persist('Modo de interface alterado',{folder:true,google:true});CURRENT_VIEW='settings';location.hash='settings';applyInterfaceMode();renderShell('page-enter-soft');toast(mode==='auto'?'Modo automático ativado.':mode==='smartphone'?'Modo Smartphone ativado.':'Modo Pro ativado.');},
      'set-attendance-filter':()=>{ATTENDANCE_FILTER.mode=el.dataset.value||'all';ensureUiFilters();const control=el.closest('[data-expandable-filter],[data-liquid-control]');updateLiquidControl(control,ATTENDANCE_FILTER.mode);collapseExpandableFilter(control);refreshAttendanceContent();},
      'set-finance-scope':()=>{FINANCE_FILTER.scope=el.dataset.value==='month'?'month':'all';ensureUiFilters();const control=el.closest('[data-expandable-filter]');updateLiquidControl(control,FINANCE_FILTER.scope);collapseExpandableFilter(control);refreshFinanceContent();},
      'toggle-dashboard-privacy':async()=>{data().settings.dashboardPrivacy=!dashboardPrivacyEnabled();await persist('',{folder:true});renderView('page-enter-soft');},
      'add-appointment':()=>openAppointmentForm(),
      'edit-appointment':()=>openAppointmentForm(id),
      'confirm-appointment':async()=>{const a=data().appointments.find(x=>x.id===id);if(a){a.status='Confirmado';a.confirmed=true;await persist('Agendamento confirmado',{detail:a.clientName});renderView();toast('Agendamento confirmado.');}},
      'appointment-to-attendance':()=>{const a=data().appointments.find(x=>x.id===id);if(!a)return;const linked=data().attendances.find(x=>x.appointmentId===a.id);if(linked){openAttendanceForm(linked.id);return;}openAttendanceForm('',{appointmentId:a.id,date:a.date,clientId:a.clientId,protocolId:a.protocolId,packageId:a.packageId,duration:a.duration,chargedValue:a.packageId?0:a.value,paymentMethod:a.packageId?'Pacote':'Pix'});},
      'delete-appointment':()=>deleteAppointmentRecord(id),
      'agenda-today':()=>document.getElementById(`day-${todayIso()}`)?.scrollIntoView({behavior:'smooth'}),
      'add-client':()=>openClientForm(),
      'edit-client':()=>{closeModal();setTimeout(()=>openClientForm(id),0);},
      'view-client':()=>viewClient(id),
      'client-new-attendance':()=>{const c=findClient(id);closeModal();setTimeout(()=>openAttendanceForm('',{clientId:c.id}),0);},
      'client-new-anamnesis':()=>{const c=findClient(id);closeModal();setTimeout(()=>openAnamnesisForm('',{clientId:c.id}),0);},
      'client-new-package':()=>{const c=findClient(id);closeModal();setTimeout(()=>openPackageForm('',{clientId:c.id}),0);},
      'client-new-photo':()=>{const c=findClient(id);closeModal();setTimeout(()=>openPhotoForm('',{clientId:c.id}),0);},
      'client-new-appointment':()=>{const c=findClient(id);closeModal();setTimeout(()=>openAppointmentForm('',{clientId:c.id}),0);},
      'client-new-consent':()=>{const c=findClient(id);closeModal();setTimeout(()=>openConsentForm('',{clientId:c.id,signatureName:c.name}),0);},
      'delete-client':()=>deleteClientRecord(id),
      'add-protocol':()=>openProtocolForm(),
      'edit-protocol':()=>{closeModal();setTimeout(()=>openProtocolForm(id),0);},
      'view-protocol':()=>viewProtocol(id),
      'delete-protocol':()=>deleteProtocolRecord(id),
      'toggle-protocol-archive':()=>toggleProtocolArchive(id),
      'add-package':()=>openPackageForm(),
      'edit-package':()=>openPackageForm(id),
      'view-package':()=>viewPackage(id),
      'delete-package':()=>deletePackageRecord(id),
      'package-session':()=>{const p=data().packages.find(x=>x.id===id);if(p&&!['Concluído','Cancelado'].includes(p.status))openAttendanceForm('',{clientId:p.clientId,protocolId:p.protocolId,packageId:p.id,chargedValue:0,paymentMethod:'Pacote',paid:true});},
      'add-attendance':()=>openAttendanceForm(),
      'edit-attendance':()=>openAttendanceForm(id),
      'delete-attendance':()=>deleteAttendanceRecord(id),
      'add-anamnesis':()=>openAnamnesisForm(),
      'edit-anamnesis':()=>{closeModal();setTimeout(()=>openAnamnesisForm(id),0);},
      'view-anamnesis':()=>viewAnamnesis(id),
      'delete-anamnesis':()=>deleteAnamnesisRecord(id),
      'add-consent':()=>openConsentForm(),
      'edit-consent':()=>openConsentForm(id),
      'print-consent':()=>printConsent(id),
      'delete-consent':()=>deleteConsentRecord(id),
      'add-photo':()=>openPhotoForm('', PHOTO_NAV.clientId?{clientId:PHOTO_NAV.clientId, protocolId:PHOTO_NAV.protocolId&&PHOTO_NAV.protocolId!=='_none'?PHOTO_NAV.protocolId:''}:{}),
      'edit-photo':()=>openPhotoForm(id),
      'delete-photo':async()=>{if(await confirmAction('Excluir esta foto?')){data().photos=data().photos.filter(x=>x.id!==id);await persist('Foto excluída');closeModal();renderView();toast('Foto excluída.');}},
      'photo-open-client':()=>{PHOTO_NAV={clientId:id,protocolId:''};renderView();},
      'photo-open-protocol':()=>{PHOTO_NAV.protocolId=id;renderView();},
      'photo-back-clients':()=>{PHOTO_NAV={clientId:'',protocolId:''};renderView();},
      'add-product':()=>openProductForm(),
      'edit-product':()=>openProductForm(id),
      'delete-product':()=>deleteProductRecord(id),
      'toggle-product-archive':()=>toggleProductArchive(id),
      'stock-plus':async()=>{const p=data().products.find(x=>x.id===id);if(p){p.stock=num(p.stock)+1;await persist('Estoque ajustado manualmente',{detail:`${p.name}: +1 ${p.unit||''}`});renderView();}},
      'stock-minus':async()=>{const p=data().products.find(x=>x.id===id);if(p){p.stock=Math.max(0,num(p.stock)-1);await persist('Estoque ajustado manualmente',{detail:`${p.name}: −1 ${p.unit||''}`});renderView();}},
      'add-finance':()=>openFinanceForm(),
      'edit-finance':()=>{const f=data().finance.find(x=>x.id===id);if(f&&(f.sourceLocked||f.attendanceId||f.packageFinanceKind)){toast('Lançamento automático: edite o atendimento ou pacote de origem.','warn');return;}openFinanceForm(id);},
      'delete-finance':()=>deleteFinanceRecordSafe(id),
      'remove-setting-tag':async()=>{
        const key=el.dataset.key,value=el.dataset.value;
        const list=data().settings[key];
        if(!Array.isArray(list))return;
        const idx=list.findIndex(x=>x===value);
        if(idx<0)return;
        list.splice(idx,1);
        await persist('Item removido das configurações',{detail:value});
        renderView();
      },
      'add-setting-tag':async()=>{
        const key=el.dataset.key;
        const input=el.closest('.tag-manager')?.querySelector('[data-tag-input]');
        const value=(input?.value||'').trim();
        if(!value){toast('Digite um nome antes de adicionar.','error');return;}
        const list=data().settings[key]||(data().settings[key]=[]);
        if(list.some(x=>normalize(x)===normalize(value))){toast(`"${value}" já está cadastrado.`,'error');return;}
        list.push(value);
        if(key!=='financeCategories')list.sort((a,b)=>a.localeCompare(b,'pt-BR'));
        await persist('Item adicionado às configurações',{detail:value});
        renderView();
        toast(`${value} adicionado.`);
      },
      'export-finance-csv':exportFinanceCsv,
      'manual-save':manualSave,
      'quick-cloud-save':async()=>{if(window.GoogleDriveClinic?.isConfigured?.())await syncGoogle();else await connectGoogle();},
      'connect-google':connectGoogle,
      'sync-google':syncGoogle,
      'load-google':loadGoogle,
      'disconnect-google':disconnectGoogle,
      'connect-folder':connectFolder,
      'sync-folder':syncFolder,
      'load-folder':loadFolder,
      'disconnect-folder':async()=>{if(await confirmAction('Esquecer a pasta conectada neste navegador? Os arquivos não serão excluídos.')){await ClinicStorage.forgetFolderHandle();localStorage.removeItem('amanda_clinica_last_folder_save');renderView();toast('Pasta esquecida.');}},
      'export-json':()=>ClinicStorage.downloadJson(STATE),
      'import-json':()=>$('#json-file-input')?.click(),
      'show-backups':showBackups,
      'show-integrity-report':showIntegrityReport,
      'restore-backup':async()=>{if(await confirmAction('Restaurar este backup e substituir os dados atuais?')){const restored=await ClinicStorage.restoreLocalBackup(id);if(restored){await ClinicStorage.createLocalBackup(STATE,'antes-de-restaurar');STATE=restored;data();await runIntegrityAudit({repair:true,save:false});await ClinicStorage.save(STATE);closeModal();renderShell();toast('Backup restaurado e vínculos verificados.');}}},
      'install-app':async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;}}
    };
    if(map[action])await map[action]();
  }

  let LOGIN_GOOGLE_INFLIGHT = null;

  function completeProfileUnlock(profile, authMode = 'google', authEmail = '', bypassPin = false) {
    const unlock=()=>{
      STATE.activeProfileId=profile.id;
      sessionStorage.setItem('amanda_clinica_unlocked','1');
      sessionStorage.setItem('amanda_clinica_auth_mode',authMode);
      if(authEmail)sessionStorage.setItem('amanda_clinica_auth_email',authEmail);
      else sessionStorage.removeItem('amanda_clinica_auth_email');
      CURRENT_VIEW=(location.hash||'#dashboard').slice(1);
      if(!VIEW_META[CURRENT_VIEW])CURRENT_VIEW='dashboard';
      swapScreen({currentSelector:'.login-shell',exitClass:'screen-exit-left',enterClass:'screen-enter-right',renderNext:renderShell});
    };
    if(profile.pin && !bypassPin)showLoginPinPanel(profile,unlock);
    else unlock();
  }

  function enterProfile(id) {
    const profile=STATE.profiles.find(x=>x.id===id)||activeProfile();
    completeProfileUnlock(profile,'test','',true);
  }

  async function enterProfileWithGoogle(id,button){
    if(LOGIN_GOOGLE_INFLIGHT)return await LOGIN_GOOGLE_INFLIGHT;
    const profile=STATE.profiles.find(x=>x.id===id)||activeProfile();
    const original=button?.innerHTML||'';
    LOGIN_GOOGLE_INFLIGHT=(async()=>{
      if(!window.GoogleDriveClinic?.authenticate)throw new Error('O login Google ainda não está disponível. Atualize a página e tente novamente.');
      if(button){button.disabled=true;button.classList.add('is-loading');button.innerHTML='<span class="login-spinner" aria-hidden="true"></span><span>Conectando ao Google…</span>';}
      const user=await window.GoogleDriveClinic.authenticate(true);
      completeProfileUnlock(profile,'google',String(user?.email||''),true);
      return user;
    })().finally(()=>{
      if(button?.isConnected){button.disabled=false;button.classList.remove('is-loading');button.innerHTML=original;}
      LOGIN_GOOGLE_INFLIGHT=null;
    });
    return await LOGIN_GOOGLE_INFLIGHT;
  }

  function enterProfileOffline(id){
    const profile=STATE.profiles.find(x=>x.id===id)||activeProfile();
    completeProfileUnlock(profile,'test','',true);
  }

  function hideLoginPinPanel(){
    const layer = document.getElementById('login-auth-layer');
    if (!layer) return;
    const backdrop = layer.querySelector('.login-auth-backdrop');
    if (!backdrop) return;
    backdrop.classList.add('is-closing');
    window.setTimeout(() => { if (backdrop.isConnected) layer.innerHTML = ''; }, 180);
  }

  function showLoginPinPanel(profile, onSuccess){
    const layer = document.getElementById('login-auth-layer');
    if (!layer) return;
    layer.innerHTML = `
      <div class="login-auth-backdrop">
        <div class="login-auth-card" role="dialog" aria-modal="true" aria-label="Entrar como ${eattr(profile?.name || 'Amanda')}">
          <div class="login-auth-avatar">${profileAvatar(profile,'xlarge')}</div>
          <h2>${esc(profile?.name || 'Amanda')}</h2>
          <p>${esc(profile?.clinic?.clinicName || 'Amanda Braz Estética Avançada')}</p>
          <form class="login-auth-form" id="login-pin-form">
            <label class="login-auth-field">
              <input type="password" name="pin" inputmode="numeric" autocomplete="current-password" placeholder="Senha" aria-label="Senha do perfil">
            </label>
            <div class="login-auth-actions">
              <button type="button" class="btn ghost" data-login-auth-close>Voltar</button>
              <button type="submit" class="btn primary">Entrar</button>
            </div>
          </form>
          <div class="login-auth-hint">Digite a senha do perfil para continuar.</div>
        </div>
      </div>`;
    const backdrop = layer.querySelector('.login-auth-backdrop');
    const form = layer.querySelector('#login-pin-form');
    const input = form?.elements?.pin;
    requestAnimationFrame(() => backdrop?.classList.add('is-open'));
    layer.querySelector('[data-login-auth-close]')?.addEventListener('click', hideLoginPinPanel);
    form?.addEventListener('submit', ev => {
      ev.preventDefault();
      const value = String(input?.value || '');
      if (value !== String(profile?.pin || '')) {
        input?.classList.add('shake-error');
        toast('Senha incorreta.','error');
        window.setTimeout(() => input?.classList.remove('shake-error'), 380);
        input?.focus();
        if (input?.select) input.select();
        return;
      }
      hideLoginPinPanel();
      onSuccess();
    });
    window.setTimeout(() => input?.focus({preventScroll:true}), 90);
  }

  
