/* ============================================================
   views-courses.js — 课程作业视图（课程 / 任务 / 课表导入）
   renderCourses / renderWeekGrid / renderCourseList / renderTaskList
   bindRowActions / openCourseForm / openTaskForm / hideFormDelete
   课表一键导入：openImportModal / showImportResult / recognizeImg
   handleScheduleImg / readImageFile / confirmImport
   ============================================================ */

  function renderCourses() {
    renderWeekGrid();
    renderCourseList();
    renderTaskList();
    renderExams();
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
      box.innerHTML = `<div class="empty-state"><p>还没有课程，点击右上角「+ 添加课程」</p></div>`;
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
      box.innerHTML = `<div class="empty-state"><p>没有符合条件的任务</p></div>`;
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
        if (act === "del-course") { Store.remove("courses", id); renderCourses(); renderDashboard(); }
        else if (act === "del-task") { Store.remove("tasks", id); renderCourses(); }
        else if (act === "edit-course") { openCourseForm(id); }
        else if (act === "edit-task") { openTaskForm(id); }
        else if (act === "edit-exam") { openExamForm(id); }
        else if (act === "del-exam") { Store.remove("exams", id); renderCourses(); renderDashboard(); }
        else if (act === "toggle-task") {
          const t = Store.getAll("tasks").find(x => x.id === id);
          if (t) { Store.update("tasks", id, { status: t.status === "done" ? "todo" : "done" }); renderCourses(); }
        }
      };
    });
  }

  /* ============================================================
     考试（倒计时 / 管理）
     ============================================================ */
  function renderExams() {
    const exams = Store.getAll("exams").slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const box = $("#examList");
    if (!box) return;
    if (!exams.length) {
      box.innerHTML = `<div class="empty-state"><p>还没有考试安排，点击右上角「+ 添加考试」</p></div>`;
      return;
    }
    box.innerHTML = exams.map(ex => {
      const days = ex.date ? daysUntil(ex.date) : null;
      let state = "";
      let stateTxt = "";
      if (days === null) stateTxt = "未定日期";
      else if (days < 0) { state = "overdue"; stateTxt = `已结束 ${-days} 天`; }
      else if (days === 0) { state = "urgent"; stateTxt = "今天考试"; }
      else if (days <= 7) { state = "urgent"; stateTxt = `剩 ${days} 天`; }
      else stateTxt = `剩 ${days} 天`;
      return `<div class="task-row ${state}">
        <div class="cd-num"><b>${days === null ? "—" : Math.abs(days)}</b><span>${days === null ? "" : "天"}</span></div>
        <div class="course-info">
          <b>${esc(ex.name || ex.subject || "未命名考试")}</b>
          <span>${esc(ex.subject || "")}${ex.date ? " · " + fmtDate(ex.date) : ""}${ex.location ? " · " + esc(ex.location) : ""}</span>
        </div>
        ${stateTxt ? `<span class="tag-chip ${state === "urgent" ? "pri-high" : state === "overdue" ? "" : ""}" style="margin-left:auto">${stateTxt}</span>` : ""}
        <div class="row-actions">
          <button class="mini-btn" data-act="edit-exam" data-id="${ex.id}" title="编辑">✎</button>
          <button class="mini-btn del" data-act="del-exam" data-id="${ex.id}" title="删除">✕</button>
        </div>
      </div>`;
    }).join("");
    bindRowActions();
  }

  function openExamForm(id) {
    hideFormDelete();
    const ex = id ? Store.getAll("exams").find(x => x.id === id) : null;
    $("#formTitle").textContent = id ? "编辑考试" : "添加考试";
    $("#formBody").innerHTML = `
      <div class="form-grid">
        <label class="field"><span>考试名称 *</span><input id="f-e-name" value="${esc(ex?.name || "")}" placeholder="如：高等数学期末考试"></label>
        <label class="field"><span>科目</span><input id="f-e-subject" value="${esc(ex?.subject || "")}" placeholder="如：高等数学"></label>
        <label class="field"><span>考试日期 *</span><input type="date" id="f-e-date" value="${ex?.date ? fmtDateFull(ex.date) : ""}"></label>
        <label class="field"><span>地点</span><input id="f-e-loc" value="${esc(ex?.location || "")}" placeholder="如：教学楼A-301"></label>
        <label class="field full"><span>备注</span><input id="f-e-note" value="${esc(ex?.note || "")}" placeholder="如：开卷考试，可带计算器"></label>
      </div>`;
    $("#btnFormSave").onclick = () => {
      const name = $("#f-e-name").value.trim();
      const date = $("#f-e-date").value;
      if (!name || !date) { toast("请填写考试名称和日期", "err"); return; }
      const payload = {
        name,
        subject: $("#f-e-subject").value.trim(),
        date: new Date(date + "T09:00:00").toISOString(),
        location: $("#f-e-loc").value.trim(),
        note: $("#f-e-note").value.trim()
      };
      if (id) Store.update("exams", id, payload);
      else Store.add("exams", { ...payload, createdAt: new Date().toISOString() });
      closeModal("formModal");
      toast("考试已保存", "ok");
      renderCourses();
      renderDashboard();
    };
    showModal("formModal");
  }

  /* ---------- 课程表单 ---------- */
  function hideFormDelete() {
    const b = $("#btnFormDelete");
    if (b) b.style.display = "none";
  }
  function openCourseForm(id) {
    hideFormDelete();
    const c = id ? Store.getAll("courses").find(x => x.id === id) : null;
    const colors = ["#111111", "#000000", "#444444", "#555555", "#333333", "#111111", "#666666", "#888888"];
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
    let picked = c?.color || "#111111";
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
    hideFormDelete();
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
     导入课表
     ============================================================ */
  const COURSE_COLORS = ["var(--course-1)", "var(--course-2)", "var(--course-3)", "var(--course-4)", "var(--course-5)", "var(--course-6)", "var(--course-7)", "var(--course-8)"];
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
      box.innerHTML = `<div class="empty-state"><p>未能识别出课程，请检查图片清晰度 / 文本格式后重试，或手动添加课程。</p></div>`;
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
      btn.textContent = "AI 识别课表";
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
      if (!/^image\//i.test(file.type || "")) return reject(new Error("请选择 JPG、PNG 等图片文件"));
      if (file.size > 10 * 1024 * 1024) return reject(new Error("图片不能超过 10MB，请压缩后重试"));
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
