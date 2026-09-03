/* ============================================================
   星屿 · 语音智能体（Voice Agent）
   说话 → Web Speech API 转文字 → DeepSeek Function Calling 决定动作
   → 本地执行工具真正操控平台 → 结果回传 → VoxCPM 语音播报

   全局：window.VoiceAgent
     .toggle()          打开/关闭面板
     .listen()          开始聆听
     .stop()            停止一切
     .run(text)         直接用文字跑一轮（调试用）
     .setSpeak(bool)    是否语音播报
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 平台能力的安全包装（Store 是词法全局，非 window.Store） ---------- */
  function S() {
    try { return (typeof Store !== 'undefined' && Store.add) ? Store : null; }
    catch (e) { return null; }
  }
  var NICE_VOICE_RE = /xiaoxiao|\u6653\u6653|xiaoyi|\u6653\u4f0a|yunxi|\u4e91\u5e0c|huihui|\u6653\u6167|yaoyao|\u6653\u7476|xiaoxuan|\u6653\u8431/i;
  function pickNiceVoice() {
    try {
      var vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      var zh = vs.filter(function (v) {
        return /zh|cmn|Chinese/i.test(v.lang || '') || /Chinese|\u4e2d\u6587/i.test(v.name || '');
      });
      if (!zh.length) return null;
      var natural = zh.filter(function (v) { return /natural|\u5728\u7ebf/i.test(v.name || ''); });
      var pool = natural.length ? natural : zh;
      for (var i = 0; i < pool.length; i++) if (NICE_VOICE_RE.test(pool[i].name || '')) return pool[i];
      return pool[0];
    } catch (e) { return null; }
  }

  /* 声音策略：① edge-tts 晓晓Neural（微软神经语音，自然优美，经 /vox-proxy 秒出）
     ② 用户在 VoxCPM 面板配置的引擎  ③ 浏览器内置语音（最终兜底） */
  var AGENT_VOICE = 'zh-CN-XiaoxiaoNeural';
  var _agentAudio = null, _voiceToken = 0, _speaking = false, _speakAbort = null;

  // 合成超时：VoxCPM 单推理，旧请求不取消会占住引擎，新请求可能排队很久。
  // 没有超时的话用户会干等服务端代理的 360s 上限 —— 感知就是「没声音」。
  var SPEAK_FETCH_TIMEOUT = 30000;

  function stopAgentAudio() {
    // ⚠️ 不仅要停播放，还要 abort 在途的合成 fetch：
    // 否则 VoxCPM（单推理）还在合成上一句，下一句请求会被排队卡住，
    // 用户「关掉再马上打开」就再也没声音（2026-09-04 用户报障真根因）。
    try { if (_speakAbort) { _speakAbort.abort(); } } catch (e) {}
    _speakAbort = null;
    try { if (_agentAudio) { _agentAudio.pause(); _agentAudio.src = ''; _agentAudio = null; } } catch (e) {}
  }

  function agentSpeak(text, token) {
    if (location.protocol === 'file:') return Promise.resolve(false);
    var ctrl = new AbortController();
    _speakAbort = ctrl;
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, SPEAK_FETCH_TIMEOUT);
    return fetch(location.origin + '/vox-proxy/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: String(text), voice: AGENT_VOICE }),
      signal: ctrl.signal
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (blob) {
      clearTimeout(timer);
      if (_speakAbort === ctrl) _speakAbort = null;
      return new Promise(function (resolve, reject) {
        if (token !== _voiceToken) { resolve(false); return; }
        var url = URL.createObjectURL(blob);
        var a = new Audio(url);
        _agentAudio = a;
        a.onended = function () {
          if (_agentAudio === a) _agentAudio = null;
          URL.revokeObjectURL(url);
          if (token === _voiceToken) { _speaking = false; try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('idle'); } catch (e) {} }
        };
        a.onerror = function () {
          if (_agentAudio === a) _agentAudio = null;
          URL.revokeObjectURL(url);
          // 音频Element出错也要复位播报状态，否则 UI 永远停在「播报中」
          if (token === _voiceToken) { _speaking = false; try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('idle'); } catch (e) {} }
          reject(new Error('播放失败'));
        };
        a.play().then(function () { resolve(true); }).catch(reject);
      });
    }).catch(function (e) {
      clearTimeout(timer);
      if (_speakAbort === ctrl) _speakAbort = null;
      // abort（被新播报/停止打断）不算失败，静默让位；其余错误走兜底链
      if (e && e.name === 'AbortError') return false;
      return false;
    });
  }

  function speak(text, rate) {
    text = cleanAgentText(text, true);
    if (!text || !String(text).trim()) return false;
    _voiceToken++;
    var token = _voiceToken;
    _speaking = true;
    try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('speaking'); } catch (e) {}
    stopAgentAudio();
    try { if (window.VoxVoice && window.VoxVoice.stop) window.VoxVoice.stop(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    agentSpeak(text, token).then(function (ok) {
      if (token !== _voiceToken || ok) return;
      try {
        if (window.VoxVoice && window.VoxVoice.speak) {
          window.VoxVoice.speak(String(text), {
            rate: rate || 1.05,
            onEnd: function () { if (token === _voiceToken) { _speaking = false; try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('idle'); } catch (e) {} } },
            onError: function () { if (token === _voiceToken) { _speaking = false; try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('idle'); } catch (e) {} } }
          });
          return;
        }
      } catch (e) {}
      try {
        if (window.speechSynthesis) {
          var u = new SpeechSynthesisUtterance(String(text));
          u.lang = 'zh-CN'; u.rate = rate || 1.05;
          var vv = pickNiceVoice();
          if (vv) { u.voice = vv; u.voiceURI = vv.voiceURI || vv.name || ''; if (vv.lang) u.lang = vv.lang; }
          u.onend = function () { if (token === _voiceToken) { _speaking = false; try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('idle'); } catch (e) {} } };
          u.onerror = function () { if (token === _voiceToken) { _speaking = false; try { if (window.VoiceAgent && window.VoiceAgent._uiState) window.VoiceAgent._uiState('idle'); } catch (e) {} } };
          window.speechSynthesis.speak(u);
        } else { _speaking = false; }
      } catch (e) { _speaking = false; }
    });
    return true;
  }
  function isSpeaking() { return _speaking; }
  function cleanAgentText(text, forSpeech) {
    var t=String(text||'');
    t=t.replace(/```[\s\S]*?(```|$)/g,function(_,end){ return end ? '（代码已省略）' : ''; });
    t=t.replace(/^\s{0,3}#{1,6}\s*/gm,'');
    t=t.replace(/\*\*([^*]+)\*\*/g,'$1');
    t=t.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1$2');
    t=t.replace(/(^|\s)_(.+?)_(?=\s|$)/g,'$1$2');
    t=t.replace(/`([^`]+)`/g,'$1');
    if (forSpeech) {
      t=t.replace(/https?:\/\/[^\s)]+/g,'链接');
      t=t.replace(/\|/g,'，');
    }
    t=t.replace(/\n{3,}/g,'\n\n');
    return t.trim();
  }

  function toast(msg, type) {
    try { if (window.toast) { window.toast(msg, type || 'ok'); return; } } catch (e) {}
  }

  /* ---------- Live2D 形象（本地模型 + 本地 widget） ---------- */
  var avatarWidget = null, avatarWidgetRoot = null, avatarLoading = false;

  function mountLive2dToStage() {
    try {
      var stage = document.getElementById('va-avatar-stage');
      if (!stage) return;
      var nodes = document.body.children;
      for (var i = nodes.length - 1; i >= 0; i--) {
        var n = nodes[i];
        if (n && n.tagName === 'DIV' && n.querySelector && n.querySelector('canvas') &&
            String(n.style.zIndex || '') === '9999' && String(n.style.pointerEvents || '') === 'none') {
          avatarWidgetRoot = n;
          stage.appendChild(n);
          Object.assign(n.style, {
            position: 'absolute', left: '50%', right: 'auto', bottom: '0',
            transform: 'translateX(-50%)', width: '240px', height: '250px',
            zIndex: '3', pointerEvents: 'auto'
          });
          return;
        }
      }
    } catch (e) { console.warn('[VoiceAgent] Live2D mount failed', e); }
  }

  function loadAvatarLibrary() {
    return new Promise(function (resolve, reject) {
      if (window.L2D_WIDGET && window.L2D_WIDGET.createWidget) return resolve(true);
      if (avatarLoading) return;
      avatarLoading = true;
      var s = document.createElement('script');
      s.src = '/js/vendor/l2d-widget.min.js?v=20260901.1';
      s.onload = function () { avatarLoading = false; resolve(true); };
      s.onerror = function () { avatarLoading = false; reject(new Error('形象组件加载失败')); };
      document.head.appendChild(s);
    });
  }

  function getAvatarModel() {
    try { return localStorage.getItem('va_avatar_model_v1') || 'half-body.glb'; } catch (e) { return 'half-body.glb'; }
  }
  function setAvatarModel(model) {
    try { localStorage.setItem('va_avatar_model_v1', model); } catch (e) {}
    var mode=getAvatarMode();
    if ((mode === 'airi' || mode === 'realistic3d') && document.body.classList.contains('va-panel-open')) {
      loadLocalAvatarRuntime(model);
    }
    return model;
  }

  function hideRealisticFrame() {
    var stage=document.getElementById('va-avatar-stage');
    if (stage) stage.classList.remove('is-visible');
    var frame=document.getElementById('va-realistic-frame');
    if (frame) frame.classList.remove('is-visible');
  }

  /* ---- AIRI Runtime：本地角色舞台，不加载外部站点 ---- */
  var agentRuntime = {
    ready:false, loading:false, currentModel:'',
    renderer:null, scene:null, camera:null, mixer:null, model:null,
    clock:null, canvas:null, state:'idle', width:0, height:0
  };

  function resizeAgentStage() {
    try {
      var stage=document.getElementById('va-avatar-stage');
      if (!stage || !agentRuntime.renderer) return;
      var w=stage.clientWidth || 320, h=stage.clientHeight || 250;
      if (Math.abs(agentRuntime.width-w)<2 && Math.abs(agentRuntime.height-h)<2) return;
      agentRuntime.width=w; agentRuntime.height=h;
      agentRuntime.renderer.setSize(w,h,false);
      agentRuntime.camera.aspect=w/h;
      agentRuntime.camera.updateProjectionMatrix();
    } catch (e) {}
  }

  function disposeAgentRuntime() {
    try {
      if (agentRuntime.renderer) agentRuntime.renderer.setAnimationLoop(null);
      if (agentRuntime.canvas && agentRuntime.canvas.parentNode) agentRuntime.canvas.parentNode.removeChild(agentRuntime.canvas);
      if (agentRuntime.model && agentRuntime.scene) agentRuntime.scene.remove(agentRuntime.model);
      if (agentRuntime.renderer) agentRuntime.renderer.dispose();
    } catch (e) {}
    agentRuntime.ready=false; agentRuntime.loading=false; agentRuntime.currentModel='';
    agentRuntime.renderer=null; agentRuntime.scene=null; agentRuntime.camera=null;
    agentRuntime.mixer=null; agentRuntime.model=null; agentRuntime.clock=null; agentRuntime.canvas=null;
  }

  function ensureAgentStage() {
    var stage=document.getElementById('va-avatar-stage');
    if (!stage) {
      stage=document.createElement('div');
      stage.id='va-avatar-stage';
      var aura=document.createElement('div'); aura.className='va-avatar-aura';
      stage.appendChild(aura);
      document.body.appendChild(stage);
    }
    Array.prototype.slice.call(stage.querySelectorAll('#va-airi-frame, #va-realistic-frame')).forEach(function(n){ n.remove(); });
    stage.classList.add('is-visible','is-runtime');
    if (!agentRuntime.canvas) {
      agentRuntime.canvas=document.createElement('canvas');
      agentRuntime.canvas.className='va-agent-canvas';
      stage.appendChild(agentRuntime.canvas);
    }
    return stage;
  }

  function loadLocalAvatarRuntime(modelFile) {
    if (location.protocol === 'file:') return Promise.resolve(false);
    var want=String(modelFile || getAvatarModel() || 'half-body.glb');
    var stage=ensureAgentStage();
    if (agentRuntime.ready && agentRuntime.currentModel===want) { resizeAgentStage(); return Promise.resolve(true); }
    if (agentRuntime.loading) return Promise.resolve(false);
    agentRuntime.loading=true;
    return Promise.all([
      import('/js/vendor/three/three.module.js'),
      import('/js/vendor/three/addons/loaders/GLTFLoader.js')
    ]).then(function(arr){
      var THREE=arr[0], GLTFLoader=arr[1].GLTFLoader;
      if (!agentRuntime.renderer) {
        var stage2=ensureAgentStage();
        agentRuntime.renderer=new THREE.WebGLRenderer({canvas:agentRuntime.canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
        agentRuntime.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
        if ('outputColorSpace' in agentRuntime.renderer) agentRuntime.renderer.outputColorSpace=THREE.SRGBColorSpace;
        if ('ACESFilmicToneMapping' in THREE) agentRuntime.renderer.toneMapping=THREE.ACESFilmicToneMapping;
        agentRuntime.scene=new THREE.Scene();
        agentRuntime.camera=new THREE.PerspectiveCamera(35,1,0.1,50);
        agentRuntime.scene.add(new THREE.HemisphereLight(0x9fd4ff,0x08101c,0.85));
        var key=new THREE.DirectionalLight(0xffffff,1.35); key.position.set(1.2,2.2,2.4); agentRuntime.scene.add(key);
        var rim=new THREE.DirectionalLight(0x8fd3ff,0.85); rim.position.set(-1.4,1.2,-1.2); agentRuntime.scene.add(rim);
        var fill=new THREE.DirectionalLight(0xb9a2ff,0.38); fill.position.set(-.6,.8,1.4); agentRuntime.scene.add(fill);
        agentRuntime.clock=new THREE.Clock();
        agentRuntime.renderer.setAnimationLoop(function(){
          try {
            var dt=agentRuntime.clock.getDelta();
            if (agentRuntime.mixer) agentRuntime.mixer.update(dt);
            if (agentRuntime.model) {
              var speed=agentRuntime.state==='acting'?1.5:(agentRuntime.state==='thinking'?0.65:0.22);
              agentRuntime.model.rotation.y += dt*speed;
              var base=agentRuntime.model.userData.baseY||0;
              agentRuntime.model.position.y=base+(agentRuntime.state==='speaking'?Math.sin(agentRuntime.clock.elapsedTime*9)*0.014:0);
              agentRuntime.camera.lookAt(0,agentRuntime.model.userData.lookY||0,0);
            }
            agentRuntime.renderer.render(agentRuntime.scene,agentRuntime.camera);
          } catch(e) {}
        });
      }
      if (agentRuntime.model) { agentRuntime.scene.remove(agentRuntime.model); agentRuntime.model=null; agentRuntime.mixer=null; }
      return new Promise(function(resolve,reject){
        var loader=new GLTFLoader();
        loader.load('/assets/avatars/'+encodeURIComponent(want), function(gltf){
          var model=gltf.scene;
          var box=new THREE.Box3().setFromObject(model);
          var size=box.getSize(new THREE.Vector3());
          var center=box.getCenter(new THREE.Vector3());
          model.position.x-=center.x; model.position.y-=box.min.y; model.position.z-=center.z;
          var maxDim=Math.max(size.x,size.y,size.z)||1;
          model.scale.setScalar(2.0/maxDim);
          model.userData.baseY=0;
          var box2=new THREE.Box3().setFromObject(model);
          var c2=box2.getCenter(new THREE.Vector3());
          var s2=box2.getSize(new THREE.Vector3());
          model.userData.lookY=c2.y+s2.y*0.06;
          agentRuntime.scene.add(model); agentRuntime.model=model;
          agentRuntime.camera.position.set(0,c2.y+s2.y*0.07,Math.max(2.1,s2.y*1.35));
          if (gltf.animations && gltf.animations.length) {
            var idle=gltf.animations.find(function(a){return /idle/i.test(a.name);})||gltf.animations[0];
            agentRuntime.mixer=new THREE.AnimationMixer(model);
            agentRuntime.mixer.clipAction(idle).play();
          }
          agentRuntime.ready=true; agentRuntime.loading=false; agentRuntime.currentModel=want;
          resizeAgentStage();
          resolve(true);
        }, undefined, function(err){ agentRuntime.loading=false; reject(err); });
      });
    }).catch(function(e){ console.warn('[VoiceAgent] AIRI Runtime load failed',e); agentRuntime.loading=false; return false; });
  }

  function setAgentRuntimeState(state) {
    agentRuntime.state=String(state||'idle');
  }

  function ensureLive2dStage() {
    var stage = document.getElementById('va-avatar-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'va-avatar-stage';
      var aura = document.createElement('div');
      aura.className = 'va-avatar-aura';
      stage.appendChild(aura);
      document.body.appendChild(stage);
    }
    Array.prototype.slice.call(stage.querySelectorAll('#va-airi-frame, #va-realistic-frame')).forEach(function (n) { n.remove(); });
    var panel = document.querySelector('.va-panel');
    if (panel && panel.contains(panel.querySelector('.va-log'))) {
      if (stage.parentElement !== panel) panel.insertBefore(stage, panel.querySelector('.va-log'));
    } else if (stage.parentElement !== document.body) {
      document.body.appendChild(stage);
    }
    stage.classList.add('is-visible', 'is-live2d');
    return true;
  }

  // ============ 麦克风所有权交接（2026-09-02） ============
  // 实测：AIRI 的 stores/settings/audio-device.ts 在 initialize() 里，只要
  //   settings/audio/input/enabled === true 且 settings/audio/input 能在设备列表匹配上，
  // 就会【页面加载即自动开流】；而小星的 startWakeListener() 也是常驻开麦。
  // 两者同时持麦的后果：
  //   · 说「小星」时两边一起回答
  //   · AIRI 的语音外放被小星的唤醒检测当成回声自触发
  // 因此按「谁在前台谁拿麦」做交接，同一时刻只有一个持有麦克风。
  // 注意：这几个变量必须声明在 ensureAiriProviders 之前 —— 它在里面会用到
  // AIRI_MIC_FLAG，靠 var 提升虽然也能跑，但依赖执行顺序太脆。
  var AIRI_MIC_FLAG = 'settings/audio/input/enabled';
  var _micOwner = null;        // 'airi' | 'xiaoxing' | null —— 已生效的归属
  var _micPending = null;      // 已请求、但防抖计时器还没跑完的归属
  var _micSyncTimer = null;
  var _micBorrowed = false;    // 小星是否临时从 AIRI 手里借走了麦克风
  var _idlePoll = null;        // idle 后等待静默还麦的轮询句柄
  var _wakeDesiredOn = true;   // 用户是否希望小星保持唤醒监听
  // 唤醒监听器的「代数」令牌：每次 start/stop 都会让旧的异步启动链作废。
  // 没有它的话，startWakeListener 在 checkAgent/getUserMedia 的异步窗口里
  // 被 stopWakeListener 叫停后，等 getUserMedia 兑现仍会把耳朵架起来 ——
  // 也就是「AIRI 在前台，小星的耳朵却复活了」的竞态（2026-09-02 实测复现）。
  var _wakeGen = 0;
  var _airiSpeaking = false;   // AIRI 此刻是不是正在说（半双工：说的时候要闭耳）

  // 防抖窗口内 _micOwner 还是旧值，UI.open() 后紧接着 listen() 会误判成"小星可以开麦"，
  // 于是两个同时持麦。所以判断一律走 effective()，把待生效的归属也算进去。
  function micOwnerEffective() { return _micPending || _micOwner; }

  // AIRI 的 stores/settings/audio-device.ts 在启动初始化时【只读一次】这个标志位来决定
  // 要不要开流。setMicOwner 有 80ms 防抖，而 iframe 是设了 src 就开始加载的 ——
  // AIRI 一旦先启动、读到旧值 false，之后标志位再翻也不会补开流（实测复现）。
  // 所以标志位必须同步写、且写在 iframe 加载之前。
  function setAiriMicFlag(on) {
    try { localStorage.setItem(AIRI_MIC_FLAG, on ? 'true' : 'false'); } catch (e) {}
  }

  // ============ AIRI 本地同源 provider 预置（2026-09-02） ============
  // AIRI 现在跑在同源的 /airi/ 下，与星屿共享 localStorage，
  // 所以星屿可以直接写入 AIRI 的 provider 配置，让它接上本地已有的：
  //   大脑 —— DeepSeek（走 /ai-proxy/，密钥只存本机）
  //   嘴   —— VoxCPM  （走 /vox-proxy/v1/ -> 127.0.0.1:8000）
  //   耳朵 —— SenseVoice（走 /asr-proxy/v1/ -> 127.0.0.1:8610/stt）
  // 全部同源，没有跨域隔离，麦克风与音频也就不再被 iframe 切断。
  // 2026-09-02 重大修正：这三个 id 不能自己起名。
  // AIRI 内部有多处【直接拿实例 id 做字符串比较】的硬编码分支：
  //   stores/modules/speech.ts:256  —— 只有 id === 'openai-compatible-audio-speech'
  //                                    时，才会用 settings/speech/voice 合成 voice 对象；
  //                                    否则去 availableVoices[实例id] 里找，而
  //                                    openai-compatible 的 listVoices 是 async () => []，
  //                                    永远为空 => activeSpeechVoice 恒为 undefined
  //                                    => Stage.vue 的 `if (!voice) return null` 静默返回
  //                                    => 「能对话但不出声」，且不报任何错。
  //   stores/modules/speech.ts:401  —— 同上，配置项完备性判断
  //   scenes/Stage.vue:484          —— 从 providerConfig.model / .voice 取模型与音色
  //   stores/modules/hearing.ts:392 —— 从 providerConfig.model 取 STT 模型
  //   stores/onboarding.ts:9        —— essentialProviderIds 白名单（跳过首次引导）
  // 所以自建的 OpenAI 兼容服务必须直接【顶用】这些官方实例 id。
  var AIRI_LLM_ID = 'openai-compatible';
  var AIRI_TTS_ID = 'openai-compatible-audio-speech';
  var AIRI_STT_ID = 'openai-compatible-audio-transcription';
  // 2026-09-02 视觉：AIRI 的 vision 模块给每个 chat 类 provider 自动生成
  // `vision-` 前缀的克隆实例（category=vision），vision-openai-compatible 是官方位。
  // 上游走 /vision-proxy/v1/（火山方舟 doubao 视觉模型，OpenAI 兼容）。
  var AIRI_VISION_ID = 'vision-openai-compatible';
  var AIRI_VISION_MODEL = 'doubao-seed-1-6-vision-250815';
  // 环境采样默认 20s 一帧（AIRI 默认 3s 太烧 token）；用户可在 AIRI 设置里改。
  var AIRI_VISION_INTERVAL_MS = '20000';
  // 2026-09-02 之前用过的自定义 id，必须清理，否则残留配置会顶掉新的
  var AIRI_LEGACY_IDS = ['xingyu-voxcpm-local', 'xingyu-sensevoice-local'];

  // AIRI 的「嘴」用哪套音色。
  // 2026-09-02 改走 edge-tts 标准音色，原因：本地 VoxCPM 克隆音色（taiyi）跑在
  // AMD RX 7600M XT + Vulkan 上，实测一句话要 22~35 秒，AIRI 一轮对话憋近 50 秒
  // 才出声，等于不能用；edge-tts 标准音色 2~4 秒出声，代价是丢掉克隆音色。
  // 备选：zh-CN-XiaoyiNeural（更年轻，约 4.2s）、zh-CN-XiaoxiaoNeural（最快，约 2.9s）
  var AIRI_VOICE = 'zh-CN-XiaoxiaoNeural';
  // 需要强制迁移掉的旧克隆音色名（VoxCPM voice-dir 里注册的那些）
  var AIRI_LEGACY_VOICES = ['taiyi', 'dabin'];

  function ensureAiriProviders() {
    try {
      if (location.protocol === 'file:') return;
      var base = location.protocol + '//' + location.host;
      var defs = [
        { id: AIRI_LLM_ID, definitionId: 'openai-compatible', url: base + '/ai-proxy/' },
        // 一旦 id 匹配上，AIRI 就会改从 config.model / config.voice 取模型与音色
        // （Stage.vue:484、hearing.ts:392），所以这两个字段必须写全，
        // 否则会退化成 tts-1 / alloy 这类 VoxCPM 不认识的值。
        { id: AIRI_TTS_ID, definitionId: 'openai-compatible-audio-speech', url: base + '/vox-proxy/v1/', model: 'voxcpm-tts', voice: AIRI_VOICE },
        { id: AIRI_STT_ID, definitionId: 'openai-compatible-audio-transcription', url: base + '/asr-proxy/v1/', model: 'sensevoice-small' },
        // 视觉：独立实例（vision- 前缀是 AIRI 官方约定），密钥由 server.py 注入
        { id: AIRI_VISION_ID, definitionId: 'openai-compatible', url: base + '/vision-proxy/v1/', model: AIRI_VISION_MODEL }
      ];
      var configured = {};
      var added = {};
      try { configured = JSON.parse(localStorage.getItem('settings/providers/configured') || '{}') || {}; } catch (e) { configured = {}; }
      try { added = JSON.parse(localStorage.getItem('settings/providers/added') || '{}') || {}; } catch (e) { added = {}; }

      var changed = false;
      var k;
      // 清掉历史遗留 id
      for (k = 0; k < AIRI_LEGACY_IDS.length; k++) {
        if (configured[AIRI_LEGACY_IDS[k]]) { delete configured[AIRI_LEGACY_IDS[k]]; changed = true; }
        if (added[AIRI_LEGACY_IDS[k]]) { delete added[AIRI_LEGACY_IDS[k]]; changed = true; }
      }

      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        var cur = configured[d.id];
        // 已存在且地址一致就不覆盖，免得洗掉用户后来手改的配置。
        // 但 model/voice 缺失时必须补全 —— 缺了它们 AIRI 会退化为默认模型而静默哑火。
        if (cur && cur.definitionId === d.definitionId && cur.config && cur.config.baseUrl === d.url && cur.status === 'configured') {
          var needPatch = false;
          if (d.model && cur.config.model !== d.model) { cur.config.model = d.model; needPatch = true; }
          if (d.voice && cur.config.voice !== d.voice) { cur.config.voice = d.voice; needPatch = true; }
          if (needPatch) changed = true;
          continue;
        }
        var cfg = { apiKey: 'xingyu-local', baseUrl: d.url };
        if (d.model) cfg.model = d.model;
        if (d.voice) cfg.voice = d.voice;
        configured[d.id] = {
          id: d.id,
          definitionId: d.definitionId,
          config: cfg,
          status: 'configured',
          configuredBy: 'user'
        };
        added[d.id] = true;
        changed = true;
      }
      if (changed) {
        localStorage.setItem('settings/providers/configured', JSON.stringify(configured));
        localStorage.setItem('settings/providers/added', JSON.stringify(added));
        // 服务来源已配好，跳过首次引导弹窗；仍可从侧边栏进设置页调整
        localStorage.setItem('onboarding/completed', 'true');
        localStorage.setItem('onboarding/skipped', 'false');
      }

      // 光注册 provider 还不够，AIRI 还要知道"当前选中哪一个"才真的会去调。
      // 这些键全是纯字符串（VueUse useLocalStorage 对 string 不做 JSON 包装）。
      // 只在用户还没选过时填默认值，绝不覆盖手改。
      var picks = [
        ['settings/consciousness/active-provider', AIRI_LLM_ID],
        ['settings/consciousness/active-model', 'deepseek-v4-flash'],
        ['settings/hearing/active-provider', AIRI_STT_ID],
        ['settings/hearing/active-model', 'sensevoice-small'],
        ['settings/speech/active-provider', AIRI_TTS_ID],
        ['settings/speech/active-model', 'voxcpm-tts'],
        ['settings/speech/voice', AIRI_VOICE],
        // 视觉：预选 vision 实例与默认模型（为空才写，不覆盖手改）
        ['settings/vision/active-provider', AIRI_VISION_ID],
        ['settings/vision/active-model', AIRI_VISION_MODEL]
      ];
      for (var j = 0; j < picks.length; j++) {
        var key = picks[j][0], want = picks[j][1];
        var v = localStorage.getItem(key);
        // 空值、占位值、以及指向已废弃 id 的旧值，都要纠正过来
        var stale = (v === null || v === '' || v === 'speech-noop' || AIRI_LEGACY_IDS.indexOf(v) >= 0);
        // 音色字段要额外强制迁移：旧版存的是 VoxCPM 克隆音色名（taiyi / dabin），
        // 现在换标准音色了。上面那个 if 只在「空 / 废弃」时才覆盖，
        // 而用户浏览器里已经存着 'taiyi' 这个非空值，不处理就会一直走慢车道。
        if (!stale && want === AIRI_VOICE && AIRI_LEGACY_VOICES.indexOf(v) >= 0) stale = true;
        if (stale) localStorage.setItem(key, want);
      }

      // 麦克风：光把开关打开还不够。AIRI 的 settings-audio-devices 在 initialize() 里
      // 要求 selectedAudioInput 能在设备列表里匹配得到，否则即使 enabled=true 也
      // 不会去拉麦克风流（源码 stores/settings/audio-device.ts 的 hasSelectedInput 判断）。
      // 'default' 是各浏览器都存在的标准 deviceId，也正是 AIRI 自己的
      // resolvePreferredAudioInput() 会优先挑中的那个值。
      if (!localStorage.getItem('settings/audio/input')) {
        localStorage.setItem('settings/audio/input', 'default');
      }
      // 视觉采样间隔初值：AIRI 默认 3000ms 一帧对多模态计费太狠，首设给 20s。
      // 只在从未设置过时写，用户在 AIRI 设置里改过就不动。
      if (localStorage.getItem('settings/vision/capture-interval-ms') === null) {
        localStorage.setItem('settings/vision/capture-interval-ms', AIRI_VISION_INTERVAL_MS);
      }
      // 注意：settings/audio/input/enabled 这个开关现在【只由麦克风所有权交接逻辑
      // （applyMicOwnership）负责写】，这里不能再无条件置 true —— 否则 AIRI 退场后
      // 标志又被改回来，下次加载仍会自动开流，交接就失效了。
      // 仅在从未设置过（首次初始化）时给个初值，默认交给小星。
      if (localStorage.getItem(AIRI_MIC_FLAG) === null) {
        localStorage.setItem(AIRI_MIC_FLAG, 'false');
      }
      // 角色卡预置：必须赶在 AIRI store 初始化前落盘（本函数总在 iframe 加载前执行）。
      ensureAiriCards();
    } catch (e) { /* localStorage 不可用时静默降级 */ }
  }

  function ensureAiriFrameStage() {
    var stage = document.getElementById('va-avatar-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'va-avatar-stage';
      var aura = document.createElement('div');
      aura.className = 'va-avatar-aura';
      stage.appendChild(aura);
    }
    // AIRI 是全屏交互层；从带 backdrop-filter 的面板里移到 body，避免 fixed 定位被面板裁剪。
    if (stage.parentElement !== document.body) document.body.appendChild(stage);
    var frame = document.getElementById('va-airi-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'va-airi-frame';
      frame.title = 'AIRI';
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('allow', 'microphone; camera; autoplay; clipboard-write');
      stage.appendChild(frame);
    }
    stage.classList.add('is-visible', 'is-airi');
    stage.classList.remove('is-live2d', 'is-runtime');
    document.body.classList.add('va-airi-native');
    return stage;
  }

  // ============ AIRI 视觉桥（2026-09-02） ============
  // 上游 AIRI 的 web 版 vision 模块只有推理栈与设置页（vision / vision-processing /
  // vision-orchestrator 三个 store），但没有接任何捕获源 —— 全仓库没有任何代码调用
  // processCapture/startTicker；且其上下文发布 sendContextUpdate 只走 WebSocket
  // （连官方后端），纯网页版发不进大脑。本桥在 iframe 里补齐三件事：
  //   1. 摄像头取像：getUserMedia -> 隐藏 video -> canvas -> JPEG dataURL
  //   2. 定时节拍：每轮重读 settings/vision/capture-interval-ms（用户在 AIRI 设置里
  //      改了间隔立即生效，无需重启）；AIRI 自带的 ticker 拿不到（store 懒实例化），
  //      自管循环行为等价。
  //   3. 推理 + 喂脑：直接 POST /vision-proxy/v1/chat/completions（火山方舟 doubao
  //      视觉，报文与 AIRI 原生 useVisionInference 完全一致），成功后把【文字描述】
  //      用 chatContext.ingestContextMessage(strategy=replace-self, source=vision:camera)
  //      注入 —— 已实证：注入内容会出现在下一次 /ai-proxy/chat/completions 请求体里。
  //      只喂文字不喂图：大脑是 DeepSeek（无视觉能力），塞 image_url 会被 API 拒收。
  var VISION_DESIRED_KEY = 'va_vision_enabled';
  var _visionBridgeTimer = null;
  var visionBtn = null;   // 对话框头部的视觉开关按钮（build() 里赋值）

  // 这个函数会被整段序列化后在 AIRI iframe 里执行（同源），只依赖 iframe 内的全局。
  function AIRI_VISION_BRIDGE_FN() {
    if (window.__XINGYU_VISION__) return;
    var PROMPT = '你是 AIRI 的视觉感知通道。这是你通过摄像头看到的当前画面。' +
      '请用不超过两句话、客观简洁地描述画面核心：人物是否存在及其姿态/表情、主要物品、' +
      '场景以及与常规状态的明显变化。不要描述屏幕或软件界面，不要猜测画面里没有的内容，不要客套。';
    var DEFAULT_MODEL = 'doubao-seed-1-6-vision-250815';
    var state = { enabled: false, stream: null, video: null, canvas: null, timer: null,
                  busy: false, errStreak: 0, captures: 0, lastError: null, lastDesc: '', startedAt: 0 };

    function stores() {
      try {
        var app = document.querySelector('#app');
        if (!app || !app.__vue_app__) return null;
        var pinia = app.__vue_app__.config.globalProperties.$pinia;
        if (!pinia || !pinia._s) return null;
        return { cc: pinia._s.get('chat-context'), vision: pinia._s.get('vision') };
      } catch (e) { return null; }
    }

    function intervalMs() {
      try {
        var v = parseInt(localStorage.getItem('settings/vision/capture-interval-ms'), 10);
        if (isFinite(v) && v >= 5000) return v;
      } catch (e) {}
      return 20000;
    }

    async function inferOnce(dataUrl, model) {
      var res = await fetch('/vision-proxy/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } }
          ] }],
          max_tokens: 220,
          stream: false
        })
      });
      var j = null;
      try { j = await res.json(); } catch (e) {}
      if (!res.ok) {
        var msg = j && j.error ? (j.error.message || (typeof j.error === 'string' ? j.error : JSON.stringify(j.error))) : ('HTTP ' + res.status);
        throw new Error(String(msg));
      }
      var txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!txt) throw new Error('视觉模型返回为空');
      return String(txt).trim().slice(0, 300);
    }

    function ingest(desc, dataUrl) {
      var s = stores();
      if (!s || !s.cc) return false;
      try {
        s.cc.ingestContextMessage({
          id: 'vision-' + Date.now(),
          contextId: 'vision:camera:default',
          strategy: 'replace-self',
          source: 'vision:camera',
          text: '【视觉 · 摄像头】' + desc,
          content: [{ type: 'text', text: '【视觉 · 摄像头】' + desc }],
          metadata: { module: 'vision', workload: 'camera.observe', sourceLabel: '摄像头' },
          createdAt: Date.now()
        });
        return true;
      } catch (e) { return false; }
    }

    function teardownMedia() {
      try { if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { if (state.video) state.video.remove(); } catch (e) {}
      state.stream = null; state.video = null; state.canvas = null;
    }

    function scheduleNext() {
      if (!state.enabled) return;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(function () {
        state.timer = null;
        tick().then(scheduleNext);
      }, intervalMs());
    }

    async function tick() {
      if (!state.enabled || state.busy) return;
      if (!state.video || state.video.readyState < 2) return;
      state.busy = true;
      try {
        var canvas = state.canvas;
        var ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(state.video, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        var s = stores();
        var model = (s && s.vision && s.vision.activeModel) || DEFAULT_MODEL;
        var desc = await inferOnce(dataUrl, model);
        state.captures++; state.errStreak = 0; state.lastError = null; state.lastDesc = desc;
        ingest(desc, dataUrl);
      } catch (e) {
        state.errStreak++;
        state.lastError = String((e && e.message) || e);
        // 连续 3 次失败（密钥未配 / 被拒 / 上游挂了）自动停机，避免无限烧请求；
        // 同时清掉期望标志，否则下次打开 AIRI 会自动恢复、又白烧 3 个失败请求
        if (state.errStreak >= 3) {
          setTimeout(function () {
            api.disable();
            try { localStorage.removeItem('va_vision_enabled'); } catch (e2) {}
          }, 0);
        }
      } finally {
        state.busy = false;
      }
    }

    var api = {
      enable: async function () {
        if (state.enabled) return { ok: true, already: true };
        var s = stores();
        if (!s || !s.cc) return { ok: false, error: 'AIRI 尚未就绪，请稍后再开' };
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
          return { ok: false, error: '此环境不支持摄像头' };
        try {
          state.stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }, audio: false
          });
        } catch (e) {
          var why = e && e.name === 'NotAllowedError' ? '摄像头权限被拒绝' :
                    e && e.name === 'NotFoundError' ? '没有找到可用摄像头' : String(e.message || e);
          state.lastError = '摄像头不可用：' + why;
          return { ok: false, error: state.lastError };
        }
        var video = document.createElement('video');
        video.autoplay = true; video.playsInline = true; video.muted = true;
        video.style.cssText = 'position:fixed;left:-12px;top:-12px;width:2px;height:2px;opacity:0;pointer-events:none;';
        video.srcObject = state.stream;
        document.body.appendChild(video);
        try { await video.play(); } catch (e) {}
        var canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        state.video = video; state.canvas = canvas;
        state.enabled = true; state.errStreak = 0; state.startedAt = Date.now();
        tick().then(scheduleNext);   // 开启后立即看第一眼，之后按间隔巡检
        return { ok: true };
      },
      disable: function () {
        var was = state.enabled;
        state.enabled = false;
        if (state.timer) { clearTimeout(state.timer); state.timer = null; }
        teardownMedia();
        return { ok: true, was: was };
      },
      status: function () {
        var live = !!(state.stream && state.stream.getVideoTracks().length &&
                      state.stream.getVideoTracks()[0].readyState === 'live');
        return { enabled: state.enabled, live: live, captures: state.captures,
                 lastError: state.lastError, lastDesc: state.lastDesc,
                 intervalMs: intervalMs(), busy: state.busy };
      },
      captureOnce: function () { return tick(); }
    };
    window.__XINGYU_VISION__ = api;
  }

  // 向 AIRI iframe 注入视觉桥；返回 Promise<boolean>（桥是否可用）
  function ensureVisionBridge() {
    return new Promise(function (resolve) {
      var frame = document.getElementById('va-airi-frame');
      if (!frame) return resolve(false);
      var w, d;
      try { w = frame.contentWindow; d = frame.contentDocument; } catch (e) { return resolve(false); }
      if (!w || !d || d.location.href === 'about:blank') return resolve(false);
      try {
        if (w.__XINGYU_VISION__) return resolve(true);
        var app = d.querySelector('#app');
        if (!app || !app.__vue_app__) return resolve(false); // AIRI 尚未挂载
        var script = d.createElement('script');
        script.textContent = '(' + AIRI_VISION_BRIDGE_FN.toString() + ')();';
        (d.head || d.documentElement).appendChild(script);
        resolve(!!w.__XINGYU_VISION__);
      } catch (e) { resolve(false); }
    });
  }

  // iframe 挂载后轮询注入（AIRI 挂载是异步的）；注入后若用户此前开过视觉则自动恢复
  function scheduleVisionBridge() {
    if (_visionBridgeTimer) { clearTimeout(_visionBridgeTimer); _visionBridgeTimer = null; }
    var tries = 0;
    var want = false;
    try { want = localStorage.getItem(VISION_DESIRED_KEY) === '1'; } catch (e) {}
    var poll = function () {
      tries++;
      ensureVisionBridge().then(function (ok) {
        if (ok) {
          if (want) {
            var frame = document.getElementById('va-airi-frame');
            try {
              frame.contentWindow.__XINGYU_VISION__.enable().then(function (r) {
                if (!r.ok) try { localStorage.removeItem(VISION_DESIRED_KEY); } catch (e) {}
                updateVisionBtn();
              });
            } catch (e) {}
          }
          updateVisionBtn();
          return;
        }
        if (tries < 40) _visionBridgeTimer = setTimeout(poll, 500);
      });
    };
    poll();
  }

  function visionDesiredOn() {
    try { return localStorage.getItem(VISION_DESIRED_KEY) === '1'; } catch (e) { return false; }
  }

  // 供 build() 后的 UI 同步按钮态；visionBtn 在 build 里赋值
  function updateVisionBtn() {
    if (!visionBtn) return;
    var on = visionDesiredOn();
    visionBtn.classList.toggle('is-on', on);
    visionBtn.innerHTML = on
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
    visionBtn.title = on ? '视觉开着：AIRI 正通过摄像头观察（点击关闭）'
                         : '视觉开关：让 AIRI 通过摄像头看到你';
  }

  // 视觉开关点击：开着就关，关着就开（含权限申请）。AIRI 不在前台时拒绝。
  function onVisionToggle() {
    if (!airiInFront()) { toast('先打开智能体（AIRI）后再使用视觉', 'err'); return; }
    ensureVisionBridge().then(function (ok) {
      if (!ok) { toast('AIRI 还没就绪，等它加载完再试', 'err'); return; }
      var frame = document.getElementById('va-airi-frame');
      var api = frame.contentWindow.__XINGYU_VISION__;
      var st = api.status();
      if (st.enabled) {
        api.disable();
        try { localStorage.removeItem(VISION_DESIRED_KEY); } catch (e) {}
        toast('视觉已关闭，摄像头已停止', 'ok');
        updateVisionBtn();
        return;
      }
      api.enable().then(function (r) {
        if (r && r.ok) {
          try { localStorage.setItem(VISION_DESIRED_KEY, '1'); } catch (e) {}
          if (r.already) toast('视觉已处于开启状态', 'ok');
          else toast('视觉已开启：AIRI 正通过摄像头观察，看到的内容会进入对话（间隔 ' + Math.round((st.intervalMs || 20000) / 1000) + 's）', 'ok');
        } else {
          toast((r && r.error) || '视觉开启失败', 'err');
        }
        updateVisionBtn();
      });
    });
  }

  /* ---------- AIRI 角色卡（2026-09-03 + 09-03 形象层） ----------
   * AIRI 的角色系统：airi-card store 把 `airi-cards`（Map，localStorage 序列化成
   * [ [id, card], ... ]）+ `airi-card-active-id`（默认 'default'）作为唯一事实源；
   * systemPrompt = [卡.systemPrompt, description, personality, scenario].join('  ')，
   * 直接成为大脑 system 消息（已 E2E 实证：注入卡后请求体出现卡片段，切回 default 消失）。
   *
   * 【2026-09-03 形象层】AIRI 卡有「人设层 + 形象层」双层结构：
   *  - 人设层：上面的 systemPrompt/description/personality/scenario —— 上一版已就绪
   *  - 形象层：`extensions.airi.modules.displayModelId` —— 引用 display-models store 的
   *    模型 id（AIRI 内置 4 个 preset：preset-live2d-1/2、preset-vrm-1/2）。
   *    切卡时 `applyActiveCardSettings()` 第 444 行：if (modules?.displayModelId)
   *    stageModel.stageModelSelected = ... → 触发 updateStageModel() 换模型。
   *    不写则保持上次的模型 —— 3 张卡切来切去同一形象，看起来像"切换后空白"。
   *  修复：每张预置卡显式绑不同 displayModelId；旧卡 modules=[] 由 patch 路径补齐。
   *
   * AIRI 的 modules.vrm / modules.live2d 是「保留透传字段」（仅 newAiriCard 归一化时
   * 原样保留，无渲染消费），真正决定形象的还是 displayModelId。
   *
   * 上游导入 UI 只收 .airi zip 包；这里补齐两条路：
   *   1. 预置中文卡（ensureAiriCards，赶在 AIRI 启动前写入，guard 键防止重复打扰）
   *   2. window.XingyuAiriCards.importText()：SillyTavern V2/V3（chub.ai 等）
   *      或 V1 扁平 JSON 一键导入 —— AIRI 挂载时走 live store（addCard/activateCard，
   *      立即生效不重启），未挂载时写 localStorage 并提示重启会话。
   *   3. 【2026-09-03】 window.XingyuAiriCards.injectModel(name, url, format)：
   *      把星屿侧的本地模型（koharu Live2D 等）注册到 AIRI display-models store，
   *      返回新 id；再 setCardDisplayModel(cardId, id) 即可绑到任一预置卡。
   * 卡片不带 consciousness 指定 → 自动沿用当前全局大脑（DeepSeek），不会破坏语音配置。 */

  var CARD_PRESET_GUARD = 'airi-cards-xingyu-preset-v2';

  // AIRI display-models store 内置 4 个 preset id（display-models.ts:38-41）。
  // 在 airi/assets/mutex-BuITVS9W.js 里组装，URL 都是同源 /airi/assets/...。
  // 与「切换后空白」直接相关：切卡若 displayModelId 在这 4 个之外 → 渲染失败 → 空白。
  var AIRI_PRESET_MODELS = [
    { id: 'preset-live2d-1', name: 'Hiyori (Pro)',   format: 'live2d-zip' },
    { id: 'preset-live2d-2', name: 'Hiyori (Free)',  format: 'live2d-zip' },
    { id: 'preset-vrm-1',    name: 'AvatarSample_A', format: 'vrm' },
    { id: 'preset-vrm-2',    name: 'AvatarSample_B', format: 'vrm' },
  ];
  var AIRI_PRESET_IDS = AIRI_PRESET_MODELS.map(function (m) { return m.id; });

  function readAiriCardsRaw() {
    try {
      var raw = localStorage.getItem('airi-cards');
      if (!raw) return [];
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeAiriCardsRaw(entries) {
    try { localStorage.setItem('airi-cards', JSON.stringify(entries)); return true; }
    catch (e) { return false; }
  }

  // displayModelId 取 AIRI 内置 4 个 preset 之一（mutex-BuITVS9W.js 实证存在）。
  // 3 张预置卡绑定 3 个不同形象 + default 出厂卡（Hiyori Pro）共 4 张卡 3 种人。
  // 形象—人设映射（按气质匹配，不是字母序）：
  //   墨小星（元气学习搭子，可爱直接）→ AvatarSample_A（VRM 女，活气足）
  //   晚风  （深夜电台主播，温柔叙事）→ Hiyori (Pro)（Live2D 女，温柔画面感强）
  //   苏格拉底（提问式导师，沉稳犀利）→ AvatarSample_B（VRM 男，沉稳老成）
  var AIRI_CARDS_PRESETS = [
    {
      id: 'card-xingyu-momo',
      card: {
        name: '墨小星', version: '1.0.0',
        description: '星屿学习搭子：陪你规划任务、盯进度、庆祝每一次小胜。',
        personality: '元气、直接、可靠；说人话，不绕弯。',
        scenario: '在星屿学习平台与用户并肩作战。',
        greetings: ['打卡时间到！今天先攻克哪一关？'],
        systemPrompt: '你是「墨小星」，用户在星屿平台的学习搭子。语气元气、简短、直接，每次回复不超过三句话；给建议必须具体可执行（番茄钟、拆任务、先做 5 分钟），不说空话；用户完成目标时短促庆祝，拖延时温和催促。',
        postHistoryInstructions: '', messageExample: [], notes: '',
        tags: ['星屿', '学习'],
        extensions: { airi: { modules: { displayModelId: 'preset-vrm-1' }, agents: {} } },
      },
    },
    {
      id: 'card-xingyu-wanfeng',
      card: {
        name: '晚风', version: '1.0.0',
        description: '深夜电台主播：沉稳温柔，有画面感的陪伴。',
        personality: '沉稳、温柔、叙述感。',
        scenario: '午夜电台直播间，一盏灯、一段轻音乐。',
        greetings: ['这里是无名频率，今晚的风很轻。想聊点什么？'],
        systemPrompt: '你是「晚风」，一档深夜电台节目的主播。像广播稿一样说话：语速平缓、有画面感，称呼用户为「听众朋友」；每次回复不超过四句话，结尾常带一句轻盈的收束（深夜道晚安式，白天改问候式）；不堆砌辞藻，克制而温暖。',
        postHistoryInstructions: '', messageExample: [], notes: '',
        tags: ['星屿', '电台'],
        extensions: { airi: { modules: { displayModelId: 'preset-live2d-1' }, agents: {} } },
      },
    },
    {
      id: 'card-xingyu-socrates',
      card: {
        name: '苏格拉底', version: '1.0.0',
        description: '提问式导师：不喂答案，用一连串短问题引你自己走到答案跟前。',
        personality: '耐心、犀利、谦逊。',
        scenario: '雅典街头式的一问一答。',
        greetings: ['说说看，你目前是怎么理解这个问题的？'],
        systemPrompt: '你是「苏格拉底」，提问式学习伙伴（产婆术）。几乎不直接给答案：先确认用户已有的理解，再用一连串短问题引导他自己推导出结论；每轮最多问两个问题，问题要短、要有梯度；用户卡住时给最小的提示而不是答案。',
        postHistoryInstructions: '', messageExample: [], notes: '',
        tags: ['星屿', '学习法'],
        extensions: { airi: { modules: { displayModelId: 'preset-vrm-2' }, agents: {} } },
      },
    },
  ];

  // 卡 id → displayModelId 映射表（patch 路径用）。
  // 注意：只能改当前 PRESETS 里的卡；用户自建/导入的卡不在此列，避免误改用户数据。
  var CARD_DISPLAY_MODEL_PATCH = {};
  AIRI_CARDS_PRESETS.forEach(function (p) {
    var mid = p.card.extensions && p.card.extensions.airi
      && p.card.extensions.airi.modules && p.card.extensions.airi.modules.displayModelId;
    if (mid) CARD_DISPLAY_MODEL_PATCH[p.id] = mid;
  });

  // 预置卡写入：只在 guard 键缺失时执行首次写入（用户之后删卡不会被强行加回）。
  // 升级路径（v1→v2）：用户已写过空 modules 的旧卡，补 displayModelId；guard 键升版 v1→v2 触发。
  // 在 boot() 顶部调用（2026-09-03）：不再等 AI 助手面板打开，避免「主页进了没切就空」的窗口。
  function ensureAiriCards() {
    try {
      if (localStorage.getItem(CARD_PRESET_GUARD) === 'v2') {
        // 已升级过，但还要做一次幂等 patch：万一用户在升级中途改了 modules 字段，再次补齐
        var patched2 = ensureAiriCardsPatch();
        if (patched2) writeAiriCardsRaw(patched2);
        return;
      }
      // 首次：写入 3 张预置卡 + 旧版 modules=[] 的卡补 displayModelId
      var entries = readAiriCardsRaw();
      var have = {};
      entries.forEach(function (e) { have[e[0]] = true; });
      var added = 0;
      AIRI_CARDS_PRESETS.forEach(function (p) {
        if (!have[p.id]) { entries.push([p.id, p.card]); added++; }
      });
      var patched = ensureAiriCardsPatch(entries);
      if (added) writeAiriCardsRaw(entries);
      if (patched) writeAiriCardsRaw(patched);
      localStorage.setItem(CARD_PRESET_GUARD, 'v2');
    } catch (e) { console.warn('[VoiceAgent] 角色卡预置失败', e); }
  }

  // patch 升级路径：只动 CARD_DISPLAY_MODEL_PATCH 表里列出的预置卡，其它一概不碰。
  // 只在 modules.displayModelId 缺失时补，已有值保留（绝不覆盖用户手改）。
  function ensureAiriCardsPatch(entries) {
    if (!entries || !entries.length) return null;
    var changed = false;
    entries.forEach(function (pair) {
      var id = pair[0], card = pair[1];
      var wantMid = CARD_DISPLAY_MODEL_PATCH[id];
      if (!wantMid) return;     // 非预置卡（或已被用户删/改），不动
      var ext = card && card.extensions && card.extensions.airi;
      var mods = ext && ext.modules;
      var curMid = mods && mods.displayModelId;
      if (curMid && AIRI_PRESET_IDS.indexOf(curMid) >= 0) return;  // 已有合法 preset id，跳过
      if (!card.extensions) card.extensions = {};
      if (!card.extensions.airi) card.extensions.airi = { modules: {}, agents: {} };
      if (!card.extensions.airi.modules) card.extensions.airi.modules = {};
      card.extensions.airi.modules.displayModelId = wantMid;
      changed = true;
    });
    return changed ? entries : null;
  }

  // 拿 AIRI 内活的 airi-card store（iframe 已挂载才有）；拿不到返回 null
  function airiCardStore() {
    try {
      var f = document.getElementById('va-airi-frame');
      if (!f || !f.contentDocument) return null;
      var app = f.contentDocument.querySelector('#app');
      if (!app || !app.__vue_app__) return null;
      var pinia = app.__vue_app__.config.globalProperties.$pinia;
      return (pinia && pinia._s && pinia._s.get('airi-card')) || null;
    } catch (e) { return null; }
  }

  // 任意来源 → AIRI 内部卡形状。支持：chara_card_v2/v3（带 data 包装）、
  // SillyTavern V1 扁平 JSON、AIRI 内部形状。缺 name 判为非法。
  function cardNormalizeFromAny(obj) {
    if (!obj || typeof obj !== 'object') return null;
    var d = (obj.data && typeof obj.data === 'object') ? obj.data : obj;
    var name = String(d.name || '').trim();
    if (!name) return null;
    var greetings = [];
    if (typeof d.first_mes === 'string' && d.first_mes.trim()) greetings.push(d.first_mes);
    (Array.isArray(d.alternate_greetings) ? d.alternate_greetings : []).forEach(function (g) {
      if (typeof g === 'string' && g.trim()) greetings.push(g);
    });
    (Array.isArray(d.greetings) ? d.greetings : []).forEach(function (g) {
      if (typeof g === 'string' && g.trim()) greetings.push(g);
    });
    return {
      name: name,
      version: String(d.character_version || d.version || '1.0.0'),
      description: String(d.description || ''),
      personality: String(d.personality || ''),
      scenario: String(d.scenario || ''),
      greetings: greetings,
      notes: String(d.creator_notes || d.notes || ''),
      systemPrompt: String(d.system_prompt || d.systemPrompt || ''),
      postHistoryInstructions: String(d.post_history_instructions || d.postHistoryInstructions || ''),
      messageExample: [], tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
      extensions: { airi: { modules: {}, agents: {} } },
    };
  }

  // SillyTavern 导出的 PNG 卡：角色数据藏在 tEXt chunk（keyword=chara/ccv3，值=base64 JSON）。
  // chub.ai 等站下载的卡大多是这个格式，必须支持。
  function pngCharaToJson(base64) {
    try {
      var raw = atob(base64);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) return null;
      var dv = new DataView(bytes.buffer);
      var off = 8;
      while (off + 8 <= bytes.length) {
        var len = dv.getUint32(off);
        var type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
        if (type === 'tEXt') {
          var data = bytes.subarray(off + 8, off + 8 + len);
          var z = -1;
          for (var j = 0; j < Math.min(data.length, 256); j++) { if (data[j] === 0) { z = j; break; } }
          if (z > 0) {
            var kw = '';
            for (var k = 0; k < z; k++) kw += String.fromCharCode(data[k]);
            if (kw === 'chara' || kw === 'ccv3') {
              var b64txt = '';
              for (var m = z + 1; m < data.length; m++) b64txt += String.fromCharCode(data[m]);
              var bin = atob(b64txt.replace(/\s+/g, ''));
              var arr = new Uint8Array(bin.length);
              for (var n = 0; n < bin.length; n++) arr[n] = bin.charCodeAt(n);
              return JSON.parse(new TextDecoder('utf-8').decode(arr));
            }
          }
        }
        if (type === 'IEND') break;
        off += 12 + len;
      }
      return null;
    } catch (e) { return null; }
  }

  // 对外 API：导入 / 列表 / 激活 / 删除。AIRI 挂载时走 live store 立即生效；
  // 否则写 localStorage 并在结果里标 needsReload（由调用方决定何时重启会话）。
  window.XingyuAiriCards = {
    list: function () {
      var active = null;
      try { active = localStorage.getItem('airi-card-active-id'); } catch (e) {}
      return readAiriCardsRaw().map(function (e) {
        return { id: e[0], name: (e[1] && e[1].name) || e[0], active: e[0] === active };
      });
    },
    importText: function (text) {
      var obj = null;
      var t = String(text || '').trim();
      // PNG 卡：dataURL 或裸 base64（按魔数识别）
      var b64 = null;
      if (/^data:image\/png;base64,/i.test(t)) b64 = t.split(',')[1] || '';
      else if (/^data:image\/png/i.test(t)) b64 = t.split(',')[1] || '';
      else if (/^[A-Za-z0-9+/=\s]+$/.test(t) && t.replace(/\s+/g, '').length > 64 && !t.startsWith('{')) b64 = t.replace(/\s+/g, '');
      if (b64 !== null) {
        var fromPng = pngCharaToJson(b64);
        if (!fromPng) return Promise.resolve({ ok: false, error: 'PNG 里没有角色卡数据（缺少 chara 块或不是卡 PNG）' });
        obj = fromPng;
      }
      if (!obj) {
        try { obj = JSON.parse(t); } catch (e) { return Promise.resolve({ ok: false, error: '不是合法的 JSON，也不是角色卡 PNG' }); }
      }
      var card = cardNormalizeFromAny(obj);
      if (!card) return Promise.resolve({ ok: false, error: '缺少 name 字段，无法识别为角色卡' });
      var st = airiCardStore();
      if (st && typeof st.addCard === 'function') {
        return Promise.resolve(st.addCard(card, 'xingyu-import')).then(function (id) {
          return { ok: true, id: id, name: card.name, needsReload: false };
        }).catch(function (e) { return { ok: false, error: '导入失败：' + e }; });
      }
      var id = 'card-imp-' + Date.now();
      var entries = readAiriCardsRaw();
      entries.push([id, card]);
      if (!writeAiriCardsRaw(entries)) return Promise.resolve({ ok: false, error: '写入失败（存储空间不足？）' });
      return Promise.resolve({ ok: true, id: id, name: card.name, needsReload: true });
    },
    activate: function (id) {
      var st = airiCardStore();
      if (st && typeof st.activateCard === 'function') {
        return Promise.resolve(st.activateCard(id)).then(function (r) {
          return r === false ? { ok: false, error: '卡片不存在' } : { ok: true, needsReload: false };
        });
      }
      var found = id === 'default' || readAiriCardsRaw().some(function (e) { return e[0] === id; });
      if (!found) return Promise.resolve({ ok: false, error: '卡片不存在' });
      try { localStorage.setItem('airi-card-active-id', id); } catch (e) { return Promise.resolve({ ok: false, error: '写入失败' }); }
      return Promise.resolve({ ok: true, needsReload: true });
    },
    // ========== 【2026-09-03】形象层 API：模型注册 + 卡绑形象 ==========
    // AIRI 内置 preset 模型清单（来自 display-models.ts mutex-BuITVS9W.js 实证）。
    presetModels: AIRI_PRESET_MODELS.slice(),
    // 列出所有可用模型：preset + 用户通过 injectModel 注册的自定义模型。
    // 走 iframe 内的 display-models store；未挂载时仅返回 preset 列表。
    listModels: function () {
      var out = AIRI_PRESET_MODELS.map(function (m) {
        return Object.assign({ source: 'preset' }, m);
      });
      try {
        var f = document.getElementById('va-airi-frame');
        if (f && f.contentDocument) {
          var app = f.contentDocument.querySelector('#app');
          var pinia = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$pinia;
          var dm = pinia && pinia._s && pinia._s.get('display-models');
          if (dm && Array.isArray(dm.displayModels)) {
            dm.displayModels.forEach(function (m) {
              if (m && m.id && out.findIndex(function (x) { return x.id === m.id; }) === -1) {
                out.push({ id: m.id, name: m.name || m.id, format: m.format, source: 'custom' });
              }
            });
          }
        }
      } catch (e) { /* iframe 未挂载，静默返回 preset */ }
      return out;
    },
    // 把星屿侧的资源（任意同源 URL）注册到 AIRI 的 display-models store。
    //   name   : 给模型起的名（必填，最后 fallback 到文件名）
    //   url    : 模型文件 URL（同源；AIRI 走 fetch+blob+File；不上传服务器）
    //   format : 'vrm' | 'live2d-zip' | 'spine-zip' | 'tachie-zip' | 'pmx-zip'
    // 返回 { ok, id, error }：id 是新生成的 'display-model-<nanoid>'，可塞到任何卡的 displayModelId
    injectModel: function (name, url, format) {
      var f = document.getElementById('va-airi-frame');
      if (!f || !f.contentDocument) return Promise.resolve({ ok: false, error: 'AIRI 未挂载，无法注册' });
      var app = f.contentDocument.querySelector('#app');
      var pinia = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$pinia;
      var dm = pinia && pinia._s && pinia._s.get('display-models');
      if (!dm || typeof dm.addDisplayModel !== 'function') {
        return Promise.resolve({ ok: false, error: 'AIRI display-models store 未就绪' });
      }
      var fmt = String(format || '').toLowerCase();
      var valid = { 'vrm': 1, 'live2d-zip': 1, 'spine-zip': 1, 'tachie-zip': 1, 'pmx-zip': 1 };
      if (!valid[fmt]) return Promise.resolve({ ok: false, error: '不支持的 format: ' + format });
      var fname = (String(name || '').trim() || (url.split('/').pop() || 'model'));
      return Promise.resolve().then(function () { return fetch(url); })
        .then(function (resp) {
          if (!resp.ok) throw new Error('fetch 失败 ' + resp.status);
          return resp.blob();
        })
        .then(function (blob) {
          var file = new File([blob], fname, { type: blob.type || 'application/octet-stream' });
          return dm.addDisplayModel(fmt, file);
        })
        .then(function () {
          // 新 id 在 displayModels.value 队首（addDisplayModel unshifts）
          var head = dm.displayModels && dm.displayModels[0];
          return { ok: true, id: head && head.id, name: fname, format: fmt };
        })
        .catch(function (e) { return { ok: false, error: '注入失败：' + (e && e.message || e) }; });
    },
    // 把某个 display model 绑到某张卡（写入卡的 modules.displayModelId）。
    // 优先走 AIRI 内部的 store.updateCard —— 这样激活卡时 applyActiveCardSettings 立即看到新值，
    // 不用 reload。store 不可用时降级写 localStorage 并提示 needsReload。
    setCardDisplayModel: function (cardId, modelId) {
      var st = airiCardStore();
      if (st && typeof st.updateCard === 'function') {
        var existing = (st.cards && (st.cards.get ? st.cards.get(cardId) : null))
          || (typeof st.getCard === 'function' ? st.getCard(cardId) : null);
        if (!existing) return Promise.resolve({ ok: false, error: '卡片不存在' });
        var patch = {
          extensions: {
            airi: {
              modules: Object.assign({}, existing.extensions && existing.extensions.airi && existing.extensions.airi.modules, { displayModelId: modelId }),
              agents: (existing.extensions && existing.extensions.airi && existing.extensions.airi.agents) || {},
            },
          },
        };
        return Promise.resolve(st.updateCard(cardId, patch))
          .then(function (r) {
            return r ? { ok: true, live: true } : { ok: false, error: 'updateCard 拒绝（卡不存在或同 id）' };
          })
          .catch(function (e) { return { ok: false, error: 'updateCard 失败：' + e }; });
      }
      var entries = readAiriCardsRaw();
      var hit = false;
      entries.forEach(function (pair) {
        if (pair[0] === cardId) {
          if (!pair[1].extensions) pair[1].extensions = {};
          if (!pair[1].extensions.airi) pair[1].extensions.airi = { modules: {}, agents: {} };
          if (!pair[1].extensions.airi.modules) pair[1].extensions.airi.modules = {};
          pair[1].extensions.airi.modules.displayModelId = modelId;
          hit = true;
        }
      });
      if (!hit) return Promise.resolve({ ok: false, error: '卡片不存在' });
      if (!writeAiriCardsRaw(entries)) return Promise.resolve({ ok: false, error: '写入失败' });
      return Promise.resolve({ ok: true, live: false, needsReload: true });
    },
    // ========== 形象层 API 结束 ==========
    remove: function (id) {
      var st = airiCardStore();
      if (st && typeof st.removeCard === 'function') {
        return Promise.resolve(st.removeCard(id)).then(function (r) {
          return r === false ? { ok: false, error: '默认卡不可删除' } : { ok: true, needsReload: false };
        });
      }
      if (id === 'default') return Promise.resolve({ ok: false, error: '默认卡不可删除' });
      writeAiriCardsRaw(readAiriCardsRaw().filter(function (e) { return e[0] !== id; }));
      try {
        if (localStorage.getItem('airi-card-active-id') === id) localStorage.setItem('airi-card-active-id', 'default');
      } catch (e) {}
      return Promise.resolve({ ok: true, needsReload: true });
    },
  };

  function cardNameOf(id) {
    var items = [];
    try { items = window.XingyuAiriCards.list(); } catch (e) {}
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i].name;
    return id;
  }

  function reloadAiriFrame(msg) {
    var f = document.getElementById('va-airi-frame');
    if (f) { try { f.contentWindow.location.reload(); } catch (e) {} }
    if (msg) toast(msg, 'ok');
    // 重载后视觉桥需要重新注入（麦克风标志在 localStorage，AIRI 会自行恢复开流）
    setTimeout(function () { try { scheduleVisionBridge(); } catch (e) {} }, 3000);
  }

  function applyMicOwnership(owner) {
    if (_micOwner === owner) { _micPending = null; return; }
    _micOwner = owner;
    _micPending = null;
    if (owner === 'airi') {
      // 小星交出麦克风，让 AIRI 独占（VAD -> SenseVoice -> DeepSeek -> VoxCPM 完整闭环）
      try { stopWakeListener(); } catch (e) {}
      // 写在 iframe 加载之前，AIRI 一启动就会自动开流
      try { localStorage.setItem(AIRI_MIC_FLAG, 'true'); } catch (e) {}
    }
    else {
      // AIRI 交出麦克风（iframe 置空后其流自然销毁），小星接管
      try { localStorage.setItem(AIRI_MIC_FLAG, 'false'); } catch (e) {}
      if (_wakeDesiredOn) { try { startWakeListener(); } catch (e) {} }
    }
  }

  // showAvatar() 开头会先调 hideAvatar()，立即切换会造成麦克风连续开关、
  // 权限指示灯闪烁甚至偶发开流失败。延后一拍结算，让同一次显/隐只落地一次。
  function setMicOwner(owner) {
    _micPending = owner;                 // 立刻生效于判断，避免防抖窗口里被误读成旧归属
    if (_micPending === _micOwner) _micPending = null;
    if (_micSyncTimer) { clearTimeout(_micSyncTimer); _micSyncTimer = null; }
    _micSyncTimer = setTimeout(function () {
      _micSyncTimer = null;
      applyMicOwnership(owner);
    }, 80);
  }

  // AIRI 是否真的在前台（iframe 正载着 /airi/，且形象模式是 AIRI 系）
  function airiInFront() {
    try {
      var frame = document.getElementById('va-airi-frame');
      if (!frame) return false;
      var src = frame.getAttribute('src') || '';
      if (src === '' || src === 'about:blank') return false;
      var m = getAvatarMode();
      return m === 'airi' || m === 'realistic3d' || m === 'anime';
    } catch (e) { return false; }
  }

  // 用户【主动】要跟小星说话（点主界面唤醒按钮 / Alt+M / 点悬浮球 / 喊唤醒词）时，
  // 允许小星从 AIRI 手里临时接管麦克风，说完再还回去。
  // 之前的规则是「AIRI 在前台一律拒绝」，结果在主界面点唤醒按钮毫无反应 ——
  // 用户看到的就是「唤醒不了」。主动操作要优先于前台交接的被动规则。
  function borrowMicFromAiri() {
    if (_micBorrowed) return true;
    _micBorrowed = true;
    // 只有 AIRI 真的持麦时才需要抢；持麦者已是小星时（如唤醒词应答），
    // 只打标记 —— 用途是告诉 showAvatar「先别给 AIRI 开耳」，
    // 以及让 idle 后的还麦机制知道这笔事务存在。
    if (micOwnerEffective() !== 'airi') return true;
    if (_micSyncTimer) { clearTimeout(_micSyncTimer); _micSyncTimer = null; }
    setAiriMicFlag(false);           // AIRI 的 VAD 收工（它的 store watch 到就会停流）
    _micPending = null;
    applyMicOwnership('xiaoxing');   // 立即生效，不等防抖
    return true;
  }

  // ---- 半双工：AIRI 开口说话时先把它的耳朵关掉，说完再打开 ----
  // 本地 VoxCPM 合成一句话要 10~40 秒，这段时间 AIRI 的 VAD 如果一直开着，
  // 环境噪声 / 你自己继续说话 / 它上一句的外放，都会触发新一轮录音，
  // 把正在合成的这一轮 abort 掉 —— 表现就是「能听见我说话，但 AIRI 不说话」。
  // /airi/index.html 里有一段同源 shim 监听 TTS 请求与真实播放，
  // 用 postMessage 把「我在说 / 我说完了」通知过来；这里负责翻 AIRI 的麦克风标志位。
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__airiVoice !== 'voice') return;
    var speaking = !!d.speaking;
    if (speaking === _airiSpeaking) return;
    _airiSpeaking = speaking;
    try {
      if (speaking) {
        setAiriMicFlag(false);                       // 闭耳，避免自己打断自己
      } else if (!_micBorrowed && airiInFront() && !isSpeaking()) {
        setAiriMicFlag(true);                        // 说完了，把耳朵还回去
        // 注意：若此刻小星正开口（唤醒应答/打字应答），不开耳，
        // 由下方的小星侧守护在它说完后统一归还。
      }
    } catch (err) {}
  });

  // 小星说完/闲下来后，把麦克风还给前台的 AIRI
  function returnMicToAiri() {
    if (!_micBorrowed) return;
    _micBorrowed = false;
    if (!airiInFront()) return;
    if (_micSyncTimer) { clearTimeout(_micSyncTimer); _micSyncTimer = null; }
    setAiriMicFlag(true);
    _micPending = null;
    applyMicOwnership('airi');
  }

  // ---- 半双工（小星侧）：小星开口期间把 AIRI 的耳朵按住，说完再还 ----
  // 此前只有 AIRI 说话→闭耳的方向；反方向（小星答题时 AIRI 麦还开着）
  // 是「双声重叠」的第二根源：AIRI 把用户半句话/小星的答题声听进去，
  // 又触发一轮应答。300ms 轮询比在每个 _speaking 翻转点打点更稳。
  var _xxEarHeld = false;
  setInterval(function () {
    var sp = false;
    try { sp = isSpeaking(); } catch (e) {}
    try {
      if (sp && !_xxEarHeld) {
        _xxEarHeld = true;
        if (airiInFront()) setAiriMicFlag(false);
      } else if (!sp && _xxEarHeld) {
        _xxEarHeld = false;
        if (!_micBorrowed && airiInFront()) setAiriMicFlag(true);
      }
    } catch (e) {}
  }, 300);

  function showAvatar() {
    if (location.protocol === 'file:') return Promise.resolve(true);
    var mode = getAvatarMode();
    if (mode === 'airi' || mode === 'realistic3d' || mode === 'anime') {
      // 【方案 A：会话与面板解耦】AIRI 已在前台（迷你球/收起态）时，
      // 绝不走 hideAvatar() 重建 —— 重建会 src=about:blank 杀掉整个会话。
      // 只需恢复可见性，语音管线原样继续。
      if (airiInFront()) {
        document.body.classList.remove('va-airi-min');
        var st0 = document.getElementById('va-avatar-stage');
        if (st0) st0.classList.add('is-visible', 'is-airi');
        document.body.classList.add('va-airi-native');
        if (!_micBorrowed) setAiriMicFlag(true);
        setMicOwner('airi');
        return Promise.resolve(true);
      }
      hideAvatar();
      // 先把本地的 大脑/嘴/耳朵 写进 AIRI 的 provider 配置，再加载，避免它弹首次引导
      ensureAiriProviders();
      // 关键顺序：标志位先落盘，再让 iframe 加载。反过来的话 AIRI 启动读到 false，
      // 就再也不会自动开流（VAD 全程静默，表现为"能打字没声音、说话没反应"）。
      // 例外：小星正在应答（_micBorrowed，如唤醒词事务）时先别开耳，
      // 否则 AIRI 会把用户还在说的半句话听进去，和小星的回答撞在一起。
      if (!_micBorrowed) setAiriMicFlag(true);
      var stage = ensureAiriFrameStage();
      var frame = document.getElementById('va-airi-frame');
      // 2026-09-02: 改用本地同源镜像（镜像在 ai-student-platform/airi/）。
      // 同源后 AIRI 与星屿共享 localStorage、麦克风与音频链路，语音不再被 iframe 隔裂。
      if (frame && frame.getAttribute('src') !== '/airi/') frame.setAttribute('src', '/airi/');
      // 视觉桥：等 AIRI 挂载后注入；若用户此前开过视觉（va_vision_enabled=1）会自动恢复
      scheduleVisionBridge();
      setMicOwner('airi'); // 麦克风交给 AIRI，小星闭麦待命
      return Promise.resolve(true);
    }
    if (mode === 'live2d') {
      hideAvatar();
      ensureLive2dStage();
      if (avatarWidget) return Promise.resolve(true);
      return loadAvatarLibrary().then(function () {
      if (!window.L2D_WIDGET || !window.L2D_WIDGET.createWidget) return false;
      avatarWidget = window.L2D_WIDGET.createWidget({
        model: {
          path: '/assets/live2d/koharu/model.json?v=20260901.1',
          tips: { welcomeMessage: [], messages: [] }
        },
        position: 'bottom-left',
        size: 260,
          menus: false,
          statusBar: false,
          logLevel: 'warn'
        });
        setTimeout(mountLive2dToStage, 0);
        return true;
      }).catch(function (e) {
        console.warn('[VoiceAgent] avatar:', e);
        return false;
      });
    }
    if (mode === 'mic' || mode === 'none' || mode === 'hidden') {
      hideAvatar();
      return Promise.resolve(true);
    }
    try { if (avatarWidget) { var w = avatarWidget; avatarWidget = null; w.destroy(); } } catch (e) {}
    hideRealisticFrame();
  }

  function hideAvatar() {
    // AIRI 都退场了，小星对它的"借用"自然作废，不用再还
    _micBorrowed = false;
    _airiSpeaking = false;
    document.body.classList.remove('va-airi-min');   // 迷你球态一并退场
    // 同上：退场先把标志位同步置回 false，避免 iframe 还没销毁时 AIRI 又去读旧值
    setAiriMicFlag(false);
    try { if (avatarWidget) { var w = avatarWidget; avatarWidget = null; w.destroy(); } } catch (e) {}
    try { if (avatarWidgetRoot) { avatarWidgetRoot.remove(); } } catch (e) {}
    avatarWidgetRoot = null;
    disposeAgentRuntime();
    var stage = document.getElementById('va-avatar-stage');
    if (stage) stage.classList.remove('is-visible', 'is-live2d', 'is-runtime', 'is-airi');
    document.body.classList.remove('va-airi-native');
    var airiFrame = document.getElementById('va-airi-frame');
    if (airiFrame) airiFrame.setAttribute('src', 'about:blank');
    hideRealisticFrame();
    setMicOwner('xiaoxing'); // AIRI 退场，麦克风还给小星
  }

  var LAYOUT_KEY = 'va_agent_layout_v1';
  function getAgentLayout() {
    try { return localStorage.getItem(LAYOUT_KEY) === 'cockpit' ? 'cockpit' : 'companion'; }
    catch (e) { return 'companion'; }
  }
  function setAgentLayout(mode) {
    var m = mode === 'cockpit' ? 'cockpit' : 'companion';
    try { localStorage.setItem(LAYOUT_KEY, m); } catch (e) {}
    document.body.classList.toggle('va-layout-companion', m === 'companion');
    document.body.classList.toggle('va-layout-cockpit', m === 'cockpit');
    return m;
  }

  var AVATAR_MODE_KEY = 'va_avatar_mode_v1';
  function getAvatarMode() {
    try {
      var m = localStorage.getItem(AVATAR_MODE_KEY);
      return (m === 'realistic3d' || m === 'anime') ? 'airi' : (m || 'airi');
    } catch (e) { return 'airi'; }
  }
  function setAvatarMode(mode) {
    try { localStorage.setItem(AVATAR_MODE_KEY, mode); } catch (e) {}
    var r = document.querySelector('.va-root');
    if (r) r.dataset.avatar = mode;
    var panelOpen = document.body.classList.contains('va-panel-open');
    if (panelOpen && (mode === 'airi' || mode === 'realistic3d' || mode === 'live2d' || mode === 'mic')) showAvatar(); else hideAvatar();
  }

  /* ================= 自我迭代：记录经验 → 提炼策略 → 下轮自动使用 ================= */
  var EV_KEY = 'xingyu_agent_evolution_v1';

  function loadEvolution() {
    try {
      var o = JSON.parse(localStorage.getItem(EV_KEY) || '{}');
      return {
        events: Array.isArray(o.events) ? o.events : [],
        lessons: Array.isArray(o.lessons) ? o.lessons : [],
        lastEvolveAt: Number(o.lastEvolveAt || 0)
      };
    } catch (e) {
      return { events: [], lessons: [], lastEvolveAt: 0 };
    }
  }
  function saveEvolution(ev) {
    try {
      ev.events = (ev.events || []).slice(-80);
      ev.lessons = (ev.lessons || []).slice(-24);
      localStorage.setItem(EV_KEY, JSON.stringify(ev));
    } catch (e) {}
  }
  function redactArgs(args) {
    try {
      var o = Object.assign({}, args || {});
      ['apiKey', 'token', 'password', 'pin'].forEach(function (k) {
        if (o[k]) o[k] = String(o[k]).slice(0, 4) + '****';
      });
      return o;
    } catch (e) { return {}; }
  }
  function recordToolEvent(tool, args, ok, msg) {
    var ev = loadEvolution();
    ev.events.push({
      at: new Date().toISOString(),
      tool: String(tool || ''),
      args: redactArgs(args),
      ok: !!ok,
      msg: String(msg || '').slice(0, 220)
    });
    if (!ok) {
      ev.lessons.push({
        at: new Date().toISOString(),
        source: 'auto',
        kind: 'failure',
        text: '工具 ' + (tool || 'unknown') + ' 曾失败：' + String(msg || '').slice(0, 140) + '。下次先检查参数/页面状态，必要时换更合适的工具。'
      });
    }
    saveEvolution(ev);
  }
  function addLesson(text, kind) {
    var ev = loadEvolution();
    var t = String(text || '').trim();
    if (!t) return { ok: true, msg: '经验为空，未保存' };
    ev.lessons.push({
      at: new Date().toISOString(),
      source: 'agent',
      kind: kind || 'strategy',
      text: t.slice(0, 240)
    });
    saveEvolution(ev);
    return { ok: true, msg: '已记住这条改进策略：' + t };
  }
  function evolutionPrompt() {
    var ev = loadEvolution();
    var recent = (ev.lessons || []).slice(-8);
    if (!recent.length) return '';
    return '\n\n【自我迭代经验】\n这些是你以前执行任务后总结的策略。涉及同类任务时优先应用，不要重复以前的失败：\n' +
      recent.map(function (x, i) { return (i + 1) + '. ' + (x.text || ''); }).join('\n');
  }
  function shouldEvolve() {
    var ev = loadEvolution();
    var since = (ev.events || []).filter(function (x) { return Date.parse(x.at || 0) > (ev.lastEvolveAt || 0); });
    var failed = since.filter(function (x) { return !x.ok; }).length;
    return since.length >= 8 || failed >= 2;
  }
  function evolveAsync() {
    if (location.protocol === 'file:' || !shouldEvolve()) return Promise.resolve(false);
    var ev = loadEvolution();
    var rows = (ev.events || []).slice(-18).map(function (x, i) {
      return (i + 1) + '. [' + (x.ok ? '成功' : '失败') + '] ' + x.tool + ' 参数=' + JSON.stringify(x.args || {}).slice(0, 160) + ' 结果=' + (x.msg || '');
    }).join('\n');
    var sys = '你是星屿智能体的自我改进器。根据最近工具执行记录，提炼 1-3 条以后必须遵守的操作策略。\n' +
      '只输出 JSON 数组，不要 markdown。格式：[{"kind":"strategy","text":"..."}]。\n' +
      '规则：每条不超过 60 个汉字；必须具体可执行；避免泛泛而谈；优先总结失败原因和成功路径。';
    return callLLM([
      { role: 'system', content: sys },
      { role: 'user', content: '最近执行记录：\n' + (rows || '暂无') }
    ]).then(function (m) {
      var raw = String(m && m.content || '').replace(/^```(?:json)?|```$/g, '').trim();
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error('格式错误');
      var cur = loadEvolution();
      arr.slice(0, 3).forEach(function (x) {
        if (x && x.text) cur.lessons.push({ at: new Date().toISOString(), source: 'self-review', kind: x.kind || 'strategy', text: String(x.text).slice(0, 240) });
      });
      cur.lastEvolveAt = Date.now();
      saveEvolution(cur);
      return true;
    }).catch(function () { return false; });
  }

  /* ---------- AI 配置 ---------- */
  function aiCfg() {
    var base = 'https://api.deepseek.com/v1', key = '', model = 'deepseek-chat';
    try {
      if (S()) {
        var s = S().getSettings() || {};
        base = s.baseUrl || base;
        key = s.apiKey || '';
        model = s.model || model;
      }
    } catch (e) {}
    try {
      var lc = window.LOCAL_CONFIG || {};
      if (lc.apiKey) { key = lc.apiKey; base = lc.baseUrl || base; model = lc.model || model; }
    } catch (e) {}
    if (!base) base = 'https://api.deepseek.com/v1';
    base = base.replace(/\/+$/, '');
    return { baseUrl: base, apiKey: key, model: model };
  }

  /* ---------- 视图中文名 → data-view ---------- */
  var VIEW_MAP = {
    'dashboard': 'dashboard', '今日': 'dashboard', '首页': 'dashboard', '主页': 'dashboard', '仪表盘': 'dashboard',
    'courses': 'courses', '课程': 'courses', '课表': 'courses', '作业': 'courses', '任务': 'courses',
    'focus': 'focus', '专注': 'focus', '番茄': 'focus', '番茄钟': 'focus', '计时': 'focus',
    'weather': 'weather', '天气': 'weather',
    'exams': 'exams', '考试': 'exams', '倒计时': 'exams',
    'notes': 'notes', '笔记': 'notes', '笔记库': 'notes',
    'lit': 'lit', '文献': 'lit', '资料': 'lit', '文献资料': 'lit',
    'news': 'news', '新闻': 'news', '热点': 'news',
    'growth': 'growth', '成长': 'growth', '成长档案': 'growth',
    'ai': 'ai', 'ai助手': 'ai', '助手': 'ai', '聊天': 'ai',
    'voice': 'voice', '语音': 'voice',
    'aria': 'aria',
    'running': 'running', '跑步': 'running', '训练': 'running',
    'prisma': 'prisma', '棱镜': 'prisma', '棱镜艺境': 'prisma',
    'nexus': 'nexus', '云门': 'nexus', '智界': 'nexus',
    'foldcraft': 'foldcraft', '折艺': 'foldcraft', '折艺工坊': 'foldcraft',
    'securify': 'securify', '守御': 'securify', '守御界': 'securify',
    'particles': 'particles', '粒子': 'particles', '粒子星云': 'particles',
    'toolknit': 'toolknit', '工具': 'toolknit', '工具箱': 'toolknit'
  };

  /* ---------- 小工具 ---------- */
  function nowInfo() {
    var d = new Date();
    var wd = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return {
      iso: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()),
      cn: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + wd,
      hm: p(d.getHours()) + ':' + p(d.getMinutes()),
      weekday: d.getDay(),
      hour: d.getHours()
    };
  }
  function fmtDate(iso) {
    if (!iso) return '无';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function courseName(id) {
    try { if (S() && S().getCourseName) return S().getCourseName(id) || ''; } catch (e) {}
    return '';
  }
  function findByName(list, kw) {
    if (!kw) return null;
    kw = String(kw).toLowerCase();
    var exact = null, fuzzy = null;
    (list || []).forEach(function (it) {
      var t = String(it.title || it.name || '').toLowerCase();
      if (t === kw) exact = it;
      else if (!fuzzy && t.indexOf(kw) >= 0) fuzzy = it;
    });
    return exact || fuzzy;
  }
  function refreshView(view) {
    // 切到目标视图会触发 renderCurrent()；已在目标视图时重复点击即刷新
    var el = document.querySelector('.nav-item[data-view="' + view + '"]');
    if (el) { el.click(); return true; }
    return false;
  }

  /* ================= 工具定义（给 LLM 看） ================= */
  var TOOLS = [
    {
      type: 'function',
      function: {
        name: 'get_overview',
        description: '获取今日概览：待办数量、今天的课、天气、最近专注记录。用户问「今天怎么样」「有什么安排」「总结一下」时调用。',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_tasks',
        description: '列出待办任务。可按状态和数量过滤。',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['todo', 'doing', 'done', 'all'], description: '默认 all' },
            limit: { type: 'number', description: '最多几条，默认 10' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'add_task',
        description: '添加一个待办任务（作业、复习、背诵等都用它）。',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '任务标题，简短明确' },
            course: { type: 'string', description: '所属课程名，可留空' },
            due: { type: 'string', description: '截止时间，ISO 格式 2026-09-02T23:59:00；没有就留空' },
            priority: { type: 'string', enum: ['high', 'mid', 'low'], description: '优先级，默认 mid' },
            estimate: { type: 'number', description: '预计分钟数，可留空' }
          },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'complete_task',
        description: '把某个待办标记为已完成。按标题模糊匹配。',
        parameters: {
          type: 'object',
          properties: { title: { type: 'string', description: '任务标题关键词' } },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_task',
        description: '删除某个待办任务。按标题模糊匹配。',
        parameters: {
          type: 'object',
          properties: { title: { type: 'string', description: '任务标题关键词' } },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'start_focus',
        description: '开始专注计时（番茄钟），会自动进入全屏沉浸场景。',
        parameters: {
          type: 'object',
          properties: { minutes: { type: 'number', description: '专注分钟数，默认 25' } }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'switch_view',
        description: '切换到某个功能页面。',
        parameters: {
          type: 'object',
          properties: {
            view: {
              type: 'string',
              description: '页面名，可用中文：今日/课程/专注/天气/考试/笔记/文献/新闻/成长/AI助手/语音/跑步/棱镜/云门/折艺/守御/粒子/工具箱'
            }
          },
          required: ['view']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'add_note',
        description: '新建一条笔记。',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '笔记标题' },
            content: { type: 'string', description: '笔记正文' },
            subject: { type: 'string', description: '科目，如 高等数学' }
          },
          required: ['title']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_notes',
        description: '列出最近的笔记。',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'number', description: '默认 5' } }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_all',
        description: '在笔记、任务、课程、文献里全局搜索关键词。',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: '搜索关键词' } },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: '查询天气。不传城市则用当前设置的城市。',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string', description: '城市名，如 长沙；留空用当前城市' } }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_courses',
        description: '查询课表。可指定星期几（1=周一…7=周日），不传则查今天。',
        parameters: {
          type: 'object',
          properties: { day: { type: 'number', description: '1-7，不传=今天' } }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_exams',
        description: '列出考试倒计时（最近的考试及剩余天数）。',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'toggle_effect',
        description: '开关界面动效（如卡片光晕、点击火花、3D 倾斜等）。',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: '效果名：卡片光晕/点击火花/点击涟漪/图标磁吸/3D倾斜/边框流光/光标柔光/文字光扫/标题渐变/错落入场'
            },
            on: { type: 'boolean', description: 'true 开，false 关' }
          },
          required: ['name', 'on']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'open_settings',
        description: '打开星屿设置界面，可指定标签页：外观/个人/智能/安全与同步/系统与数据。',
        parameters: {
          type: 'object',
          properties: { tab: { type: 'string', description: '设置标签页，如 外观、个人、智能、安全与同步、系统与数据' } }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_settings',
        description: '读取平台当前设置摘要（主题、背景、昵称、AI模型、代理等，不返回完整密钥）。',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_theme',
        description: '切换平台主题。支持：system/dark/light/ocean/forest/sepia/purple/wine/dusk/mist/mint/honey/guishan/danxia/qingzang/caoyuan/damo/custom 或中文名。',
        parameters: {
          type: 'object',
          properties: { theme: { type: 'string', description: '主题名，如 墨蓝、纯白、青竹、dark、ocean' } },
          required: ['theme']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_background',
        description: '切换平台背景：none/guilin-mist/guilin-aerial/jiuzhaigou/zhangjiajie 或中文名。',
        parameters: {
          type: 'object',
          properties: { background: { type: 'string', description: '背景名，如 无、桂林·雾山、九寨沟、张家界' } },
          required: ['background']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_nickname',
        description: '修改平台设置里的用户昵称。',
        parameters: {
          type: 'object',
          properties: { nickname: { type: 'string', description: '新的昵称' } },
          required: ['nickname']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_ai_config',
        description: '修改 AI 接口配置。除非用户明确要求，否则不要调用。apiKey 只在用户明确给出新值时修改。',
        parameters: {
          type: 'object',
          properties: {
            baseUrl: { type: 'string', description: 'OpenAI兼容接口地址' },
            apiKey: { type: 'string', description: '新的 API Key' },
            model: { type: 'string', description: '模型名，如 deepseek-chat' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'save_learning',
        description: '保存自我改进策略。当用户纠正你、工具失败后找到成功路径、或你发现更稳定的执行方法时调用。',
        parameters: {
          type: 'object',
          properties: { lesson: { type: 'string', description: '一条具体、以后可复用的操作策略' }, kind: { type: 'string', enum: ['strategy', 'failure', 'preference'] } },
          required: ['lesson']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: '联网搜索最新信息。用户问时事、新闻以外的网络信息，或说「搜一下」「查查」时调用。',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: '搜索关键词' } },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'open_website',
        description: '在浏览器里打开一个网站。',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: '网址，如 bilibili.com' } },
          required: ['url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'platform_click',
        description: '通用平台控制兜底工具：按可见按钮/开关/选项的文字点击平台界面。专用工具（add_task、set_theme 等）能完成时优先用专用工具。',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string', description: '按钮/控件上的文字，例如「添加待办」' } },
          required: ['text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'platform_input',
        description: '通用平台输入工具：向平台可见输入框/选择框填写内容。用于没有专用工具的表单。',
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string', description: '输入框 placeholder/label/id 里的关键词' },
            value: { type: 'string', description: '要输入或选择的值' }
          },
          required: ['target', 'value']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'describe_screen',
        description: '查看当前平台界面：可见页面、主要按钮、表单、智能体状态。用于发现可以操作的控件。',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'configure_agent',
        description: '调整智能体自身：形象、语音播报、语音唤醒。',
        parameters: {
          type: 'object',
          properties: {
            item: { type: 'string', enum: ['avatar','speak','wake'], description: '要调整的项目' },
            value: { type: 'string', description: 'avatar 可用 airi/live2d；speak 和 wake 可用 on/off' }
          },
          required: ['item', 'value']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_news',
        description: '读取今日新闻热点并汇报。',
        parameters: {
          type: 'object',
          properties: { count: { type: 'number', description: '条数，默认 5' } }
        }
      }
    }
  ];

  /* ================= 工具执行 ================= */
  function execTool(name, args) {
    args = args || {};
    var st = S();
    if (!st) return { ok: false, msg: '数据层不可用，请刷新页面重试' };

    try {
      /* ---- 概览 ---- */
      if (name === 'get_overview') {
        var tasks = st.getAll('tasks') || [];
        var todo = tasks.filter(function (t) { return t.status !== 'done'; });
        var d = nowInfo();
        var cs = (st.getAll('courses') || []).filter(function (c) { return c.day === (d.weekday === 0 ? 7 : d.weekday); })
          .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
        var pomo = st.getAll('pomodoros') || [];
        var todayP = pomo.filter(function (p) {
          return p.date && String(p.date).slice(0, 10) === d.iso;
        }).length;
        return {
          ok: true,
          msg: '今天是 ' + d.cn + '，现在 ' + d.hm + '。\n' +
            '未完成待办 ' + todo.length + ' 条' +
            (todo.length ? '：' + todo.slice(0, 5).map(function (t) { return t.title; }).join('、') + (todo.length > 5 ? ' 等' : '') : '') + '。\n' +
            (cs.length ? '今天有 ' + cs.length + ' 节课：' + cs.map(function (c) { return c.start + ' ' + c.name; }).join('，') + '。' : '今天没课。') + '\n' +
            '今天已完成 ' + todayP + ' 个番茄钟。'
        };
      }

      /* ---- 待办 ---- */
      if (name === 'list_tasks') {
        var list = st.getAll('tasks') || [];
        var s = args.status || 'all';
        if (s !== 'all') list = list.filter(function (t) { return (t.status || 'todo') === s; });
        var lim = args.limit || 10;
        if (!list.length) return { ok: true, msg: s === 'all' ? '还没有任何待办。' : '没有符合条件的待办。' };
        var txt = list.slice(0, lim).map(function (t, i) {
          return (i + 1) + '. ' + t.title +
            (t.due ? '（截止 ' + fmtDate(t.due) + '）' : '') +
            (t.priority === 'high' ? ' [高优先]' : '') +
            (t.status === 'done' ? ' [已完成]' : '');
        }).join('\n');
        return { ok: true, msg: '共 ' + list.length + ' 条：\n' + txt };
      }
      if (name === 'add_task') {
        if (!args.title) return { ok: false, msg: '缺少任务标题' };
        var courseId = '';
        if (args.course) {
          var c = findByName(st.getAll('courses') || [], args.course);
          if (c) courseId = c.id;
        }
        // 兜底：若 LLM 给的日期早于今天（模型算错年份），直接丢弃时间
        var due = args.due || '';
        if (due) {
          var dd = new Date(due);
          if (isNaN(dd) || dd.getFullYear() < new Date().getFullYear()) due = '';
        }
        st.add('tasks', {
          title: args.title,
          courseId: courseId,
          due: due,
          priority: args.priority || 'mid',
          status: 'todo',
          estimate: args.estimate || 30
        });
        refreshView('courses');
        return { ok: true, msg: '已添加待办「' + args.title + '」' + (due ? '，截止 ' + fmtDate(due) : '') + (courseId ? '（' + args.course + '）' : '') };
      }
      if (name === 'complete_task') {
        var tasks2 = st.getAll('tasks') || [];
        var t1 = findByName(tasks2, args.title);
        if (!t1) return { ok: false, msg: '没找到叫「' + args.title + '」的待办' };
        st.update('tasks', t1.id, { status: 'done' });
        refreshView('courses');
        return { ok: true, msg: '已完成「' + t1.title + '」，很棒！' };
      }
      if (name === 'delete_task') {
        var tasks3 = st.getAll('tasks') || [];
        var t2 = findByName(tasks3, args.title);
        if (!t2) return { ok: false, msg: '没找到叫「' + args.title + '」的待办' };
        st.remove('tasks', t2.id);
        refreshView('courses');
        return { ok: true, msg: '已删除「' + t2.title + '」' };
      }

      /* ---- 专注 ---- */
      if (name === 'start_focus') {
        var min = Math.max(1, Math.min(180, Number(args.minutes) || 25));
        var wEl = document.getElementById('pomoWork');
        var bEl = document.getElementById('btnPomoStart');
        if (!bEl) return { ok: false, msg: '专注功能未加载' };
        if (wEl) wEl.value = min;
        bEl.click();
        return { ok: true, msg: '已开始 ' + min + ' 分钟专注，加油！' };
      }

      /* ---- 视图 ---- */
      if (name === 'switch_view') {
        var key = String(args.view || '').toLowerCase().trim();
        var view = VIEW_MAP[key] || VIEW_MAP[args.view] || (VIEW_MAP[key] ? VIEW_MAP[key] : null);
        // 直接就是 data-view 名
        if (!view && document.querySelector('.nav-item[data-view="' + key + '"]')) view = key;
        if (!view) return { ok: false, msg: '没有「' + args.view + '」这个页面' };
        var ok = refreshView(view);
        return { ok: ok, msg: ok ? '已切换到「' + args.view + '」' : '切换失败，页面可能未加载' };
      }

      /* ---- 笔记 ---- */
      if (name === 'add_note') {
        if (!args.title) return { ok: false, msg: '缺少笔记标题' };
        var nowIso = new Date().toISOString();
        st.add('notes', {
          title: args.title,
          content: args.content || '',
          subject: args.subject || '',
          tags: [],
          createdAt: nowIso,
          updatedAt: nowIso
        });
        refreshView('notes');
        return { ok: true, msg: '已记下笔记「' + args.title + '」' };
      }
      if (name === 'list_notes') {
        var notes = st.getAll('notes') || [];
        var nl = args.limit || 5;
        if (!notes.length) return { ok: true, msg: '还没有笔记。' };
        notes.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
        return {
          ok: true,
          msg: '共 ' + notes.length + ' 条，最近 ' + Math.min(nl, notes.length) + ' 条：\n' +
            notes.slice(0, nl).map(function (n, i) {
              return (i + 1) + '. ' + n.title + (n.subject ? '（' + n.subject + '）' : '');
            }).join('\n')
        };
      }

      /* ---- 搜索 ---- */
      if (name === 'search_all') {
        var q = String(args.query || '').toLowerCase();
        if (!q) return { ok: false, msg: '缺少搜索词' };
        var hits = [];
        (st.getAll('notes') || []).forEach(function (n) {
          if ((n.title + ' ' + (n.content || '')).toLowerCase().indexOf(q) >= 0) hits.push('笔记：' + n.title);
        });
        (st.getAll('tasks') || []).forEach(function (t) {
          if (String(t.title).toLowerCase().indexOf(q) >= 0) hits.push('待办：' + t.title);
        });
        (st.getAll('courses') || []).forEach(function (c) {
          if (String(c.name).toLowerCase().indexOf(q) >= 0) hits.push('课程：' + c.name);
        });
        (st.getAll('literature') || []).forEach(function (l) {
          if ((l.title + ' ' + (l.authors || '')).toLowerCase().indexOf(q) >= 0) hits.push('文献：' + l.title);
        });
        if (!hits.length) return { ok: true, msg: '没搜到与「' + args.query + '」相关的内容。' };
        return { ok: true, msg: '搜到 ' + hits.length + ' 条：\n' + hits.slice(0, 8).join('\n') };
      }

      /* ---- 天气 ---- */
      if (name === 'get_weather') {
        return execWeather(args.city);
      }

      /* ---- 课表 ---- */
      if (name === 'list_courses') {
        var day = args.day;
        if (!day) { var w = nowInfo().weekday; day = w === 0 ? 7 : w; }
        var all = st.getAll('courses') || [];
        var cs2 = all.filter(function (c) { return Number(c.day) === Number(day); })
          .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
        var dn = ['一', '二', '三', '四', '五', '六', '日'][day - 1] || day;
        if (!cs2.length) return { ok: true, msg: '星期' + dn + '没有课。' };
        return {
          ok: true,
          msg: '星期' + dn + '有 ' + cs2.length + ' 节课：\n' +
            cs2.map(function (c) {
              return c.start + '-' + c.end + ' ' + c.name + (c.location ? ' @' + c.location : '');
            }).join('\n')
        };
      }

      /* ---- 考试 ---- */
      if (name === 'list_exams') {
        var ex = st.getAll('exams') || [];
        if (!ex.length) return { ok: true, msg: '还没有添加考试安排。' };
        var today = new Date();
        var rows = ex.map(function (e) {
          var d = new Date(e.date);
          var days = Math.ceil((d - today) / 86400000);
          return e.name + '：' + fmtDate(e.date) + '（' + (days >= 0 ? '还有 ' + days + ' 天' : '已过去') + '）';
        }).sort();
        return { ok: true, msg: '考试安排：\n' + rows.join('\n') };
      }

      /* ---- 动效 ---- */
      if (name === 'toggle_effect') {
        if (!window.RBFx) return { ok: false, msg: '动效模块未加载' };
        var nm = String(args.name || '');
        var map = {
          '卡片光晕': 'glare', '光晕': 'glare',
          '点击火花': 'spark', '火花': 'spark',
          '点击涟漪': 'ripple', '涟漪': 'ripple',
          '图标磁吸': 'magnet', '磁吸': 'magnet',
          '3d倾斜': 'tilt', '倾斜': 'tilt',
          '边框流光': 'glowBorder', '流光': 'glowBorder',
          '光标柔光': 'blobCursor', '柔光': 'blobCursor',
          '文字光扫': 'shine', '光扫': 'shine',
          '标题渐变': 'gradTitle', '渐变': 'gradTitle',
          '错落入场': 'staggerIn', '入场': 'staggerIn'
        };
        var k = map[nm.toLowerCase()] || map[nm];
        if (!k) return { ok: false, msg: '没有「' + nm + '」这个动效' };
        window.RBFx.set(k, !!args.on);
        return { ok: true, msg: '已' + (args.on ? '开启' : '关闭') + '「' + nm + '」' };
      }

      /* ---- 联网搜索（经智能体本地服务，cn.bing） ---- */
      /* ---- 设置操控 ---- */
      if (name === 'open_settings') {
        var tabMap = { '外观': 'appearance', '个人': 'personal', '智能': 'intelligence', '智能体': 'agent', '安全与同步': 'access', '系统与数据': 'system', 'appearance': 'appearance', 'personal': 'personal', 'intelligence': 'intelligence', 'agent': 'agent', 'access': 'access', 'system': 'system' };
        var wantTab = tabMap[args.tab || ''] || '';
        var modal = document.getElementById('settingsModal');
        if (!modal) return Promise.resolve({ ok: false, msg: '设置界面未加载' });
        var doTab = function () {
          if (!wantTab) return;
          var tb = document.querySelector('.settings-tab[data-settings-tab="' + wantTab + '"]');
          if (tb) tb.click();
        };
        if (modal.classList.contains('show')) { doTab(); return Promise.resolve({ ok: true, msg: '已打开设置' + (wantTab ? '并切到对应页面' : '') }); }
        var btn = document.getElementById('btnSettings');
        if (!btn) return Promise.resolve({ ok: false, msg: '找不到设置入口' });
        btn.click();
        return new Promise(function (resolve) {
          setTimeout(function () { doTab(); resolve({ ok: true, msg: '已打开设置' + (wantTab ? '并切到对应页面' : '') }); }, 260);
        });
      }
      if (name === 'get_settings') {
        var ss = (st.getSettings && st.getSettings()) || {};
        var curTheme = document.documentElement.dataset.theme || 'system';
        var curBg = localStorage.getItem('zero_bg') || '';
        return {
          ok: true,
          msg: '当前设置：主题=' + curTheme + '；背景=' + (curBg || '默认') + '；昵称=' + (ss.nickname || '未设置') +
               '；AI模型=' + (ss.model || 'deepseek-chat') + '；AI地址=' + (ss.baseUrl || 'https://api.deepseek.com/v1') +
               '；本地AI代理=' + (ss.useLocalAiProxy ? '开' : '关') + '；APIKey=' + (ss.apiKey ? '已配置(' + String(ss.apiKey).slice(0, 4) + '****)' : '未配置') +
               '；智能体形象=' + getAvatarMode() + '；语音播报=' + (UI.speakOn() ? '开' : '关') + '；语音唤醒=' + (wakeOn ? '开' : '关')
        };
      }
      if (name === 'set_theme') {
        var themeMap = { '跟随系统': 'system', '系统': 'system', '纯黑': 'dark', '深色': 'dark', '纯白': 'light', '浅色': 'light', '墨蓝': 'ocean', '青竹': 'forest', '纸墨': 'sepia', '暮紫': 'purple', '酒红': 'wine', '晚霞': 'dusk', '云灰': 'mist', '薄荷': 'mint', '蜜糖': 'honey', '桂山': 'guishan', '丹霞': 'danxia', '青藏': 'qingzang', '草原': 'caoyuan', '大漠': 'damo', '自定义': 'custom' };
        var tv = themeMap[args.theme || ''] || String(args.theme || '').toLowerCase().trim();
        var tBtn = document.querySelector('[data-theme-pick="' + tv + '"]');
        if (!tBtn) return { ok: false, msg: '没有这个主题：' + args.theme };
        var adv = document.getElementById('btnToggleAdvancedThemes');
        var advOpen = document.getElementById('themeCustom');
        if (adv && advOpen && advOpen.style.display === 'none' && ['guishan', 'danxia', 'qingzang', 'caoyuan', 'damo', 'custom'].indexOf(tv) >= 0) adv.click();
        tBtn.click();
        return { ok: true, msg: '已切换主题到「' + args.theme + '」' };
      }
      if (name === 'set_background') {
        var bgMap = { '无': 'none', '关闭背景': 'none', '桂林雾山': 'guilin-mist', '桂林·雾山': 'guilin-mist', '桂林航拍': 'guilin-aerial', '桂林·航拍': 'guilin-aerial', '九寨沟': 'jiuzhaigou', '张家界': 'zhangjiajie' };
        var bv = bgMap[args.background || ''] || String(args.background || '').toLowerCase().trim();
        var bBtn = document.querySelector('[data-bg-pick="' + bv + '"]');
        if (!bBtn) return { ok: false, msg: '没有这个背景：' + args.background };
        bBtn.click();
        return { ok: true, msg: '已切换背景到「' + args.background + '」' };
      }
      if (name === 'set_nickname') {
        var nick = String(args.nickname || '').trim();
        if (!nick) return { ok: false, msg: '昵称不能为空' };
        if (st.setSettings) st.setSettings({ nickname: nick });
        if (st.setProfile) st.setProfile({ name: nick });
        return { ok: true, msg: '已把昵称改成「' + nick + '」' };
      }
      if (name === 'set_ai_config') {
        var patch = {};
        if (args.baseUrl) patch.baseUrl = String(args.baseUrl).trim();
        if (args.model) patch.model = String(args.model).trim();
        if (args.apiKey) patch.apiKey = String(args.apiKey).trim();
        if (!Object.keys(patch).length) return { ok: false, msg: '没有要修改的 AI 配置' };
        if (st.setSettings) st.setSettings(patch);
        return { ok: true, msg: 'AI 配置已更新' + (patch.model ? '，模型=' + patch.model : '') };
      }
      if (name === 'save_learning') {
        return addLesson(args.lesson, args.kind || 'strategy');
      }

      if (name === 'web_search') {
        var q = String(args.query || '').trim();
        if (!q) return { ok: false, msg: '缺少搜索关键词' };
        return fetch('/agent-proxy/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, max: 5 })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j.error) return { ok: false, msg: '搜索失败：' + j.error };
          var rs = j.results || [];
          if (!rs.length) return { ok: false, msg: '没搜到「' + q + '」的结果' };
          var lines = rs.map(function (it, i) {
            return (i + 1) + '. ' + it.title + '\n' + (it.snippet || '') + '\n来源: ' + it.url;
          }).join('\n');
          return { ok: true, msg: '「' + q + '」搜索结果：\n' + lines + '\n请基于以上结果用简短口语回答用户，不要照读网址。' };
        }).catch(function (e) {
          return { ok: false, msg: '搜索失败：' + (e && e.message ? e.message : e) };
        });
      }

      /* ---- 打开网页 ---- */
      if (name === 'open_website') {
        var url = String(args.url || '').trim();
        if (!url) return { ok: false, msg: '缺少网址' };
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        // 统一走 openExternal：桌面壳用系统浏览器开，绝不原地导航主窗口
        if (window.openExternal) {
          window.openExternal(url);
          return { ok: true, msg: '已用系统浏览器打开 ' + url };
        }
        try {
          var w = window.open(url, '_blank');
          return { ok: true, msg: w ? ('已在浏览器打开 ' + url) : ('已尝试打开 ' + url + '，若没反应请允许弹窗') };
        } catch (e2) {
          return { ok: false, msg: '打开网页失败：' + (e2 && e2.message ? e2.message : e2) };
        }
      }

      /* ---- 今日新闻 ---- */
      if (name === 'read_news') {
        return fetch('data/news-data.json?t=' + Date.now())
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var items = (data && data.news) || [];
            if (!items.length) return { ok: false, msg: '还没有新闻数据' };
            var cnt = Math.min(items.length, Number(args.count) || 5);
            var lines = items.slice(0, cnt).map(function (it, i) {
              return (i + 1) + '. ' + (it.title || '') + (it.source ? '（' + it.source + '）' : '');
            }).join('\n');
            return { ok: true, msg: '今日热点（前' + cnt + '条）：\n' + lines };
          })
          .catch(function () { return { ok: false, msg: '新闻数据读取失败' }; });
      }

      /* ---- 通用界面控制：让智能体能覆盖专用工具没覆盖到的平台表单 ---- */
      if (name === 'platform_click') {
        var text = String(args.text || '').trim();
        if (!text) return { ok: false, msg: '缺少要点击的文字' };
        var clickables = Array.prototype.slice.call(document.querySelectorAll('button, .nav-item, .settings-tab, [role="button"], a'));
        var low = text.toLowerCase();
        var hits = clickables.filter(function (n) {
          if (!n || n.offsetParent === null || n.disabled) return false;
          var t = (n.textContent || n.title || n.getAttribute('aria-label') || '').trim().toLowerCase();
          return t && (t === low || t.indexOf(low) >= 0);
        });
        if (!hits.length) return { ok: false, msg: '当前界面没找到「' + text + '」按钮' };
        if (hits.length > 1) {
          var names = hits.slice(0, 5).map(function (n) { return (n.textContent || n.title || n.id || '控件').trim().slice(0, 24); }).join('、');
          return { ok: false, msg: '找到多个相似控件：' + names + '。请说得更具体一点。' };
        }
        hits[0].click();
        return { ok: true, msg: '已点击「' + text + '」' };
      }
      if (name === 'platform_input') {
        var target = String(args.target || '').toLowerCase().trim();
        var value = String(args.value == null ? '' : args.value);
        if (!target) return { ok: false, msg: '缺少输入框关键词' };
        var fields = Array.prototype.slice.call(document.querySelectorAll('input:not([type=file]):not([type=hidden]), textarea, select'));
        var visibleFields = fields.filter(function (n) { return n.offsetParent !== null; });
        var fs = visibleFields.filter(function (n) {
          var hay = [n.placeholder, n.getAttribute('aria-label'), n.name, n.id, n.labels && n.labels[0] && n.labels[0].textContent]
            .map(function (x) { return String(x || '').toLowerCase(); }).join(' ');
          return hay.indexOf(target) >= 0;
        });
        if (!fs.length) return { ok: false, msg: '当前界面没找到包含「' + args.target + '」的输入框' };
        if (fs.length > 1) return { ok: false, msg: '找到 ' + fs.length + ' 个相似输入框，请说得更具体' };
        var field = fs[0];
        if (field.tagName === 'SELECT') {
          var opt = Array.prototype.slice.call(field.options).find(function (o) {
            return o.value === value || o.textContent.trim() === value || o.textContent.indexOf(value) >= 0;
          });
          if (!opt) return { ok: false, msg: '下拉框里没有「' + value + '」' };
          field.value = opt.value; field.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          field.focus();
          field.value = value;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          field.blur();
        }
        return { ok: true, msg: '已填写「' + value + '」' };
      }
      if (name === 'describe_screen') {
        var activeNav = document.querySelector('.nav-item.active');
        var activeView = (activeNav && activeNav.dataset.view) || (document.querySelector('.view.active') && document.querySelector('.view.active').dataset.view) || '未知';
        var controls = Array.prototype.slice.call(document.querySelectorAll('button, .nav-item, .settings-tab'))
          .filter(function (n) { return n.offsetParent !== null && n.textContent; })
          .slice(0, 30).map(function (n) { return n.textContent.trim().slice(0, 18); }).filter(Boolean);
        var inputs = Array.prototype.slice.call(document.querySelectorAll('input, textarea, select'))
          .filter(function (n) { return n.offsetParent !== null; })
          .slice(0, 16).map(function (n) { return n.placeholder || n.getAttribute('aria-label') || n.name || n.id || n.tagName; }).filter(Boolean);
        var av = getAvatarMode(); var sp = UI.speakOn();
        return { ok: true, msg: '当前页面=' + activeView + '；智能体形象=' + av + '；语音播报=' + (sp ? '开' : '关') + '；可见按钮=' + (controls.join('、') || '无') + '；可见输入=' + (inputs.join('、') || '无') };
      }
      if (name === 'configure_agent') {
        var item = String(args.item || '').toLowerCase();
        var val = String(args.value || '').toLowerCase().trim();
        if (item === 'avatar') {
          var mode = val === 'airi' || val === 'anime' ? 'airi' : (val === 'live2d' || val === 'l2d' ? 'live2d' : (val === '3d' || val === 'realistic3d' ? 'realistic3d' : (val === 'none' || val === 'hidden' ? 'hidden' : '')));
          if (!mode) return { ok: false, msg: '形象值只支持 airi / live2d' };
          setAvatarMode(mode); UI.init();
          if (mode === 'hidden') UI.close();
          return { ok: true, msg: '已切换智能体形象：' + mode };
        }
        if (item === 'speak') {
          var on = val === 'on' || val === 'true' || val === '1';
          UI.setSpeak(on);
          if (!on) speak_stop();
          return { ok: true, msg: '语音播报已' + (on ? '开启' : '关闭') };
        }
        if (item === 'wake') {
          var won = val === 'on' || val === 'true' || val === '1';
          _wakeDesiredOn = won;
          if (won) startWakeListener(); else stopWakeListener();
          wakeOn = won;
          return { ok: true, msg: '语音唤醒已' + (won ? '开启' : '关闭') };
        }
        return { ok: false, msg: '未知智能体设置项' };
      }

      return { ok: false, msg: '未知工具：' + name };
    } catch (e) {
      return { ok: false, msg: '执行出错：' + (e && e.message ? e.message : e) };
    }
  }

  /* 天气需要异步，单独走 Promise */
  function execWeather(city) {
    return new Promise(function (resolve) {
      try {
        if (!window.Weather) return resolve({ ok: false, msg: '天气模块未加载' });
        var W = window.Weather;
        var cur = null;
        try { cur = W.currentCity && W.currentCity(); } catch (e) {}
        if (city) {
          var search = W.searchCity(city);
          Promise.resolve(search).then(function (list) {
            if (!list || !list.length) return resolve({ ok: false, msg: '没找到城市「' + city + '」' });
            return Promise.resolve(W.load(list[0], true)).then(function () {
              resolve({ ok: true, msg: '已查询 ' + list[0].name + ' 的天气，请看一下天气页面。' });
            }).catch(function () { resolve({ ok: false, msg: '天气获取失败，请检查网络' }); });
          }).catch(function () { resolve({ ok: false, msg: '天气搜索失败' }); });
        } else {
          if (!cur) return resolve({ ok: false, msg: '还没设置城市' });
          Promise.resolve(W.load(cur, true)).then(function () {
            resolve({ ok: true, msg: '已刷新 ' + (cur.name || '当前城市') + ' 的天气。' });
          }).catch(function () { resolve({ ok: false, msg: '天气获取失败' }); });
        }
      } catch (e) {
        resolve({ ok: false, msg: '天气查询出错：' + (e && e.message ? e.message : e) });
      }
    });
  }

  /* ================= LLM 调用 ================= */
  function callLLM(messages, tools) {
    var cfg = aiCfg();
    if (!cfg.apiKey) return Promise.reject(new Error('未配置 API Key，请在「设置 → AI」里填写'));
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 45000);
    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        tools: tools || undefined,
        tool_choice: tools ? 'auto' : undefined,
        temperature: 0.3
      }),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().then(function (j) {
        if (j.error) throw new Error(j.error.message || ('HTTP ' + r.status));
        return j.choices && j.choices[0] && j.choices[0].message;
      });
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function platformSnapshot() {
    var st = S(); if (!st) return '（数据层暂不可用）';
    var d = nowInfo(), lines = [];
    try {
      var cs = (st.getAll('courses') || []).filter(function (c) { return Number(c.day) === (d.weekday === 0 ? 7 : d.weekday); })
        .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
      lines.push('今天课程: ' + (cs.length ? cs.map(function (c) { return c.start + ' ' + (c.name || courseName(c.course)); }).join('；') : '无'));
    } catch (e) {}
    try {
      var tasks = (st.getAll('tasks') || []).filter(function (t) { return (t.status || 'todo') !== 'done'; });
      lines.push('未完成待办(' + tasks.length + '条): ' + (tasks.slice(0, 8).map(function (t) {
        return t.title + (t.due ? '［截止 ' + String(t.due).slice(0, 16).replace('T', ' ') + '］' : '');
      }).join('；') || '无'));
    } catch (e) {}
    try {
      var notes = (st.getAll('notes') || []).slice().sort(function (a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
      lines.push('最近笔记: ' + (notes.slice(0, 4).map(function (nn) { return String(nn.title || '').slice(0, 20) || '(无标题)'; }).join('；') || '无'));
    } catch (e) {}
    try {
      var pomo = (st.getAll('pomodoros') || []).filter(function (p) { return p.date && String(p.date).slice(0, 10) === d.iso; }).length;
      lines.push('今日已完成专注: ' + pomo + ' 个番茄钟');
    } catch (e) {}
    try {
      var ex = (st.getAll('exams') || []).slice(0, 3).map(function (e2) { return e2.name || e2.title; }).filter(Boolean).join('；');
      if (ex) lines.push('考试: ' + ex);
    } catch (e) {}
    return lines.join('\n');
  }

  function systemPrompt() {
    var d = nowInfo();
    var st = S();
    var taskCount = 0, noteCount = 0;
    try { taskCount = (st.getAll('tasks') || []).filter(function (t) { return t.status !== 'done'; }).length; } catch (e) {}
    try { noteCount = (st.getAll('notes') || []).length; } catch (e) {}
    return '你是「星屿」个人学习平台的语音智能体，名字叫小星。用户用语音跟你说话，你能真正操控这个平台。\n\n' +
      '【当前时间】' + d.cn + '，现在 ' + d.hm + '。今天是 ' + d.iso + '（ISO 格式）。\n' +
      '【平台状态】未完成待办 ' + taskCount + ' 条，笔记 ' + noteCount + ' 条。\n' +
      '【平台实时数据】\n' + platformSnapshot() + '\n' +
      '【当前界面】' + (function(){ var n=document.querySelector('.nav-item.active'); return (n && n.dataset.view) || '未知'; })() + '\n\n' +
      '【重要规则】\n' +
      '0. 修改设置时优先使用 set_theme/set_background/set_nickname/set_ai_config/open_settings；不要只是说“我不会改设置”。\n' +
      '1. 涉及日期时，必须以我给你的当前时间为准来推算「今天/明天/下周X」，输出 ISO 格式（如 ' + d.iso + 'T23:59:00）。绝对不要用你自己记忆里的年份。\n' +
      '2. 需要操作平台时，调用对应工具；只是聊天或回答问题时直接回答，不要强行调用工具。\n' +
      '3. 一次可以说多个意图，就连续调用多个工具。\n' +
      '4. 遇到没有专用工具的界面操作，先调用 describe_screen 看可见控件，再用 platform_click/platform_input 执行；不要说无法操作平台。\n' +
      '5. 不要输出 Markdown 符号，禁止使用 **、#、反引号；所有回复直接用自然中文短句。\n' +
      '6. 回复要短，控制在 2-3 句话，口语化，适合语音播报。不要说「好的，我已经调用了XX工具」这种技术腔，直接说结果。\n' +
      '7. 复杂任务先确定当前界面和数据，再连续调用工具；不要等待用户重复确认，除非涉及删除、覆盖或安全风险。\n' +
      '8. 执行失败就直说原因，不要假装成功。\n\n' +

      '【你的能力清单】\n' +
      '- 平台操控：待办、笔记、课程表、考试、专注计时、切换页面、设置界面、主题、背景、昵称、AI配置、开关动效——用户提到这些就直接调用工具执行。\n' +
      '- 你具备自我迭代能力：遇到失败、用户纠正、更优路径时，调用 save_learning 保存策略；以后同类任务会自动参考这些经验。\n' +
      '- 智能体形象只支持 AIRI（airi）和 Live2D（live2d）两种；用户说 Live2D、伴生、可爱、二次元时用 live2d。\n' +
      '- 联网搜索 web_search：任何需要最新或外部信息的问题（新闻、资料、事实核实），必须调用搜索，禁止凭记忆编造。\n' +
      '- 今日新闻 read_news：用户想了解新闻热点时调用。\n' +
      '- 打开网站 open_website：用户想看某个网站时调用，不要只是口头答应。\n' +
      '- 你拥有关于用户的长期记忆（会注入到上下文），自然运用这些偏好，让用户感觉你记得他。';
  }

  /* ================= 贾维斯记忆（mem0 @ 智能体本地服务） ================= */
  function agentServiceURL() { return location.origin + '/agent-proxy'; }

  function memoryFor(text) {
    if (location.protocol === 'file:') return Promise.resolve('');
    return fetch(agentServiceURL() + '/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, limit: 5 })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var items = (j && j.memories) || [];
      if (!items.length) return '';
      var lines = items.map(function (m) { return '- ' + (m.text || m); });
      return '\n\n【关于用户的长期记忆】\n' + lines.join('\n') + '\n（自然利用这些偏好，不要刻意复述）';
    }).catch(function () { return ''; });
  }

  function rememberAsync(userText, reply) {
    if (location.protocol === 'file:') return;
    try {
      fetch(agentServiceURL() + '/memory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [
          { role: 'user', content: String(userText) },
          { role: 'assistant', content: String(reply || '') }
        ] })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ================= 主流程 ================= */
  var history = [];
  var busy = false;

  function push(role, content) {
    history.push({ role: role, content: content });
    if (history.length > 16) history = history.slice(-16);
  }

  function run(text) {
    if (busy) return Promise.resolve('我还在忙，稍等一下～');
    if (!text || !String(text).trim()) return Promise.resolve('');
    busy = true;
    UI.setState('thinking');
    // AIRI 在前台时，小星的任何应答（唤醒词 / 输入框 / 快捷指令）都是一笔
    // 借麦事务：按住麦答题，答完由 idle 轮询把麦还给 AIRI。
    // 不这样做的话，AIRI 的耳朵在小星答题期间一直开着，用户接着说的话
    // 会被两边同时接收 → 双声重叠。
    try { if (airiInFront() && !_micBorrowed) borrowMicFromAiri(); } catch (e) {}
    UI.addMsg('user', text);

    var cfg = aiCfg();
    if (!cfg.apiKey) {
      busy = false;
      UI.setState('idle');
      var m = '还没配置 API Key，去「设置 → AI」里填一个就能用啦。';
      UI.addMsg('agent', m);
      speak(m);
      return Promise.resolve(m);
    }

    push('user', text);

    // 贾维斯记忆：检索长期记忆注入上下文，回答后异步沉淀
    return memoryFor(text).then(function (memCtx) {
      var sys = systemPrompt() + evolutionPrompt() + (memCtx || '');
      var msgs = [{ role: 'system', content: sys }].concat(history);
      return loop(msgs, 0).then(function (reply) {
      busy = false;
      UI.setState('idle');
      UI.addMsg('agent', cleanAgentText(reply, false));
      push('assistant', reply);
      rememberAsync(text, reply);
      setTimeout(evolveAsync, 1500);
      if (UI.speakOn()) speak(cleanAgentText(reply, true));
      return reply;
      });
    }).catch(function (e) {
      busy = false;
      UI.setState('idle');
      var msg = e && e.name === 'AbortError' ? '网络超时了，再试一次？' : ('出了点问题：' + (e && e.message ? e.message : e));
      UI.addMsg('agent', cleanAgentText(msg, false));
      if (UI.speakOn()) speak(cleanAgentText(msg, true));
      return msg;
    });
  }

  /* 工具调用循环，最多 5 轮 */
  function loop(msgs, depth) {
    if (depth > 8) return Promise.resolve('操作有点多，我分批来吧。');
    return callLLM(msgs, TOOLS).then(function (msg) {
      if (!msg) return '没收到回复';
      var calls = msg.tool_calls;
      if (!calls || !calls.length) return msg.content || '（无回复）';

      // 有工具调用：逐个执行
      UI.setState('acting');
      var chain = Promise.resolve([]);
      calls.forEach(function (c) {
        chain = chain.then(function (acc) {
          var fn = c.function && c.function.name;
          var args;
          try { args = JSON.parse((c.function && c.function.arguments) || '{}'); }
          catch (e) { args = {}; }
          var toolCard = UI.addAct(fn || 'agent.tool', args);
          return Promise.resolve(execTool(fn, args)).then(function (res) {
            recordToolEvent(fn, args, !!(res && res.ok), res && res.msg);
            if (toolCard && toolCard.done) toolCard.done(res);
            acc.push({ role: 'tool', tool_call_id: c.id, content: res.msg || (res.ok ? '完成' : '失败') });
            return acc;
          }, function (err) {
            var res = { ok:false, msg:(err && err.message) || String(err) };
            recordToolEvent(fn, args, false, res.msg);
            if (toolCard && toolCard.done) toolCard.done(res);
            acc.push({ role: 'tool', tool_call_id: c.id, content: res.msg });
            return acc;
          });
        });
      });
      return chain.then(function (toolMsgs) {
        var next = msgs.concat([{
          role: 'assistant',
          content: msg.content || '',
          tool_calls: calls
        }]).concat(toolMsgs);
        return loop(next, depth + 1);
      });
    });
  }

  /* ================= 语音识别 ================= */
  var rec = null, listening = false, finalText = '';

  function initRec() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.lang = 'zh-CN';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = function () {
      listening = true;
      UI.setState('listening');
      UI.setHint('在听…说完停一下');
    };
    r.onresult = function (e) {
      var interim = '', final = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (final) finalText += final;
      UI.setHint(finalText + interim || '在听…');
    };
    r.onerror = function (e) {
      listening = false;
      var map = {
        'not-allowed': '麦克风被拒了 → 点地址栏左边的锁图标，把「麦克风」改成允许，再刷新一次。\n不想开麦也没关系，下面输入框直接打字给我就行。',
        'service-not-allowed': '这个环境没给到语音识别服务（原生窗口 / 第三方浏览器常见）。\n直接在下面打字给我就行，功能一模一样。',
        'no-speech': '没听到声音，再试一次？',
        'network': '语音识别走的是系统在线服务，需要联网（走代理的话确认一下规则）。\n也能直接在下面打字。',
        'audio-capture': '没找到麦克风设备，检查一下系统输入设备。\n打字也能用。'
      };
      var m = map[e.error] || ('识别出错：' + e.error + '\n也可以直接在下面打字给我。');
      UI.setState('idle');
      UI.setHint(m.split('\n')[0]);
      UI.addMsg('agent', m);
      toast(m.split('\n')[0], 'err');
      UI.open();
      UI.focusText();
    };
    r.onend = function () {
      listening = false;
      var said = finalText.trim();
      finalText = '';
      if (said) {
        UI.setHint('');
        run(said);
      } else if (UI.state() === 'listening') {
        UI.setState('idle');
        UI.setHint('没听清，再说一次');
      }
    };
    return r;
  }

  /* ---- 智能体服务健康探测 ---- */
  var agentOK = null, agentCheckedAt = 0;
  function checkAgent() {
    if (agentOK !== null && Date.now() - agentCheckedAt < 30000) return Promise.resolve(agentOK);
    return fetch(agentServiceURL() + '/__agent_health__', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { agentOK = !!j.online; agentCheckedAt = Date.now(); return agentOK; })
      .catch(function () { agentOK = false; agentCheckedAt = Date.now(); return agentOK; });
  }

  /* ---- 本地录音：16k 单声道 WAV，静音自动停 ---- */
  var REC_SR = 16000, REC_MAX_MS = 15000, REC_SILENCE_MS = 1400, REC_MIN_SPEECH_MS = 250;
  var localStream = null, localCtx = null, localProc = null, localSrc = null;
  var localBuf = [], localFrames = 0, localSilence = 0, localSpeech = false;

  function startLocalRec() {
    return new Promise(function (resolve, reject) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return reject(new Error('浏览器不支持录音'));
      navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      }).then(function (stream) {
        localStream = stream;
        var Ctx = window.AudioContext || window.webkitAudioContext;
        try { localCtx = new Ctx({ sampleRate: REC_SR }); }
        catch (e) { localCtx = new Ctx(); }
        localSrc = localCtx.createMediaStreamSource(stream);
        localProc = localCtx.createScriptProcessor(4096, 1, 1);
        localBuf = []; localFrames = 0; localSilence = 0; localSpeech = false;
        localProc.onaudioprocess = function (ev) {
          // 停止录音会把 localCtx 置空，但已排队的音频回调仍会触发一次 —— 不设防就是偶发 pageerror
          if (!localCtx) return;
          var inp = ev.inputBuffer.getChannelData(0);
          localBuf.push(new Float32Array(inp));
          localFrames += inp.length;
          var rms = 0, i;
          for (i = 0; i < inp.length; i++) rms += inp[i] * inp[i];
          rms = Math.sqrt(rms / inp.length);
          if (rms > 0.012) { localSpeech = true; localSilence = 0; }
          else if (localSpeech) localSilence += (inp.length / localCtx.sampleRate) * 1000;
          var ms = (localFrames / localCtx.sampleRate) * 1000;
          if (localSpeech && localSilence > REC_SILENCE_MS) finishLocalRec();
          else if (ms > REC_MAX_MS) finishLocalRec();
        };
        localSrc.connect(localProc);
        localProc.connect(localCtx.destination);
        resolve(true);
      }).catch(reject);
    });
  }

  function stopLocalRecNodes() {
    try { if (localProc) localProc.disconnect(); } catch (e) {}
    try { if (localSrc) localSrc.disconnect(); } catch (e) {}
    try { if (localCtx) localCtx.close(); } catch (e) {}
    try { if (localStream) localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    localProc = null; localSrc = null; localCtx = null; localStream = null;
  }

  function finishLocalRec() {
    if (!localProc) return;
    var frames = localBuf, srcRate = localCtx ? localCtx.sampleRate : REC_SR;
    stopLocalRecNodes();
    listening = false;
    var total = 0;
    frames.forEach(function (f) { total += f.length; });
    var ms = (total / srcRate) * 1000;
    if (!localSpeech || ms < REC_MIN_SPEECH_MS) {
      UI.setState('idle');
      UI.setHint('没听到声音，再说一次');
      return;
    }
    UI.setState('thinking');
    UI.setHint('识别中…');
    var wav = encodeWavPcm16(resampleToF32(frames, srcRate, REC_SR), REC_SR);
    fetch(agentServiceURL() + '/stt', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error);
      var said = String(j.text || '').trim();
      if (said) run(said);
      else { UI.setState('idle'); UI.setHint('没听清，再说一次'); }
    }).catch(function (e) {
      UI.setState('idle');
      var m = '本地识别失败：' + (e && e.message ? e.message : e) + '\n也可以直接打字。';
      UI.addMsg('agent', m);
    });
  }

  function resampleToF32(frames, from, to) {
    var total = 0;
    frames.forEach(function (f) { total += f.length; });
    var flat = new Float32Array(total), off = 0;
    frames.forEach(function (f) { flat.set(f, off); off += f.length; });
    if (Math.abs(from - to) < 1) return flat;
    var ratio = from / to, n = Math.floor(total / ratio);
    var out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i * ratio, i0 = Math.floor(x), i1 = Math.min(total - 1, i0 + 1), t = x - i0;
      out[i] = flat[i0] * (1 - t) + flat[i1] * t;
    }
    return out;
  }

  function encodeWavPcm32f(samples, sr) {
    var n = samples.length;
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    function ws(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, n * 2, true);
    var o2 = 44;
    for (var i = 0; i < n; i++, o2 += 2) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(o2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function encodeWavPcm16(frames, sr) {
    // frames 已是重采样后的单个数组包装
    if (frames.length && frames[0].length !== undefined && typeof frames[0] === 'object' && frames.length > 0 && frames[0].constructor === Float32Array) {
      return encodeWavPcm32f(frames, sr);
    }
    return encodeWavPcm32f(frames, sr);
  }

  // opts.takeOver = true 表示这是用户【主动】发起的（点唤醒、Alt+M、点悬浮球、喊唤醒词），
  // 这种情况下允许小星从 AIRI 手里临时借走麦克风；被动触发则遵守前台交接，不抢。
  function listen(opts) {
    opts = opts || {};
    if (busy) { toast('等我先说完～'); return; }
    // AIRI 在前台时麦克风归它：语音输入走 AIRI 自己的 VAD
    // （VAD -> SenseVoice -> DeepSeek -> VoxCPM）。小星此时再开一路流，
    // 两边会同时识别同一段话、而且 AIRI 的外放会被小星的唤醒检测当成回声。
    if (micOwnerEffective() === 'airi' && !opts.takeOver) {
      listening = false;
      try { UI.setState('listening'); UI.setHint('AIRI 在听…直接说就行'); } catch (e) {}
      return;
    }
    if (opts.takeOver) borrowMicFromAiri();
    // 乐观 UI：listening 状态先亮（用户点击 → 视觉反馈 <50ms），
    // 麦克风开流与健康检查【并行】跑。串行等 checkAgent 是冷启动 1.7s 的主因。
    listening = true;
    UI.setState('listening');
    UI.setHint('在听…说完停顿一下');
    speak_stop();
    var recPromise = startLocalRec();
    checkAgent().then(function (ok) {
      if (ok) return;
      // 服务不在线 → 撤掉本地录音，退回浏览器识别
      recPromise.then(function () { stopListen(true); }).catch(function () {});
      legacyListen();
    });
    recPromise.catch(function (e) {
      listening = false;
      var en = (e && (e.name || '') + (e.message || '')).toLowerCase();
      UI.setState('idle');
      if (/notallowed|permission|denied|found/.test(en)) {
        // 无麦克风或被拒绝：浏览器识别也必然失败，直接引导用文字
        UI.addMsg('agent', '这台设备现在用不了麦克风（' + (e && e.message ? e.message : e) + '）。\n下面输入框打字给我，功能一模一样。');
        UI.open();
        UI.focusText();
        return;
      }
      UI.addMsg('agent', '本地录音开启失败：' + (e && e.message ? e.message : e) + '，改用浏览器识别。');
      legacyListen();
    });
  }

  function legacyListen() {
    if (!rec) rec = initRec();
    if (!rec) {
      var m = '这个环境没有语音识别能力（需要 Edge / Chrome，且要在线识别服务）。\n直接在下面打字给我就行，功能一模一样。';
      UI.addMsg('agent', m);
      UI.open();
      UI.focusText();
      return;
    }
    try {
      finalText = '';
      speak_stop();
      rec.start();
    } catch (e) {
      // 已在识别中
      try { rec.stop(); } catch (e2) {}
    }
  }

  function stopListen(cancel) {
    try {
      if (localProc) {
        listening = false;
        if (cancel) {
          stopLocalRecNodes();
          localBuf = []; localFrames = 0; localSilence = 0; localSpeech = false;
        } else {
          finishLocalRec();
        }
      }
    } catch (e) {}
    try { if (rec) rec.stop(); } catch (e) {}
    listening = false;
  }
  function speak_stop() {
    _voiceToken++;
    _speaking = false;
    stopAgentAudio();
    try { if (window.VoxVoice && window.VoxVoice.stop) window.VoxVoice.stop(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  }

  /* ================= 语音唤醒（本地 VAD + SenseVoice） ================= */
  // 2026-09-02 实测：SenseVoice 对「你好小星」的转写极不稳定
  //（"你好，小心。"/"你好小。"+"星。"/"恶星。"），裸 小星 词表经常匹配不上
  // —— 用户感知就是「唤醒不灵」。对策：① 收录同音变体（小心/小新/小辛/小欣，
  // 但仅限「你好X」结构，避免把日常说的"小心台阶"误触发）；
  // ② 2.6s 内的相邻切片拼接后再匹配（VAD 会把"小"和"星"切开）。
  var WAKE_RE = /(你好\s*小[星心新辛欣噜呐]|小星|小新|小屿|星屿|贾维斯)/;
  var _lastWakeSaid = '', _lastWakeSaidAt = 0;
  var wakeOn = false, wakeStream = null, wakeCtx = null, wakeProc = null, wakeSrc = null;
  var wakeBuf = [], wakeFrames = 0, wakeSilence = 0, wakeSpeech = false, wakeLastSend = 0;

  function startWakeListener() {
    if (wakeOn || location.protocol === 'file:') return;
    // AIRI 在前台时麦克风归它，小星不得抢麦（否则两边同时听、同时答）
    if (micOwnerEffective() === 'airi') return;
    var g = ++_wakeGen;   // 本次启动的代数；期间任何 stop/再次 start 都会令其作废
    return checkAgent().then(function (ok) {
      if (g !== _wakeGen) return false;   // 异步窗口内已被叫停 → 真正取消
      if (!ok) return false;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
      return navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      }).then(function (stream) {
        if (g !== _wakeGen) {   // 兑现时已过期 → 立刻关流，绝不复活
          try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
          return false;
        }
        wakeStream = stream; wakeOn = true;
        var Ctx = window.AudioContext || window.webkitAudioContext;
        try { wakeCtx = new Ctx({ sampleRate: 16000 }); } catch (e) { wakeCtx = new Ctx(); }
        wakeSrc = wakeCtx.createMediaStreamSource(stream);
        wakeProc = wakeCtx.createScriptProcessor(4096, 1, 1);
        wakeBuf = []; wakeFrames = 0; wakeSilence = 0; wakeSpeech = false;
        wakeProc.onaudioprocess = function (ev) {
          // 同 localCtx：停止唤醒会把 wakeCtx 置空，已排队的音频回调要挡一下
          if (!wakeCtx) return;
          if (busy || listening || isSpeaking()) { resetWakeClip(); return; }
          var inp = ev.inputBuffer.getChannelData(0), rms = 0, i;
          wakeBuf.push(new Float32Array(inp));
          wakeFrames += inp.length;
          for (i = 0; i < inp.length; i++) rms += inp[i] * inp[i];
          rms = Math.sqrt(rms / inp.length);
          if (rms > 0.014) { wakeSpeech = true; wakeSilence = 0; }
          else if (wakeSpeech) wakeSilence += (inp.length / wakeCtx.sampleRate) * 1000;
          var ms = (wakeFrames / wakeCtx.sampleRate) * 1000;
          if (wakeSpeech && (wakeSilence > 900 || ms > 7000)) handleWakeClip();
        };
        wakeSrc.connect(wakeProc);
        wakeProc.connect(wakeCtx.destination);
        UI.setHint('语音唤醒已待命：说「你好小星」');
        return true;
      }).catch(function () { return false; });
    });
  }
  function stopWakeListener() {
    _wakeGen++;   // 让所有还在半路上的启动链作废
    wakeOn = false;
    try { if (wakeProc) wakeProc.disconnect(); } catch (e) {}
    try { if (wakeSrc) wakeSrc.disconnect(); } catch (e) {}
    try { if (wakeCtx) wakeCtx.close(); } catch (e) {}
    try { if (wakeStream) wakeStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    wakeProc = wakeSrc = wakeCtx = wakeStream = null;
  }
  function handleWakeClip() {
    if (!wakeSpeech || busy || listening || Date.now() - wakeLastSend < 1200) { resetWakeClip(); return; }
    // 【双保险①】拿到话就先看麦克风现在归谁。唤醒监听器正常只在
    // 小星持麦时武装；若此刻 AIRI 在前台持麦（竞态/异步残留），
    // 这句话是用户对 AIRI 说的，小星绝不抢答 —— 这是「双声重叠」的第一根源。
    if (micOwnerEffective() === 'airi' && airiInFront() && !_micBorrowed) { resetWakeClip(); return; }
    var frames = wakeBuf, srcRate = wakeCtx ? wakeCtx.sampleRate : 16000;
    wakeLastSend = Date.now();
    resetWakeClip();
    var total = 0; frames.forEach(function (f) { total += f.length; });
    if (total < srcRate * 0.35) return;
    var wav = encodeWavPcm16(resampleToF32(frames, srcRate, 16000), 16000);
    fetch(agentServiceURL() + '/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var said = String(j && j.text || '').trim();
        if (!said) return;
        // 相邻切片拼接：VAD 有时把「你好小」和「星」切成两段，
        // 单段都匹配不上；2.6s 内的上一段拼进来再测（去标点后匹配）。
        var combo = said;
        if (_lastWakeSaid && Date.now() - _lastWakeSaidAt < 2600) combo = _lastWakeSaid + '，' + said;
        _lastWakeSaid = said; _lastWakeSaidAt = Date.now();
        var norm = combo.replace(/[，。！？、,.!?\s]/g, '');
        if (!WAKE_RE.test(norm)) return;
        // 【双保险②】STT 往返期间归属可能已切给 AIRI（用户顺手打开了面板），
        // 回来时再查一次，避免「话在路上、人已换场」的迟到抢答。
        if (micOwnerEffective() === 'airi' && airiInFront() && !_micBorrowed) return;
        var cmd = norm.replace(WAKE_RE, '').replace(/^[，,。.、\s]+|[，,。.\s]+$/g, '').trim();
        // 唤醒应答是一笔完整事务：先把麦按在小星手里（标记 _micBorrowed），
        // 再开面板。否则面板一开就把麦交给 AIRI，AIRI 会把用户还在说的
        // 半句话也听进去 → 两个智能体同时应答（实测复现的场景 A）。
        borrowMicFromAiri();
        UI.open();
        if (cmd.length >= 2) { run(cmd); }
        else {
          UI.setState('listening');
          UI.setHint('我在，说吧');
          // 350ms 只是当年给面板动画留的余量；UI.open 同步完成，
          // 60ms 足够让面板先画一帧，剩下的时间不该让用户等。
          setTimeout(function(){ listen({ takeOver: true }); }, 60);
        }
      }).catch(function () {});
  }
  function resetWakeClip() {
    wakeBuf = []; wakeFrames = 0; wakeSilence = 0; wakeSpeech = false;
  }

  /* ================= UI ================= */
  var UI = (function () {
    var root, ball, panel, logEl, hintEl, stateEl, speakBtn, tip, textInput, sendBtn, stage, hudState, hudAction, _state = 'idle', _speak = true;

    function el(tag, cls, txt) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt != null) e.textContent = txt;
      return e;
    }

    function build() {
      root = el('div', 'va-root');
      try { root.dataset.avatar = getAvatarMode(); } catch (e) { root.dataset.avatar = 'airi'; }

      // 悬浮球
      ball = el('button', 'va-ball');
      ball.type = 'button';
      ball.title = '语音助手（点击说话）';
      ball.setAttribute('aria-label', '语音助手');
      ball.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>' +
        '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
        '<line x1="12" y1="19" x2="12" y2="23"/>' +
        '<line x1="8" y1="23" x2="16" y2="23"/></svg>';
      ball.addEventListener('click', function (e) {
        e.stopPropagation();
        if (_state === 'listening') { stopListen(); UI.setState('idle'); }
        else listen({ takeOver: true });
      });
      root.appendChild(ball);

      // 一体化 Agent Cockpit：左侧角色舞台 / 右侧控制台共享同一个容器。
      stage = el('div', 'va-stage');
      stage.id = 'va-avatar-stage';
      // 【方案 A2】迷你球盖层：iframe 会吞点击且微缩画面不可读，
      // 用一个不透明盖层（星芒 + 状态点）当球的"脸"，点它返回智能体界面。
      var minCover = el('button', 'va-min-cover');
      minCover.type = 'button';
      minCover.title = '返回智能体界面';
      minCover.setAttribute('aria-label', '返回智能体界面');
      minCover.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3l1.9 5.1a2 2 0 0 0 1.2 1.2L20.2 11l-5.1 1.9a2 2 0 0 0-1.2 1.2L12 19.2l-1.9-5.1a2 2 0 0 0-1.2-1.2L3.8 11l5.1-1.7a2 2 0 0 0 1.2-1.2L12 3z"/>' +
        '</svg><span class="va-min-dot"></span>';
      minCover.addEventListener('click', function (e) { e.stopPropagation(); UI.open(); });
      stage.appendChild(minCover);
      var aura = el('div', 'va-avatar-aura');
      var hud = el('div', 'va-stage-hud');
      var hudTop = el('div', 'va-hud-top');
      hudState = el('div', 'va-hud-state', 'STANDBY');
      hudAction = el('div', 'va-hud-action', '小星已就绪');
      hudTop.appendChild(hudState);
      hudTop.appendChild(hudAction);
      var hudPulse = el('div', 'va-hud-pulse');
      hud.appendChild(hudPulse);
      hud.appendChild(hudTop);
      // 【方案 A2】HUD 收起按钮：把整个智能体界面（AIRI 全屏 + 对话框）缩成迷你球。
      var hudCollapse = el('button', 'va-hud-collapse', '\u2304');
      hudCollapse.type = 'button';
      hudCollapse.title = '收起为迷你球（智能体保持运行）';
      hudCollapse.setAttribute('aria-label', '收起智能体界面');
      hudCollapse.addEventListener('click', function (e) { e.stopPropagation(); UI.collapse(); });
      hud.appendChild(hudCollapse);
      stage.appendChild(aura);
      stage.appendChild(hud);

      // 全屏流光层（苹果/华为 AI 式唤醒动效）
      var fx = document.getElementById('va-fx');
      if (!fx) { fx = el('div'); fx.id = 'va-fx'; document.body.appendChild(fx); }

      // 面板：Assistant Shell 风格，关闭只隐藏 UI，不影响运行
      panel = el('div', 'va-panel va-console');
      var head = el('div', 'va-head');

      var brand = el('div', 'va-brand');
      var mark = el('span', 'va-mark');
      var titleWrap = el('div', 'va-title-wrap');
      var title = el('div', 'va-title', '小星');
      var sub = el('div', 'va-sub', '平台操控 · 联网检索 · 工具流 · 自我改进');
      titleWrap.appendChild(title); titleWrap.appendChild(sub);
      brand.appendChild(mark); brand.appendChild(titleWrap);
      head.appendChild(brand);

      var actions = el('div', 'va-actions');
      speakBtn = el('button', 'va-icon-btn is-on', '🔊');
      speakBtn.type = 'button';
      speakBtn.title = '语音播报开关';
      speakBtn.addEventListener('click', function () {
        _speak = !_speak;
        speakBtn.textContent = _speak ? '🔊' : '🔇';
        speakBtn.classList.toggle('is-on', _speak);
        if (!_speak) speak_stop();
      });
      actions.appendChild(speakBtn);

      // 视觉开关（2026-09-02）：让 AIRI 通过摄像头看到用户。
      // 点开 = 取像 + 方舟视觉推理 + 结果注入大脑上下文；关闭 = 停流断拍。
      visionBtn = el('button', 'va-icon-btn');
      visionBtn.type = 'button';
      visionBtn.addEventListener('click', function () {
        onVisionToggle();
      });
      actions.appendChild(visionBtn);
      updateVisionBtn();

      // 角色卡弹层（2026-09-03）：列出/切换/导入 AIRI 角色卡，直达上游管理页。
      var cardsPop = el('div', 'va-cards-pop');
      var cardsHead = el('div', 'va-cards-head');
      cardsHead.appendChild(el('div', 'va-cards-title', '角色卡'));
      cardsHead.appendChild(el('div', 'va-cards-hint', '切换 AIRI 人格'));
      cardsPop.appendChild(cardsHead);
      var cardsListEl = el('div', 'va-cards-list');
      cardsPop.appendChild(cardsListEl);
      var cardsFoot = el('div', 'va-cards-foot');
      var importBtn = el('button', 'va-cards-btn', '导入卡');
      importBtn.type = 'button';
      importBtn.title = '导入角色卡：SillyTavern JSON（chub.ai 等）或 PNG 卡（tEXt 内嵌格式）';
      var fileInput = el('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,.png,application/json,image/png';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        var isPng = /\.png$/i.test(f.name) || f.type === 'image/png';
        var reader = new FileReader();
        reader.onload = function () {
          window.XingyuAiriCards.importText(String(reader.result || '')).then(function (r) {
            if (!r.ok) { toast(r.error || '导入失败', 'err'); return; }
            toast('已导入角色卡：' + r.name, 'ok');
            renderCardsPop();
            if (r.needsReload) reloadAiriFrame('AIRI 重启中，角色即将生效…');
          });
        };
        reader.onerror = function () { toast('读取文件失败', 'err'); };
        if (isPng) reader.readAsDataURL(f);
        else reader.readAsText(f, 'utf-8');
      });
      cardsPop.appendChild(fileInput);
      importBtn.addEventListener('click', function () { fileInput.click(); });
      var manageBtn = el('button', 'va-cards-btn', 'AIRI 管理');
      manageBtn.type = 'button';
      manageBtn.title = '在 AIRI 内打开角色卡管理页（支持 .airi 模型包导入）';
      manageBtn.addEventListener('click', function () {
        try {
          var f = document.getElementById('va-airi-frame');
          var app = f.contentDocument.querySelector('#app');
          var router = app.__vue_app__.config.globalProperties.$router;
          router.push('/settings/airi-card/');
          setCardsPop(false);
          toast('已在 AIRI 中打开角色卡管理', 'ok');
        } catch (e) { toast('AIRI 还没就绪，稍后再试', 'err'); }
      });
      cardsFoot.appendChild(importBtn);
      cardsFoot.appendChild(manageBtn);
      cardsPop.appendChild(cardsFoot);

      function setCardsPop(open) {
        cardsPop.classList.toggle('is-open', !!open);
        if (cardBtn) cardBtn.classList.toggle('is-on', !!open);
        if (open) renderCardsPop();
      }
      function renderCardsPop() {
        cardsListEl.innerHTML = '';
        var items = [];
        try { items = window.XingyuAiriCards.list(); } catch (e) {}
        if (!items.length) {
          cardsListEl.appendChild(el('div', 'va-cards-empty', '暂无卡片'));
          return;
        }
        items.forEach(function (it) {
          var row = el('button', 'va-card-row' + (it.active ? ' is-active' : ''));
          row.type = 'button';
          row.appendChild(el('span', 'va-card-dot'));
          row.appendChild(el('span', 'va-card-name', it.name + (it.id === 'default' ? '（默认）' : '')));
          row.addEventListener('click', function () {
            if (it.active) { setCardsPop(false); return; }
            window.XingyuAiriCards.activate(it.id).then(function (r) {
              if (!r.ok) { toast(r.error || '切换失败', 'err'); return; }
              toast('角色已切换：' + it.name, 'ok');
              setCardsPop(false);
              if (r.needsReload) reloadAiriFrame('AIRI 重启中，角色即将生效…');
            });
          });
          cardsListEl.appendChild(row);
        });
      }

      var cardBtn = el('button', 'va-icon-btn');
      cardBtn.type = 'button';
      cardBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" width="16" height="16">' +
        '<path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 3h.01"/>' +
        '<path d="M6.7 20.7c1.1.5 2.3.8 3.3.8 5 0 9-4 9-9 0-1.3-.8-2.6-2-3.3-1.3-.8-2.7-.7-3.9 0L10 10.5c-1.2.7-2.6.8-3.9 0-1.2-.7-2.7-.8-4 0-1.1.7-1.8 2-1.8 3.3 0 1.9.6 3.6 1.6 5"/>' +
        '<path d="M7 17h.01"/><path d="M11 16h.01"/></svg>';
      cardBtn.title = '角色卡：切换 / 导入 AIRI 人格';
      cardBtn.addEventListener('click', function () {
        setCardsPop(!cardsPop.classList.contains('is-open'));
      });
      actions.appendChild(cardBtn);

      var clearBtn = el('button', 'va-icon-btn', '⌫');
      clearBtn.type = 'button';
      clearBtn.title = '清空对话';
      clearBtn.addEventListener('click', function () {
        if (logEl) logEl.innerHTML = '';
        history = [];
      });
      actions.appendChild(clearBtn);

      var closeBtn = el('button', 'va-close', '\u2715');
      closeBtn.type = 'button';
      closeBtn.title = '只隐藏对话界面（智能体保持运行）';
      closeBtn.setAttribute('aria-label', '隐藏语音助手');
      closeBtn.addEventListener('click', function (e) { e.stopPropagation(); UI.close(); });
      actions.appendChild(closeBtn);

      var powerBtn = el('button', 'va-close va-power', '\u23FB');
      powerBtn.type = 'button';
      powerBtn.title = '停止智能体（语音/唤醒都会停止）';
      powerBtn.setAttribute('aria-label', '停止语音助手');
      powerBtn.addEventListener('click', function (e) {
        e.stopPropagation(); stopWakeListener(); stopListen(true); speak_stop();
        UI.setState('idle'); UI.close();
        // 【方案 A】close 只收面板；⏻ 才是真正退场 —— 显式销毁 AIRI，
        // 麦克风还给小星、唤醒监听由 applyMicOwnership 重启。
        hideAvatar();
      });
      actions.appendChild(powerBtn);
      head.appendChild(actions);
      panel.appendChild(head);
      panel.appendChild(stage);

      logEl = el('div', 'va-log');
      panel.appendChild(logEl);

      var quick = el('div', 'va-quick');
      ['今天有什么安排', '添加待办：复习高数', '开始专注 25 分钟', '打开设置智能体栏', '看看你能操作什么'].forEach(function (q) {
        var b = el('button', 'va-chip', q);
        b.addEventListener('click', function () { run(q); });
        quick.appendChild(b);
      });
      panel.appendChild(quick);

      var inputRow = el('div', 'va-input');
      textInput = el('input');
      textInput.type = 'text';
      textInput.placeholder = '给小星一个任务，或直接说…';
      textInput.setAttribute('aria-label', '给小星下指令');
      sendBtn = el('button', 'va-send');
      sendBtn.type = 'button';
      sendBtn.title = '发送';
      sendBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
      var submitText = function () {
        var v = (textInput.value || '').trim();
        if (!v) return;
        textInput.value = ''; run(v);
      };
      textInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitText(); } });
      sendBtn.addEventListener('click', submitText);
      inputRow.appendChild(textInput);
      inputRow.appendChild(sendBtn);
      panel.appendChild(inputRow);

      var foot = el('div', 'va-foot');
      stateEl = el('span', 'va-state', '待命');
      hintEl = el('span', 'va-hint', 'Alt+M 唤醒');
      foot.appendChild(stateEl); foot.appendChild(hintEl);
      panel.appendChild(foot);

      // 角色卡弹层插在头部正下方（stage 之前），展开时盖住舞台即可
      panel.insertBefore(cardsPop, stage);

      root.appendChild(panel);

      // 首次启动招呼气泡（localStorage 记住，下次不再弹）
      tip = el('div', 'va-tip');
      var tipRow = el('div', 'va-tip-row');
      tipRow.appendChild(el('span', 'va-tip-emoji', '👋'));
      tipRow.appendChild(el('span', 'va-tip-title', '我是小星,你的 AI 语音助手'));
      tip.appendChild(tipRow);
      tip.appendChild(el('div', 'va-tip-sub', '点我说 · Alt+M 直接开麦 · Alt+V 打开面板'));
      root.appendChild(tip);

      document.body.appendChild(root);
    }

    return {
      init: function () { if (!root) build(); },
      open: function () {
        this.init(); panel.classList.add('is-open'); document.body.classList.add('va-panel-open');
        var fx = document.getElementById('va-fx'); if (fx) fx.classList.add('is-active');
        var am = getAvatarMode(); if (am === 'airi' || am === 'realistic3d' || am === 'live2d') showAvatar(); else hideAvatar();
        setTimeout(function(){ try { textInput && textInput.focus(); } catch(e){} }, 80);
      },
      close: function () {
        this.init(); panel.classList.remove('is-open'); document.body.classList.remove('va-panel-open');
        var fx = document.getElementById('va-fx'); if (fx) fx.classList.remove('is-active');
        // 【方案 A2】✕ = 只关左侧对话框：AIRI 全屏界面原地保持，会话与麦克风归属都不动
        // （这正是按钮标题承诺的"只隐藏对话界面"）。要把整个智能体界面收成迷你球用 HUD 的 ⌄，
        // 要彻底停止用 ⏻。非 AIRI 形象维持旧的收起即退场行为。
        if (airiInFront()) return;
        hideAvatar();
      },
      collapse: function () {
        this.init(); panel.classList.remove('is-open'); document.body.classList.remove('va-panel-open');
        var fx = document.getElementById('va-fx'); if (fx) fx.classList.remove('is-active');
        // 【方案 A2】⌄ = 整个智能体界面收成右下角迷你球，语音管线原样活着；⏻ 才是真正停止。
        if (airiInFront()) { document.body.classList.add('va-airi-min'); return; }
        hideAvatar();
      },
      toggle: function () { this.init(); var opening = !panel.classList.contains('is-open'); panel.classList.toggle('is-open', opening); document.body.classList.toggle('va-panel-open', opening); var fx = document.getElementById('va-fx'); if (fx) fx.classList.toggle('is-active', opening); if (opening) { var am = getAvatarMode(); if (am === 'airi' || am === 'live2d' || am === 'realistic3d') showAvatar(); else hideAvatar(); } else if (airiInFront()) { document.body.classList.add('va-airi-min'); } else { hideAvatar(); } },
      state: function () { return _state; },
      setState: function (s) {
        _state = s;
        // 小星闲下来了（说完 / 超时收麦）→ 把麦克风还给前台的 AIRI。
        // 轮询等待「彻底静默」再还：setState('idle') 往往发生在 speak() 刚开始时
        // （run() 里先 idle 后 speak），一次性 setTimeout 会在小星开口的
        // 第 1.2 秒就把麦还回去 —— AIRI 的耳朵在答题声中打开，又是一条双声。
        if (s === 'idle' && _micBorrowed && !busy && !listening) {
          if (_idlePoll) { clearInterval(_idlePoll); _idlePoll = null; }
          _idlePoll = setInterval(function () {
            if (UI.state() !== 'idle' || busy || listening) { clearInterval(_idlePoll); _idlePoll = null; return; }
            if (isSpeaking()) return;   // 还在说话 → 继续等
            clearInterval(_idlePoll); _idlePoll = null;
            if (_micBorrowed) returnMicToAiri();
          }, 500);
        }
        try {
          if (s === 'listening' || s === 'thinking' || s === 'acting' || s === 'speaking') document.body.classList.add('va-awake');
          else setTimeout(function () { if (UI.state() === 'idle') document.body.classList.remove('va-awake'); }, 900);
        } catch (e) {}
        // 呼吸光环球：把状态写到按钮上，CSS 按 state 切换动画语义
        try { var _wb = document.getElementById('btnWakeAgent'); if (_wb) _wb.dataset.state = s; } catch (e) {}
        var fx = document.getElementById('va-fx');
        if (fx) {
          fx.classList.remove('is-listening', 'is-thinking', 'is-acting', 'is-speaking');
          if (s === 'listening') fx.classList.add('is-listening');
          if (s === 'thinking') fx.classList.add('is-thinking');
          if (s === 'acting') fx.classList.add('is-acting');
          if (s === 'speaking') fx.classList.add('is-speaking');
        }
        if (stage) {
          stage.classList.remove('is-listening', 'is-thinking', 'is-acting', 'is-speaking');
          if (s === 'listening' || s === 'thinking' || s === 'acting' || s === 'speaking') stage.classList.add(s);
        }
        if (hudState) hudState.textContent = ({ idle:'STANDBY', listening:'LISTENING', thinking:'REASONING', acting:'EXECUTING', speaking:'SPEAKING' })[s] || 'STANDBY';
        try {
          setAgentRuntimeState(s);
          if (!window.__xyAgentStateChannel) window.__xyAgentStateChannel = new BroadcastChannel('xingyu-agent-state');
          window.__xyAgentStateChannel.postMessage({ type:'xingyu-agent-state', state:s });
        } catch (e) {}
        if (!ball) return;
        ball.classList.remove('is-listening', 'is-thinking', 'is-acting');
        if (s === 'listening') ball.classList.add('is-listening');
        if (s === 'thinking') ball.classList.add('is-thinking');
        if (s === 'acting') ball.classList.add('is-acting');
        if (stateEl) {
          stateEl.textContent = { idle: '待命', listening: '聆听中', thinking: '思考中', acting: '执行中', speaking: '播报中' }[s] || '';
        }
      },
      setHint: function (t) { if (hintEl) hintEl.textContent = t || ''; },
      addMsg: function (role, text) {
        this.init();
        if (role !== 'user') text = cleanAgentText(text, false);
        var m = el('div', 'va-msg ' + (role === 'user' ? 'is-user' : 'is-agent'), text);
        logEl.appendChild(m);
        logEl.scrollTop = logEl.scrollHeight;
      },
      addAct: function (tool, args) {
        this.init();
        var m = el('div', 'va-msg is-act is-running');
        var top = el('div', 'va-act-top');
        var dot = el('span', 'va-act-dot');
        var name = el('span', 'va-act-name', String(tool || 'agent.tool'));
        top.appendChild(dot); top.appendChild(name);
        var detail = el('div', 'va-act-detail', '准备执行…');
        try {
          var argText = JSON.stringify(args || {}, null, 0);
          if (argText.length > 180) argText = argText.slice(0, 177) + '…';
          detail.textContent = argText || '执行中…';
        } catch (e) {}
        m.appendChild(top); m.appendChild(detail);
        logEl.appendChild(m);
        logEl.scrollTop = logEl.scrollHeight;
        var card = {
          node: m,
          done: function (res) {
            var ok = !!(res && res.ok);
            m.classList.remove('is-running');
            m.classList.add(ok ? 'is-ok' : 'is-error');
            var msg = cleanAgentText(String(res && res.msg || (ok ? '完成' : '失败')), false).replace(/\n+/g, ' · ');
            if (msg.length > 260) msg = msg.slice(0, 257) + '…';
            detail.textContent = msg;
            logEl.scrollTop = logEl.scrollHeight;
          }
        };
        return card;
      },
      speakOn: function () { return _speak; },
      setSpeak: function (v) { _speak = !!v; if (speakBtn) { speakBtn.textContent = _speak ? '🔊' : '🔇'; speakBtn.classList.toggle('is-on', _speak); } },
      focusText: function () {
        try {
          if (textInput) setTimeout(function () { textInput.focus(); }, 60);
        } catch (e) {}
      }
    };
  })();

  /* ---------- 快捷键：Alt+V 呼出 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      // 如果设置等平台弹窗也在前面，就不抢关闭行为。
      var platformModalOpen = !!document.querySelector('.modal-mask.show');
      if (platformModalOpen) return;
      var panelEl = document.querySelector('.va-panel');
      if (panelEl && panelEl.classList.contains('is-open')) {
        e.preventDefault();
        UI.close();
      }
    }
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      UI.toggle();
    } else if (e.altKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      UI.open();
      listen({ takeOver: true });
    }
  });

  document.addEventListener('click', function (e) {
    var panelEl = document.querySelector('.va-panel');
    if (!panelEl || !panelEl.classList.contains('is-open')) return;
    var rootEl = panelEl.closest('.va-root');
    if (rootEl && (rootEl.contains(e.target) || e.target === rootEl)) return;
    // 点击空白处仅隐藏界面，智能体继续运行。
    UI.close();
  });

  /* ---------- 启动 ---------- */
  var INTRO_KEY = 'va_intro_v1';

  /* ===== 2026-09-02 AIRI 自愈：检测到旧 SW / 未注入 provider 时自动修复 =====
   * 用户的旧会话可能跑着旧版 SW（xingyu-static-20260901-6），喂旧版 voice-agent.js
   * （没有 ensureAiriProviders、把 iframe 指到外网）。这层自愈不需要用户重启。
   * 触发条件：URL 带 ?reset=airi  或 检测到 iframe 指向外网或三个 provider 全空。
   * 流程：纠正 iframe src → 补写 provider → 解注册所有旧 SW → 强刷当前页。
   * ============================================================================= */
  function selfHealAiri() {
    try {
      var loc = location;
      var wantReset = /[?&]reset=airi\b/.test(loc.search);
      var frm = document.getElementById('va-airi-frame');
      var src = frm ? (frm.getAttribute('src') || '') : '';
      var pointingToRemote = src.indexOf('airi.moeru.ai') >= 0 || /^\s*https?:\/\//i.test(src);
      var llmCfg, hearCfg, speechCfg;
      try {
        llmCfg = localStorage.getItem('settings/consciousness/active-provider');
        hearCfg = localStorage.getItem('settings/hearing/active-provider');
        speechCfg = localStorage.getItem('settings/speech/active-provider');
      } catch (e) {}
      var providerMissing = !(llmCfg && hearCfg && speechCfg);
      if (!wantReset && !pointingToRemote && !providerMissing) return false;

      // 1) 旧版把 iframe 指向外网：直接改回本地同源
      if (frm && pointingToRemote) frm.setAttribute('src', '/airi/');
      // 2) provider 没注入：现在补
      if (providerMissing && typeof ensureAiriProviders === 'function') {
        try { ensureAiriProviders(); } catch (e) { console.warn('[AIRI self-heal] ensureAiriProviders failed', e); }
      }
      // 3) SW 太旧或要强刷：解注册 + 清缓存 + 强刷（加唯一查询参数绕过 SW 缓存）
      if (wantReset && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }).then(function () {
          return caches.keys();
        }).then(function (keys) {
          return Promise.all(keys.map(function (k) {
            return /^xingyu-static-/.test(k) ? caches.delete(k) : Promise.resolve(false);
          }));
        }).then(function () {
          // 加唯一时间戳让 SW 不会命中同 URL 缓存；保留 reset=airi 让下一轮也走自愈
          var url = new URL(loc.href);
          url.searchParams.set('_t', String(Date.now()));
          location.replace(url.pathname + (url.search ? url.search : '') + (url.hash || ''));
        }).catch(function (e) { console.warn('[AIRI self-heal] sw reset failed', e); });
        return true;
      }
      return false; // 补完 provider 即可，不用重载
    } catch (e) { console.warn('[AIRI self-heal]', e); return false; }
  }

  function boot() {
    if (selfHealAiri()) return; // 走重载路径
    UI.init();
    setAgentLayout(getAgentLayout());
    // 角色卡预置：必须在 AIRI 初始化前落盘 —— 之前挂在 ensureAiriProviders 内部，
    // 但 ensureAiriProviders 只在用户点开 AI 助手时才跑，导致首次进入主页的角色卡
    // 永远不会被写入（只在切到 AIRI 模式才补）。改为 boot() 直接调用，与 providers 无关。
    // idempotent：guard 键保证不会重复打扰；已存在的卡 patch 一次 displayModelId。
    ensureAiriCards();
    // 尊重用户在设置里保存的形象；Live2D/AIRI/3D 都可以持久保留。
    var savedMode = getAvatarMode();
    var rootEl = document.querySelector('.va-root');
    if (rootEl) rootEl.dataset.avatar = savedMode;
    // 默认开启语音唤醒；如果麦克风权限未授权，这里会静默失败，不影响平台。
    setTimeout(function () { startWakeListener(); }, 2600);
    // 延迟一小段，避免和开屏动画抢资源
    setTimeout(function () {
      if (!rec) rec = initRec();
    }, 1500);

    // 首次启动招呼：tooltip + 球招手动画。用 localStorage 记住，仅放一次。
    try {
      if (!localStorage.getItem(INTRO_KEY)) {
        var ballEl = document.querySelector('.va-ball');
        if (ballEl) ballEl.classList.add('is-intro');
        setTimeout(function () { try { var ballEl = document.querySelector('.va-ball'); ballEl && ballEl.classList.remove('is-intro'); } catch (e) {} }, 1700);
        // 等开屏淡出再出招呼气泡，避免两层动画抢资源
        setTimeout(function () {
          var tipEl = document.querySelector('.va-tip');
          if (tipEl) tipEl.classList.add('is-show');
          setTimeout(function () {
            var tipEl = document.querySelector('.va-tip');
            if (tipEl) tipEl.classList.remove('is-show');
          }, 4500);
          try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
        }, 1200);
      }
    } catch (e) {}
  }
  function initAgentSettings() {
    var layoutPicker=document.getElementById('agentLayoutPicker');
    var avatarSel=document.getElementById('agentAvatarMode');
    var avatarPicker=document.getElementById('agentAvatarPicker');
    var modelPicker=document.getElementById('agent3dModelPicker');
    var modelWrap=document.getElementById('agent3dModelWrap');
    var modelSel=document.getElementById('agent3dModel');
    var speakBox=document.getElementById('agentSpeakEnabled');
    var wakeBox=document.getElementById('agentWakeEnabled');
    var wakeBtn=document.getElementById('btnWakeAgent');
    var labBtn=document.getElementById('btnOpenAvatarLab');
    var petBtn=document.getElementById('btnLaunchDesktopPet');
    var clearBtn=document.getElementById('btnAgentClearMemory');
    var resetBtn=document.getElementById('btnAgentResetLearning');
    function sync() {
      try {
        var mode = getAvatarMode();
        if (avatarSel) avatarSel.value = mode;
        if (modelWrap) modelWrap.style.display = 'none';
        if (modelPicker) modelPicker.style.display = mode === 'airi' ? '' : 'none';
        var curModel = getAvatarModel();
        if (modelSel) modelSel.value = curModel;
        if (avatarPicker) {
          Array.prototype.slice.call(avatarPicker.querySelectorAll('.agent-avatar-card')).forEach(function(card) {
            card.classList.toggle('active', card.dataset.avatarOption === mode);
            card.setAttribute('aria-pressed', card.dataset.avatarOption === mode ? 'true' : 'false');
          });
        }
        if (modelPicker) {
          Array.prototype.slice.call(modelPicker.querySelectorAll('.agent-model-card')).forEach(function(card) {
            card.classList.toggle('active', card.dataset.modelOption === curModel);
            card.setAttribute('aria-pressed', card.dataset.modelOption === curModel ? 'true' : 'false');
          });
        }
        if (layoutPicker) {
          Array.prototype.slice.call(layoutPicker.querySelectorAll('.agent-layout-card')).forEach(function(card) {
            var active = card.dataset.layoutOption === getAgentLayout();
            card.classList.toggle('active', active);
            card.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
        }
        if (speakBox) speakBox.checked = UI.speakOn();
        if (wakeBox) wakeBox.checked = wakeOn;
      } catch(e) {}
    }
    if (layoutPicker) {
      layoutPicker.addEventListener('click', function(e) {
        var card = e.target.closest && e.target.closest('.agent-layout-card');
        if (!card) return;
        setAgentLayout(card.dataset.layoutOption);
        sync();
      });
    }
    if (avatarPicker) {
      avatarPicker.addEventListener('click', function(e) {
        var card = e.target.closest && e.target.closest('.agent-avatar-card');
        if (!card) return;
        setAvatarMode(card.dataset.avatarOption || 'airi');
        sync();
      });
    }
    if (modelPicker) {
      modelPicker.addEventListener('click', function(e) {
        var card = e.target.closest && e.target.closest('.agent-model-card');
        if (!card) return;
        setAvatarMode('airi');
        setAvatarModel(card.dataset.modelOption || 'half-body.glb');
        sync();
      });
    }
    if (avatarSel) avatarSel.addEventListener('change', function(e){ setAvatarMode(e.target.value); sync(); });
    if (modelSel) modelSel.addEventListener('change', function(e){ setAvatarModel(e.target.value); sync(); });
    // 主界面唤醒按钮 = 用户主动要跟小星说话，允许从 AIRI 手里临时接管麦克风
    if (wakeBtn) wakeBtn.addEventListener('click', function(e){ e.stopPropagation(); UI.open(); listen({ takeOver: true }); });
    if (speakBox) speakBox.addEventListener('change', function(e){ UI.setSpeak(e.target.checked); });
    if (wakeBox) wakeBox.addEventListener('change', function(e){ _wakeDesiredOn = !!e.target.checked; if(e.target.checked) startWakeListener(); else stopWakeListener(); });
    if (labBtn) labBtn.addEventListener('click', function(){ if (window.openExternal) window.openExternal('/avatar-lab.html'); else window.open('/avatar-lab.html','_blank','noopener'); });
    if (petBtn) petBtn.addEventListener('click', async function(){
      try {
        var r = await fetch('/api/launch-pet', { method: 'GET', cache: 'no-store' });
        var j = await r.json();
        if (!j.ok) throw new Error(j.error || '启动失败');
        // pending = 进程已拉起但还在 import pywebview/pythonnet（冷启动 3~8 秒），
        // 这不算失败，别再弹红字吓用户。
        var msg = j.already ? '宠物已经在桌面上啦，已为你唤到前台'
                : j.pending ? '桌面宠物正在加载，稍等几秒就会出现在桌面上'
                : '桌面宠物已启动';
        toast(msg, 'ok');
      } catch (e) {
        toast('桌面宠物启动失败：' + (e && e.message ? e.message : e), 'err');
      }
    });
    if (clearBtn) clearBtn.addEventListener('click', function(){ try{ var p=document.querySelector('.va-log'); if(p)p.innerHTML=''; history=[]; }catch(e){} });
    if (resetBtn) resetBtn.addEventListener('click', function(){ try{ localStorage.removeItem('xingyu_agent_evolution_v1'); }catch(e){} });
    document.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('.settings-tab')) setTimeout(sync, 30);
    });
    setTimeout(sync, 300);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ boot(); initAgentSettings(); });
  } else {
    boot(); initAgentSettings();
  }

  /* ---------- 暴露 API ---------- */
  window.VoiceAgent = {
    toggle: function () { UI.toggle(); },
    open: function () { UI.open(); },
    close: function () { UI.close(); },
    collapse: function () { UI.collapse(); },
    listen: listen,
    stop: function () { stopListen(true); speak_stop(); UI.setState('idle'); },
    run: run,
    setSpeak: function (v) { UI.init(); },
    startWake: startWakeListener,
    stopWake: stopWakeListener,
    learning: function () { return loadEvolution(); },
    _uiState: function (s) { try { UI.setState(s); } catch (e) {} },
    state: function () { return UI.state(); },
    speakOn: function () { UI.init(); return UI.speakOn(); },
    setSpeak: function (v) { UI.init(); UI.setSpeak(!!v); },
    avatarMode: function () { return getAvatarMode(); },
    setAvatarMode: function (m) { return setAvatarMode(m); },
    clearHistory: function () { try { var p=document.querySelector('.va-log'); if(p) p.innerHTML=''; history=[]; } catch(e){} },
    resetLearning: function () { try { localStorage.removeItem('xingyu_agent_evolution_v1'); } catch(e){} },
    testTool: function (n, a) { return execTool(n, a); }
  };
})();


