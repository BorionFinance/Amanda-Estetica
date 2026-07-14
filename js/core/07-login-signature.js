'use strict';

/**
 * Amanda Estética v1.8.5 — assinatura 60 FPS com fundo unificado da v1.8.0.
 */
(() => {
  const FRAME_COUNT = 113;
  const FRAME_MS = 16.66666667;
  const FRAME_PATHS = Array.from({length:FRAME_COUNT},(_,index) =>
    `assets/signature-frames/frame-${String(index + 1).padStart(3,'0')}.webp`
  );
  const FINAL_PATH = 'assets/signature-final.webp';
  const CONTENT_BBOX = {x:126,y:64,width:802,height:1200};

  let runToken = 0;
  let cachePromise = null;

  function loadImage(src){
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => { try{ await img.decode?.(); }catch(_){ } resolve(img); };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function preloadAssets(){
    if(cachePromise) return cachePromise;
    cachePromise = Promise.all([...FRAME_PATHS.map(loadImage), loadImage(FINAL_PATH)])
      .then(images => ({frames:images.slice(0,FRAME_COUNT), finalImage:images[FRAME_COUNT]}));
    return cachePromise;
  }

  function stopLoginSignatureAnimation(){ runToken += 1; }

  function resizeCanvas(canvas){
    const dpr = Math.min(2,Math.max(1,window.devicePixelRatio||1));
    const cssWidth = Math.max(1,window.innerWidth);
    const cssHeight = Math.max(1,window.innerHeight);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);
    if(canvas.width !== width || canvas.height !== height){ canvas.width = width; canvas.height = height; }
    return {dpr, cssWidth, cssHeight};
  }

  function getPlacement(cssWidth,cssHeight){
    const compact = cssWidth <= 860;
    const safeLeft = Math.max(compact ? 16 : 30, cssWidth * (compact ? .025 : .03));
    const safeRight = safeLeft;
    const safeTop = Math.max(compact ? 22 : 32, cssHeight * (compact ? .028 : .035));
    const safeBottom = Math.max(compact ? 34 : 42, cssHeight * (compact ? .045 : .055));
    const availableW = cssWidth - safeLeft - safeRight;
    const availableH = cssHeight - safeTop - safeBottom;
    const widthLimit = availableW * (compact ? .90 : .72);
    const heightLimit = availableH * (compact ? .86 : .94);
    const scale = Math.min(widthLimit / CONTENT_BBOX.width, heightLimit / CONTENT_BBOX.height);
    const width = CONTENT_BBOX.width * scale;
    const height = CONTENT_BBOX.height * scale;
    const x = safeLeft + (availableW - width) / 2;
    const y = safeTop + (availableH - height) / 2 - (compact ? cssHeight * .012 : cssHeight * .008);
    return {x,y,width,height};
  }

  function drawFrame(ctx,img,metrics){
    if(!img) return;
    const {dpr,cssWidth,cssHeight} = metrics;
    const placement = getPlacement(cssWidth,cssHeight);
    ctx.save();
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssWidth,cssHeight);
    ctx.globalAlpha = 1;
    ctx.drawImage(img, CONTENT_BBOX.x, CONTENT_BBOX.y, CONTENT_BBOX.width, CONTENT_BBOX.height, placement.x, placement.y, placement.width, placement.height);
    ctx.restore();
  }

  async function startLoginSignatureAnimation(){
    const stage = document.querySelector('[data-login-signature]');
    const canvas = stage?.querySelector('.login-signature-frame');
    if(!stage || !(canvas instanceof HTMLCanvasElement)) return;
    stopLoginSignatureAnimation();
    const token = ++runToken;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d',{alpha:true,desynchronized:true});
    if(!ctx) return;
    stage.classList.remove('is-visible','is-complete');
    let metrics = resizeCanvas(canvas);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const {frames, finalImage} = await preloadAssets();
    if(token !== runToken || !canvas.isConnected) return;
    const finalStill = finalImage || frames[FRAME_COUNT - 1] || frames.find(Boolean);
    if(!finalStill) return;
    if(reducedMotion){
      metrics = resizeCanvas(canvas);
      drawFrame(ctx, finalStill, metrics);
      stage.classList.add('is-visible','is-complete');
      return;
    }
    stage.classList.add('is-visible');
    const startedAt = performance.now();
    const totalDuration = FRAME_COUNT * FRAME_MS;
    let lastFrameIndex = -1;
    function tick(now){
      if(token !== runToken || !canvas.isConnected) return;
      metrics = resizeCanvas(canvas);
      const elapsed = now - startedAt;
      const frameIndex = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(elapsed / FRAME_MS)));
      if(frameIndex !== lastFrameIndex){
        lastFrameIndex = frameIndex;
        drawFrame(ctx, frames[frameIndex] || finalStill, metrics);
      }
      if(elapsed < totalDuration) requestAnimationFrame(tick);
      else { drawFrame(ctx, finalStill, metrics); stage.classList.add('is-complete'); }
    }
    requestAnimationFrame(tick);
  }

  window.startLoginSignatureAnimation = startLoginSignatureAnimation;
  window.stopLoginSignatureAnimation = stopLoginSignatureAnimation;
})();
