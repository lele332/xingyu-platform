function e({tag:e,title:t,closeAttr:n}){return`<header class="pdf-merge-v2-topbar tool-page-v2-topbar" data-tauri-drag-region>
    <div class="pdf-merge-v2-topbar-left tool-page-v2-topbar-left">
      <button class="settings-v2-back settings-back pdf-merge-v2-back tool-page-v2-back" type="button" ${n||`data-tool-close`} data-tool-close><i data-lucide="arrow-left"></i><span>返回</span></button>
      <span class="pdf-merge-v2-top-tag tool-page-v2-tag">${e}</span>
    </div>
    <div class="home-v2-top-actions pdf-merge-v2-top-actions tool-page-v2-top-actions">
      <button class="home-v2-nav-link tool-page-v2-nav-link" type="button" data-tool-website><i data-lucide="globe-2"></i><span>网页版本</span></button>
      <button class="home-v2-support-top tool-page-v2-support" type="button" data-tool-support><i data-lucide="heart"></i><span>支持作者</span></button>
      <div class="home-v2-window-cluster" aria-label="窗口与设置">
        <button class="home-v2-icon-button tool-page-v2-icon" type="button" data-tool-settings title="设置" aria-label="设置"><i data-lucide="settings"></i></button>
        <div class="home-v2-window-controls tool-page-v2-window-controls" aria-label="窗口控制">
          <button class="home-v2-window-button tool-page-v2-icon" type="button" data-tool-window="minimize" title="最小化" aria-label="最小化"><i data-lucide="minus"></i></button>
          <button class="home-v2-window-button tool-page-v2-icon" type="button" data-tool-window="maximize" title="最大化" aria-label="最大化"><i data-lucide="square"></i></button>
          <button class="home-v2-window-button tool-page-v2-icon" type="button" data-tool-window="close" title="关闭" aria-label="关闭"><i data-lucide="x"></i></button>
        </div>
      </div>
    </div>
    <span class="tool-page-v2-title" aria-hidden="true">${t}</span>
  </header>`}function t(e){let t=document.querySelector(e);t&&t.click()}function n(e,n){let r=e=>{if(e.target.closest(`[data-tool-close]`)){e.preventDefault(),n?.();return}if(e.target.closest(`[data-tool-website]`)){e.preventDefault(),t(`[data-home-link="website"]`);return}if(e.target.closest(`[data-tool-support]`)){e.preventDefault(),t(`[data-open-support]`);return}if(e.target.closest(`[data-tool-settings]`)){e.preventDefault(),t(`#settingsBtn`);return}let r=e.target.closest(`[data-tool-window]`);r&&(e.preventDefault(),t(`.global-window-controls [data-action="${r.dataset.toolWindow}"]`))};return e.addEventListener(`click`,r),()=>e.removeEventListener(`click`,r)}function r(e){if(!e)return()=>{};let t=document.createElement(`div`);t.className=`tool-page-v2-bg`,t.setAttribute(`aria-hidden`,`true`),e.prepend(t);let n=window.toolknitToolBackground?.mount?.(t);return()=>{try{n?.()}catch{}t.remove()}}export{r as n,e as r,n as t};