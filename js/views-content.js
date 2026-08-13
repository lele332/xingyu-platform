/* ============================================================
   views-content.js — 内容类视图
   热点新闻：loadNews / renderNews
   文献资料：renderLit / renderJournalGrid / getLitTags / renderLitList
            openLitForm / openLitImportModal
   AI 助手页：renderAIStatus / addChatMsg / addChatActions / sendChat
   ============================================================ */

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
    box.innerHTML = `<div class="empty-state"><div class="big"><span class="spinner" style="border-color:rgba(77,214,255,.3);border-top-color:var(--blue)"></span></div><p>正在加载今日热点...</p></div>`;
    const data = await loadNews(false);
    if (!data || !data.news || !data.news.length) {
      box.innerHTML = `<div class="empty-state">
        
        <p>暂无新闻数据。请先在本地运行抓取脚本生成数据：<br><code style="color:var(--teal)">python scripts/fetch_news.py</code></p>
        <p style="margin-top:10px"><button class="btn btn-ghost" onclick="location.reload()">刷新重试</button></p>
      </div>`;
      $("#newsDate").textContent = "今日热点";
      $("#newsUpdated").textContent = "";
      return;
    }
    $("#newsDate").textContent = "" + (data.date || "今日热点");
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
      box.innerHTML = `<div class="empty-state"><p>该分类暂无新闻</p></div>`;
      return;
    }
    // 分组：全部/国内/国际 按地区分；科技AI/土木行业 不分地区直接列表
    let groups;
    if (newsFilter === "科技AI") {
      groups = [{ name: "科技AI", items: filtered }];
    } else if (newsFilter === "土木行业") {
      groups = [{ name: "土木·行业", items: filtered }];
    } else if (newsFilter === "all") {
      groups = [{ name: "国内", items: filtered.filter(n => n.category === "国内") },
                { name: "国际", items: filtered.filter(n => n.category === "国际") }];
    } else {
      groups = [{ name: newsFilter, items: filtered }];
    }
    let html = "";
    groups.forEach(g => {
      const items = g.items;
      if (!items.length) return;
      html += `<div class="news-group"><div class="news-group-title">${g.name}热点 <span class="news-count">${items.length}</span></div>`;
      html += items.map((n, i) => `
        <div class="news-item" data-link="${esc(n.link)}">
          <span class="news-rank ${i < 3 ? "top" : ""}">${i + 1}</span>
          <span class="news-title">${esc(n.title)}</span>
          <span class="news-source">${n.region} ${esc(n.source)}</span>
          <button class="mini-btn news-copy" title="复制链接"></button>
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
    // 滚动分批浮入
    revealCards($("#view-news"), "#newsList .news-item");
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
      box.innerHTML = `<div class="empty-state"><p>暂无文献。点击「+ 添加文献」或「导入文献」开始积累。</p></div>`;
      return;
    }
    // 收藏排前面，再按时间倒序
    items = items.slice().sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.createdAt || "").localeCompare(a.createdAt || ""));
    box.innerHTML = items.map(l => `
      <div class="lit-item ${l.favorite ? "fav" : ""}" data-id="${l.id}">
        <div class="lit-main">
          <div class="lit-title">${l.favorite ? "" : ""}${esc(l.title)}</div>
          <div class="lit-meta">${esc(l.authors || "未知作者")} · ${esc(l.journal || "未知期刊")}${l.year ? " · " + l.year : ""}${l.doi ? ` · <span class="lit-doi" data-doi="${esc(l.doi)}" title="点击复制DOI">DOI</span>` : ""}</div>
          ${l.notes ? `<div class="lit-notes">${esc(l.notes)}</div>` : ""}
          ${l.tags && l.tags.length ? `<div class="lit-tags">${l.tags.map(t => `<span class="lit-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="mini-btn lit-fav" title="${l.favorite ? "取消收藏" : "收藏"}">${l.favorite ? "" : ""}</button>
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
      if (confirm("确定删除这篇文献吗？")) { Store.remove("literature", id); renderLitList(); }
    });
    box.querySelectorAll(".lit-doi").forEach(s => s.onclick = () => {
      navigator.clipboard.writeText(s.dataset.doi).then(() => toast("DOI 已复制", "ok"));
    });
    // 滚动分批浮入
    revealCards($("#view-lit"), ".lit-item");
  }

  function openLitForm(editId) {
    hideFormDelete();
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
        <span style="font-size:13.5px">收藏此文献</span>
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
      <p class="hint">也可以直接粘贴从知网/万方导出的题录文本，AI 会尝试解析。</p>`;
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
    const context = $("#aiContext");
    if (context) {
      const taskCount = Store.getAll("tasks").filter(item => item.status !== "done").length;
      const noteCount = Store.getAll("notes").length;
      context.textContent = `参考 ${taskCount} 项任务 · ${noteCount} 篇笔记`;
    }
  }

  function addChatMsg(text, who = "ai") {
    const box = $("#chatBox");
    const div = document.createElement("div");
    div.className = "chat-msg " + who;
    div.innerHTML = `<div class="chat-avatar">${who === "ai" ? "AI" : "你"}</div>
      <div class="chat-bubble">${esc(text).replace(/\n/g, "<br>")}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function addChatActions(message, text) {
    const bubble = message && message.querySelector(".chat-bubble");
    if (!bubble || !text) return;
    const actions = document.createElement("div");
    actions.className = "chat-actions";
    const icon = name => window.XingyuIcons ? XingyuIcons.svg(name) : "";
    actions.innerHTML = `
      <button class="chat-action" type="button" data-chat-action="copy">${icon("copy")}复制</button>
      <button class="chat-action" type="button" data-chat-action="save">${icon("save")}保存为笔记</button>`;
    actions.querySelector('[data-chat-action="copy"]').onclick = () => {
      navigator.clipboard.writeText(text).then(() => toast("已复制 AI 回复", "ok")).catch(() => toast("复制失败", "err"));
    };
    actions.querySelector('[data-chat-action="save"]').onclick = () => {
      const now = new Date().toISOString();
      const title = text.split(/\n/).map(line => line.replace(/^[#*\-\d.\s]+/, "").trim()).find(Boolean) || "AI 学习笔记";
      Store.add("notes", {
        title: title.slice(0, 40),
        subject: "AI 助手",
        tags: ["AI"],
        content: text,
        createdAt: now,
        updatedAt: now
      });
      toast("已保存到学习笔记库", "ok");
      renderAIStatus();
    };
    bubble.appendChild(actions);
  }

  const CMD_MAP = {
    "/plan": "plan", "/学习规划": "plan", "/规划": "plan",
    "/priority": "priority", "/智能排序": "priority", "/排序": "priority",
    "/cards": "cards", "/知识卡片": "cards", "/卡片": "cards", "/复习": "cards",
    "/organize": "organize", "/笔记整理": "organize", "/整理": "organize"
  };
  let chatBusy = false;
  async function sendChat(text) {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;
    chatBusy = true;
    $("#btnChatSend").disabled = true;
    $("#btnChatStop").style.display = "";
    addChatMsg(trimmed, "user");
    $("#chatInput").value = "";
    const loading = addChatMsg("思考中…", "ai");
    loading.classList.add("chat-loading");
    const isCmd = trimmed.startsWith("/");
    try {
      let reply;
      if (isCmd) {
        const [cmd, ...rest] = trimmed.split(/\s+/);
        const restText = rest.join(" ");
        const skill = CMD_MAP[cmd.toLowerCase()];
        if (skill === "plan") reply = (await AI.runSkill("plan")).text;
        else if (skill === "priority") reply = (await AI.runSkill("priority")).text;
        else if (skill === "cards") reply = (await AI.runSkill("cards")).text;
        else if (skill === "organize") reply = (await AI.runSkill("organize", restText)).text;
        else reply = "未知命令。可用命令：/学习规划 /智能排序 /知识卡片 /笔记整理";
      } else {
        reply = await AI.ask(trimmed);
      }
      loading.querySelector(".chat-bubble").innerHTML = esc(reply).replace(/\n/g, "<br>");
      addChatActions(loading, reply);
    } catch (e) {
      loading.querySelector(".chat-bubble").innerHTML = e.message === "已停止生成"
        ? `<span style="color:var(--ink-3)">已停止生成</span>`
        : `<span style="color:var(--danger)">${esc(e.message)}</span>`;
    } finally {
      chatBusy = false;
      loading.classList.remove("chat-loading");
      $("#btnChatSend").disabled = false;
      $("#btnChatStop").style.display = "none";
    }
  }
