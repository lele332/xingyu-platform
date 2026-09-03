/*!
 * 星屿 × AIRI 预置引导（共享模块）
 *
 * 用途：在 AIRI 挂载前，把「大脑 / 嘴 / 耳朵 / 视觉」的 provider 配置、
 * 当前选中项、以及角色卡（含形象绑定）写进 localStorage，让 AIRI 开箱即用、
 * 不弹首次引导、不退化成默认模型。
 *
 * 为什么需要独立文件：
 *   桌面宠物窗（xingyu-pet.pyw）用的是 webview-data/pet 这个**独立 storage_path**，
 *   与主应用（webview-data）不共享 localStorage —— 宠物窗里的 AIRI 是全新用户，
 *   没有 provider、会弹引导、也没角色卡。所以宠物窗必须自己跑一遍同样的预置。
 *
 * 与 voice-agent.js 的关系：
 *   本文件的逻辑与 voice-agent.js:389-520（ensureAiriProviders）+ 851-984（角色卡）
 *   等价。voice-agent.js 出于回归风险暂未改为调用本文件 ——
 *   【改任何常量时，两处必须同步改】，否则主应用和宠物窗会走出不同配置。
 *
 * 幂等：已有合法值就跳过，绝不覆盖用户手改。可重复调用。
 */
(function (global) {
  'use strict';

  var AIRI_LLM_ID = 'openai-compatible';
  var AIRI_TTS_ID = 'openai-compatible-audio-speech';
  var AIRI_STT_ID = 'openai-compatible-audio-transcription';
  var AIRI_VISION_ID = 'vision-openai-compatible';
  var AIRI_VISION_MODEL = 'doubao-seed-1-6-vision-250815';
  var AIRI_VISION_INTERVAL_MS = '20000';
  var AIRI_VOICE = 'zh-CN-XiaoxiaoNeural';
  var AIRI_MIC_FLAG = 'settings/audio/input/enabled';
  var AIRI_LEGACY_IDS = ['xingyu-voxcpm-local', 'xingyu-sensevoice-local'];
  var AIRI_LEGACY_VOICES = ['taiyi', 'dabin'];

  var CARD_PRESET_GUARD = 'airi-cards-xingyu-preset-v2';

  // 舞台起手形象（2026-09-03 实测取证，见 D:\星屿\work\test-koharu.js）
  //   AIRI 内置默认 = preset-live2d-1（Hiyori Pro，33MB）；宠物窗小、冷启动重，换 13MB 免费版。
  //   只在「用户从没动过舞台形象」时替换一次，写完落 guard，之后绝不覆盖手改。
  var STAGE_MODEL_KEY = 'settings/stage/model';
  var STAGE_DEFAULT_HEAVY = 'preset-live2d-1';
  var STAGE_DEFAULT_LIGHT = 'preset-live2d-2';
  var STAGE_LIGHT_GUARD = 'airi-stage-light-v1';

  // 角色卡预置：人设层 + 形象层（displayModelId 见文件头说明）
  // 形象—人设按气质匹配，不是字母序。
  //   displayModelId 必须取 AIRI display-models store 里存在的 id，否则舞台空白：
  //   preset-live2d-1 Hiyori(Pro) / preset-live2d-2 Hiyori(Free)
  //   preset-vrm-1 AvatarSample_A / preset-vrm-2 AvatarSample_B
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

  var AIRI_PRESET_IDS = ['preset-live2d-1', 'preset-live2d-2', 'preset-vrm-1', 'preset-vrm-2'];

  var CARD_DISPLAY_MODEL_PATCH = {};
  AIRI_CARDS_PRESETS.forEach(function (p) {
    var mid = p.card.extensions && p.card.extensions.airi
      && p.card.extensions.airi.modules && p.card.extensions.airi.modules.displayModelId;
    if (mid) CARD_DISPLAY_MODEL_PATCH[p.id] = mid;
  });

  function readCards() {
    try {
      var raw = localStorage.getItem('airi-cards');
      if (!raw) return [];
      var v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeCards(entries) {
    try { localStorage.setItem('airi-cards', JSON.stringify(entries)); return true; }
    catch (e) { return false; }
  }

  // 只给「预置卡 + 缺 displayModelId」的卡补形象；已有合法值的跳过，绝不覆盖手改
  function patchCards(entries) {
    if (!entries || !entries.length) return false;
    var changed = false;
    entries.forEach(function (pair) {
      var id = pair[0], card = pair[1];
      var wantMid = CARD_DISPLAY_MODEL_PATCH[id];
      if (!wantMid) return;
      var mods = card && card.extensions && card.extensions.airi && card.extensions.airi.modules;
      if (mods && mods.displayModelId && AIRI_PRESET_IDS.indexOf(mods.displayModelId) >= 0) return;
      if (!card.extensions) card.extensions = {};
      if (!card.extensions.airi) card.extensions.airi = { modules: {}, agents: {} };
      if (!card.extensions.airi.modules) card.extensions.airi.modules = {};
      card.extensions.airi.modules.displayModelId = wantMid;
      changed = true;
    });
    return changed;
  }

  function ensureCards() {
    if (localStorage.getItem(CARD_PRESET_GUARD) === 'v2') {
      var entries0 = readCards();
      if (patchCards(entries0)) writeCards(entries0);
      return;
    }
    var entries = readCards();
    var have = {};
    entries.forEach(function (e) { have[e[0]] = true; });
    var added = 0;
    AIRI_CARDS_PRESETS.forEach(function (p) {
      if (!have[p.id]) { entries.push([p.id, p.card]); added++; }
    });
    var patched = patchCards(entries);
    if (added || patched) writeCards(entries);
    localStorage.setItem(CARD_PRESET_GUARD, 'v2');
  }

  /**
   * 写 provider 配置 + 当前选中项 + 角色卡。
   * @param {Object} [opts]
   * @param {boolean} [opts.autoMic=false] 是否自动开麦克风流。
   *   宠物窗默认 false —— 宠物窗是独立进程，自动开麦会和主应用的语音助手抢麦克风。
   * @param {boolean} [opts.withCards=true] 是否写入角色卡预置
   * @param {boolean} [opts.lightStage=false] 是否把舞台起手形象从 33MB Hiyori Pro
   *   换成 13MB Hiyori Free（宠物窗用：小窗 + 冷启动，33MB 会长时间转圈）
   */
  function install(opts) {
    opts = opts || {};
      var autoMic = !!opts.autoMic;
      var withCards = opts.withCards !== false;
      var lightStage = !!opts.lightStage;
    try {
      var base = location.protocol + '//' + location.host;
      var defs = [
        { id: AIRI_LLM_ID, definitionId: 'openai-compatible', url: base + '/ai-proxy/' },
        { id: AIRI_TTS_ID, definitionId: 'openai-compatible-audio-speech', url: base + '/vox-proxy/v1/', model: 'voxcpm-tts', voice: AIRI_VOICE },
        { id: AIRI_STT_ID, definitionId: 'openai-compatible-audio-transcription', url: base + '/asr-proxy/v1/', model: 'sensevoice-small' },
        { id: AIRI_VISION_ID, definitionId: 'openai-compatible', url: base + '/vision-proxy/v1/', model: AIRI_VISION_MODEL }
      ];

      var configured = {}, added = {}, k;
      try { configured = JSON.parse(localStorage.getItem('settings/providers/configured') || '{}') || {}; } catch (e) {}
      try { added = JSON.parse(localStorage.getItem('settings/providers/added') || '{}') || {}; } catch (e) {}

      var changed = false;
      for (k = 0; k < AIRI_LEGACY_IDS.length; k++) {
        if (configured[AIRI_LEGACY_IDS[k]]) { delete configured[AIRI_LEGACY_IDS[k]]; changed = true; }
        if (added[AIRI_LEGACY_IDS[k]]) { delete added[AIRI_LEGACY_IDS[k]]; changed = true; }
      }

      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        var cur = configured[d.id];
        if (cur && cur.definitionId === d.definitionId && cur.config
            && cur.config.baseUrl === d.url && cur.status === 'configured') {
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
          id: d.id, definitionId: d.definitionId,
          config: cfg, status: 'configured', configuredBy: 'user'
        };
        added[d.id] = true;
        changed = true;
      }

      if (changed) {
        localStorage.setItem('settings/providers/configured', JSON.stringify(configured));
        localStorage.setItem('settings/providers/added', JSON.stringify(added));
        localStorage.setItem('onboarding/completed', 'true');
        localStorage.setItem('onboarding/skipped', 'false');
      }

      // 光注册 provider 不够 —— AIRI 还要知道「当前选中哪一个」才真的会去调
      var picks = [
        ['settings/consciousness/active-provider', AIRI_LLM_ID],
        ['settings/consciousness/active-model', 'deepseek-v4-flash'],
        ['settings/hearing/active-provider', AIRI_STT_ID],
        ['settings/hearing/active-model', 'sensevoice-small'],
        ['settings/speech/active-provider', AIRI_TTS_ID],
        ['settings/speech/active-model', 'voxcpm-tts'],
        ['settings/speech/voice', AIRI_VOICE],
        ['settings/vision/active-provider', AIRI_VISION_ID],
        ['settings/vision/active-model', AIRI_VISION_MODEL]
      ];
      for (var j = 0; j < picks.length; j++) {
        var key = picks[j][0], want = picks[j][1];
        var v = localStorage.getItem(key);
        var stale = (v === null || v === '' || v === 'speech-noop'
          || AIRI_LEGACY_IDS.indexOf(v) >= 0);
        if (!stale && want === AIRI_VOICE && AIRI_LEGACY_VOICES.indexOf(v) >= 0) stale = true;
        if (stale) localStorage.setItem(key, want);
      }

      // 'default' 是各浏览器通用的标准 deviceId，AIRI 的 hasSelectedInput 才能匹配上
      if (!localStorage.getItem('settings/audio/input')) {
        localStorage.setItem('settings/audio/input', 'default');
      }
      if (localStorage.getItem('settings/vision/capture-interval-ms') === null) {
        localStorage.setItem('settings/vision/capture-interval-ms', AIRI_VISION_INTERVAL_MS);
      }
      // 舞台起手形象：必须先写 localStorage，AIRI 的 useLocalStorage 才会读到它。
      // 只在 guard 缺失（=从未处理过）且当前仍是 AIRI 内置默认值时替换，避免覆盖手改。
      if (lightStage && !localStorage.getItem(STAGE_LIGHT_GUARD)) {
        var curStage = localStorage.getItem(STAGE_MODEL_KEY);
        if (curStage === null || curStage === '' || curStage === STAGE_DEFAULT_HEAVY) {
          localStorage.setItem(STAGE_MODEL_KEY, STAGE_DEFAULT_LIGHT);
        }
        localStorage.setItem(STAGE_LIGHT_GUARD, '1');
      }

      // 麦克风开关：宠物窗默认关（避免和主应用抢麦）
      if (localStorage.getItem(AIRI_MIC_FLAG) === null) {
        localStorage.setItem(AIRI_MIC_FLAG, autoMic ? 'true' : 'false');
      }

      if (withCards) ensureCards();
      return true;
    } catch (e) {
      console.warn('[airi-bootstrap] 预置失败', e);
      return false;
    }
  }

  global.XingyuAiriBootstrap = {
    install: install,
    ensureCards: ensureCards,
    cards: AIRI_CARDS_PRESETS,
    presetModelIds: AIRI_PRESET_IDS.slice()
  };
})(window);
