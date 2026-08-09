/* ============================================================
   app.js — 主应用逻辑
   ============================================================ */
const App = (() => {

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
  function todayISO() {
    return fmtDateFull(new Date().toISOString());
  }
  function toast(msg, type = "") {
    let wrap = $("#toastWrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "toastWrap"; document.body.appendChild(wrap); }
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(() => el.remove(), 350); }, 2600);
  }

  /* ---------- 视图切换 ---------- */
  let currentView = "dashboard";
  function switchView(view) {
    currentView = view;
    $$(".view").forEach(v => v.classList.remove("active"));
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
    const v = $("#view-" + view);
    if (v) v.classList.add("active");
    const titles = { dashboard: "仪表盘", courses: "课程作业", notes: "学习笔记库", focus: "专注学习", growth: "成长档案", lit: "文献资料", news: "热点新闻", ai: "AI 助手" };
    $("#pageTitle").textContent = titles[view] || "";
    $("#view-container") && $("#view-container").scrollTo(0, 0);
    document.querySelector(".view-container").scrollTop = 0;
    renderCurrent();
  }

  function renderCurrent() {
    if (currentView === "dashboard") renderDashboard();
    else if (currentView === "courses") renderCourses();
    else if (currentView === "notes") renderNotes();
    else if (currentView === "focus") renderFocus();
    else if (currentView === "growth") renderGrowth();
    else if (currentView === "lit") renderLit();
    else if (currentView === "news") renderNews();
    else if (currentView === "ai") renderAIStatus();
  }

  /* ============================================================
     仪表盘
     ============================================================ */
  function renderDashboard() {
    // 问候语
    const name = Store.getProfile().name || "同学";
    const h = new Date().getHours();
    let greet = "晚上好";
    if (h < 6) greet = "夜深了";
    else if (h < 12) greet = "早上好";
    else if (h < 18) greet = "下午好";
    $("#heroGreeting").textContent = `${greet}，${name} 👋`;
    const quotes = ["今天也要保持专注，稳步向前。", "自律给我自由，坚持就有回响。", "把大目标拆成小任务，每天前进一点点。", "读书是最好的自我投资。", "不积跬步，无以至千里。"];
    // 用户设置了个性签名就优先显示，否则用轮换语录
    const profileSlogan = Store.getProfile().slogan;
    $("#heroQuote").textContent = profileSlogan ? `"${profileSlogan}"` : quotes[new Date().getDate() % quotes.length];

    // 统计卡
    const tasks = Store.getAll("tasks");
    const todos = tasks.filter(t => t.status !== "done");
    const dueToday = todos.filter(t => daysUntil(t.due) === 0);
    const notes = Store.getAll("notes");
    const pomos = Store.getAll("pomodoros").filter(p => p.startAt && p.startAt.slice(0, 10) === todayISO());
    const pomoMin = pomos.reduce((s, p) => s + (p.minutes || 0), 0);
    $("#heroStats").innerHTML = `
      <div class="hstat"><b>${todos.length}</b><span>待办任务</span></div>
      <div class="hstat"><b>${dueToday.length}</b><span>今日到期</span></div>
      <div class="hstat"><b>${notes.length}</b><span>笔记</span></div>
      <div class="hstat"><b>${pomoMin}</b><span>今日专注(分)</span></div>`;

    // 倒计时
    const todoWithDue = todos.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
    const cdBox = $("#countdownList");
    if (!todoWithDue.length) {
      cdBox.innerHTML = `<div class="empty-state"><div class="big">🎉</div><p>暂无进行中的倒计时，去添加任务吧</p></div>`;
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

    // 任务完成统计（环形图）
    const done = tasks.filter(t => t.status === "done").length;
    const total = tasks.length;
    Charts.donut($("#taskStatsChart"), {
      segments: [
        { value: done, color: "#30d158" },
        { value: total - done, color: "rgba(120,120,128,0.22)" }
      ],
      size: 170, thickness: 22,
      centerLabel: total ? Math.round(done / total * 100) + "%" : "0%",
      centerSub: "完成率"
    });
    $("#taskStatsLegend").innerHTML = `
      <span><span class="legend-dot" style="background:#30d158"></span>已完成 ${done}</span>
      <span><span class="legend-dot" style="background:rgba(120,120,128,0.3)"></span>未完成 ${total - done}</span>`;

    // 专注趋势
    renderFocusTrend($("#focusTrendChart"), 7);

    // 今日待办
    const todayTasks = todos.filter(t => daysUntil(t.due) === 0).slice(0, 6);
    const ttBox = $("#todayTasks");
    if (!todayTasks.length) {
      ttBox.innerHTML = `<div class="empty-state"><div class="big">🌤</div><p>今天没有到期任务，轻松的一天</p></div>`;
    } else {
      ttBox.innerHTML = todayTasks.map(t => `
        <div class="todo-item">
          <span class="todo-dot" style="background:${t.priority === "high" ? "#ff453a" : t.priority === "mid" ? "#ff9f0a" : "#64d2ff"}"></span>
          <span class="todo-pri-${t.priority}">${esc(t.title)}</span>
          <span class="todo-date">${fmtDate(t.due)}</span>
        </div>`).join("");
    }

    // 最近笔记
    const recentNotes = notes.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5);
    const rnBox = $("#recentNotes");
    if (!recentNotes.length) {
      rnBox.innerHTML = `<div class="empty-state"><div class="big">📝</div><p>还没有笔记，去记录第一条吧</p></div>`;
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
      const mins = pomos.filter(p => p.startAt && p.startAt.slice(0, 10) === key).reduce((s, p) => s + (p.minutes || 0), 0);
      labels.push(d.getDate() + "日");
      values.push(mins);
    }
    if (values.every(v => v === 0)) {
      container.innerHTML = `<div class="empty-state"><div class="big">⏱</div><p>最近没有专注记录，去「专注学习」开启第一个番茄钟吧</p></div>`;
    } else {
      Charts.bars(container, { labels, values, height: 200, unit: "分", color: "#bf5af2" });
    }
  }

  /* ============================================================
     课程作业
     ============================================================ */
  function renderCourses() {
    renderWeekGrid();
    renderCourseList();
    renderTaskList();
  }

  function renderWeekGrid() {
    const courses = Store.getAll("courses");
    const todayIdx = (new Date().getDay() + 6) % 7; // 周一=0
    const weekDays = WEEKDAYS.slice(1).concat([WEEKDAYS[0]]); // 周一到周日
    const dayNum = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const grid = $("#weekGrid");
    let html = "";
    for (let d = 0; d < 7; d++) {
      const dayCourses = courses.filter(c => c.day === d + 1).sort((a, b) => a.start.localeCompare(b.start));
      html += `<div class="week-day ${d === dayNum ? "today" : ""}">
        <h4>${weekDays[d]} ${d === dayNum ? '<span class="today-badge">今天</span>' : ""}</h4>
        ${dayCourses.length ? dayCourses.map(c => `
          <div class="day-course" style="border-left:3px solid ${c.color}">
            <b>${esc(c.name)}</b>
            <span>${c.start}-${c.end} · ${esc(c.location || "未填地点")}</span>
          </div>`).join("") : `<div class="empty-hint">暂无课程</div>`}
      </div>`;
    }
    grid.innerHTML = html;
    $("#weekLabel").textContent = "本周课程表（周一至周日）";
  }

  function renderCourseList() {
    const courses = Store.getAll("courses");
    const box = $("#courseList");
    if (!courses.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">📚</div><p>还没有课程，点击右上角「+ 添加课程」</p></div>`;
      return;
    }
    box.innerHTML = courses.map(c => `
      <div class="course-row">
        <div class="course-color" style="background:${c.color}"></div>
        <div class="course-info">
          <b>${esc(c.name)}</b>
          <span>${esc(c.teacher || "待定")} · ${WEEKDAYS[c.day]} ${c.start}-${c.end} · ${esc(c.location || "未填地点")}</span>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-course" data-id="${c.id}" title="编辑">✎</button>
          <button class="mini-btn del" data-act="del-course" data-id="${c.id}" title="删除">✕</button>
        </div>
      </div>`).join("");
    bindRowActions();
  }

  function renderTaskList() {
    const tasks = Store.getAll("tasks");
    const fs = $("#taskFilterStatus").value;
    const fp = $("#taskFilterPriority").value;
    const filtered = tasks.filter(t => (fs === "all" || t.status === fs) && (fp === "all" || t.priority === fp));
    const sorted = filtered.slice().sort((a, b) => {
      const st = { todo: 0, doing: 1, done: 2 };
      if (st[a.status] !== st[b.status]) return st[a.status] - st[b.status];
      return (a.due || "9999").localeCompare(b.due || "9999");
    });
    const box = $("#taskList");
    if (!sorted.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">📋</div><p>没有符合条件的任务</p></div>`;
      return;
    }
    box.innerHTML = sorted.map(t => {
      const days = t.due ? daysUntil(t.due) : null;
      const overdue = days !== null && days < 0 && t.status !== "done";
      const dueTxt = t.due ? (overdue ? `已逾期 ${-days} 天` : days === 0 ? "今天到期" : `剩 ${days} 天`) : "无期限";
      return `<div class="task-row ${t.status === "done" ? "task-done" : ""}">
        <button class="mini-btn check" data-act="toggle-task" data-id="${t.id}" title="切换状态">${t.status === "done" ? "↩" : "✓"}</button>
        <div class="course-info">
          <b style="${t.status === "done" ? "text-decoration:line-through;color:var(--text-faint)" : ""}">${esc(t.title)}</b>
          <span>${Store.getCourseName(t.courseId) || "无课程"} · ${dueTxt} · 约${t.estimate || 60}分钟</span>
        </div>
        <span class="tag-chip pri-${t.priority}">${PRIORITY_MAP[t.priority]}</span>
        <span class="tag-chip st-${t.status}">${STATUS_MAP[t.status]}</span>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-task" data-id="${t.id}" title="编辑">✎</button>
          <button class="mini-btn del" data-act="del-task" data-id="${t.id}" title="删除">✕</button>
        </div>
      </div>`;
    }).join("");
    bindRowActions();
  }

  function bindRowActions() {
    $$("[data-act]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const act = btn.dataset.act, id = btn.dataset.id;
        if (act === "del-course") { Store.remove("courses", id); toast("课程已删除", "ok"); renderCourses(); renderDashboard(); }
        else if (act === "del-task") { Store.remove("tasks", id); toast("任务已删除", "ok"); renderCourses(); }
        else if (act === "edit-course") { openCourseForm(id); }
        else if (act === "edit-task") { openTaskForm(id); }
        else if (act === "toggle-task") {
          const t = Store.getAll("tasks").find(x => x.id === id);
          if (t) { Store.update("tasks", id, { status: t.status === "done" ? "todo" : "done" }); renderCourses(); }
        }
      };
    });
  }

  /* ---------- 课程表单 ---------- */
  function openCourseForm(id) {
    const c = id ? Store.getAll("courses").find(x => x.id === id) : null;
    const colors = ["#0a84ff", "#5e5ce6", "#bf5af2", "#64d2ff", "#30d158", "#ffd60a", "#ff453a", "#ff375f"];
    const colorOptions = colors.map(cl => `<span class="color-dot" data-c="${cl}" style="background:${cl}"></span>`).join("");
    $("#formTitle").textContent = id ? "编辑课程" : "添加课程";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field"><span>课程名称 *</span><input id="f-c-name" value="${esc(c?.name || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>授课老师</span><input id="f-c-teacher" value="${esc(c?.teacher || "")}" placeholder="如：李老师"></label>
        <label class="field"><span>上课日 *</span><select id="f-c-day">
          ${[1,2,3,4,5,6,7].map(d => `<option value="${d}" ${c?.day === d ? "selected" : ""}>${WEEKDAYS[d]}</option>`).join("")}
        </select></label>
        <label class="field"><span>时间段 *</span><div style="display:flex;gap:8px;align-items:center">
          <input type="time" id="f-c-start" value="${c?.start || "08:00"}">
          <span style="color:var(--text-faint)">至</span>
          <input type="time" id="f-c-end" value="${c?.end || "09:40"}">
        </div></label>
        <label class="field"><span>地点</span><input id="f-c-loc" value="${esc(c?.location || "")}" placeholder="如：教学楼A-301"></label>
        <label class="field"><span>颜色</span><div class="color-picker" id="f-c-colors">${colorOptions}</div></label>
      </div>`;
    let picked = c?.color || "#0a84ff";
    $$("#f-c-colors .color-dot").forEach(d => {
      if (d.dataset.c === picked) d.classList.add("picked");
      d.onclick = () => {
        $$("#f-c-colors .color-dot").forEach(x => x.classList.remove("picked"));
        d.classList.add("picked");
        picked = d.dataset.c;
      };
    });
    $("#btnFormSave").onclick = () => {
      const name = $("#f-c-name").value.trim();
      if (!name) { toast("请填写课程名称", "err"); return; }
      const payload = { name, teacher: $("#f-c-teacher").value.trim(), day: +$("#f-c-day").value, start: $("#f-c-start").value, end: $("#f-c-end").value, location: $("#f-c-loc").value.trim(), color: picked };
      if (id) Store.update("courses", id, payload);
      else Store.add("courses", payload);
      closeModal("formModal");
      toast("课程已保存", "ok");
      renderCourses();
    };
    showModal("formModal");
  }

  /* ---------- 任务表单 ---------- */
  function openTaskForm(id) {
    const t = id ? Store.getAll("tasks").find(x => x.id === id) : null;
    const courses = Store.getAll("courses");
    $("#formTitle").textContent = id ? "编辑任务" : "添加任务";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field full"><span>任务标题 *</span><input id="f-t-title" value="${esc(t?.title || "")}" placeholder="如：高数第三章课后习题"></label>
        <label class="field"><span>所属课程</span><select id="f-t-course">
          <option value="">无</option>
          ${courses.map(c => `<option value="${c.id}" ${t?.courseId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select></label>
        <label class="field"><span>优先级</span><select id="f-t-pri">
          <option value="high" ${t?.priority === "high" ? "selected" : ""}>高</option>
          <option value="mid" ${!t || t.priority === "mid" ? "selected" : ""}>中</option>
          <option value="low" ${t?.priority === "low" ? "selected" : ""}>低</option>
        </select></label>
        <label class="field"><span>截止日期</span><input type="date" id="f-t-due" value="${t?.due ? fmtDateFull(t.due) : ""}"></label>
        <label class="field"><span>预计时长(分钟)</span><input type="number" id="f-t-est" value="${t?.estimate || 60}" min="5" step="5"></label>
        <label class="field"><span>状态</span><select id="f-t-status">
          <option value="todo" ${t?.status === "todo" || !t ? "selected" : ""}>待完成</option>
          <option value="doing" ${t?.status === "doing" ? "selected" : ""}>进行中</option>
          <option value="done" ${t?.status === "done" ? "selected" : ""}>已完成</option>
        </select></label>
      </div>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-t-title").value.trim();
      if (!title) { toast("请填写任务标题", "err"); return; }
      const dueVal = $("#f-t-due").value;
      const payload = {
        title,
        courseId: $("#f-t-course").value,
        priority: $("#f-t-pri").value,
        due: dueVal ? new Date(dueVal + "T23:59:00").toISOString() : "",
        estimate: +$("#f-t-est").value || 60,
        status: $("#f-t-status").value
      };
      if (id) Store.update("tasks", id, payload);
      else Store.add("tasks", payload);
      closeModal("formModal");
      toast("任务已保存", "ok");
      renderCourses();
    };
    showModal("formModal");
  }

  /* ============================================================
     学习笔记库
     ============================================================ */
  function renderNotes() {
    renderNoteGrid();
    renderCardGrid();
  }

  function renderNoteGrid() {
    const notes = Store.getAll("notes").slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const grid = $("#noteGrid");
    if (!notes.length) {
      grid.innerHTML = `<div class="empty-state"><div class="big">📝</div><p>还没有笔记，点击「+ 新建笔记」开始记录</p></div>`;
      return;
    }
    grid.innerHTML = notes.map(n => `
      <div class="note-card" data-note-id="${n.id}">
        <h4>${esc(n.title)}</h4>
        <p>${esc(n.content).slice(0, 120)}</p>
        <div class="note-foot">
          <span class="tag-chip">${esc(n.subject || "未分类")}</span>
          ${n.tags && n.tags.length ? n.tags.slice(0, 2).map(t => `<span class="tag-chip" style="opacity:.7">#${esc(t)}</span>`).join("") : ""}
          <span class="note-date" style="margin-left:auto">${fmtDate(n.updatedAt)}</span>
        </div>
      </div>`).join("");
    $$(".note-card").forEach(card => {
      card.onclick = () => openNote(card.dataset.noteId);
    });
  }

  function renderCardGrid() {
    const cards = Store.getAll("cards");
    const grid = $("#cardGrid");
    if (!cards.length) {
      grid.innerHTML = `<div class="empty-state"><div class="big">🧠</div><p>还没有知识卡片，点「✨ AI 生成卡片」或手动添加</p></div>`;
      return;
    }
    grid.innerHTML = cards.map(c => `
      <div class="flash-card" data-card-id="${c.id}">
        <div class="q">❓ ${esc(c.question)}</div>
        <div class="a">💡 ${esc(c.answer).replace(/\n/g, "<br>")}</div>
        <div class="hint-flip">点击翻转查看答案 · ${esc(c.subject || "")}</div>
        <button class="mini-btn del" data-act="del-card" data-id="${c.id}" style="position:absolute;top:10px;right:10px" title="删除">✕</button>
      </div>`).join("");
    $$(".flash-card").forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest("[data-act]")) return;
        card.classList.toggle("flipped");
      };
    });
    $$("[data-act='del-card']").forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); Store.remove("cards", btn.dataset.id); toast("卡片已删除", "ok"); renderCardGrid(); };
    });
  }

  function openNote(id) {
    const n = id ? Store.getAll("notes").find(x => x.id === id) : null;
    $("#formTitle").textContent = n ? "编辑笔记" : "新建笔记";
    $("#formBody").innerHTML = `
      <label class="field"><span>标题 *</span><input id="f-n-title" value="${esc(n?.title || "")}" placeholder="如：高数第三章笔记"></label>
      <div class="form-grid">
        <label class="field"><span>科目</span><input id="f-n-subject" value="${esc(n?.subject || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>标签（逗号分隔）</span><input id="f-n-tags" value="${esc((n?.tags || []).join(","))}" placeholder="如：高数,极限"></label>
      </div>
      <label class="field"><span>内容 *</span><textarea id="f-n-content" placeholder="记录你的学习内容...">${esc(n?.content || "")}</textarea></label>
      <p class="hint">小技巧：内容写好后，可以在 AI 助手输入 /organize 让 AI 帮你整理成结构化笔记。</p>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-n-title").value.trim();
      const content = $("#f-n-content").value.trim();
      if (!title || !content) { toast("标题和内容不能为空", "err"); return; }
      const now = new Date().toISOString();
      const tags = $("#f-n-tags").value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const payload = { title, subject: $("#f-n-subject").value.trim(), tags, content, updatedAt: now };
      if (n) { payload.createdAt = n.createdAt; Store.update("notes", n.id, payload); }
      else { payload.createdAt = now; Store.add("notes", payload); }
      closeModal("formModal");
      toast("笔记已保存", "ok");
      renderNotes();
    };
    showModal("formModal");
  }

  /* ============================================================
     专注学习
     ============================================================ */
  let pomoTimer = null;
  let pomoState = { running: false, mode: "work", remain: 25 * 60, total: 25 * 60 };

  function renderFocus() {
    renderFocusStats();
    renderFocusHistory();
  }

  function renderFocusStats() {
    const pomos = Store.getAll("pomodoros");
    const today = pomos.filter(p => p.startAt && p.startAt.slice(0, 10) === todayISO());
    const todayCount = today.length;
    const todayMin = today.reduce((s, p) => s + (p.minutes || 0), 0);
    const weekMin = pomos.filter(p => {
      if (!p.startAt) return false;
      const d = new Date(p.startAt.slice(0, 10));
      const now = new Date();
      const diff = (now - d) / 86400000;
      return diff >= 0 && diff < 7;
    }).reduce((s, p) => s + (p.minutes || 0), 0);
    const totalMin = pomos.reduce((s, p) => s + (p.minutes || 0), 0);
    $("#pomoTodayCount").textContent = todayCount;
    $("#pomoTodayMin").textContent = todayMin;
    $("#focusStatsRow").innerHTML = `
      <div class="fstat"><b>${todayCount}</b><span>今日番茄</span></div>
      <div class="fstat"><b>${todayMin}</b><span>今日分钟</span></div>
      <div class="fstat"><b>${Math.round(weekMin / 60 * 10) / 10}</b><span>本周小时</span></div>`;
    renderFocusWeekChart();
  }

  function renderFocusWeekChart() {
    const pomos = Store.getAll("pomodoros");
    const labels = [], values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const mins = pomos.filter(p => p.startAt && p.startAt.slice(0, 10) === key).reduce((s, p) => s + (p.minutes || 0), 0);
      labels.push(d.getDate() + "日");
      values.push(mins);
    }
    Charts.line($("#focusWeekChart"), { labels, values, height: 190, color: "#64d2ff" });
  }

  function renderFocusHistory() {
    const pomos = Store.getAll("pomodoros").slice().sort((a, b) => (b.startAt || "").localeCompare(a.startAt || "")).slice(0, 10);
    const box = $("#focusHistory");
    if (!pomos.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">🍅</div><p>还没有专注记录，点击「开始专注」</p></div>`;
      return;
    }
    box.innerHTML = pomos.map(p => {
      const d = new Date(p.startAt);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `<div class="history-item">
        <span class="history-dot"></span>
        <span>🍅 番茄钟 ${p.type === "break" ? "（休息）" : ""}</span>
        <b style="color:var(--accent)">${p.minutes} 分钟</b>
        <span class="history-meta">${fmtDate(p.startAt)} ${time}</span>
      </div>`;
    }).join("");
  }

  function startPomo() {
    if (pomoState.running) { pausePomo(); return; }
    pomoState.running = true;
    pomoState.mode = "work";
    pomoState.total = (+$("#pomoWork").value || 25) * 60;
    pomoState.remain = pomoState.total;
    updatePomoUI();
    $("#btnPomoStart").textContent = "暂停";
    $("#btnPomoStart").classList.add("btn-danger");
    $(".pomodoro-card").classList.add("working");
    $("#pomoMode").textContent = "专注中 💪";
    pomoTimer = setInterval(tickPomo, 1000);
  }

  function pausePomo() {
    pomoState.running = false;
    clearInterval(pomoTimer);
    $("#btnPomoStart").textContent = "继续";
    $("#btnPomoStart").classList.remove("btn-danger");
    $(".pomodoro-card").classList.remove("working");
    $("#pomoMode").textContent = "已暂停";
  }

  function tickPomo() {
    pomoState.remain--;
    if (pomoState.remain <= 0) {
      completePomo();
      return;
    }
    updatePomoUI();
  }

  function completePomo() {
    clearInterval(pomoTimer);
    pomoState.running = false;
    const minutes = Math.round(pomoState.total / 60);
    Store.add("pomodoros", { startAt: new Date().toISOString(), minutes, type: pomoState.mode });
    if (pomoState.mode === "work") {
      toast("🎉 专注完成！休息一下吧", "ok");
      // 自动切换到休息
      pomoState.mode = "break";
      pomoState.total = (+$("#pomoBreak").value || 5) * 60;
      pomoState.remain = pomoState.total;
      $("#pomoMode").textContent = "休息中 ☕";
      $("#btnPomoStart").textContent = "跳过休息";
      $("#btnPomoStart").classList.remove("btn-danger");
      pomoState.running = true;
      pomoTimer = setInterval(tickPomo, 1000);
    } else {
      $("#pomoMode").textContent = "休息结束，继续加油！";
      $("#btnPomoStart").textContent = "开始专注";
      $("#btnPomoStart").classList.remove("btn-danger");
    }
    updatePomoUI();
    renderFocusStats();
    renderFocusHistory();
    if (currentView === "dashboard") renderDashboard();
  }

  function updatePomoUI() {
    const m = Math.floor(pomoState.remain / 60);
    const s = pomoState.remain % 60;
    $("#pomoTime").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    const progress = pomoState.total ? 1 - pomoState.remain / pomoState.total : 0;
    document.querySelector(".pomo-ring").style.setProperty("--progress", (progress * 100).toFixed(1));
  }

  /* ============================================================
     成长档案
     ============================================================ */
  function renderGrowth() {
    renderProfile();
    renderGrades();
    renderSkills();
    renderProjects();
    renderResume();
  }

  function renderProfile() {
    const p = Store.getProfile();
    $("#userName").textContent = p.name || "同学";
    const av = p.avatar || "🚀";
    $("#userAvatar").textContent = av;
    $("#userAvatar").setAttribute("data-emoji", "1");
    // 个人主页卡片
    const infoItems = [
      p.school && { k: "🏫 学校", v: p.school },
      p.major && { k: "📖 专业", v: p.major },
      p.grade && { k: "🎓 年级", v: p.grade }
    ].filter(Boolean);
    const hasEmail = p.email;
    $("#profileBox").innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar-big">${esc(p.avatar || "🚀")}</div>
        <div class="profile-hero-info">
          <div class="profile-name">${esc(p.name || "同学")}</div>
          <div class="profile-slogan">${esc(p.slogan || "还没有个性签名～点击编辑写一句吧 ✨")}</div>
        </div>
      </div>
      ${p.goal ? `<div class="profile-goal">🎯 <b>近期目标：</b>${esc(p.goal)}</div>` : `<div class="profile-goal dim">🎯 还没有设置近期目标，写下一个想完成的小目标吧</div>`}
      <div class="profile-grid">
        ${infoItems.length ? infoItems.map(i => `<div class="profile-item"><span>${i.k}</span><b>${esc(i.v)}</b></div>`).join("") : `<div class="profile-item" style="grid-column:span 2"><span>学校信息</span><b>未填写</b></div>`}
      </div>
      ${hasEmail ? `<div class="profile-email">✉️ ${esc(hasEmail)}</div>` : ""}`;
  }

  function renderGrades() {
    const grades = Store.getAll("grades");
    const credits = grades.reduce((s, g) => s + (+g.credit || 0), 0);
    let totalPoints = 0;
    grades.forEach(g => {
      const score = +g.score || 0;
      // 4.0 制转换
      let gp = 0;
      if (score >= 90) gp = 4.0;
      else if (score >= 85) gp = 3.7;
      else if (score >= 82) gp = 3.3;
      else if (score >= 78) gp = 3.0;
      else if (score >= 75) gp = 2.7;
      else if (score >= 72) gp = 2.3;
      else if (score >= 68) gp = 2.0;
      else if (score >= 64) gp = 1.5;
      else if (score >= 60) gp = 1.0;
      totalPoints += gp * (+g.credit || 0);
    });
    const gpa = credits ? (totalPoints / credits) : 0;
    const avg = grades.length ? grades.reduce((s, g) => s + (+g.score || 0), 0) / grades.length : 0;
    $("#gpaSummary").innerHTML = `
      <div class="gpa-box"><b>${gpa.toFixed(2)}</b><span>GPA（4.0制）</span></div>
      <div class="gpa-box"><b>${avg.toFixed(1)}</b><span>平均分</span></div>
      <div class="gpa-box"><b>${grades.length}</b><span>成绩记录</span></div>
      <div class="gpa-box"><b>${credits}</b><span>总学分</span></div>`;
    const box = $("#gradeList");
    if (!grades.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">🏆</div><p>还没有成绩记录</p></div>`;
    } else {
      box.innerHTML = grades.map(g => `
        <div class="grade-row">
          <div class="grade-info"><b>${esc(g.subject)} · ${esc(g.name)}</b><br><span>${esc(g.semester || "")} · ${g.credit}学分</span></div>
          <span class="grade-score" style="color:${g.score >= 90 ? "var(--success)" : g.score >= 60 ? "var(--warning)" : "var(--danger)"}">${g.score}</span>
          <div class="row-actions">
            <button class="mini-btn" data-act="edit-grade" data-id="${g.id}">✎</button>
            <button class="mini-btn del" data-act="del-grade" data-id="${g.id}">✕</button>
          </div>
        </div>`).join("");
    }
    bindGradeActions();
  }

  function bindGradeActions() {
    $$("[data-act='del-grade']").forEach(b => b.onclick = () => { Store.remove("grades", b.dataset.id); renderGrowth(); });
    $$("[data-act='edit-grade']").forEach(b => b.onclick = () => openGradeForm(b.dataset.id));
  }

  function openGradeForm(id) {
    const g = id ? Store.getAll("grades").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑成绩" : "添加成绩";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field"><span>科目 *</span><input id="f-g-subject" value="${esc(g?.subject || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>考试名称 *</span><input id="f-g-name" value="${esc(g?.name || "")}" placeholder="如：期中考试"></label>
        <label class="field"><span>分数 *</span><input type="number" id="f-g-score" value="${g?.score ?? ""}" min="0" max="100"></label>
        <label class="field"><span>学分 *</span><input type="number" id="f-g-credit" value="${g?.credit ?? 3}" min="0.5" step="0.5"></label>
        <label class="field full"><span>学期</span><input id="f-g-sem" value="${esc(g?.semester || "")}" placeholder="如：2026春"></label>
      </div>`;
    $("#btnFormSave").onclick = () => {
      const subject = $("#f-g-subject").value.trim();
      const name = $("#f-g-name").value.trim();
      const score = +$("#f-g-score").value;
      if (!subject || !name || !score) { toast("请完整填写科目、名称与分数", "err"); return; }
      const payload = { subject, name, score, credit: +$("#f-g-credit").value || 3, semester: $("#f-g-sem").value.trim() };
      if (g) Store.update("grades", g.id, payload);
      else Store.add("grades", payload);
      closeModal("formModal");
      toast("成绩已保存", "ok");
      renderGrowth();
    };
    showModal("formModal");
  }

  function renderSkills() {
    const skills = Store.getAll("skills");
    const box = $("#skillList");
    if (!skills.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">🛠</div><p>还没有技能记录</p></div>`;
      return;
    }
    box.innerHTML = skills.map(s => `
      <div class="skill-row">
        <span class="skill-name">${esc(s.name)}</span>
        <div class="skill-bar-wrap">
          <div class="skill-bar"><i style="width:${s.level}%"></i></div>
        </div>
        <span class="skill-val">${s.level}%</span>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-skill" data-id="${s.id}">✎</button>
          <button class="mini-btn del" data-act="del-skill" data-id="${s.id}">✕</button>
        </div>
      </div>`).join("");
    $$("[data-act='del-skill']").forEach(b => b.onclick = () => { Store.remove("skills", b.dataset.id); renderGrowth(); });
    $$("[data-act='edit-skill']").forEach(b => b.onclick = () => openSkillForm(b.dataset.id));
  }

  function openSkillForm(id) {
    const s = id ? Store.getAll("skills").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑技能" : "添加技能";
    $("#formBody").innerHTML = `
      <label class="field"><span>技能名称 *</span><input id="f-s-name" value="${esc(s?.name || "")}" placeholder="如：Python"></label>
      <label class="field"><span>熟练度（0-100）</span><input type="range" id="f-s-level" min="0" max="100" value="${s?.level ?? 50}" style="accent-color:var(--accent)">
        <span id="f-s-level-val" style="color:var(--accent);font-size:13px">${s?.level ?? 50}%</span></label>`;
    $("#f-s-level").oninput = () => $("#f-s-level-val").textContent = $("#f-s-level").value + "%";
    $("#btnFormSave").onclick = () => {
      const name = $("#f-s-name").value.trim();
      if (!name) { toast("请填写技能名称", "err"); return; }
      const payload = { name, level: +$("#f-s-level").value };
      if (s) Store.update("skills", s.id, payload);
      else Store.add("skills", payload);
      closeModal("formModal");
      toast("技能已保存", "ok");
      renderGrowth();
    };
    showModal("formModal");
  }

  function renderProjects() {
    const projects = Store.getAll("projects");
    const box = $("#projectList");
    if (!projects.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">🚀</div><p>还没有项目经历</p></div>`;
      return;
    }
    box.innerHTML = projects.map(p => `
      <div class="project-row">
        <div style="flex:1">
          <b>${esc(p.name)}</b> <span style="color:var(--text-faint);font-size:12px">· ${esc(p.role || "")} · ${esc(p.start || "")} ~ ${esc(p.end || "")}</span>
          <div style="font-size:12.5px;color:var(--text-dim);margin-top:4px">${esc(p.desc || "")}</div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-project" data-id="${p.id}">✎</button>
          <button class="mini-btn del" data-act="del-project" data-id="${p.id}">✕</button>
        </div>
      </div>`).join("");
    $$("[data-act='del-project']").forEach(b => b.onclick = () => { Store.remove("projects", b.dataset.id); renderGrowth(); });
    $$("[data-act='edit-project']").forEach(b => b.onclick = () => openProjectForm(b.dataset.id));
  }

  function openProjectForm(id) {
    const p = id ? Store.getAll("projects").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑项目" : "添加项目";
    $("#formBody").innerHTML = `
      <label class="field"><span>项目名称 *</span><input id="f-p-name" value="${esc(p?.name || "")}" placeholder="如：校园二手交易小程序"></label>
      <div class="form-grid">
        <label class="field"><span>担任角色</span><input id="f-p-role" value="${esc(p?.role || "")}" placeholder="如：开发"></label>
        <label class="field"><span>项目链接</span><input id="f-p-link" value="${esc(p?.link || "")}" placeholder="https://..."></label>
        <label class="field"><span>开始时间</span><input id="f-p-start" value="${esc(p?.start || "")}" placeholder="如：2026-03"></label>
        <label class="field"><span>结束时间</span><input id="f-p-end" value="${esc(p?.end || "")}" placeholder="如：2026-05"></label>
      </div>
      <label class="field"><span>项目描述</span><textarea id="f-p-desc" placeholder="项目做了什么，你负责什么，成果如何...">${esc(p?.desc || "")}</textarea></label>`;
    $("#btnFormSave").onclick = () => {
      const name = $("#f-p-name").value.trim();
      if (!name) { toast("请填写项目名称", "err"); return; }
      const payload = { name, role: $("#f-p-role").value.trim(), link: $("#f-p-link").value.trim(), start: $("#f-p-start").value.trim(), end: $("#f-p-end").value.trim(), desc: $("#f-p-desc").value.trim() };
      if (p) Store.update("projects", p.id, payload);
      else Store.add("projects", payload);
      closeModal("formModal");
      toast("项目已保存", "ok");
      renderGrowth();
    };
    showModal("formModal");
  }

  function renderResume() {
    const p = Store.getProfile();
    const skills = Store.getAll("skills");
    const projects = Store.getAll("projects");
    const grades = Store.getAll("grades");
    const box = $("#resumePreview");
    let html = `<h2>${esc(p.name || "你的姓名")}</h2>
      <div class="rp-sub">${[p.school, p.major, p.grade].filter(Boolean).map(esc).join(" · ")}${p.email ? " · " + esc(p.email) : ""}</div>`;
    if (skills.length) {
      html += `<h4>技能</h4><ul>${skills.map(s => `<li>${esc(s.name)}（熟练度 ${s.level}%）</li>`).join("")}</ul>`;
    }
    if (projects.length) {
      html += `<h4>项目经历</h4>`;
      projects.forEach(pr => {
        html += `<div class="rp-item" style="margin-bottom:10px"><b>${esc(pr.name)}</b> ${pr.role ? "— " + esc(pr.role) : ""} ${pr.start || pr.end ? `<span style="color:#718096;font-size:12px">（${esc(pr.start)} ~ ${esc(pr.end)}）</span>` : ""}<br>
          <span style="font-size:13px">${esc(pr.desc || "")}</span></div>`;
      });
    }
    if (grades.length) {
      const avg = grades.reduce((s, g) => s + (+g.score || 0), 0) / grades.length;
      html += `<h4>学业</h4><ul><li>平均分：${avg.toFixed(1)}，共 ${grades.length} 门成绩记录</li></ul>`;
    }
    box.innerHTML = html || `<div class="empty-state"><div class="big">📄</div><p>完善资料后这里会生成简历预览</p></div>`;
  }

  /* ============================================================
     热点新闻
     ============================================================ */
  let newsCache = null;
  let newsFilter = "all";

  async function loadNews(force) {
    if (newsCache && !force) return newsCache;
    try {
      const resp = await fetch("data/news-data.json?t=" + Date.now());
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      newsCache = await resp.json();
      return newsCache;
    } catch (e) {
      return null;
    }
  }

  async function renderNews() {
    const box = $("#newsList");
    box.innerHTML = `<div class="empty-state"><div class="big"><span class="spinner" style="border-color:rgba(10,132,255,.3);border-top-color:var(--blue)"></span></div><p>正在加载今日热点...</p></div>`;
    const data = await loadNews(false);
    if (!data || !data.news || !data.news.length) {
      box.innerHTML = `<div class="empty-state">
        <div class="big">📰</div>
        <p>暂无新闻数据。请先在本地运行抓取脚本生成数据：<br><code style="color:var(--teal)">python scripts/fetch_news.py</code></p>
        <p style="margin-top:10px"><button class="btn btn-ghost" onclick="location.reload()">刷新重试</button></p>
      </div>`;
      $("#newsDate").textContent = "📅 今日热点";
      $("#newsUpdated").textContent = "";
      return;
    }
    $("#newsDate").textContent = "📅 " + (data.date || "今日热点");
    const upd = data.updatedAt ? new Date(data.updatedAt) : null;
    $("#newsUpdated").textContent = upd ? `更新于 ${String(upd.getHours()).padStart(2,"0")}:${String(upd.getMinutes()).padStart(2,"0")}` : "";

    // 过滤逻辑：全部 / 科技AI / 土木行业 / 国内 / 国际
    let filtered;
    if (newsFilter === "all") {
      filtered = data.news;
    } else if (newsFilter === "科技AI") {
      filtered = data.news.filter(n => n.topic === "科技AI" || n.tech);
    } else if (newsFilter === "土木行业") {
      filtered = data.news.filter(n => n.topic === "土木行业");
    } else {
      filtered = data.news.filter(n => n.category === newsFilter);
    }
    if (!filtered.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">📭</div><p>该分类暂无新闻</p></div>`;
      return;
    }
    // 分组：全部/国内/国际 按地区分；科技AI/土木行业 不分地区直接列表
    let groups;
    if (newsFilter === "科技AI") {
      groups = [{ name: "科技AI", emoji: "🤖", items: filtered }];
    } else if (newsFilter === "土木行业") {
      groups = [{ name: "土木·行业", emoji: "📐", items: filtered }];
    } else if (newsFilter === "all") {
      groups = [{ name: "国内", emoji: "🇨🇳", items: filtered.filter(n => n.category === "国内") },
                { name: "国际", emoji: "🌍", items: filtered.filter(n => n.category === "国际") }];
    } else {
      groups = [{ name: newsFilter, emoji: newsFilter === "国际" ? "🌍" : "🇨🇳", items: filtered }];
    }
    let html = "";
    groups.forEach(g => {
      const items = g.items;
      if (!items.length) return;
      html += `<div class="news-group"><div class="news-group-title">${g.emoji} ${g.name}热点 <span class="news-count">${items.length}</span></div>`;
      html += items.map((n, i) => `
        <div class="news-item" data-link="${esc(n.link)}">
          <span class="news-rank ${i < 3 ? "top" : ""}">${i + 1}</span>
          <span class="news-title">${esc(n.title)}</span>
          <span class="news-source">${n.region} ${esc(n.source)}</span>
          <button class="mini-btn news-copy" title="复制链接">🔗</button>
        </div>`).join("");
      html += `</div>`;
    });
    box.innerHTML = html;

    // 点击新闻跳转原文：用 window.open 兜底 + location 直开（兼容预览面板拦截弹窗）
    $$("#newsList .news-item").forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest(".news-copy")) return;
        const link = el.dataset.link;
        if (!link) return;
        const win = window.open(link, "_blank");
        if (!win) location.href = link;
      };
    });
    // 复制链接
    $$("#newsList .news-copy").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const link = btn.closest(".news-item").dataset.link;
        navigator.clipboard.writeText(link).then(() => toast("链接已复制", "ok")).catch(() => toast("复制失败", "err"));
      };
    });
  }

  /* ============================================================
     文献资料
     ============================================================ */
  const JOURNALS = [
    { name: "中国公路学报", org: "中国公路学会", url: "http://zgglxb.chd.edu.cn/", level: "EI / 北大核心", desc: "公路交通领域权威期刊" },
    { name: "公路交通科技", org: "交通部公路科学研究院", url: "https://www.gljtkj.com/", level: "北大核心", desc: "公路与桥梁技术研究" },
    { name: "桥梁建设", org: "中铁大桥局", url: "http://qljs.chd.edu.cn/", level: "EI / 北大核心", desc: "桥梁工程专业期刊" },
    { name: "土木工程学报", org: "中国土木工程学会", url: "http://www.civiljournal.com/", level: "EI / 北大核心", desc: "土木工程综合权威" },
    { name: "工程力学", org: "中国力学学会", url: "http://www.engineeringmechanics.cn/", level: "EI / 北大核心", desc: "力学与结构工程" },
    { name: "交通运输工程学报", org: "长安大学", url: "http://jtysjtxb.chd.edu.cn/", level: "EI / 北大核心", desc: "交通运输综合研究" },
    { name: "振动与冲击", org: "中国振动工程学会", url: "http://www.jvsj.net/", level: "EI / 北大核心", desc: "结构振动与抗震" },
    { name: "建筑材料学报", org: "同济大学", url: "http://jcb.clarivate.com/", level: "EI", desc: "建筑材料与结构" },
    { name: "公路", org: "交通部公路科学研究院", url: "https://www.gljtkj.com/", level: "北大核心", desc: "公路工程技术应用" },
    { name: "中外公路", org: "长沙理工大学", url: "http://www.zwgl.com.cn/", level: "北大核心", desc: "国内外公路技术" },
    { name: "知网 CNKI", org: "中国知网", url: "https://www.cnki.net/", level: "数据库", desc: "最全文献检索平台" },
    { name: "万方数据", org: "万方", url: "https://www.wanfangdata.com.cn/", level: "数据库", desc: "学术文献数据库" },
    { name: "维普网", org: "维普", url: "https://www.cqvip.com/", level: "数据库", desc: "中文期刊服务平台" },
  ];

  let litEditId = null;

  function renderLit() {
    renderJournalGrid();
    renderLitList();
  }

  function renderJournalGrid() {
    const box = $("#journalGrid");
    if (!box) return;
    box.innerHTML = JOURNALS.map(j => `
      <a class="journal-card" href="${j.url}" target="_blank" rel="noopener">
        <div class="journal-head">
          <span class="journal-name">${esc(j.name)}</span>
          <span class="journal-level">${esc(j.level)}</span>
        </div>
        <div class="journal-org">${esc(j.org)}</div>
        <div class="journal-desc">${esc(j.desc)}</div>
      </a>`).join("");
  }

  function getLitTags() {
    const tags = new Set();
    Store.getAll("literature").forEach(l => (l.tags || []).forEach(t => tags.add(t)));
    return Array.from(tags);
  }

  function renderLitList() {
    const box = $("#litList");
    const search = ($("#litSearch").value || "").trim().toLowerCase();
    const tagFilter = $("#litFilterTag").value;
    const favFilter = $("#litFilterFav").value;

    let items = Store.getAll("literature");
    if (search) {
      items = items.filter(l =>
        (l.title || "").toLowerCase().includes(search) ||
        (l.authors || "").toLowerCase().includes(search) ||
        (l.journal || "").toLowerCase().includes(search) ||
        (l.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }
    if (tagFilter) items = items.filter(l => (l.tags || []).includes(tagFilter));
    if (favFilter === "fav") items = items.filter(l => l.favorite);

    if (!items.length) {
      box.innerHTML = `<div class="empty-state"><div class="big">📖</div><p>暂无文献。点击「+ 添加文献」或「📥 导入文献」开始积累。</p></div>`;
      return;
    }
    // 收藏排前面，再按时间倒序
    items = items.slice().sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    box.innerHTML = items.map(l => `
      <div class="lit-item ${l.favorite ? "fav" : ""}" data-id="${l.id}">
        <div class="lit-main">
          <div class="lit-title">${l.favorite ? "⭐ " : ""}${esc(l.title)}</div>
          <div class="lit-meta">${esc(l.authors || "未知作者")} · ${esc(l.journal || "未知期刊")}${l.year ? " · " + l.year : ""}${l.doi ? ` · <span class="lit-doi" data-doi="${esc(l.doi)}" title="点击复制DOI">DOI</span>` : ""}</div>
          ${l.notes ? `<div class="lit-notes">${esc(l.notes)}</div>` : ""}
          ${l.tags && l.tags.length ? `<div class="lit-tags">${l.tags.map(t => `<span class="lit-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="mini-btn lit-fav" title="${l.favorite ? "取消收藏" : "收藏"}">${l.favorite ? "★" : "☆"}</button>
          <button class="mini-btn lit-edit" title="编辑">✎</button>
          <button class="mini-btn del lit-del" title="删除">✕</button>
        </div>
      </div>`).join("");

    // 绑定操作
    box.querySelectorAll(".lit-fav").forEach(b => b.onclick = () => {
      const id = b.closest(".lit-item").dataset.id;
      const item = Store.getAll("literature").find(x => x.id === id);
      if (item) { Store.update("literature", id, { favorite: !item.favorite }); renderLitList(); }
    });
    box.querySelectorAll(".lit-edit").forEach(b => b.onclick = () => openLitForm(b.closest(".lit-item").dataset.id));
    box.querySelectorAll(".lit-del").forEach(b => b.onclick = () => {
      const id = b.closest(".lit-item").dataset.id;
      if (confirm("确定删除这篇文献吗？")) { Store.remove("literature", id); toast("已删除", "ok"); renderLitList(); }
    });
    box.querySelectorAll(".lit-doi").forEach(s => s.onclick = () => {
      navigator.clipboard.writeText(s.dataset.doi).then(() => toast("DOI 已复制", "ok"));
    });
  }

  function openLitForm(editId) {
    litEditId = editId || null;
    const l = editId ? Store.getAll("literature").find(x => x.id === editId) : null;
    $("#formTitle").textContent = editId ? "编辑文献" : "添加文献";
    $("#formBody").innerHTML = `
      <label class="field"><span>标题 *</span><input id="f-lit-title" value="${esc(l?.title || "")}" placeholder="文献标题"></label>
      <div class="form-grid">
        <label class="field"><span>作者</span><input id="f-lit-authors" value="${esc(l?.authors || "")}" placeholder="张三, 李四"></label>
        <label class="field"><span>期刊/来源</span><input id="f-lit-journal" value="${esc(l?.journal || "")}" placeholder="中国公路学报"></label>
        <label class="field"><span>年份</span><input id="f-lit-year" value="${esc(l?.year || "")}" placeholder="2025"></label>
        <label class="field"><span>DOI</span><input id="f-lit-doi" value="${esc(l?.doi || "")}" placeholder="10.xxxx/xxxxx"></label>
      </div>
      <label class="field"><span>标签（逗号分隔）</span><input id="f-lit-tags" value="${esc((l?.tags || []).join(","))}" placeholder="桥梁工程, 抗震"></label>
      <label class="field"><span>备注/摘要</span><textarea id="f-lit-notes" rows="4" placeholder="你的阅读笔记或文献摘要...">${esc(l?.notes || "")}</textarea></label>
      <label class="field" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" id="f-lit-fav" ${l?.favorite ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--blue)">
        <span style="font-size:13.5px">⭐ 收藏此文献</span>
      </label>`;
    $("#btnFormSave").onclick = () => {
      const title = $("#f-lit-title").value.trim();
      if (!title) { toast("请填写文献标题", "err"); return; }
      const data = {
        title,
        authors: $("#f-lit-authors").value.trim(),
        journal: $("#f-lit-journal").value.trim(),
        year: $("#f-lit-year").value.trim(),
        doi: $("#f-lit-doi").value.trim(),
        tags: $("#f-lit-tags").value.split(/[,，]/).map(t => t.trim()).filter(Boolean),
        notes: $("#f-lit-notes").value.trim(),
        favorite: $("#f-lit-fav").checked,
      };
      if (litEditId) {
        Store.update("literature", litEditId, data);
        toast("文献已更新", "ok");
      } else {
        Store.add("literature", { ...data, createdAt: new Date().toISOString() });
        toast("文献已添加", "ok");
      }
      closeModal("formModal");
      renderLitList();
    };
    showModal("formModal");
  }

  function openLitImportModal() {
    // 简化版导入：粘贴多条文献，每行一条，格式：标题 | 作者 | 期刊 | 年份 | DOI
    $("#formTitle").textContent = "导入文献";
    $("#formBody").innerHTML = `
      <p class="hint">粘贴文献列表，每行一条，格式：<code>标题 | 作者 | 期刊 | 年份 | DOI</code>（DOI 可省略）</p>
      <textarea id="f-lit-import" rows="10" placeholder="例如：\n桥梁抗震设计方法研究 | 张三, 李四 | 中国公路学报 | 2025 | 10.19721/j.cnki.1001-7372.2025.01.001\n装配式桥梁施工技术 | 王五 | 桥梁建设 | 2024"></textarea>
      <p class="hint">💡 也可以直接粘贴从知网/万方导出的题录文本，AI 会尝试解析。</p>`;
    $("#btnFormSave").onclick = async () => {
      const text = $("#f-lit-import").value.trim();
      if (!text) { toast("请先粘贴文献内容", "err"); return; }
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      let added = 0;
      lines.forEach(line => {
        const parts = line.split("|").map(p => p.trim());
        if (parts.length < 1 || !parts[0]) return;
        Store.add("literature", {
          title: parts[0],
          authors: parts[1] || "",
          journal: parts[2] || "",
          year: parts[3] || "",
          doi: parts[4] || "",
          tags: [], notes: "", favorite: false,
          createdAt: new Date().toISOString()
        });
        added++;
      });
      closeModal("formModal");
      toast(`已导入 ${added} 条文献`, "ok");
      renderLitList();
    };
    showModal("formModal");
  }

  /* ============================================================
     AI 助手
     ============================================================ */
  function renderAIStatus() {
    const ok = AI.isConfigured();
    const el = $("#aiStatus");
    el.textContent = ok ? "● 模型已配置" : "● 未配置模型（本地模式）";
    el.className = "ai-status " + (ok ? "ok" : "");
  }

  function addChatMsg(text, who = "ai") {
    const box = $("#chatBox");
    const div = document.createElement("div");
    div.className = "chat-msg " + who;
    div.innerHTML = `<div class="chat-avatar">${who === "ai" ? "✨" : "你"}</div>
      <div class="chat-bubble">${esc(text).replace(/\n/g, "<br>")}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  async function sendChat(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    addChatMsg(trimmed, "user");
    $("#chatInput").value = "";
    const loading = addChatMsg("思考中<span class='spinner' style='border-color:rgba(139,92,246,.4);border-top-color:#fff'></span>", "ai");
    const isCmd = trimmed.startsWith("/");
    try {
      let reply;
      if (isCmd) {
        const [cmd, ...rest] = trimmed.split(/\s+/);
        const restText = rest.join(" ");
        if (cmd === "/plan") reply = (await AI.runSkill("plan")).text;
        else if (cmd === "/priority") reply = (await AI.runSkill("priority")).text;
        else if (cmd === "/cards") reply = (await AI.runSkill("cards")).text;
        else if (cmd === "/organize") reply = (await AI.runSkill("organize", restText)).text;
        else reply = "未知命令。可用命令：/plan /priority /cards /organize";
      } else {
        reply = await AI.ask(trimmed);
      }
      loading.querySelector(".chat-bubble").innerHTML = esc(reply).replace(/\n/g, "<br>");
    } catch (e) {
      loading.querySelector(".chat-bubble").innerHTML = `<span style="color:var(--danger)">⚠️ ${esc(e.message)}</span>`;
    }
  }

  /* ============================================================
     弹窗管理
     ============================================================ */
  function showModal(id) { $("#" + id).classList.add("show"); }
  function closeModal(id) { $("#" + id).classList.remove("show"); }

  /* ============================================================
     设置
     ============================================================ */
  function openSettings() {
    const s = Store.getSettings();
    $("#setBaseUrl").value = s.baseUrl || "";
    $("#setApiKey").value = s.apiKey || "";
    $("#setModel").value = s.model || "";
    $("#setNickname").value = s.nickname || "";
    showModal("settingsModal");
  }

  function saveSettings() {
    Store.setSettings({
      baseUrl: $("#setBaseUrl").value.trim(),
      apiKey: $("#setApiKey").value.trim(),
      model: $("#setModel").value.trim(),
      nickname: $("#setNickname").value.trim()
    });
    const nick = $("#setNickname").value.trim();
    if (nick) Store.setProfile({ name: nick });
    closeModal("settingsModal");
    toast("设置已保存", "ok");
    renderAIStatus();
    renderProfile();
    if (currentView === "dashboard") renderDashboard();
  }

  /* ============================================================
     全局搜索
     ============================================================ */
  function setupSearch() {
    const input = $("#globalSearch");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      const results = [];
      Store.getAll("notes").forEach(n => { if ((n.title + n.content).toLowerCase().includes(q)) results.push({ type: "笔记", title: n.title, id: n.id, view: "notes", act: "note" }); });
      Store.getAll("tasks").forEach(t => { if (t.title.toLowerCase().includes(q)) results.push({ type: "任务", title: t.title, id: t.id, view: "courses", act: "task" }); });
      Store.getAll("courses").forEach(c => { if (c.name.toLowerCase().includes(q)) results.push({ type: "课程", title: c.name, id: c.id, view: "courses", act: "course" }); });
      if (results.length) {
        const first = results[0];
        switchView(first.view);
        toast(`🔍 找到 ${results.length} 条结果，跳转到「${first.type}」`, "ok");
        input.value = "";
        if (first.act === "note") setTimeout(() => openNote(first.id), 100);
        else if (first.act === "task") setTimeout(() => openTaskForm(first.id), 100);
        else if (first.act === "course") setTimeout(() => openCourseForm(first.id), 100);
      } else if (q.length > 1) {
        toast("未找到匹配内容", "err");
        input.value = "";
      }
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
  function openQR() {
    showModal("qrcodeModal");
    const box = $("#qrCodeBox");
    box.innerHTML = `<span class="hint">点击下方按钮生成</span>`;
  }

  function generateQR() {
    // 默认使用已部署的 GitHub Pages 永久链接（未手动设置时）
    const DEFAULT_SITE = "https://lele332.github.io/xingyu-platform/";
    const link = localStorage.getItem("xingyu_site_url") || DEFAULT_SITE;
    const box = $("#qrCodeBox");
    const hint = $("#qrHint");
    if (link) {
      hint.textContent = "扫描二维码，在手机上打开你的个人工作台。";
    } else {
      hint.textContent = "尚未设置部署链接。请先部署到 GitHub Pages 后，点击「复制部署链接」填入地址再生成。";
    }
    box.innerHTML = "";
    try {
      if (window.QRCode) {
        new QRCode(box, { text: link || "https://your-github-pages-url.github.io/", width: 190, height: 190, correctLevel: QRCode.CorrectLevel.H });
      } else {
        box.innerHTML = `<span class="hint">二维码库加载失败，请检查网络（需联网加载 qrcodejs CDN）。</span>`;
      }
    } catch (e) {
      box.innerHTML = `<span class="hint">生成失败：${esc(e.message)}</span>`;
    }
  }

  function copyLink() {
    const link = localStorage.getItem("xingyu_site_url") || "";
    if (!link) {
      toast("请先在设置里粘贴你的 GitHub Pages 部署链接", "err");
      const val = prompt("请输入你的 GitHub Pages 链接（部署后获得）：");
      if (val) {
        localStorage.setItem("xingyu_site_url", val.trim());
        toast("链接已保存，可生成二维码", "ok");
      }
      return;
    }
    navigator.clipboard.writeText(link).then(() => toast("链接已复制", "ok")).catch(() => toast("复制失败，请手动复制：" + link, "err"));
  }

  /* ============================================================
     导入课表
     ============================================================ */
  const COURSE_COLORS = ["#0a84ff", "#5e5ce6", "#bf5af2", "#64d2ff", "#30d158", "#ffd60a", "#ff453a", "#ff375f"];
  let pendingImportCourses = [];

  function openImportModal() {
    pendingImportCourses = [];
    // 重置界面
    $("#imgPreview").innerHTML = "";
    $("#scheduleImgFile").value = "";
    $("#scheduleText").value = "";
    $("#importResult").style.display = "none";
    $("#btnRecognizeImg").disabled = true;
    // 默认选中"粘贴文本"更通用；若已配置 AI 且有视觉模型则默认截图
    $$(".import-tab").forEach(t => t.classList.toggle("active", t.dataset.itab === "text"));
    $$(".import-panel").forEach(p => p.classList.toggle("active", p.id === "itab-text"));
    showModal("importModal");
  }

  function showImportResult(courses) {
    pendingImportCourses = courses;
    const box = $("#importResultList");
    const resultBox = $("#importResult");
    if (!courses.length) {
      resultBox.style.display = "block";
      box.innerHTML = `<div class="empty-state"><div class="big">🤔</div><p>未能识别出课程，请检查图片清晰度 / 文本格式后重试，或手动添加课程。</p></div>`;
      $("#importResultCount").textContent = "0 门";
      return;
    }
    resultBox.style.display = "block";
    $("#importResultCount").textContent = `${courses.length} 门课程`;
    box.innerHTML = courses.map((c, i) => `
      <div class="import-course">
        <span class="import-cd" style="background:${COURSE_COLORS[i % COURSE_COLORS.length]}">${WEEKDAYS[c.day] || "?"}</span>
        <div class="import-ci">
          <b>${esc(c.name)}</b>
          <span>${c.start || "?"}-${c.end || "?"} · ${esc(c.location || "未填地点")}${c.teacher ? " · " + esc(c.teacher) : ""}</span>
        </div>
      </div>`).join("");
  }

  async function recognizeImg() {
    const btn = $("#btnRecognizeImg");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const base64 = await readImageFile($("#scheduleImgFile").files[0]);
      const courses = await AI.recognizeScheduleImage(base64);
      showImportResult(courses);
      if (!courses.length) toast("未识别到课程", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ AI 识别课表";
    }
  }

  function handleScheduleImg() {
    const file = $("#scheduleImgFile").files[0];
    if (!file) return;
    const preview = $("#imgPreview");
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = "100%";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
    $("#btnRecognizeImg").disabled = false;
    toast("图片已选择，点击「AI 识别课表」", "ok");
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("请先选择图片"));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
  }

  function confirmImport() {
    if (!pendingImportCourses.length) { toast("没有可导入的课程", "err"); return; }
    const existing = Store.getAll("courses");
    const existingNames = new Set(existing.map(c => c.name));
    let added = 0, skipped = 0;
    pendingImportCourses.forEach((c, i) => {
      if (!c.name || !c.day) { skipped++; return; }
      if (existingNames.has(c.name)) { skipped++; return; }
      Store.add("courses", { ...c, color: COURSE_COLORS[i % COURSE_COLORS.length] });
      existingNames.add(c.name);
      added++;
    });
    closeModal("importModal");
    toast(added ? `已导入 ${added} 门课程${skipped ? `，跳过 ${skipped} 门（重复或无效）` : ""}` : "没有新课程可导入（可能已存在）", added ? "ok" : "err");
    renderCourses();
  }

  /* ============================================================
     导入成绩
     ============================================================ */
  let pendingImportGrades = [];

  function openGradesImportModal() {
    pendingImportGrades = [];
    $("#gradesText").value = "";
    $("#gradesImgFile").value = "";
    $("#gradesImgPreview").innerHTML = "";
    $("#gradesImportResult").style.display = "none";
    $("#btnRecognizeGrades").disabled = true;
    $$(".import-tab").forEach(t => t.classList.toggle("active", t.dataset.itab === "gtext"));
    $$(".import-panel").forEach(p => p.classList.toggle("active", p.id === "itab-gtext"));
    showModal("importGradesModal");
  }

  function showGradesImportResult(grades) {
    pendingImportGrades = grades;
    const box = $("#gradesResultList");
    const resultBox = $("#gradesImportResult");
    if (!grades.length) {
      resultBox.style.display = "block";
      box.innerHTML = `<div class="empty-state"><div class="big">🤔</div><p>未能解析出成绩，请检查文本格式后重试，或手动添加成绩。</p></div>`;
      $("#gradesResultCount").textContent = "0 条";
      return;
    }
    resultBox.style.display = "block";
    $("#gradesResultCount").textContent = `${grades.length} 条成绩`;
    box.innerHTML = grades.map(g => `
      <div class="import-course">
        <span class="import-cd" style="background:${g.score >= 90 ? "#30d158" : g.score >= 60 ? "#ffd60a" : "#ff453a"}">${g.score}</span>
        <div class="import-ci">
          <b>${esc(g.subject)}</b>
          <span>${esc(g.name)} · ${g.credit}学分${g.semester ? " · " + esc(g.semester) : ""}</span>
        </div>
      </div>`).join("");
  }

  function confirmGradesImport() {
    if (!pendingImportGrades.length) { toast("没有可导入的成绩", "err"); return; }
    const existing = Store.getAll("grades");
    let added = 0, skipped = 0;
    pendingImportGrades.forEach(g => {
      const dup = existing.find(x => x.subject === g.subject && x.name === g.name && x.semester === g.semester);
      if (dup) { skipped++; return; }
      Store.add("grades", g);
      existing.push(g);
      added++;
    });
    closeModal("importGradesModal");
    toast(added ? `已导入 ${added} 条成绩${skipped ? `，跳过 ${skipped} 条重复` : ""}` : "没有新成绩可导入（可能已存在）", added ? "ok" : "err");
    renderGrowth();
  }

  async function parseGradesBtn() {
    const text = $("#gradesText").value.trim();
    if (!text) { toast("请先粘贴成绩文本", "err"); return; }
    const btn = $("#btnParseGrades");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>解析中...`;
    try {
      const grades = await AI.parseGradesText(text);
      showGradesImportResult(grades);
      if (!grades.length) toast("未能解析出成绩，请检查格式", "err");
    } catch (e) {
      toast(e.message || "解析失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ 解析成绩";
    }
  }

  function handleGradesImg() {
    const file = $("#gradesImgFile").files[0];
    if (!file) return;
    const preview = $("#gradesImgPreview");
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = "100%";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
    $("#btnRecognizeGrades").disabled = false;
    toast("图片已选择，点击「AI 识别成绩」", "ok");
  }

  async function recognizeGradesBtn() {
    const btn = $("#btnRecognizeGrades");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const base64 = await readImageFile($("#gradesImgFile").files[0]);
      const grades = await AI.recognizeGradesImage(base64);
      showGradesImportResult(grades);
      if (!grades.length) toast("未识别到成绩", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ AI 识别成绩";
    }
  }

  /* ============================================================
     导入笔记
     ============================================================ */
  let pendingImportNotes = [];

  function openNotesImportModal() {
    pendingImportNotes = [];
    $("#notesText").value = "";
    $("#notesImgFile").value = "";
    $("#notesImgPreview").innerHTML = "";
    $("#notesImportResult").style.display = "none";
    $("#btnRecognizeNotes").disabled = true;
    $$(".import-tab").forEach(t => t.classList.toggle("active", t.dataset.itab === "ntext"));
    $$(".import-panel").forEach(p => p.classList.toggle("active", p.id === "itab-ntext"));
    showModal("importNotesModal");
  }

  function showNotesImportResult(notes) {
    pendingImportNotes = notes;
    const box = $("#notesResultList");
    const resultBox = $("#notesImportResult");
    if (!notes.length) {
      resultBox.style.display = "block";
      box.innerHTML = `<div class="empty-state"><div class="big">🤔</div><p>未能识别出笔记，请检查文本/图片后重试，或手动新建笔记。</p></div>`;
      $("#notesResultCount").textContent = "0 条";
      return;
    }
    resultBox.style.display = "block";
    $("#notesResultCount").textContent = `${notes.length} 条笔记`;
    box.innerHTML = notes.map((n, i) => `
      <div class="import-course">
        <span class="import-cd" style="background:${COURSE_COLORS[i % COURSE_COLORS.length]}">📝</span>
        <div class="import-ci">
          <b>${esc(n.title)}</b>
          <span>${esc(n.subject || "未分类")}${n.tags.length ? " · " + n.tags.map(t => "#" + esc(t)).join(" ") : ""}</span>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px;max-height:48px;overflow:hidden">${esc(n.content).slice(0, 120)}</div>
        </div>
      </div>`).join("");
  }

  function confirmNotesImport() {
    if (!pendingImportNotes.length) { toast("没有可导入的笔记", "err"); return; }
    const existing = Store.getAll("notes");
    const existingTitles = new Set(existing.map(n => n.title));
    let added = 0, skipped = 0;
    const now = new Date().toISOString();
    pendingImportNotes.forEach(n => {
      if (!n.title) { skipped++; return; }
      if (existingTitles.has(n.title)) { skipped++; return; }
      Store.add("notes", { ...n, createdAt: now, updatedAt: now });
      existingTitles.add(n.title);
      added++;
    });
    closeModal("importNotesModal");
    toast(added ? `已导入 ${added} 条笔记${skipped ? `，跳过 ${skipped} 条重复` : ""}` : "没有新笔记可导入（可能已存在）", added ? "ok" : "err");
    renderNotes();
  }

  async function parseNotesBtn() {
    const text = $("#notesText").value.trim();
    if (!text) { toast("请先粘贴笔记内容", "err"); return; }
    const btn = $("#btnParseNotes");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const notes = await AI.parseNotesText(text);
      showNotesImportResult(notes);
      if (!notes.length) toast("未能识别出笔记，请检查格式", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ 识别并整理";
    }
  }

  function handleNotesImg() {
    const file = $("#notesImgFile").files[0];
    if (!file) return;
    const preview = $("#notesImgPreview");
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.maxWidth = "100%";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
    $("#btnRecognizeNotes").disabled = false;
    toast("图片已选择，点击「AI 识别笔记」", "ok");
  }

  async function recognizeNotesBtn() {
    const btn = $("#btnRecognizeNotes");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>识别中...`;
    try {
      const base64 = await readImageFile($("#notesImgFile").files[0]);
      const notes = await AI.recognizeNotesImage(base64);
      showNotesImportResult(notes);
      if (!notes.length) toast("未识别到笔记内容", "err");
    } catch (e) {
      toast(e.message || "识别失败", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ AI 识别笔记";
    }
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {
    // 导航
    $$(".nav-item").forEach(n => n.onclick = () => switchView(n.dataset.view));
    $$("[data-goto]").forEach(b => b.onclick = () => switchView(b.dataset.goto));
    $$("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close));
    $(".modal-mask") && $$(".modal-mask").forEach(m => m.onclick = (e) => { if (e.target === m) m.classList.remove("show"); });

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
        btn.textContent = "✨ 解析课表";
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
    $("#btnSmartSort").onclick = () => {
      if (AI.isConfigured()) {
        // 已配置 AI：跳转聊天区执行智能排序
        toast("已跳转 AI 助手执行智能排序", "ok");
        switchView("ai");
        setTimeout(() => { $("#chatInput").value = "/priority"; sendChat("/priority"); }, 300);
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
        $("#chatInput").value = "/organize";
        sendChat("/organize");
      }, 300);
    };
    $("#btnGenCards").onclick = () => {
      switchView("ai");
      setTimeout(() => {
        $("#chatInput").value = "/cards";
        sendChat("/cards");
      }, 300);
    };

    // 专注
    $("#btnPomoStart").onclick = startPomo;
    $("#btnPomoReset").onclick = () => {
      clearInterval(pomoTimer);
      pomoState.running = false;
      pomoState.mode = "work";
      pomoState.total = (+$("#pomoWork").value || 25) * 60;
      pomoState.remain = pomoState.total;
      $("#btnPomoStart").textContent = "开始专注";
      $("#btnPomoStart").classList.remove("btn-danger");
      $(".pomodoro-card").classList.remove("working");
      $("#pomoMode").textContent = "准备开始";
      updatePomoUI();
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
    $("#chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat($("#chatInput").value); });
    $$(".chip[data-cmd]").forEach(c => c.onclick = () => { $("#chatInput").value = c.dataset.cmd + " "; $("#chatInput").focus(); });

    // 设置
    $("#btnSettings").onclick = openSettings;
    $("#btnSaveSettings").onclick = saveSettings;
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

    // 二维码
    $("#btnQrcode").onclick = openQR;
    $("#btnGenQR").onclick = generateQR;
    $("#btnCopyLink").onclick = copyLink;

    // 热点新闻
    $("#btnRefreshNews").onclick = async () => {
      toast("正在刷新新闻...", "ok");
      newsCache = null;
      await renderNews();
      toast("新闻已更新", "ok");
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

    // 全局搜索
    setupSearch();

    // 时钟
    tickClock();
    setInterval(tickClock, 10000);
  }

  function openProfileForm() {
    const p = Store.getProfile();
    const AVATARS = ["🚀", "🌟", "📚", "🎓", "🧠", "⚡", "🐱", "🐶", "🌙", "☀️", "🎮", "🎧", "💻", "🏀", "✈️", "🌊", "🍀", "🔥", "🎯", "💡"];
    $("#formTitle").textContent = "编辑个人资料";
    $("#formBody").innerHTML = `
      <label class="field"><span>昵称 *</span><input id="f-pf-name" value="${esc(p.name || "")}" placeholder="怎么称呼你"></label>
      <label class="field"><span>头像（选一个喜欢的）</span>
        <div class="avatar-picker" id="f-pf-avatar">${AVATARS.map(a => `<span class="avatar-opt ${p.avatar === a ? "picked" : ""}" data-a="${a}">${a}</span>`).join("")}</div>
      </label>
      <label class="field"><span>个性签名</span><input id="f-pf-slogan" value="${esc(p.slogan || "")}" placeholder="一句话介绍自己，如：保持好奇，持续学习"></label>
      <label class="field"><span>近期目标</span><input id="f-pf-goal" value="${esc(p.goal || "")}" placeholder="如：这学期绩点冲到 3.5、通过四级"></label>
      <div class="form-grid">
        <label class="field"><span>学校</span><input id="f-pf-school" value="${esc(p.school || "")}" placeholder="选填"></label>
        <label class="field"><span>专业</span><input id="f-pf-major" value="${esc(p.major || "")}" placeholder="选填"></label>
        <label class="field"><span>年级</span><input id="f-pf-grade" value="${esc(p.grade || "")}" placeholder="如：大二"></label>
        <label class="field"><span>邮箱（自己用的，选填）</span><input id="f-pf-email" value="${esc(p.email || "")}" placeholder="选填"></label>
      </div>`;
    // 头像选择
    let pickedAvatar = p.avatar || "🚀";
    $$("#f-pf-avatar .avatar-opt").forEach(a => a.onclick = () => {
      $$("#f-pf-avatar .avatar-opt").forEach(x => x.classList.remove("picked"));
      a.classList.add("picked");
      pickedAvatar = a.dataset.a;
    });
    $("#btnFormSave").onclick = () => {
      const name = $("#f-pf-name").value.trim();
      if (!name) { toast("请填写昵称", "err"); return; }
      Store.setProfile({
        name,
        avatar: pickedAvatar,
        school: $("#f-pf-school").value.trim(),
        major: $("#f-pf-major").value.trim(),
        grade: $("#f-pf-grade").value.trim(),
        slogan: $("#f-pf-slogan").value.trim(),
        goal: $("#f-pf-goal").value.trim(),
        email: $("#f-pf-email").value.trim()
      });
      closeModal("formModal");
      toast("资料已保存", "ok");
      renderGrowth();
      renderDashboard();
    };
    showModal("formModal");
  }

  /* ---------- 启动 ---------- */
  function init() {
    bindEvents();
    // 应用保存的昵称（仅当尚未设置个人昵称时）
    const nick = Store.getSettings().nickname;
    const p = Store.getProfile();
    if (nick && (!p.name || p.name === "同学")) Store.setProfile({ name: nick });
    renderProfile();
    renderDashboard();
    // 让 AI 页面初始化状态
    renderAIStatus();
    // 默认展示仪表盘
    switchView("dashboard");
    console.log("✦ 星屿 · 个人AI工作平台已启动");
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
