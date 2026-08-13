/* ============================================================
   views-notes.js — 学习笔记库视图（笔记 / 知识卡片 / 笔记导入）
   renderNotes / renderNoteGrid / renderCardGrid / openNote
   笔记一键导入：openNotesImportModal / showNotesImportResult
   confirmNotesImport / parseNotesBtn / handleNotesImg / recognizeNotesBtn
   ============================================================ */

  function renderNotes() {
    renderNoteGrid();
    renderCardGrid();
  }

  function renderNoteGrid() {
    const notes = Store.getAll("notes").slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const grid = $("#noteGrid");
    if (!notes.length) {
      grid.innerHTML = `<div class="empty-state"><p>还没有笔记，点击「+ 新建笔记」开始记录</p></div>`;
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
    // 滚动分批浮入
    revealCards($("#view-notes"), ".note-card");
  }

  /* ============================================================
     知识卡片 · 间隔重复（SM-2）
     ============================================================ */
  let reviewQueue = [];
  let reviewDone = 0;
  let reviewTotal = 0;

  // SM-2 算法：q = 0 忘记 / 3 模糊 / 5 记住
  function sm2(card, q) {
    let reps = card.reps || 0;
    let ease = card.ease || 2.5;
    let interval = card.interval || 0;
    if (q < 3) {
      reps = 0;
      interval = 1;
    } else {
      reps += 1;
      if (reps === 1) interval = 1;
      else if (reps === 2) interval = 6;
      else interval = Math.round(interval * ease);
      ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    }
    return { reps, ease, interval, due: new Date(Date.now() + interval * 86400000).toISOString() };
  }

  function renderCardGrid() {
    const cards = Store.getAll("cards");
    const grid = $("#cardGrid");
    if (!cards.length) {
      grid.innerHTML = `<div class="empty-state"><p>还没有知识卡片，点「AI 生成卡片」或手动添加</p></div>`;
      return;
    }
    const now = Date.now();
    const dueCards = cards.filter(c => !c.due || new Date(c.due).getTime() <= now);
    const reviewBar = dueCards.length
      ? `<div class="review-bar" style="grid-column:1/-1">
          <div class="review-bar-info"><b>${dueCards.length}</b> 张卡片待复习 · 按记忆曲线自动安排</div>
          <button class="btn btn-primary" id="btnStartReview">开始今日复习</button>
        </div>`
      : `<div class="review-bar done" style="grid-column:1/-1"><div class="review-bar-info">今日复习已完成，保持节奏 ✓</div></div>`;

    grid.innerHTML = reviewBar + cards.map(c => {
      const dueTxt = c.due ? (new Date(c.due).getTime() > now ? `下次：${fmtDate(c.due)}` : "待复习") : "新卡片";
      return `<div class="flash-card" data-card-id="${c.id}">
        <div class="q">${esc(c.question)}</div>
        <div class="a">${esc(c.answer).replace(/\n/g, "<br>")}</div>
        <div class="hint-flip">点击翻转 · ${esc(c.subject || "")} · ${dueTxt}</div>
        <button class="mini-btn del" data-act="del-card" data-id="${c.id}" style="position:absolute;top:10px;right:10px" title="删除">✕</button>
      </div>`;
    }).join("");

    $$(".flash-card").forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest("[data-act]")) return;
        card.classList.toggle("flipped");
      };
    });
    $$("[data-act='del-card']").forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); Store.remove("cards", btn.dataset.id); renderCardGrid(); };
    });
    const startBtn = $("#btnStartReview");
    if (startBtn) startBtn.onclick = () => startReview();
  }

  function startReview() {
    const now = Date.now();
    reviewQueue = Store.getAll("cards").filter(c => !c.due || new Date(c.due).getTime() <= now);
    reviewDone = 0;
    reviewTotal = reviewQueue.length;
    if (!reviewTotal) { toast("今日没有待复习的卡片", "ok"); return; }
    renderReviewSession();
  }

  function renderReviewSession() {
    const grid = $("#cardGrid");
    if (reviewDone >= reviewTotal) { finishReview(); return; }
    const c = reviewQueue[reviewDone];
    grid.innerHTML = `
      <div class="review-session" style="grid-column:1/-1">
        <div class="review-progress">复习进度 ${reviewDone + 1} / ${reviewTotal}</div>
        <div class="flash-card review-card" id="reviewCard">
          <div class="q">${esc(c.question)}</div>
          <div class="a">${esc(c.answer).replace(/\n/g, "<br>")}</div>
          <div class="hint-flip">点击卡片翻转查看答案</div>
        </div>
        <div class="review-actions">
          <button class="btn btn-ghost" data-rate="0">忘记</button>
          <button class="btn btn-ghost" data-rate="3">模糊</button>
          <button class="btn btn-primary" data-rate="5">记住</button>
        </div>
        <div class="review-subject">${esc(c.subject || "未分类")}</div>
      </div>`;
    const card = $("#reviewCard");
    if (card) card.onclick = () => card.classList.toggle("flipped");
    $$("[data-rate]").forEach(btn => {
      btn.onclick = () => rateCard(+btn.dataset.rate);
    });
  }

  function rateCard(q) {
    const c = reviewQueue[reviewDone];
    if (c) Store.update("cards", c.id, sm2(c, q));
    reviewDone++;
    renderReviewSession();
  }

  function finishReview() {
    const grid = $("#cardGrid");
    grid.innerHTML = `<div class="review-session done" style="grid-column:1/-1">
      <div class="review-bar-info">今日复习完成！共复习 ${reviewTotal} 张卡片 ✓</div>
      <button class="btn btn-primary" id="btnBackToCards">返回卡片列表</button>
    </div>`;
    $("#btnBackToCards").onclick = () => renderCardGrid();
  }

  function openNote(id) {
    const n = id ? Store.getAll("notes").find(x => x.id === id) : null;
    const delBtn = $("#btnFormDelete");
    if (delBtn) delBtn.style.display = "none";
    if (n && delBtn) {
      delBtn.style.display = "inline-block";
      delBtn.onclick = () => {
        if (confirm("确定删除这篇笔记吗？")) {
          Store.remove("notes", n.id);
          closeModal("formModal");
          renderNotes();
        }
      };
    }
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
      box.innerHTML = `<div class="empty-state"><p>未能识别出笔记，请检查文本/图片后重试，或手动新建笔记。</p></div>`;
      $("#notesResultCount").textContent = "0 条";
      return;
    }
    resultBox.style.display = "block";
    $("#notesResultCount").textContent = `${notes.length} 条笔记`;
    box.innerHTML = notes.map((n, i) => `
      <div class="import-course">
        <span class="import-cd" style="background:${COURSE_COLORS[i % COURSE_COLORS.length]}"></span>
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
      btn.textContent = "识别并整理";
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
      btn.textContent = "AI 识别笔记";
    }
  }
