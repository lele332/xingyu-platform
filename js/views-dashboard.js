/* ============================================================
   views-dashboard.js — 仪表盘视图
   renderQuote / renderHeroNews / getNextCourse / renderHeroPriority
   renderDashboard / renderFocusTrend
   依赖：app-core.js 的全局工具函数与 switchView/toast/revealCards
   ============================================================ */

  /* ============================================================
     每日一言（励志 / 热梗 / 毒鸡汤）
     ============================================================ */
  function renderQuote() {
    const box = $("#dailyQuote");
    const textEl = $("#quoteText");
    const catEl = $("#quoteCat");
    if (!box || !textEl) return;
    const q = window.getDailyQuote ? getDailyQuote() : null;
    if (!q) { box.style.display = "none"; return; }
    box.style.display = "";
    textEl.textContent = q.text;
    if (catEl) catEl.textContent = t("quote.cat." + q.cat);
    // 换句淡入
    if (window.Anim) { Anim.quoteIn(textEl); if (catEl) Anim.quoteIn(catEl); }
  }

  /* ============================================================
     今日热点（hero 卡片内入口，取自每日新闻数据）
     ============================================================ */
  async function renderHeroNews() {
    const box = $("#heroNews");
    if (!box) return;
    const data = await loadNews(false);
    if (!data || !data.news || !data.news.length) { box.style.display = "none"; return; }
    const items = data.news.slice(0, 3);
    box.style.display = "";
    box.innerHTML = `
      <div class="hero-news-head">
        <span class="hero-news-label">${t("hero.news")}</span>
        <span class="hero-news-actions">
          <button class="text-btn refresh-control" id="btnHeroNewsRefresh"><span class="refresh-glyph" aria-hidden="true">↻</span><span class="refresh-label">${t("hero.refresh")}</span></button>
          <button class="text-btn" data-goto="news">${t("hero.newsAll")} →</button>
        </span>
      </div>
      <div class="hero-news-list">
        ${items.map((n, i) => `
          <a class="hero-news-item" href="${esc(n.link)}" target="_blank" rel="noopener" title="${esc(n.title)}">
            <span class="hero-news-rank">${i + 1}</span>
            <span class="hero-news-text">${esc(n.title)}</span>
            <span class="hero-news-src">${esc(n.source || "")}</span>
          </a>`).join("")}
      </div>`;
    const go = box.querySelector("[data-goto='news']");
    if (go) go.onclick = () => switchView("news");
    // 刷新：重新拉取新闻数据并更新热点与新闻页
    const refreshBtn = box.querySelector("#btnHeroNewsRefresh");
    if (refreshBtn) refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      refreshBtn.classList.add("is-refreshing");
      refreshBtn.setAttribute("aria-busy", "true");
      const label = refreshBtn.querySelector(".refresh-label");
      if (label) label.textContent = "更新中";
      try {
        await loadNews(true);
        if (currentView === "news") renderNews();
        refreshBtn.classList.remove("is-refreshing");
        refreshBtn.classList.add("is-complete");
        if (label) label.textContent = t("hero.refreshed");
        toast(t("hero.refreshed"), "ok", { key: "hero-news-refreshed", duration: 2000 });
        setTimeout(() => renderHeroNews(), 560);
      } catch (error) {
        refreshBtn.classList.remove("is-refreshing");
        if (label) label.textContent = t("hero.refresh");
        refreshBtn.disabled = false;
        refreshBtn.removeAttribute("aria-busy");
        toast("刷新失败，请稍后重试", "err", { key: "hero-news-refresh-error" });
      }
    };
  }

  function getNextCourse(courses) {
    const now = new Date();
    const today = now.getDay() || 7;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return courses.map(course => {
      const start = String(course.start || "00:00").split(":").map(Number);
      const end = String(course.end || course.start || "00:00").split(":").map(Number);
      const startMin = (start[0] || 0) * 60 + (start[1] || 0);
      const endMin = (end[0] || 0) * 60 + (end[1] || 0);
      let daysAhead = ((Number(course.day) || 1) - today + 7) % 7;
      let ongoing = false;
      if (daysAhead === 0 && currentMin > startMin) {
        if (currentMin <= endMin) ongoing = true;
        else daysAhead = 7;
      }
      return { course, ongoing, distance: daysAhead * 1440 + Math.max(0, startMin - currentMin) };
    }).sort((a, b) => (a.ongoing ? -1 : b.ongoing ? 1 : a.distance - b.distance))[0] || null;
  }

  function renderHeroPriority() {
    const box = $("#heroPriority");
    if (!box) return;
    const tasks = Store.getAll("tasks").filter(task => task.status !== "done").slice().sort((a, b) => {
      const dueA = a.due ? new Date(a.due).getTime() : Infinity;
      const dueB = b.due ? new Date(b.due).getTime() : Infinity;
      const weight = { high: 0, mid: 1, low: 2 };
      return dueA - dueB || (weight[a.priority] ?? 3) - (weight[b.priority] ?? 3);
    });
    const task = tasks[0];
    const next = getNextCourse(Store.getAll("courses"));
    const icon = name => window.XingyuIcons ? XingyuIcons.svg(name) : "";
    const taskMeta = task ? (task.due ? `${Math.max(0, daysUntil(task.due))} 天后到期` : "无截止日期") : "当前没有待办";
    const courseMeta = next ? (next.ongoing ? "正在进行" : next.distance < 1440 ? "今天" : `${Math.floor(next.distance / 1440)} 天后`) : "暂无课程";
    box.innerHTML = `
      <button class="priority-item" type="button" data-priority-act="task" ${task ? "" : "disabled"}>
        ${icon("courses")}<span class="priority-copy"><small>首要任务 · ${esc(taskMeta)}</small><b>${esc(task ? task.title : "添加第一项任务")}</b></span>
      </button>
      <button class="priority-item" type="button" data-priority-act="course" ${next ? "" : "disabled"}>
        ${icon("dashboard")}<span class="priority-copy"><small>下一课程 · ${esc(courseMeta)}</small><b>${esc(next ? `${next.course.name} ${next.course.start || ""}` : "导入课程表")}</b></span>
      </button>
      <button class="priority-item" type="button" data-priority-act="focus">
        ${icon("focus")}<span class="priority-copy"><small>现在开始</small><b>${esc(Store.getProfile().goal || "专注 25 分钟")}</b></span>
      </button>`;
    const taskBtn = box.querySelector('[data-priority-act="task"]');
    if (taskBtn && task) taskBtn.onclick = () => openTaskForm(task.id);
    const courseBtn = box.querySelector('[data-priority-act="course"]');
    if (courseBtn && next) courseBtn.onclick = () => switchView("courses");
    box.querySelector('[data-priority-act="focus"]').onclick = () => switchView("focus");
  }

  function renderDashboard() {
    renderQuote();
    renderHeroNews();
    renderHeroPriority();
    // 问候语（按时段细化，附一句温暖副语）
    const name = Store.getProfile().name || "同学";
    const h = new Date().getHours();
    let greet = "晚上好", sub = "今天也要保持专注，稳步向前。";
    if (h < 6) { greet = "夜深了"; sub = "早点休息，身体是革命的本钱。"; }
    else if (h < 9) { greet = "早上好"; sub = "新的一天，从一个计划开始。"; }
    else if (h < 12) { greet = "上午好"; sub = "上午的专注时间最宝贵，冲！"; }
    else if (h < 14) { greet = "中午好"; sub = "吃饱了才有力气学习，午休片刻。"; }
    else if (h < 18) { greet = "下午好"; sub = "犯困就走两步，回来继续。"; }
    $("#heroGreeting").textContent = `${greet}，${name}`;
    const profileSlogan = Store.getProfile().slogan;
    $("#heroQuote").textContent = profileSlogan ? `"${profileSlogan}"` : sub;
    // 日期 + 星期（跟随界面语言）
    const lang = document.documentElement.dataset.lang || "zh";
    const locale = lang === "en" ? "en-US" : lang === "zh-Hant" ? "zh-TW" : "zh-CN";
    const heroDate = $("#heroDate");
    if (heroDate) heroDate.textContent = new Date().toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "long" });

    // 统计卡
    const tasks = Store.getAll("tasks");
    const todos = tasks.filter(t => t.status !== "done");
    const dueToday = todos.filter(t => daysUntil(t.due) === 0);
    const notes = Store.getAll("notes");
    const pomos = Store.getAll("pomodoros").filter(p => p.startAt && localDateKey(p.startAt) === todayISO());
    const pomoMin = pomos.reduce((s, p) => s + (p.minutes || 0), 0);
    $("#heroStats").innerHTML = `
      <div class="hstat"><b data-count="${todos.length}">0</b><span>${t("hero.todo")}</span></div>
      <div class="hstat"><b data-count="${dueToday.length}">0</b><span>${t("hero.due")}</span></div>
      <div class="hstat"><b data-count="${notes.length}">0</b><span>${t("hero.notes")}</span></div>
      <div class="hstat"><b data-count="${pomoMin}">0</b><span>${t("hero.focusMin")}</span></div>`;
    // 数字滚动动画（GSAP 缓动；无 GSAP 时直接显示目标值）
    $$("#heroStats [data-count]").forEach(el => {
      window.Anim && Anim.countUp(el, +el.dataset.count);
    });

    // 倒计时
    const todoWithDue = todos.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
    const cdBox = $("#countdownList");
    if (!todoWithDue.length) {
      cdBox.innerHTML = `<div class="empty-state"><p>暂无进行中的倒计时，去添加任务吧</p></div>`;
    } else {
      cdBox.innerHTML = todoWithDue.map(t => {
        const days = daysUntil(t.due);
        const urgent = days !== null && days <= 3;
        return `<div class="cd-item ${urgent ? "urgent" : ""}">
          <div class="cd-num"><b>${days === null ? "—" : Math.max(days, 0)}</b><span>${days === null ? "" : "天"}</span></div>
          <div class="cd-info"><b>${esc(t.title)}</b><span>${fmtDate(t.due)} · ${PRIORITY_MAP[t.priority]}优先级</span></div>
          ${urgent ? '<span class="tag-chip pri-high" style="margin-left:auto">紧急</span>' : ""}
        </div>`;
      }).join("");
    }

    // 考试倒计时（聚合同屏）
    const examBox = $("#examCountdownList");
    if (examBox) {
      const exams = Store.getAll("exams").filter(e => e.date).sort((a, b) => new Date(a.date) - new Date(b.date));
      const upcoming = exams.filter(e => daysUntil(e.date) >= 0).slice(0, 5);
      if (!upcoming.length) {
        examBox.innerHTML = `<div class="empty-state"><p>暂无临近考试，去添加考试安排吧</p></div>`;
      } else {
        examBox.innerHTML = upcoming.map(ex => {
          const days = daysUntil(ex.date);
          const urgent = days !== null && days <= 7;
          return `<div class="cd-item ${urgent ? "urgent" : ""}">
            <div class="cd-num"><b>${days === null ? "—" : days}</b><span>${days === null ? "" : "天"}</span></div>
            <div class="cd-info"><b>${esc(ex.name || ex.subject)}</b><span>${fmtDate(ex.date)}${ex.subject ? " · " + esc(ex.subject) : ""}</span></div>
            ${urgent ? '<span class="tag-chip pri-high" style="margin-left:auto">临近</span>' : ""}
          </div>`;
        }).join("");
      }
    }

    // 任务完成统计（环形图）
    const done = tasks.filter(t => t.status === "done").length;
    const total = tasks.length;
    Charts.donut($("#taskStatsChart"), {
      segments: [
        { value: done, color: "var(--ink-2)" },
        { value: total - done, color: "var(--fill-2)" }
      ],
      size: 170, thickness: 22,
      centerLabel: total ? Math.round(done / total * 100) + "%" : "0%",
      centerSub: "完成率"
    });
    $("#taskStatsLegend").innerHTML = `
      <span><span class="legend-dot" style="background:var(--ink-2)"></span>已完成 ${done}</span>
      <span><span class="legend-dot" style="background:var(--fill-3)"></span>未完成 ${total - done}</span>`;

    // 专注趋势
    renderFocusTrend($("#focusTrendChart"), 7);

    // 今日待办
    const todayTasks = todos.filter(t => daysUntil(t.due) === 0).slice(0, 6);
    const ttBox = $("#todayTasks");
    if (!todayTasks.length) {
      ttBox.innerHTML = `<div class="empty-state"><p>今天没有到期任务，轻松的一天</p></div>`;
    } else {
      ttBox.innerHTML = todayTasks.map(t => `
        <div class="todo-item">
          <span class="todo-dot" style="background:${t.priority === "high" ? "var(--ink)" : t.priority === "mid" ? "var(--ink-2)" : "var(--ink-3)"}"></span>
          <span class="todo-pri-${t.priority}">${esc(t.title)}</span>
          <span class="todo-date">${fmtDate(t.due)}</span>
        </div>`).join("");
    }

    // 最近笔记
    const recentNotes = notes.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5);
    const rnBox = $("#recentNotes");
    if (!recentNotes.length) {
      rnBox.innerHTML = `<div class="empty-state"><p>还没有笔记，去记录第一条吧</p></div>`;
    } else {
      rnBox.innerHTML = recentNotes.map(n => `
        <div class="note-mini" data-note-id="${n.id}" style="cursor:pointer">
          <span style="color:var(--accent)">◉</span>
          <span>${esc(n.title)}</span>
          <span class="tag-chip">${esc(n.subject || "未分类")}</span>
        </div>`).join("");
      $$("#recentNotes .note-mini").forEach(el => {
        el.onclick = () => { switchView("notes"); setTimeout(() => openNote(el.dataset.noteId), 50); };
      });
    }
  }

  function renderFocusTrend(container, days = 7) {
    const pomos = Store.getAll("pomodoros");
    const labels = [], values = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const mins = pomos.filter(p => p.startAt && localDateKey(p.startAt) === key).reduce((s, p) => s + (p.minutes || 0), 0);
      labels.push(d.getDate() + "日");
      values.push(mins);
    }
    if (values.every(v => v === 0)) {
      container.innerHTML = `<div class="empty-state"><div class="big">⏱</div><p>最近没有专注记录，去「专注学习」开启第一个番茄钟吧</p></div>`;
    } else {
      Charts.bars(container, { labels, values, height: 200, unit: "分", color: "var(--ink)" });
    }
  }
