/* 实验引导（labguide）引擎与校验器验证（Node 直接跑） */
'use strict';
globalThis.self = globalThis;
globalThis.window = globalThis;
const LG = require(__dirname + '/labguide.js');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok - ' + msg); }
  else { fail++; console.log('  FAIL - ' + msg); }
}

/* 1) 目录结构完整性 */
ok(LG.EXPERIMENTS.length >= 2, '实验目录 ≥ 2（实际 ' + LG.EXPERIMENTS.length + '）');
LG.EXPERIMENTS.forEach(function (exp) {
  ok(exp.id && exp.title && exp.module && exp.intro, exp.id + ' 元数据完整');
  ok(Array.isArray(exp.steps) && exp.steps.length >= 3, exp.id + ' 步骤数 ≥ 3（' + exp.steps.length + '）');
  exp.steps.forEach(function (s, i) {
    ok(typeof s.check === 'function', exp.id + ' 第' + (i + 1) + '步有 check');
    ok(Array.isArray(s.hints) && s.hints.length >= 1, exp.id + ' 第' + (i + 1) + '步有提示');
  });
});

/* 2) 时程实验 step1 校验器 */
const expTh = LG.getExp('th-walkthrough');
const stTh = LG.newRunState('th-walkthrough');
function ctxTh(over) {
  var v = { m3dAnalysis: 'timehistory', m3dWaveSource: 'builtin', m3dBuiltinWave: 'ricker', m3dPga: '0.2', m3dThDirection: 'x' };
  if (over) for (var k in over) v[k] = over[k];
  var notes = {};
  return {
    mod: function () { return 'modal3d'; },
    val: function (id) { return v[id] !== undefined ? v[id] : null; },
    th: function () { return over && over.__th || null; },
    last: function () { return null; },
    note: function (k, x) { if (arguments.length === 1) return notes[k]; notes[k] = x; return x; }
  };
}
ok(LG.checkStep(stTh, expTh, ctxTh()).ok === true, 'th step1 正确配置通过');
ok(LG.checkStep(stTh, expTh, ctxTh({ m3dBuiltinWave: 'beat' })).ok === false, 'th step1 波类型错误拦截');
stTh.step = 1;
ok(LG.checkStep(stTh, expTh, ctxTh()).ok === false, 'th step2 未运行拦截');
var fakeTh = { kind: 'timehistory', direction: 'x', peak: { value: 0.004, nodeId: 'N6', time: 1.23, step: 100 }, waveMeta: { steps: 1201, dt: 0.005, pga: 1.96, label: 'x', note: '' }, compare: { rows: [{ ratio: 0.97 }, { ratio: 1.1 }] } };
ok(LG.checkStep(stTh, expTh, ctxTh({ __th: fakeTh })).ok === true, 'th step2 运行后通过');
stTh.step = 4;
ok(LG.checkStep(stTh, expTh, ctxTh({ __th: fakeTh })).ok === true, 'th step5 对照卡比值通过');

/* 3) 梁实验 L^4 校验器 */
const expB = LG.getExp('beam-scaling');
const stB = LG.newRunState('beam-scaling');
function ctxBeam(notes, spans, defl) {
  return {
    mod: function () { return 'beam'; },
    val: function (id) { return id === 'pSpans' ? spans : null; },
    th: function () { return null; },
    last: function () { return defl === null ? null : { C: { defl: { worst: defl } }, R: { sec: { I: 2.1 } } }; },
    note: function (k, x) { if (arguments.length === 1) return notes[k]; notes[k] = x; return x; }
  };
}
var notesB = {};
ok(LG.checkStep(stB, expB, ctxBeam(notesB, '30', 0.017)).ok === true, 'beam step1 基准通过');
stB.step = 1;
ok(LG.checkStep(stB, expB, ctxBeam(notesB, '60', null)).ok === false, 'beam step2 未运行拦截');
var stB2 = LG.newRunState('beam-scaling');
var notesB2 = {};
LG.checkStep(stB2, expB, ctxBeam(notesB2, '30', 0.017));
stB2.step = 1;
ok(LG.checkStep(stB2, expB, ctxBeam(notesB2, '60', 0.017 * 16.2)).ok === true, 'beam step2 16 倍挠度通过');
ok(LG.checkStep(stB2, expB, ctxBeam(notesB2, '60', 0.017 * 5)).ok === false, 'beam step2 错误倍数拦截');

/* 4) 选择题门控 */
var stB3 = LG.newRunState('beam-scaling');
stB3.step = 2;
ok(LG.checkStep(stB3, expB, ctxBeam({}, '60', 0.017 * 16)).ok === false, 'quiz 未答时拦截');
stB3.quiz[2] = true;
ok(LG.checkStep(stB3, expB, ctxBeam({}, '60', 0.017 * 16)).ok === true, 'quiz 答对后放行');
ok(expB.steps[2].quiz.options[expB.steps[2].quiz.answer] === '16 倍', 'quiz 正确答案确实是 16 倍');


/* 5) 演示脚本数据完整性 */
ok(LG.DEMOS && LG.DEMOS.length >= 1, '演示目录 ≥ 1');
var demo = LG.DEMOS[0];
ok(demo.id === 'demo-th' && Array.isArray(demo.steps) && demo.steps.length >= 8, '演示步骤 ≥ 8（' + demo.steps.length + '）');
var ACTS = { say: 1, set: 1, run: 1, waitResult: 1, sayResult: 1, scroll: 1, sayDirection: 1 };
var demoOk = true;
demo.steps.forEach(function (s, i) {
  if (!ACTS[s.act]) { demoOk = false; console.log('  unknown act ' + s.act + ' at ' + i); }
  if (s.act === 'set' && (!s.id || s.value === undefined)) demoOk = false;
  if (s.act === 'scroll' && !s.target) demoOk = false;
});
ok(demoOk, '演示每步 act/set/scroll 字段合法');
ok(LG.runDemo === null || typeof LG.runDemo === 'function', 'runDemo 导出正常（Node 下为 null 属预期）');

console.log('========================================');
console.log('guide: ' + pass + ' 通过, ' + fail + ' 失败');
console.log('========================================');
process.exit(fail ? 1 : 0);