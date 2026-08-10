/* ============================================================
   store.js — 数据存储层（localStorage）
   ============================================================ */
const Store = (() => {
  const KEY = "xingyu_platform_v1";

  const defaults = () => {
    const d = {
      profile: { name: "同学", avatar: "🚀", school: "", major: "", grade: "", slogan: "", goal: "", email: "" },
      settings: { baseUrl: "https://api.deepseek.com/v1", apiKey: "", model: "deepseek-chat", nickname: "" },
      courses: [],       // {id, name, teacher, day(1-7), start, end, location, color}
      tasks: [],         // {id, title, courseId, due(ISO), priority(high/mid/low), status(todo/doing/done), estimate}
      notes: [],         // {id, title, subject, tags[], content, createdAt, updatedAt}
      cards: [],         // {id, question, answer, subject, createdAt}
      pomodoros: [],     // {id, startAt, minutes, type(focus/break)}
      grades: [],        // {id, subject, name, score, credit, semester}
      skills: [],        // {id, name, level(1-100)}
      projects: [],      // {id, name, role, desc, link, start, end}
      literature: []     // {id, title, authors, journal, year, doi, tags[], notes, favorite, createdAt}
    };
    // 本地配置（local-config.js，含用户 API Key，不随仓库发布）
    if (window.LOCAL_CONFIG) {
      d.settings.baseUrl = window.LOCAL_CONFIG.baseUrl || d.settings.baseUrl;
      d.settings.apiKey = window.LOCAL_CONFIG.apiKey || d.settings.apiKey;
      d.settings.model = window.LOCAL_CONFIG.model || d.settings.model;
    }
    return d;
  };

  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign(defaults(), parsed);
        // 若本地存储未配置 AI Key，但存在本地配置文件，则自动填充（方便使用且不上传密钥）
        if (window.LOCAL_CONFIG && (!data.settings.apiKey || data.settings.apiKey === "LOCAL")) {
          data.settings.apiKey = window.LOCAL_CONFIG.apiKey || data.settings.apiKey;
          data.settings.baseUrl = window.LOCAL_CONFIG.baseUrl || data.settings.baseUrl;
          data.settings.model = window.LOCAL_CONFIG.model || data.settings.model;
          save();
        }
        return;
      }
    } catch (e) { console.warn("数据加载失败，使用默认", e); }
    data = defaults();
    // 首次使用，写入示例数据
    seedDemo();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.error("保存失败", e); }
  }

  function seedDemo() {
    const today = new Date();
    const d = (offset) => {
      const t = new Date(today);
      t.setDate(t.getDate() + offset);
      return t.toISOString();
    };

    data.courses = [
      { id: uid(), name: "高等数学", teacher: "李老师", day: 1, start: "08:00", end: "09:40", location: "教学楼A-301", color: "#2c4870" },
      { id: uid(), name: "数据结构", teacher: "王老师", day: 1, start: "10:00", end: "11:40", location: "实验楼B-201", color: "#1f3656" },
      { id: uid(), name: "大学英语", teacher: "陈老师", day: 2, start: "08:00", end: "09:40", location: "教学楼C-105", color: "#6b4f6b" },
      { id: uid(), name: "操作系统", teacher: "赵老师", day: 3, start: "14:00", end: "15:40", location: "实验楼B-105", color: "#6e5a3a" },
      { id: uid(), name: "线性代数", teacher: "李老师", day: 4, start: "10:00", end: "11:40", location: "教学楼A-502", color: "#3b7a4f" },
      { id: uid(), name: "计算机网络", teacher: "孙老师", day: 5, start: "08:00", end: "09:40", location: "实验楼B-301", color: "#b8341e" },
    ];

    data.tasks = [
      { id: uid(), title: "高数第三章课后习题", courseId: data.courses[0].id, due: d(2), priority: "high", status: "todo", estimate: 90 },
      { id: uid(), title: "数据结构实验报告", courseId: data.courses[1].id, due: d(3), priority: "mid", status: "doing", estimate: 120 },
      { id: uid(), title: "英语听力练习 Unit 4", courseId: data.courses[2].id, due: d(5), priority: "low", status: "todo", estimate: 30 },
      { id: uid(), title: "操作系统复习第一章", courseId: data.courses[3].id, due: d(1), priority: "high", status: "todo", estimate: 60 },
      { id: uid(), title: "线代矩阵作业", courseId: data.courses[4].id, due: d(-1), priority: "mid", status: "done", estimate: 45 },
    ];

    data.notes = [
      { id: uid(), title: "高数：极限与连续", subject: "高等数学", tags: ["高数", "极限"], content: "1. 极限的定义：ε-δ 语言\n2. 两个重要极限\n3. 无穷小与无穷大\n4. 连续函数性质：介值定理、最值定理", createdAt: d(-2), updatedAt: d(-2) },
      { id: uid(), title: "数据结构：二叉树遍历", subject: "数据结构", tags: ["树", "遍历"], content: "先序：根-左-右\n中序：左-根-右\n后序：左-右-根\n层次：队列实现\n\n应用：表达式树、哈夫曼树", createdAt: d(-4), updatedAt: d(-1) },
      { id: uid(), title: "英语作文模板整理", subject: "大学英语", tags: ["英语", "作文"], content: "开头：Nowadays, ... has become a hot topic.\n正文：First and foremost, ... Moreover, ...\n结尾：In conclusion, ...", createdAt: d(-6), updatedAt: d(-3) },
    ];

    data.cards = [
      { id: uid(), question: "两个重要极限是什么？", answer: "① lim(x→0) sinx/x = 1\n② lim(x→∞) (1+1/x)^x = e", subject: "高等数学", createdAt: d(-1) },
      { id: uid(), question: "二叉树中序遍历特点？", answer: "左子树 → 根节点 → 右子树。对二叉搜索树进行中序遍历会得到有序序列。", subject: "数据结构", createdAt: d(-1) },
      { id: uid(), question: "TCP 三次握手过程？", answer: "① 客户端发送 SYN\n② 服务端回复 SYN+ACK\n③ 客户端发送 ACK，建立连接", subject: "计算机网络", createdAt: d(0) },
    ];

    data.grades = [
      { id: uid(), subject: "高等数学", name: "期中考试", score: 88, credit: 5, semester: "2026春" },
      { id: uid(), subject: "大学英语", name: "期中考试", score: 92, credit: 3, semester: "2026春" },
      { id: uid(), subject: "数据结构", name: "单元测试", score: 85, credit: 4, semester: "2026春" },
    ];

    data.skills = [
      { id: uid(), name: "Python", level: 75 },
      { id: uid(), name: "Java", level: 60 },
      { id: uid(), name: "数据分析", level: 55 },
      { id: uid(), name: "英语", level: 70 },
    ];

    data.projects = [
      { id: uid(), name: "校园二手交易小程序", role: "开发", desc: "基于微信小程序的校园二手交易平台，实现商品发布、搜索、聊天功能。", link: "", start: "2026-03", end: "2026-05" },
    ];

    save();
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- 通用 CRUD ---------- */
  function getAll(key) { return data[key]; }
  function add(key, item) {
    if (!item.id) item.id = uid();
    data[key].push(item);
    save();
    return item;
  }
  function update(key, id, patch) {
    const idx = data[key].findIndex(x => x.id === id);
    if (idx > -1) {
      data[key][idx] = Object.assign({}, data[key][idx], patch);
      save();
      return data[key][idx];
    }
    return null;
  }
  function remove(key, id) {
    data[key] = data[key].filter(x => x.id !== id);
    save();
  }
  function replaceAll(key, items) { data[key] = items; save(); }

  /* ---------- 便捷方法 ---------- */
  function getProfile() { return data.profile; }
  function setProfile(p) { data.profile = Object.assign(data.profile, p); save(); }
  function getSettings() { return data.settings; }
  function setSettings(s) { data.settings = Object.assign(data.settings, s); save(); }

  function getCourseName(courseId) {
    const c = data.courses.find(x => x.id === courseId);
    return c ? c.name : "";
  }

  function exportAll() { return JSON.stringify(data, null, 2); }
  function importAll(json) {
    try {
      const parsed = JSON.parse(json);
      data = Object.assign(defaults(), parsed);
      save();
      return true;
    } catch (e) { return false; }
  }
  function clearAll() {
    data = defaults();
    save();
  }

  return { load, save, uid, getAll, add, update, remove, replaceAll,
           getProfile, setProfile, getSettings, setSettings, getCourseName,
           exportAll, importAll, clearAll };
})();

Store.load();
