const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./dist-js-yfM_hTbB.js","./core-np5h1kBO.js","./rolldown-runtime-Dd_uD5pT.js","./main-BUw0bsOf.js","./UPNG-Cc-sg4wI.js","./pako-BPRGPFpG.js","./main-BRo7THHp.css","./webview-C8wQYMJF.js"])))=>i.map(i=>d[i]);
import{T as e,l as t,n,u as r,w as i}from"./main-BUw0bsOf.js";var a=20,o=/\.(?:xlsx|xls|ods)$/i;function s(t,n){return e(`home.excelToPdfPage.${t}`,n)}function c(e){return String(e||``).split(/[\\/]/).pop()||``}function l(e){let t=Number(e);return!Number.isFinite(t)||t<0?s(`unknownSize`):t>=1048576?`${(t/1024/1024).toFixed(t>=10485760?0:1)} MB`:t>=1024?`${Math.round(t/1024)} KB`:`${t} B`}function u(){return`
    <div class="plasma-bg pdf-merge-v2-bg excel-pdf-bg" data-excel-bg></div>
    <div class="audio-convert-drop-zone pdf-merge-v2-drop-zone" data-excel-drop-zone>
      <span class="drop-hint" data-excel-text="dropHint">松手即可添加 Excel 工作簿</span>
    </div>
    <header class="pdf-merge-v2-topbar excel-pdf-topbar" data-tauri-drag-region>
      <div class="pdf-merge-v2-topbar-left">
        <button class="settings-v2-back settings-back pdf-merge-v2-back" type="button" data-excel-action="back" data-excel-title="back">
          <i data-lucide="arrow-left"></i><span data-excel-text="back">返回首页</span>
        </button>
        <span class="pdf-merge-v2-top-tag">SPREADSHEET · TOOL PAGE 2.3</span>
      </div>
      <div class="home-v2-top-actions pdf-merge-v2-top-actions">
        <button class="home-v2-nav-link" type="button" data-excel-action="website" data-excel-title="website">
          <i data-lucide="globe-2"></i><span data-excel-text="website">网页版本</span>
        </button>
        <button class="home-v2-support-top" type="button" data-excel-action="support">
          <i data-lucide="heart"></i><span data-excel-text="support">支持作者</span>
        </button>
        <div class="home-v2-window-cluster" aria-label="窗口与设置">
          <button class="home-v2-icon-button" type="button" data-excel-action="settings" data-excel-title="settings"><i data-lucide="settings"></i></button>
          <div class="home-v2-window-controls" aria-label="窗口控制">
            <button class="home-v2-window-button" type="button" data-window-action="minimize" data-excel-title="minimize"><i data-lucide="minus"></i></button>
            <button class="home-v2-window-button" type="button" data-window-action="maximize" data-excel-title="maximize"><i data-lucide="square"></i></button>
            <button class="home-v2-window-button" type="button" data-window-action="close" data-excel-title="close"><i data-lucide="x"></i></button>
          </div>
        </div>
      </div>
    </header>

    <div class="pdf-merge-v2-body excel-pdf-body">
      <aside class="pdf-merge-v2-poster excel-pdf-poster" data-excel-title="title">
        <div class="pdf-merge-v2-poster-kicker" data-excel-text="heroLabel">Workbook Renderer</div>
        <h1 class="pdf-merge-v2-title" data-excel-text="title">Excel 转 PDF</h1>
        <p class="pdf-merge-v2-subtitle" data-excel-text="subtitle">把 Excel 工作簿转换为适合分享、打印和归档的 PDF。</p>
        <div class="pdf-merge-v2-poster-note">
          <span data-excel-text="localLabel">LOCAL RENDER</span>
          <strong data-excel-text="localNote">使用 ToolKnit 的本地 LibreOffice 运行时，文件不会上传服务器。</strong>
        </div>
        <div class="pdf-merge-v2-steps">
          ${[1,2,3,4].map(e=>`
            <div class="pdf-merge-v2-step${e===1?` is-active`:``}">
              <span>0${e}</span>
              <div><strong data-excel-text="step${e}Title"></strong><p data-excel-text="step${e}Desc"></p></div>
            </div>`).join(``)}
        </div>
      </aside>

      <main class="pdf-merge-v2-workspace excel-pdf-workspace">
        <section class="pdf-merge-v2-upload excel-pdf-upload">
          <div class="pdf-merge-v2-upload-copy">
            <span class="pdf-merge-v2-upload-eyebrow" data-excel-text="uploadEyebrow">DROP OR SELECT</span>
            <h2 data-excel-text="uploadTitle">把需要转换的 Excel 放到这里</h2>
            <p data-excel-text="uploadDesc">支持 XLSX、XLS 和 ODS；当前版本用于确认界面与操作流程。</p>
          </div>
          <button class="audio-convert-cta pdf-merge-v2-cta" type="button" data-excel-action="upload">
            <i data-lucide="upload"></i><span data-excel-text="uploadButton">上传 Excel 文件</span>
          </button>
          <input type="file" accept=".xlsx,.xls,.ods" multiple data-excel-input hidden>
        </section>

        <section class="excel-pdf-settings" aria-labelledby="excelPdfSettingsTitle">
          <div class="excel-pdf-settings-head">
            <span class="pdf-merge-v2-section-kicker" data-excel-text="settingsEyebrow">PAGE SETUP</span>
            <h2 id="excelPdfSettingsTitle" data-excel-text="settingsTitle">转换设置</h2>
          </div>
          <div class="excel-pdf-settings-grid">
            <fieldset class="excel-pdf-setting" data-setting-group="sheets">
              <legend data-excel-text="sheetRange">工作表范围</legend>
              <div class="excel-pdf-segment">
                <button class="is-active" type="button" data-setting-value="all" data-excel-text="sheetAll" aria-pressed="true">全部</button>
                <button type="button" data-setting-value="visible" data-excel-text="sheetVisible" aria-pressed="false">仅可见</button>
              </div>
            </fieldset>
            <fieldset class="excel-pdf-setting" data-setting-group="orientation">
              <legend data-excel-text="orientation">页面方向</legend>
              <div class="excel-pdf-segment excel-pdf-segment-three">
                <button class="is-active" type="button" data-setting-value="source" data-excel-text="orientationSource" aria-pressed="true">跟随源文件</button>
                <button type="button" data-setting-value="portrait" data-excel-text="orientationPortrait" aria-pressed="false">纵向</button>
                <button type="button" data-setting-value="landscape" data-excel-text="orientationLandscape" aria-pressed="false">横向</button>
              </div>
            </fieldset>
            <fieldset class="excel-pdf-setting" data-setting-group="paper">
              <legend data-excel-text="paper">纸张</legend>
              <div class="excel-pdf-segment excel-pdf-segment-three">
                <button class="is-active" type="button" data-setting-value="auto" data-excel-text="paperAuto" aria-pressed="true">自动</button>
                <button type="button" data-setting-value="a4" data-excel-text="paperA4" aria-pressed="false">A4</button>
                <button type="button" data-setting-value="letter" data-excel-text="paperLetter" aria-pressed="false">Letter</button>
              </div>
            </fieldset>
            <fieldset class="excel-pdf-setting" data-setting-group="scale">
              <legend data-excel-text="scale">缩放</legend>
              <div class="excel-pdf-segment">
                <button class="is-active" type="button" data-setting-value="fit" data-excel-text="scaleFit" aria-pressed="true">适合页面</button>
                <button type="button" data-setting-value="original" data-excel-text="scaleOriginal" aria-pressed="false">原始比例</button>
              </div>
            </fieldset>
          </div>
        </section>

        <section class="pdf-merge-v2-queue excel-pdf-queue">
          <div class="pdf-merge-v2-section-head">
            <div>
              <span class="pdf-merge-v2-section-kicker" data-excel-text="queueEyebrow">CONVERT QUEUE</span>
              <h2 data-excel-text="queueTitle">待转换工作簿</h2>
            </div>
            <div class="excel-pdf-queue-actions">
              <p data-excel-text="queueDesc">每个工作簿输出一个独立 PDF。</p>
              <button class="excel-pdf-icon-button" type="button" data-excel-action="clear" data-excel-title="clearQueue" hidden><i data-lucide="trash-2"></i></button>
            </div>
          </div>
          <div class="excel-pdf-queue-surface">
            <button class="excel-pdf-empty" type="button" data-excel-action="upload">
              <i data-lucide="file-spreadsheet"></i>
              <strong data-excel-text="queueEmptyTitle">还没有 Excel 文件</strong>
              <span data-excel-text="queueEmptyDesc">点击上传按钮或把工作簿拖到页面中。</span>
            </button>
            <div class="excel-pdf-files" data-excel-files hidden></div>
          </div>
        </section>

        <section class="pdf-merge-v2-info excel-pdf-info">
          <h3 class="audio-convert-formats-title" data-excel-text="formatsTitle">输出说明</h3>
          <div class="pdf-merge-info-grid">
            <div class="pdf-merge-info-item"><i data-lucide="sheet"></i><span data-excel-text="formatTypes">XLSX / XLS / ODS</span></div>
            <div class="pdf-merge-info-item"><i data-lucide="files"></i><span data-excel-text="onePdf">每个工作簿生成一个 PDF</span></div>
            <div class="pdf-merge-info-item"><i data-lucide="type"></i><span data-excel-text="fontNote">字体缺失时版式可能略有变化</span></div>
            <div class="pdf-merge-info-item"><i data-lucide="shield-check"></i><span data-excel-text="privacy">纯本地处理，不上传文件</span></div>
          </div>
        </section>

        <footer class="pdf-merge-v2-actions excel-pdf-actions">
          <span data-excel-status data-excel-text="footerEmpty">添加工作簿并确认页面设置后，即可进入转换流程。</span>
          <button class="audio-convert-process-btn pdf-merge-v2-process" type="button" data-excel-action="convert" hidden disabled>
            <i data-lucide="file-output"></i><span data-excel-text="startButton">开始转换</span>
          </button>
        </footer>
      </main>
    </div>

    <div class="audio-convert-process-mask" data-excel-process>
      <div class="tk-mascot-lg" aria-hidden="true"></div>
      <div class="audio-convert-process-bar">
        <div class="audio-convert-process-bar-fill" data-excel-progress></div>
      </div>
      <div class="audio-convert-process-text" data-excel-process-text></div>
      <button class="audio-convert-cancel-btn" type="button" data-excel-action="cancel" data-excel-text="cancelButton">取消转换</button>
    </div>

    <div class="audio-clip-success-overlay" data-excel-success aria-hidden="true">
      <div class="audio-clip-success-dialog">
        <div class="audio-clip-success-icon"><i data-lucide="check"></i></div>
        <h3 class="audio-clip-success-title" data-excel-text="successTitle">Excel 转 PDF 完成</h3>
        <div class="audio-clip-success-meta" data-excel-success-meta></div>
        <div class="audio-convert-success-detail">
          <div class="audio-convert-success-row">
            <span class="audio-convert-success-key" data-excel-text="successFiles">转换文件</span>
            <span class="audio-convert-success-value" data-excel-success-files></span>
          </div>
          <div class="audio-convert-success-row">
            <span class="audio-convert-success-key" data-excel-text="successPages">PDF 页数</span>
            <span class="audio-convert-success-value" data-excel-success-pages></span>
          </div>
          <div class="audio-convert-success-row">
            <span class="audio-convert-success-key" data-excel-text="successPath">保存位置</span>
            <span class="audio-convert-success-value" data-excel-success-path></span>
          </div>
        </div>
        <div class="audio-clip-success-actions">
          <button class="audio-clip-success-btn audio-clip-success-btn-secondary" type="button" data-excel-action="open-output" data-excel-text="openFolder">打开文件夹</button>
          <button class="audio-clip-success-btn audio-clip-success-btn-primary" type="button" data-excel-action="success-ok" data-excel-text="ok">确定</button>
        </div>
      </div>
    </div>
  `}function d({overlay:e,notify:d=()=>{},isTauri:f=!1,initStandardToolPlasma:p,disposeStandardToolPlasma:m,openSettings:ee,openSupport:h,openExternalUrl:g,handleWindowAction:te,getOutputDir:ne,ensureLibreOfficeAvailable:_}={}){if(!e)return{open(){},close(){},dispose(){}};e.innerHTML=u();let v=t=>e.querySelector(t),y=new AbortController,b={signal:y.signal},x=v(`[data-excel-input]`),S=v(`[data-excel-files]`),C=v(`.excel-pdf-empty`),w=v(`[data-excel-action="clear"]`),T=v(`[data-excel-status]`),E=v(`[data-excel-action="convert"]`),re=v(`[data-excel-process]`),D=v(`[data-excel-progress]`),ie=v(`[data-excel-process-text]`),O=v(`[data-excel-success]`),k=v(`[data-excel-success-meta]`),A=v(`[data-excel-success-files]`),j=v(`[data-excel-success-pages]`),M=v(`[data-excel-success-path]`),N=v(`[data-excel-drop-zone]`),P=v(`[data-excel-bg]`),F={sheets:`all`,orientation:`source`,paper:`auto`,scale:`fit`},I=[],L=1,R=null,z=null,B=null,V=!1,H=!1,U=``;function W(e){return`${String(e.path||e.name).toLowerCase()}::${Number(e.size)||0}`}function G(){C.hidden=I.length>0,S.hidden=I.length===0,w.hidden=I.length===0,S.innerHTML=I.map((e,t)=>`
      <article class="excel-pdf-file" data-file-id="${e.id}">
        <span class="excel-pdf-file-index">${String(t+1).padStart(2,`0`)}</span>
        <span class="excel-pdf-file-icon"><i data-lucide="file-spreadsheet"></i></span>
        <span class="excel-pdf-file-copy">
          <strong title="${e.name.replace(/&/g,`&amp;`).replace(/"/g,`&quot;`).replace(/</g,`&lt;`)}">${e.name.replace(/&/g,`&amp;`).replace(/</g,`&lt;`)}</strong>
          <small>${e.extension.toUpperCase()} · ${l(e.size)}</small>
        </span>
        <button class="excel-pdf-icon-button" type="button" data-remove-file="${e.id}" title="${s(`removeFile`)}" aria-label="${s(`removeFile`)}"><i data-lucide="x"></i></button>
      </article>`).join(``),T.textContent=I.length?s(`footerReady`,{count:I.length}):s(`footerEmpty`),E.hidden=I.length===0,E.disabled=I.length===0||V,E.classList.toggle(`visible`,I.length>0),t({icons:r,attrs:{"aria-hidden":`true`}})}function K(e){let t=[],n=!1,r=!1,i=new Set(I.map(W));for(let l of e){let e=l.name||c(l.path);if(!o.test(e)){n=!0;continue}if(I.length+t.length>=a){d(s(`tooMany`));break}let u=e.split(`.`).pop()||``,f={id:L++,name:e,extension:u,size:l.size,path:l.path||``},p=W(f);if(i.has(p)){r=!0;continue}i.add(p),t.push(f)}I.push(...t),n?d(s(`unsupported`)):r&&d(s(`duplicate`)),G()}function q(e){K(Array.from(e||[]).map(e=>({name:e.name,size:e.size})))}function J(){e.querySelectorAll(`[data-excel-text]`).forEach(e=>{let t=e.dataset.excelText;t&&(e.textContent=s(t))}),e.querySelectorAll(`[data-excel-title]`).forEach(e=>{let t=e.dataset.excelTitle;if(!t)return;let n=s(t);e.title=n,e.getAttribute(`aria-label`)||e.setAttribute(`aria-label`,n)}),G()}async function ae(){if(!V){if(!f){x.value=``,x.click();return}try{let{open:e}=await n(async()=>{let{open:e}=await import(`./dist-js-yfM_hTbB.js`);return{open:e}},__vite__mapDeps([0,1,2]),import.meta.url),t=await e({multiple:!0,filters:[{name:`Excel`,extensions:[`xlsx`,`xls`,`ods`]}]});K((Array.isArray(t)?t:typeof t==`string`?[t]:[]).map(e=>({path:e,name:c(e)})))}catch(e){console.error(`[ExcelToPdf] file picker failed:`,e),d(s(`chooseFailed`))}}}function Y(e,t,n=!0){D.style.width=`${Math.max(0,Math.min(100,Number(e)||0))}%`,ie.textContent=t||s(`processing`),re.classList.toggle(`visible`,!!n)}function X(e){let t=String(e?.message||e||``);return/runtime-missing|python-missing/i.test(t)?s(`runtimeMissing`):/invalid-extension|invalid-workbook|invalid-input|input-not-found|read-failed/i.test(t)?s(`invalidWorkbook`):/input-too-large/i.test(t)?s(`fileTooLarge`):/invalid-file-count/i.test(t)?s(`tooMany`):/invalid-options/i.test(t)?s(`invalidOptions`):/busy|another file conversion/i.test(t)?s(`busy`):/cancelled|canceled/i.test(t)?s(`cancelled`):/timeout/i.test(t)?s(`timeout`):/render-failed|all-failed/i.test(t)?s(`renderFailed`):s(`conversionFailed`,{error:t||s(`unknownError`)})}function oe(e){U=String(e?.outputDir||``);let t=Array.isArray(e?.outputs)?e.outputs:[],n=t.reduce((e,t)=>e+(Number(t?.pageCount)||0),0),r=Number(e?.successCount)||t.length,i=Number(e?.failCount)||0;k.textContent=i?s(`successPartial`,{success:r,failed:i}):s(`successMeta`,{count:r}),A.textContent=s(`successFileCount`,{count:r}),j.textContent=n>0?s(`successPageCount`,{count:n}):s(`pageCountUnavailable`),M.textContent=U,O.classList.add(`visible`),O.setAttribute(`aria-hidden`,`false`)}async function Z(){try{B?.()}catch{}B=null}async function se(){if(V||I.length===0)return;if(!f){d(s(`desktopOnly`));return}let t=I.map(e=>e.path).filter(Boolean);if(t.length!==I.length){d(s(`reselectDesktopFiles`));return}try{if(_&&!await _())return}catch(e){/runtime-missing/i.test(String(e?.message||e))||d(X(e));return}V=!0,H=!1,G(),e.querySelectorAll(`[data-setting-value], [data-excel-action="upload"], [data-excel-action="clear"], [data-remove-file]`).forEach(e=>{e.disabled=!0}),Y(4,s(`preparing`));try{let[{invoke:e},{listen:r}]=await Promise.all([n(()=>import(`./core-np5h1kBO.js`).then(e=>e.r),__vite__mapDeps([1,2]),import.meta.url),n(()=>import(`./main-BUw0bsOf.js`).then(e=>e.g),__vite__mapDeps([3,2,1,4,5,6]),import.meta.url)]);B=await r(`excel-to-pdf-progress`,e=>{let t=e.payload||{},n=String(t.phase||`converting`),r=n===`complete`?s(`complete`):s(n===`publishing`?`publishing`:n===`complete`?`complete`:`converting`,{current:Number(t.current)||1,total:Number(t.total)||I.length,file:String(t.fileName||``)});Y(t.percent,r)});let i=await e(`convert_excel_to_pdf`,{inputPaths:t,outputDir:await ne?.(`Excel_To_PDF`),options:{sheetRange:F.sheets,orientation:F.orientation,paper:F.paper,scale:F.scale}});Y(100,s(`complete`)),oe(i)}catch(e){console.error(`[ExcelToPdf] conversion failed:`,e),d(X(e))}finally{await Z(),window.setTimeout(()=>Y(0,s(`processing`),!1),220),V=!1,H=!1,e.querySelectorAll(`[data-setting-value], [data-excel-action="upload"], [data-excel-action="clear"], [data-remove-file]`).forEach(e=>{e.disabled=!1}),G()}}async function Q(){if(!(!f||z))try{let{getCurrentWebview:t}=await n(async()=>{let{getCurrentWebview:e}=await import(`./webview-C8wQYMJF.js`);return{getCurrentWebview:e}},__vite__mapDeps([7,1,2,3,4,5,6]),import.meta.url);z=await t().onDragDropEvent(t=>{if(!e.classList.contains(`visible`))return;let n=t.payload||{};n.type===`enter`||n.type===`over`?(e.classList.add(`drag-over`),N.classList.add(`visible`)):n.type===`leave`?(e.classList.remove(`drag-over`),N.classList.remove(`visible`)):n.type===`drop`&&(e.classList.remove(`drag-over`),N.classList.remove(`visible`),K((n.paths||[]).map(e=>({path:e,name:c(e)}))))})}catch(e){console.error(`[ExcelToPdf] native drag listener failed:`,e)}}function ce(){try{z?.()}catch{}z=null,e.classList.remove(`drag-over`),N.classList.remove(`visible`)}function le(){e.classList.add(`visible`),e.setAttribute(`aria-hidden`,`false`),R=p?.(P)||R,J(),Q()}function $(){if(e.classList.contains(`visible`)){if(V){d(s(`busy`));return}e.classList.remove(`visible`,`drag-over`),e.setAttribute(`aria-hidden`,`true`),ce(),O.classList.remove(`visible`),O.setAttribute(`aria-hidden`,`true`),R=m?.(R)||null}}function ue(){$(),y.abort(),Z();try{de()}catch{}e.replaceChildren()}e.addEventListener(`click`,e=>{let t=e.target.closest(`[data-remove-file]`);if(t){I=I.filter(e=>e.id!==Number(t.dataset.removeFile)),G();return}let r=e.target.closest(`[data-setting-value]`);if(r){let e=r.closest(`[data-setting-group]`);if(!e)return;F[e.dataset.settingGroup]=r.dataset.settingValue,e.querySelectorAll(`[data-setting-value]`).forEach(e=>{let t=e===r;e.classList.toggle(`is-active`,t),e.setAttribute(`aria-pressed`,String(t))});return}let i=e.target.closest(`[data-excel-action]`)?.dataset.excelAction;i===`back`?$():i===`upload`?ae():i===`clear`?(I=[],G()):i===`convert`?se():i===`cancel`&&V&&!H?(H=!0,Y(Number.parseFloat(D.style.width)||0,s(`cancelling`)),n(async()=>{let{invoke:e}=await import(`./core-np5h1kBO.js`).then(e=>e.r);return{invoke:e}},__vite__mapDeps([1,2]),import.meta.url).then(({invoke:e})=>e(`cancel_convert`)).catch(()=>{})):i===`success-ok`?(O.classList.remove(`visible`),O.setAttribute(`aria-hidden`,`true`)):i===`open-output`&&U?n(async()=>{let{invoke:e}=await import(`./core-np5h1kBO.js`).then(e=>e.r);return{invoke:e}},__vite__mapDeps([1,2]),import.meta.url).then(({invoke:e})=>e(`open_path`,{path:U})).catch(e=>{console.error(`[ExcelToPdf] open output failed:`,e),d(s(`openFolderFailed`))}):i===`website`?g?.(`https://toolknit.com`):i===`support`?h?.():i===`settings`&&ee?.();let a=e.target.closest(`[data-window-action]`)?.dataset.windowAction;a&&te?.(a)},b),x.addEventListener(`change`,()=>q(x.files),b),e.addEventListener(`dragover`,t=>{t.dataTransfer?.types?.includes(`Files`)&&(t.preventDefault(),e.classList.add(`drag-over`),N.classList.add(`visible`))},b),e.addEventListener(`dragleave`,t=>{t.relatedTarget&&e.contains(t.relatedTarget)||(e.classList.remove(`drag-over`),N.classList.remove(`visible`))},b),e.addEventListener(`drop`,t=>{t.dataTransfer?.files?.length&&(t.preventDefault(),e.classList.remove(`drag-over`),N.classList.remove(`visible`),q(t.dataTransfer.files))},b);let de=i(J)||(()=>{});return J(),{open:le,close:$,dispose:ue}}export{d as initExcelToPdfTool};