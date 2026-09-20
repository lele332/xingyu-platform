/* 有限元内核对照验算：把 fem.js 的结果与材料力学解析解逐项比对。
   运行： node test-fem.js
   任何一项误差超过 0.5% 就算不通过 —— 这是整个桥梁模块的地基，不能含糊。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, Math: Math, console: console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'fem.js'), 'utf8'), sandbox);
const F = sandbox.window.FEM;

let pass = 0, fail = 0;
function chk(name, got, want, tol) {
  const err = Math.abs(got - want) / (Math.abs(want) > 1e-12 ? Math.abs(want) : 1);
  const ok = err <= (tol === undefined ? 0.005 : tol);
  console.log((ok ? '  PASS ' : '  FAIL ') + name +
    '  计算=' + got.toPrecision(7) + '  解析=' + want.toPrecision(7) +
    '  相对误差=' + (err * 100).toFixed(4) + '%');
  ok ? pass++ : fail++;
  return ok;
}

const EI = 3.45e4 * 1000 * 0.35;   // kN·m²，C50 混凝土 × 一个量级合理的 I

/* ---------- 工况 1：简支梁 + 全跨均布荷载 ---------- */
console.log('\n[1] 简支梁 L=30 m，全跨 q=20 kN/m');
{
  const L = 30, q = 20;
  const mesh = F.buildMesh([L], 0.5);
  const els = F.buildElems(mesh.xs);
  const solver = F.makeSolver(mesh.xs, els, EI, mesh.supIdx.map(i => 2 * i));
  F.distribute(els, mesh.xs, [{ x1: 0, x2: L, q: q }], []);
  const Fv = F.assembleF(els, solver.ndof);
  const d = solver.solveF(Fv);
  const res = F.elemResults(solver, d, 8);
  const R = F.reactions(solver, d, res);

  chk('支座反力 R（左）', R[0], q * L / 2);
  chk('跨中弯矩 M = qL²/8', maxAbsAt(res, 'M', L / 2), q * L * L / 8);
  chk('跨中挠度 δ = 5qL⁴/(384EI)', -minV(d), 5 * q * Math.pow(L, 4) / (384 * EI));
  chk('梁端剪力 V = qL/2', res[0].Vi, q * L / 2);
  chk('梁端弯矩 M = 0', Math.abs(res[0].Mi), 0, 1e-9);
}

/* ---------- 工况 2：悬臂梁 + 自由端集中力 ---------- */
console.log('\n[2] 悬臂梁 L=10 m，自由端 P=100 kN（左端固结）');
{
  const L = 10, P = 100;
  const mesh = F.buildMesh([L], 0.5);
  const els = F.buildElems(mesh.xs);
  // 固结：约束 v 与 θ；右端自由
  const solver = F.makeSolver(mesh.xs, els, EI, [0, 1]);
  F.distribute(els, mesh.xs, [], [{ x: L, P: P }]);
  const Fv = F.assembleF(els, solver.ndof);
  const d = solver.solveF(Fv);
  const res = F.elemResults(solver, d, 8);

  chk('自由端挠度 δ = PL³/(3EI)', -d[2 * (mesh.xs.length - 1)], P * Math.pow(L, 3) / (3 * EI));
  chk('固端弯矩 M = −PL', res[0].Mi, -P * L);
  chk('自由端弯矩 M = 0', Math.abs(res[res.length - 1].Mj), 0, 1e-9);
}

/* ---------- 工况 3：两等跨连续梁 + 全跨均布 ---------- */
console.log('\n[3] 两等跨连续梁 2×30 m，全跨 q=20 kN/m');
{
  const L = 30, q = 20;
  const mesh = F.buildMesh([L, L], 0.5);
  const els = F.buildElems(mesh.xs);
  const solver = F.makeSolver(mesh.xs, els, EI, mesh.supIdx.map(i => 2 * i));
  F.distribute(els, mesh.xs, [{ x1: 0, x2: 2 * L, q: q }], []);
  const Fv = F.assembleF(els, solver.ndof);
  const d = solver.solveF(Fv);
  const res = F.elemResults(solver, d, 8);
  const R = F.reactions(solver, d, res);
  const mid = mesh.supIdx[1];

  chk('中墩反力 R = 1.25qL', R[mid], 1.25 * q * L);
  chk('边支座反力 R = 0.375qL', R[0], 0.375 * q * L);
  chk('中墩负弯矩 M = −qL²/8', res[mid].Mi, -q * L * L / 8);
  // 跨中最大正弯矩：反弯点在 0.75L/… 解析解 M(3L/8) = 9qL²/128
  chk('跨中正弯矩 M = 9qL²/128', maxPosM(res), 9 * q * L * L / 128);
}

/* ---------- 工况 4：影响线最不利布载（弯矩包络的核心） ---------- */
console.log('\n[4] 简支梁影响线：单位力在跨中时跨中弯矩 = L/4');
{
  const L = 30;
  const mesh = F.buildMesh([L], 0.5);
  const els = F.buildElems(mesh.xs);
  const solver = F.makeSolver(mesh.xs, els, EI, mesh.supIdx.map(i => 2 * i));
  const nn = mesh.xs.length;
  let sIdx = 0, bd = Infinity;
  mesh.xs.forEach((x, i) => { const dd = Math.abs(x - L / 2); if (dd < bd) { bd = dd; sIdx = i; } });
  F.distribute(els, mesh.xs, [], [{ x: mesh.xs[sIdx], P: 1 }]);
  const Fv = F.assembleF(els, solver.ndof);
  const d = solver.solveF(Fv);
  const res = F.elemResults(solver, d, 2);
  chk('跨中弯矩影响线峰值 = L/4', res[sIdx].Mi, L / 4);
}

/* ---------- 工况 5：三点插值 / 三跨连续 ---------- */
console.log('\n[5] 三等跨连续梁 3×30 m，全跨 q=20 kN/m（对称性与量级）');
{
  const L = 30, q = 20;
  const mesh = F.buildMesh([L, L, L], 0.5);
  const els = F.buildElems(mesh.xs);
  const solver = F.makeSolver(mesh.xs, els, EI, mesh.supIdx.map(i => 2 * i));
  F.distribute(els, mesh.xs, [{ x1: 0, x2: 3 * L, q: q }], []);
  const Fv = F.assembleF(els, solver.ndof);
  const d = solver.solveF(Fv);
  const res = F.elemResults(solver, d, 8);
  const R = F.reactions(solver, d, res);
  const s1 = mesh.supIdx[1], s2 = mesh.supIdx[2];
  chk('两个中墩反力相等（对称性）', R[s1], R[s2]);
  chk('中墩反力 R ≈ 1.10qL（三等跨经典值）', R[s1], 1.10 * q * L, 0.01);
  chk('边支座反力 R ≈ 0.40qL', R[0], 0.40 * q * L, 0.01);
  chk('中墩负弯矩 ≈ −0.10qL²', res[s1].Mi, -0.10 * q * L * L, 0.02);
}

/* ---------- 工具 ---------- */
function maxAbsAt(res, key, x) {
  let best = 0, bd = Infinity;
  res.forEach(r => r.xs.forEach((xx, t) => {
    const dd = Math.abs(xx - x);
    if (dd < bd) { bd = dd; best = r[key][t]; }
  }));
  return key === 'M' ? Math.abs(best) * Math.sign(best) : best;
}
function minV(d) {
  let m = Infinity;
  for (let i = 0; i < d.length; i += 2) m = Math.min(m, d[i]);
  return m;
}
function maxPosM(res) {
  let m = -Infinity;
  res.forEach(r => r.M.forEach(v => { if (v > m) m = v; }));
  return m;
}

console.log('\n========================================');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('========================================');
process.exit(fail ? 1 : 0);
