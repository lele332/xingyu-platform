/* ============================================================
   motivation.js — 励志语录音频播放器
   音频位于 assets/motivational/，供番茄钟 / 主界面 / 沉浸式场景复用
   ============================================================ */
var MOTIVATION_TRACKS = [
  { file: 'leijun-dare.mp3', title: '雷军：敢想敢干最重要，先干了再说', speaker: '雷军', subtitle: '敢想敢干最重要，先干了再说。不要等一切准备就绪，机会往往稍纵即逝。迈出第一步，你会发现路其实没有那么难。' },
  { file: 'leijun-effort.mp3', title: '雷军：努力不是万能的，千万别钻牛角尖', speaker: '雷军', subtitle: '努力不是万能的，千万别钻牛角尖。方向对了，努力才有意义。学会停下来想一想，比盲目向前更重要。' },
  { file: 'leijun-voice.m4a', title: '雷军：语音（语音分享）', speaker: '雷军', subtitle: '雷军：人生没有白走的路，每一步都算数。坚持你所热爱的，相信时间的力量。' },
  { file: 'quote-crying.mp3', title: '哭着考完的往往是笑着上岸的', speaker: '励志语录', subtitle: '哭着考完的，往往是笑着上岸的。那些看似熬不过去的日子，终会化作你前进的勇气。别怕，一步一步往前走就好。' },
  { file: 'quote-failure.mp3', title: '没有任何人喜欢挫折和失败', speaker: '励志语录', subtitle: '没有任何人喜欢挫折和失败，但正是这些经历，才让你一点点变强。跌倒了，拍拍土，再出发。' },
  { file: 'quote-helmet.mp3', title: '这个世界上最好的贵人，是自己', speaker: '励志语录', subtitle: '这个世界上最好的贵人，是你自己。与其把希望寄托在别人身上，不如让自己成为最可靠的后盾。' },
  { file: 'quote-humanity.mp3', title: '这就是人类奇妙的地方', speaker: '励志语录', subtitle: '这就是人类奇妙的地方，明明那么脆弱，却总能在一次次跌倒之后重新站起，爆发出惊人的力量。' },
  { file: 'quote-mindset.mp3', title: '心态是最好的风水', speaker: '励志语录', subtitle: '心态是最好的风水。心里有光，眼里就有希望；心里有海，路就会越走越宽。' },
  { file: 'quote-perseverance.mp3', title: '你是一个有毅力的人', speaker: '励志语录', subtitle: '你是一个有毅力的人，认准的事情就一定坚持到底。慢一点没关系，重要的是从来没有停下来。' },
  { file: 'quote-win.mp3', title: '赢万难，迎万难', speaker: '励志语录', subtitle: '赢万难，迎万难。困难不会因为你害怕而消失，勇敢迎上去，一个一个跨过，你终会赢得属于你的胜利。' },
  { file: 'quote-worthiness.mp3', title: '世上总有一些美好值得我们全力以赴', speaker: '励志语录', subtitle: '世上总有一些美好，值得我们全力以赴。为了更好的自己，为了那些值得的人和事，去拼、去闯、去成为光。' }
];
var MOTIVATION_BASE = 'assets/motivational/';

(function () {
  var audio = null;
  var idx = 0;

  function current() { return MOTIVATION_TRACKS[idx]; }
  function ensure() {
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('ended', function () { next(true); });
    }
    return audio;
  }
  function playIndex(i, autoplay) {
    idx = ((i % MOTIVATION_TRACKS.length) + MOTIVATION_TRACKS.length) % MOTIVATION_TRACKS.length;
    var a = ensure();
    a.src = MOTIVATION_BASE + current().file;
    if (autoplay !== false) { var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); }
    emit();
  }
  function toggle() {
    var a = ensure();
    if (a.paused) {
      if (!a.src) { playIndex(idx); return; }
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); 
    } else { a.pause(); }
    emit();
  }
  function next(autoplay) { playIndex(idx + 1, autoplay); }
  function prev(autoplay) { playIndex(idx - 1, autoplay); }
  function stop() { if (audio) { audio.pause(); audio.src = ''; } emit(); }
  function state() {
    return { playing: !!audio && !audio.paused && audio.src !== '', track: current(), idx: idx };
  }
  function emit() {
    try { document.dispatchEvent(new CustomEvent('xingyu-motivation', { detail: state() })); } catch (e) {}
  }

  /* ---- 番茄钟音频实时字幕 ---- */
  var subTimer = null;
  function escTxt(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function showPomoSubtitle(text) {
    var sub = document.getElementById('pomoSubtitle');
    if (!sub) return;
    if (subTimer) { cancelAnimationFrame(subTimer); subTimer = null; }
    sub.classList.add('on');
    sub.classList.add('live');
    showDragHint();
    var chars = text.split('');
    function frame() {
      var a = audio;
      var dur = (a && a.duration && isFinite(a.duration)) ? a.duration : 0;
      var ct = (a && a.currentTime) || 0;
      var shown;
      if (dur > 0) {
        var ratio = Math.min(1, Math.max(0, ct / dur));
        shown = chars.slice(0, Math.max(1, Math.floor(ratio * chars.length))).join('');
      } else {
        shown = text;
      }
      sub.innerHTML = '<span class="live-dot"></span>' + escTxt(shown);
      subTimer = requestAnimationFrame(frame);
    }
    subTimer = requestAnimationFrame(frame);
  }
  function hidePomoSubtitle() {
    if (subTimer) { cancelAnimationFrame(subTimer); subTimer = null; }
    var sub = document.getElementById('pomoSubtitle');
    if (sub) { sub.classList.remove('on'); sub.classList.remove('live'); sub.textContent = ''; }
  }

  /* ---- 首次播放时提示字幕可拖动 ---- */
  function showDragHint() {
    var sub = document.getElementById('pomoSubtitle');
    if (!sub) return;
    try { if (localStorage.getItem('pomo_sub_hint_shown')) return; } catch (e) {}
    var hint = document.createElement('div');
    hint.className = 'pomo-sub-hint';
    hint.textContent = '⠿ 按住可拖动字幕位置';
    document.body.appendChild(hint);
    var r = sub.getBoundingClientRect();
    hint.style.left = Math.max(8, r.left + r.width / 2 - 66) + 'px';
    hint.style.top = Math.max(8, r.top - 36) + 'px';
    requestAnimationFrame(function () { hint.classList.add('show'); });
    setTimeout(function () { hint.classList.remove('show'); setTimeout(function () { hint.remove(); }, 400); }, 2800);
    try { localStorage.setItem('pomo_sub_hint_shown', '1'); } catch (e) {}
  }

  /* ---- 字幕条可拖拽移动（保存位置，默认底部居中） ---- */
  function makeSubtitleDraggable() {
    var sub = document.getElementById('pomoSubtitle');
    if (!sub || sub.dataset.drag) return;
    sub.dataset.drag = '1';
    // 移到 body 下：避免祖先 transform 让 position:fixed 错位（否则会遮挡/位置异常）
    if (sub.parentNode && sub.parentNode !== document.body) document.body.appendChild(sub);
    function defaults() {
      var w = sub.offsetWidth || 320, h = sub.offsetHeight || 56;
      var x = Math.max(8, Math.round((window.innerWidth - w) / 2));
      var y = Math.max(8, window.innerHeight - h - 56);
      return { x: x, y: y };
    }
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('pomo_subtitle_pos') || 'null'); } catch (e) {}
    var p = saved && typeof saved.x === 'number' ? { x: saved.x, y: saved.y } : defaults();
    sub.style.left = p.x + 'px';
    sub.style.top = p.y + 'px';
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    sub.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      if (sub.setPointerCapture) sub.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(sub.style.left) || 0;
      oy = parseFloat(sub.style.top) || 0;
      sub.classList.add('dragging');
      e.preventDefault();
    });
    sub.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var nx = ox + (e.clientX - sx);
      var ny = oy + (e.clientY - sy);
      nx = Math.max(0, Math.min(window.innerWidth - sub.offsetWidth, nx));
      ny = Math.max(0, Math.min(window.innerHeight - sub.offsetHeight, ny));
      sub.style.left = nx + 'px';
      sub.style.top = ny + 'px';
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      sub.classList.remove('dragging');
      try {
        localStorage.setItem('pomo_subtitle_pos', JSON.stringify({ x: parseFloat(sub.style.left) || 0, y: parseFloat(sub.style.top) || 0 }));
      } catch (e) {}
    }
    sub.addEventListener('pointerup', endDrag);
    sub.addEventListener('pointercancel', endDrag);
  }

  /* ---- 主界面（番茄钟卡片）UI 接线 ---- */
  function initUI() {
    makeSubtitleDraggable();
    // 按钮用事件委托，元素每次实时查询，避免视图切换后引用旧节点
    function bind(selector, fn) {
      document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest ? e.target.closest(selector) : null;
        if (t) fn();
      });
    }
    bind('#btnMotivationToggle', toggle);
    bind('#btnQuoteMotivation', toggle);
    bind('#btnMotivationPrev', function () { prev(); });
    bind('#btnMotivationNext', function () { next(); });
    document.addEventListener('xingyu-motivation', function (e) {
      var st = e.detail;
      var title = document.getElementById('motivationTitle');
      var toggleBtn = document.getElementById('btnMotivationToggle');
      var quoteBtn = document.getElementById('btnQuoteMotivation');
      if (title && st.track) title.textContent = st.track.title;
      if (toggleBtn) toggleBtn.textContent = st.playing ? '\u6682\u505c' : '\u64ad\u653e';
      if (quoteBtn) quoteBtn.textContent = st.playing ? '\u23f8 \u6682\u505c\u52b1\u5fd7' : '\u25b6 \u64ad\u653e\u52b1\u5fd7';
      if (st.playing && st.track) { showPomoSubtitle(st.track.subtitle || st.track.title); } else { hidePomoSubtitle(); }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  window.MOTIVATION_TRACKS = MOTIVATION_TRACKS;
  window.MOTIVATION_BASE = MOTIVATION_BASE;
  window.Motivation = { playIndex: playIndex, toggle: toggle, next: next, prev: prev, stop: stop, current: current, state: state, tracks: MOTIVATION_TRACKS };
})();