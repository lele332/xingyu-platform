/* ============================================================
   views-growth.js — 成长档案视图（资料 / 成绩 / 技能 / 项目 / 简历 / 成绩导入）
   renderGrowth / renderProfile / renderGrades / bindGradeActions
   openGradeForm / renderSkills / openSkillForm / renderProjects
   openProjectForm / renderResume / openProfileForm
   成绩一键导入：openGradesImportModal / showGradesImportResult
   confirmGradesImport / parseGradesBtn / handleGradesImg / recognizeGradesBtn
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
    const av = p.avatar || "";
    $("#userAvatar").textContent = av || (p.name || "同学").charAt(0);
    if (av) $("#userAvatar").setAttribute("data-emoji", "1");
    else $("#userAvatar").removeAttribute("data-emoji");
    // 个人主页卡片
    const infoItems = [
      p.school && { k: "学校", v: p.school },
      p.major && { k: "专业", v: p.major },
      p.grade && { k: "年级", v: p.grade }
    ].filter(Boolean);
    const hasEmail = p.email;
    $("#profileBox").innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar-big">${esc(p.avatar || (p.name || "同学").charAt(0))}</div>
        <div class="profile-hero-info">
          <div class="profile-name">${esc(p.name || "同学")}</div>
          <div class="profile-slogan">${esc(p.slogan || "还没有个性签名～点击编辑写一句吧 ")}</div>
        </div>
      </div>
      ${p.goal ? `<div class="profile-goal"><b>近期目标：</b>${esc(p.goal)}</div>` : `<div class="profile-goal dim">还没有设置近期目标，写下一个想完成的小目标吧</div>`}
      <div class="profile-grid">
        ${infoItems.length ? infoItems.map(i => `<div class="profile-item"><span>${i.k}</span><b>${esc(i.v)}</b></div>`).join("") : `<div class="profile-item" style="grid-column:span 2"><span>学校信息</span><b>未填写</b></div>`}
      </div>
      ${hasEmail ? `<div class="profile-email">${esc(hasEmail)}</div>` : ""}`;
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
      box.innerHTML = `<div class="empty-state"><p>还没有成绩记录</p></div>`;
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
    hideFormDelete();
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
      box.innerHTML = `<div class="empty-state"><p>还没有技能记录</p></div>`;
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
    hideFormDelete();
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
      box.innerHTML = `<div class="empty-state"><p>还没有项目经历</p></div>`;
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
    hideFormDelete();
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
    box.innerHTML = html || `<div class="empty-state"><p>完善资料后这里会生成简历预览</p></div>`;
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
    let pickedAvatar = p.avatar || "";
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
      box.innerHTML = `<div class="empty-state"><p>未能解析出成绩，请检查文本格式后重试，或手动添加成绩。</p></div>`;
      $("#gradesResultCount").textContent = "0 条";
      return;
    }
    resultBox.style.display = "block";
    $("#gradesResultCount").textContent = `${grades.length} 条成绩`;
    box.innerHTML = grades.map(g => `
      <div class="import-course">
        <span class="import-cd" style="background:${g.score >= 90 ? "var(--course-2)" : g.score >= 60 ? "var(--course-5)" : "var(--course-1)"}">${g.score}</span>
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
      btn.textContent = "解析成绩";
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
      btn.textContent = "AI 识别成绩";
    }
  }
