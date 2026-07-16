'use strict';

/**
 * Amanda Estética v1.10.7 — fundo de partículas conectadas na tela de login.
 * Canvas leve atrás da assinatura e do painel de vidro. Regras:
 *  - desliga por completo com prefers-reduced-motion;
 *  - pausa quando a aba fica em segundo plano (visibilitychange);
 *  - quantidade de pontos escala com a largura da tela (telas pequenas = menos pontos);
 *  - o próprio loop se encerra sozinho quando o canvas sai do DOM
 *    (renderShell substitui #root ao trocar de tela).
 */
(() => {
  let runToken = 0;
  let raf = 0;
  let resizeHandler = null;
  let visibilityHandler = null;

  function stopLoginParticles(){
    runToken += 1;
    if(raf) cancelAnimationFrame(raf);
    raf = 0;
    if(resizeHandler){ window.removeEventListener('resize',resizeHandler); resizeHandler = null; }
    if(visibilityHandler){ document.removeEventListener('visibilitychange',visibilityHandler); visibilityHandler = null; }
  }

  function startLoginParticles(){
    stopLoginParticles();
    const stage = document.querySelector('.login-shell');
    if(!stage) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reducedMotion) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'login-particles';
    canvas.setAttribute('aria-hidden','true');
    stage.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    const token = ++runToken;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, points = [];

    function pointCount(width){
      if(width < 640) return 16;
      if(width < 1200) return 28;
      return 40;
    }

    function sizeCanvas(){
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const count = pointCount(W);
      points = Array.from({length:count},() => ({
        x:Math.random() * W,
        y:Math.random() * H,
        vx:(Math.random() - .5) * .16,
        vy:(Math.random() - .5) * .16
      }));
    }

    function step(){
      if(token !== runToken || !canvas.isConnected){ stopLoginParticles(); return; }
      if(document.hidden){ raf = requestAnimationFrame(step); return; }

      ctx.clearRect(0,0,W,H);
      for(const p of points){
        p.x += p.vx; p.y += p.vy;
        if(p.x <= 0 || p.x >= W) p.vx *= -1;
        if(p.y <= 0 || p.y >= H) p.vy *= -1;
      }

      const maxDist = 130;
      for(let i = 0; i < points.length; i++){
        for(let j = i + 1; j < points.length; j++){
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const dist = Math.hypot(dx,dy);
          if(dist < maxDist){
            ctx.strokeStyle = `rgba(216,120,160,${(1 - dist / maxDist) * .16})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(points[i].x,points[i].y);
            ctx.lineTo(points[j].x,points[j].y);
            ctx.stroke();
          }
        }
      }
      for(const p of points){
        ctx.fillStyle = 'rgba(216,120,160,.45)';
        ctx.beginPath();
        ctx.arc(p.x,p.y,1.6,0,Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    }

    sizeCanvas();
    raf = requestAnimationFrame(step);

    let resizeTimer = 0;
    resizeHandler = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { if(token === runToken) sizeCanvas(); },150);
    };
    window.addEventListener('resize',resizeHandler,{passive:true});

    visibilityHandler = () => {
      if(token !== runToken) return;
      if(!document.hidden && !raf) raf = requestAnimationFrame(step);
    };
    document.addEventListener('visibilitychange',visibilityHandler);
  }

  window.startLoginParticles = startLoginParticles;
  window.stopLoginParticles = stopLoginParticles;
})();
