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
  return factory(
    {
      getProfile: () => ({}),
      getSettings: () => ({ aiMemory: { facts: [], feedback: [] } }),
      getAll: () => []
    },
    { documentElement: { dataset: { lang: "zh" } } },
    {},
    { protocol: "file:" },
    {}
  );
}

const AIContext = loadAIContext();
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
console.log("AI context budget test OK");
