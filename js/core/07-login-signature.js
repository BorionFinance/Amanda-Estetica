'use strict';

/**
 * Amanda Estética v1.10.4 — assinatura consolidada em um único WebP animado.
 * A sequência original foi preservada, mas sem 113 arquivos e 113 requisições separadas.
 */
(() => {
  const ANIMATION_PATH = 'assets/signature-animation.webp';
  const FINAL_PATH = 'assets/signature-final.webp';
  const ANIMATION_MS = 1900;
  const CONTENT_SIZE = {width:668,height:1000};

  let runToken = 0;
  let completeTimer = 0;
  let resizeHandler = null;

  function stopLoginSignatureAnimation(){
    runToken += 1;
    clearTimeout(completeTimer);
    if(resizeHandler){
      window.removeEventListener('resize',resizeHandler);
      resizeHandler = null;
    }
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
    const scale = Math.min(widthLimit / CONTENT_SIZE.width, heightLimit / CONTENT_SIZE.height);
    const width = CONTENT_SIZE.width * scale;
    const height = CONTENT_SIZE.height * scale;
    const x = safeLeft + (availableW - width) / 2;
    const y = safeTop + (availableH - height) / 2 - (compact ? cssHeight * .012 : cssHeight * .008);
    return {x,y,width,height};
  }

  function placeFrame(frame){
    const placement = getPlacement(Math.max(1,window.innerWidth),Math.max(1,window.innerHeight));
    frame.style.left = `${placement.x}px`;
    frame.style.top = `${placement.y}px`;
    frame.style.width = `${placement.width}px`;
    frame.style.height = `${placement.height}px`;
  }

  function startLoginSignatureAnimation(){
    const stage = document.querySelector('[data-login-signature]');
    const oldFrame = stage?.querySelector('.login-signature-frame');
    if(!stage || !(oldFrame instanceof HTMLImageElement)) return;

    stopLoginSignatureAnimation();
    const token = ++runToken;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Um novo elemento garante que o WebP reinicie ao voltar para a tela de acesso,
    // usando o arquivo já armazenado no cache do navegador.
    const frame = oldFrame.cloneNode(false);
    frame.removeAttribute('src');
    oldFrame.replaceWith(frame);
    stage.classList.remove('is-visible','is-complete');
    placeFrame(frame);

    resizeHandler = () => {
      if(token === runToken && frame.isConnected) placeFrame(frame);
    };
    window.addEventListener('resize',resizeHandler,{passive:true});

    frame.onload = () => {
      if(token !== runToken || !frame.isConnected) return;
      placeFrame(frame);
      stage.classList.add('is-visible');
      if(reducedMotion){
        stage.classList.add('is-complete');
      }else{
        completeTimer = window.setTimeout(() => {
          if(token === runToken && frame.isConnected) stage.classList.add('is-complete');
        },ANIMATION_MS);
      }
    };
    frame.onerror = () => {
      if(token !== runToken || !frame.isConnected || frame.src.endsWith(FINAL_PATH)) return;
      frame.src = FINAL_PATH;
    };
    frame.src = reducedMotion ? FINAL_PATH : ANIMATION_PATH;
  }

  window.startLoginSignatureAnimation = startLoginSignatureAnimation;
  window.stopLoginSignatureAnimation = stopLoginSignatureAnimation;
})();
