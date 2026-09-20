const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./dist-js-yfM_hTbB.js","./core-np5h1kBO.js","./rolldown-runtime-Dd_uD5pT.js","./webview-C8wQYMJF.js","./main-BUw0bsOf.js","./UPNG-Cc-sg4wI.js","./pako-BPRGPFpG.js","./main-BRo7THHp.css"])))=>i.map(i=>d[i]);
import{i as e}from"./core-np5h1kBO.js";import{T as t,l as n,n as r,u as i,w as a}from"./main-BUw0bsOf.js";var o=Object.freeze([`empty`,`ready`,`processing`,`editing`,`saving`,`saved`,`error`]),s=Object.freeze({empty:new Set([`processing`,`error`]),ready:new Set([`processing`,`empty`,`error`]),processing:new Set([`ready`,`editing`,`empty`,`error`]),editing:new Set([`processing`,`saving`,`ready`,`empty`,`error`]),saving:new Set([`saved`,`editing`,`empty`,`error`]),saved:new Set([`editing`,`saving`,`processing`,`ready`,`empty`,`error`]),error:new Set([`empty`,`processing`,`ready`,`editing`])});function c(e,t){return e===t||!!s[e]?.has(t)}function ee(e,t){if(!o.includes(t))throw Error(`Unknown background-removal state: ${t}`);if(!c(e,t))throw Error(`Invalid background-removal transition: ${e} -> ${t}`);return t}function te(){return{strokes:[],redo:[]}}function ne(e,t){return t?.points?.length?(e.strokes.push(t),e.redo.length=0,!0):!1}function re(e){let t=e.strokes.pop();return t?(e.redo.push(t),t):null}function ie(e){let t=e.redo.pop();return t?(e.strokes.push(t),t):null}function ae(e){e.strokes.length=0,e.redo.length=0}function oe(e,t=``){let n=(Array.isArray(e)?e:[]).filter(e=>e?.installed);return{installed:n,preferred:n.find(e=>e.id===t)||n.find(e=>e.current)||n[0]||null}}function se(e,t){let n=String(e||``).trim(),r=String(t||``).trim();if(!n)return r;if(!r)return n;let i=n.includes(`\\`)?`\\`:`/`;return`${n.replace(/[\\/]+$/,``)}${i}${r.replace(/[\\/]+/g,i).replace(i===`\\`?/^\\+|\\+$/g:/^\/+|\/+$/g,``)}`}function ce(e){let t=String(e||``).trim().replace(/[\\/]+$/,``);if(!t)return``;let n=t.replace(/[\\/][^\\/]+$/,``);return n&&n!==t?n:t}var le=`toolknit.bgremoval.preferences.v2`,ue=4096;function de(){try{let e=JSON.parse(localStorage.getItem(le)||`{}`);return{modelId:typeof e.modelId==`string`?e.modelId:``,feather:Number.isFinite(Number(e.feather))?Number(e.feather):1.2,brushSize:Number.isFinite(Number(e.brushSize))?Number(e.brushSize):36}}catch{return{modelId:``,feather:1.2,brushSize:36}}}function fe(e){return/\.jpe?g$/i.test(e)?`image/jpeg`:/\.webp$/i.test(e)?`image/webp`:/\.bmp$/i.test(e)?`image/bmp`:`image/png`}function pe(e){return String(e||``).split(/[\\/]/).pop()||``}function me(e){return(pe(e)||`cutout`).replace(/\.[^.]+$/,``)}function he(e){let t=Number(e)||0;return t<1024?`${t} B`:t<1048576?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(t>=10485760?0:1)} MB`}function ge(e){let t=e?.tagName?.toLowerCase();return[`input`,`textarea`,`select`].includes(t)||!!e?.isContentEditable}function _e(){return`
    <div class="plasma-bg bg-removal-bg" data-bgr-bg></div>
    <header class="pdf-merge-v2-topbar bg-removal-topbar" data-tauri-drag-region>
      <div class="pdf-merge-v2-topbar-left">
        <button class="settings-v2-back settings-back pdf-merge-v2-back" type="button" data-bgr-action="back" data-bgr-title="backTitle" title="返回">
          <i data-lucide="arrow-left"></i><span data-bgr-text="backTitle">返回</span>
        </button>
        <span class="pdf-merge-v2-top-tag">BACKGROUND REMOVAL · TOOL PAGE 2.3</span>
      </div>
      <div class="home-v2-top-actions pdf-merge-v2-top-actions">
        <button class="home-v2-nav-link" type="button" data-bgr-action="website" data-bgr-title="website">
          <i data-lucide="globe-2"></i><span data-bgr-text="website">网页版本</span>
        </button>
        <button class="home-v2-support-top" type="button" data-bgr-action="support">
          <i data-lucide="heart"></i><span data-bgr-text="support">支持作者</span>
        </button>
        <div class="home-v2-window-cluster" aria-label="窗口与设置">
          <button class="home-v2-icon-button" type="button" data-bgr-action="settings" data-bgr-title="settingsTitle"><i data-lucide="settings"></i></button>
          <div class="home-v2-window-controls" aria-label="窗口控制">
            <button class="home-v2-window-button" type="button" data-window-action="minimize" data-bgr-title="minimize"><i data-lucide="minus"></i></button>
            <button class="home-v2-window-button" type="button" data-window-action="maximize" data-bgr-title="maximize"><i data-lucide="square"></i></button>
            <button class="home-v2-window-button" type="button" data-window-action="close" data-bgr-title="close"><i data-lucide="x"></i></button>
          </div>
        </div>
      </div>
    </header>

    <div class="bg-removal-body" data-bgr-body>
      <button class="bg-removal-drawer-scrim" type="button" data-bgr-action="close-params" data-bgr-title="closeParams" tabindex="-1" hidden></button>
      <aside class="bg-removal-panel" data-bgr-params data-bgr-title="params" aria-label="处理参数">
        <div class="bg-removal-drawer-head">
          <span data-bgr-text="params">处理参数</span>
          <button class="bg-removal-icon-button" type="button" data-bgr-action="close-params" data-bgr-title="closeParams"><i data-lucide="x"></i></button>
        </div>
        <div class="bg-removal-intro">
          <span class="bg-removal-kicker">IMAGE TOOL / AI CUTOUT</span>
          <h1 class="bg-removal-title" data-bgr-text="title">背景移除</h1>
          <p class="bg-removal-subtitle" data-bgr-text="subtitle">AI 一键抠出主体，发丝级边缘，导出透明 PNG。</p>
        </div>
        <div class="bg-removal-note">
          <i data-lucide="shield-check"></i>
          <span data-bgr-text="localNote">推理在本机完成，照片不会上传。</span>
        </div>

        <section class="bg-removal-file-section" aria-labelledby="bgRemovalFileHeading">
          <div class="bg-removal-section-row">
            <span id="bgRemovalFileHeading" class="bg-removal-field-label" data-bgr-text="fileInfo">图片信息</span>
            <span class="bg-removal-file-badge" data-bgr-file-badge>—</span>
          </div>
          <div class="bg-removal-file-empty" data-bgr-file-empty data-bgr-text="noImage">尚未选择图片</div>
          <dl class="bg-removal-file-details" data-bgr-file-details hidden>
            <div><dt data-bgr-text="imageName">文件</dt><dd data-bgr-file-name></dd></div>
            <div><dt data-bgr-text="imageSize">尺寸</dt><dd data-bgr-file-size></dd></div>
            <div><dt data-bgr-text="fileSize">大小</dt><dd data-bgr-file-bytes></dd></div>
          </dl>
          <button class="bg-removal-upload" type="button" data-bgr-action="upload">
            <i data-lucide="image-up"></i><span data-bgr-upload-label data-bgr-text="upload">选择图片</span>
          </button>
        </section>

        <section class="bg-removal-parameters">
          <div>
            <div class="bg-removal-section-row">
              <label class="bg-removal-field-label" for="bgRemovalModel" data-bgr-text="modelLabel">抠图模型</label>
              <button class="bg-removal-link-button" type="button" data-bgr-action="manage-models">
                <i data-lucide="box"></i><span data-bgr-text="manageModels">管理模型</span>
              </button>
            </div>
            <select id="bgRemovalModel" class="bg-removal-select" data-bgr-model></select>
          </div>
          <div>
            <label class="bg-removal-field-label" for="bgRemovalFeather" data-bgr-text="featherLabel">边缘羽化</label>
            <div class="bg-removal-slider-row">
              <input id="bgRemovalFeather" class="bg-removal-slider" data-bgr-feather type="range" min="0" max="8" step="0.2" value="1.2">
              <span class="bg-removal-slider-value" data-bgr-feather-value>1.2px</span>
            </div>
          </div>
        </section>

        <div class="bg-removal-status" data-bgr-status data-state="idle" role="status" aria-live="polite"><span></span></div>
        <button class="bg-removal-process" type="button" data-bgr-action="process" disabled>
          <i data-lucide="wand-sparkles"></i><span data-bgr-process-label data-bgr-text="startCutout">开始抠图</span>
        </button>
      </aside>

      <main class="bg-removal-stage">
        <div class="bg-removal-panel-head">
          <div><span class="bg-removal-section-kicker">AI CUTOUT</span><h2 data-bgr-text="previewTitle">透明预览</h2></div>
          <button class="bg-removal-params-button" type="button" data-bgr-action="open-params">
            <i data-lucide="sliders-horizontal"></i><span data-bgr-text="params">处理参数</span>
          </button>
        </div>

        <div class="bg-removal-screen" data-bgr-screen data-state="empty" data-processed="false">
          <div class="bg-removal-viewport" data-bgr-viewport>
            <div class="bg-removal-canvas-stack" data-bgr-canvas-stack hidden>
              <canvas class="bg-removal-canvas-original" data-bgr-canvas-original></canvas>
              <canvas class="bg-removal-canvas-result" data-bgr-canvas-result></canvas>
            </div>
          </div>

          <button class="bg-removal-empty" type="button" data-bgr-empty data-bgr-action="upload">
            <span class="bg-removal-empty-icon"><i data-lucide="image-up"></i></span>
            <strong data-bgr-text="emptyTitle">选择一张图片开始</strong>
            <span data-bgr-text="emptyDesc">支持 JPG、PNG、WebP、BMP，也可以直接拖入。</span>
            <em data-bgr-text="emptyAction">选择图片</em>
          </button>

          <div class="bg-removal-progress" data-bgr-progress hidden>
            <span class="bg-removal-spinner" aria-hidden="true"></span>
            <strong data-bgr-progress-title></strong>
            <span data-bgr-text="processingHint">推理完全在本机进行，请保持窗口开启。</span>
          </div>

          <div class="bg-removal-toolbar" data-bgr-toolbar hidden>
            <button class="bg-removal-tool-btn" type="button" data-bgr-tool="pan" data-bgr-title="pan"><i data-lucide="hand"></i></button>
            <span class="bg-removal-tool-divider"></span>
            <button class="bg-removal-tool-btn" type="button" data-bgr-tool="restore" data-bgr-title="restore"><i data-lucide="brush"></i></button>
            <button class="bg-removal-tool-btn" type="button" data-bgr-tool="erase" data-bgr-title="erase"><i data-lucide="eraser"></i></button>
            <span class="bg-removal-tool-divider"></span>
            <button class="bg-removal-tool-btn" type="button" data-bgr-action="undo" data-bgr-title="undo"><i data-lucide="undo-2"></i></button>
            <button class="bg-removal-tool-btn" type="button" data-bgr-action="redo" data-bgr-title="redo"><i data-lucide="redo-2"></i></button>
            <button class="bg-removal-tool-btn" type="button" data-bgr-action="reset-edits" data-bgr-title="resetEdits"><i data-lucide="rotate-ccw"></i></button>
            <div class="bg-removal-brush-wrap" data-bgr-brush-wrap>
              <button class="bg-removal-tool-btn is-size" type="button" data-bgr-action="brush-size" data-bgr-title="brushSize"><i data-lucide="circle"></i></button>
              <div class="bg-removal-brush-pop" data-bgr-brush-pop hidden>
                <span data-bgr-text="brushSize">笔刷粗细</span>
                <input class="bg-removal-slider" data-bgr-brush-size type="range" min="4" max="160" step="2" value="36">
                <span class="bg-removal-slider-value" data-bgr-brush-size-value>36px</span>
              </div>
            </div>
          </div>

          <div class="bg-removal-zoombar" data-bgr-zoombar hidden>
            <button class="bg-removal-tool-btn" type="button" data-bgr-action="zoom-out" data-bgr-title="zoomOut"><i data-lucide="minus"></i></button>
            <span class="bg-removal-zoom-value" data-bgr-zoom-value>100%</span>
            <button class="bg-removal-tool-btn" type="button" data-bgr-action="zoom-in" data-bgr-title="zoomIn"><i data-lucide="plus"></i></button>
            <button class="bg-removal-tool-btn" type="button" data-bgr-action="zoom-fit" data-bgr-title="zoomFit"><i data-lucide="scan"></i></button>
            <span class="bg-removal-tool-divider"></span>
            <button class="bg-removal-tool-btn is-compare" type="button" data-bgr-action="compare" data-bgr-title="holdCompare" aria-pressed="false"><i data-lucide="eye"></i></button>
          </div>
        </div>

        <footer class="bg-removal-footer">
          <button class="bg-removal-small-button is-primary" type="button" data-bgr-action="save" hidden>
            <i data-lucide="download"></i><span data-bgr-save-label data-bgr-text="savePng">保存透明 PNG</span>
          </button>
        </footer>
      </main>
    </div>

    <div class="audio-clip-success-overlay bg-removal-success-overlay" data-bgr-success aria-hidden="true" inert>
      <div class="audio-clip-success-dialog" role="dialog" aria-modal="true" aria-labelledby="bgRemovalSuccessTitle">
        <div class="audio-clip-success-icon"><i data-lucide="check"></i></div>
        <h3 class="audio-clip-success-title" id="bgRemovalSuccessTitle" data-bgr-text="doneTitle">背景移除完成</h3>
        <div class="audio-clip-success-meta" data-bgr-text="doneMeta">透明 PNG 已保存到本机。</div>
        <div class="audio-convert-success-detail">
          <div class="audio-convert-success-row">
            <span class="audio-convert-success-key" data-bgr-text="doneFileLabel">输出文件</span>
            <span class="audio-convert-success-value" data-bgr-success-file></span>
          </div>
          <div class="audio-convert-success-row">
            <span class="audio-convert-success-key" data-bgr-text="donePathLabel">保存路径</span>
            <span class="audio-convert-success-value" data-bgr-success-path></span>
          </div>
        </div>
        <div class="audio-clip-success-actions">
          <button class="audio-clip-success-btn audio-clip-success-btn-secondary" type="button" data-bgr-action="open-folder" data-bgr-text="openFolder">打开文件夹</button>
          <button class="audio-clip-success-btn audio-clip-success-btn-primary" type="button" data-bgr-action="success-ok" data-bgr-text="ok">确定</button>
        </div>
      </div>
    </div>
  `}function ve({overlay:o,notify:s=()=>{},isTauri:c=!1,initStandardToolPlasma:ve,disposeStandardToolPlasma:ye,openSettings:be,openMattingModelManager:xe,openSupport:Se,openExternalUrl:Ce,handleWindowAction:we}={}){if(!o)return{open(){},close(){},dispose(){}};o.innerHTML=_e(),o.classList.add(`bg-removal-overlay`);let l=e=>o.querySelector(e),Te=new AbortController,u={signal:Te.signal},Ee=l(`[data-bgr-bg]`),De=l(`[data-bgr-body]`),Oe=l(`[data-bgr-params]`),ke=l(`.bg-removal-drawer-scrim`),Ae=l(`[data-bgr-screen]`),d=l(`[data-bgr-viewport]`),f=l(`[data-bgr-canvas-stack]`),je=l(`[data-bgr-canvas-original]`),Me=l(`[data-bgr-canvas-result]`),Ne=l(`[data-bgr-empty]`),Pe=l(`[data-bgr-progress]`),Fe=l(`[data-bgr-progress-title]`),Ie=l(`[data-bgr-status]`),Le=Ie?.querySelector(`span`),p=l(`[data-bgr-model]`),m=l(`[data-bgr-feather]`),Re=l(`[data-bgr-feather-value]`),h=l(`[data-bgr-brush-size]`),ze=l(`[data-bgr-brush-size-value]`),Be=l(`[data-bgr-brush-pop]`),Ve=l(`[data-bgr-toolbar]`),He=l(`[data-bgr-zoombar]`),Ue=l(`[data-bgr-zoom-value]`),We=l(`[data-bgr-action="process"]`),Ge=l(`[data-bgr-process-label]`),Ke=l(`[data-bgr-action="save"]`),qe=l(`[data-bgr-save-label]`),g=l(`[data-bgr-success]`),Je=l(`[data-bgr-success-file]`),Ye=l(`[data-bgr-success-path]`),Xe=l(`[data-bgr-action="success-ok"]`),Ze=l(`[data-bgr-file-empty]`),Qe=l(`[data-bgr-file-details]`),$e=l(`[data-bgr-file-badge]`),et=l(`[data-bgr-file-name]`),tt=l(`[data-bgr-file-size]`),nt=l(`[data-bgr-file-bytes]`),rt=l(`[data-bgr-upload-label]`),it=l(`[data-bgr-action="compare"]`),at=je.getContext(`2d`),_=Me.getContext(`2d`),v=document.createElement(`canvas`),ot=v.getContext(`2d`),st=document.createElement(`canvas`),ct=st.getContext(`2d`),lt=document.createElement(`canvas`),y=lt.getContext(`2d`),b=document.createElement(`canvas`),x=b.getContext(`2d`),S=de();m.value=String(Math.min(8,Math.max(0,S.feather))),h.value=String(Math.min(160,Math.max(4,S.brushSize)));let ut=!1,dt=null,ft=null,pt=()=>{},mt=null,C=`empty`,w=`empty`,ht=`statusIdle`,gt,T=``,_t=[],E=[],D=``,vt=0,yt=0,bt=0,O=0,k=0,xt=``,A=!1,j=``,M=!1,St=0,N=0,P=0,Ct=!1,F=0,I={scale:1,x:0,y:0,fit:!0},L=`pan`,R=Number(h.value),z=!1,B=null,V=!1,H=null,wt=!1,U=te();function W(e,n){return t(`home.bgRemoval.${e}`,n)}function Tt(){try{localStorage.setItem(le,JSON.stringify(S))}catch{}}function G(){return C===`processing`||C===`saving`}function K(e,t,n){ht=t,gt=n,!(!Ie||!Le)&&(Ie.dataset.state=e,Le.textContent=W(t,n))}function q(e,t,n,{status:r=`idle`}={}){try{C=ee(C,e)}catch(t){console.error(`[BgRemoval] state transition failed:`,t),C=e}[`empty`,`ready`,`editing`,`saved`].includes(e)&&(w=e),t&&K(r,t,n),Y()}function Et(e){try{e?.focus?.({preventScroll:!0})}catch{}}function J(e,{restoreFocus:t=!0}={}){g?.classList.toggle(`visible`,e),g?.setAttribute(`aria-hidden`,e?`false`:`true`),e?(g?.removeAttribute(`inert`),Et(Xe)):(g?.setAttribute(`inert`,``),t&&Et(We))}function Dt(){if(j&&(Je&&(Je.textContent=pe(j),Je.title=j),Ye)){let e=ce(j);Ye.textContent=e,Ye.title=e}}function Ot(){o.querySelectorAll(`[data-bgr-text]`).forEach(e=>{e.textContent=W(e.dataset.bgrText)}),o.querySelectorAll(`[data-bgr-title]`).forEach(e=>{let t=W(e.dataset.bgrTitle);e.title=t,e.setAttribute(`aria-label`,t)}),kt(),K(Ie?.dataset.state||`idle`,ht,gt),Y(),j&&Dt()}function kt(){if(!p)return;let e=p.value||S.modelId,t=oe(_t,e);if(E=t.installed,p.replaceChildren(),!E.length){let e=document.createElement(`option`);e.value=``,e.textContent=W(`noInstalledModels`),p.append(e),p.value=``;return}for(let e of E){let t=document.createElement(`option`);t.value=e.id,t.textContent=`${e.display_name} · ${Math.round(e.bytes/1024/1024)} MB`,p.append(t)}p.value=t.preferred?.id||E[0].id,S.modelId=p.value,Tt()}async function At(){if(!c){_t=[],kt(),Y();return}try{_t=await e(`list_matting_models`),kt(),!E.length&&D&&K(`error`,`modelMissing`)}catch(e){console.error(`[BgRemoval] cannot list models:`,e),_t=[],kt()}Y()}function jt(){let e=!!(D&&O&&k);Ze.hidden=e,Qe.hidden=!e,$e.textContent=e?pe(D).split(`.`).pop()?.toUpperCase()||`IMG`:`—`,e&&(et.textContent=pe(D),et.title=D,tt.textContent=`${yt} × ${bt}`,nt.textContent=he(vt))}function Y(){let e=!!(D&&O&&k),t=G();o.dataset.bgRemovalState=C,Ae.dataset.state=C,Ae.dataset.processed=String(A),f.hidden=!e,Ne.hidden=e,Pe.hidden=C!==`processing`,Ve.hidden=!A||t,He.hidden=!e||C===`processing`,We.disabled=!e||t||!E.length||!c,p.disabled=t||!E.length,m.disabled=t||!e,Ke.hidden=!A,Ke.disabled=t||!xt||!M&&C===`saved`,Ge.textContent=W(A?`rerun`:`startCutout`),qe.textContent=W(C===`saving`?`saving`:`savePng`),rt.textContent=W(e?`chooseAnother`:`upload`),Fe.textContent=W(T===`loading`?`loading`:`processing`),Oe.classList.toggle(`is-open`,Ct),De.classList.toggle(`is-params-open`,Ct),ke.hidden=!Ct,jt(),Mt()}function Mt(){let e=l(`[data-bgr-action="undo"]`),t=l(`[data-bgr-action="redo"]`);e&&(e.disabled=!U.strokes.length||G()),t&&(t.disabled=!U.redo.length||G())}function Nt(e,t){[je,Me,v,st,lt,b].forEach(n=>{n.width=e,n.height=t}),f.style.width=`${e}px`,f.style.height=`${t}px`}function Pt(e){ot.clearRect(0,0,O,k),at.clearRect(0,0,O,k),ot.drawImage(e,0,0,O,k),at.drawImage(v,0,0)}function Ft(){_.clearRect(0,0,O,k),_.drawImage(v,0,0),_.globalCompositeOperation=`destination-in`,_.drawImage(b,0,0),_.globalCompositeOperation=`source-over`}function It(e,t,n){let r=Math.max(2,n+2),i=Math.max(0,Math.floor(Math.min(e.x,t.x)-r)),a=Math.max(0,Math.floor(Math.min(e.y,t.y)-r)),o=Math.min(O,Math.ceil(Math.max(e.x,t.x)+r)),s=Math.min(k,Math.ceil(Math.max(e.y,t.y)+r));o<=i||s<=a||(_.save(),_.beginPath(),_.rect(i,a,o-i,s-a),_.clip(),_.clearRect(i,a,o-i,s-a),_.drawImage(v,0,0),_.globalCompositeOperation=`destination-in`,_.drawImage(b,0,0),_.restore())}function Lt(e,t,n,r){let i=Math.max(1,n);e.save(),e.globalCompositeOperation=r===`erase`?`destination-out`:`source-over`;let a=e.createRadialGradient(t.x,t.y,0,t.x,t.y,i);a.addColorStop(0,`rgba(255,255,255,1)`),a.addColorStop(.68,`rgba(255,255,255,0.94)`),a.addColorStop(1,`rgba(255,255,255,0)`),e.fillStyle=a,e.fillRect(t.x-i,t.y-i,i*2,i*2),e.restore()}function Rt(e,t){let n=t?.points||[];if(n.length){Lt(e,n[0],t.radius,t.mode);for(let r=1;r<n.length;r+=1)zt(e,n[r-1],n[r],t)}}function zt(e,t,n,r){let i=Math.hypot(n.x-t.x,n.y-t.y),a=Math.max(1,r.radius*.28),o=Math.max(1,Math.ceil(i/a));for(let i=1;i<=o;i+=1){let a=i/o;Lt(e,{x:t.x+(n.x-t.x)*a,y:t.y+(n.y-t.y)*a},r.radius,r.mode)}}function Bt(){x.clearRect(0,0,O,k),x.drawImage(lt,0,0);for(let e of U.strokes)Rt(x,e);Ft(),Mt()}function Vt(){y.save(),y.clearRect(0,0,O,k);let e=Number(m.value)||0;y.filter=e>.01?`blur(${e}px)`:`none`,y.drawImage(st,0,0),y.restore(),y.filter=`none`,Bt()}async function Ht(e){let t=new Blob([new Uint8Array(e)],{type:`image/png`}),n=await createImageBitmap(t);ct.clearRect(0,0,O,k),ct.drawImage(n,0,0,O,k),n.close?.();let r=ct.getImageData(0,0,O,k);for(let e=0;e<r.data.length;e+=4)r.data[e]=255,r.data[e+1]=255,r.data[e+2]=255;ct.putImageData(r,0,0)}function Ut(){f.style.transform=`translate(${I.x}px, ${I.y}px) scale(${I.scale})`,Ue.textContent=`${Math.round(I.scale*100)}%`}function Wt(){if(!O)return;let e=d.getBoundingClientRect();if(!e.width||!e.height)return;let t=Math.min(e.width/O,e.height/k,1)*.92;I={scale:t,x:(e.width-O*t)/2,y:(e.height-k*t)/2,fit:!0},Ut()}function Gt(e,t,n){if(!O)return;let r=d.getBoundingClientRect(),i=t??r.left+r.width/2,a=n??r.top+r.height/2,o=(i-r.left-I.x)/I.scale,s=(a-r.top-I.y)/I.scale;I.scale=Math.min(12,Math.max(.05,I.scale*e)),I.x=i-r.left-o*I.scale,I.y=a-r.top-s*I.scale,I.fit=!1,Ut()}function Kt(e,t){let n=f.getBoundingClientRect();return{x:Math.min(O,Math.max(0,(e-n.left)/I.scale)),y:Math.min(k,Math.max(0,(t-n.top)/I.scale))}}function qt(e){L=e,o.querySelectorAll(`[data-bgr-tool]`).forEach(e=>{e.classList.toggle(`is-active`,e.dataset.bgrTool===L),e.setAttribute(`aria-pressed`,String(e.dataset.bgrTool===L))}),d.style.cursor=L===`pan`?`grab`:`none`,L===`pan`&&X()}function Jt(e,t){if(L===`pan`||!A||G()){X();return}let n=d.querySelector(`.bg-removal-brush-cursor`);n||(n=document.createElement(`div`),n.className=`bg-removal-brush-cursor`,d.append(n));let r=d.getBoundingClientRect(),i=R*I.scale;n.style.width=`${i}px`,n.style.height=`${i}px`,n.style.left=`${e-r.left-i/2}px`,n.style.top=`${t-r.top-i/2}px`}function X(){d.querySelector(`.bg-removal-brush-cursor`)?.remove()}function Z(e=`unsavedEdits`){M=!0,(C===`saved`||C===`error`)&&(C=`editing`),w=`editing`,K(`idle`,e),Y()}function Yt(){!A||!re(U)||(Bt(),Z())}function Xt(){!A||!ie(U)||(Bt(),Z())}function Zt(){A&&(ae(U),Bt(),Z(`resetDone`))}async function Qt(t){if(!t||G())return;window.cancelAnimationFrame(F),F=0;let n=++P,r=w;T=`loading`,q(`processing`,`loading`,void 0,{status:`working`});try{let r=await e(`read_file_bytes`,{path:t});if(n!==P)return;let i=new Blob([new Uint8Array(r)],{type:fe(t)}),a=await createImageBitmap(i,{imageOrientation:`from-image`});if(n!==P){a.close?.();return}yt=a.width,bt=a.height,vt=r.length;let o=Math.min(1,ue/Math.max(yt,bt));O=Math.max(1,Math.round(yt*o)),k=Math.max(1,Math.round(bt*o)),D=t,A=!1,M=!1,j=``,J(!1,{restoreFocus:!1}),ae(U),Nt(O,k),Pt(a),a.close?.(),Ft(),I.fit=!0,q(`ready`,`readyToProcess`),requestAnimationFrame(Wt),window.matchMedia(`(max-width: 839px)`).matches&&Q(!0)}catch(e){console.error(`[BgRemoval] load image failed:`,e),C=r,q(`error`,`pickFailed`,void 0,{status:`error`}),s(W(`pickFailed`))}finally{T=``,Y()}}async function $t(){if(!c){s(W(`desktopOnly`)),K(`error`,`desktopOnly`);return}if(!G())try{let{open:e}=await r(async()=>{let{open:e}=await import(`./dist-js-yfM_hTbB.js`);return{open:e}},__vite__mapDeps([0,1,2]),import.meta.url),t=await e({multiple:!1,filters:[{name:`Images`,extensions:[`jpg`,`jpeg`,`png`,`webp`,`bmp`]}]});typeof t==`string`&&await Qt(t)}catch(e){console.error(`[BgRemoval] file picker failed:`,e),K(`error`,`pickFailed`)}}async function en(){if(ut||!c||!D||G()||!p.value)return;window.cancelAnimationFrame(F),F=0;let t=++P,n=++St;N=n,T=`segmenting`,$(!1),Q(!1),q(`processing`,`processing`,void 0,{status:`working`});let r=``;try{if(r=(await e(`segment_image`,{inputPath:D,modelId:p.value,previewMaxSize:ue,requestId:n})).path,t!==P||n!==N)return;let i=await e(`read_file_bytes`,{path:r});if(t!==P||n!==N)return;await Ht(i),ae(U),A=!0,M=!0,j=``,Vt(),qt(`pan`),q(`editing`,`editHint`,void 0,{status:`done`})}catch(e){let n=String(e?.message||e||``);if(/cancelled/i.test(n)||t!==P)return;console.error(`[BgRemoval] segment failed:`,e);let r=/model-not-installed/i.test(n)?`modelMissing`:`segmentFailed`;q(`error`,r,void 0,{status:`error`}),s(W(r))}finally{r&&e(`discard_matting_preview`,{path:r}).catch(()=>{}),N===n&&(N=0),T=``,Y()}}function tn(e){return new Promise((t,n)=>{e.toBlob(async e=>{if(!e){n(Error(`matting:mask-encode-failed`));return}t(new Uint8Array(await e.arrayBuffer()))},`image/png`)})}async function nn(){if(!(!c||!A||G()||!D||!xt)){F&&(window.cancelAnimationFrame(F),F=0,Vt(),Z()),C===`error`&&(C=`editing`),J(!1,{restoreFocus:!1}),q(`saving`,`saving`,void 0,{status:`working`});try{let t=await tn(b);j=(await e(`export_segmented_image`,{inputPath:D,outputDir:xt,fileName:`${me(D)}_透明`,maskBytes:t})).path,M=!1,q(`saved`,`saved`,void 0,{status:`done`}),Dt(),J(!0)}catch(e){console.error(`[BgRemoval] export failed:`,e);let t=/image-too-large/i.test(String(e?.message||e||``));q(`error`,t?`imageTooLarge`:`saveFailed`,void 0,{status:`error`}),s(W(t?`imageTooLarge`:`saveFailed`))}}}async function rn(){if(!(!c||!j))try{await e(`open_path`,{path:j})}catch(e){console.error(`[BgRemoval] cannot open output folder:`,e)}}async function an(){if(!(!c||ft))try{let{getCurrentWebview:e}=await r(async()=>{let{getCurrentWebview:e}=await import(`./webview-C8wQYMJF.js`);return{getCurrentWebview:e}},__vite__mapDeps([3,1,2,4,5,6,7]),import.meta.url);ft=await e().onDragDropEvent(e=>{if(!o.classList.contains(`visible`))return;let t=e.payload||{};if(t.type===`enter`||t.type===`over`)o.classList.add(`drag-over`);else if(t.type===`leave`)o.classList.remove(`drag-over`);else if(t.type===`drop`){o.classList.remove(`drag-over`);let e=t.paths?.[0];e&&/\.(jpe?g|png|webp|bmp)$/i.test(e)?Qt(e):K(`error`,`unsupportedFile`)}})}catch(e){console.error(`[BgRemoval] native drag listener failed:`,e)}}function on(){try{ft?.()}catch{}ft=null,o.classList.remove(`drag-over`)}function Q(e){Ct=!!e,Y()}function $(e){wt=!!(e&&A&&!G()),f.classList.toggle(`is-compare`,wt),it?.setAttribute(`aria-pressed`,String(wt))}function sn(e){e===`back`?dn():e===`website`?Ce?.(`https://toolknit.com`):e===`support`?Se?.():e===`settings`?be?.():e===`manage-models`?xe?.():e===`upload`?$t():e===`process`?en():e===`save`?nn():e===`open-folder`?rn():e===`success-ok`?J(!1):e===`reset-edits`?Zt():e===`undo`?Yt():e===`redo`?Xt():e===`zoom-in`?Gt(1.25):e===`zoom-out`?Gt(.8):e===`zoom-fit`?Wt():e===`open-params`?Q(!0):e===`close-params`?Q(!1):e===`brush-size`&&(Be.hidden=!Be.hidden)}o.addEventListener(`click`,e=>{let t=e.target.closest(`[data-bgr-action]`);t&&t.dataset.bgrAction!==`compare`&&sn(t.dataset.bgrAction);let n=e.target.closest(`[data-window-action]`);n&&we?.(n.dataset.windowAction),e.target.closest(`[data-bgr-brush-wrap]`)||(Be.hidden=!0)},u),o.querySelectorAll(`[data-bgr-tool]`).forEach(e=>{e.addEventListener(`click`,()=>qt(e.dataset.bgrTool),u)}),p.addEventListener(`change`,()=>{S.modelId=p.value,Tt()},u),m.addEventListener(`input`,()=>{S.feather=Number(m.value),Re.textContent=`${S.feather.toFixed(1)}px`,Tt(),A&&!G()&&(window.cancelAnimationFrame(F),F=window.requestAnimationFrame(()=>{F=0,Vt(),Z()}))},u),h.addEventListener(`input`,()=>{R=Number(h.value),S.brushSize=R,ze.textContent=`${Math.round(R)}px`,Tt()},u),d.addEventListener(`wheel`,e=>{!O||C===`processing`||(e.preventDefault(),Gt(Math.exp(-e.deltaY*.0015),e.clientX,e.clientY))},{...u,passive:!1}),d.addEventListener(`pointerdown`,e=>{if(!(!O||G())){if(L!==`pan`&&A&&e.button===0){d.setPointerCapture(e.pointerId),z=!0;let t=Kt(e.clientX,e.clientY);B={mode:L===`erase`?`erase`:`restore`,radius:R/2,points:[t]},Lt(x,t,B.radius,B.mode),It(t,t,B.radius);return}(e.button===0||e.button===1)&&(d.setPointerCapture(e.pointerId),V=!0,H={x:e.clientX,y:e.clientY,viewX:I.x,viewY:I.y},d.style.cursor=`grabbing`)}},u),d.addEventListener(`pointermove`,e=>{if(Jt(e.clientX,e.clientY),z&&B){let t=Kt(e.clientX,e.clientY),n=B.points[B.points.length-1];Math.hypot(t.x-n.x,t.y-n.y)>=Math.max(1,B.radius*.18)&&(B.points.push(t),zt(x,n,t,B),It(n,t,B.radius));return}V&&H&&(I.x=H.viewX+e.clientX-H.x,I.y=H.viewY+e.clientY-H.y,I.fit=!1,Ut())},u),d.addEventListener(`pointerleave`,()=>{z||X()},u);let cn=e=>{z&&B&&(z=!1,ne(U,B)&&Z(),B=null),V&&(V=!1,H=null,d.style.cursor=L===`pan`?`grab`:`none`);try{d.releasePointerCapture(e.pointerId)}catch{}};d.addEventListener(`pointerup`,cn,u),d.addEventListener(`pointercancel`,cn,u),it.addEventListener(`pointerdown`,e=>{e.preventDefault(),$(!0)},u),it.addEventListener(`pointerup`,()=>$(!1),u),it.addEventListener(`pointerleave`,()=>$(!1),u),window.addEventListener(`pointerup`,()=>$(!1),u),window.addEventListener(`blur`,()=>$(!1),u),document.addEventListener(`keydown`,e=>{if(o.classList.contains(`visible`)){if(e.key===`Escape`&&g?.classList.contains(`visible`)){e.preventDefault(),J(!1);return}ge(e.target)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`z`?(e.preventDefault(),e.shiftKey?Xt():Yt()):(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`y`&&(e.preventDefault(),Xt()))}},u),document.addEventListener(`toolknit:matting-models-changed`,()=>void At(),u),mt=new ResizeObserver(()=>{I.fit&&O&&o.classList.contains(`visible`)&&Wt()}),mt.observe(d);async function ln(){try{xt=se(await e(`get_output_root`)||await e(`get_default_output_root`),`背景移除`),await At()}catch(e){console.error(`[BgRemoval] initialization failed:`,e),K(`error`,`initFailed`)}}function un(){ut||(o.classList.add(`visible`),o.setAttribute(`aria-hidden`,`false`),dt||=ve?.(Ee)||null,Re.textContent=`${Number(m.value).toFixed(1)}px`,ze.textContent=`${Math.round(R)}px`,Ot(),qt(L),n({icons:i,attrs:{"aria-hidden":`true`}}),an(),c?ln():K(`idle`,`desktopOnly`),requestAnimationFrame(()=>{I.fit&&Wt()}))}function dn(){o.classList.contains(`visible`)&&(P+=1,N&&=(e(`cancel_matting_segmentation`,{requestId:N}).catch(()=>{}),0),z=!1,B=null,V=!1,H=null,$(!1),Q(!1),J(!1,{restoreFocus:!1}),X(),C===`processing`&&(C=w,K(`idle`,w===`editing`||w===`saved`?`editHint`:w===`ready`?`readyToProcess`:`statusIdle`)),o.classList.remove(`visible`,`drag-over`),o.setAttribute(`aria-hidden`,`true`),on(),dt=ye?.(dt)||null)}function fn(){if(!ut){dn(),ut=!0,Te.abort(),mt?.disconnect(),window.cancelAnimationFrame(F);try{pt()}catch{}o.replaceChildren()}}return pt=a(Ot)||(()=>{}),window.addEventListener(`beforeunload`,fn,{...u,once:!0}),Ot(),qt(`pan`),{open:un,close:dn,dispose:fn}}export{ve as initBgRemovalTool};