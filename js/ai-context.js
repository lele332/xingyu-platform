/* ============================================================
   ai-context.js — AI 上下文引擎 v2
   用户画像 + 学习规律 + BM25笔记检索 + 情绪感知 + 自适应建议
   设计参考：mem0 多信号检索、OpenHuman 结构化画像、Acontext 渐进披露。
   ============================================================ */
const AIContext = (() => {
  "use strict";

  /* ---------- 用户结构化画像 ---------- */
  function userProfile() {
    const p = Store.getProfile();
    const lines = [];
    if (p.name && p.name !== "同学") lines.push("昵称: " + p.name);
    if (p.school) lines.push("学校: " + p.school);
    if (p.major) lines.push("专业: " + p.major);
    if (p.grade) lines.push("年级: " + p.grade);
    if (p.goal) lines.push("目标: " + p.goal);
    if (p.slogan) lines.push("座右铭: " + p.slogan);
    const lang = document.documentElement.dataset.lang || "zh";
    if (lang === "en") lines.push("语言: English");
    return lines.length ? lines.join("\n") : "用户尚未完善个人资料。";
  }

  /* ---------- 学习行为分析 ---------- */
  function studyPatterns() {
    const lines = [];
    try {
      const pomos = Store.getAll("pomodoros").filter(p => p.type === "focus");
      if (pomos.length) {
        const hourCount = {};
        pomos.forEach(p => {
          const h = new Date(p.startAt || p.date).getHours();
          hourCount[h] = (hourCount[h] || 0) + 1;
        });
        const sorted = Object.entries(hourCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
        if (sorted.length) lines.push("高频学习时段: " + sorted.map(([h, c]) => h + "时(" + c + "次)").join("、"));

        const courseMap = {};
        Store.getAll("courses").forEach(c => { courseMap[c.id] = c.name; });
        const taskSubj = {};
        Store.getAll("tasks").forEach(t => {
          if (t.courseId && courseMap[t.courseId]) taskSubj[courseMap[t.courseId]] = (taskSubj[courseMap[t.courseId]] || 0) + 1;
        });
        const topSubj = Object.entries(taskSubj).sort((a, b) => b[1] - a[1]).slice(0, 3);
        if (topSubj.length) lines.push("主要科目: " + topSubj.map(([s, c]) => s + "(" + c + "项)").join("、"));

        const weekAgo = Date.now() - 7 * 86400000;
        const weekPomos = pomos.filter(p => new Date(p.startAt || p.date).getTime() > weekAgo);
        if (weekPomos.length) {
          const totalMin = weekPomos.reduce((sum, p) => sum + (p.minutes || 25), 0);
          lines.push("本周专注: " + weekPomos.length + " 个番茄钟 / " + totalMin + " 分钟");
        }
      }
    } catch (e) {}
    try {
      const grades = Store.getAll("grades");
      if (grades.length) {
        const bySubj = {};
        grades.forEach(g => {
          if (!g.subject) return;
          if (!bySubj[g.subject]) bySubj[g.subject] = [];
          bySubj[g.subject].push(g.score || 0);
        });
        const avgs = Object.entries(bySubj)
          .map(([s, arr]) => [s, Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)])
          .sort((a, b) => a[1] - b[1]);
        if (avgs.length) {
          lines.push("薄弱科目: " + avgs.slice(0, 3).map(([s, v]) => s + "(" + v + ")").join("、"));
          lines.push("强势科目: " + avgs.slice(-3).reverse().map(([s, v]) => s + "(" + v + ")").join("、"));
        }
      }
    } catch (e) {}
    try {
      const cards = Store.getAll("cards");
      const reviewed = cards.filter(c => c.srs && c.srs.reps > 0);
      if (reviewed.length) lines.push("间隔复习进度: " + reviewed.length + "/" + cards.length);
    } catch (e) {}
    return lines.length ? lines.join("\n") : "学习数据不足。";
  }

  /* ---------- 近期学习上下文 ---------- */
  function recentContext() {
    const lines = [];
    try {
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
      const courses = Store.getAll("courses").filter(c => Number(c.day) === dayOfWeek)
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
      if (courses.length) lines.push("今日课程: " + courses.map(c => c.start + " " + c.name).join("；"));
      const upcoming = Store.getAll("tasks").filter(t => t.status !== "done" && t.due)
        .sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
      if (upcoming.length) lines.push("即将到期: " + upcoming.map(t => {
        const diff = Math.ceil((new Date(t.due) - now) / 86400000);
        return t.title + (diff <= 0 ? "(今天)" : diff + "天后");
      }).join("；"));
      const notes = Store.getAll("notes").slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      if (notes.length) lines.push("最近笔记: " + notes.slice(0, 5).map(n => n.title || "(无标题)").join("；"));
      const exams = Store.getAll("exams").filter(e => e.status !== "done")
        .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 3);
      if (exams.length) lines.push("近期考试: " + exams.map(e => (e.title || e.name || "") + " " + e.date).join("；"));
    } catch (e) {}
    return lines.join("\n");
  }

  /* ---------- BM25 笔记检索 ---------- */
  function searchNotes(query, limit) {
    limit = limit || 5;
    if (!query || !String(query).trim()) return [];
    const words = String(query).trim().toLowerCase()
      .split(/[\s,，。？?！!、的了吗呢吧啊]+/)
      .filter(w => w.length >= 2);
    if (!words.length) return [];
    const notes = Store.getAll("notes");
    if (!notes.length) return [];
    const docFreq = {};
    notes.forEach(n => {
      const seen = new Set();
      words.forEach(w => {
        const text = ((n.title || "") + " " + (n.content || "") + " " + (n.tags || []).join(" ")).toLowerCase();
        if (text.includes(w) && !seen.has(w)) { docFreq[w] = (docFreq[w] || 0) + 1; seen.add(w); }
      });
    });
    const N = notes.length;
    const scored = notes.map(n => {
      const title = (n.title || "").toLowerCase();
      const content = (n.content || "").toLowerCase();
      const tags = (n.tags || []).map(t => t.toLowerCase());
      const fullText = title + " " + content + " " + tags.join(" ");
      let score = 0;
      words.forEach(w => {
        const idf = Math.log(1 + N / (1 + (docFreq[w] || 0)));
        const safeW = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const tf = (fullText.match(new RegExp(safeW, "g")) || []).length;
        const tfNorm = tf * 2.2 / (tf + 1.2);
        score += idf * tfNorm;
        if (title.includes(w)) score += idf * 1.5;
        if (tags.some(t => t.includes(w))) score += idf * 1.2;
      });
      const updatedAt = new Date(n.updatedAt || n.createdAt || 0).getTime();
      if (updatedAt > 0) {
        const ageDays = (Date.now() - updatedAt) / 86400000;
        score *= Math.pow(0.5, ageDays / 14);
      }
      return { note: n, score: Math.round(score * 100) / 100 };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(r => ({
      title: r.note.title || "(无标题)",
      subject: r.note.subject || "",
      snippet: (r.note.content || "").slice(0, 200),
      tags: r.note.tags || [],
      score: r.score
    }));
  }

  /* ---------- 判断是否是问题 ---------- */
  function isQuestion(text) {
    if (!text) return false;
    return /[?？]|为什么|怎么|如何|什么|怎样|帮我|解释|说明|总结|概要|哪|多少|是否|求/.test(text);
  }

  /* ---------- 学习情绪/状态感知 ---------- */
  function detectStudyState() {
    const signals = [];
    let stress = 0, energy = 5;
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const hour = now.getHours();
      const tasks = Store.getAll("tasks").filter(t => t.status !== "done");
      const urgent = tasks.filter(t => t.due && (new Date(t.due) - now) / 86400000 >= 0 && (new Date(t.due) - now) / 86400000 <= 3);
      if (urgent.length >= 5) { stress += 3; signals.push(urgent.length + "项任务3天内到期"); }
      else if (urgent.length >= 3) { stress += 2; signals.push(urgent.length + "项任务3天内到期"); }
      else if (urgent.length > 0) { stress += 1; signals.push(urgent.length + "项任务3天内到期"); }
      else signals.push("近3天无紧急任务");
      const exams = Store.getAll("exams").filter(e => e.date && e.status !== "done" && (new Date(e.date) - now) / 86400000 <= 7 && (new Date(e.date) - now) / 86400000 >= 0);
      if (exams.length) { stress += 2; signals.push(exams.length + "场考试7天内"); }
      const todayPomos = Store.getAll("pomodoros").filter(p => p.type === "focus" && p.startAt && String(p.startAt).slice(0, 10) === today);
      if (todayPomos.length >= 6) { energy -= 2; signals.push("今天已完成" + todayPomos.length + "个番茄钟"); }
      else if (todayPomos.length >= 3) { energy -= 1; signals.push("今天已完成" + todayPomos.length + "个番茄钟"); }
      else if (todayPomos.length === 0 && hour >= 10) { signals.push("今天还没开始专注"); energy += 1; }
      if (hour >= 23 || hour < 5) { energy -= 2; signals.push("深夜时段"); }
      else if (hour >= 6 && hour < 9) signals.push("早晨时段");
      else if (hour >= 21) signals.push("晚间时段");
      const overdue = tasks.filter(t => t.due && new Date(t.due) < now);
      if (overdue.length) { stress += 1; signals.push(overdue.length + "项任务已逾期"); }
    } catch (e) {}
    let state = "normal";
    if (stress >= 5) state = "high_stress";
    else if (stress >= 3) state = "moderate_stress";
    else if (energy <= 2) state = "low_energy";
    else if (energy >= 7) state = "high_energy";
    return { state, stressLevel: stress, energyLevel: energy, signals };
  }

  function studyStatePrompt() {
    const s = detectStudyState();
    if (!s.signals.length) return "";
    let tone = "";
    switch (s.state) {
      case "high_stress": tone = "用户压力大，回复温和鼓励，帮理清优先级，减少焦虑，不提新任务。"; break;
      case "moderate_stress": tone = "用户有压力，回复实际有条理，帮拆解任务。"; break;
      case "low_energy": tone = "用户精力低，建议轻松方式，避免高强度。"; break;
      case "high_energy": tone = "用户精力充沛，可建议更有挑战的任务。"; break;
    }
    return "\n\n【当前学习状态】\n" + s.signals.join("\n") + (tone ? "\n（语气：" + tone + "）" : "");
  }

  /* ---------- 自适应建议 ---------- */
  function smartSuggestion() {
    const s = detectStudyState();
    const lines = [];
    try {
      const now = new Date();
      const hour = now.getHours();
      if (s.state === "high_stress") {
        lines.push("你最近压力不小，先深呼吸。按紧急程度排序：");
        const urgent = Store.getAll("tasks").filter(t => t.status !== "done" && t.due)
          .sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 3);
        urgent.forEach((t, i) => {
          const days = Math.ceil((new Date(t.due) - now) / 86400000);
          lines.push((i + 1) + ". " + t.title + (days <= 0 ? "（今天！）" : "（" + days + "天后）"));
        });
        lines.push("先做第 1 项，设一个 25 分钟番茄钟。");
      } else if (s.state === "low_energy" || hour >= 21) {
        const due = (typeof SRS !== "undefined") ? SRS.dueCards(Store.getAll("cards")).length : 0;
        lines.push("现在适合轻松复习。" + due + " 张待复习卡片，做几张就行。");
      } else if (hour >= 6 && hour < 10) {
        const tasks = Store.getAll("tasks").filter(t => t.status !== "done");
        lines.push("新的一天！" + tasks.length + " 项任务待完成。");
        const todayDue = tasks.filter(t => t.due && new Date(t.due).toDateString() === now.toDateString());
        if (todayDue.length) lines.push("今天到期：" + todayDue.map(t => t.title).join("、"));
      }
    } catch (e) {}
    return lines.join("\n");
  }

  /* ---------- 智能系统提示 ---------- */
  function smartSystemPrompt(userMessage) {
    const lines = [];
    lines.push("你是「星屿」个人学习工作台的 AI 助手。你了解这位用户，回答要个性化、具体、可操作。使用中文。");
    lines.push("\n【用户画像】\n" + userProfile());
    lines.push("\n【学习规律】\n" + studyPatterns());
    const recent = recentContext();
    if (recent) lines.push("\n【当前状态】\n" + recent);
    if (userMessage && isQuestion(userMessage)) {
      const hits = searchNotes(userMessage);
      if (hits.length) {
        lines.push("\n【相关笔记】\n" + hits.map(h =>
          "- " + h.title + (h.subject ? "（" + h.subject + "）" : "") + ": " + h.snippet
        ).join("\n") + "\n自然引用相关笔记内容。");
      }
    }
    const stateCtx = studyStatePrompt();
    if (stateCtx) lines.push(stateCtx);
    lines.push("\n【回答要求】\n- 直接回答，不要客套。\n- 结合用户实际数据给建议。\n- 结合薄弱科目和学习时段推荐方法。\n- 根据学习状态调整语气。\n- 高压状态优先理清优先级。\n- 精力低建议轻松方式。");
    return lines.join("\n");
  }

  /* ---------- 沉淀对话为记忆 ---------- */
  function rememberAsync(userText, assistantReply) {
    if (location.protocol === "file:") return;
    try {
      fetch("/agent-proxy/memory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: String(userText) },
            { role: "assistant", content: String(assistantReply || "") }
          ]
        })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- 搜索长期记忆 ---------- */
  function searchLongTermMemory(query, limit) {
    limit = limit || 5;
    if (location.protocol === "file:") return Promise.resolve("");
    return fetch("/agent-proxy/memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query, limit: limit })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var items = (j && j.memories) || [];
      if (!items.length) return "";
      var ctx = items.map(function (m) { return "- " + (m.text || m); }).join("\n");
      return "\n\n【长期记忆】\n" + ctx + "\n（自然利用这些偏好）";
    }).catch(function () { return ""; });
  }

  return {
    userProfile: userProfile,
    studyPatterns: studyPatterns,
    recentContext: recentContext,
    searchNotes: searchNotes,
    isQuestion: isQuestion,
    detectStudyState: detectStudyState,
    studyStatePrompt: studyStatePrompt,
    smartSuggestion: smartSuggestion,
    smartSystemPrompt: smartSystemPrompt,
    rememberAsync: rememberAsync,
    searchLongTermMemory: searchLongTermMemory
  };
})();
