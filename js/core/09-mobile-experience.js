'use strict';

/* Amanda Estética v1.10.1 — experiência mobile alinhada ao Borion Finance. */
(() => {
  const MobileAmanda = {
    initialized:false,
    navPatched:false,
    originalNav:null,
    viewStack:[],
    scrollByView:new Map(),
    modalObserver:null,
    shellObserver:null,
    guardArmed:false,
    allowExit:false,
    networkTimer:0,
    lastHaptic:0,
    swipe:null,

    isMobile(){
      return document.documentElement.classList.contains('ui-smartphone') ||
        window.matchMedia('(max-width:900px), (pointer:coarse)').matches;
    },
    currentView(){
      try{return CURRENT_VIEW || 'dashboard';}catch(_){return (location.hash||'#dashboard').slice(1);}
    },
    reducedMotion(){return window.matchMedia('(prefers-reduced-motion:reduce)').matches;},
    scroller(){return document.querySelector('.app-main') || document.scrollingElement;},
    scrollTop(){const el=this.scroller();return el===document.scrollingElement?(window.scrollY||0):(el?.scrollTop||0);},
    setScroll(top){
      const el=this.scroller();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(el===document.scrollingElement)window.scrollTo({top,behavior:'instant'});
        else el?.scrollTo({top,behavior:'instant'});
      }));
    },
    haptic(pattern=7){
      if(!this.isMobile() || !navigator.vibrate)return;
      const now=Date.now();if(now-this.lastHaptic<35)return;this.lastHaptic=now;
      try{navigator.vibrate(pattern);}catch(_){ }
    },

    setViewport(){
      const vv=window.visualViewport;
      const height=vv?.height || window.innerHeight;
      const offset=vv?.offsetTop || 0;
      const keyboard=Math.max(0,window.innerHeight-height-offset);
      document.documentElement.style.setProperty('--amanda-app-vh',`${height}px`);
      document.documentElement.style.setProperty('--amanda-keyboard',`${keyboard}px`);
      document.body.classList.toggle('keyboard-open',keyboard>120);
      document.documentElement.classList.toggle('amanda-mobile-ui',this.isMobile());
    },

    showNetwork(online=navigator.onLine){
      if(!this.isMobile())return;
      let banner=document.getElementById('amanda-network-banner');
      if(!banner){
        banner=document.createElement('div');
        banner.id='amanda-network-banner';
        banner.className='amanda-network-banner';
        banner.setAttribute('role','status');
        banner.setAttribute('aria-live','polite');
        document.body.appendChild(banner);
      }
      clearTimeout(this.networkTimer);
      banner.className=`amanda-network-banner ${online?'is-online':'is-offline'} is-visible`;
      banner.innerHTML=online
        ? '<span class="network-dot"></span><strong>Conexão restaurada</strong><small>A sincronização continuará normalmente.</small>'
        : '<span class="network-dot"></span><strong>Você está offline</strong><small>Os dados continuam salvos neste aparelho.</small>';
      if(online)this.networkTimer=setTimeout(()=>banner.classList.remove('is-visible'),2600);
    },

    patchNavigation(){
      if(this.navPatched || typeof window.navTo!=='function')return;
      this.navPatched=true;
      this.originalNav=window.navTo;
      const self=this;
      window.navTo=function(view,options={}){
        const from=self.currentView();
        if(self.isMobile() && view && view!==from && !options.__mobileBack){
          self.scrollByView.set(from,self.scrollTop());
          self.viewStack.push(from);
          if(self.viewStack.length>30)self.viewStack.shift();
          self.haptic(6);
        }
        const result=self.originalNav.call(this,view,options);
        if(options.__mobileBack){
          const top=self.scrollByView.get(view)||0;
          setTimeout(()=>self.setScroll(top),245);
        }
        return result;
      };
    },

    armBackGuard(url=location.href){
      if(!this.isMobile() || this.allowExit)return;
      const state={...(history.state||{}),__amandaMobileGuard:true};
      history.pushState(state,'',url);
      this.guardArmed=true;
    },

    setupBackGuard(){
      if(!this.isMobile() || this.guardArmed)return;
      history.replaceState({...(history.state||{}),__amandaMobileBase:true},'',location.href);
      this.armBackGuard();
      window.addEventListener('popstate',()=>{
        if(this.allowExit || !this.isMobile())return;
        if(this.closeTopLayer()){this.armBackGuard();return;}
        const previous=this.viewStack.pop();
        if(previous && this.originalNav){
          const url=new URL(location.href);url.hash=previous;
          this.armBackGuard(url.href);
          this.originalNav(previous,{fromHash:true,__mobileBack:true});
          const top=this.scrollByView.get(previous)||0;
          setTimeout(()=>this.setScroll(top),250);
          this.haptic(7);
          return;
        }
        const leave=window.confirm('Deseja sair do Amanda Estética?');
        if(leave){this.allowExit=true;history.back();return;}
        this.armBackGuard();
      });
    },

    closeTopLayer(){
      const auth=document.querySelector('.login-auth-backdrop');
      if(auth){try{hideLoginPinPanel();}catch(_){auth.remove();}return true;}
      if(document.querySelector('#picker-root .ios-wheel-sheet')){try{closeWheelPicker();}catch(_){document.getElementById('picker-root').replaceChildren();}return true;}
      if(document.querySelector('#modal-root .modal-backdrop')){try{closeModal();}catch(_){document.getElementById('modal-root').replaceChildren();}return true;}
      if(document.body.classList.contains('sidebar-open')){document.body.classList.remove('sidebar-open');return true;}
      return false;
    },

    decorateModal(backdrop){
      if(!this.isMobile() || !backdrop || backdrop.dataset.amandaMobileSheet==='1')return;
      const modal=backdrop.querySelector('.modal');
      if(!modal)return;
      backdrop.dataset.amandaMobileSheet='1';
      backdrop.classList.add('mobile-sheet-backdrop');
      modal.classList.add('mobile-bottom-sheet');
      const handle=document.createElement('button');
      handle.type='button';
      handle.className='mobile-sheet-handle';
      handle.setAttribute('aria-label','Arraste para baixo para fechar');
      handle.innerHTML='<span></span>';
      modal.insertBefore(handle,modal.firstChild);
      const appRoot=document.getElementById('root');
      if(appRoot)appRoot.inert=true;

      const markDirty=e=>{if(e.target.matches('input,select,textarea'))modal.dataset.sheetDirty='1';};
      modal.addEventListener('input',markDirty,{passive:true});
      modal.addEventListener('change',markDirty,{passive:true});
      backdrop.addEventListener('click',e=>{
        if(e.target!==backdrop || modal.dataset.sheetDirty==='1')return;
        try{closeModal();}catch(_){ }
      });

      let pointerId=null,startY=0,lastY=0,lastAt=0;
      const reset=()=>{
        modal.classList.remove('is-sheet-dragging');
        modal.style.removeProperty('--sheet-y');
        backdrop.style.removeProperty('--sheet-overlay-opacity');
        pointerId=null;
      };
      handle.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        pointerId=e.pointerId;startY=lastY=e.clientY;lastAt=performance.now();
        modal.classList.add('is-sheet-dragging');
        try{handle.setPointerCapture(pointerId);}catch(_){ }
      },{passive:true});
      handle.addEventListener('pointermove',e=>{
        if(e.pointerId!==pointerId)return;
        const dy=Math.max(0,e.clientY-startY);if(!dy)return;
        e.preventDefault();
        const resisted=dy/(1+dy/680);
        modal.style.setProperty('--sheet-y',`${resisted}px`);
        backdrop.style.setProperty('--sheet-overlay-opacity',String(Math.max(.18,.40-resisted/1050)));
        lastY=e.clientY;lastAt=performance.now();
      },{passive:false});
      const finish=e=>{
        if(e.pointerId!==pointerId)return;
        const dy=Math.max(0,e.clientY-startY);
        const velocity=(e.clientY-lastY)/Math.max(1,performance.now()-lastAt);
        const dirty=modal.dataset.sheetDirty==='1';
        const close=dy>(dirty?170:92)||(velocity>.78&&dy>(dirty?100:44));
        try{handle.releasePointerCapture(pointerId);}catch(_){ }
        if(close){
          this.haptic(9);
          modal.classList.add('is-sheet-closing');
          modal.style.setProperty('--sheet-y','110%');
          backdrop.style.setProperty('--sheet-overlay-opacity','0');
          setTimeout(()=>{try{closeModal();}catch(_){ }},170);
        }else{
          if(dirty&&dy>90){this.haptic([7,25,7]);try{toast('Há alterações não salvas. Puxe mais para fechar.','warn');}catch(_){ }}
          reset();
        }
      };
      handle.addEventListener('pointerup',finish,{passive:true});
      handle.addEventListener('pointercancel',reset,{passive:true});
    },

    observeModals(){
      const root=document.getElementById('modal-root');
      if(!root || this.modalObserver)return;
      this.modalObserver=new MutationObserver(()=>{
        const backdrop=root.querySelector('.modal-backdrop');
        if(backdrop)this.decorateModal(backdrop);
        else{const appRoot=document.getElementById('root');if(appRoot)appRoot.inert=false;}
      });
      this.modalObserver.observe(root,{childList:true,subtree:true});
      const existing=root.querySelector('.modal-backdrop');if(existing)this.decorateModal(existing);
    },

    installTouchFeedback(){
      document.addEventListener('pointerdown',e=>{
        if(!this.isMobile())return;
        const el=e.target.closest('button,.btn,.nav-item,.list-row,.client-card,.protocol-card,.package-card,.record-card');
        if(el)el.classList.add('is-touching');
      },{passive:true});
      const clear=e=>{const el=e.target?.closest?.('.is-touching');if(el)setTimeout(()=>el.classList.remove('is-touching'),75);};
      document.addEventListener('pointerup',clear,{passive:true});
      document.addEventListener('pointercancel',clear,{passive:true});
      document.addEventListener('click',e=>{
        if(this.isMobile()&&e.target.closest('button,.btn,[data-nav],[data-action]'))this.haptic(5);
      },{passive:true});
    },

    installSwipeNavigation(){
      const views=['agenda','clients','protocols','attendances'];
      document.addEventListener('pointerdown',e=>{
        if(!this.isMobile() || !e.isPrimary || e.button!==0)return;
        if(!e.target.closest('#page') || e.target.closest('input,select,textarea,button,a,[contenteditable],.table-wrap,.ios-wheel-stage,.modal'))return;
        this.swipe={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};
      },{passive:true});
      document.addEventListener('pointerup',e=>{
        const s=this.swipe;this.swipe=null;
        if(!s || s.id!==e.pointerId)return;
        const dx=e.clientX-s.x,dy=e.clientY-s.y,elapsed=performance.now()-s.time;
        if(elapsed>620 || Math.abs(dx)<78 || Math.abs(dx)<Math.abs(dy)*1.35)return;
        const current=this.currentView(),index=views.indexOf(current);if(index<0)return;
        const next=dx<0?views[index+1]:views[index-1];
        if(next&&typeof window.navTo==='function'){window.navTo(next);this.haptic(8);}
      },{passive:true});
    },

    installFocusTrap(){
      document.addEventListener('keydown',e=>{
        if(e.key!=='Tab')return;
        const modal=document.querySelector('#modal-root .modal');if(!modal)return;
        const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      });
    },

    observeShell(){
      const root=document.getElementById('root');if(!root||this.shellObserver)return;
      this.shellObserver=new MutationObserver(()=>{
        if(document.body.classList.contains('login-page'))this.viewStack.length=0;
        this.setViewport();
        this.patchNavigation();
      });
      this.shellObserver.observe(root,{childList:true,subtree:false});
    },

    init(){
      if(this.initialized)return;this.initialized=true;
      this.setViewport();
      this.patchNavigation();
      this.setupBackGuard();
      this.observeModals();
      this.observeShell();
      this.installTouchFeedback();
      this.installSwipeNavigation();
      this.installFocusTrap();
      window.addEventListener('resize',()=>this.setViewport(),{passive:true});
      window.visualViewport?.addEventListener('resize',()=>this.setViewport(),{passive:true});
      window.visualViewport?.addEventListener('scroll',()=>this.setViewport(),{passive:true});
      window.addEventListener('online',()=>this.showNetwork(true));
      window.addEventListener('offline',()=>this.showNetwork(false));
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.setViewport();});
    }
  };

  window.MobileAmanda=MobileAmanda;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>MobileAmanda.init(),{once:true});
  else MobileAmanda.init();
})();
