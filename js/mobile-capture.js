/* ============================================================
   mobile-capture.js — 手机端“拍照上传”适配
   背景：课表/成绩单/笔记的截图 OCR 导入，桌面靠 Ctrl+V 粘贴，
   手机上这条路走不通。本脚本在触屏设备上为三个图片导入入口
   注入“拍照上传”按钮：调用系统相机拍摄后，经 DataTransfer 把
   文件回写到原 input.files，完全复用现有识别流程。
   仅触屏设备生效，桌面端零影响。
   ============================================================ */
(function () {
  var isTouch = false;
  try { isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) {}

  if (!isTouch) return;
  if (typeof DataTransfer === 'undefined') return;

  var TARGETS = [
    { id: 'scheduleImgFile', label: '拍照上传课表' },
    { id: 'gradesImgFile',   label: '拍照上传成绩单' },
    { id: 'notesImgFile',    label: '拍照上传笔记' }
  ];

  function inject(t) {
    var orig = document.getElementById(t.id);
    if (!orig || orig.dataset.captureReady) return;
    orig.dataset.captureReady = '1';

    var cam = document.createElement('input');
    cam.type = 'file';
    cam.accept = 'image/*';
    cam.setAttribute('capture', 'environment');
    cam.style.display = 'none';
    cam.setAttribute('aria-label', t.label);
    orig.parentNode.insertBefore(cam, orig.nextSibling);

    cam.addEventListener('change', function () {
      var f = cam.files && cam.files[0];
      if (!f) return;
      try {
        var dt = new DataTransfer();
        dt.items.add(f);
        orig.files = dt.files;
        orig.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        alert('当前浏览器不支持拍照导入，请改用“上传截图”从相册选择');
      }
      cam.value = '';
    });

    var zone = orig.closest('.drop-zone') || orig.parentElement;
    if (!zone) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mobile-capture-btn';
    btn.innerHTML = '📷 ' + t.label;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      cam.click();
    });
    zone.appendChild(btn);
  }

  function boot() { TARGETS.forEach(inject); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();