/* test-frame.js — frame.js 内核解析验算
 * 运行： node bridgelab/test-frame.js
 * 每项都要与经典解析解对比，误差应为 0.0000%
 */
'use strict';
global.window = global;
require('./frame.js');
const F = global.FRAME;

let pass = 0, fail = 0;
function chk(name, got, want, tol) {
  tol = tol || 1e-6;
  const denom = Math.abs(want) > 1e-9 ? Math.abs(want) : 1;
  const err = Math.abs(got - want) / denom * 100;
  const ok = err < (tol * 100);
  if (ok) pass++; else fail++;
  console.log(`${ok ? ' OK ' : 'FAIL'}  ${name.padEnd(34)} got=${got.toFixed(6)}  want=${want.toFixed(6)}  err=${err.toFixed(6)}%`);
}

/* ---------- 建模工具 ---------- */
/** 生成一条线上均布的节点 */
function lineNodes(x0, y0, x1, y1, n) {
  const a = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    a.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, fixed: [false, false, false] });
  }
  return a;
}
function chain(nds, EA, EI, type) {
  const els = [];
  for (let i = 0; i < nds.length - 1; i++) els.push({ i, j: i + 1, EA, EI, type: type || 'frame' });
  return els;
}
/** 沿单元弧长施加竖向均布荷载（y 向上为正，向下荷载取负）—— 用于梁、索 */
function applyUDL(els, nds, qDown, F) {
  for (const el of els) {
    const a = nds[el.i], b = nds[el.j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const q = -qDown; // 向下
    F[el.i * 3 + 1] += q * L / 2;
    F[el.i * 3 + 2] += q * L * L / 12;
    F[el.j * 3 + 1] += q * L / 2;
    F[el.j * 3 + 2] += -q * L * L / 12;
  }
}
/** 沿【水平投影】施加竖向均布荷载 —— 拱桥的拱上填料/桥面荷载属此类
 *  注意：若误用弧长，荷载总量会偏大，推力随之偏大（本测试第 4 项曾因此差 7%） */
function applyUDLh(els, nds, qDown, F) {
  for (const el of els) {
    const a = nds[el.i], b = nds[el.j];
    const dx = Math.abs(b.x - a.x);
    const q = -qDown;
    F[el.i * 3 + 1] += q * dx / 2;
    F[el.j * 3 + 1] += q * dx / 2;
  }
}

console.log('\n=== frame.js 内核解析验算 ===\n');

/* ---------- 1. 简支梁：跨中弯矩与挠度 ---------- */
{
  const L = 30, EI = 3.5e7, EA = 3.5e8, q = 10; // EI kN·m², EA kN
  const n = 40;
  const nds = lineNodes(0, 0, L, 0, n);
  nds[0].fixed = [true, true, false];           // 固定铰
  nds[n].fixed = [false, true, false];          // 滚动支座
  const els = chain(nds, EA, EI);
  const Fv = new Array(nds.length * 3).fill(0);
  applyUDL(els, nds, q, Fv);
  const m = F.makeModel(nds, els);
  const r = m.solveF(Fv);
  const mid = n / 2;

  chk('简支梁 跨中挠度 5qL⁴/384EI', -r.d[mid * 3 + 1], 5 * q * Math.pow(L, 4) / (384 * EI));

  // 跨中弯矩：取跨中单元的端部弯矩
  const ef = m.elemForces(els[mid], r.d);
  // 局部坐标 = 整体坐标（水平梁），M_i 为该单元 i 端弯矩
  chk('简支梁 跨中弯矩 qL²/8', ef.Mi, q * L * L / 8, 2e-3);

  // 端点弯矩应为 0
  const e0 = m.elemForces(els[0], r.d);
  chk('简支梁 梁端弯矩 ≈ 0', Math.abs(e0.Mi) < 0.5 ? 0 : 1, 0, 1e-9);
}

/* ---------- 2. 悬臂梁：自由端挠度 与 固端弯矩 ---------- */
{
  const L = 20, EI = 3.0e7, EA = 3.0e8, P = 100;
  const n = 20;
  const nds = lineNodes(0, 0, L, 0, n);
  nds[0].fixed = [true, true, true];            // 固结
  const els = chain(nds, EA, EI);
  const Fv = new Array(nds.length * 3).fill(0);
  Fv[n * 3 + 1] = -P;                            // 自由端向下集中力
  const m = F.makeModel(nds, els);
  const r = m.solveF(Fv);
  chk('悬臂梁 自由端挠度 PL³/3EI', -r.d[n * 3 + 1], P * Math.pow(L, 3) / (3 * EI));
  const e0 = m.elemForces(els[0], r.d);
  chk('悬臂梁 固端弯矩 PL', Math.abs(e0.Mi), P * L, 1e-4);
}

/* ---------- 3. 轴力柱：轴向压缩 ---------- */
{
  const L = 25, EA = 4.0e8, EI = 4.0e7, N = 1000;
  const n = 10;
  const nds = [];
  for (let i = 0; i <= n; i++) nds.push({ x: 0, y: L * i / n, fixed: [false, false, false] });
  nds[0].fixed = [true, true, true];
  const els = chain(nds, EA, EI);
  const Fv = new Array(nds.length * 3).fill(0);
  Fv[n * 3 + 1] = -N;                            // 顶部向下压力
  const m = F.makeModel(nds, els);
  const r = m.solveF(Fv);
  chk('轴压柱 轴向缩短 NL/EA', -r.d[n * 3 + 1], N * L / EA);
  const e0 = m.elemForces(els[0], r.d);
  chk('轴压柱 轴力 = N（压为负）', e0.N, -N);
}

/* ---------- 4. 三铰抛物线拱：水平推力 H = qL²/(8f) 且拱内弯矩≈0 ---------- */
{
  const L = 60, f = 12, q = 20, EI = 3.0e7, EA = 3.0e8;
  const n = 60;
  const nds = [];
  for (let i = 0; i <= n; i++) {
    const x = L * i / n - L / 2;                 // 以跨中为原点
    const y = f - F.parabolaAxis(Math.abs(x), L, f); // 拱顶 y=f，拱脚 y=0
    nds.push({ x: x + L / 2, y, fixed: [false, false, false] });
  }
  nds[0].fixed = [true, true, false];
  nds[n].fixed = [true, true, false];
  const els = chain(nds, EA, EI);
  const Fv = new Array(nds.length * 3).fill(0);
  applyUDLh(els, nds, q, Fv);                    // 沿水平投影均布（拱上填料/桥面荷载）
  const m = F.makeModel(nds, els);
  const r = m.solveF(Fv);

  // 拱脚水平反力 = 拱脚节点处单元轴力的水平分量
  const e0 = m.elemForces(els[0], r.d);
  const g = els[0]._geo;
  // 单元轴力（拉为正），水平分量 = N·c；推力为正值
  const H = Math.abs(e0.N * g.c);
  const Hwant = q * L * L / (8 * f);
  chk('三铰拱 水平推力 qL²/8f', H, Hwant, 2e-3);

  // 抛物线拱 + 沿水平均布荷载 → 理论上接近无弯矩（合理拱轴线）
  let maxM = 0;
  for (const el of els) {
    const ef = m.elemForces(el, r.d);
    maxM = Math.max(maxM, Math.abs(ef.Mi), Math.abs(ef.Mj));
  }
  // 与 qL²/8 = 9000 相比应小一个量级以上
  const ratio = maxM / (q * L * L / 8) * 100;
  console.log(`      参考：拱内最大弯矩 / 同跨简支梁弯矩 = ${ratio.toFixed(3)}%（合理拱轴线应接近 0）`);
  chk('三铰拱 拱内弯矩占比 < 3%', ratio < 3 ? 0 : 1, 0, 1e-9);
}

/* ---------- 5. 索单元：单索在自重下的垂度（悬链线近似校验）---------- */
{
  // 两端固定的水平索，中点受集中力，小垂度近似：T ≈ P·L/(4·δ)
  const L = 100, EA = 5.0e7, P = 50, delta = 0.5;
  const nds = [
    { x: 0, y: 0, fixed: [true, true, true] },
    { x: L / 2, y: -delta, fixed: [false, false, false] },
    { x: L, y: 0, fixed: [true, true, true] }
  ];
  const els = [
    { i: 0, j: 1, EA, type: 'truss' },
    { i: 1, j: 2, EA, type: 'truss' }
  ];
  const Fv = new Array(9).fill(0);
  Fv[4] = -P;                                    // 中点向下
  const m = F.makeModel(nds, els);
  const r = m.solveF(Fv);
  const e0 = m.elemForces(els[0], r.d);
  // 索力水平分量 ≈ P·L/(4δ) = 50*100/(4*0.5) = 2500；索有倾角，T 略大
  const Twant = P * L / (4 * delta) * Math.hypot(L / 2, delta) / (L / 2);
  chk('索单元 中点集中力下索力', e0.T, Twant, 1e-2);
}

/* ---------- 6. Ernst 等效弹模：量纲与单调性 ---------- */
{
  const E0 = 1.95e8;   // kPa（钢索 195 GPa）
  const gamma = 78.5;  // kN/m³
  const Lh = 200;      // m 水平投影
  const sig = 6.0e5;   // kPa（600 MPa）
  const Eeq = F.ernstE(E0, gamma, Lh, sig);
  console.log(`      Ernst: E0=${(E0 / 1e6).toFixed(0)} MPa → Eeq=${(Eeq / 1e6).toFixed(1)} MPa（折减 ${((1 - Eeq / E0) * 100).toFixed(1)}%）`);
  chk('Ernst 弹模必须小于 E0', Eeq < E0 ? 0 : 1, 0, 1e-9);
  // 应力越大，垂度影响越小，Eeq 越接近 E0
  chk('Ernst 应力增大→弹模回升', F.ernstE(E0, gamma, Lh, sig * 2) > Eeq ? 0 : 1, 0, 1e-9);
  // 跨度越大，垂度影响越大，Eeq 越小
  chk('Ernst 跨度增大→弹模降低', F.ernstE(E0, gamma, Lh * 2, sig) < Eeq ? 0 : 1, 0, 1e-9);
}

/* ---------- 7. 悬链线拱轴：m=1 退化为抛物线 ---------- */
{
  const L = 50, f = 10;
  let maxd = 0;
  for (let i = 0; i <= 20; i++) {
    const x = i / 20 * L / 2;
    maxd = Math.max(maxd, Math.abs(F.catenaryAxis(x, L, f, 1.0000001) - F.parabolaAxis(x, L, f)));
  }
  chk('悬链线 m→1 退化为抛物线', maxd < 1e-4 ? 0 : 1, 0, 1e-9);
  // 拱脚处 y 应等于 f
  chk('悬链线 拱脚 y = f', F.catenaryAxis(L / 2, L, f, 2.814), f, 1e-4);
}

/* ---------- 8. 悬索桥主缆抛物线：跨中垂度 = f ---------- */
{
  const L = 1000, f = 100;
  chk('主缆 跨中垂度 = f', F.suspCable(L / 2, L, f), f, 1e-9);
  chk('主缆 支点垂度 = 0', F.suspCable(0, L, f), 0, 1e-9);
}

console.log(`\n=== 结果：通过 ${pass} / 失败 ${fail} ===\n`);
process.exit(fail ? 1 : 0);
