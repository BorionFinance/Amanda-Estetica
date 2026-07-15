const CACHE='amanda-clinica-v1.10.4-mobile-borion';
const APP_SHELL=[
  "./",
  "./index.html",
  "./css/00-base.css",
  "./css/borion-hub.css?v=1.10.4",
  "./css/10-views-filters.css",
  "./css/20-theme-premium-ios.css",
  "./css/30-pro-layout.css",
  "./css/40-transitions-ios.css",
  "./css/50-fixed-menu-depth.css",
  "./css/60-transparency-menu.css",
  "./css/70-stack-scroll.css",
  "./css/80-liquid-interface.css",
  "./css/90-performance.css",
  "./css/95-performance-critical.css",
  "./css/96-performance-ultra.css",
  "./css/97-continuity-expandable-stack.css",
  "./css/98-lockscreen-clock.css",
  "./css/99-login-signature.css",
  "./css/100-integrity-relations.css",
  "./css/110-mobile-borion.css?v=1.10.4",
  "./js/data/initial-data.js",
  "./js/borion-hub.js?v=1.10.4",
  "./js/services/storage.js",
  "./js/services/google-drive.js?v=1.10.4",
  "./js/core/00-config-icons.js",
  "./js/core/01-state-utils.js",
  "./js/core/08-integrity-relations.js",
  "./js/core/02-ui-components.js",
  "./js/core/03-shell-navigation.js",
  "./js/core/07-login-signature.js",
  "./js/views/00-dashboard.js",
  "./js/views/01-agenda-clients.js",
  "./js/views/02-clinical-catalog.js",
  "./js/views/03-finance-settings.js",
  "./js/core/06-fast-ui.js",
  "./js/forms/00-appointments-clients.js",
  "./js/forms/01-packages-attendance.js",
  "./js/forms/02-records-media.js",
  "./js/forms/03-products-profile.js",
  "./js/services/sync-backup.js",
  "./js/services/borion-interop-source.js?v=1.10.4",
  "./js/core/04-actions.js",
  "./js/core/05-events-boot.js?v=1.10.4",
  "./js/core/09-mobile-experience.js?v=1.10.4",
  "./initial-data.json",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./assets/signature-animation.webp",
  "./assets/signature-final.webp",
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET'||!request.url.startsWith(self.location.origin))return;
  const url=new URL(request.url);
  const isCode=request.mode==='navigate'||/\.(?:html|css|js)$/.test(url.pathname);
  if(isCode){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
      return response;
    }).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(request,copy));
    return response;
  })));
});
