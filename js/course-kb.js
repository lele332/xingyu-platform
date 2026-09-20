/* course-kb.js — 专业课程知识库 / 课程教练
   9 门专业课的章节地图、概念卡、公式卡、典型题、规范索引、延伸书目，
   以及把检索证据注入 AI 的「问这门课」通道。
   依赖：/api/kb/*（server.py）、AI.chat（js/ai.js）。全部失败都必须静默降级，不能抛运行时异常。 */
(function () {
  "use strict";

  var S = {
    subjects: [],
    current: "",
    tab: "outline",
    outline: null,
    cache: {},        // subjectId -> {concepts, formulas, exercises, standards, books}
    searchHits: [],
    asking: false,
    ready: false,
    requestSeq: 0,
    turnSeq: 0,
    thread: [],        // 对话线程：{id, q, a, cites, mode, scope, ts, loading}
    history: [],       // 给 AI 的多轮上下文（由 thread 派生）：{q, a}
    scope: { bookId: "", chapter: "" },   // 提问范围：指定教材 + 限定章节
    quote: "",         // 划选追问：从回答里选中的原文
    books: [],         // 当前课程的参考书（供下拉选择）
    _sel: "",
    focused: false,
  };

  var KIND_LABEL = {
    concept: "概念", formula: "公式", exercise: "题型",
    standard: "规范", book: "参考书", syllabus: "章节", source: "教材原文",
    reference: "文献",
  };

  var MODES = [
    { k: "preview", n: "预习这一章" },
    { k: "homework", n: "这道题怎么做" },
    { k: "review", n: "帮我复习" },
    { k: "organize", n: "整理成笔记" },
  ];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------------- mini LaTeX：项目没有 KaTeX，够用即可 ---------------- */
  var GREEK = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", varepsilon: "ε", epsilon: "ε",
    zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
    nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
    phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
    Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
    Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  };
  var SYM = {
    cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤",
    ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡",
    sum: "∑", int: "∫", oint: "∮", partial: "∂", nabla: "∇", infty: "∞",
    degree: "°", permil: "‰", rightarrow: "→", to: "→", leftarrow: "←",
    leftrightarrow: "↔", ldots: "…", dots: "…", cdots: "⋯", angle: "∠",
    prime: "′", circ: "°", oplus: "⊕", propto: "∝", sqrt: "√",
  };

  function matchBrace(s, i) {
    // s[i] === '{' -> index of matching '}'
    var depth = 0;
    for (var j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") { depth--; if (depth === 0) return j; }
    }
    return -1;
  }

  function texInner(s) {
    if (!s) return "";
    var out = "", i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === "\\") {
        var m = /^\\([a-zA-Z]+)\s*/.exec(s.slice(i));
        if (m) {
          var name = m[1];
          if (name === "frac" || name === "dfrac" || name === "tfrac") {
            var p = i + m[0].length;
            if (s[p] === "{") {
              var e1 = matchBrace(s, p);
              if (e1 > 0) {
                var q = e1 + 1;
                while (q < s.length && /\s/.test(s[q])) q++;
                if (s[q] === "{") {
                  var e2 = matchBrace(s, q);
                  if (e2 > 0) {
                    out += '<span class="tex-frac"><span>' + texInner(s.slice(p + 1, e1)) +
                      "</span><span>" + texInner(s.slice(q + 1, e2)) + "</span></span>";
                    i = e2 + 1;
                    continue;
                  }
                }
              }
            }
          }
          if (name === "sqrt") {
            var sp = i + m[0].length;
            if (s[sp] === "{") {
              var se = matchBrace(s, sp);
              if (se > 0) {
                out += '<span class="tex-sqrt"><span>√</span><span>' +
                  texInner(s.slice(sp + 1, se)) + "</span></span>";
                i = se + 1;
                continue;
              }
            }
            out += "√"; i += m[0].length; continue;
          }
          if (name === "left" || name === "right" || name === "displaystyle" ||
              name === "limits" || name === "nolimits" || name === "quad" ||
              name === "qquad" || name === "," || name === ";" || name === "!") {
            i += m[0].length; continue;
          }
          if (GREEK[name]) { out += GREEK[name]; i += m[0].length; continue; }
          if (SYM[name]) { out += SYM[name]; i += m[0].length; continue; }
          if (name === "text" || name === "mathrm" || name === "operatorname") {
            var tp = i + m[0].length;
            if (s[tp] === "{") {
              var te = matchBrace(s, tp);
              if (te > 0) { out += esc(s.slice(tp + 1, te)); i = te + 1; continue; }
            }
          }
          out += " "; i += m[0].length; continue;
        }
        out += " "; i++; continue;
      }
      if (c === "^" || c === "_") {
        var nx = i + 1, body, adv;
        if (s[nx] === "{") {
          var be = matchBrace(s, nx);
          if (be > 0) { body = s.slice(nx + 1, be); adv = be + 1; }
          else { body = ""; adv = nx; }
        } else {
          body = s[nx] || ""; adv = nx + 1;
        }
        var tag = c === "^" ? "tex-sup" : "tex-sub";
        out += "<" + tag + ">" + texInner(body) + "</" + tag + ">";
        i = adv; continue;
      }
      if (c === "{") { var ce = matchBrace(s, i); if (ce > 0) { out += texInner(s.slice(i + 1, ce)); i = ce + 1; continue; } }
      out += c; i++;
    }
    return out;
  }

  function tex(s) {
    try { return texInner(String(s || "")); } catch (e) { return esc(s); }
  }

  /* 工程课程的图示采用本地内联 SVG：不引入大图片、不依赖外网，
     但给概念、章节和课程一个稳定的视觉锚点。它们是示意图，不冒充教材原图。 */
  var SUBJECT_VISUALS = {
    "bridge-engineering": { accent: "#5ac8fa", label: "跨径 / 受力路径", kind: "bridge", outcomes: ["建立桥梁构造与荷载传递的整体框架", "掌握跨径、支座与主要构件的识别方法"] },
    "structural-design-principles": { accent: "#bf8cff", label: "截面 / 应力应变", kind: "section", outcomes: ["把材料性能、截面受力与设计验算串起来", "优先掌握弯、剪、压构件的判别与自检"] },
    "road-survey-design": { accent: "#30d158", label: "平面 / 纵断面 / 横断面", kind: "road", outcomes: ["理解路线几何要素与线形组合", "能从设计指标反推关键控制点"] },
    "traffic-engineering": { accent: "#ff9f0a", label: "速度 / 流量 / 密度", kind: "traffic", outcomes: ["建立交通流三参数的关系图", "用典型题判断拥堵、通行能力与服务水平"] },
    "asphalt-mixture": { accent: "#ff6b6b", label: "级配 / 温度 / 性能", kind: "mix", outcomes: ["理解材料组成与路用性能的联系", "掌握试验指标、级配与质量控制重点"] },
    "hydraulics-hydrology": { accent: "#64d2ff", label: "汇水 / 断面 / 洪峰", kind: "water", outcomes: ["把降雨—产流—汇流与桥涵设计连接起来", "识别断面、水位、流速和流量的核心变量"] },
    "building-architecture": { accent: "#ffd60a", label: "墙体 / 楼板 / 屋面", kind: "building", outcomes: ["从构造层次理解建筑节点", "建立材料、功能与施工顺序的对应关系"] },
    "structural-testing": { accent: "#ff375f", label: "测点 / 仪器 / 试验流程", kind: "testing", outcomes: ["掌握结构试验的布点、加载和数据采集", "能按现象定位常见检测误差"] },
    "engineering-economics": { accent: "#32ade6", label: "现金流 / NPV / 方案", kind: "economics", outcomes: ["看懂现金流量图与时间价值", "用指标比较工程方案的经济性"] },
  };

  function visualFor(sid, compact) {
    var v = SUBJECT_VISUALS[sid] || { accent: "#5ac8fa", label: "知识结构 / 关键关系", kind: "default" };
    var a = v.accent;
    var common = 'fill="none" stroke="currentColor" stroke-width="' + (compact ? "1.7" : "1.5") + '" stroke-linecap="round" stroke-linejoin="round"';
    var art = "";
    if (v.kind === "bridge") art = '<path ' + common + ' d="M18 72h124M30 72V40M130 72V40M30 40c24 24 76 24 100 0M52 52v20M76 58v14M100 52v20"/><path ' + common + ' d="M18 82h124"/>';
    else if (v.kind === "section") art = '<path ' + common + ' d="M24 78h116M38 78V42h86v36M48 42V28h66v14M55 78V58h52v20"/><circle cx="70" cy="52" r="4" fill="currentColor" stroke="none"/><circle cx="100" cy="66" r="4" fill="currentColor" stroke="none"/>';
    else if (v.kind === "road") art = '<path ' + common + ' d="M18 82C44 63 48 34 78 30s34 18 64-12M18 90C48 70 55 42 82 38s32 17 60-11"/><path ' + common + ' d="M42 72h34M86 54h30"/>';
    else if (v.kind === "traffic") art = '<path ' + common + ' d="M22 82h116M30 70l28-25 22 13 38-36M30 70l28-25 22 13"/><circle cx="58" cy="45" r="4" fill="currentColor" stroke="none"/><circle cx="118" cy="22" r="4" fill="currentColor" stroke="none"/>';
    else if (v.kind === "mix") art = '<path ' + common + ' d="M22 82h116M30 70c18-4 27-23 46-18s25 16 50-11M30 58c18-4 27-23 46-18s25 16 50-11"/><path ' + common + ' d="M28 30h18M56 24h24M92 18h30"/>';
    else if (v.kind === "water") art = '<path ' + common + ' d="M18 80h124M22 66c20-15 35 15 55 0s35 15 65-2M22 50c20-15 35 15 55 0s35 15 65-2"/><path ' + common + ' d="M42 25v22M78 20v27M112 28v18"/>';
    else if (v.kind === "building") art = '<path ' + common + ' d="M28 82V34l34-16 34 16v48M62 18v64M96 34l28 12v36M40 50h16M72 50h16M40 66h16M72 66h16"/>';
    else if (v.kind === "testing") art = '<rect x="28" y="28" width="34" height="48" rx="5" ' + common + '/><path ' + common + ' d="M62 52h24l14-20M86 52l14 24M100 32h22v44h-22"/><circle cx="45" cy="52" r="6" ' + common + '/>';
    else if (v.kind === "economics") art = '<path ' + common + ' d="M20 82h120M28 70l20-18 18 9 25-30 28 16"/><path ' + common + ' d="M48 52v30M66 61v21M91 31v51M119 47v35"/>';
    else art = '<circle cx="80" cy="50" r="24" ' + common + '/><path ' + common + ' d="M80 26v48M56 50h48M28 82h104"/>';
    return '<svg viewBox="0 0 160 100" role="img" aria-label="' + esc(v.label) + '" style="color:' + esc(a) + '">' +
      '<path d="M0 82H160M0 18H160" stroke="currentColor" opacity=".11" />' + art + '</svg>';
  }

  function visualMeta(sid) {
    return SUBJECT_VISUALS[sid] || { accent: "#5ac8fa", label: "知识结构 / 关键关系", outcomes: [] };
  }

  /* ---------------- API ---------------- */
  async function api(path) {
    try {
      var r = await fetch(path, { credentials: "same-origin" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  function updateStat() {
    var el = $("kbStat");
    if (!el) return;
    api("/api/kb/stats").then(function (d) {
      if (d && d.ok) el.textContent = d.docs + " 条知识条目 · " + S.subjects.length + " 门课";
    });
  }

  async function loadSubjects() {
    var d = await api("/api/kb/subjects");
    if (!d || !d.ok) return false;
    S.subjects = d.items || [];
    return true;
  }

  async function loadOutline(sid) {
    var request = ++S.requestSeq;
    if (S.cache[sid] && S.cache[sid]._outline) return S.cache[sid]._outline;
    var d = await api("/api/kb/outline?subject=" + encodeURIComponent(sid));
    if (request !== S.requestSeq || sid !== S.current) return null;
    if (!d || !d.ok) return null;
    S.cache[sid] = S.cache[sid] || {};
    S.cache[sid]._outline = d.syllabus;
    return d.syllabus;
  }

  async function loadKind(sid, kind) {
    S.cache[sid] = S.cache[sid] || {};
    if (S.cache[sid][kind]) return S.cache[sid][kind];
    var d = await api("/api/kb/search?q=&subject=" + encodeURIComponent(sid));
    return null;
  }

  /* ---------------- 渲染：课程列表 ---------------- */
  function renderSubjects() {
    var box = $("kbSubjectList");
    if (!box) return;
    if (!S.subjects.length) {
      box.innerHTML = '<div class="kb-empty">课程知识库不可用<br>请确认服务已启动</div>';
      return;
    }
    box.innerHTML = S.subjects.map(function (s) {
      var c = s.counts || {};
      var total = (c.concept || 0) + (c.formula || 0) + (c.exercise || 0);
      var vm = visualMeta(s.id);
      return '<button class="kb-subj' + (s.id === S.current ? " active" : "") + '" data-sid="' +
        esc(s.id) + '" style="--kb-accent:' + esc(vm.accent) + '"><span class="kb-subj-thumb">' +
        visualFor(s.id, true) + '</span><span><b>' + esc(s.name) + "</b><span>" + esc(s.publisher || "") + " · " +
        esc(s.edition || "") + "<br>" + (c.concept || 0) + " 概念 · " + (c.formula || 0) +
        " 公式 · " + (c.exercise || 0) + " 题" + (s.hasSource ? " · 已导入教材" : "") +
        "</span></span></button>";
    }).join("");
  }

  function renderHead() {
    var s = S.subjects.filter(function (x) { return x.id === S.current; })[0];
    var h = $("kbHead");
    if (!h) return;
    if (!s) { h.innerHTML = '<h3>专业课程库</h3>'; return; }
    var c = s.counts || {};
    var vm = visualMeta(s.id);
    h.innerHTML = '<section class="kb-course-hero" style="--kb-accent:' + esc(vm.accent) + '">' +
      '<div class="kb-course-hero-copy"><div class="kb-course-kicker"><span>' + esc(s.publisher || "专业课程") +
      '</span><span>·</span><span>' + esc(s.edition || "结构化学习库") + '</span></div>' +
      '<h3>' + esc(s.name) + '</h3><div class="kb-course-kicker"><span>' + esc(vm.label) +
      '</span><span>·</span><span>' + (s.hasSource ? "已导入授权教材" : "示意知识库，来源需核对") + '</span></div>' +
      '<div class="kb-course-stats"><span class="kb-course-stat"><b>' + (s.chapters || 0) + '</b><span>章节</span></span>' +
      '<span class="kb-course-stat"><b>' + (c.concept || 0) + '</b><span>概念</span></span>' +
      '<span class="kb-course-stat"><b>' + (c.formula || 0) + '</b><span>公式</span></span>' +
      '<span class="kb-course-stat"><b>' + (c.exercise || 0) + '</b><span>题型</span></span></div>' +
      (vm.outcomes && vm.outcomes.length ? '<ul class="kb-course-outcomes">' + vm.outcomes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>' : '') +
      '</div><div class="kb-course-visual">' + visualFor(s.id, false) + '<div class="kb-visual-caption">本地图示：用于建立概念关系，不替代教材原图</div></div></section>';
  }

  /* ---------------- 渲染：章节地图 ---------------- */
  function renderOutline(syl) {
    var p = $("kbPanel");
    if (!p) return;
    if (!syl || !syl.chapters) { p.innerHTML = '<div class="kb-empty">暂无章节数据</div>'; return; }
    var html = "";
    if (syl.outlineBasis) {
      html += '<div class="kb-note">目录依据：' + esc(syl.outlineBasis) + "</div>";
    }
    html += '<div class="kb-chapter-grid">' + syl.chapters.map(function (ch) {
      var secs = (ch.sections || []).map(function (sec) {
        var kp = (sec.keypoints || []).map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("");
        return '<div class="kb-sec"><h5>' + esc(sec.no || "") + " " + esc(sec.title || "") + "</h5>" +
          (kp ? "<ul>" + kp + "</ul>" : "") +
          (sec.homeworkFocus ? '<p><b>作业重点：</b>' + esc(sec.homeworkFocus) + "</p>" : "") +
          (sec.practice ? '<p><b>实践环节：</b>' + esc(sec.practice) + "</p>" : "") + "</div>";
      }).join("");
      return '<details class="kb-chapter-card"' + (String(ch.no) === "1" ? " open" : "") + "><summary>第" +
        esc(ch.no || "") + "章 " + esc(ch.title || "") +
        "</summary>" + (ch.summary ? '<div class="kb-chapter-meta">' + esc(ch.summary) + "</div>" : "") +
        '<div class="kb-sec">' + secs + "</div></details>";
    }).join("") + '</div>';
    p.innerHTML = html;
  }

  /* ---------------- 渲染：条目列表 ---------------- */
  /* ---------------- 轻量 Markdown：教练要求表格 / 公式 / 分点，必须真渲染 ---------------- */
  function mdInline(s) {
    var codes = [];
    s = String(s == null ? "" : s).replace(/`([^`]+)`/g, function (m, c) {
      codes.push(c); return "\u0001" + (codes.length - 1) + "\u0001";
    });
    s = esc(s);
    s = s.replace(/\$\$([^$]+)\$\$/g, function (m, t) { return '<span class="tex-block">' + tex(t) + "</span>"; });
    s = s.replace(/\$([^$\n]+)\$/g, function (m, t) { return '<span class="tex">' + tex(t) + "</span>"; });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\u0001(\d+)\u0001/g, function (m, i) { return "<code>" + esc(codes[+i]) + "</code>"; });
    return s;
  }

  function mdRender(src) {
    var lines = String(src == null ? "" : src).split("\n");
    var html = "", i = 0;
    var inCode = false, codeBuf = [];
    function flushList(buf, tag) {
      if (!buf.length) return "";
      return "<" + tag + ">" + buf.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") +
        "</" + tag + ">";
    }
    while (i < lines.length) {
      var ln = lines[i];
      if (/^\s*```/.test(ln)) {
        if (inCode) {
          html += '<pre class="kb-code">' + esc(codeBuf.join("\n")) + "</pre>";
          codeBuf = []; inCode = false;
        } else { inCode = true; }
        i++; continue;
      }
      if (inCode) { codeBuf.push(ln); i++; continue; }

      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        var head = ln.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
        i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(lines[i].replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|"));
          i++;
        }
        html += "<table class='kb-table'><thead><tr>" +
          head.map(function (c) { return "<th>" + mdInline(c.trim()) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          rows.map(function (r) {
            return "<tr>" + r.map(function (c) { return "<td>" + mdInline(c.trim()) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table>";
        continue;
      }

      var h = /^(#{1,4})\s+(.*)$/.exec(ln);
      if (h) {
        var lv = Math.min(4, h[1].length + 2);
        html += "<h" + lv + " class='kb-h'>" + mdInline(h[2]) + "</h" + lv + ">";
        i++; continue;
      }

      if (/^\s*[-*]\s+/.test(ln)) {
        var buf = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
        html += flushList(buf, "ul"); continue;
      }
      if (/^\s*\d+[.)]\s+/.test(ln)) {
        var buf2 = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          buf2.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++;
        }
        html += flushList(buf2, "ol"); continue;
      }
      if (/^\s*(---|===|___)\s*$/.test(ln)) { html += "<hr class='kb-hr'>"; i++; continue; }
      if (!ln.trim()) { i++; continue; }

      var para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*([-*]\s|\d+[.)]\s|#{1,4}\s|\||```)/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      if (para.length) html += "<p>" + mdInline(para.join(" ")) + "</p>";
    }
    if (inCode && codeBuf.length) html += '<pre class="kb-code">' + esc(codeBuf.join("\n")) + "</pre>";
    return html || '<span class="kb-loading">（没有内容）</span>';
  }

  /* ---------------- 图示：本地 SVG，不依赖外网 ---------------- */
  function figureHtml(fig) {
    if (!fig || !fig.src) return "";
    var pts = (fig.readPoints || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    return '<figure class="kb-fig">' +
      '<img src="' + esc(fig.src) + '" alt="' + esc(fig.caption || "示意图") + '" loading="lazy">' +
      (fig.caption ? '<figcaption>' + esc(fig.caption) + "</figcaption>" : "") +
      (pts ? '<details class="kb-read"><summary>读图要点</summary><ul>' + pts + "</ul></details>" : "") +
      "</figure>";
  }

  /* ---------------- 公式试算：expr 是可计算的 ASCII 表达式 ---------------- */
  function tryEval(expr, values) {
    var e = String(expr || "").split("=").pop();
    if (!e.trim()) return null;
    Object.keys(values).forEach(function (k) {
      e = e.replace(new RegExp("\\b" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g"),
        "(" + values[k] + ")");
    });
    if (/[a-zA-Z_]\w*/.test(e.replace(/\b(Math|PI|E|sqrt|abs|pow|log|sin|cos|tan|exp|min|max)\b/g, ""))) {
      return null;   // 还有未代入的符号，不硬算
    }
    try {
      return Function('"use strict";var Math=Math;return (' + e + ")")();
    } catch (err) {
      return null;
    }
  }

  function calcHtml(raw) {
    if (!raw || !raw.expr || !raw.vars || !raw.vars.length) return "";
    var inputs = raw.vars.map(function (v) {
      var sym = v.sym || "";
      return '<label class="kb-calc-f"><span>' + tex(sym) +
        '<i>' + esc(v.unit || "") + "</i></span>" +
        '<input type="number" step="any" data-sym="' + esc(sym) + '" placeholder="' + esc(v.name || sym) + '">' +
        "</label>";
    }).join("");
    return '<div class="kb-calc" data-expr="' + esc(raw.expr) + '">' +
      '<button type="button" class="kb-calc-toggle">代入数值试算</button>' +
      '<div class="kb-calc-body" hidden><div class="kb-calc-grid">' + inputs + "</div>" +
      '<div class="kb-calc-bar"><button type="button" class="kb-calc-run">计算</button>' +
      '<button type="button" class="kb-calc-clear">清空</button></div>' +
      '<div class="kb-calc-out"></div></div></div>';
  }

  /* 卡片上的「就这个问 AI」：把条目身份翻译成一句可直接发送的问题，
     省掉"我还要在文本框里把书名打一遍"这一步。 */
  var ASK_MAP = {};
  function askQuestionFor(it, head) {
    var ch = it.chapter ? "（第" + it.chapter + "章）" : "";
    switch (it.kind) {
      case "concept":
        return head + " 是什么？先给一个生活类比，再讲定义、易错点，最后出一道自测题考我。" + ch;
      case "formula":
        return "怎么用这个公式：" + head + "？请给每个符号的含义与单位、适用条件、一个完整算例和量纲检查。";
      case "exercise":
        return "这道题怎么做：" + head + "？先给思路和关键公式，先不要直接给最终答案。";
      case "standard":
        return head + " 这条规范什么时候必须查？查的时候最容易踩什么坑？";
      case "book":
        return "《" + head + "》这本书该怎么用？它对应课程哪几章？给我一个读书顺序和重点。";
      default:
        return "讲一下：" + head + "。" + ch;
    }
  }

  function renderItems(items) {
    var p = $("kbPanel");
    if (!p) return;
    if (!items || !items.length) { p.innerHTML = '<div class="kb-empty">这一类还没有内容</div>'; return; }
    p.innerHTML = '<div class="kb-list">' + items.map(function (it) {
      var raw = it.raw || {};
      var head = it.title || raw.term || raw.name || "";
      var chap = it.chapter ? "第" + esc(it.chapter) + "章" : "";
      var conf = it.confidence === "high" ? '<span class="kb-chip ok">已核实</span>'
        : it.confidence === "low" ? '<span class="kb-chip warn">待核对</span>'
          : '<span class="kb-chip">通用知识</span>';
      var body = "";

      if (it.kind === "formula") {
        body = '<div class="kb-formula">' + tex(raw.latex || raw.expr || "") + "</div>";
        if (raw.vars && raw.vars.length) {
          body += '<div class="kb-vars">' + raw.vars.map(function (v) {
            return '<div class="kb-var"><b>' + tex(v.sym || "") + "</b> " + esc(v.name || "") +
              (v.unit ? " <span class='kb-meta'>(" + esc(v.unit) + ")</span>" : "") +
              (v.note ? "<br>" + esc(v.note) : "") + "</div>";
          }).join("") + "</div>";
        }
        if (raw.conditions && raw.conditions.length) {
          body += "<ul>" + raw.conditions.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>";
        }
        if (raw.pitfalls && raw.pitfalls.length) {
          body += '<div class="kb-note"><b>易错：</b>' + esc(raw.pitfalls.join("；")) + "</div>";
        }
        body += calcHtml(raw);
      } else if (it.kind === "concept") {
        body = "<p>" + esc(raw.definition || "") + "</p>";
        if (raw.pitfalls && raw.pitfalls.length) {
          body += '<div class="kb-note"><b>易混：</b>' + esc(raw.pitfalls.join("；")) + "</div>";
        }
        if (raw.relations && raw.relations.length) {
          body += '<div class="kb-rels">相关：' + raw.relations.map(function (r) {
            return '<button type="button" class="kb-rel" data-q="' + esc(r) + '">' + esc(r) + "</button>";
          }).join("") + "</div>";
        }
      } else if (it.kind === "exercise") {
        body = "<p>" + esc(raw.stem || "") + "</p>";
        if (raw.approachSteps && raw.approachSteps.length) {
          body += "<ul>" + raw.approachSteps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>";
        }
        if (raw.commonErrors && raw.commonErrors.length) {
          body += '<div class="kb-note"><b>常见错误：</b>' + esc(raw.commonErrors.join("；")) + "</div>";
        }
        if (raw.answer) {
          body += '<div class="kb-note"><b>参考结果：</b>' + esc(raw.answer) + "</div>";
        }
      } else if (it.kind === "standard") {
        body = "<p>" + esc(raw.appliesTo ? raw.appliesTo.join("、") : "") + "</p>";
        if (raw.notes) body += '<div class="kb-note">' + esc(raw.notes) + "</div>";
      } else if (it.kind === "book") {
        body = "<p>" + esc(raw.why || "") + "</p>";
        if (raw.readPlan) body += '<div class="kb-note"><b>怎么读：</b>' + esc(raw.readPlan) + "</div>";
        if (raw.author) body += '<div class="kb-note">' + esc(raw.author) + " · " + esc(raw.publisher || "") + "</div>";
      } else {
        body = "<p>" + esc(it.display || "") + "</p>";
      }

      if (raw.verify) {
        body += '<div class="kb-note"><span class="kb-chip warn">需核对</span>' + esc(raw.verify) + "</div>";
      }
      if (raw.standardRef && raw.standardRef.length) {
        body += '<div class="kb-note">规范：' + esc(raw.standardRef.join("、")) + "</div>";
      }

      var accent = visualMeta(S.current).accent;
      var askq = askQuestionFor(it, head);
      if (it.id) ASK_MAP[it.id] = askq;
      var askBtn = it.id
        ? '<button type="button" class="kb-askitem" data-askid="' + esc(it.id) + '">就这个问 AI</button>'
        : "";
      return '<div class="kb-item" style="--kb-accent:' + esc(accent) + '"><h4>' + esc(head) + "</h4>" +
        '<div class="kb-chap">' + chap + " · " + (KIND_LABEL[it.kind] || it.kind) + " " + conf + "</div>" +
        figureHtml(raw.figure) + body + askBtn + "</div>";
    }).join("") + "</div>";
  }

  /* ---------------- 检索 ---------------- */
  async function loadKindItems(kind) {
    var p = $("kbPanel");
    if (!S.current) return;
    var sid = S.current;
    var request = ++S.requestSeq;
    if (p) p.innerHTML = '<div class="kb-loading">加载中…</div>';
    // 直出该课程该类型的全部条目（不走检索，避免用英文 subjectId 当查询词导致失真）
    var d = await api("/api/kb/list?subject=" + encodeURIComponent(sid) +
      "&kind=" + encodeURIComponent(kind));
    if (request !== S.requestSeq || sid !== S.current || S.tab !== kind) return;
    if (!d || !d.ok) { if (p) p.innerHTML = '<div class="kb-empty">加载失败</div>'; return; }
    renderItems(d.items || []);
  }

  async function doSearch() {
    var input = $("kbSearchInput");
    var p = $("kbPanel");
    var q = (input && input.value || "").trim();
    if (!q) return;
    var sid = S.current;
    var request = ++S.requestSeq;
    if (p) p.innerHTML = '<div class="kb-loading">检索中…</div>';
    var d = await api("/api/kb/search?q=" + encodeURIComponent(q) +
      "&subject=" + encodeURIComponent(sid || "") + "&top=20");
    if (request !== S.requestSeq || sid !== S.current) return;
    if (!d || !d.ok) { if (p) p.innerHTML = '<div class="kb-empty">检索失败</div>'; return; }
    S.searchHits = d.items || [];
    if (!S.searchHits.length) {
      if (p) p.innerHTML = '<div class="kb-empty">知识库里没有匹配的内容<br>可以换个说法，或直接去「问这门课」</div>';
      return;
    }
    renderItems(S.searchHits);
  }

  /* ---------------- 课程教练：线程化对话 ---------------- */
  var FOLLOW = [
    { k: "more", n: "讲细一点" },
    { k: "answer", n: "给最终答案" },
    { k: "quiz", n: "出 3 道题考我" },
    { k: "example", n: "换个类比" },
    { k: "reset", n: "换个话题" },
  ];
  var FOLLOW_TEXT = {
    more: "把刚才讲的内容再讲细一点，多给一个生活类比和一个易错点。",
    answer: "好，直接给我最终答案和关键数值，并附上量纲检查。",
    quiz: "围绕刚才讲的内容出 3 道自测题，只给题目、不给答案，我做完再问你。",
    example: "换一个更贴近生活的类比重讲一遍，并说明这个类比在哪一点上会失效。",
  };

  function currentBook() {
    if (!S.scope.bookId) return null;
    return S.books.filter(function (b) { return b.id === S.scope.bookId; })[0] || null;
  }

  /* 指定教材 / 限定章节：知识库本身没有按书标记条目，所以这里做的是
     「口径声明 + 把这本书的信息喂给 AI」，而不是假装做了按书过滤。 */
  function scopeBlock() {
    var b = currentBook(), parts = [];
    if (b) {
      var meta = [b.author, b.edition, b.publisher].filter(Boolean).join(" · ");
      parts.push("【指定教材】《" + b.title + "》" + (meta ? "（" + meta + "）" : "") +
        (b.isbn ? " ISBN " + b.isbn : "") +
        (b.readPlan ? "\n这本书怎么用：" + b.readPlan : "") +
        "\n请优先按这本书的口径回答；知识库里没有该书原文依据时，明说需要我对着书核对，不要编造。");
    }
    var ch = (S.scope.chapter || "").trim();
    if (ch) parts.push("【限定范围】第 " + ch + " 章");
    return parts.length ? parts.join("\n") : "";
  }

  function citesHtml(cites) {
    if (!cites || !cites.length) return "";
    return '<details class="kb-cites"><summary>引用来源（' + cites.length + "）</summary>" +
      cites.map(function (c) {
        return '<div class="kb-cite">[<b>' + c.n + "</b>] " + esc(c.subjectName) + " 第" +
          esc(c.chapter || "—") + "章 · " + esc(c.locator) + " · " +
          (KIND_LABEL[c.kind] || c.kind) +
          (c.confidence && c.confidence !== "high" ? " · 待核对" : "") + "</div>";
      }).join("") + "</details>";
  }

  function turnHtml(t) {
    var quote = t.quote
      ? '<div class="kb-turn-quote">就这段追问：' +
        esc(t.quote.length > 120 ? t.quote.slice(0, 120) + "…" : t.quote) + "</div>"
      : "";
    var body = t.loading
      ? '<div class="kb-loading">正在检索知识库并向 AI 提问…</div>'
      : '<div class="kb-md">' + mdRender(t.a) + "</div>";
    var acts = t.loading ? "" : '<div class="kb-follow">' +
      FOLLOW.map(function (f) {
        return '<button type="button" class="kb-tab kb-follow-btn" data-f="' + f.k + '">' + f.n + "</button>";
      }).join("") + "</div>";
    var fb = (t.cites && t.cites.length && !t.loading)
      ? '<div class="kb-fb"><span class="kb-fb-t">这次讲得怎么样：</span>' +
        '<button type="button" class="kb-tab kb-fb-btn" data-k="up">有用</button>' +
        '<button type="button" class="kb-tab kb-fb-btn" data-k="down">没用</button>' +
        '<button type="button" class="kb-tab kb-fb-btn" data-k="wrong">讲错了</button>' +
        '<span class="kb-fb-note"></span></div>'
      : "";
    return '<div class="kb-turn" data-turn="' + esc(t.id) + '">' +
      '<div class="kb-q"><span class="kb-who">问</span><div>' + esc(t.q) + quote + "</div></div>" +
      '<div class="kb-a"><span class="kb-who kb-who-a">教练</span>' +
      body + acts + fb + citesHtml(t.cites) + "</div></div>";
  }

  /* 给每个小节标题挂「追问本节」：不用自己打字，也不用重新生成整篇 */
  function decorateSections(box) {
    var hs = box.querySelectorAll(".kb-md .kb-h");
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].querySelector(".kb-sec-ask")) continue;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kb-sec-ask";
      b.textContent = "追问本节";
      hs[i].appendChild(b);
    }
  }

  function sectionText(container, idx) {
    var hs = container.querySelectorAll(".kb-h");
    var h = hs[idx];
    if (!h) return "";
    var out = [], n = h.nextElementSibling;
    while (n && n.classList && !n.classList.contains("kb-h")) {
      out.push(n.textContent || "");
      n = n.nextElementSibling;
    }
    return out.join("\n").replace(/\s+\n/g, "\n").trim().slice(0, 800);
  }

  function renderThread() {
    var box = $("kbThread");
    if (!box) return;
    if (!S.thread.length) {
      box.innerHTML = '<div class="kb-thread-empty">选一门课，直接问。' +
        "回答会带引用来源；页码未解析时会明说，不会编造页码或条文。</div>";
      return;
    }
    box.innerHTML = S.thread.map(turnHtml).join("");
    decorateSections(box);
    box.scrollTop = box.scrollHeight;
  }

  function setQuote(t) {
    S.quote = t || "";
    var box = $("kbQuote"), tx = $("kbQuoteText");
    if (!box) return;
    if (!S.quote) { box.hidden = true; return; }
    box.hidden = false;
    if (tx) tx.textContent = S.quote.length > 90 ? S.quote.slice(0, 90) + "…" : S.quote;
  }

  function turnOf(el) {
    var wrap = el && el.closest ? el.closest(".kb-turn") : null;
    if (!wrap) return null;
    var id = wrap.getAttribute("data-turn");
    return S.thread.filter(function (x) { return x.id === id; })[0] || null;
  }

  async function doAsk(mode, preset) {
    var ta = $("kbAskInput");
    var q = String(preset == null ? (ta && ta.value || "") : preset).trim();
    if (!q) return;
    if (S.asking) return;

    var quoted = S.quote;
    var turn = {
      id: "t" + (++S.turnSeq), q: q, quote: quoted, a: "", cites: [],
      mode: mode || "", loading: true, ts: Date.now(),
    };
    S.thread.push(turn);
    renderThread();
    setQuote("");
    if (ta) ta.value = "";
    S.asking = true;

    var prefix = "";
    if (mode === "preview") prefix = "我要预习，请按「知识地图 → 逐点讲解（带生活类比）→ 自测题 → 作业预警」来讲：";
    else if (mode === "homework") prefix = "这是一道作业题，请按「思路 → 关键公式与假设 → 分步计算 → 自检清单」讲解，先不要直接给最终答案：";
    else if (mode === "review") prefix = "我要复习，请给出本章优先级、高频题型和易错点，并用典型题抽测我：";
    else if (mode === "organize") prefix = "请把这部分整理成笔记，按「概念 / 公式 / 题型 / 易错」四类归档，每条标注章节：";
    var full = prefix ? prefix + q : q;

    // 章节：优先用范围里填的；没填就从问题里感知「第 6 章 / 6.3 节」
    var chap = (S.scope.chapter || "").trim();
    if (!chap) {
      var mc = /(?:第)?\s*(\d+(?:\.\d+)?)\s*(?:章|节)/.exec(q);
      if (mc) chap = mc[1];
    }
    // 检索用原始问题（+ 选中的原文），模式前缀只影响生成，不污染检索
    var rq = quoted ? (quoted.slice(0, 200) + " " + q) : q;
    var url = "/api/kb/context?q=" + encodeURIComponent(rq) +
      "&subject=" + encodeURIComponent(S.current || "") + "&top=8" +
      (chap ? "&chapter=" + encodeURIComponent(chap) : "");
    var d = await api(url);

    if (!d || !d.ok) {
      turn.a = "知识库服务不可用，请确认平台服务在运行。";
      turn.loading = false;
      renderThread();
      S.asking = false;
      return;
    }

    var sys = d.prompt || "你是专业课程教练，回答必须标注来源，不能编造页码。";
    var user = "【我的问题】" + full +
      (quoted ? "\n\n【我从你的回答里选中的这段】\n> " + quoted : "") +
      (chap ? "\n（已限定在第 " + chap + " 章范围内检索证据）" : "") +
      scopeBlock() +
      "\n\n【知识库证据】\n" +
      (d.hasEvidence ? d.context : "（本次未在知识库中检索到证据）") +
      "\n\n【证据使用规则】\n" + (d.notice || "");

    var reply = "";
    try {
      if (typeof AI === "undefined" || !AI.isConfigured || !AI.isConfigured()) {
        reply = "（AI 未配置密钥，暂不能生成讲解。以下为知识库检索到的原文证据）\n\n" +
          (d.hasEvidence ? d.context : "未检索到证据。");
      } else {
        var msgs = [{ role: "system", content: sys }];
        // 多轮：带上最近 3 轮问答，追问"那第 3 章呢""还是不懂"时才有上下文
        S.history.slice(-3).forEach(function (h) {
          msgs.push({ role: "user", content: h.q });
          msgs.push({ role: "assistant", content: h.a });
        });
        msgs.push({ role: "user", content: user });
        reply = await AI.chat(msgs, { temperature: 0.3 });
        S.history.push({ q: full + (quoted ? "（引用：" + quoted + "）" : ""), a: reply });
        if (S.history.length > 6) S.history.shift();
      }
    } catch (e) {
      reply = "AI 调用失败：" + (e && e.message ? e.message : e) +
        "\n\n以下是知识库检索到的证据，你可以先自行查看：\n\n" + (d.context || "");
    }

    turn.a = reply;
    turn.cites = d.citations || [];
    turn.loading = false;
    S.lastCites = turn.cites;
    renderThread();
    S.asking = false;
  }

  /* ---------------- tab 切换 ---------------- */
  var TABS = [
    { k: "outline", n: "章节地图" },
    { k: "concept", n: "概念" },
    { k: "formula", n: "公式" },
    { k: "exercise", n: "题型" },
    { k: "standard", n: "规范" },
    { k: "reference", n: "文献" },
    { k: "book", n: "参考书" },
  ];

  function renderTabs() {
    var box = $("kbTabs");
    if (!box) return;
    box.innerHTML = TABS.map(function (t) {
      return '<button class="kb-tab' + (S.tab === t.k ? " active" : "") + '" data-tab="' +
        t.k + '">' + t.n + "</button>";
    }).join("");
  }

  async function switchTab(k) {
    S.tab = k;
    renderTabs();
    if (k === "outline") {
      var syl = await loadOutline(S.current);
      renderOutline(syl);
    } else {
      await loadKindItems(k);
    }
  }

  /* ---------------- 划选追问：选中回答里的任意一段，就地追问 ---------------- */
  var selBtn = null;
  function ensureSelBtn() {
    if (selBtn) return selBtn;
    var host = $("kbCoach");
    if (!host) return null;
    selBtn = document.createElement("button");
    selBtn.type = "button";
    selBtn.className = "kb-selask";
    selBtn.textContent = "就这段追问";
    selBtn.hidden = true;
    selBtn.addEventListener("click", function () {
      if (!S._sel) return;
      setQuote(S._sel);
      hideSel();
      var ta = $("kbAskInput");
      if (ta) ta.focus();
    });
    host.appendChild(selBtn);
    return selBtn;
  }
  function hideSel() { if (selBtn) selBtn.hidden = true; }
  function scheduleSel() {
    setTimeout(function () {
      var b = ensureSelBtn();
      var host = $("kbCoach");
      if (!b || !host) return;
      var sel = window.getSelection && window.getSelection();
      var txt = sel ? String(sel).trim() : "";
      if (!txt || txt.length < 6) { hideSel(); S._sel = ""; return; }
      try {
        var r = sel.getRangeAt(0).getBoundingClientRect();
        var hr = host.getBoundingClientRect();
        if (!r.width && !r.height) { hideSel(); return; }
        S._sel = txt.slice(0, 600);
        b.hidden = false;
        var left = r.left - hr.left + r.width / 2 - 48;
        b.style.left = Math.max(8, Math.min(hr.width - 108, left)) + "px";
        b.style.top = Math.max(4, r.top - hr.top - 32) + "px";
      } catch (err) { hideSel(); }
    }, 10);
  }

  /* ---------------- 提问范围 ---------------- */
  function setScopeBook(id) {
    S.scope.bookId = id || "";
    var sel = $("kbScopeBook");
    if (sel) sel.value = S.scope.bookId;
  }

  async function loadBooks(sid) {
    var d = await api("/api/kb/list?subject=" + encodeURIComponent(sid) + "&kind=book");
    S.books = (d && d.ok && d.items) ? d.items : [];
    var sel = $("kbScopeBook");
    if (!sel) return;
    sel.innerHTML = '<option value="">全部教材（不限）</option>' + S.books.map(function (b) {
      var t = (b.title || "") + (b.author ? " · " + b.author : "") + (b.edition ? " " + b.edition : "");
      return '<option value="' + esc(b.id) + '">' + esc(t) + "</option>";
    }).join("");
    sel.value = S.scope.bookId || "";
  }

  /* ---------------- 初始化 ---------------- */
  function bind() {
    var list = $("kbSubjectList");
    if (list) {
      list.addEventListener("click", async function (e) {
        var b = e.target.closest ? e.target.closest(".kb-subj") : null;
        if (!b) return;
        var prev = S.current;
        S.current = b.getAttribute("data-sid") || "";
        if (prev !== S.current) {
          S.scope.bookId = "";
          var chIn2 = $("kbScopeChapter");
          S.scope.chapter = chIn2 ? chIn2.value || "" : "";
          var subjLab = $("kbCoachSubj");
          var s = S.subjects.filter(function (x) { return x.id === S.current; })[0];
          if (subjLab) subjLab.textContent = s ? " · " + s.name : "";
          loadBooks(S.current);
        }
        renderSubjects();
        renderHead();
        await switchTab(S.tab);
      });
    }
    var tabs = $("kbTabs");
    if (tabs) {
      tabs.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest(".kb-tab") : null;
        if (!b) return;
        switchTab(b.getAttribute("data-tab"));
      });
    }
    var btn = $("kbSearchBtn");
    if (btn) btn.addEventListener("click", doSearch);
    var input = $("kbSearchInput");
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });

    var askBtn = $("kbAskBtn");
    if (askBtn) askBtn.addEventListener("click", function () { doAsk(""); });
    var modes = $("kbModes");
    if (modes) {
      modes.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest(".kb-mode") : null;
        if (!b) return;
        doAsk(b.getAttribute("data-mode"));
      });
    }

    /* 输入框快捷键：Enter 发送 / Shift+Enter 换行 / ↑ 调回上一条 / Esc 清空 */
    var kbTa = $("kbAskInput");
    if (kbTa) {
      kbTa.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAsk(""); }
        else if (e.key === "Enter" && e.shiftKey) { /* 换行，交给浏览器 */ }
        else if (e.key === "ArrowUp" && !kbTa.value.trim()) {
          var last = S.thread.length ? S.thread[S.thread.length - 1] : null;
          if (last) { e.preventDefault(); kbTa.value = last.q; }
        } else if (e.key === "Escape") { kbTa.value = ""; setQuote(""); }
      });
    }

    /* 提问范围：指定教材 + 限定章节 */
    var sel = $("kbScopeBook");
    if (sel) sel.addEventListener("change", function () {
      S.scope.bookId = sel.value || "";
    });
    var chIn = $("kbScopeChapter");
    if (chIn) chIn.addEventListener("input", function () {
      S.scope.chapter = chIn.value || "";
    });

    var qc = $("kbQuoteClear");
    if (qc) qc.addEventListener("click", function () { setQuote(""); });

    var focusBtn = $("kbCoachFocus");
    if (focusBtn) focusBtn.addEventListener("click", function () {
      var w = $("kbWrap");
      if (!w) return;
      S.focused = !S.focused;
      w.classList.toggle("focused", S.focused);
      focusBtn.textContent = S.focused ? "退出专注" : "专注";
    });
    var newBtn = $("kbCoachNew");
    if (newBtn) newBtn.addEventListener("click", function () {
      S.thread = []; S.history = []; renderThread();
    });

    /* 线程上的三类点击：追问动作条 / 小节追问 / 反馈；以及划选追问浮标 */
    var thread = $("kbThread");
    if (thread) {
      thread.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        // 小节追问：把这一节的正文作为引用，问题框自动填好开头
        var secBtn = t.closest(".kb-sec-ask");
        if (secBtn) {
          var h = secBtn.parentNode;
          var host = h && h.parentNode ? h.parentNode : null;
          if (!host) return;
          var hs = host.querySelectorAll(".kb-h");
          var idx = Array.prototype.indexOf.call(hs, h);
          var title = (h.textContent || "").replace("追问本节", "").trim();
          var txt = sectionText(host, idx);
          if (txt) setQuote(txt);
          var ta2 = $("kbAskInput");
          if (ta2) { ta2.value = "关于「" + title + "」这一节，"; ta2.focus(); }
          return;
        }

        var fb = t.closest(".kb-fb-btn");
        if (fb) {
          var k = fb.getAttribute("data-k");
          var turn = turnOf(fb);
          var ids = ((turn && turn.cites) || []).map(function (c) { return c.id; })
            .filter(function (x) { return !!x; }).join(",");
          if (!ids) return;
          var note = fb.parentNode ? fb.parentNode.querySelector(".kb-fb-note") : null;
          api("/api/kb/feedback?id=" + encodeURIComponent(ids) + "&kind=" + encodeURIComponent(k) +
            "&q=" + encodeURIComponent((turn && turn.q) || "")).then(function (r) {
              if (note) {
                note.textContent = (r && r.ok)
                  ? (k === "up" ? "记下了，这类条目以后优先给你。" :
                    k === "down" ? "记下了，以后少给你这类。" :
                      "已标记，这条会被降权并列入待修订清单。")
                  : "记录失败";
              }
            }).catch(function () { if (note) note.textContent = "记录失败"; });
          return;
        }

        var fb2 = t.closest(".kb-follow-btn");
        if (fb2) {
          var f = fb2.getAttribute("data-f");
          if (f === "reset") { S.thread = []; S.history = []; renderThread(); return; }
          doAsk("", FOLLOW_TEXT[f] || "");
        }
      });

      thread.addEventListener("mouseup", function () { scheduleSel(); });
      thread.addEventListener("scroll", function () { hideSel(); });
    }

    // 面板内的交互：公式试算 / 相关概念跳转 / 图片点开看大图
    var panel = $("kbPanel");
    if (panel) {
      panel.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.closest) return;

        var rel = t.closest(".kb-rel");
        if (rel) {
          var q = rel.getAttribute("data-q") || "";
          var si = $("kbSearchInput");
          if (si) { si.value = q; doSearch(); }
          return;
        }

        // 「就这个问 AI」：卡片直达教练，参考书卡片顺手把它设为提问范围
        var askItem = t.closest(".kb-askitem");
        if (askItem) {
          var aid = askItem.getAttribute("data-askid") || "";
          var aq = ASK_MAP[aid] || "";
          if (!aq) return;
          if (aid.indexOf("-book-") > 0) setScopeBook(aid);
          doAsk("", aq);
          var box = $("kbThread");
          if (box && box.scrollIntoView) box.scrollIntoView({ block: "nearest" });
          return;
        }

        var fig = t.closest(".kb-fig");
        if (fig && t.tagName === "IMG") { fig.classList.toggle("zoom"); return; }

        var box = t.closest(".kb-calc");
        if (box) {
          if (t.classList.contains("kb-calc-toggle")) {
            var b = box.querySelector(".kb-calc-body");
            if (b) { b.hidden = !b.hidden; t.textContent = b.hidden ? "代入数值试算" : "收起试算"; }
            return;
          }
          if (t.classList.contains("kb-calc-run")) {
            var vals = {};
            var ins = box.querySelectorAll("input[data-sym]");
            for (var i = 0; i < ins.length; i++) {
              var sym = ins[i].getAttribute("data-sym");
              var v = (ins[i].value || "").trim();
              if (v === "") { vals = null; break; }
              if (!isFinite(parseFloat(v))) { vals = null; break; }
              vals[sym] = v;
            }
            var out = box.querySelector(".kb-calc-out");
            if (!vals) { if (out) out.innerHTML = '<span class="kb-calc-err">请把每个符号都填成数字。</span>'; return; }
            var r = tryEval(box.getAttribute("data-expr"), vals);
            if (out) {
              out.innerHTML = r === null
                ? '<span class="kb-calc-err">这个式子含无法直接代入的符号，按步骤手算更稳妥。</span>'
                : '<b>= ' + (Math.round(r * 1e6) / 1e6) + "</b>　（按上面填的数值算出，单位与量纲请自己核对）";
            }
            return;
          }
          if (t.classList.contains("kb-calc-clear")) {
            var ins2 = box.querySelectorAll("input[data-sym]");
            for (var j = 0; j < ins2.length; j++) ins2[j].value = "";
            var o2 = box.querySelector(".kb-calc-out");
            if (o2) o2.innerHTML = "";
            return;
          }
        }
      });
    }
  }

  async function init() {
    if (S.ready) return;
    if (!$("kbSubjectList")) return;
    bind();
    var ok = await loadSubjects();
    if (ok && S.subjects.length) {
      S.current = S.current || S.subjects[0].id;
    }
    renderSubjects();
    renderHead();
    renderTabs();
    updateStat();
    var modes = $("kbModes");
    if (modes) {
      modes.innerHTML = MODES.map(function (m) {
        return '<button class="kb-tab kb-mode" data-mode="' + m.k + '">' + m.n + "</button>";
      }).join("");
    }
    var subjLab = $("kbCoachSubj");
    var cur = S.subjects.filter(function (x) { return x.id === S.current; })[0];
    if (subjLab) subjLab.textContent = cur ? " · " + cur.name : "";
    loadBooks(S.current);
    renderThread();
    S.ready = true;
    if (S.current) await switchTab("outline");
  }

  /* 供笔记页调用：带着问题跳到课程教练（subject 可传 id 或课程名） */
  function resolveSubject(s) {
    if (!s) return S.current || "";
    s = String(s).trim();
    var hit = S.subjects.filter(function (x) {
      return x.id === s || x.name === s || (x.aliases || []).indexOf(s) >= 0;
    })[0];
    return hit ? hit.id : (S.current || "");
  }

  function ask(question, subject) {
    try {
      var nav = document.querySelector('.nav-item[data-view="kb"]');
      if (nav && nav.click) nav.click();
      init().then(function () {
        S.current = resolveSubject(subject) || S.current;
        renderSubjects();
        renderHead();
        var subjLab = $("kbCoachSubj");
        var cur = S.subjects.filter(function (x) { return x.id === S.current; })[0];
        if (subjLab) subjLab.textContent = cur ? " · " + cur.name : "";
        setTimeout(function () {
          var ta = $("kbAskInput");
          if (ta) {
            if (question) ta.value = question;
            ta.focus();
            var th = $("kbThread");
            if (th && th.scrollIntoView) th.scrollIntoView({ block: "nearest" });
          }
        }, 220);
      });
    } catch (e) { /* 静默 */ }
  }

  window.CourseKB = {
    init: init,
    onShow: function (view) { if (view === "kb") { init(); } },
    ask: ask,
    tex: tex,
    state: S,
  };
})();
