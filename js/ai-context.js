/* ============================================================
   ai-context.js — AI 上下文引擎
   为所有 AI 调用（ai.js / voice-agent.js）提供丰富的用户上下文。
   设计参考：mem0 多信号检索、OpenHuman 结构化画像、Acontext 渐进披露。
   零依赖，defer 加载，在 store.js 之后 app.js 之前加载。
   ============================================================ */
const AIContext = (() => {
  "use strict";

  /* ---------- 用户结构化画像 ---------- */
  function userProfile() {
    const p = Store.getProfile();
    const s = Store.getSettings();
    const lines = [];
    if (p.name && p.name !== "同学") lines.push("昵称: " + p.name);
    if (p.school) lines.push("学校: " + p.school);
    if (p.major) lines.push("专业: " + p.major);
    if (p.grade) lines.push("年级: " + p.grade);
    if (p.goal) lines.push("目标: " + p.goal);
    if (p.slogan) lines.push("座右铭: " + p.slogan);
    // 语言偏好
    const lang = document.documentElement.dataset.lang || "zh";
    if (lang === "en") lines.push("语言偏好: English");
    else if (lang === "zh-Hant") lines.push("语言偏好: 繁体中文");
    return lines.length ? lines.join("\n") : "用户尚未完善个人资料。";
  }

  /* ---------- 学习行为分析 ---------- */
  function studyPatterns() {
    const lines = [];
    try {
      const pomos = Store.getAll("pomodoros").filter(p => p.type === "focus");
      if (!pomos.length) return "暂无专注记录。";

      // 时段偏好
      const hourCount = {};
      pomos.forEach(p => {
        const h = new Date(p.startAt || p.date).getHours();
        hourCount[h] = (hourCount[h] || 0) + 1;
      });
      const sortedHours = Object.entries(hourCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (sortedHours.length) {
        lines.push("高频学习时段: " + sortedHours.map(([h, c]) => h + "时(" + c + "次)").join("、"));
      }

      // 科目分布
      const courseMap = {};
      Store.getAll("courses").forEach(c => { courseMap[c.id] = c.name; });
      const taskSubjects = {};
      Store.getAll("tasks").forEach(t => {
        if (t.courseId && courseMap[t.courseId]) {
          taskSubjects[courseMap[t.courseId]] = (taskSubjects[courseMap[t.courseId]] || 0) + 1;
        }
      });
      const sortedSubjects = Object.entries(taskSubjects).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (sortedSubjects.length) {
        lines.push("最常出现的科目: " + sortedSubjects.map(([s, c]) => s + "(" + c + "项任务)").join("、"));
      }

      // 本周专注量
      const weekAgo = Date.now() - 7 * 86400000;
      const weekPomos = pomos.filter(p => new Date(p.startAt || p.date).getTime() > weekAgo);
      if (weekPomos.length) {
        const totalMin = weekPomos.reduce((sum, p) => sum + (p.minutes || 25), 0);
        lines.push("本周专注: " + weekPomos.length + " 个番茄钟，共 " + totalMin + " 分钟");
      }
    } catch (e) {}
    try {
      // 成绩趋势
      const grades = Store.getAll("grades");
      if (grades.length) {
        const bySubject = {};
        grades.forEach(g => {
          if (!g.subject) return;
          if (!bySubject[g.subject]) bySubject[g.subject] = [];
          bySubject[g.subject].push(g.score || 0);
        });
        const avgScores = Object.entries(bySubject)
          .map(([s, arr]) => [s, Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)])
          .sort((a, b) => a[1] - b[1]);
        if (avgScores.length) {
          lines.push("相对薄弱科目(按均分升序): " + avgScores.slice(0, 3).map(([s, v]) => s + "(" + v + "分)").join("、"));
          lines.push("相对强势科目(按均分降序): " + avgScores.slice(-3).reverse().map(([s, v]) => s + "(" + v + "分)").join("、"));
        }
      }
    } catch (e) {}
    try {
      // SRS 复习习惯
      const cards = Store.getAll("cards");
      const reviewed = cards.filter(c => c.srs && c.srs.reps > 0);
      if (reviewed.length) {
        lines.push("已开始间隔复习: " + reviewed.length + "/" + cards.length + " 张卡片");
      }
    } catch (e) {}
    return lines.length ? lines.join("\n") : "学习行为数据不足，无法分析规律。";
  }

  /* ---------- 近期学习上下文 ---------- */
  function recentContext(limit = 8) {
    const lines = [];
    try {
      // 今日课程
      const today = new Date();
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
      const courses = Store.getAll("courses").filter(c => Number(c.day) === dayOfWeek)
        .sort((a, b) => String(a.start).localeCompare(String(b.start)));
      if (courses.length) {
        lines.push("今日课程: " + courses.map(c => c.start + " " + c.name).join("；"));
      }
      // 近期截止
      const upcoming = Store.getAll("tasks").filter(t => t.status !== "done" && t.due)
        .sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
      if (upcoming.length) {
        lines.push("即将到期: " + upcoming.map(t => {
          const d = new Date(t.due);
          const diff = Math.ceil((d - today) / 86400000);
          return t.title + (diff <= 0 ? "(今天)" : diff + "天后");
        }).join("；"));
      }
      // 近期笔记标题
      const notes = Store.getAll("notes").slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      if (notes.length) {
        lines.push("最近笔记: " + notes.slice(0, 5).map(n => n.title || "(无标题)").join("；"));
      }
      // 近期考试
      const exams = Store.getAll("exams").filter(e => e.status !== "done")
        .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 3);
      if (exams.length) {
        lines.push("近期考试: " + exams.map(e => (e.title || e.name || "") + " " + e.date).join("；"));
      }
    } catch (e) {}
    return lines.join("\n");
  }

  /* ---------- 笔记关键词检索（轻量 RAG） ---------- */
  function searchNotes(query, limit = 5) {
    if (!query || !String(query).trim()) return [];
    const words = String(query).trim().toLowerCase().split(/[\s,，。？?！!、]+/).filter(w => w.length >= 2);
    if (!words.length) return [];
    const notes = Store.getAll("notes");
    const scored = notes.map(n => {
      const text = ((n.title || "") + " " + (n.content || "") + " " + (n.tags || []).join(" ")).toLowerCase();
      let score = 0;
      words.forEach(w => {
        if (text.includes(w)) score++;
        // 标题匹配权重更高
        if ((n.title || "").toLowerCase().includes(w)) score += 2;
        // 标签匹配权重更高
        if ((n.tags || []).some(t => t.toLowerCase().includes(w))) score += 2;
      });
      return { note: n, score };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(r => ({
      title: r.note.title || "(无标题)",
      subject: r.note.subject || "",
      snippet: (r.note.content || "").slice(0, 200),
      tags: r.note.tags || []
    }));
  }

  /* ---------- 判断用户消息是否是问题（需要检索笔记） ---------- */
  function isQuestion(text) {
    if (!text) return false;
    const questionMarkers = /[?？]|为什么|怎么|如何|什么|怎样|帮我|解释|说明|总结|概要|哪|多少|是否|可不可以|求/;
    return questionMarkers.test(text);
  }

  /* ---------- 智能系统提示 ---------- */
  function smartSystemPrompt(userMessage) {
    const lines = [];
    lines.push("你是「星屿」个人学习工作台的 AI 助手。你了解这位用户，回答要个性化、具体、可操作。使用中文。");
    lines.push("\n【用户画像】\n" + userProfile());
    lines.push("\n【学习规律】\n" + studyPatterns());
    const recent = recentContext();
    if (recent) lines.push("\n【当前状态】\n" + recent);
    // 如果用户消息像问题，尝试检索笔记
    if (userMessage && isQuestion(userMessage)) {
      const hits = searchNotes(userMessage);
      if (hits.length) {
        lines.push("\n【相关笔记摘录】\n" + hits.map(h =>
          "- " + h.title + (h.subject ? "（" + h.subject + "）" : "") + ": " + h.snippet
        ).join("\n") + "\n回答时自然引用相关笔记内容，不要刻意说「根据你的笔记」。");
      }
    }
    lines.push("\n【回答要求】\n- 直接回答，不要客套。\n- 结合用户的实际数据给建议。\n- 如果用户问的是学习方法，结合他的薄弱科目和学习时段来推荐。");
    return lines.join("\n");
  }

  /* ---------- 沉淀对话为记忆片段（异步，不阻塞回答） ---------- */
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

  /* ---------- 搜索长期记忆（语音智能体使用的 mem0） ---------- */
  function searchLongTermMemory(query, limit = 5) {
    if (location.protocol === "file:") return Promise.resolve("");
    return fetch("/agent-proxy/memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query, limit: limit })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var items = (j && j.memories) || [];
      if (!items.length) return "";
      var ctx = items.map(function (m) { return "- " + (m.text || m); }).join("\n");
      return "\n\n【关于用户的长期记忆】\n" + ctx + "\n（自然利用这些偏好，不要刻意复述）";
    }).catch(function () { return ""; });
  }

  return {
    userProfile,
    studyPatterns,
    recentContext,
    searchNotes,
    isQuestion,
    smartSystemPrompt,
    rememberAsync,
    searchLongTermMemory
  };
})();
