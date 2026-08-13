/* ============================================================
   views-settings.js — 设置与全局杂项视图
   设置：updateSyncStatus / openSettings / toggleLockFields / saveSettings
   访问密码：hasPin / hashPin / setPin / verifyPin / lockNow / unlock / applyLockPrefs
   主题：applyTheme / syncThemeUI / 自定义配色（CUSTOM_*）
   i18n：I18N 字典 / t / applyI18n / applyFont / applyBg / applyLang
   引导：maybeShowOnboarding / finishOnboarding
   全局搜索：setupSearch
   时钟：tickClock；二维码：renderQR / openQR / copyLink
   ============================================================ */

  /* ============================================================
     设置
     ============================================================ */
  function updateSyncStatus() {
    const el = $("#syncStatus");
    if (!el) return;
    if (!Sync.isEnabled()) { el.textContent = "未启用云同步。"; return; }
    if (!Sync.getToken()) { el.textContent = "已启用，但尚未填写 GitHub Token。"; return; }
    el.textContent = "同步已启用：数据改动后自动同步，也可点「立即同步」手动触发。";
  }
  function openSettings() {
    const s = Store.getSettings();
    $("#setBaseUrl").value = s.baseUrl || "";
    $("#setApiKey").value = s.apiKey || "";
    $("#setModel").value = s.model || "";
    $("#setNickname").value = s.nickname || "";
    const syncEn = $("#syncEnabled");
    if (syncEn) syncEn.checked = Sync.isEnabled();
    $("#setSyncToken").value = Sync.getToken();
    updateSyncStatus();
    $("#setPin").value = "";
    $("#setPin2").value = "";
    const lockEnabled = localStorage.getItem("zero_lock_enabled") === "1";
    const le = $("#lockEnabled");
    if (le) {
      le.checked = lockEnabled;
      toggleLockFields(lockEnabled);
    }
    $("#lockOnLeave").checked = localStorage.getItem("zero_lock_leave") === "1";
    syncThemeUI();
    // 学习提醒状态
    const remindEn = $("#remindEnabled");
    if (remindEn) {
      remindEn.checked = window.Reminders && Reminders.isEnabled();
      updateRemindStatus();
    }
    // 自动备份状态
    window.Backup && Backup.updateStatusUI();
    showModal("settingsModal");
  }

  function updateRemindStatus() {
    const el = $("#remindStatus");
    if (!el) return;
    const granted = "Notification" in window && Notification.permission === "granted";
    const on = window.Reminders && Reminders.isEnabled();
    if (!on) el.textContent = "未开启提醒。开启后将在此浏览器收到考试 / 任务 / 复习的桌面通知。";
    else if (!granted) el.textContent = "已开启，但浏览器通知权限尚未授予，保存后请允许通知。";
    else el.textContent = "已开启：考试临近（提前 7/3/1 天）、任务到期、卡片待复习时会收到桌面通知。";
  }

  // 访问密码总开关：切换密码字段显隐
  function toggleLockFields(on) {
    const fields = $("#lockFields");
    const hint = $("#lockEnabledHint");
    if (fields) fields.style.display = on ? "" : "none";
    if (hint) hint.style.display = on ? "" : "none";
  }

  async function saveSettings() {
    // 访问密码：总开关关闭 → 清除密码；开启 → 校验并保存
    const lockEnabled = $("#lockEnabled") ? $("#lockEnabled").checked : false;
    if (lockEnabled) {
      const pin = $("#setPin").value;
      const pin2 = $("#setPin2").value;
      if (pin || pin2) {
        if (pin !== pin2) { toast(t("lock.mismatch"), "err"); return; }
        if (!(await setPin(pin))) return;
        toast(pin ? t("lock.saved") : t("lock.cleared"), "ok");
      }
      // 开启但从未设过密码：要求设置
      if (!hasPin()) { toast(t("lock.needPin"), "err"); return; }
      localStorage.setItem("zero_lock_enabled", "1");
      localStorage.setItem("zero_lock_leave", $("#lockOnLeave").checked ? "1" : "0");
    } else {
      // 关闭：清除密码与所有锁定偏好
      await setPin("");
      localStorage.removeItem("zero_lock_enabled");
      localStorage.removeItem("zero_lock_leave");
    }
    Store.setSettings({
      baseUrl: $("#setBaseUrl").value.trim(),
      apiKey: $("#setApiKey").value.trim(),
      model: $("#setModel").value.trim(),
      nickname: $("#setNickname").value.trim()
    });
    const nick = $("#setNickname").value.trim();
    if (nick) Store.setProfile({ name: nick });
    closeModal("settingsModal");
    toast(t("settings.saved"), "ok");
    renderAIStatus();
    renderProfile();
    if (currentView === "dashboard") renderDashboard();
  }

  /* ============================================================
     访问密码锁
     ============================================================ */
  const PIN_HASH_KEY = "zero_pin_hash_v2";
  const LEGACY_PIN_KEY = "zero_pin";

  function hasPin() {
    try { return !!(localStorage.getItem(PIN_HASH_KEY) || localStorage.getItem(LEGACY_PIN_KEY)); }
    catch (e) { return false; }
  }

  async function hashPin(pin) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      const bytes = new TextEncoder().encode(pin);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return "sha256:" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return "fallback:" + btoa(unescape(encodeURIComponent(pin)));
  }

  async function setPin(pin) {
    try {
      if (pin) localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
      else localStorage.removeItem(PIN_HASH_KEY);
      localStorage.removeItem(LEGACY_PIN_KEY);
      return true;
    } catch (e) {
      toast("访问密码保存失败，请检查浏览器存储权限", "err");
      return false;
    }
  }

  async function verifyPin(pin) {
    try {
      const stored = localStorage.getItem(PIN_HASH_KEY);
      if (stored) return stored === await hashPin(pin);
      const legacy = localStorage.getItem(LEGACY_PIN_KEY);
      if (!legacy) return false;
      const plain = atob(legacy);
      if (plain !== pin) return false;
      await setPin(pin);
      return true;
    } catch (e) {
      return false;
    }
  }

  function lockNow() {
    const mask = $("#lockMask");
    if (mask) {
      mask.classList.add("show");
      mask.style.display = "flex";
      mask.setAttribute("aria-hidden", "false");
      if (window.Anim) Anim.lockIn(mask);
    }
    const pinInput = $("#lockPin");
    if (pinInput) { pinInput.value = ""; pinInput.focus(); }
    const hint = $("#lockHint");
    if (hint) hint.textContent = "";
  }
  async function unlock() {
    const val = $("#lockPin").value;
    const hint = $("#lockHint");
    const btn = $("#btnUnlock");
    if (btn) btn.disabled = true;
    if (val && await verifyPin(val)) {
      const mask = $("#lockMask");
      if (window.Anim) {
        Anim.lockOut(mask, () => {
          mask.classList.remove("show");
          mask.style.display = "none";
          mask.setAttribute("aria-hidden", "true");
        });
      } else {
        mask.classList.remove("show");
        mask.style.display = "none";
        mask.setAttribute("aria-hidden", "true");
      }
    } else if (hint) {
      hint.textContent = t("lock.wrong");
    }
    if (btn) btn.disabled = false;
    const pinInput = $("#lockPin");
    if (pinInput) { pinInput.value = ""; pinInput.focus(); }
  }
  function applyLockPrefs() {
    // 启动锁：总开关开启且设置了密码才锁定
    if (localStorage.getItem("zero_lock_enabled") === "1" && hasPin()) lockNow();
  }

  /* ============================================================
     主题（纯黑 / 纯白 / 自定义颜色）
     ============================================================ */
  const CUSTOM_DEFAULTS = { paper: "#000000", card: "#101010", drawer: "#080808", ink: "#ffffff", accent: "#ffffff", rule: "#232323" };
  const CUSTOM_MAP = { paper: "--paper", card: "--paper-card", drawer: "--drawer", ink: "--ink", accent: "--accent", rule: "--rule" };
  const CUSTOM_VARS = ["--paper","--paper-2","--paper-3","--paper-card","--paper-hover","--paper-sunk",
    "--ink","--ink-2","--ink-3","--ink-faint","--accent","--rule","--rule-2","--rule-thin",
    "--drawer","--drawer-2","--drawer-3","--drawer-text","--drawer-deep","--fill","--fill-2","--fill-3"];

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(v, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const mix = (c) => Math.round(c + (t - c) * p);
    return "#" + [mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, "0")).join("");
  }
  function rgbaOf(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function getCustomColors() {
    try { return Object.assign({}, CUSTOM_DEFAULTS, JSON.parse(localStorage.getItem("zero_custom_colors") || "{}")); }
    catch (e) { return { ...CUSTOM_DEFAULTS }; }
  }
  function applyCustomColors(colors) {
    const s = document.documentElement.style;
    const { paper, card, drawer, ink, accent, rule } = colors;
    s.setProperty("--paper", paper);
    s.setProperty("--paper-card", card);
    s.setProperty("--drawer", drawer);
    s.setProperty("--ink", ink);
    s.setProperty("--accent", accent);
    s.setProperty("--rule", rule);
    // 派生灰阶（让自定义配色整体协调）
    s.setProperty("--paper-2", shade(paper, 0.04));
    s.setProperty("--paper-3", shade(paper, 0.08));
    s.setProperty("--paper-hover", shade(paper, 0.06));
    s.setProperty("--paper-sunk", shade(paper, 0.1));
    s.setProperty("--ink-2", shade(ink, -0.35));
    s.setProperty("--ink-3", shade(ink, -0.55));
    s.setProperty("--ink-faint", shade(ink, -0.7));
    s.setProperty("--rule-2", shade(paper, 0.03));
    s.setProperty("--rule-thin", rgbaOf(ink, 0.12));
    s.setProperty("--drawer-2", shade(drawer, 0.04));
    s.setProperty("--drawer-3", shade(drawer, 0.09));
    s.setProperty("--drawer-text", shade(ink, -0.15));
    s.setProperty("--drawer-deep", shade(ink, -0.55));
    s.setProperty("--fill", rgbaOf(ink, 0.06));
    s.setProperty("--fill-2", rgbaOf(ink, 0.1));
    s.setProperty("--fill-3", rgbaOf(ink, 0.16));
  }
  function clearCustomColors() {
    CUSTOM_VARS.forEach(v => document.documentElement.style.removeProperty(v));
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function syncThemeUI() {
    const curMode = document.documentElement.dataset.themeMode || localStorage.getItem("zero_theme") || "system";
    const curTheme = document.documentElement.dataset.theme || systemTheme();
    const advanced = !["system", "dark", "light", "ocean", "custom"].includes(curMode);
    if (advanced) document.body.classList.add("show-advanced-themes");
    const moreBtn = $("#btnToggleAdvancedThemes");
    if (moreBtn) moreBtn.textContent = document.body.classList.contains("show-advanced-themes") ? "收起更多主题" : "显示更多主题";
    $$(".theme-opt").forEach(b => b.classList.toggle("active", b.dataset.themePick === curMode));
    const panel = $("#themeCustom");
    if (panel) panel.style.display = curTheme === "custom" ? "grid" : "none";
    const colors = getCustomColors();
    Object.keys(CUSTOM_MAP).forEach(k => {
      const inp = document.querySelector(`#themeCustom input[data-cvar="${k}"]`);
      if (inp) inp.value = colors[k];
    });
    const sw = $("#swCustom");
    if (sw) sw.style.background = colors.accent;
    // 字体 / 语言高亮
    const FONT_MIGRATE = { sans: "default", serif: "song", mono: "hei" };
    let curFont = document.documentElement.dataset.font || "default";
    curFont = FONT_MIGRATE[curFont] || curFont;
    $$("[data-font-pick]").forEach(b => b.classList.toggle("active", b.dataset.fontPick === curFont));
    const curLang = document.documentElement.dataset.lang || "zh";
    $$("[data-lang-pick]").forEach(b => b.classList.toggle("active", b.dataset.langPick === curLang));
    const curBg = document.documentElement.dataset.bg || "none";
    $$("[data-bg-pick]").forEach(b => b.classList.toggle("active", b.dataset.bgPick === curBg));
  }
  function applyTheme(mode) {
    const theme = mode === "system" ? systemTheme() : mode;
    if (mode === "custom") {
      applyCustomColors(getCustomColors());
    } else {
      clearCustomColors();
    }
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("zero_theme", mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f5f7" : "#000000");
    syncThemeUI();
  }

  /* ============================================================
     i18n（中 / 英 / 繁）与字体
     ============================================================ */
  const I18N = {
    zh: {
      "logo.sub": "个人学习工作台",
      "nav.group.work": "工作台",
      "nav.group.study": "学习资料",
      "nav.group.growth": "自我成长",
      "nav.dashboard": "今日",
      "nav.courses": "课程作业",
      "nav.focus": "专注学习",
      "nav.notes": "学习笔记库",
      "nav.lit": "文献资料",
      "nav.news": "热点新闻",
      "nav.growth": "成长档案",
      "nav.ai": "AI 助手",
      "nav.weather": "天气",
      "nav.hero": "星屿序章",
      "nav.prisma": "棱镜艺境",
      "nav.nexus": "云门智界",
      "nav.foldcraft": "折艺工坊",
      "nav.securify": "守御界",
      "role": "个人工作台",
      "mobile.today": "今日", "mobile.courses": "课程", "mobile.notes": "笔记", "mobile.focus": "专注", "mobile.more": "更多",
      "settings": "设置",
      "search.ph": "搜索笔记 / 任务 / 课程...",
      "title.dashboard": "今日", "title.courses": "课程作业", "title.notes": "学习笔记库",
      "title.focus": "专注学习", "title.growth": "成长档案", "title.lit": "文献资料",
      "title.news": "热点新闻", "title.ai": "AI 助手", "title.weather": "天气",
      "title.hero": "星屿序幕",
      "title.prisma": "棱镜艺境",      "title.nexus": "云门智界",      "title.foldcraft": "折艺工坊",      "title.securify": "守御界",
      "sub.dashboard": "学习进度一览，今天也要保持专注",
      "sub.courses": "课程、课表与作业任务管理",
      "sub.notes": "沉淀知识，构建你的笔记库",
      "sub.focus": "番茄钟与专注统计",
      "sub.growth": "成绩、技能与成长轨迹",
      "sub.lit": "专业文献库与期刊导航",
      "sub.news": "每日国内外热点速递",
      "sub.ai": "你的智能学习伙伴",
      "sub.weather": "全国城市实时天气与未来一周预报",
      "sub.hero": "全屏视频 · 玻璃拟态 · 电影感标题 — 单页英雄展示页",
      "sub.prisma": "创意视觉工作室展示页",
      "sub.nexus": "下一代智能基础设施展示页",
      "sub.foldcraft": "视觉叙事创意工作室展示页",
      "sub.securify": "数据安全 SaaS 展示页",
      "hero.todo": "待办任务", "hero.due": "今日到期", "hero.notes": "笔记", "hero.focusMin": "今日专注(分)", "hero.news": "今日热点", "hero.newsAll": "查看全部", "hero.refresh": "刷新", "hero.refreshed": "已刷新",
      "settings.title": "设置",
      "settings.theme": "界面主题", "settings.font": "界面字体", "settings.lang": "界面语言", "settings.bg": "界面背景", "bg.none": "无", "bg.guilinMist": "桂林·雾山", "bg.guilinAerial": "桂林·航拍", "bg.jiuzhaigou": "九寨沟", "bg.zhangjiajie": "张家界", "bg.hint": "以中国山河摄影作背景，文字始终清晰可读。",
      "settings.ai": "AI 模型配置（OpenAI 兼容接口）",
      "settings.nick": "个人昵称", "settings.data": "数据管理", "settings.lock": "访问密码",
      "lock.title": "平台已锁定", "lock.unlock": "解锁", "lock.enabled": "启用访问密码", "lock.enabledHint": "已开启：打开平台需输入密码。关闭此开关将清除已保存的密码。", "lock.needPin": "请先设置访问密码", "lock.pinNew": "新密码", "lock.pinConfirm": "确认密码", "lock.onLeave": "离开页面时自动锁定", "lock.hint": "设置密码后，打开平台需输入密码才能进入；密码仅保存在本机浏览器。", "lock.wrong": "密码错误", "lock.mismatch": "两次输入的密码不一致", "lock.saved": "访问密码已设置", "lock.cleared": "访问密码已清除", "settings.saved": "设置已保存",
      "theme.dark": "纯黑", "theme.light": "纯白", "theme.ocean": "墨蓝", "theme.forest": "青竹", "theme.sepia": "纸墨", "theme.custom": "自定义", "theme.purple": "暮紫", "theme.wine": "酒红", "theme.dusk": "晚霞", "theme.mist": "云灰", "theme.mint": "薄荷", "theme.honey": "蜜糖", "theme.guishan": "桂山", "theme.danxia": "丹霞", "theme.qingzang": "青藏", "theme.caoyuan": "草原", "theme.damo": "大漠",
      "font.default": "默认", "font.kai": "楷书", "font.song": "宋体", "font.fangsong": "仿宋", "font.hei": "黑体",
      "lang.zh": "简体", "lang.zhHant": "繁体", "lang.en": "English",
      "btn.addCourse": "+ 添加课程", "btn.addTask": "+ 添加任务", "btn.import": "导入课表", "btn.aiSort": "AI 智能排序",
      "btn.save": "保存", "btn.cancel": "取消", "btn.export": "导出数据(JSON)", "btn.importData": "导入数据", "btn.clear": "清空全部数据",
      "qr.title": "扫码访问", "qr.copy": "复制永久链接", "qr.hint": "手机扫码即可永久访问你的个人工作台。",
      "quote.title": "每日一言", "quote.next": "换一句", "quote.cat.motivation": "励志", "quote.cat.memes": "热梗", "quote.cat.poison": "毒鸡汤",
      "backup.title": "自动备份", "backup.now": "立即备份", "backup.desc": "数据会自动备份到本机磁盘（data/backups/ 目录，保留最近 30 份），即使清空浏览器缓存也不丢失。若 7 天未备份，打开平台时会自动静默备份一次。",
      "ai.keyTip": "🔒 安全建议：请为星屿单独创建一个 API Key（如 DeepSeek 平台可创建多个 Key），不要把同时用于其他服务的高权限 Key 粘贴到这里；一旦泄露请立即到平台撤销并重新生成。"
    },
    "zh-Hant": {
      "logo.sub": "個人學習工作台",
      "nav.group.work": "工作台",
      "nav.group.study": "學習資料",
      "nav.group.growth": "自我成長",
      "nav.dashboard": "今日",
      "nav.courses": "課程作業",
      "nav.focus": "專注學習",
      "nav.notes": "學習筆記庫",
      "nav.lit": "文獻資料",
      "nav.news": "熱點新聞",
      "nav.growth": "成長檔案",
      "nav.ai": "AI 助手",
      "nav.weather": "天氣",
      "nav.hero": "星屿序章",
      "nav.prisma": "稜鏡藝境",
      "nav.nexus": "雲門智界",
      "nav.foldcraft": "摺藝工坊",
      "nav.securify": "守禦界",
      "role": "個人工作台",
      "mobile.today": "今日", "mobile.courses": "課程", "mobile.notes": "筆記", "mobile.focus": "專注", "mobile.more": "更多",
      "settings": "設定",
      "search.ph": "搜尋筆記 / 任務 / 課程...",
      "title.dashboard": "今日", "title.courses": "課程作業", "title.notes": "學習筆記庫",
      "title.focus": "專注學習", "title.growth": "成長檔案", "title.lit": "文獻資料",
      "title.news": "熱點新聞", "title.ai": "AI 助手", "title.weather": "天氣",
      "title.hero": "星屿序幕",
      "title.prisma": "稜鏡藝境",      "title.nexus": "雲門智界",      "title.foldcraft": "摺藝工坊",      "title.securify": "守禦界",
      "sub.dashboard": "學習進度一覽，今天也要保持專注",
      "sub.courses": "課程、課表與作業任務管理",
      "sub.notes": "沉澱知識，構建你的筆記庫",
      "sub.focus": "番茄鐘與專注統計",
      "sub.growth": "成績、技能與成長軌跡",
      "sub.lit": "專業文獻庫與期刊導航",
      "sub.news": "每日國內外熱點速遞",
      "sub.ai": "你的智能學習夥伴",
      "sub.weather": "全國城市即時天氣與未來一週預報",
      "sub.hero": "全屏影片 · 玻璃擬態 · 電影感標題 — 單頁英雄展示頁",
      "sub.prisma": "創意視覺工作室展示頁",
      "sub.nexus": "下一代智能基礎設施展示頁",
      "sub.foldcraft": "視覺敘事創意工作室展示頁",
      "sub.securify": "數據安全 SaaS 展示頁",
      "hero.todo": "待辦任務", "hero.due": "今日到期", "hero.notes": "筆記", "hero.focusMin": "今日專注(分)", "hero.news": "今日熱點", "hero.newsAll": "查看全部", "hero.refresh": "重新整理", "hero.refreshed": "已更新",
      "settings.title": "設定",
      "settings.theme": "界面主題", "settings.font": "界面字體", "settings.lang": "界面語言", "settings.bg": "界面背景", "bg.none": "無", "bg.guilinMist": "桂林·霧山", "bg.guilinAerial": "桂林·航拍", "bg.jiuzhaigou": "九寨溝", "bg.zhangjiajie": "張家界", "bg.hint": "以中國山河攝影作背景，文字始終清晰可讀。",
      "settings.ai": "AI 模型配置（OpenAI 兼容接口）",
      "settings.nick": "個人暱稱", "settings.data": "數據管理", "settings.lock": "訪問密碼",
      "lock.title": "平台已鎖定", "lock.unlock": "解鎖", "lock.enabled": "啟用訪問密碼", "lock.enabledHint": "已開啟：打開平台需輸入密碼。關閉此開關將清除已保存的密碼。", "lock.needPin": "請先設置訪問密碼", "lock.pinNew": "新密碼", "lock.pinConfirm": "確認密碼", "lock.onLeave": "離開頁面時自動鎖定", "lock.hint": "設置密碼後，打開平台需輸入密碼才能進入；密碼僅保存在本機瀏覽器。", "lock.wrong": "密碼錯誤", "lock.mismatch": "兩次輸入的密碼不一致", "lock.saved": "訪問密碼已設置", "lock.cleared": "訪問密碼已清除", "settings.saved": "設置已保存",
      "theme.dark": "純黑", "theme.light": "純白", "theme.ocean": "墨藍", "theme.forest": "青竹", "theme.sepia": "紙墨", "theme.custom": "自定義", "theme.purple": "暮紫", "theme.wine": "酒紅", "theme.dusk": "晚霞", "theme.mist": "雲灰", "theme.mint": "薄荷", "theme.honey": "蜜糖", "theme.guishan": "桂山", "theme.danxia": "丹霞", "theme.qingzang": "青藏", "theme.caoyuan": "草原", "theme.damo": "大漠",
      "font.default": "默認", "font.kai": "楷書", "font.song": "宋體", "font.fangsong": "仿宋", "font.hei": "黑體",
      "lang.zh": "簡體", "lang.zhHant": "繁體", "lang.en": "English",
      "btn.addCourse": "+ 添加課程", "btn.addTask": "+ 添加任務", "btn.import": "導入課表", "btn.aiSort": "AI 智能排序",
      "btn.save": "保存", "btn.cancel": "取消", "btn.export": "導出數據(JSON)", "btn.importData": "導入數據", "btn.clear": "清空全部數據",
      "qr.title": "掃碼訪問", "qr.copy": "複製永久連結", "qr.hint": "手機掃碼即可永久訪問你的個人工作台。",
      "quote.title": "每日一言", "quote.next": "換一句", "quote.cat.motivation": "勵志", "quote.cat.memes": "熱梗", "quote.cat.poison": "毒雞湯",
      "backup.title": "自動備份", "backup.now": "立即備份", "backup.desc": "數據會自動備份到本機磁盤（data/backups/ 目錄，保留最近 30 份），即使清空瀏覽器緩存也不丟失。若 7 天未備份，打開平台時會自動靜默備份一次。",
      "ai.keyTip": "🔒 安全建議：請為星嶼單獨創建一個 API Key（如 DeepSeek 平台可創建多個 Key），不要把同時用於其他服務的高權限 Key 粘貼到這裡；一旦洩露請立即到平台撤銷並重新生成。"
    },
    en: {
      "logo.sub": "Personal Study Desk",
      "nav.group.work": "Work",
      "nav.group.study": "Study",
      "nav.group.growth": "Growth",
      "nav.dashboard": "Today",
      "nav.courses": "Courses",
      "nav.focus": "Focus",
      "nav.notes": "Notes",
      "nav.lit": "Library",
      "nav.news": "News",
      "nav.growth": "Profile",
      "nav.ai": "AI Assistant",
      "nav.weather": "Weather",
      "nav.hero": "Velorah",
      "nav.prisma": "Prisma",
      "nav.nexus": "Nexus",
      "nav.foldcraft": "Foldcraft",
      "nav.securify": "Securify",
      "role": "Personal workspace",
      "mobile.today": "Today", "mobile.courses": "Courses", "mobile.notes": "Notes", "mobile.focus": "Focus", "mobile.more": "More",
      "settings": "Settings",
      "search.ph": "Search notes / tasks / courses...",
      "title.dashboard": "Today", "title.courses": "Courses", "title.notes": "Notes",
      "title.focus": "Focus", "title.growth": "Profile", "title.lit": "Library",
      "title.news": "News", "title.ai": "AI Assistant", "title.weather": "Weather",
      "title.hero": "Velorah",
      "title.prisma": "Prisma",      "title.nexus": "Nexus",      "title.foldcraft": "Foldcraft",      "title.securify": "Securify",
      "sub.dashboard": "Your study at a glance — stay focused today",
      "sub.courses": "Courses, timetable & assignments",
      "sub.notes": "Build your knowledge base",
      "sub.focus": "Pomodoro & focus stats",
      "sub.growth": "Grades, skills & growth",
      "sub.lit": "References & journal navigation",
      "sub.news": "Daily headline digest",
      "sub.ai": "Your smart study partner",
      "sub.weather": "Live weather for Chinese cities with a 7-day forecast",
      "sub.hero": "Fullscreen video · liquid glass · cinematic type — single-page hero showcase",
      "sub.prisma": "Creative visual studio showcase",
      "sub.nexus": "Next-layer AI infrastructure showcase",
      "sub.foldcraft": "Visual storytelling studio showcase",
      "sub.securify": "Data-security SaaS showcase",
      "hero.todo": "Open tasks", "hero.due": "Due today", "hero.notes": "Notes", "hero.focusMin": "Focus (min)", "hero.news": "Top News", "hero.newsAll": "View All", "hero.refresh": "Refresh", "hero.refreshed": "Updated",
      "settings.title": "Settings",
      "settings.theme": "Theme", "settings.font": "Font", "settings.lang": "Language", "settings.bg": "Background", "bg.none": "None", "bg.guilinMist": "Guilin Mist", "bg.guilinAerial": "Guilin Aerial", "bg.jiuzhaigou": "Jiuzhaigou", "bg.zhangjiajie": "Zhangjiajie", "bg.hint": "China landscape photography as backdrop; text stays readable.",
      "settings.ai": "AI Model (OpenAI-compatible)",
      "settings.nick": "Nickname", "settings.data": "Data", "settings.lock": "Access PIN",
      "lock.title": "Locked", "lock.unlock": "Unlock", "lock.enabled": "Enable access PIN", "lock.enabledHint": "On: the platform asks for the PIN on open. Turning this off clears the saved PIN.", "lock.needPin": "Please set an access PIN first", "lock.pinNew": "New PIN", "lock.pinConfirm": "Confirm PIN", "lock.onLeave": "Lock when leaving the page", "lock.hint": "Once set, the platform asks for the PIN on open. The PIN stays only in this browser.", "lock.wrong": "Wrong PIN", "lock.mismatch": "PINs do not match", "lock.saved": "Access PIN saved", "lock.cleared": "Access PIN cleared", "settings.saved": "Settings saved",
      "theme.dark": "Black", "theme.light": "White", "theme.ocean": "Ocean", "theme.forest": "Forest", "theme.sepia": "Sepia", "theme.custom": "Custom", "theme.purple": "Purple", "theme.wine": "Wine", "theme.dusk": "Dusk", "theme.mist": "Mist", "theme.mint": "Mint", "theme.honey": "Honey", "theme.guishan": "Guishan", "theme.danxia": "Danxia", "theme.qingzang": "Qingzang", "theme.caoyuan": "Grassland", "theme.damo": "Desert",
      "font.default": "Default", "font.kai": "Kai", "font.song": "Song", "font.fangsong": "FangSong", "font.hei": "Hei",
      "lang.zh": "Simplified", "lang.zhHant": "Traditional", "lang.en": "English",
      "btn.addCourse": "+ Add Course", "btn.addTask": "+ Add Task", "btn.import": "Import", "btn.aiSort": "AI Sort",
      "btn.save": "Save", "btn.cancel": "Cancel", "btn.export": "Export (JSON)", "btn.importData": "Import", "btn.clear": "Clear All",
      "qr.title": "Scan to Visit", "qr.copy": "Copy Link", "qr.hint": "Scan to open your workspace on your phone.",
      "quote.title": "Daily Quote", "quote.next": "Next", "quote.cat.motivation": "Inspire", "quote.cat.memes": "Meme", "quote.cat.poison": "Savage",
      "backup.title": "Auto Backup", "backup.now": "Backup Now", "backup.desc": "Data is backed up to your local disk automatically (data/backups/, keeping the latest 30 copies) — even clearing browser storage won't lose it. If no backup happened in 7 days, one runs silently when you open the platform.",
      "ai.keyTip": "🔒 Security tip: create a dedicated API Key just for Xingyu (e.g. DeepSeek lets you create multiple keys). Do not paste a high-privilege key shared with other services here; if it ever leaks, revoke it immediately."
    }
  };
  function t(key) {
    const lang = document.documentElement.dataset.lang || "zh";
    const d = I18N[lang] || I18N.zh;
    return d[key] != null ? d[key] : (I18N.zh[key] != null ? I18N.zh[key] : key);
  }
  function applyI18n() {
    $$("[data-i18n]").forEach(el => {
      const k = el.dataset.i18n;
      if (k) el.textContent = t(k);
    });
    $$("[data-i18n-ph]").forEach(el => {
      const k = el.dataset.i18nPh;
      if (k) el.placeholder = t(k);
    });
  }
  function applyFont(font) {
    const FONT_MIGRATE = { sans: "default", serif: "song", mono: "hei" };
    font = FONT_MIGRATE[font] || font;
    document.documentElement.dataset.font = font;
    localStorage.setItem("zero_font", font);
    $$("[data-font-pick]").forEach(b => b.classList.toggle("active", b.dataset.fontPick === font));
  }
  function applyBg(bg) {
    document.documentElement.dataset.bg = bg;
    localStorage.setItem("zero_bg", bg);
    $$("[data-bg-pick]").forEach(b => b.classList.toggle("active", b.dataset.bgPick === bg));
  }
  function applyLang(lang) {
    document.documentElement.dataset.lang = lang;
    localStorage.setItem("zero_lang", lang);
    $$("[data-lang-pick]").forEach(b => b.classList.toggle("active", b.dataset.langPick === lang));
    applyI18n();
    // 天气视图按新语言重渲染（用缓存数据，不重新请求）
    if (currentView === "weather" && window.Weather) Weather.reRender();
    // 重渲染依赖文案的界面
    if (typeof switchView === "function") { switchView(currentView); } else { renderCurrent(); }
  }

  /* ============================================================
     全局搜索
     ============================================================ */
  function setupSearch() {
    const input = $("#globalSearch");
    const box = $("#searchResults");
    if (!input || !box) return;
    let results = [];
    let activeIndex = -1;

    const collect = q => {
      const out = [];
      const add = (items, type, view, act, text) => items.forEach(item => {
        const haystack = text(item).toLowerCase();
        if (haystack.includes(q)) out.push({ type, view, act, id: item.id, title: item.title || item.name || item.subject || "未命名" });
      });
      add(Store.getAll("notes"), "笔记", "notes", "note", n => `${n.title || ""} ${n.subject || ""} ${n.content || ""} ${(n.tags || []).join(" ")}`);
      add(Store.getAll("tasks"), "任务", "courses", "task", t => `${t.title || ""} ${Store.getCourseName(t.courseId)}`);
      add(Store.getAll("courses"), "课程", "courses", "course", c => `${c.name || ""} ${c.teacher || ""} ${c.location || ""}`);
      add(Store.getAll("literature"), "文献", "lit", "lit", l => `${l.title || ""} ${l.authors || ""} ${(l.tags || []).join(" ")}`);
      add(Store.getAll("projects"), "项目", "growth", "project", p => `${p.name || ""} ${p.role || ""} ${p.desc || ""}`);
      return out.slice(0, 8);
    };

    const hide = () => {
      box.hidden = true;
      box.innerHTML = "";
      results = [];
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
    };

    const select = item => {
      if (!item) return;
      hide();
      input.value = "";
      switchView(item.view);
      if (item.act === "note") setTimeout(() => openNote(item.id), 100);
      else if (item.act === "task") setTimeout(() => openTaskForm(item.id), 100);
      else if (item.act === "course") setTimeout(() => openCourseForm(item.id), 100);
      else if (item.act === "lit") setTimeout(() => openLitForm(item.id), 100);
      else toast(`已跳转到「${item.type}」`, "ok");
    };

    const setActive = index => {
      if (!results.length) return;
      activeIndex = (index + results.length) % results.length;
      box.querySelectorAll(".search-result").forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      const active = box.querySelector(`#search-result-${activeIndex}`);
      if (active) {
        input.setAttribute("aria-activedescendant", active.id);
        active.scrollIntoView({ block: "nearest" });
      }
    };

    const render = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { hide(); return; }
      results = collect(q);
      box.hidden = false;
      box.innerHTML = results.length
        ? results.map((r, i) => `<button type="button" class="search-result" id="search-result-${i}" role="option" data-index="${i}"><span>${esc(r.title)}</span><small>${r.type}</small></button>`).join("")
        : `<div class="search-empty">未找到匹配内容</div>`;
      activeIndex = results.length ? 0 : -1;
      if (results.length) setActive(0);
      box.querySelectorAll(".search-result").forEach(el => {
        el.onmousedown = e => e.preventDefault();
        el.onclick = () => select(results[Number(el.dataset.index)]);
      });
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    input.addEventListener("blur", () => setTimeout(hide, 120));
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); select(results[activeIndex]); }
      else if (e.key === "Escape") { hide(); input.blur(); }
    });
  }

  /* ============================================================
     时钟 + 节日
     ============================================================ */
  function tickClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    $("#clockTime").textContent = `${h}:${m}`;
    const week = WEEKDAYS[now.getDay()];
    $("#clockDate").textContent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${week}`;

    // 节日 + 农历
    const festEl = $("#clockFest");
    if (festEl && window.Lunar) {
      const info = Lunar.getTodayInfo(now);
      let parts = [];
      if (info.main) {
        parts.push(`<span class="fest-today">${info.main.emoji} ${info.main.name}</span>`);
      }
      parts.push(`<span class="fest-lunar">${info.lunarText}</span>`);
      if (info.next && info.next.days > 0) {
        parts.push(`<span class="fest-next">距${info.next.festival.name}还有${info.next.days}天</span>`);
      }
      festEl.innerHTML = parts.join(" · ");
    } else if (festEl) {
      festEl.textContent = "";
    }
  }

  /* ============================================================
     二维码
     ============================================================ */
  const DEFAULT_SITE = window.XINGYU_SITE_URL || "https://lele332.github.io/xingyu-platform/";

  // 使用固定的永久二维码（指向 GitHub Pages 永久链接），不再动态生成
  function renderQR() {
    const box = $("#qrCodeBox");
    box.innerHTML = "";
    const img = document.createElement("img");
    img.src = "xingyu-qrcode.png";
    img.alt = "星屿 · 永久二维码";
    img.className = "qr-static";
    img.onerror = () => { box.innerHTML = `<span class="hint">二维码图片加载失败，请检查 xingyu-qrcode.png 是否存在。</span>`; };
    box.appendChild(img);
  }

  function openQR() {
    showModal("qrcodeModal");
    renderQR();
  }

  function copyLink() {
    navigator.clipboard.writeText(DEFAULT_SITE)
      .then(() => toast("永久链接已复制", "ok"))
      .catch(() => toast("复制失败，请手动复制：" + DEFAULT_SITE, "err"));
  }

  /* ============================================================
     首次引导
     ============================================================ */
  function maybeShowOnboarding() {
    if (localStorage.getItem("zero_onboarded_v3") === "1") return;
    const info = Store.getStorageInfo && Store.getStorageInfo();
    if (!info || !info.firstRun) return;
    const profile = Store.getProfile();
    $("#onboardName").value = profile.name && profile.name !== "同学" ? profile.name : "";
    $("#onboardGoal").value = profile.goal || "";
    setTimeout(() => showModal("onboardingModal"), 500);
  }

  function finishOnboarding() {
    const name = $("#onboardName").value.trim() || "同学";
    const goal = $("#onboardGoal").value.trim();
    if (!$("#onboardKeepDemo").checked) Store.clearAll();
    Store.setProfile({ name, goal });
    localStorage.setItem("zero_onboarded_v3", "1");
    closeModal("onboardingModal");
    refreshAfterDataChange();
    toast(`欢迎你，${name}`, "ok");
  }
