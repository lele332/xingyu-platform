const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

function loadAIContext() {
  const file = path.resolve(__dirname, "..", "js", "ai-context.js");
  const source = fs.readFileSync(file, "utf8");
  const factory = new Function(
    "Store", "document", "window", "location", "navigator",
    source + "\n;return AIContext;"
  );
  const store = { settings: {}, notes: [], saveHooks: [] };
  const ai = factory(
    {
      getProfile: () => ({}),
      getSettings: () => store.settings,
      setSettings: patch => Object.assign(store.settings, patch),
      getAll: key => key === "notes" ? store.notes : [],
      onSave: fn => store.saveHooks.push(fn)
    },
    { documentElement: { dataset: { lang: "zh" } } },
    {},
    { protocol: "file:" },
    {}
  );
  return { AIContext: ai, store };
}

const { AIContext, store } = loadAIContext();
assert.equal(AIContext.classifyTaskScenario("帮我安排本周复习计划"), "review");
assert.equal(AIContext.classifyTaskScenario("帮我安排本周任务和截止时间"), "planning");
assert.equal(AIContext.classifyTaskScenario("这道题总报错，帮我修复"), "troubleshooting");
assert.equal(AIContext.classifyTaskScenario("帮我找几篇相关论文"), "research");
assert.equal(AIContext.classifyTaskScenario("总结这段笔记"), "writing");
assert.equal(AIContext.classifyTaskScenario("你好"), "general");

const longSystem = Array.from({ length: 640 }, (_, i) => `学习上下文 ${i}`).join("\n");
const longHistory = Array.from({ length: 360 }, (_, i) => `历史消息 ${i}`).join("\n");
const planned = AIContext.planContext([
  { role: "system", content: longSystem },
  { role: "user", content: longHistory },
  { role: "assistant", content: longHistory },
  { role: "user", content: "帮我安排今天的复习计划" }
], "帮我安排今天的复习计划");

assert.equal(planned.scenario, "review");
assert.ok(planned.messages[0].content.length < longSystem.length, "system context should be compacted");
assert.ok(planned.messages[1].content.length < longHistory.length, "history should be compacted");
assert.equal(planned.messages.at(-1).content, "帮我安排今天的复习计划", "current message should remain intact");
assert.ok(planned.reducedChars < planned.rawChars, "context budget should reduce total characters");
const learned = AIContext.learnFromMessage("请记住：我喜欢短答案和明确步骤");
assert.equal(learned.length, 1);
assert.ok(AIContext.memoryItems().some(item => item.text.includes("短答案")));
const stats = AIContext.rateReply("好的，先做第一步。", true, "怎么开始？");
assert.ok(stats.good === 1 && stats.total === 1);
assert.equal(AIContext.removeMemoryFact(AIContext.memoryItems()[0].index), true);
assert.equal(AIContext.memoryItems().length, 0);
assert.equal(AIContext.feedbackStats().total, 1);
store.notes = Array.from({ length: 3000 }, (_, index) => ({
  title: "笔记 " + index,
  content: "普通学习内容 " + index,
  tags: [],
  updatedAt: new Date().toISOString()
}));
store.notes[2999] = { title: "操作系统页面置换算法", content: "LRU 是页面置换算法，重点看缺页率。", tags: ["操作系统"], updatedAt: new Date().toISOString() };
const hits = AIContext.searchNotes("LRU 页面置换", 3);
assert.ok(hits.length && hits[0].title === "操作系统页面置换算法", "cached BM25 should find the relevant note");
console.log("AI context budget test OK");
