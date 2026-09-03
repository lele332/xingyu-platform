/* ============================================================
   voxcpm-voice.js — AI 语音合成 + 声音克隆
   - 默认使用浏览器 Web Speech API（即开即用，无需 GPU）
   - 可配置本地 VoxCPM 服务（OpenAI 兼容 /v1/audio/speech）
   - 声音克隆板块：音色设计 / 可控克隆 / 极致克隆，自动生成 Python 脚本
   - 供「跑步训练 → AI 教练」报告朗读复用（window.VoxVoice.speak）
   ============================================================ */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, type) { if (window.toast) window.toast(msg, type); }

  const LS_KEY = "xingyu_voxcpm_settings";
  const DEFAULT_VOX_URL = "http://127.0.0.1:8000/v1";

  function getSettings() {
    try {
      return Object.assign(
        { engine: "browser", voxUrl: DEFAULT_VOX_URL, rate: 1, voice: "" },
        JSON.parse(localStorage.getItem(LS_KEY) || "{}")
      );
    } catch (e) { return { engine: "browser", voxUrl: DEFAULT_VOX_URL, rate: 1, voice: "" }; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function browserVoices() {
    return (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  }

  // voiceURI is unique on Chromium/Edge; keep name as a fallback for old saved settings.
  function voiceValue(v) {
    return v.voiceURI || v.name || "";
  }
  function findBrowserVoice(id) {
    if (!id) return null;
    return browserVoices().find(v => voiceValue(v) === id || v.name === id) || null;
  }

  /* ---------- 浏览器 TTS ---------- */
  let _browserUtter = null;
  function browserSpeak(text, rate, onEnd, onError, voiceId) {
    if (!window.speechSynthesis) { onError && onError("当前浏览器不支持语音合成"); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate || 1;
    u.pitch = 1;
    u.lang = "zh-CN";
    // The selected voice takes precedence. Automatic mode falls back to a Chinese voice.
    const picked = findBrowserVoice(voiceId);
    if (picked) {
      u.voice = picked;
      u.voiceURI = picked.voiceURI || picked.name || "";
      if (picked.lang) u.lang = picked.lang;
    }
    if (!u.voice) {
      const zh = browserVoices().filter(v => /zh|cmn|Chinese/i.test(v.lang) || /Chinese/i.test(v.name));
      if (zh.length) u.voice = zh[0];
    }
    u.onend = function () { onEnd && onEnd(); };
    u.onerror = function (e) { onError && onError(e.error || "语音播放失败"); };
    _browserUtter = u;
    speechSynthesis.speak(u);
    return u;
  }
  function browserStop() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    _browserUtter = null;
  }

  /* ---------- 本地 VoxCPM（OpenAI 兼容，走星屿同源代理避免 CORS） ---------- */
  async function voxSpeak(text, rate, onEnd, onError, opts) {
    opts = opts || {};
    const s = getSettings();
    // 走星屿 server.py 的 /vox-proxy 同源代理，绕开浏览器跨域限制
    const base = (location.protocol === "file:" || location.hostname === "")
      ? (s.voxUrl || DEFAULT_VOX_URL)
      : (location.origin + "/vox-proxy/v1");
    try {
      const payload = {
        model: s.voxModel || "VoxCPM2",
        input: text,
        voice: s.voxVoice || "default",
        response_format: "wav"
      };
      // 声音克隆：把参考音频以 data URI 传给 voice（vLLM-Omni 支持）
      if (opts.refB64) payload.voice = "data:audio/wav;base64," + opts.refB64;
      // 极致克隆：参考文本
      if (opts.promptText) payload.prompt_text = opts.promptText;
      const resp = await fetch(base + "/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.text().catch(() => "");
        throw new Error("VoxCPM 返回 " + resp.status + (err ? ": " + err.slice(0, 120) : ""));
      }
      const blob = await resp.blob();
      _lastBlob = blob;
      _lastBlobName = blobFileName(text, resp.headers.get("Content-Type") || blob.type);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = function () { onEnd && onEnd(); };
      audio.onerror = function () { onError && onError("音频播放失败"); };
      await audio.play();
      return audio;
    } catch (e) {
      onError && onError(e.message || "调用本地 VoxCPM 失败");
      return null;
    }
  }
  function voxStop() { }

  /* ---------- VoxCPM 服务检测（经星屿同源代理） ---------- */
  async function checkVoxService() {
    try {
      const direct = location.protocol === "file:" || location.hostname === "";
      const url = direct
        ? (getSettings().voxUrl || DEFAULT_VOX_URL).replace(/\/$/, "") + "/healthz"
        : location.origin + "/vox-proxy/__vox_health__";
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) return false;
      const data = await resp.json().catch(() => ({}));
      return !!(data.online !== undefined ? data.online : (data.status === "ok" && data.gpu_backend_online));
    } catch (e) {
      return false;
    }
  }

  /* ---------- 统一入口 ---------- */
  let _curAudio = null;
  let _lastBlob = null;      // 最近一次 VoxCPM 合成的音频（用于保存）
  let _lastBlobName = "";

  function saveLastAudio() {
    if (!_lastBlob) { toast("还没有可保存的合成音频（先点「▶ 本地合成」）", "err"); return; }
    try {
      const url = URL.createObjectURL(_lastBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = _lastBlobName;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      toast("已保存到浏览器下载文件夹：" + _lastBlobName, "ok");
    } catch (e) {
      toast("保存失败：" + (e.message || e), "err");
    }
  }

  function blobFileName(text, contentType) {
    const ts = new Date();
    const p = ("0" + ts.getHours()).slice(-2) + ("0" + ts.getMinutes()).slice(-2) + ("0" + ts.getSeconds()).slice(-2);
    let prefix = (text || "").replace(/[\\/:*?"<>|\s()（）]/g, "_").slice(0, 16).replace(/_+$/, "");
    const ext = (contentType || "").indexOf("mpeg") >= 0 ? "mp3" : "wav";
    return p + (prefix ? "_" + prefix : "") + "." + ext;
  }
  function speak(text, opts) {
    opts = opts || {};
    const s = getSettings();
    const rate = opts.rate != null ? opts.rate : (s.rate || 1);
    stop();
    if (s.engine === "vox") {
      voxSpeak(text, rate, opts.onEnd, opts.onError).then(a => { _curAudio = a; });
    } else {
      _curAudio = browserSpeak(text, rate, opts.onEnd, opts.onError, s.voice);
    }
    return _curAudio;
  }
  function stop() {
    browserStop();
    if (_curAudio && typeof _curAudio.pause === "function") { try { _curAudio.pause(); } catch (e) {} }
    _curAudio = null;
  }

  /* ---------- 面板渲染 ---------- */
  async function render() {
    const root = document.getElementById("view-voice");
    if (!root) return;
    const s = getSettings();
    const voices = browserVoices();
    const zhVoices = voices.filter(v => /zh|cmn|Chinese/i.test(v.lang) || /Chinese/i.test(v.name));

    root.innerHTML =
      '<div class="vox-wrap">' +
        '<div class="vox-hero">' +
          '<div class="vox-hero-l">' +
            '<div class="vox-brand"><span class="vox-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
              '<span class="vox-brand-text">VoxCPM · AI 语音合成</span></div>' +
            '<h2 class="vox-title">让文字开口说话</h2>' +
            '<p class="vox-sub">浏览器内置语音即开即用；配置本地 VoxCPM 后可启用 30 种语言、音色设计与声音克隆。</p>' +
          '</div>' +
          '<div class="vox-hero-r">' +
            '<div class="vox-stat"><b>' + zhVoices.length + '</b><span>中文语音</span></div>' +
            '<div class="vox-stat"><b>' + voices.length + '</b><span>全部语音</span></div>' +
            '<div class="vox-stat"><b>' + (s.engine === "vox" ? "VoxCPM" : "浏览器") + '</b><span>当前引擎</span></div>' +
            '<div class="vox-stat"><b>30+</b><span>VoxCPM 语言</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="vox-section">' +
          '<h3 class="vox-h3"><span class="vox-num">01</span>输入文本</h3>' +
          '<textarea id="voxText" rows="4" placeholder="输入要合成的文字，支持中英混合。例如：今天也要保持专注，稳步向前。"></textarea>' +
        '</div>' +

        '<div class="vox-section">' +
          '<h3 class="vox-h3"><span class="vox-num">02</span>引擎与参数</h3>' +
          '<div class="vox-controls">' +
            '<div class="vox-field">' +
              '<span class="vox-label">引擎</span>' +
              '<select id="voxEngine">' +
                '<option value="browser"' + (s.engine === "browser" ? " selected" : "") + '>浏览器语音（免配置）</option>' +
                '<option value="vox"' + (s.engine === "vox" ? " selected" : "") + '>本地 VoxCPM（需部署）</option>' +
              '</select>' +
            '</div>' +
            '<div class="vox-field" id="voxUrlField"' + (s.engine === "vox" ? "" : ' style="display:none"') + '>' +
              '<span class="vox-label">VoxCPM 地址</span>' +
              '<input type="text" id="voxUrl" value="' + esc(s.voxUrl || DEFAULT_VOX_URL) + '" placeholder="http://127.0.0.1:8000/v1">' +
            '</div>' +
            '<div class="vox-field">' +
              '<span class="vox-label">语速 <b id="voxRateVal">' + (s.rate || 1) + '×</b></span>' +
              '<input type="range" id="voxRate" min="0.5" max="2" step="0.1" value="' + (s.rate || 1) + '">' +
            '</div>' +
            '<div class="vox-field" id="voxVoiceField">' +
              '<span class="vox-label">音色（选后点「▶ 朗读」生效）</span>' +
              '<select id="voxVoice">' +
                '<option value="">自动（中文优先）</option>' +
                (zhVoices.length ? zhVoices.map(function (v) {
                  const val = voiceValue(v);
                  const selected = s.voice === val || s.voice === v.name ? " selected" : "";
                  return '<option value="' + esc(val) + '"' + selected + '>' + esc(v.name) + '</option>';
                }).join("") : '<option value="" disabled>系统音色加载中…</option>') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="vox-actions">' +
            '<button class="btn btn-primary" id="btnVoxSpeak" type="button">▶ 朗读</button>' +
            '<button class="btn btn-ghost" id="btnVoxStop" type="button">■ 停止</button>' +
            '<button class="btn btn-ghost" id="btnVoxSave" type="button">💾 保存音频</button>' +
            '<span class="vox-hint">提示：想用 VoxCPM 音色设计 / 声音克隆？请先部署本地服务（见 voxcpm/README-星屿.md）</span>' +
          '</div>' +
        '</div>' +

        /* 03 声音克隆 / 音色设计 */
        '<div class="vox-section vox-clone-section">' +
          '<h3 class="vox-h3"><span class="vox-num">03</span>声音克隆 · 音色设计 <span class="vox-tag">VoxCPM2</span>' +
            '<span class="vox-svc" id="voxSvcBadge" data-state="checking">检测中…</span>' +
          '</h3>' +
          '<p class="vox-section-sub">本机已接入 AMD 显卡（VoxCPM.cpp Vulkan）：音色设计约 20~40 秒，参考音频克隆约 5~10 秒。每次合成都保存在 VoxCPM 本地输出目录，也可点「💾 保存音频」下载。</p>' +

          '<div class="vox-mode-chips" id="voxModeChips">' +
            '<button class="vox-chip active" data-mode="design" type="button">' +
              '<span class="vox-chip-ico">🎨</span>' +
              '<span class="vox-chip-body"><b>音色设计</b><em>自然语言描述，凭空创建音色</em></span>' +
            '</button>' +
            '<button class="vox-chip" data-mode="clone" type="button">' +
              '<span class="vox-chip-ico">🎛️</span>' +
              '<span class="vox-chip-body"><b>可控克隆</b><em>参考音频 + 风格指令</em></span>' +
            '</button>' +
            '<button class="vox-chip" data-mode="hifi" type="button">' +
              '<span class="vox-chip-ico">🎙️</span>' +
              '<span class="vox-chip-body"><b>极致克隆</b><em>参考音频 + 文本转录，无缝续写</em></span>' +
            '</button>' +
          '</div>' +

          '<div class="vox-clone-grid">' +
            '<div class="vox-field" id="voxRefField" style="display:none">' +
              '<span class="vox-label">参考音频（16kHz~48kHz WAV，建议 5~15 秒）</span>' +
              '<div class="vox-drop" id="voxRefDrop">' +
                '<input type="file" id="voxRefFile" accept=".wav,.mp3,.m4a,audio/*" style="display:none">' +
                '<span class="vox-drop-ico" id="voxRefIco">🎧</span>' +
                '<span class="vox-drop-text" id="voxRefName">点击选择或拖拽参考音频</span>' +
              '</div>' +
            '</div>' +
            '<div class="vox-field vox-field-wide">' +
              '<span class="vox-label" id="voxCtrlLabel">要合成的文本</span>' +
              '<textarea id="voxCloneText" rows="2" placeholder="输入要克隆/合成的文本内容，支持中英混合。"></textarea>' +
            '</div>' +
            '<div class="vox-field" id="voxDesignField">' +
              '<span class="vox-label">音色描述（自然语言）</span>' +
              '<input type="text" id="voxDesignDesc" placeholder="如：年轻女性，声音温柔甜美" value="年轻女性，声音温柔甜美">' +
            '</div>' +
            '<div class="vox-field vox-field-wide" id="voxPromptTextField" style="display:none">' +
              '<span class="vox-label">参考音频的文本转录（极致克隆必填）</span>' +
              '<input type="text" id="voxPromptText" placeholder="输入参考音频里说话的内容，帮助模型精准续写">' +
            '</div>' +
          '</div>' +

          '<div class="vox-actions">' +
            '<button class="btn btn-primary" id="btnVoxGenScript" type="button">⚡ 生成克隆脚本</button>' +
            '<button class="btn btn-ghost" id="btnVoxCloneLocal" type="button">▶ 本地合成（需 VoxCPM 服务）</button>' +
            '<button class="btn btn-ghost" id="btnVoxCloneSave" type="button">💾 保存音频</button>' +
            '<span class="vox-hint" id="voxCloneHint">脚本将内嵌参考音频 base64，复制后到 voxcpm/ 目录运行：python 克隆脚本.py</span>' +
          '</div>' +
          '<div class="vox-script-out" id="voxScriptOut" style="display:none">' +
            '<div class="vox-script-head">' +
              '<span class="vox-script-tag">生成 Python 脚本</span>' +
              '<button class="text-btn" id="btnVoxCopyScript" type="button">复制脚本</button>' +
            '</div>' +
            '<pre class="vox-script" id="voxScriptPre"></pre>' +
          '</div>' +
          '<div class="vox-status" id="voxCloneStatus" style="margin-top:12px">选择模式 → 填写内容 → 生成脚本。</div>' +
        '</div>' +

        '<div class="vox-section">' +
          '<h3 class="vox-h3"><span class="vox-num">04</span>状态</h3>' +
          '<div class="vox-status" id="voxStatus">就绪。输入文本后点击「朗读」。</div>' +
        '</div>' +
      '</div>';

    const initialVoiceSel = $("#voxVoice");
    if (initialVoiceSel) initialVoiceSel.dataset.count = String(voices.length);
    wire();
  }

  function wire() {
    const engine = $("#voxEngine");
    const urlField = $("#voxUrlField");
    const urlInput = $("#voxUrl");
    const voiceSel = $("#voxVoice");
    const rate = $("#voxRate");
    const rateVal = $("#voxRateVal");
    const status = $("#voxStatus");

    if (engine) {
      engine.onchange = function () {
        const s = getSettings();
        s.engine = engine.value;
        saveSettings(s);
        if (urlField) urlField.style.display = engine.value === "vox" ? "" : "none";
        if (voiceSel) voiceSel.style.display = engine.value === "vox" ? "none" : "";
        if (status) status.textContent = engine.value === "vox"
          ? "本地 VoxCPM 模式：请确保服务已启动并配置正确地址。" : "浏览器模式：即开即用。";
      };
    }
    if (urlInput) {
      urlInput.onchange = function () {
        const s = getSettings();
        s.voxUrl = urlInput.value.trim() || DEFAULT_VOX_URL;
        saveSettings(s);
      };
    }
    if (rate && rateVal) {
      rate.oninput = function () {
        rateVal.textContent = (+rate.value).toFixed(1) + "×";
        const s = getSettings();
        s.rate = +rate.value;
        saveSettings(s);
      };
    }
    if (voiceSel) {
      voiceSel.onchange = function () {
        const s = getSettings();
        s.voice = voiceSel.value;
        saveSettings(s);
        const picked = findBrowserVoice(s.voice);
        if (status) status.textContent = picked ? "已选择音色：" + picked.name : "已恢复自动音色。";
      };
    }
    const speakBtn = $("#btnVoxSpeak");
    if (speakBtn) {
      speakBtn.onclick = function () {
        const text = $("#voxText").value.trim();
        if (!text) { toast("请输入要朗读的文本", "err"); return; }
        if (status) status.textContent = "正在朗读…";
        speak(text, {
          onEnd: function () { if (status) status.textContent = "播放完成。"; },
          onError: function (msg) {
            if (status) status.textContent = "⚠ " + msg;
            toast("语音失败：" + msg, "err");
            // VoxCPM 失败时自动回退浏览器语音
            if (getSettings().engine === "vox") {
              const s = getSettings();
              s.engine = "browser";
              saveSettings(s);
              if (engine) engine.value = "browser";
              if (urlField) urlField.style.display = "none";
              if (voiceSel) voiceSel.style.display = "";
              if (status) status.textContent = "已自动回退到浏览器语音，正在重试…";
              const fallback = getSettings();
              browserSpeak(
                text,
                fallback.rate,
                function () { if (status) status.textContent = "播放完成。"; },
                function (err) { if (status) status.textContent = "⚠ 浏览器语音回退失败：" + err; },
                fallback.voice
              );
            }
          }
        });
      };
    }
    const stopBtn = $("#btnVoxStop");
    if (stopBtn) stopBtn.onclick = function () {
      stop();
      if (status) status.textContent = "已停止。";
    };

    const saveBtn = $("#btnVoxSave");
    if (saveBtn) saveBtn.onclick = function () { saveLastAudio(); };
    const cloneSaveBtn = $("#btnVoxCloneSave");
    if (cloneSaveBtn) cloneSaveBtn.onclick = function () { saveLastAudio(); };

    // 切到视图时刷新语音列表。Chromium 可能异步返回系统音色，这里只更新下拉框。
    if (window.speechSynthesis) {
      const refreshVoiceSel = function () {
        if (!voiceSel) return;
        const s = getSettings();
        const voices = browserVoices();
        const zh = voices.filter(v => /zh|cmn|Chinese/i.test(v.lang) || /Chinese/i.test(v.name));
        if (!zh.length) return;
        const previous = voiceSel.value;
        voiceSel.dataset.count = String(voices.length);
        voiceSel.innerHTML =
          '<option value="">自动（中文优先）</option>' +
          zh.map(function (v) {
            const val = voiceValue(v);
            const selected = s.voice === val || s.voice === v.name ? " selected" : "";
            return '<option value="' + esc(val) + '"' + selected + '>' + esc(v.name) + '</option>';
          }).join("");
        voiceSel.value = previous && Array.prototype.some.call(voiceSel.options, function (o) { return o.value === previous; })
          ? previous
          : (s.voice || "");
      };
      speechSynthesis.onvoiceschanged = refreshVoiceSel;
      [150, 450, 1000, 1800, 3000].forEach(delay => setTimeout(refreshVoiceSel, delay));
    }

    /* ================= 声音克隆板块 ================= */
    // VoxCPM.cpp reference registration is most reliable with mono 16 kHz WAV.
    // Convert browser-decodable mp3/m4a/wav in the page before uploading.
    function encodeWav(buffer) {
      const channels = buffer.getChannelData(0);
      const bytes = new Uint8Array(44 + channels.length * 2);
      const view = new DataView(bytes.buffer);
      const writeText = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
      writeText(0, "RIFF"); view.setUint32(4, 36 + channels.length * 2, true); writeText(8, "WAVE");
      writeText(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 2, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeText(36, "data");
      view.setUint32(40, channels.length * 2, true);
      let o = 44;
      for (let i = 0; i < channels.length; i++, o += 2) {
        const v = Math.max(-1, Math.min(1, channels[i]));
        view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      }
      return bytes;
    }
    function arrayBufferToBase64(bytes) {
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }
    async function readReferenceAsWav(file) {
      // OfflineAudioContext decodes MP3/M4A reliably even before a user gesture.
      const decodeContext = new OfflineAudioContext(1, 1, 16000);
      const decoded = await decodeContext.decodeAudioData(await file.arrayBuffer());
      const maxSeconds = 20;
      const sampleRate = 16000;
      const duration = Math.min(decoded.duration, maxSeconds);
      const frames = Math.max(1, Math.floor(duration * sampleRate));
      const offline = new OfflineAudioContext(1, frames, sampleRate);
      const src = offline.createBufferSource();
      src.buffer = decoded;
      src.connect(offline.destination);
      src.start();
      return { bytes: encodeWav(await offline.startRendering()), duration, originalDuration: decoded.duration };
    }

    let _refB64 = "";
    let _refName = "";
    const cloneStatus = $("#voxCloneStatus");
    const scriptOut = $("#voxScriptOut");
    const scriptPre = $("#voxScriptPre");
    const refField = $("#voxRefField");
    const designField = $("#voxDesignField");
    const promptTextField = $("#voxPromptTextField");
    const ctrlLabel = $("#voxCtrlLabel");
    const refDrop = $("#voxRefDrop");
    const refName = $("#voxRefName");
    const refIco = $("#voxRefIco");
    let cloneBusy = false;

    // 模式切换
    $$("#voxModeChips .vox-chip").forEach(function (chip) {
      chip.onclick = function () {
        $$("#voxModeChips .vox-chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        const mode = chip.dataset.mode;
        const needRef = mode === "clone" || mode === "hifi";
        if (refField) refField.style.display = needRef ? "" : "none";
        if (promptTextField) promptTextField.style.display = mode === "hifi" ? "" : "none";
        if (designField) designField.style.display = mode === "design" ? "" : "none";
        if (ctrlLabel) ctrlLabel.textContent = mode === "design" ? "要合成的文本" : "要克隆合成的文本";
        if (cloneStatus) {
          if (mode === "design") cloneStatus.textContent = "🎨 音色设计：填写音色描述与文本，无需参考音频。";
          else if (mode === "clone") cloneStatus.textContent = "🎛️ 可控克隆：上传参考音频（建议 5~15 秒 WAV），可选风格指令。";
          else cloneStatus.textContent = "🎙️ 极致克隆：上传参考音频 + 填写其文本转录，模型无缝续写。";
        }
      };
    });

    // 参考音频选择 / 拖拽 → base64
    const refFile = $("#voxRefFile");
    function readRefFile(file) {
      if (!file) return;
      _refB64 = "";
      _refName = file.name;
      if (refName) refName.textContent = "正在转换 " + file.name + " …";
      if (refIco) refIco.textContent = "⏳";
      if (cloneStatus) cloneStatus.textContent = "正在把参考音频转换为 16kHz 单声道 WAV…";
      readReferenceAsWav(file).then(function (out) {
        _refB64 = arrayBufferToBase64(out.bytes);
        const trimmed = out.originalDuration > out.duration + 0.05;
        if (refName) refName.textContent = "✓ " + file.name + "（已转换 " + out.duration.toFixed(1) + " 秒 WAV）";
        if (refIco) refIco.textContent = "✅";
        if (cloneStatus) cloneStatus.textContent = trimmed
          ? "✓ 参考音频已转换；为保证克隆稳定已截取前 20 秒。"
          : "✓ 参考音频已转换，可点「▶ 本地合成」。";
      }).catch(function (e) {
        if (refName) refName.textContent = "⚠ " + file.name + " 无法解码";
        if (refIco) refIco.textContent = "❌";
        if (cloneStatus) cloneStatus.textContent = "⚠ 参考音频解码失败：" + (e && e.message ? e.message : e) + "。请改用浏览器可播放的 WAV/MP3/M4A。";
      });
    }
    if (refFile) refFile.onchange = function () { readRefFile(refFile.files[0]); };
    if (refDrop) {
      refDrop.onclick = function () { if (refFile) refFile.click(); };
      refDrop.ondragover = function (e) { e.preventDefault(); refDrop.classList.add("drag"); };
      refDrop.ondragleave = function () { refDrop.classList.remove("drag"); };
      refDrop.ondrop = function (e) {
        e.preventDefault();
        refDrop.classList.remove("drag");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) readRefFile(e.dataTransfer.files[0]);
      };
    }

    // 生成克隆脚本
    const genScriptBtn = $("#btnVoxGenScript");
    if (genScriptBtn) {
      genScriptBtn.onclick = function () {
        const mode = currentCloneMode();
        const text = ($("#voxCloneText").value || "").trim();
        const designDesc = ($("#voxDesignDesc").value || "").trim();
        const promptText = ($("#voxPromptText").value || "").trim();
        if (!text) { toast("请填写要合成的文本", "err"); return; }
        if ((mode === "clone" || mode === "hifi") && !_refB64) { toast("请先上传参考音频", "err"); return; }
        if (mode === "hifi" && !promptText) { toast("极致克隆需要填写参考音频的文本转录", "err"); return; }

        const script = buildCloneScript(mode, text, designDesc, promptText, _refB64, _refName);
        if (scriptPre) scriptPre.textContent = script;
        if (scriptOut) scriptOut.style.display = "";
        if (cloneStatus) cloneStatus.textContent = "✅ 脚本已生成，复制后到项目 voxcpm/ 目录运行：python 克隆脚本.py";
        toast("克隆脚本已生成", "ok");
        scriptOut.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
    }

    // 复制脚本
    const copyScriptBtn = $("#btnVoxCopyScript");
    if (copyScriptBtn) {
      copyScriptBtn.onclick = function () {
        const code = scriptPre ? scriptPre.textContent : "";
        if (!code) { toast("暂无脚本可复制", "err"); return; }
        try {
          navigator.clipboard.writeText(code).then(function () { toast("脚本已复制", "ok"); });
        } catch (e) { toast("复制失败", "err"); }
      };
    }

    // 本地合成（调用本地 VoxCPM OpenAI 兼容接口）
    const cloneLocalBtn = $("#btnVoxCloneLocal");
    const svcBadge = $("#voxSvcBadge");
    if (cloneLocalBtn) {
      cloneLocalBtn.onclick = function () {
        if (cloneBusy) return;
        const mode = currentCloneMode();
        const text = ($("#voxCloneText").value || "").trim();
        if (!text) { toast("请填写要合成的文本", "err"); return; }
        if ((mode === "clone" || mode === "hifi") && !_refB64) { toast("请先上传并等待参考音频转换完成", "err"); return; }

        cloneBusy = true;
        cloneLocalBtn.disabled = true;
        cloneLocalBtn.textContent = "检测服务…";
        const resetButton = function () {
          cloneBusy = false;
          cloneLocalBtn.disabled = false;
          cloneLocalBtn.textContent = "▶ 本地合成（需 VoxCPM 服务）";
        };
        const promptText = mode === "hifi" ? ($("#voxPromptText").value || "").trim() : "";
        const designDesc = mode === "design" ? ($("#voxDesignDesc").value || "").trim() : "";
        const control = mode === "design" ? designDesc : "";
        const finalText = control ? "(" + control + ")" + text : text;
        if (cloneStatus) cloneStatus.textContent = "正在检测 AMD VoxCPM 推理服务…";
        checkVoxService().then(function (online) {
          if (!online) {
            if (cloneStatus) cloneStatus.textContent = "⚠ 本地 VoxCPM 推理服务未就绪（8000 适配层或 8001 AMD 推理层未启动）。请关闭星屿后重新双击桌面「星屿」；我也会自动拉起这两层服务。";
            toast("本地 VoxCPM 推理服务未就绪", "err");
            if (svcBadge) { svcBadge.dataset.state = "off"; svcBadge.textContent = "推理服务未就绪"; }
            resetButton();
            return;
          }
          if (cloneStatus) cloneStatus.textContent = "正在请求 AMD 显卡本地合成… 首次约 20~40 秒，之后约 5~10 秒，请不要重复点击。";
          cloneLocalBtn.textContent = "合成中…";
          voxSpeak(finalText, 1, function () {
            if (cloneStatus) cloneStatus.textContent = "✅ 合成完成，已播放。";
          }, function (msg) {
            if (cloneStatus) cloneStatus.textContent = "⚠ " + msg + "（AMD 推理服务已在线；如仍失败请换 5~15 秒清晰参考音频）";
          }, {
            refB64: (mode === "clone" || mode === "hifi") ? _refB64 : "",
            promptText: promptText
          }).catch(function () {}).finally(resetButton);
        }).catch(function () {
          if (cloneStatus) cloneStatus.textContent = "⚠ 无法连接本地 VoxCPM 服务。";
          resetButton();
        });
      };
    }

    // 页面加载时自动检测 VoxCPM 服务状态
    if (svcBadge) {
      checkVoxService().then(function (online) {
        svcBadge.dataset.state = online ? "on" : "off";
        svcBadge.textContent = online ? "VoxCPM 服务在线 ✓" : "服务未连接";
        if (cloneStatus && online) cloneStatus.textContent = "本地 VoxCPM 服务在线，可直接「▶ 本地合成」。";
      });
    }
  }

  /* 当前克隆模式 */
  function currentCloneMode() {
    var active = $("#voxModeChips .vox-chip.active");
    return (active && active.dataset && active.dataset.mode) ? active.dataset.mode : "design";
  }

  /* ---------- 生成 Python 克隆脚本 ---------- */
  function buildCloneScript(mode, text, designDesc, promptText, refB64, refName) {
    var lines = [];
    lines.push("# -*- coding: utf-8 -*-");
    lines.push("# 星屿 · VoxCPM 声音克隆脚本（自动生成）");
    lines.push("# 运行环境：Python 3.10~3.12 + PyTorch ≥2.5 + CUDA ≥12（有 GPU 更佳）");
    lines.push("# 使用方式：cd voxcpm && pip install -e . && python 克隆脚本.py");
    lines.push("import base64, os, tempfile");
    lines.push("import soundfile as sf");
    lines.push("from voxcpm import VoxCPM");
    lines.push("");
    lines.push("# 1) 加载模型（首次会自动下载权重 openbmb/VoxCPM2，约数 GB）");
    lines.push("model = VoxCPM.from_pretrained(\"openbmb/VoxCPM2\")");
    lines.push("");
    if (refB64) {
      lines.push("# 2) 参考音频（已内嵌 base64，自动解码为临时 wav）");
      lines.push("REF_B64 = \"" + refB64 + "\"");
      lines.push("ref_path = os.path.join(tempfile.gettempdir(), \"vox_ref_" + Date.now() + ".wav\")");
      lines.push("with open(ref_path, \"wb\") as f:");
      lines.push("    f.write(base64.b64decode(REF_B64))");
      lines.push("print(\"参考音频已解码:\", ref_path, \"" + (refName || "reference.wav") + "\")");
      lines.push("");
    }
    lines.push("# 3) 合成");
    if (mode === "design") {
      // 音色设计：把音色描述拼进 text 头部 (描述)文本
      var finalText = designDesc ? "(" + designDesc + ")" + text : text;
      lines.push("wav = model.generate(");
      lines.push("    text=" + JSON.stringify(finalText) + ",");
      lines.push("    cfg_value=2.0,");
      lines.push("    inference_timesteps=10,");
      lines.push("    seed=42,");
      lines.push(")");
    } else if (mode === "clone") {
      lines.push("wav = model.generate(");
      lines.push("    text=" + JSON.stringify(text) + ",");
      lines.push("    reference_wav_path=ref_path,  # 可控克隆：克隆音色");
      lines.push("    cfg_value=2.0,");
      lines.push("    inference_timesteps=10,");
      lines.push("    seed=42,");
      lines.push(")");
    } else {
      // hifi 极致克隆
      lines.push("wav = model.generate(");
      lines.push("    text=" + JSON.stringify(text) + ",");
      lines.push("    prompt_wav_path=ref_path,     # 续写起点");
      lines.push("    prompt_text=" + JSON.stringify(promptText) + ",");
      lines.push("    reference_wav_path=ref_path,   # 提升相似度");
      lines.push("    cfg_value=2.0,");
      lines.push("    inference_timesteps=10,");
      lines.push("    seed=42,");
      lines.push(")");
    }
    lines.push("");
    lines.push("# 4) 保存");
    lines.push("out = \"clone_output.wav\"");
    lines.push("sf.write(out, wav, model.tts_model.sample_rate)");
    lines.push("print(\"✅ 已生成:\", out, \"采样率:\", model.tts_model.sample_rate)");
    return lines.join("\n");
  }

  window.VoxVoice = {
    render: render,
    speak: speak,
    stop: stop,
    browserSpeak: browserSpeak,
    getSettings: getSettings
  };
})();


