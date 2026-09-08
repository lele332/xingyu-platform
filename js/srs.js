/* ============================================================
   srs.js — FSRS 简化本地调度器（零依赖）
   目标：给知识卡片提供稳定、可解释的间隔重复。
   这里实现 FSRS 的核心状态：
   - stability：记忆稳定度（越大，下一次间隔越长）
   - difficulty：难度（1-10）
   - retrievability：当前可提取概率
   调度参数用默认 FSRS 常见权重；不联网、不构建。
   ============================================================ */
const SRS = (() => {
  const DAY_MS = 86400000;
  const REQUEST_RETENTION = 0.9;

  // FSRS-4.5 常用默认参数。以后如果引入优化器，可以整体替换这组权重。
  const W = [0.4872, 1.4003, 3.7145, 13.9204, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461];
  const GRADES = { again: 1, hard: 2, good: 3, easy: 4 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function int(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }
  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function safeDate(value, fallback) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date(fallback) : d;
  }

  function normalizeCard(card, now = Date.now()) {
    if (!card) return null;
    const raw = isRecord(card.srs) ? card.srs : {};
    const state = raw.state === "review" ? "review" : "new";
    const lastGrade = [1, 2, 3, 4].includes(raw.lastGrade) ? raw.lastGrade : null;
    const difficulty = clamp(num(raw.difficulty, lastGrade ? W[4] - (lastGrade - 3) * W[5] : W[4]), 1, 10);
    const stability = Math.max(0, num(raw.stability, 0));
    const due = safeDate(raw.due || card.createdAt || now, now);
    return {
      state,
      stability,
      difficulty,
      due: due.toISOString(),
      reps: Math.max(0, int(raw.reps, state === "review" ? 1 : 0)),
      lapses: Math.max(0, int(raw.lapses, 0)),
      lastGrade,
      lastReview: raw.lastReview ? safeDate(raw.lastReview, due).toISOString() : null
    };
  }

  function retrievability(state, now = Date.now()) {
    if (!state || state.stability <= 0) return 0;
    const last = state.lastReview ? new Date(state.lastReview).getTime() : new Date(state.due).getTime();
    const elapsed = Math.max(0, (now - last) / DAY_MS);
    return Math.pow(1 + elapsed / (9 * state.stability), -1);
  }

  function isDue(card, now = Date.now()) {
    const state = normalizeCard(card, now);
    if (!state) return false;
    if (state.state === "new") return true;
    return new Date(state.due).getTime() <= now;
  }

  function dueCards(cards, now = Date.now()) {
    if (!Array.isArray(cards)) return [];
    return cards
      .filter(card => isDue(card, now))
      .map(card => ({ card, state: normalizeCard(card, now) }))
      .sort((a, b) => new Date(a.state.due) - new Date(b.state.due));
  }

  function nextIntervalDays(stability) {
    // FSRS 常用 interval = 9 * S * (1 / requested_retention - 1)
    return Math.max(1, Math.round(9 * Math.max(0.01, stability) * (1 / REQUEST_RETENTION - 1)));
  }

  function review(card, gradeName, now = Date.now()) {
    const grade = typeof gradeName === "number" ? gradeName : GRADES[gradeName];
    if (![1, 2, 3, 4].includes(grade)) return null;
    const prev = normalizeCard(card, now);
    const reviewTime = Date.now();
    const lastTime = prev.lastReview ? new Date(prev.lastReview).getTime() : reviewTime;
    const elapsedDays = Math.max(0, (reviewTime - lastTime) / DAY_MS);
    const r = prev.state === "review" ? retrievability(prev, reviewTime) : 0;

    let stability;
    let difficulty;

    if (prev.state === "new") {
      // 首次评分：S0(G)=w[G-1]；D0(G)=w4-(G-3)*w5
      stability = W[grade - 1];
      difficulty = clamp(W[4] - (grade - 3) * W[5], 1, 10);
    } else {
      // 后续评分：FSRS 稳定度增长 + 难度均值回归。
      const hardPenalty = grade === 2 ? 0.85 : 1;
      const easyBonus = grade === 4 ? 1.15 : 1;
      const growth = Math.exp(W[8]) * (11 - prev.difficulty) *
        Math.pow(prev.stability, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) *
        hardPenalty * easyBonus;
      stability = Math.max(0.1, prev.stability * (1 + growth));

      const rawDifficulty = prev.difficulty - W[6] * (grade - 3);
      const initialDifficulty = W[4] - (grade - 3) * W[5];
      difficulty = clamp(W[7] * initialDifficulty + (1 - W[7]) * rawDifficulty, 1, 10);
    }

    let nextDue;
    if (grade === 1) {
      // Again 保留当天短间隔，尽快重学；但稳定度降低，避免长期误判成“已记住”。
      stability = Math.max(0.1, stability * 0.45);
      nextDue = new Date(reviewTime + 10 * 60 * 1000).toISOString();
    } else {
      // Hard/Good/Easy 都按天调度；FSRS 的稳定度已隐含难度影响。
      const days = nextIntervalDays(stability) * (grade === 2 ? 0.7 : grade === 4 ? 1.25 : 1);
      nextDue = new Date(reviewTime + Math.max(1, Math.round(days)) * DAY_MS).toISOString();
    }

    return {
      state: "review",
      stability: Number(stability.toFixed(6)),
      difficulty: Number(difficulty.toFixed(6)),
      due: nextDue,
      reps: prev.reps + 1,
      lapses: prev.lapses + (grade === 1 ? 1 : 0),
      lastGrade: grade,
      lastReview: new Date(reviewTime).toISOString(),
      elapsedDays: Number(elapsedDays.toFixed(4)),
      retrievability: Number(r.toFixed(4))
    };
  }

  return { GRADES, normalizeCard, isDue, dueCards, review };
})();
