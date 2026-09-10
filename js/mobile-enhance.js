/* ============================================================
   mobile-enhance.js — 移动端交互增强
   1) 触屏设备上对导航/关闭/主按钮点击给出 8ms 触觉反馈
      （Android Chrome 支持 navigator.vibrate；iOS 静默忽略）
   2) 横竖屏切换时同步 html[data-orientation]，供 CSS 钩子使用
   ============================================================ */
(function () {
  var coarse = false;
  try { coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
  if (coarse && navigator.vibrate) {
    var tap = function (e) {
      var el = e.target.closest('.mobile-tab, .nav-item, .modal-close, .btn, .primary');
      if (el) { try { navigator.vibrate(8); } catch (err) {} }
    };
    document.addEventListener('click', tap, { passive: true });
  }
  function syncOrientation() {
    document.documentElement.dataset.orientation =
      window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }
  syncOrientation();
  window.addEventListener('resize', syncOrientation, { passive: true });
})();