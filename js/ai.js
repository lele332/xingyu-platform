/* ============================================================
   ai.js — AI 能力层
   - 支持 OpenAI 兼容接口（可配置 baseUrl / apiKey / model）
   - 未配置时使用本地规则引擎兜底
   ============================================================ */
const AI = (() => {

  const PRESETS = {
    deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    kimi:     { baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
    openai:   { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  };

  const REQUEST_TIMEOUT_MS = 30000;
  let activeController = null;
  let manuallyCancelled = false;

  function chatEndpoint(baseUrl) {
    let url;
    try { url = new URL(String(baseUrl || "").trim()); }
    catch (e) { throw new Error("AI 接口地址格式不正确"); }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("AI 接口仅支持 HTTP/HTTPS 地址");
    const cleanPath = url.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
    url.pathname = cleanPath + "/chat/completions";
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    activeController = controller;
    manuallyCancelled = false;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } catch (e) {
      if (e.name === "AbortError") throw new Error(manuallyCancelled ? "已停止生成" : "AI 请求超时，请检查网络或稍后重试");
      throw new Error("AI 网络请求失败，请检查网络连接");
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
    }
  }

  function cancelCurrent() {
    if (!activeController) return false;
    manuallyCancelled = true;
    activeController.abort();
    return true;
  }

  function isConfigured() {
    const s = Store.getSettings();
    return !!(s.apiKey && s.baseUrl);
  }
  /* ---------- 调用 LLM ---------- */
  async function chat(messages, { temperature = 0.7 } = {}) {
    const s = Store.getSettings();
    if (!s.apiKey || !s.baseUrl) {
      throw new Error("AI 模型未配置，请在「设置」中填写 API Key");
    }
    const resp = await fetchWithTimeout(chatEndpoint(s.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + s.apiKey
      },
      body: JSON.stringify({
        model: s.model || "deepseek-chat",
        messages,
        temperature
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`AI 请求失败 (${resp.status}): ${err.slice(0, 200)}`);
    }
    const json = await resp.json().catch(() => null);
    const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (typeof content !== "string") throw new Error("AI 返回格式异常，请稍后重试");
    return content;
  }

  /* ============================================================
     四大技能
     ============================================================ */

  /* ---------- 1. 学习规划 /plan ---------- */
  function buildPlanPrompt() {
    const tasks = Store.getAll("tasks").filter(t => t.status !== "done");
    const courses = Store.getAll("courses");
    const notes = Store.getAll("notes");
    return `你是一名高效的大学生学业规划师。请基于以下数据为学生生成一份今日学习计划（用简洁的列表，注明时间段与任务，总时长不超过4小时，优先处理 DDL 最紧急的任务）：

待办任务：
${tasks.map(t => `- ${t.title}（截止：${t.due ? new Date(t.due).toLocaleDateString("zh-CN") : "未定"}，优先级：${t.priority}，预计${t.estimate || 60}分钟）`).join("\n")}

今日课程：
${courses.map(c => `- ${c.name}（周${c.day} ${c.start}-${c.end}）`).join("\n") || "无"}

最近笔记科目：
${notes.map(n => n.subject).join("、") || "无"}`;
  }

  /* ---------- 2. 智能优先级 /priority ---------- */
  function buildPriorityPrompt() {
    const tasks = Store.getAll("tasks").filter(t => t.status !== "done");
    return `你是一名时间管理专家。请对以下任务按紧急程度（DDL越近越紧急）+ 重要程度（优先级）排序，输出 1 2 3... 编号列表，每个任务附一句话理由：

${tasks.map((t, i) => `${i + 1}. ${t.title} | 截止 ${t.due ? new Date(t.due).toLocaleDateString("zh-CN") : "未定"} | 标记优先级 ${t.priority} | 预计${t.estimate || 60}分钟`).join("\n")}`;
  }

  /* ---------- 3. 知识卡片 /cards ---------- */
  function buildCardsPrompt() {
    const notes = Store.getAll("notes").slice(0, 5);
    return `你是一名学习辅导老师。请基于以下笔记内容，生成 3 张用于复习的知识卡片。每张卡片格式：
【问题】...
【答案】...

笔记内容：
${notes.map(n => `《${n.title}》(${n.subject})\n${n.content}`).join("\n\n")}`;
  }

  /* ---------- 4. 笔记整理 /organize ---------- */
  function buildOrganizePrompt(notesText) {
    return `你是一名知识管理助手。请将以下零散内容整理成结构化的学习笔记，使用清晰的标题分层与要点列表，保留所有关键信息：

${notesText}`;
  }

  /* ---------- 本地规则引擎（未配置 AI 时兜底） ---------- */
  function localPriority() {
    const tasks = Store.getAll("tasks").filter(t => t.status !== "done");
    const now = Date.now();
    const score = (t) => {
      let s = 0;
      if (t.priority === "high") s += 100;
      else if (t.priority === "mid") s += 50;
      if (t.due) {
        const diff = new Date(t.due).getTime() - now;
        const days = diff / 86400000;
        if (days < 1) s += 200;
        else if (days < 3) s += 120;
        else if (days < 7) s += 60;
      }
      if (t.status === "doing") s += 40;
      return s;
    };
    return tasks.slice().sort((a, b) => score(b) - score(a));
  }

  function localPlan() {
    const sorted = localPriority();
    const lines = ["本地规则生成的今日学习计划（未配置 AI 模型，逻辑较简单）：", ""];
    let time = 9 * 60; // 从 9:00 开始，单位分钟
    sorted.slice(0, 4).forEach((t, i) => {
      const mins = Math.min(t.estimate || 60, 90);
      const end = time + mins;
      const fmt = (m) => {
        const h = Math.floor(m / 60);
        const mm = m % 60;
        const period = h >= 12 ? "下午" : "上午";
        const hh = h > 12 ? h - 12 : h;
        return `${period} ${hh}:${String(mm).padStart(2, "0")}`;
      };
      lines.push(`${fmt(time)} - ${fmt(end)}  ${t.title}`);
      time = end + 30; // 间隔30分钟
    });
    lines.push("", "提示：在「设置」中配置 AI 模型后，可获得更智能的学习规划。");
    return lines.join("\n");
  }

  function localCards() {
    const notes = Store.getAll("notes").slice(0, 3);
    if (!notes.length) return "知识库中还没有笔记，先去「学习笔记库」添加一些笔记吧～";
    const out = ["基于最近笔记自动提取的复习要点：", ""];
    notes.forEach((n, i) => {
      const firstLine = n.content.split("\n").find(l => l.trim() && !l.startsWith("#")) || n.content;
      out.push(`${i + 1}. 《${n.title}》：${firstLine.trim().slice(0, 60)}`);
    });
    out.push("", "提示：配置 AI 模型后，可基于笔记生成规范的知识卡片（问题/答案）。");
    return out.join("\n");
  }

  function localOrganize(text) {
    if (!text || !text.trim()) return "请先输入需要整理的笔记内容（可直接粘贴在聊天框）。";
    const lines = text.split("\n").filter(l => l.trim());
    const out = ["整理后的笔记结构：", ""];
    let idx = 0;
    lines.forEach(l => {
      l = l.trim().replace(/^[-•*]\s*/, "");
      if (l.length > 0) out.push(`  ${l}`);
    });
    out.push("", "提示：配置 AI 模型后，AI 会进行语义级整理与归纳。");
    return out.join("\n");
  }

  /* ---------- 统一入口 ---------- */
  async function runSkill(skill, rawText) {
    if (isConfigured()) {
      try {
        let prompt = "";
        if (skill === "plan") prompt = buildPlanPrompt() + "\n\n请直接输出计划，不要客套。";
        else if (skill === "priority") prompt = buildPriorityPrompt() + "\n\n请直接输出排序结果，不要客套。";
        else if (skill === "cards") prompt = buildCardsPrompt();
        else if (skill === "organize") prompt = buildOrganizePrompt(rawText || "请把下面这段整理成笔记，如果我没有提供内容请提示我。");

        const result = await chat([
          { role: "system", content: "你是「星屿 · 个人学习工作台」平台内置的 AI 助手，回答简洁、实用、结构化。使用中文。" },
          { role: "user", content: prompt }
        ]);
        return { source: "ai", text: result };
      } catch (e) {
        if (e.message === "已停止生成") throw e;
        return { source: "local", text: `AI 调用失败（${e.message}），已切换为本地规则：\n\n` + fallback(skill, rawText) };
      }
    }
    return { source: "local", text: fallback(skill, rawText) };
  }

  function fallback(skill, rawText) {
    if (skill === "plan") return localPlan();
    if (skill === "priority") {
      const sorted = localPriority();
      if (!sorted.length) return "当前没有待办任务，先去「课程作业」添加一些吧～";
      const lines = ["智能排序结果（本地规则：DDL 越近 + 优先级越高越靠前）：", ""];
      sorted.forEach((t, i) => {
        const days = t.due ? Math.max(0, Math.ceil((new Date(t.due) - Date.now()) / 86400000)) : "-";
        lines.push(`${i + 1}. [${t.priority}] ${t.title}（${t.status === "doing" ? "进行中" : "待完成"}，剩 ${days} 天）`);
      });
      return lines.join("\n");
    }
    if (skill === "cards") return localCards();
    if (skill === "organize") return localOrganize(rawText);
    return "";
  }

  /* ---------- 通用对话 ---------- */
  async function ask(freeText) {
    if (isConfigured()) {
      const tasks = Store.getAll("tasks").filter(t => t.status !== "done");
      const notes = Store.getAll("notes").slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 3);
      const ctx = [
        `当前待办：${tasks.length ? tasks.slice(0, 5).map(t => t.title).join("、") : "无"}。`,
        `最近笔记：${notes.length ? notes.map(n => `${n.title}（${String(n.content || "").slice(0, 100)}）`).join("；") : "无"}。`
      ].join("\n");
      try {
        return await chat([
          { role: "system", content: "你是「星屿 · 个人学习工作台」的助手，帮助大学生管理学业与生活。回答简洁、实用、用中文。" },
          { role: "user", content: ctx + "\n\n" + freeText }
        ]);
      } catch (e) {
        throw e;
      }
    }
    // 未配置时的本地回复
    const t = freeText.toLowerCase();
    if (t.includes("计划") || t.includes("规划")) return localPlan();
    if (t.includes("优先")) return fallback("priority");
    if (t.includes("卡片")) return localCards();
    if (t.includes("笔记")) return localOrganize(freeText.replace(/整理|笔记/g, ""));
    return "我还没有配置 AI 模型，只能提供基础服务。\n请在「设置」中填写 OpenAI 兼容接口的 API Key（支持 DeepSeek / Kimi / OpenAI 等），之后我就能全面回答你的问题啦！\n\n或者试试快捷技能：/学习规划、/智能排序、/知识卡片、/笔记整理。";
  }

  /* ============================================================
     课表识别
     ============================================================ */
  const DAY_MAP = { "周一": 1, "星期二": 2, "周二": 2, "星期三": 3, "周三": 3, "星期四": 4, "周四": 4, "星期五": 5, "周五": 5, "星期六": 6, "周六": 6, "星期日": 7, "周日": 7, "星期天": 7, "周一(一)": 1, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7 };

  function extractJSON(text) {
    if (!text) return null;
    // 尝试提取 ```json ... ``` 块
    let m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) text = m[1];
    // 尝试找 [ ... ] 数组
    const arrStart = text.indexOf("[");
    const arrEnd = text.lastIndexOf("]");
    if (arrStart > -1 && arrEnd > arrStart) {
      try { return JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch (e) {}
    }
    // 尝试找 { ... } 对象
    const objStart = text.indexOf("{");
    const objEnd = text.lastIndexOf("}");
    if (objStart > -1 && objEnd > objStart) {
      try {
        const parsed = JSON.parse(text.slice(objStart, objEnd + 1));
        return Array.isArray(parsed) ? parsed : parsed.courses || parsed.data || null;
      } catch (e) {}
    }
    return null;
  }

  /* ---------- 图片识别（vision） ---------- */
  async function recognizeScheduleImage(base64DataUrl) {
    const s = Store.getSettings();
    if (!s.apiKey || !s.baseUrl) {
      throw new Error("AI 模型未配置，请在「设置」中填写 API Key");
    }
    const prompt = `这是一张大学课程表图片。请仔细识别图中所有课程，输出 JSON 数组，每项包含：
{"name": "课程名称", "day": 星期数字(周一到周日为1-7), "start": "上课时间如 08:00", "end": "下课时间如 09:40", "location": "教室地点", "teacher": "教师(若有)"}
要求：
1. 严格输出 JSON 数组，不要任何额外文字或 markdown 代码块标记
2. 如果图片无法识别出课程，输出空数组 []
3. 时间统一为 24 小时制 HH:MM 格式`;
    const resp = await fetchWithTimeout(chatEndpoint(s.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + s.apiKey
      },
      body: JSON.stringify({
        model: s.model || "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64DataUrl } }
          ]
        }],
        temperature: 0.1
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      // 视觉模型不支持时报错，给出友好提示
      const errMsg = err.includes("image") || resp.status === 400 ? "当前模型不支持图片识别，请更换为支持视觉的模型（如 gpt-4o-mini、glm-4v、qwen-vl-max），或在「粘贴文本」页签手动粘贴课表文字。" : `AI 请求失败 (${resp.status})`;
      throw new Error(errMsg + (err.slice(0, 120) ? "" : ""));
    }
    const json = await resp.json();
    const content = json.choices[0].message.content;
    const parsed = extractJSON(content);
    if (!parsed) {
      throw new Error("未能从 AI 返回中解析出课程数据，请重试或改用文本粘贴");
    }
    return parsed.map(normalizeCourse);
  }

  /* ---------- 文本解析（AI + 本地规则） ---------- */
  function normalizeCourse(c) {
    // 处理 day 可能是 "周一" / 1 / "星期一" 等
    let day = c.day;
    if (typeof day === "string") {
      day = DAY_MAP[day.trim()] || null;
    }
    if (typeof day === "number" && day >= 1 && day <= 7) { /* ok */ }
    else day = null;
    const norm = (t) => {
      if (!t) return "";
      const mt = String(t).match(/(\d{1,2})[:：](\d{2})/);
      if (mt) return String(mt[1]).padStart(2, "0") + ":" + mt[2];
      return "";
    };
    return {
      name: String(c.name || "").trim(),
      day: day,
      start: norm(c.start || c.time),
      end: norm(c.end || c.time2),
      location: String(c.location || c.room || c.place || "").trim(),
      teacher: String(c.teacher || "").trim()
    };
  }

  function localParseText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const courses = [];
    const reDay = /周([一二三四五六日天])|星期([一二三四五六日天])/;
    const reTime = /(\d{1,2})[:：](\d{2})\s*[-~至到]\s*(\d{1,2})[:：](\d{2})/;
    lines.forEach(line => {
      const dayM = line.match(reDay);
      if (!dayM) return;
      const dayStr = "周" + (dayM[1] || dayM[2]);
      const day = DAY_MAP[dayStr];
      const timeM = line.match(reTime);
      if (!timeM) return;
      const start = String(timeM[1]).padStart(2, "0") + ":" + timeM[2];
      const end = String(timeM[3]).padStart(2, "0") + ":" + timeM[4];
      // 课程名：时间之后到行尾的文本，去掉地点/教师部分
      const afterTime = line.slice(timeM.index + timeM[0].length);
      let location = "";
      let teacher = "";
      let name = afterTime.trim();
      // 教师：行尾的 老师/教授/教师
      const teacherM = name.match(/([\u4e00-\u9fa5]{1,4}(?:老师|教授|教师))$/);
      if (teacherM) { teacher = teacherM[1]; name = name.slice(0, name.length - teacherM[1].length).trim(); }
      // 地点：结尾的地名片段（楼/教室/学院/大学/馆/中心/实验室等）
      const locM = name.match(/([^,\s，、]+(?:学院|大学|楼|教室|馆|中心|实验室|实验楼)[^,\s，、]*)$/);
      if (locM) { location = locM[1].trim(); name = name.slice(0, name.length - locM[1].length).trim(); }
      // 去掉可能的节次信息如 "1-2节"
      name = name.replace(/\d+-\d+节/g, "").replace(/^\s*[-—–:：]\s*/, "").trim();
      if (name) {
        courses.push({ name, day, start, end, location, teacher });
      }
    });
    return courses;
  }

  async function parseScheduleText(text) {
    if (isConfigured()) {
      try {
        const prompt = `请解析以下大学课程表文本，输出 JSON 数组，每项包含：{"name": "课程名称", "day": 星期数字(周一=1...周日=7), "start": "08:00", "end": "09:40", "location": "地点", "teacher": "教师"}。严格只输出 JSON 数组，不要额外文字。若无法解析返回 []。

课表文本：
${text}`;
        const content = await chat([
          { role: "user", content: prompt }
        ], { temperature: 0.1 });
        const parsed = extractJSON(content);
        if (parsed && parsed.length) return parsed.map(normalizeCourse);
      } catch (e) {
        // 降级本地解析
      }
    }
    return localParseText(text);
  }

  /* ============================================================
     成绩解析
     ============================================================ */
  const EXAM_NAMES = ["期中考试", "期末考试", "期中", "期末", "月考", "单元测试", "平时成绩", "阶段测试", "期末考试A", "补考"];

  function localParseGrades(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const grades = [];
    const reSem = /(20\d{2}\s*(?:春|夏|秋|冬)?(?:学期)?)/;
    const reExam = new RegExp("(" + EXAM_NAMES.join("|") + ")");

    lines.forEach(line => {
      // 跳过注释行/纯标题行（不含任何数字的行由分数检测自然跳过）
      if (/^[#\/*]/.test(line)) return;
      let rest = line;

      // 1. 学期
      let semester = "";
      const semM = rest.match(reSem);
      if (semM) { semester = semM[1].replace(/\s+/g, ""); rest = rest.replace(semM[0], ""); }

      // 2. 分数：优先 "XX分/XX成绩/XX得分"，其次独立数字（排除年份/被数字包围）
      let score = null;
      const scoreM = rest.match(/(\d{1,3}(?:\.\d)?)\s*(?:分|成绩|得分)/);
      if (scoreM) {
        score = parseFloat(scoreM[1]);
        rest = rest.replace(scoreM[0], "");
      } else {
        const numM = rest.match(/(?<![\d.])(\d{1,3}(?:\.\d)?)(?![\d.])/);
        if (numM) {
          score = parseFloat(numM[1]);
          rest = rest.replace(numM[0], "");
        }
      }
      if (score === null || score < 0 || score > 100) return;

      // 3. 学分：支持 "5学分" 或 "学分:4"
      let credit = 3;
      const creditM = rest.match(/(\d+(?:\.\d)?)\s*学分/) || rest.match(/学分[：:]*\s*(\d+(?:\.\d)?)/);
      if (creditM) { credit = parseFloat(creditM[1] || creditM[2]); rest = rest.replace(creditM[0], ""); }

      // 4. 考试名
      let examName = "期末成绩";
      const examM = rest.match(reExam);
      if (examM) { examName = examM[1]; rest = rest.replace(examM[0], ""); }

      // 5. 科目：剩余文本，去掉常见标签前缀/标签（"成绩:"等，前后有分隔符时）
      let subject = rest
        .replace(/^[\s\-—:：,，、]+/, "")
        .replace(/^(科目|课程|成绩|分数|学分|考试)[:：]?/, "")
        .replace(/(?:^|[\s,，、])(成绩|分数|学分)[:：]?(?=$|[\s,，、])/g, "")
        .replace(/[:：]/g, "")
        .trim()
        .slice(0, 20);
      if (!subject) return;
      grades.push({ subject, name: examName, score, credit, semester });
    });
    return grades;
  }

  async function parseGradesText(text) {
    if (isConfigured()) {
      try {
        const prompt = `请解析以下大学成绩单文本，输出 JSON 数组，每项包含：{"subject": "科目名称", "name": "考试名称(如期中考试/期末考试)", "score": 分数数字(0-100), "credit": 学分数字, "semester": "学期如2026春"}。严格只输出 JSON 数组，不要额外文字。若无法解析返回 []。成绩单文本：
${text}`;
        const content = await chat([{ role: "user", content: prompt }], { temperature: 0.1 });
        const parsed = extractJSON(content);
        if (parsed && parsed.length) {
          return parsed.map(g => ({
            subject: String(g.subject || "").trim(),
            name: String(g.name || "期末成绩").trim(),
            score: Math.min(Math.max(parseFloat(g.score) || 0, 0), 100),
            credit: parseFloat(g.credit) || 3,
            semester: String(g.semester || "").trim()
          })).filter(g => g.subject && g.score > 0);
        }
      } catch (e) { /* 降级本地 */ }
    }
    return localParseGrades(text);
  }

  /* ---------- 成绩单图片识别（vision） ---------- */
  async function recognizeGradesImage(base64DataUrl) {
    const s = Store.getSettings();
    if (!s.apiKey || !s.baseUrl) {
      throw new Error("AI 模型未配置，请在「设置」中填写 API Key");
    }
    const prompt = `这是一张大学成绩单图片。请仔细识别图中所有科目成绩，输出 JSON 数组，每项包含：
{"subject": "科目名称", "name": "考试名称(如期中考试/期末考试)", "score": 分数数字(0-100), "credit": 学分数字, "semester": "学期如2026春"}
要求：
1. 严格输出 JSON 数组，不要任何额外文字或 markdown 代码块标记
2. 如果图片无法识别，输出空数组 []
3. score 必须为 0-100 的数字`;
    const resp = await fetchWithTimeout(chatEndpoint(s.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + s.apiKey
      },
      body: JSON.stringify({
        model: s.model || "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64DataUrl } }
          ]
        }],
        temperature: 0.1
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(resp.status === 400 && err.includes("image") ? "当前模型不支持图片识别，请更换支持视觉的模型（如 gpt-4o-mini、glm-4v），或在「粘贴文本」页签粘贴成绩文字。" : `AI 请求失败 (${resp.status})`);
    }
    const json = await resp.json();
    const parsed = extractJSON(json.choices[0].message.content);
    if (!parsed) throw new Error("未能从 AI 返回中解析出成绩数据，请重试或改用文本粘贴");
    return parsed.map(g => ({
      subject: String(g.subject || "").trim(),
      name: String(g.name || "期末成绩").trim(),
      score: Math.min(Math.max(parseFloat(g.score) || 0, 0), 100),
      credit: parseFloat(g.credit) || 3,
      semester: String(g.semester || "").trim()
    })).filter(g => g.subject && g.score > 0);
  }

  /* ============================================================
     笔记识别
     ============================================================ */
  function localParseNotes(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim());
    const notes = [];
    let current = null;

    lines.forEach(line => {
      if (!line) return;
      // 标签行：#tag 或多个 #tag
      const tagM = line.match(/^#([\u4e00-\u9fa5A-Za-z0-9]+)\s*(#[\u4e00-\u9fa5A-Za-z0-9]+\s*)*$/);
      if (tagM) {
        const tags = line.match(/#[\u4e00-\u9fa5A-Za-z0-9]+/g).map(t => t.slice(1));
        if (current) { current.tags = current.tags.concat(tags); }
        else { /* 标题行前面的标签忽略 */ }
        return;
      }
      // 标题：## 标题 / # 标题 / 第1行短文本
      const hM = line.match(/^#\s+(.+)$/);
      const isTitle = hM || (!current && line.length < 30 && !line.includes("。"));
      if (isTitle || !current) {
        if (current) notes.push(current);
        current = {
          title: (hM ? hM[1] : line).slice(0, 40),
          subject: "",
          tags: [],
          content: ""
        };
        return;
      }
      // 内容行
      if (current) {
        current.content += (current.content ? "\n" : "") + line;
      }
    });
    if (current) notes.push(current);

    // 根据内容猜测科目（匹配已有课程名或常见科目关键词）
    const courses = Store.getAll("courses");
    const subjects = courses.map(c => c.name).concat(["高等数学", "线性代数", "概率论", "大学英语", "英语", "数据结构", "操作系统", "计算机网络", "计算机组成", "编译原理", "数据库", "离散数学", "大学物理", "物理", "化学", "政治", "马原", "毛概", "思修", "历史", "哲学", "经济学", "管理学", "会计学", "编程", "Python", "Java", "C语言", "机器学习", "深度学习", "人工智能"]);
    notes.forEach(n => {
      const hay = (n.title + " " + n.content);
      for (const s of subjects) {
        if (s && hay.includes(s)) { n.subject = s; break; }
      }
    });

    // 清洗标签去重
    notes.forEach(n => { n.tags = Array.from(new Set(n.tags.filter(Boolean))); });
    return notes.filter(n => n.title && (n.content || n.tags.length));
  }

  async function parseNotesText(text) {
    if (isConfigured()) {
      try {
        const prompt = `请将以下笔记文本整理为结构化笔记，输出 JSON 数组，每项包含：{"title": "标题", "subject": "科目(如高数/英语/数据结构，不确定填空字符串)", "tags": ["标签1","标签2"], "content": "正文内容(保留要点与换行)"}。第1行通常为标题，以 # 开头的为标签，剩余为内容。若内容过少可合并为一条。严格只输出 JSON 数组，不要额外文字。笔记文本：
${text}`;
        const content = await chat([{ role: "user", content: prompt }], { temperature: 0.2 });
        const parsed = extractJSON(content);
        if (parsed && parsed.length) {
          return parsed.map(n => ({
            title: String(n.title || "").trim().slice(0, 40),
            subject: String(n.subject || "").trim(),
            tags: (Array.isArray(n.tags) ? n.tags : []).map(String).filter(Boolean),
            content: String(n.content || "").trim()
          })).filter(n => n.title);
        }
      } catch (e) { /* 降级本地 */ }
    }
    return localParseNotes(text);
  }

  /* ---------- 笔记图片识别（vision + OCR） ---------- */
  async function recognizeNotesImage(base64DataUrl) {
    const s = Store.getSettings();
    if (!s.apiKey || !s.baseUrl) {
      throw new Error("AI 模型未配置，请在「设置」中填写 API Key");
    }
    const prompt = `这是一张学习笔记/手写笔记/书本截图。请识别图中的所有文字内容，并整理为结构化笔记，输出 JSON 数组，每项包含：{"title": "笔记标题", "subject": "科目(如高数/英语，不确定填空字符串)", "tags": ["标签1"], "content": "正文内容(保留要点与换行)"}。
要求：
1. 严格输出 JSON 数组，不要额外文字或 markdown 标记
2. 尽量完整转录正文内容，不要省略
3. 如果图片不是笔记/无法识别文字，输出空数组 []`;
    const resp = await fetchWithTimeout(chatEndpoint(s.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + s.apiKey
      },
      body: JSON.stringify({
        model: s.model || "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64DataUrl } }
          ]
        }],
        temperature: 0.1
      })
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(resp.status === 400 && err.includes("image") ? "当前模型不支持图片识别，请更换支持视觉的模型（如 gpt-4o-mini、glm-4v），或在「粘贴文本」页签粘贴笔记文字。" : `AI 请求失败 (${resp.status})`);
    }
    const json = await resp.json();
    const parsed = extractJSON(json.choices[0].message.content);
    if (!parsed) throw new Error("未能从 AI 返回中解析出笔记数据，请重试或改用文本粘贴");
    return parsed.map(n => ({
      title: String(n.title || "").trim().slice(0, 40),
      subject: String(n.subject || "").trim(),
      tags: (Array.isArray(n.tags) ? n.tags : []).map(String).filter(Boolean),
      content: String(n.content || "").trim()
    })).filter(n => n.title);
  }

  return { isConfigured, chat, runSkill, ask, cancelCurrent, PRESETS, recognizeScheduleImage, parseScheduleText, parseGradesText, recognizeGradesImage, parseNotesText, recognizeNotesImage };
})();
