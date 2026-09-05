/* ============================================================
   synapse-coach.js — 马拉松 AI 教练
   复用 ai.js 的 AI.chat() 与 Store 数据，参考 synapse-run/ReportEngine
   中的 20+ 报告模板作为 Prompt 上下文，对用户跑步记录做专业分析。
   不需要 MySQL / Tavily / Bocha — 仅需 DeepSeek (OpenAI 兼容) API。
   ============================================================ */
(function () {
  "use strict";

  const MANIFEST_URL = "synapse-run/manifest.json";
  let _manifest = null;
  const _tplCache = {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg, type) { if (window.toast) window.toast(msg, type); }

  function getRecords() {
    return (window.Running && Running.getRecords) ? Running.getRecords() : [];
  }

  function fmtPace(p) {
    if (!isFinite(p) || p <= 0) return "—";
    var m = Math.floor(p), s = Math.round((p - m) * 60);
    if (s === 60) { m++; s = 0; }
    return m + "'" + (s < 10 ? "0" + s : s) + '"';
  }

  function summarize(records) {
    var t = { totalKm: 0, count: 0, full: 0, half: 0, run: 0, paces: [], hrs: [],
              recent30Km: 0, recent30Count: 0, longestKm: 0, longestDate: null,
              longestFullTime: null, longestHalfTime: null, sources: { huawei: 0, manual: 0 } };
    var now = new Date();
    var d30 = new Date(now.getTime() - 30 * 86400e3);
    records.forEach(function (r) {
      var km = +r.distanceKm || 0;
      t.totalKm += km;
      t.count++;
      if (r.type === "full") t.full++;
      else if (r.type === "half") t.half++;
      else t.run++;
      if (+r.pace > 0) t.paces.push(+r.pace);
      if (+r.avgHr > 0) t.hrs.push(+r.avgHr);
      if (km > t.longestKm) { t.longestKm = km; t.longestDate = r.date; }
      if (r.type === "full" && (!t.longestFullTime || (+r.durationMin || 0) > t.longestFullTime.min)) {
        t.longestFullTime = { min: +r.durationMin, date: r.date, pace: +r.pace };
      }
      if (r.type === "half" && (!t.longestHalfTime || (+r.durationMin || 0) > t.longestHalfTime.min)) {
        t.longestHalfTime = { min: +r.durationMin, date: r.date, pace: +r.pace };
      }
      var d = new Date(r.date);
      if (!isNaN(d) && d >= d30) { t.recent30Km += km; t.recent30Count++; }
      if (r.source === "huawei") t.sources.huawei++;
      else if (r.source === "manual") t.sources.manual++;
    });
    t.avgPace = t.paces.length ? (t.paces.reduce(function (a, b) { return a + b; }, 0) / t.paces.length) : null;
    t.avgHr = t.hrs.length ? Math.round(t.hrs.reduce(function (a, b) { return a + b; }, 0) / t.hrs.length) : null;
    return t;
  }

  async function loadManifest() {
    if (_manifest) return _manifest;
    try {
      var r = await fetch(MANIFEST_URL + "?v=" + Date.now(), { cache: "no-store" });
      _manifest = await r.json();
    } catch (e) {
      _manifest = { templates: [] };
    }
    return _manifest;
  }

  async function loadTemplate(id) {
    if (_tplCache[id]) return _tplCache[id];
    var m = await loadManifest();
    var t = (m.templates || []).find(function (x) { return x.id === id; });
    if (!t) return "";
    try {
      var r = await fetch("synapse-run/" + t.file + "?v=" + Date.now(), { cache: "no-store" });
      var text = await r.text();
      _tplCache[id] = text;
      return text;
    } catch (e) {
      return "";
    }
  }

  function buildSystemPrompt(templateText) {
    return [
      "你是「星屿 Synapse Run AI 训练教练」，专门为大学生 / 业余跑者提供个性化训练分析。",
      "请严格遵循下方\"报告模板\"的结构组织回答。所有结论必须基于用户提供的真实数据，避免空泛建议。",
      "",
      "# 报告模板",
      templateText || "(无模板，按通用结构输出)",
      "",
      "# 格式规范",
      "- 严格使用 Markdown（## 三级标题、### 四级标题、列表、加粗、表格可选）",
      "- 关键数字加粗（例如 **5'30\"/km**）",
      "- 训练建议要具体：公里数、配速区间（如 5'30\"~5'45\"/km）、心率区间、频率、休息日",
      "- 引用具体数据支撑每条结论，避免 AI 套话",
      "- 中文输出，不要使用 emoji 装饰"
    ].join("\n");
  }

  function buildUserPrompt(question, summary, records) {
    var slim = records.slice(0, 50).map(function (r) {
      return {
        date: r.date, type: r.type, km: r.distanceKm, min: r.durationMin,
        pace: r.pace, hr: r.avgHr, cad: r.cadence, src: r.source, note: r.note
      };
    });
    return [
      "## 用户当前问题",
      question,
      "",
      "## 用户聚合数据",
      "- 总跑量：" + summary.totalKm.toFixed(1) + " km（" + summary.count + " 次）",
      "- 类型分布：全马 " + summary.full + " 次 / 半马 " + summary.half + " 次 / 普通跑 " + summary.run + " 次",
      "- 平均配速：" + fmtPace(summary.avgPace) + " /km",
      "- 平均心率：" + (summary.avgHr || "—") + " bpm",
      "- 最近 30 天：" + summary.recent30Km.toFixed(1) + " km（" + summary.recent30Count + " 次）",
      "- 单次最长：" + summary.longestKm.toFixed(2) + " km（" + (summary.longestDate || "—") + "）",
      "- 数据来源：华为 " + summary.sources.huawei + " 条 / 手动 " + summary.sources.manual + " 条",
      summary.longestFullTime ? "- 全马最慢完赛：" + summary.longestFullTime.min + " 分钟（" + summary.longestFullTime.date + "，配速 " + fmtPace(summary.longestFullTime.pace) + "）" : "",
      summary.longestHalfTime ? "- 半马最慢完赛：" + summary.longestHalfTime.min + " 分钟（" + summary.longestHalfTime.date + "，配速 " + fmtPace(summary.longestHalfTime.pace) + "）" : "",
      "",
      "## 最近 50 条跑步记录（JSON）",
      "```json",
      JSON.stringify(slim, null, 2),
      "```",
      "",
      "## 输出要求",
      "1. 按模板结构组织，每节都给出具体可执行的建议",
      "2. 引用上述数据中的数字作为依据",
      "3. 如果数据不足以支撑某项分析，明确指出\"需要更多记录\"再给建议",
      "4. 输出末尾给出 3~5 条「下一步行动计划」（具体到本周 / 公里 / 配速 / 心率）"
    ].filter(Boolean).join("\n");
  }

  /* 极简 Markdown → HTML（足够覆盖模板输出）
     安全：第一步先对全文 esc() —— AI 输出可能携带用户备注内容或被提示注入，
     未转义直插 innerHTML 会形成 XSS 链（主聊天链路 app.js 已做，此处补齐）。 */
  function renderMarkdown(md) {
    if (!md) return "";
    var html = esc(md);

    // 1) 代码块（保护内部字符；全文已 esc，此处 esc 二次调用对已转义文本幂等）
    var codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, function (_, code) {
      var idx = codeBlocks.length;
      codeBlocks.push("<pre class=\"synapse-pre\"><code>" + code + "</code></pre>");
      return "\u0000CODE" + idx + "\u0000";
    });

    // 2) 行内代码
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

    // 3) 标题
    html = html.replace(/^####\s+(.*)$/gm, "<h5>$1</h5>");
    html = html.replace(/^###\s+(.*)$/gm, "<h4>$1</h4>");
    html = html.replace(/^##\s+(.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^#\s+(.*)$/gm, "<h2>$1</h2>");

    // 4) 引用、分割线
    html = html.replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/^---$/gm, "<hr/>");

    // 5) 加粗 / 斜体（先强后弱，避免 ** 吃掉 *）
    html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

    // 6) 简单表格：| a | b |\n| - | - |\n| 1 | 2 |
    html = html.replace(/(^\|.+\|\n\|[\s\-:|]+\|\n(?:\|.+\|\n?)+)/gm, function (block) {
      var lines = block.trim().split(/\n/);
      if (lines.length < 2) return block;
      var head = lines[0].split("|").slice(1, -1).map(function (c) { return c.trim(); });
      var rows = lines.slice(2).map(function (l) { return l.split("|").slice(1, -1).map(function (c) { return c.trim(); }); });
      var out = "<table class=\"synapse-table\"><thead><tr>" +
        head.map(function (c) { return "<th>" + c + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") +
        "</tbody></table>";
      return out;
    });

    // 7) 列表（连续 - 开头的行）
    html = html.replace(/(^[\-\*]\s+.*(?:\n[\-\*]\s+.*)*)/gm, function (block) {
      var items = block.split(/\n/).map(function (l) { return "<li>" + l.replace(/^[\-\*]\s+/, "") + "</li>"; }).join("");
      return "<ul>" + items + "</ul>";
    });
    html = html.replace(/(^\d+\.\s+.*(?:\n\d+\.\s+.*)*)/gm, function (block) {
      var items = block.split(/\n/).map(function (l) { return "<li>" + l.replace(/^\d+\.\s+/, "") + "</li>"; }).join("");
      return "<ol>" + items + "</ol>";
    });

    // 8) 段落（双换行分段）
    html = html.split(/\n{2,}/).map(function (blk) {
      var t = blk.trim();
      if (!t) return "";
      if (/^<(h\d|ul|ol|pre|blockquote|hr|table)/.test(t)) return t;
      return "<p>" + t.replace(/\n/g, "<br/>") + "</p>";
    }).join("\n");

    // 9) 还原代码块
    html = html.replace(/\u0000CODE(\d+)\u0000/g, function (_, i) {
      return codeBlocks[+i] || "";
    });
    return html;
  }

  async function askCoach(templateId, question, outEl) {
    if (!outEl) outEl = $("#synapseOutput");
    if (!window.AI) {
      outEl.innerHTML = '<div class="synapse-empty">⚠ AI 模块未加载。</div>';
      return;
    }
    if (!AI.isConfigured || !AI.isConfigured()) {
      outEl.innerHTML = '<div class="synapse-empty">⚠ AI 模型未配置。请在「设置」里填写 DeepSeek API Key（baseUrl 默认为 https://api.deepseek.com/v1）。</div>';
      toast("请先在「设置」里配置 API Key", "err");
      return;
    }
    var records = getRecords();
    if (!records.length) {
      outEl.innerHTML = '<div class="synapse-empty">⚠ 暂无跑步记录。请先在「跑步日志」里手动添加，或点击「导入华为数据」上传 JSON。</div>';
      toast("先添加一些跑步记录再让 AI 分析", "err");
      return;
    }
    outEl.innerHTML = '<div class="synapse-thinking"><span class="spinner"></span> AI 教练正在分析你的 ' + records.length + ' 条跑步数据…</div>';
    outEl.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      var tpl = await loadTemplate(templateId);
      var summary = summarize(records);
      var sys = buildSystemPrompt(tpl);
      var usr = buildUserPrompt(question, summary, records);
      var md = await AI.chat([
        { role: "system", content: sys },
        { role: "user", content: usr }
      ], { temperature: 0.6 });
      outEl.innerHTML =
        '<div class="synapse-report-head">' +
          '<span class="synapse-report-tag">AI 训练报告</span>' +
          '<span class="synapse-report-meta">基于 ' + records.length + ' 条记录 · ' + new Date().toLocaleString("zh-CN") + '</span>' +
        '</div>' +
        '<article class="synapse-report">' + renderMarkdown(md) + '</article>' +
        '<div class="synapse-report-foot">' +
          '<div class="synapse-foot-btns">' +
            '<button class="text-btn" id="btnSynapseCopy">复制 Markdown</button>' +
            '<button class="text-btn" id="btnSynapseRead">🔊 朗读报告</button>' +
          '</div>' +
          '<span class="synapse-hint">⚠ AI 生成的建议仅供参考，训练计划请结合体感与医生建议</span>' +
        '</div>';
      var copyBtn = $("#btnSynapseCopy");
      if (copyBtn) {
        copyBtn.onclick = function () {
          try {
            navigator.clipboard.writeText(md).then(function () { toast("已复制 Markdown", "ok"); });
          } catch (e) { toast("复制失败", "err"); }
        };
      }
      var readBtn = $("#btnSynapseRead");
      if (readBtn && window.VoxVoice) {
        readBtn.onclick = function () {
          var plain = md
            .replace(/```[\s\S]*?```/g, "")
            .replace(/[#>*`\-_|]/g, "")
            .replace(/\n{2,}/g, "。")
            .replace(/\n/g, "，")
            .replace(/\s{2,}/g, " ")
            .trim();
          if (!plain) { toast("报告内容为空", "err"); return; }
          var btn = readBtn;
          if (btn) btn.textContent = "■ 停止朗读";
          VoxVoice.speak(plain, {
            onEnd: function () { if (btn) btn.textContent = "🔊 朗读报告"; },
            onError: function (msg) { if (btn) btn.textContent = "🔊 朗读报告"; toast(msg || "朗读失败", "err"); }
          });
        };
      }
      toast("AI 报告生成完成", "ok");
    } catch (e) {
      outEl.innerHTML = '<div class="synapse-error">⚠ ' + esc(e.message || String(e)) + '</div>';
      toast("AI 报告生成失败：" + (e.message || ""), "err");
    }
  }

  async function render() {
    var root = document.getElementById("tab-run-coach");
    if (!root) return;
    var records = getRecords();
    var summary = summarize(records);
    var m = await loadManifest();
    var tpls = m.templates || [];

    root.innerHTML =
      '<div class="synapse-wrap">' +
        // Hero
        '<div class="synapse-hero">' +
          '<div class="synapse-hero-l">' +
            '<div class="synapse-brand">' +
              '<span class="synapse-pulse" aria-hidden="true"><i></i><i></i><i></i></span>' +
              '<span class="synapse-brand-text">Synapse Run · AI 训练教练</span>' +
            '</div>' +
            '<h2 class="synapse-title">把你的跑步数据交给 AI 解构</h2>' +
            '<p class="synapse-sub">基于 ' + records.length + ' 条历史记录 · 融合 20+ 中长跑专业报告模板 · 调用 DeepSeek 生成个性化分析</p>' +
            (records.length === 0
              ? '<p class="synapse-warn">⚠ 暂无跑步记录。先去「跑步日志 → + 手动记录」或「导入华为数据」添加一些吧。</p>'
              : '') +
          '</div>' +
          '<div class="synapse-hero-r">' +
            '<div class="synapse-stat"><b>' + summary.totalKm.toFixed(1) + '</b><span>总里程 km</span></div>' +
            '<div class="synapse-stat"><b>' + summary.count + '</b><span>跑步次数</span></div>' +
            '<div class="synapse-stat"><b>' + summary.full + '/' + summary.half + '</b><span>全马 / 半马</span></div>' +
            '<div class="synapse-stat"><b>' + fmtPace(summary.avgPace) + '</b><span>平均配速 /km</span></div>' +
          '</div>' +
        '</div>' +

        // 01 模板选择
        '<div class="synapse-section">' +
          '<h3 class="synapse-h3"><span class="synapse-num">01</span>选择分析模板</h3>' +
          '<p class="synapse-section-sub">点击任一模板，AI 将基于你的真实记录按该模板结构生成报告。</p>' +
          '<div class="synapse-templates" id="synapseTemplates">' +
            tpls.map(function (t) {
              return '<button class="synapse-chip" data-tpl="' + esc(t.id) + '" type="button">' +
                       '<span class="synapse-chip-ico">' + esc(t.icon) + '</span>' +
                       '<span class="synapse-chip-body">' +
                         '<span class="synapse-chip-title">' + esc(t.title) + '</span>' +
                         '<span class="synapse-chip-use">' + esc(t.useFor) + '</span>' +
                       '</span>' +
                     '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        // 02 自定义问题
        '<div class="synapse-section">' +
          '<h3 class="synapse-h3"><span class="synapse-num">02</span>自定义问题（可选）</h3>' +
          '<p class="synapse-section-sub">问题可空 — 留空则按所选模板生成综合分析；填写则把问题与模板结合。</p>' +
          '<textarea id="synapseQuestion" rows="2" placeholder="例：下月想挑战武汉马拉松半马，请基于过去 3 个月的训练量给出 4 周备赛计划与目标配速。"></textarea>' +
          '<div class="synapse-actions">' +
            '<button class="btn btn-primary" id="btnSynapseAsk" type="button">⚡ 生成 AI 分析报告</button>' +
            '<span class="synapse-hint">提示：DeepSeek 长上下文，按需生成 800~2000 字报告</span>' +
          '</div>' +
        '</div>' +

        // 03 输出
        '<div class="synapse-section">' +
          '<h3 class="synapse-h3"><span class="synapse-num">03</span>AI 报告输出</h3>' +
          '<div class="synapse-output" id="synapseOutput">' +
            '<div class="synapse-empty">📜 报告将在这里呈现。选择上方模板或输入问题后点击「生成」。</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    wire();
  }

  function wire() {
    var chips = $$("#synapseTemplates .synapse-chip");
    chips.forEach(function (btn) {
      btn.onclick = function () {
        chips.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var titleEl = btn.querySelector(".synapse-chip-title");
        var q = ($("#synapseQuestion").value || (titleEl ? titleEl.textContent : btn.dataset.tpl)).trim();
        askCoach(btn.dataset.tpl, q, $("#synapseOutput"));
      };
    });
    var ask = $("#btnSynapseAsk");
    if (ask) {
      ask.onclick = function () {
        var active = $(".synapse-chip.active");
        var tpl = active ? active.dataset.tpl : "running-analysis";
        var q = ($("#synapseQuestion").value || "综合分析我的跑步训练数据，给出可执行建议").trim();
        askCoach(tpl, q, $("#synapseOutput"));
      };
    }
  }

  // 暴露 API
  window.Synapse = {
    render: render,
    askCoach: askCoach,
    summarize: summarize,
    invalidate: function () { /* 渲染无缓存，保留空实现以兼容旧调用方 */ }
  };
})();