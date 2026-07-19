'use strict';

/**
 * Amanda Estética — Inicialização do aplicativo e todos os eventos globais.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

// V1.20.0 — instância única da máquina de estados de inicialização. Enquanto
// ela não chegar em READY (ver js/core/10-connection-lifecycle.js), nenhuma
// tela editável é mostrada e nenhuma gravação é permitida.
window.AppLifecycle = window.AppLifecycleFactory.createLifecycle();

let RESIZE_FRAME = 0;
  let FAB_MOVE_FRAME = 0;
  let FAB_PENDING_POSITION = null;

  /* V1.20.0 — CORREÇÃO CRÍTICA: antes, o app carregava o cache local
     (IndexedDB/localStorage) e já liberava autosave/edição, sem nunca
     conferir o Google Drive. Se o cache local estivesse vazio ou antigo
     (célular reconfigurado, navegador limpo, etc.), qualquer edição
     disparava uma gravação no Drive por cima da base real da clínica.
     Agora: o cache local só serve de ponto de partida em memória. Se o
     Google Drive já foi conectado neste navegador, ELE é a fonte da
     verdade — o app não libera nada até carregar e validar a base de lá,
     mostrando uma tela de conexão/erro no lugar do shell até então. */
  async function boot() {
    STATE = await ClinicStorage.load();
    if (!STATE || STATE.appId !== 'amanda-clinica') STATE = clone(window.AMANDA_INITIAL_DATA);
    if (!STATE.profiles?.length) STATE = clone(window.AMANDA_INITIAL_DATA);

    const driveConfigured = !!(window.GoogleDriveClinic?.isConfigured?.());
    const wasUnlocked = sessionStorage.getItem('amanda_clinica_unlocked') === '1';

    if (!driveConfigured) {
      // Google Drive nunca foi conectado neste navegador: não há nada remoto
      // para proteger ainda. Segue o fluxo local normal.
      data();
      await runIntegrityAudit({ repair: true, save: true });
      recordCloudAuthoritativeMigrationOnce();
      window.AppLifecycle.markRemoteLoaded(null, null);
      window.AppLifecycle.markRemoteValidated();
      applyInterfaceMode();
      CURRENT_VIEW = (location.hash || '#dashboard').slice(1);
      if (!VIEW_META[CURRENT_VIEW]) CURRENT_VIEW = 'dashboard';
      if (CURRENT_VIEW === 'settings') resetSettingsSection();
      if (wasUnlocked) {
        renderShell();
        finalizeSessionReady();
      } else {
        renderLogin();
      }
    } else {
      // Google Drive já foi conectado antes neste navegador: ele é a fonte
      // oficial da verdade. Se a sessão ainda não estava desbloqueada, mostra
      // a tela de login normal (a validação roda quando a pessoa escolher
      // "Entrar com Google" ou "Entrar sem login"). Se já estava desbloqueada
      // (ex.: F5 no meio do uso), revalida contra o Drive ANTES de mostrar o
      // shell de novo — nunca reabre direto confiando só na flag de sessão.
      if (wasUnlocked) {
        const outcome = await attemptDriveEntryAndEnter({ interactive: false });
        if (!outcome.ok && !outcome.cancelled) {
          // Tela de erro/offline já está visível (establishAuthoritativeSession
          // cuidou disso). Nada mais a fazer aqui além de aguardar a pessoa
          // decidir (tentar de novo, ver dados salvos por último, sair).
        }
      } else {
        applyInterfaceMode();
        CURRENT_VIEW = (location.hash || '#dashboard').slice(1);
        if (!VIEW_META[CURRENT_VIEW]) CURRENT_VIEW = 'dashboard';
        renderLogin();
      }
    }

    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;});
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js?v=1.21.0').catch(console.warn);
  }

  document.addEventListener('pointerdown', event => {
    const fab = event.target.closest?.('.fab[data-draggable-fab]');
    if (!fab || (!window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(max-width: 860px)').matches && !document.documentElement.classList.contains('ui-smartphone'))) return;
    const rect = fab.getBoundingClientRect();
    FAB_DRAG_STATE = {
      fab,
      pointerId:event.pointerId,
      startX:event.clientX,
      startY:event.clientY,
      startLeft:rect.left,
      startTop:rect.top,
      moved:false
    };
    fab.setPointerCapture?.(event.pointerId);
  });

  document.addEventListener('pointermove', event => {
    const state = FAB_DRAG_STATE;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx,dy) < 6) return;
    state.moved = true;
    const size = state.fab.offsetWidth || 56;
    const minX = 10;
    const maxX = Math.max(minX, window.innerWidth - size - 10);
    const minY = 72;
    const maxY = Math.max(minY, window.innerHeight - size - 92);
    const left = Math.min(maxX, Math.max(minX, state.startLeft + dx));
    const top = Math.min(maxY, Math.max(minY, state.startTop + dy));
    FAB_PENDING_POSITION = { fab:state.fab, left, top };
    if (!FAB_MOVE_FRAME) {
      FAB_MOVE_FRAME = requestAnimationFrame(() => {
        const pending = FAB_PENDING_POSITION;
        FAB_MOVE_FRAME = 0;
        FAB_PENDING_POSITION = null;
        if (!pending?.fab) return;
        pending.fab.style.left = `${pending.left}px`;
        pending.fab.style.right = 'auto';
        pending.fab.style.top = `${pending.top}px`;
        pending.fab.style.bottom = 'auto';
        pending.fab.classList.add('is-dragging');
      });
    }
    event.preventDefault();
  }, { passive:false });

  document.addEventListener('pointerup', async event => {
    const state = FAB_DRAG_STATE;
    if (!state || event.pointerId !== state.pointerId) return;
    FAB_DRAG_STATE = null;
    state.fab.releasePointerCapture?.(event.pointerId);
    state.fab.classList.remove('is-dragging');
    if (!state.moved) return;
    const rect = state.fab.getBoundingClientRect();
    const side = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
    const minTop = 72;
    const maxTop = Math.max(minTop, window.innerHeight - rect.height - 92);
    const top = Math.min(maxTop, Math.max(minTop, rect.top));
    const ratio = maxTop === minTop ? .78 : (top - minTop) / (maxTop - minTop);
    data().settings.fabPosition = { side, topRatio:Math.min(1,Math.max(0,ratio)) };
    state.fab.dataset.dragged = '1';
    await ClinicStorage.save(STATE);
    applyFabPosition();
    setTimeout(()=>{ if(state.fab) delete state.fab.dataset.dragged; },180);
  });

  let SETTINGS_TAG_DRAG_STATE = null;
  let SETTINGS_TAG_DRAG_FRAME = 0;
  let SETTINGS_TAG_DRAG_POINT = null;
  let SETTINGS_TAG_DRAG_TARGET = null;

  document.addEventListener('pointerdown', event => {
    const handle = event.target.closest?.('[data-tag-drag-handle]');
    if (!handle || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const item = handle.closest('[data-settings-tag-item]');
    if (!item) return;
    SETTINGS_TAG_DRAG_STATE = {
      pointerId:event.pointerId,
      key:handle.dataset.key,
      fromIndex:Number(handle.dataset.index),
      toIndex:Number(handle.dataset.index),
      handle,
      item
    };
    handle.setPointerCapture?.(event.pointerId);
    item.classList.add('is-dragging');
  });

  document.addEventListener('pointermove', event => {
    const state = SETTINGS_TAG_DRAG_STATE;
    if (!state || event.pointerId !== state.pointerId) return;
    SETTINGS_TAG_DRAG_POINT={x:event.clientX,y:event.clientY,pointerId:event.pointerId};
    if(!SETTINGS_TAG_DRAG_FRAME){
      SETTINGS_TAG_DRAG_FRAME=requestAnimationFrame(()=>{
        SETTINGS_TAG_DRAG_FRAME=0;
        const active=SETTINGS_TAG_DRAG_STATE;
        const point=SETTINGS_TAG_DRAG_POINT;
        SETTINGS_TAG_DRAG_POINT=null;
        if(!active||!point||point.pointerId!==active.pointerId)return;
        const target=document.elementFromPoint(point.x,point.y)?.closest?.(`[data-settings-tag-item][data-key="${CSS.escape(active.key)}"]`);
        if(SETTINGS_TAG_DRAG_TARGET!==target){
          SETTINGS_TAG_DRAG_TARGET?.classList.remove('is-drag-target');
          SETTINGS_TAG_DRAG_TARGET=target||null;
          SETTINGS_TAG_DRAG_TARGET?.classList.add('is-drag-target');
        }
        if(target){
          const nextIndex=Number(target.dataset.index);
          if(Number.isInteger(nextIndex))active.toIndex=nextIndex;
        }
      });
    }
    event.preventDefault();
  }, {passive:false});

  async function finishSettingsTagDrag(event) {
    const state = SETTINGS_TAG_DRAG_STATE;
    if (!state || event.pointerId !== state.pointerId) return;
    SETTINGS_TAG_DRAG_STATE = null;
    state.handle.releasePointerCapture?.(event.pointerId);
    state.item.classList.remove('is-dragging');
    if(SETTINGS_TAG_DRAG_FRAME){cancelAnimationFrame(SETTINGS_TAG_DRAG_FRAME);SETTINGS_TAG_DRAG_FRAME=0;}
    SETTINGS_TAG_DRAG_POINT=null;
    SETTINGS_TAG_DRAG_TARGET?.classList.remove('is-drag-target');
    SETTINGS_TAG_DRAG_TARGET=null;
    if (state.fromIndex !== state.toIndex) await moveSettingTag(state.key,state.fromIndex,state.toIndex);
  }

  document.addEventListener('pointerup', finishSettingsTagDrag);
  document.addEventListener('pointercancel', finishSettingsTagDrag);

  window.addEventListener('resize',()=>{
    if (RESIZE_FRAME) return;
    RESIZE_FRAME=requestAnimationFrame(()=>{
      RESIZE_FRAME=0;
      applyInterfaceMode();
      applyFabPosition();
    });
  },{passive:true});



  document.addEventListener('pointerover',event=>{
    const control=event.target.closest?.('[data-expandable-filter]');
    if(!control) return;
    const suppressUntil=Number(control.dataset.suppressUntil||0);
    if(control.classList.contains('is-suppressed') || Date.now()<suppressUntil) return;
    if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    control.classList.add('is-open');
    control.querySelector('.expandable-filter-trigger')?.setAttribute('aria-expanded','true');
  },{passive:true});

  document.addEventListener('pointerout',event=>{
    const control=event.target.closest?.('[data-expandable-filter]');
    if(!control || control.contains(event.relatedTarget)) return;
    control.classList.remove('is-open');
    const suppressUntil=Number(control.dataset.suppressUntil||0);
    if(Date.now()>=suppressUntil){
      control.classList.remove('is-suppressed');
      delete control.dataset.suppressUntil;
    }
    control.querySelector('.expandable-filter-trigger')?.setAttribute('aria-expanded','false');
  },{passive:true});

  document.addEventListener('click',async event=>{
    if(!event.target.closest?.('[data-expandable-filter]')) document.querySelectorAll('[data-expandable-filter].is-open').forEach(control=>collapseExpandableFilter(control,{suppressHover:false}));
    if (event.target.matches?.('[data-picker-backdrop]')) { closeWheelPicker(); return; }
    const nav=event.target.closest('[data-nav]');
    if(nav){event.preventDefault();navTo(nav.dataset.nav);document.body.classList.remove('sidebar-open');return;}
    const el=event.target.closest('[data-action]');
    if(!el)return;
    if(el.matches('.fab[data-dragged="1"]')){event.preventDefault();return;}
    event.preventDefault();
    try{await handleAction(el.dataset.action,el);}catch(error){console.error(error);toast(error.message||'Ocorreu um erro.','error');}
  });

  document.addEventListener('submit',async event=>{
    if(!(event.target instanceof HTMLFormElement)||!event.target.matches('#app-modal-form'))return;
    event.preventDefault();
    if(!modalSubmitHandler)return;
    const submit=event.target.querySelector('[type="submit"]');
    try{
      if(submit){submit.disabled=true;submit.dataset.label=submit.innerHTML;submit.textContent='Salvando…';}
      await modalSubmitHandler(event.target);
    }catch(error){
      console.error(error);toast(error.message||'Não foi possível salvar.','error');
      if(submit){submit.disabled=false;submit.innerHTML=submit.dataset.label||'Salvar';}
    }
  });

  document.addEventListener('input',event=>{
    if(event.target.matches?.('[data-money-input]')){
      const input=event.target;
      input.value=formatMoneyInputFromDigits(input.value);
      input.dataset.moneyValue=String(parseMoneyInputValue(input.value));
      requestAnimationFrame(()=>{try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}});
      return;
    }
    if(event.target.id==='global-search-input'){
      SEARCH=event.target.value;
      clearTimeout(event.target._timer);
      event.target._timer=setTimeout(()=>{
        if(['clients','protocols'].includes(CURRENT_VIEW)) refreshViewModeContent(CURRENT_VIEW,getViewMode(CURRENT_VIEW,'cards'));
        else if(CURRENT_VIEW==='products'){const key=productsActiveTabKey();refreshViewModeContent(key,getViewMode(key,'list'));}
        else if(CURRENT_VIEW==='attendances') refreshAttendanceContent();
        else if(CURRENT_VIEW==='finance') refreshFinanceContent();
        else renderView();
      },220);
    }
  });

  document.addEventListener('change',async event=>{
    if (event.target.matches?.('.ios-native-picker')) {
      const form=event.target.closest('form');
      const label=form?.querySelector(`[data-picker-label-for="${event.target.name}"]`);
      if(label)label.textContent=pickerDisplay(event.target.type,event.target.value);
    }
    if(event.target.name==='autosaveGoogle'){
      data().settings.autosaveGoogle=event.target.checked;
      await persist('Preferência do Google Drive alterada',{folder:false,google:false});
      toast(event.target.checked?'Salvamento automático no Google Drive ativado.':'Salvamento automático no Google Drive desativado.');
    }
    if(event.target.name==='autosaveFolder'){
      data().settings.autosaveFolder=event.target.checked;
      await persist('Preferência de sincronização alterada',{folder:false,google:false});
      toast(event.target.checked?'Salvamento automático na pasta ativado.':'Salvamento automático na pasta desativado.');
    }
    if(event.target.id==='attendance-date-filter'){
      ATTENDANCE_FILTER.date=event.target.value||todayIso();
      refreshAttendanceContent();
    }
    if(event.target.id==='attendance-month-filter'){
      ATTENDANCE_FILTER.month=event.target.value||todayIso().slice(0,7);
      refreshAttendanceContent();
    }
    if(event.target.id==='finance-month-filter'){
      FINANCE_FILTER.month=event.target.value||todayIso().slice(0,7);
      refreshFinanceContent();
    }
    if(event.target.id==='json-file-input'){
      try{
        const imported=await ClinicStorage.readUploadedJson(event.target.files[0]);
        if(await confirmAction('Importar este backup substituirá a base atual. Um backup local será criado antes. Continuar?')){
          await ClinicStorage.createLocalBackup(STATE,'antes-de-importar');
          STATE=imported;data();await runIntegrityAudit({repair:true,save:true});resetSettingsSection();renderShell();toast('Backup importado e vínculos verificados.');
        }
      }catch(error){toast(error.message,'error');}
      event.target.value='';
    }
  });

  document.addEventListener('focusin',event=>{
    if(event.target.matches?.('[data-money-input]')) requestAnimationFrame(()=>{try{event.target.setSelectionRange(event.target.value.length,event.target.value.length);}catch(_){}});
  });

  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();manualSave();}
    if(event.key==='Escape'&&$('#photo-viewer-root').children.length){closePhotoViewer();return;}
    if(event.key==='Escape'&&$('#modal-root').children.length)closeModal();
    if($('#photo-viewer-root').children.length&&PHOTO_VIEWER_NAV){
      if(event.key==='ArrowRight')PHOTO_VIEWER_NAV(1);
      if(event.key==='ArrowLeft')PHOTO_VIEWER_NAV(-1);
    }
  });

  window.addEventListener('hashchange',()=>{
    const view=location.hash.slice(1);
    if(VIEW_META[view]&&view!==CURRENT_VIEW)navTo(view,{fromHash:true});
  });

  document.addEventListener('DOMContentLoaded',boot);
