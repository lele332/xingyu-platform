/* ============================================================
   app-core.js — 应用核心层
   - 共享状态 + 通用工具（esc/fmtDate/toast/日期）
   - 视图切换调度（switchView / renderCurrent / revealCards）
   - 弹窗管理（iOS Sheet 风格）、回收站、网络状态
   - 全局事件绑定（bindEvents）与启动入口（init）
   说明：原 app.js（3211 行）按视图拆分而来。本文件与
   js/views-*.js 的函数均为全局函数，按名称互相调用。
   ============================================================ */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---------- 工具函数 ---------- */
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const PRIORITY_MAP = { high: "高", mid: "中", low: "低" };
  const STATUS_MAP = { todo: "待完成", doing: "进行中", done: "已完成" };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function fmtDateFull(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function daysUntil(iso) {
    if (!iso) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    return Math.ceil((d - now) / 86400000);
  }
  function localDateKey(value = new Date()) {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function todayISO() {
    return localDateKey();
  }
  // 记录正在显示的 toast（按 key 去重，避免重复点击时堆叠）
  const _toastActive = new Map();

  function dismissToast(key) {
    const t = _toastActive.get(key);
    if (!t) return;
    _toastActive.delete(key);
    const el = t.el;
    el.classList.add("hide");
    t.timer2 = setTimeout(() => el.remove(), 280);
  }

  function toast(msg, type = "", options = {}) {
    options = options || {};
    let wrap = $("#toastWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toastWrap";
      wrap.setAttribute("aria-live", "polite");
      wrap.setAttribute("aria-atomic", "false");
      document.body.appendChild(wrap);
    }

    const duration = options.duration || 3200;
    const key = options.key || (type + "|" + msg);

    // 同 key 已存在：复用该元素，仅刷新内容与倒计时（不会堆出多个）
    if (_toastActive.has(key)) {
      const t = _toastActive.get(key);
      t.el.querySelector(".toast-msg").textContent = msg;
      t.el.className = "toast " + type + " show";
      const bar = t.el.querySelector(".toast-bar");
      bar.style.transition = "none";
      bar.style.transform = "scaleX(1)";
      void t.el.offsetWidth;                       // 强制回流，让进度条从头开始
      bar.style.transition = "transform " + duration + "ms linear";
      bar.style.transform = "scaleX(0)";
      clearTimeout(t.timer1);
      clearTimeout(t.timer2);
      t.timer1 = setTimeout(() => dismissToast(key), duration);
      t.el.classList.remove("pop"); void t.el.offsetWidth; t.el.classList.add("pop"); // 轻微弹动反馈
      return t.el;
    }

    // 限制同时显示的条数，超出则移除最旧的一条，防止无限堆叠
    while (wrap.children.length >= 4) {
      const oldest = wrap.firstElementChild;
      if (oldest && oldest.dataset && oldest.dataset.key) _toastActive.delete(oldest.dataset.key);
      if (oldest) oldest.remove();
    }

    const el = document.createElement("div");
    el.className = "toast " + type;
    el.dataset.key = key;
    el.setAttribute("role", type === "err" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = type === "err" ? "✕" : (type === "ok" ? "✓" : "ℹ");
    el.appendChild(icon);

    const text = document.createElement("span");
    text.className = "toast-msg";
    text.textContent = msg;
    el.appendChild(text);

    if (options.actionLabel && typeof options.onAction === "function") {
      const action = document.createElement("button");
      action.className = "toast-action";
      action.textContent = options.actionLabel;
      action.onclick = () => {
        options.onAction();
        el.remove();
        const cur = _toastActive.get(key);
        if (cur && cur.el === el) _toastActive.delete(key);
      };
      el.appendChild(action);
    }

    const bar = document.createElement("span");
    bar.className = "toast-bar";
    el.appendChild(bar);

    wrap.appendChild(el);
    requestAnimationFrame(() => {
      el.classList.add("show");
      bar.style.transform = "scaleX(1)";
      void bar.offsetWidth;                        // 回流后开始倒计时动画
      bar.style.transition = "transform " + duration + "ms linear";
      bar.style.transform = "scaleX(0)";
    });

    const rec = { el, timer1: null, timer2: null };
    rec.timer1 = setTimeout(() => dismissToast(key), duration);
    _toastActive.set(key, rec);
    return el;
  }

  /* ---------- 视图切换（iOS 风格：进入动画可重复触发） ---------- */
  let currentView = "dashboard";
  function switchView(view) {
    if (view === currentView) { renderCurrent(); return; }
    const prev = $("#view-" + currentView);
    currentView = view;
    $$(".view").forEach(v => v.classList.remove("active"));
    $$(".nav-item").forEach(n => {
      const active = n.dataset.view === view;
      n.classList.toggle("active", active);
      if (active) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });
    $$(".mobile-tab").forEach(tab => {
      const target = tab.dataset.mobileView;
      const active = target === view || (target === "more" && !["dashboard", "courses", "notes", "focus"].includes(view));
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    const v = $("#view-" + view);
    if (v) {
      v.classList.add("active");
      if (view === "dashboard" && window.Anim) Anim.dashboardIntro(v);
      else window.Anim && Anim.viewEnter(v);
    }
    const titles = { dashboard: t("title.dashboard"), courses: t("title.courses"), notes: t("title.notes"), focus: t("title.focus"), growth: t("title.growth"), lit: t("title.lit"), news: t("title.news"), ai: t("title.ai"), weather: t("title.weather"), prisma: t("title.prisma"), nexus: t("title.nexus"), foldcraft: t("title.foldcraft"), securify: t("title.securify") };
    const subs = { dashboard: t("sub.dashboard"), courses: t("sub.courses"), notes: t("sub.notes"), focus: t("sub.focus"), growth: t("sub.growth"), lit: t("sub.lit"), news: t("sub.news"), ai: t("sub.ai"), weather: t("sub.weather"), prisma: t("sub.prisma"), nexus: t("sub.nexus"), foldcraft: t("sub.foldcraft"), securify: t("sub.securify") };
    $("#pageTitle").textContent = titles[view] || "";
    const sub = $("#pageSub");
    if (sub) sub.textContent = subs[view] || "";
    $("#view-container") && $("#view-container").scrollTo(0, 0);
    document.querySelector(".view-container").scrollTop = 0;
    // 清理旧视图的滚动 reveal（切走后不再保留 trigger）
    if (_revealCleanup) { _revealCleanup(); _revealCleanup = null; }
    renderCurrent();
    // 视图从 display:none 变为 block 后重算 ScrollTrigger 位置
    window.Anim && Anim.refreshScroll();
    // 侧边栏滑块跟随到目标项
    window.Anim && Anim.navPillTo(view, true);
  }

  function renderCurrent() {
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "courses") renderCourses();
    else if (currentView === "notes") renderNotes();
    else if (currentView === "focus") renderFocus();
    else if (currentView === "growth") renderGrowth();
    else if (currentView === "lit") renderLit();
    else if (currentView === "news") renderNews();
    else if (currentView === "weather") { if (window.Weather) Weather.renderCities(); }
    else if (currentView === "ai") renderAIStatus();
  }

  /* ---------- 长列表滚动分批浮入（ScrollTrigger） ---------- */
  let _revealCleanup = null;
  function revealCards(container, selector) {
    if (_revealCleanup) { _revealCleanup(); _revealCleanup = null; }
    if (window.Anim) _revealCleanup = Anim.scrollReveal(container, selector);
  }

  /* ============================================================
     弹窗管理（iOS Sheet 风格：进入/退出同路径，可打断）
     ============================================================ */
  let modalRestoreTarget = null;

  function openModals() {
    return Array.from(document.querySelectorAll(".modal-mask.show:not(.closing)"));
  }

  function syncModalState() {
    const hasOpen = openModals().length > 0;
    document.body.classList.toggle("modal-open", hasOpen);
  }

  function focusableIn(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hidden && el.getClientRects().length > 0);
  }

  function showModal(id) {
    const m = $("#" + id);
    if (!m) return;
    if (!openModals().length) modalRestoreTarget = document.activeElement;
    m.classList.remove("closing");
    m.classList.add("show");
    m.setAttribute("aria-hidden", "false");
    syncModalState();
    const sheet = m.querySelector(".modal");
    // GSAP 弹窗动画；无 GSAP 时回退 CSS
    if (window.Anim) Anim.sheetIn(m, sheet);
    else if (sheet) {
      sheet.classList.remove("sheet-in");
      void sheet.offsetWidth;
      sheet.classList.add("sheet-in");
    }
    requestAnimationFrame(() => {
      const focusables = focusableIn(sheet);
      const preferred = sheet && sheet.querySelector("input:not([type='hidden']), textarea, select, button");
      (preferred || focusables[0] || sheet || m).focus({ preventScroll: true });
    });
  }

  function closeModal(id) {
    const m = $("#" + id);
    if (!m || !m.classList.contains("show")) return;
    m.classList.add("closing");
    const sheet = m.querySelector(".modal");
    const finish = () => {
      if (!m.classList.contains("closing")) return;
      m.classList.remove("show", "closing");
      m.setAttribute("aria-hidden", "true");
      if (sheet) sheet.classList.remove("sheet-in");
      syncModalState();
      if (!openModals().length && modalRestoreTarget && typeof modalRestoreTarget.focus === "function") {
        modalRestoreTarget.focus({ preventScroll: true });
        modalRestoreTarget = null;
      }
    };
    if (window.Anim) {
      Anim.sheetOut(m, sheet, finish);
    } else {
      setTimeout(finish, 220);
    }
  }

  function setupModalAccessibility() {
    $$(".modal-mask").forEach((mask, index) => {
      mask.setAttribute("aria-hidden", mask.classList.contains("show") ? "false" : "true");
      const dialog = mask.querySelector(".modal");
      if (!dialog) return;
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("tabindex", "-1");
      const title = dialog.querySelector(".modal-head h3");
      if (title) {
        if (!title.id) title.id = `dialog-title-${index + 1}`;
        dialog.setAttribute("aria-labelledby", title.id);
      }
      const close = dialog.querySelector(".modal-close");
      if (close && !close.getAttribute("aria-label")) close.setAttribute("aria-label", "关闭弹窗");
    });
    const lock = $("#lockMask");
    const lockBox = lock && lock.querySelector(".lock-box");
    if (lock && lockBox) {
      lock.setAttribute("role", "dialog");
      lock.setAttribute("aria-modal", "true");
      lock.setAttribute("aria-labelledby", "lockTitle");
      const title = lock.querySelector(".lock-title");
      if (title) title.id = "lockTitle";
    }
  }

  /* ============================================================
     回收站（30 天）
     ============================================================ */
  const TRASH_LABELS = {
    courses: "课程", tasks: "任务", notes: "笔记", cards: "知识卡片",
    grades: "成绩", skills: "技能", projects: "项目", literature: "文献",
    exams: "考试", pomodoros: "专注记录"
  };

  function trashItemTitle(entry) {
    const item = entry && entry.item || {};
    return item.title || item.name || item.subject || item.question || "未命名内容";
  }

  function refreshAfterDataChange() {
    renderCurrent();
    renderProfile();
    renderDashboard();
    renderAIStatus();
    updateTrashCount();
  }

  function updateTrashCount() {
    const count = Store.getTrash ? Store.getTrash().length : 0;
    const el = $("#trashCount");
    if (el) el.textContent = String(count);
  }

  function undoTrashEntry(entry) {
    if (!entry || !Store.restoreTrash(entry.id)) return;
    refreshAfterDataChange();
    toast("内容已恢复", "ok");
  }

  function renderTrash() {
    const box = $("#trashList");
    if (!box) return;
    const items = Store.getTrash ? Store.getTrash() : [];
    updateTrashCount();
    if (!items.length) {
      box.innerHTML = `<div class="empty-state"><p>回收站是空的</p></div>`;
      return;
    }
    const icon = window.XingyuIcons ? XingyuIcons.svg("trash") : "";
    box.innerHTML = items.map(entry => `
      <div class="trash-item">
        ${icon}
        <div class="trash-item-main">
          <b>${esc(trashItemTitle(entry))}</b>
          <span>${esc(TRASH_LABELS[entry.entityKey] || entry.entityKey)} · ${fmtDate(entry.deletedAt)}</span>
        </div>
        <button class="btn btn-ghost" type="button" data-trash-restore="${esc(entry.id)}">恢复</button>
      </div>`).join("");
    box.querySelectorAll("[data-trash-restore]").forEach(button => {
      button.onclick = () => {
        const restored = Store.restoreTrash(button.dataset.trashRestore);
        if (restored) {
          renderTrash();
          refreshAfterDataChange();
          toast("内容已恢复", "ok");
        }
      };
    });
  }

  function openTrash() {
    renderTrash();
    showModal("trashModal");
  }

  function updateNetworkStatus() {
    const el = $("#networkStatus");
    if (!el) return;
    const offline = navigator.onLine === false;
    el.hidden = !offline;
    el.textContent = offline ? "离线模式" : "";
    document.documentElement.dataset.online = offline ? "false" : "true";
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {
    document.addEventListener("keydown", e => {
      if (isFocusModeOpen()) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeFocusMode({ pause: true });
          return;
        }
        if (e.code === "Space" && !["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          startPomo();
          return;
        }
        if (e.key === "Tab") {
          const focusables = focusableIn($("#focusMode"));
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (first && last && e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (first && last && !e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }
      const modals = openModals();
      const modal = modals[modals.length - 1];
      if (e.key === "Escape" && modal) {
        e.preventDefault();
        closeModal(modal.id);
        return;
      }
      if (e.key === "Tab" && modal) {
        const focusables = focusableIn(modal.querySelector(".modal"));
        if (!focusables.length) {
          e.preventDefault();
          modal.querySelector(".modal")?.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const search = $("#globalSearch");
        if (search && getComputedStyle(search).display !== "none") {
          search.focus();
          search.select();
        }
      }
    });
    // 导航
    $$(".nav-item").forEach(n => n.onclick = () => {
      if (window.Anim) Anim.navPulse(n);
      switchView(n.dataset.view);
    });
    $$(".mobile-tab").forEach(tab => tab.onclick = () => {
      const view = tab.dataset.mobileView;
      if (view === "more") {
        $("#sidebar").classList.add("open");
        $("#sidebarMask").classList.add("show");
        return;
      }
      switchView(view);
    });
    $$("[data-goto]").forEach(b => b.onclick = () => switchView(b.dataset.goto));
    $$("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close));
    $(".modal-mask") && $$(".modal-mask").forEach(m => m.onclick = (e) => { if (e.target === m) closeModal(m.id); });

    // 导入课表
    $$(".import-tab").forEach(t => t.onclick = () => {
      $$(".import-tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      $$(".import-panel").forEach(p => p.classList.remove("active"));
      $("#itab-" + t.dataset.itab).classList.add("active");
    });
    $("#dropZone").onclick = () => $("#scheduleImgFile").click();
    $("#dropZone").ondragover = (e) => { e.preventDefault(); $("#dropZone").classList.add("drag-over"); };
    $("#dropZone").ondragleave = () => $("#dropZone").classList.remove("drag-over");
    $("#dropZone").ondrop = (e) => {
      e.preventDefault();
      $("#dropZone").classList.remove("drag-over");
      if (e.dataTransfer.files.length) { $("#scheduleImgFile").files = e.dataTransfer.files; handleScheduleImg(); }
    };
    $("#scheduleImgFile").onchange = handleScheduleImg;
    $("#btnRecognizeImg").onclick = recognizeImg;
    $("#btnParseText").onclick = async () => {
      const text = $("#scheduleText").value.trim();
      if (!text) { toast("请先粘贴课表文本", "err"); return; }
      const btn = $("#btnParseText");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>解析中...`;
      try {
        const courses = await AI.parseScheduleText(text);
        showImportResult(courses);
        if (!courses.length) toast("未能解析出课程，请检查格式", "err");
      } catch (e) {
        toast(e.message || "解析失败", "err");
      } finally {
        btn.disabled = false;
        btn.textContent = "解析课表";
      }
    };
    $("#btnCancelImport").onclick = () => { pendingImportCourses = []; closeModal("importModal"); };
    $("#btnConfirmImport").onclick = confirmImport;

    // 菜单（移动端）
    $("#btnMenu").onclick = () => {
      $("#sidebar").classList.add("open");
      $("#sidebarMask").classList.add("show");
    };
    // 点遮罩关闭侧边栏
    $("#sidebarMask").onclick = () => {
      $("#sidebar").classList.remove("open");
      $("#sidebarMask").classList.remove("show");
    };
    // 点菜单项后自动收起侧边栏（移动端）
    $$(".nav-item").forEach(n => {
      n.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          $("#sidebar").classList.remove("open");
          $("#sidebarMask").classList.remove("show");
        }
      });
    });

    // 课程页
    $("#btnAddCourse").onclick = () => openCourseForm();
    $("#btnAddTask").onclick = () => openTaskForm();
    $("#btnImportSchedule").onclick = openImportModal;
    $("#btnAddExam").onclick = () => openExamForm();
    $("#btnSmartSort").onclick = () => {
      if (AI.isConfigured()) {
        // 已配置 AI：跳转聊天区执行智能排序
        toast("已跳转 AI 助手执行智能排序", "ok");
        switchView("ai");
        setTimeout(() => { $("#chatInput").value = "/智能排序"; sendChat("/智能排序"); }, 300);
      } else {
        // 本地规则：直接重排视图
        const tasks = Store.getAll("tasks");
        const scored = tasks.filter(t => t.status !== "done").map(t => {
          let s = 0;
          if (t.priority === "high") s += 100; else if (t.priority === "mid") s += 50;
          if (t.due) { const d = (new Date(t.due) - Date.now()) / 86400000; if (d < 1) s += 200; else if (d < 3) s += 120; else if (d < 7) s += 60; }
          return { t, s };
        }).sort((a, b) => b.s - a.s);
        toast("已按 DDL + 优先级智能排序（本地规则）", "ok");
        $("#taskList").innerHTML = "";
        scored.forEach((item, i) => {
          const t = item.t;
          const days = t.due ? daysUntil(t.due) : null;
          $("#taskList").innerHTML += `<div class="task-row">
            <span class="tag-chip" style="min-width:26px;justify-content:center">${i + 1}</span>
            <div class="course-info"><b>${esc(t.title)}</b><span>${Store.getCourseName(t.courseId) || "无课程"} · ${days === null ? "无期限" : days < 0 ? "已逾期" : `剩 ${days} 天`}</span></div>
            <span class="tag-chip pri-${t.priority}">${PRIORITY_MAP[t.priority]}</span>
          </div>`;
        });
      }
    };

    // 标签切换
    $$(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        $$(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        $$(".tab-panel").forEach(p => p.classList.remove("active"));
        $("#tab-" + tab) && $("#tab-" + tab).classList.add("active");
      };
    });

    // 笔记页
    $("#btnAddNote").onclick = () => openNote();
    $("#btnImportNotes").onclick = openNotesImportModal;
    $("#btnParseNotes").onclick = parseNotesBtn;
    $("#btnRecognizeNotes").onclick = recognizeNotesBtn;
    $("#dropZoneN").onclick = () => $("#notesImgFile").click();
    $("#dropZoneN").ondragover = (e) => { e.preventDefault(); $("#dropZoneN").classList.add("drag-over"); };
    $("#dropZoneN").ondragleave = () => $("#dropZoneN").classList.remove("drag-over");
    $("#dropZoneN").ondrop = (e) => {
      e.preventDefault();
      $("#dropZoneN").classList.remove("drag-over");
      if (e.dataTransfer.files.length) { $("#notesImgFile").files = e.dataTransfer.files; handleNotesImg(); }
    };
    $("#notesImgFile").onchange = handleNotesImg;
    $("#btnCancelNotesImport").onclick = () => { pendingImportNotes = []; closeModal("importNotesModal"); };
    $("#btnConfirmNotesImport").onclick = confirmNotesImport;
    $("#btnAiOrganize").onclick = () => {
      switchView("ai");
      setTimeout(() => {
        $("#chatInput").value = "/笔记整理";
        sendChat("/organize");
      }, 300);
    };
    $("#btnGenCards").onclick = () => {
      switchView("ai");
      setTimeout(() => {
        $("#chatInput").value = "/知识卡片";
        sendChat("/cards");
      }, 300);
    };

    // 专注
    $("#btnPomoStart").onclick = startPomo;
    $("#btnFocusModeToggle").onclick = startPomo;
    $("#btnFocusModeExit").onclick = () => closeFocusMode({ pause: true });
    $("#btnFocusModeEnd").onclick = endPomoSession;
    $("#btnPomoSkip").onclick = () => {
      if (pomoState.mode === "break") {
        pomoState.running = false;
        pomoState.endAt = 0;
        pomoState.mode = "work";
        pomoState.total = pomoDuration("work");
        pomoState.remain = pomoState.total;
        pomoState.startedAt = 0;
        pomoState.pausedAt = 0;
        pomoState.completed = false;
        clearInterval(pomoTimer);
        savePomoSession();
        updatePomoUI();
        toast("已跳过休息", "ok");
      } else if (pomoState.running || pomoState.startedAt) {
        pausePomo();
        pomoState.running = false;
        pomoState.endAt = 0;
        pomoState.mode = "break";
        pomoState.total = pomoDuration("break");
        pomoState.remain = pomoState.total;
        pomoState.startedAt = 0;
        pomoState.pausedAt = 0;
        pomoState.completed = false;
        savePomoSession();
        updatePomoUI();
        toast("已跳过当前阶段", "ok");
      }
    };
    $$(".pomo-presets [data-pomo-preset]").forEach(button => {
      button.onclick = () => {
        if (pomoState.running) return;
        const [work, rest] = button.dataset.pomoPreset.split("-").map(Number);
        $("#pomoWork").value = work;
        $("#pomoBreak").value = rest;
        savePomoPrefs();
        syncPomoPresetUI();
        if (!pomoState.startedAt) {
          pomoState.mode = "work";
          pomoState.total = work * 60;
          pomoState.remain = pomoState.total;
          updatePomoUI();
        }
      };
    });
    $("#pomoTask").onchange = () => {
      pomoState.taskId = $("#pomoTask").value;
      savePomoSession();
      updatePomoUI();
    };
    $("#pomoSound").onchange = savePomoPrefs;
    $("#pomoNotify").onchange = () => {
      savePomoPrefs();
      if ($("#pomoNotify").checked) ensureNotificationPermission();
    };
    $("#pomoWork").onchange = () => {
      savePomoPrefs();
      if (!pomoState.running && !pomoState.startedAt) {
        pomoState.total = pomoDuration("work");
        pomoState.remain = pomoState.total;
        updatePomoUI();
      }
    };
    $("#pomoBreak").onchange = () => {
      savePomoPrefs();
      if (!pomoState.running && pomoState.mode === "break") {
        pomoState.total = pomoDuration("break");
        pomoState.remain = pomoState.total;
        updatePomoUI();
      }
    };
    $("#btnPomoReset").onclick = () => {
      clearInterval(pomoTimer);
      pomoState = {
        running: false, mode: "work", remain: pomoDuration("work"), total: pomoDuration("work"),
        endAt: 0, startedAt: 0, pausedAt: 0, completed: false, taskId: ""
      };
      localStorage.removeItem(POMO_STORAGE_KEY);
      $("#pomoTask").value = "";
      pomoState.remain = pomoState.total;
      updatePomoUI();
      closeFocusMode({ pause: false });
      toast("番茄钟已重置", "ok");
    };

    // 成长档案
    $("#btnEditProfile").onclick = () => openProfileForm();
    $("#btnAddGrade").onclick = () => openGradeForm();
    $("#btnImportGrades").onclick = openGradesImportModal;
    $("#btnParseGrades").onclick = parseGradesBtn;
    $("#btnRecognizeGrades").onclick = recognizeGradesBtn;
    $("#dropZoneG").onclick = () => $("#gradesImgFile").click();
    $("#dropZoneG").ondragover = (e) => { e.preventDefault(); $("#dropZoneG").classList.add("drag-over"); };
    $("#dropZoneG").ondragleave = () => $("#dropZoneG").classList.remove("drag-over");
    $("#dropZoneG").ondrop = (e) => {
      e.preventDefault();
      $("#dropZoneG").classList.remove("drag-over");
      if (e.dataTransfer.files.length) { $("#gradesImgFile").files = e.dataTransfer.files; handleGradesImg(); }
    };
    $("#gradesImgFile").onchange = handleGradesImg;
    $("#btnCancelGradesImport").onclick = () => { pendingImportGrades = []; closeModal("importGradesModal"); };
    $("#btnConfirmGradesImport").onclick = confirmGradesImport;
    $("#btnAddSkill").onclick = () => openSkillForm();
    $("#btnAddProject").onclick = () => openProjectForm();
    $("#btnExportResume").onclick = () => {
      const content = $("#resumePreview").innerHTML;
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><title>简历预览</title>
          <style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px}@media print{body{margin:0}}</style>
          </head><body>${content}<script>window.print()<\/script></body></html>`);
        win.document.close();
      }
    };

    // AI
    $("#btnChatSend").onclick = () => sendChat($("#chatInput").value);
    $("#btnChatStop").onclick = () => AI.cancelCurrent && AI.cancelCurrent();
    $("#chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat($("#chatInput").value); });
    $$(".chip[data-cmd]").forEach(c => c.onclick = () => { $("#chatInput").value = c.dataset.cmd + " "; $("#chatInput").focus(); });

    // 设置
    $("#btnSettings").onclick = openSettings;
    $("#btnSaveSettings").onclick = saveSettings;
    $("#btnToggleAdvancedThemes").onclick = () => {
      const shown = document.body.classList.toggle("show-advanced-themes");
      $("#btnToggleAdvancedThemes").textContent = shown ? "收起更多主题" : "显示更多主题";
    };
    $$("[data-theme-pick]").forEach(b => b.onclick = () => applyTheme(b.dataset.themePick));
    $$("[data-font-pick]").forEach(b => b.onclick = () => applyFont(b.dataset.fontPick));
    $$("[data-lang-pick]").forEach(b => b.onclick = () => applyLang(b.dataset.langPick));
    $$("[data-bg-pick]").forEach(b => b.onclick = () => applyBg(b.dataset.bgPick));
    $$("#themeCustom input[type=color]").forEach(inp => {
      inp.oninput = () => {
        const colors = getCustomColors();
        colors[inp.dataset.cvar] = inp.value;
        localStorage.setItem("zero_custom_colors", JSON.stringify(colors));
        applyCustomColors(colors);
        if (inp.dataset.cvar === "accent") {
          const sw = $("#swCustom");
          if (sw) sw.style.background = inp.value;
        }
      };
    });
    $$("[data-preset]").forEach(p => p.onclick = () => {
      const preset = AI.PRESETS[p.dataset.preset];
      if (preset) { $("#setBaseUrl").value = preset.baseUrl; $("#setModel").value = preset.model; toast(`已填入 ${p.dataset.preset} 预设`, "ok"); }
    });
    $("#btnExportData").onclick = () => {
      const blob = new Blob([Store.exportAll()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "xingyu-data.json";
      a.click();
      toast("数据已导出", "ok");
    };
    $("#btnImportData").onclick = () => $("#importFile").click();
    $("#importFile").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast("导入文件不能超过 10MB", "err");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (Store.importAll(reader.result)) { toast("数据导入成功", "ok"); renderCurrent(); renderProfile(); }
        else toast("导入失败：JSON 格式不正确", "err");
      };
      reader.readAsText(file);
      e.target.value = "";
    };
    $("#btnClearData").onclick = () => {
      if (confirm("确定要清空全部数据吗？此操作不可恢复！")) {
        Store.clearAll();
        toast("已清空全部数据", "ok");
        renderCurrent(); renderProfile();
      }
    };
    $("#btnOpenTrash").onclick = openTrash;
    $("#btnEmptyTrash").onclick = () => {
      if (!Store.getTrash().length) return;
      if (confirm("确定永久清空回收站吗？此操作无法撤销。")) {
        Store.emptyTrash();
        renderTrash();
        updateTrashCount();
        toast("回收站已清空", "ok");
      }
    };
    $("#btnFinishOnboarding").onclick = finishOnboarding;
    $("#btnSkipOnboarding").onclick = () => {
      localStorage.setItem("zero_onboarded_v3", "1");
      closeModal("onboardingModal");
    };

    // 云同步
    if ($("#syncEnabled")) {
      $("#syncEnabled").onchange = () => {
        const on = $("#syncEnabled").checked;
        Sync.setEnabled(on);
        updateSyncStatus();
        if (on) Sync.sync().then(updateSyncStatus);
      };
    }
    $("#btnSyncNow").onclick = () => {
      const token = $("#setSyncToken").value.trim();
      Sync.setToken(token);
      Sync.setEnabled(true);
      $("#syncEnabled").checked = true;
      updateSyncStatus();
      Sync.sync().then(updateSyncStatus);
    };
    Sync.listeners.push(() => updateSyncStatus());
    // 学习提醒（桌面通知）
    if ($("#remindEnabled")) {
      $("#remindEnabled").onchange = async () => {
        const on = $("#remindEnabled").checked;
        if (window.Reminders) Reminders.setEnabled(on);
        if (on && window.Reminders) {
          const perm = await Reminders.requestPermission();
          if (perm === "granted") {
            toast("通知已开启，考试 / 任务 / 复习提醒将在此浏览器生效", "ok");
            Reminders.check();
          } else if (perm === "denied") {
            toast("浏览器已阻止通知，请在浏览器地址栏允许通知后重试", "err");
          }
        }
        if (typeof updateRemindStatus === "function") updateRemindStatus();
      };
    }
    // 二维码
    $("#btnQrcode").onclick = openQR;
    $("#btnCopyLink").onclick = copyLink;

    // 每日一言
    $("#btnNextQuote").onclick = () => { if (window.nextQuote) { nextQuote(); renderQuote(); } };

    // 访问密码
    $("#btnUnlock").onclick = unlock;
    $("#lockPin").addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });
    // 总开关：切换密码字段显隐
    const lockEn = $("#lockEnabled");
    if (lockEn) lockEn.addEventListener("change", () => toggleLockFields(lockEn.checked));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && pomoState.running) {
        tickPomo();
        updatePomoUI();
      }
      if (document.hidden && localStorage.getItem("zero_lock_enabled") === "1" && hasPin() && localStorage.getItem("zero_lock_leave") === "1") {
        lockNow();
      }
    });
    window.addEventListener("pagehide", savePomoSession);

    // 热点新闻
    $("#btnRefreshNews").onclick = async () => {
      toast("正在刷新新闻...", "ok", { key: "news-refreshing", duration: 1500 });
      newsCache = null;
      await renderNews();
      toast("新闻已更新", "ok", { key: "news-refreshed", duration: 2000 });
    };
    $$("[data-newstab]").forEach(btn => {
      btn.onclick = () => {
        $$("[data-newstab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        newsFilter = btn.dataset.newstab;
        renderNews();
      };
    });

    // 文献资料
    $("#btnAddLit").onclick = () => openLitForm();
    $("#btnImportLit").onclick = openLitImportModal;
    $("#litSearch").addEventListener("input", renderLitList);
    $("#litFilterTag").onchange = renderLitList;
    $("#litFilterFav").onchange = renderLitList;

    // 自动备份
    window.Backup && Backup.bind();

    // 全局搜索
    setupSearch();

    // 时钟
    tickClock();
    setInterval(tickClock, 10000);
  }

  /* ---------- 启动 ---------- */
  function init() {
    window.XingyuIcons && XingyuIcons.decorateNavigation();
    setupModalAccessibility();
    Store.onRestore && Store.onRestore(() => {
      // IndexedDB 恢复完成：重渲染当前视图 + 相关 UI
      try { renderCurrent(); renderProfile(); updateTrashCount(); } catch (e) {}
      toast("已从本地备份恢复数据", "ok");
    });
    Store.onDelete && Store.onDelete(entry => {
      updateTrashCount();
      toast(`${TRASH_LABELS[entry.entityKey] || "内容"}已移至回收站`, "ok", {
        actionLabel: "撤销",
        onAction: () => undoTrashEntry(entry),
        duration: 5600
      });
    });
    bindEvents();
    restorePomoOnStartup();
    window.Sync && Sync.init();
    window.Backup && Backup.init();
    window.Reminders && Reminders.init();
    applyI18n();
    // Apple 风格即时按压反馈（不使用 Material 涟漪）
    window.Anim && Anim.initRipple();
    // nav 事件绑定与滑块初始化（轻量、立即执行）
    window.Anim && Anim.initNav();
    window.Anim && Anim.initNavPill();
    window.Anim && Anim.initSidebarGesture($("#sidebar"), $("#sidebarMask"));
    // 天气模块（实时天气，懒加载数据）
    window.Weather && Weather.init();
    updateNetworkStatus();
    window.addEventListener("online", () => { updateNetworkStatus(); toast("网络已恢复", "ok"); });
    window.addEventListener("offline", () => { updateNetworkStatus(); toast("当前离线，将继续使用本地数据", "err"); });
    const storageInfo = Store.getStorageInfo && Store.getStorageInfo();
    if (storageInfo && storageInfo.lastError) toast(storageInfo.lastError, "err");
    updateTrashCount();
    const systemMedia = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
    if (systemMedia) systemMedia.addEventListener("change", () => {
      if ((localStorage.getItem("zero_theme") || "system") === "system") applyTheme("system");
    });
    // 启动锁（设置了访问密码则锁定）
    applyLockPrefs();
    // 应用保存的昵称（仅当尚未设置个人昵称时）
    const nick = Store.getSettings().nickname;
    const p = Store.getProfile();
    if (nick && (!p.name || p.name === "同学")) Store.setProfile({ name: nick });
    // 迁移：清除旧默认火箭头像（新版默认无 emoji 头像，用昵称首字）
    if (p.avatar === "🚀") { Store.setProfile({ ...p, avatar: "" }); }
    renderProfile();
    renderDashboard();
    // 让 AI 页面初始化状态
    renderAIStatus();
    // 默认展示仪表盘
    switchView("dashboard");
    maybeShowOnboarding();
    // 开屏（intro）结束后再播放入场动画，避免与视频并行导致卡顿
    var runEntrance = function () {
      window.Anim && Anim.sidebarIntro();
      if (window.Anim) Anim.dashboardIntro($("#view-dashboard"));
    };
    if (window.__splashActive) {
      window.addEventListener("splash-done", runEntrance, { once: true });
      setTimeout(runEntrance, 12500);
    } else {
      runEntrance();
    }
    console.log("星屿 · 个人学习工作台已启动");
  }

document.addEventListener("DOMContentLoaded", init);
