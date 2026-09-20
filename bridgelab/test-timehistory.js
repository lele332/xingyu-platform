"use strict";

const assert = require("node:assert/strict");
const spatial = require("./spatial-frame3d");
const gm = require("./groundmotion");
const { solveModal, solveTimeHistory, jacobiEigenSymmetric } = spatial;

global.window = global;
global.XINGYU_SPATIAL3D = spatial;
global.XINGYU_GROUNDMOTION = gm;
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.addEventListener = () => {};
global.matchMedia = () => ({ matches: true });
require("./spatial-bridge");
const SPATIAL_BRIDGE = global.SPATIAL_BRIDGE;

let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; console.log("  ok -", msg); }

/* 单自由度模型：N1 固结，N2 仅 x 向自由（其余约束），轴向弹簧。 */
function sdofModel(k, m) {
  const E = 200000000, L = 1;
  const A = k * L / E;
  return {
    schemaVersion: "0.1.0",
    units: { force: "kN", length: "m", stress: "kPa" },
    nodes: [
      { id: "N1", xyz: [0, 0, 0] },
      { id: "N2", xyz: [L, 0, 0], mass: [m, 0, 0, 0, 0, 0] },
    ],
    elements: [{
      id: "E1", type: "frame3d", i: "N1", j: "N2",
      materialId: "M1", sectionId: "S1", orientation: [0, 0, 1],
    }],
    materials: [{ id: "M1", name: "spring", E, nu: 0.3, density: 0 }],
    sections: [{ id: "S1", name: "spring", A, Iy: 1e-6, Iz: 1e-6, J: 1e-6 }],
    restraints: [
      { nodeId: "N1", fixed: [true, true, true, true, true, true] },
      { nodeId: "N2", fixed: [false, true, true, true, true, true] },
    ],
    loadCases: [{ id: "LC1", name: "t", nodalLoads: [] }],
    stages: [{ id: "ST1", name: "all", activeGroups: [] }],
    analysisCases: [],
  };
}

/* SDOF：无阻尼自由振动（u0 初位移），与解析解 cos(ωt) 对比。 */
{
  const k = 2000, m = 10;
  const omega = Math.sqrt(k / m);
  const u0 = 0.01, dt = 0.0002, steps = 20001;
  const ag = new Float64Array(steps);
  const model = sdofModel(k, m);
  const modal = solveModal(model, { modeCount: 2 });
  const th = solveTimeHistory(model, { ag, dt, direction: "x", dampingRatio: 0, modal, u0: Float64Array.of(u0), maxSteps: 25000 });
  let maxErr = 0, e0 = 0.5 * k * u0 * u0;
  for (let k2 = 0; k2 < steps; k2 += 25) {
    const t = k2 * dt;
    const exact = u0 * Math.cos(omega * t);
    maxErr = Math.max(maxErr, Math.abs(th.nodeHistory[1].x[k2] - exact));
    const ek = 0.5 * m * Math.pow(-u0 * omega * Math.sin(omega * t), 2);
    const es = 0.5 * k * exact * exact;
    assert.ok(Math.abs(ek + es - e0) / e0 < 1e-9, "analytic energy const");
  }
  ok(maxErr < 2e-5, `无阻尼自由振动 vs cos(ωt)，maxErr=${maxErr.toExponential(2)}`);
  const ekEnd = 0.5 * m * Math.pow(u0 * omega * Math.sin(omega * (steps - 1) * dt), 2);
  const esEnd = 0.5 * k * Math.pow(u0 * Math.cos(omega * (steps - 1) * dt), 2);
  ok(Math.abs((th.energy.kinetic + th.energy.strain - e0) / e0) < 1e-6,
    `Newmark 能量守恒残差 ${(Math.abs(th.energy.kinetic + th.energy.strain - e0) / e0).toExponential(2)}`);
  void ekEnd; void esEnd;
}

/* SDOF：有阻尼自由振动（ζ=5%），与解析衰减解对比。 */
{
  const k = 2000, m = 10, zeta = 0.05;
  const omega = Math.sqrt(k / m);
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const u0 = 0.01, dt = 0.0005, steps = 6001;
  const ag = new Float64Array(steps);
  const model = sdofModel(k, m);
  const modal = solveModal(model, { modeCount: 2 });
  const th = solveTimeHistory(model, { ag, dt, direction: "x", dampingRatio: zeta, modal, u0: Float64Array.of(u0) });
  let maxErr = 0;
  for (let k2 = 0; k2 < steps; k2 += 50) {
    const t = k2 * dt;
    const exact = u0 * Math.exp(-zeta * omega * t) *
      (Math.cos(omegaD * t) + zeta * omega / omegaD * Math.sin(omegaD * t));
    maxErr = Math.max(maxErr, Math.abs(th.nodeHistory[1].x[k2] - exact));
  }
  ok(maxErr < 2e-6, `阻尼自由振动 vs 解析解，maxErr=${maxErr.toExponential(2)}`);
  // 能量：E0 = Ek + Es + Ed
  const e0 = 0.5 * k * u0 * u0;
  const sum = th.energy.kinetic + th.energy.strain + th.energy.damped;
  ok(Math.abs((sum - e0) / e0) < 5e-3, `阻尼耗散能量平衡 (Δ=${(Math.abs(sum - e0) / e0).toExponential(2)})`);
}

/* SDOF：正弦地面加速度（无阻尼），与闭式解对比。 */
{
  const k = 2000, m = 10;
  const omega = Math.sqrt(k / m);
  const Omega = 8, a0 = 2.0;
  // 小 dt 压制 Newmark 周期伸长误差（ω·dt≈0.007 时相位累积误差可忽略）
  const dt = 0.00025, steps = 24001;
  const ag = new Float64Array(steps);
  for (let i = 0; i < steps; i++) ag[i] = a0 * Math.sin(Omega * i * dt);
  const model = sdofModel(k, m);
  const modal = solveModal(model, { modeCount: 2 });
  const th = solveTimeHistory(model, { ag, dt, direction: "x", dampingRatio: 0, modal, maxSteps: 30000 });
  let maxErr = 0, peak = 0;
  for (let k2 = 0; k2 < steps; k2++) {
    const t = k2 * dt;
    const exact = a0 * (omega * Math.sin(Omega * t) - Omega * Math.sin(omega * t)) / (omega * (Omega * Omega - omega * omega));
    maxErr = Math.max(maxErr, Math.abs(th.nodeHistory[1].x[k2] - exact));
    peak = Math.max(peak, Math.abs(exact));
  }
  ok(maxErr / peak < 1e-4, `正弦激励 vs 闭式解，相对误差=${(maxErr / peak).toExponential(2)}`);
}

/* SDOF：合成正弦拍波 + 阻尼，与精细 Duhamel 参考解对比。 */
function duhamelSDOF(ag, dt, omega, zeta) {
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const n = ag.length;
  const out = new Float64Array(n);
  // 复合梯形数值积分（步长远小于分析步长）
  const sub = 10, h = dt / sub;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    let sum = 0;
    for (let j = 0; j <= i * sub; j++) {
      const tau = j * h;
      let aTau;
      if (j % sub === 0) aTau = ag[j / sub];
      else {
        const i0 = Math.floor(j / sub), f = (j % sub) / sub;
        aTau = ag[i0] * (1 - f) + (i0 + 1 < n ? ag[i0 + 1] : ag[i0]) * f;
      }
      const w = Math.exp(-zeta * omega * (t - tau)) * Math.sin(omegaD * (t - tau));
      sum += aTau * w * (j === 0 || j === i * sub ? 0.5 : 1) * h;
    }
    out[i] = -sum / omegaD;
  }
  return out;
}
{
  const k = 2000, m = 10, zeta = 0.05;
  const omega = Math.sqrt(k / m);
  // 加密到 dt=0.002，把 ω·dt 压到 0.028，排除 Newmark 周期伸长干扰
  const wave = gm.upsample(gm.synthSineBeat({ period: 0.6, seconds: 10 }), 0.002);
  const dt = wave.dt;
  const model = sdofModel(k, m);
  const modal = solveModal(model, { modeCount: 2 });
  const th = solveTimeHistory(model, { ag: wave.acc, dt, direction: "x", dampingRatio: zeta, modal, maxSteps: 30000 });
  const ref = duhamelSDOF(wave.acc, dt, omega, zeta);
  let maxErr = 0, peak = 0;
  for (let i = 0; i < wave.acc.length; i += 5) {
    maxErr = Math.max(maxErr, Math.abs(th.nodeHistory[1].x[i] - ref[i]));
    peak = Math.max(peak, Math.abs(ref[i]));
  }
  ok(maxErr / peak < 2e-3, `拍波激励 vs Duhamel，相对误差=${(maxErr / peak).toExponential(2)}`);
  // 受迫振动能量平衡
  ok(Math.abs(th.energy.residual / th.energy.input) < 1e-3,
    `受迫振动能量平衡残差 ${(Math.abs(th.energy.residual / th.energy.input)).toExponential(2)}`);
}

/* 2DOF 剪切框架：Newmark 直接积分 vs 独立模态叠加（Duhamel）。 */
{
  const m1 = 2, m2 = 1, k1 = 3, k2 = 2;
  const K = [[k1 + k2, -k2], [-k2, k2]];
  const M = [[m1, 0], [0, m2]];
  // 特征解：M^{-1/2} K M^{-1/2}
  const mInvSqrt = [1 / Math.sqrt(m1), 1 / Math.sqrt(m2)];
  const Khat = K.map((row, i) => row.map((v, j) => v * mInvSqrt[i] * mInvSqrt[j]));
  const eigen = jacobiEigenSymmetric(Khat);
  const modes2 = eigen.pairs.filter(p => p.value > 1e-12).slice(0, 2).map(p => {
    const omega = Math.sqrt(p.value);
    const phiHat = p.vector;
    const phi = phiHat.map((v, i) => v * mInvSqrt[i]);
    const norm = Math.hypot(phi[0], phi[1]);
    return { omega, phi: phi.map(v => v / norm) };
  });
  assert.equal(modes2.length, 2, "2DOF should have 2 modes");
  const iota = [1, 1];
  const gammas = modes2.map(md => {
    const num = md.phi[0] * m1 * iota[0] + md.phi[1] * m2 * iota[1];
    const den = md.phi[0] * m1 * md.phi[0] + md.phi[1] * m2 * md.phi[1];
    return num / den;
  });

  const wave = gm.synthSineBeat({ period: 1.2, seconds: 14 });
  const dt = 0.01;
  const zeta = 0.04;
  // 解析模态位移（精细 Duhamel）
  const modDisp = modes2.map(md => duhamelSDOF(wave.acc, dt, md.omega, zeta));

  const E = 200000000;
  function springEI(kTarget) { return { A: kTarget / E, Iy: 1e-6, Iz: 1e-6, J: 1e-6 }; }
  const model = {
    schemaVersion: "0.1.0",
    units: { force: "kN", length: "m", stress: "kPa" },
    nodes: [
      { id: "G1", xyz: [0, 0, 0] },
      { id: "P1", xyz: [1, 0, 0], mass: [m1, 0, 0, 0, 0, 0] },
      { id: "P2", xyz: [2, 0, 0], mass: [m2, 0, 0, 0, 0, 0] },
    ],
    elements: [
      { id: "K1", type: "truss3d", i: "G1", j: "P1", materialId: "M1", sectionId: "S1" },
      { id: "K3", type: "truss3d", i: "P1", j: "P2", materialId: "M1", sectionId: "S3" },
    ],
    materials: [{ id: "M1", name: "s", E, nu: 0.3, density: 0 }],
    sections: [
      { id: "S1", name: "k1", ...springEI(k1) },
      { id: "S3", name: "k2", ...springEI(k2) },
    ],
    restraints: [
      { nodeId: "G1", fixed: [true, true, true, true, true, true] },
      { nodeId: "P1", fixed: [false, true, true, true, true, true] },
      { nodeId: "P2", fixed: [false, true, true, true, true, true] },
    ],
    loadCases: [{ id: "LC1", name: "t", nodalLoads: [] }],
    stages: [{ id: "ST1", name: "all", activeGroups: [] }],
    analysisCases: [],
  };
  const modal = solveModal(model, { modeCount: 2 });
  const th = solveTimeHistory(model, { ag: wave.acc, dt, direction: "x", dampingRatio: zeta, modal });
  let maxErr = 0, peak = 0;
  for (let i = 0; i < wave.acc.length; i += 5) {
    for (let dof = 0; dof < 2; dof++) {
      let refU = 0;
      for (let md = 0; md < 2; md++) refU += modes2[md].phi[dof] * gammas[md] * modDisp[md][i];
      const got = dof === 0 ? th.nodeHistory[1].x[i] : th.nodeHistory[2].x[i];
      maxErr = Math.max(maxErr, Math.abs(got - refU));
      peak = Math.max(peak, Math.abs(refU));
    }
  }
  ok(maxErr / peak < 1e-3, `2DOF Newmark vs 模态叠加，相对误差=${(maxErr / peak).toExponential(2)}`);
}

/* 桥梁模型冒烟：梁桥梁格 + 拍波时程，检查输出结构、支座零位移、能量平衡。 */
{
  const model = SPATIAL_BRIDGE.buildBridgeModel({ bridgeType: "girder", spans: [30, 30], width: 10, segmentsPerSpan: 4 });
  const wave = gm.synthSineBeat({ period: 1.0, seconds: 8 });
  const modal = solveModal(model, { stageId: "ST-all", modeCount: 6 });
  const th = solveTimeHistory(model, {
    ag: wave.acc, dt: wave.dt, direction: "x", dampingRatio: 0.05, modal, stageId: "ST-all"
  });
  ok(th.steps === wave.acc.length, "时程步数与波一致");
  ok(th.peak.value > 0 && th.peak.time >= 0 && th.peak.time <= th.durationSec, "峰值合理");
  ok(th.peak.nodeId, "峰值节点存在: " + th.peak.nodeId);
  const support = model.restraints.find(r => r.fixed[0]);
  const supNode = th.nodeHistory.find(h => h.id === support.nodeId);
  let supMax = 0;
  for (let i = 0; i < th.steps; i++) supMax = Math.max(supMax, Math.abs(supNode.x[i]));
  ok(supMax === 0, "支座相对位移为零");
  const ratio = Math.abs(th.energy.residual) / Math.max(Math.abs(th.energy.input), 1e-12);
  ok(ratio < 5e-3, `桥梁时程能量平衡 (残差比=${ratio.toExponential(2)})`);
  ok(Number.isFinite(th.peakBaseShear), "基底剪力有限值 " + th.peakBaseShear.toFixed(2) + " kN");
  // 节点位移应远小于跨度（线性小变形假设自洽）
  ok(th.peak.value < 3, "峰值位移量级合理（<3 m）: " + th.peak.value.toFixed(4) + " m");
}

/* 桥梁模型：横向 Z 向输入 + 反应谱对比 sanity——同一波同一方向峰值包络非负。 */
{
  const model = SPATIAL_BRIDGE.buildBridgeModel({ bridgeType: "arch", archL: 60, archF: 12, width: 10, segmentsPerSpan: 4 });
  const wave = gm.synthRicker({});
  const modal = solveModal(model, { stageId: "ST-all", modeCount: 6 });
  const th = solveTimeHistory(model, {
    ag: wave.acc, dt: wave.dt, direction: "z", dampingRatio: 0.03, modal, stageId: "ST-all"
  });
  ok(th.peak.value > 0, "拱桥横向时程有响应");
  ok(th.nodeHistory.length === model.nodes.length, "节点时程完整");
}

/* 步数上限保护 */
{
  const model = sdofModel(2000, 10);
  assert.throws(() => solveTimeHistory(model, { ag: new Float64Array(9000), dt: 0.01, direction: "x" }), /超过上限/);
  ok(true, "maxSteps 超限报错");
}

/* ---------- 地震波解析 ---------- */
{
  const at2 = [
    "Peer NGA Format Sample",
    "Some event | station",
    " PGA=0.312g",
    "NPTS= 10, DT= 0.0200, CM/S**2",
    "1.0 2.0 3.0 4.0 5.0 6.0 7.0 8.0",
    "9.0 10.0",
  ].join("\n");
  const w = gm.parseGroundMotion(at2);
  ok(w.dt === 0.02 && w.acc.length === 10 && Math.abs(w.acc[9] - 0.1) < 1e-12, "PEER .at2 解析（cm/s²→m/s²）");
}
{
  const w = gm.parseGroundMotion("0, 0.1\n0.02, 0.2\n0.04, -0.1", { unit: "g" });
  ok(Math.abs(w.acc[1] - 0.2 * 9.81) < 1e-9 && w.dt === 0.02, "两列格式 + g 单位换算");
}
{
  const w = gm.parseGroundMotion("0.5\n-0.25\n0.125", { dt: 0.01 });
  ok(w.acc.length === 3 && w.dt === 0.01 && w.acc[0] === 0.5, "单列格式 + dt");
}
{
  const wave = gm.synthSineBeat({ period: 0.5, seconds: 6 });
  const scaled = gm.scaleToPGA(wave, 2.0);
  ok(Math.abs(gm.peakAcc(scaled.acc) - 2.0) < 1e-9, "PGA 调幅到 2.0 m/s²");
  const rs = gm.resample(wave, 0.05);
  ok(Math.abs(rs.dt - 0.05) < 1e-12 && rs.acc.length < wave.acc.length, "重采样到 dt=0.05 点数减少");
  ok(Math.abs(rs.acc[0] - wave.acc[0]) < 1e-12, "重采样端点保持");
}
{
  const w = gm.builtinWave("ricker");
  ok(w.acc.length > 100 && gm.peakAcc(w.acc) > 0.5, "内置 Ricker 波可用");
}

console.log(`\ntimehistory: ${passed} checks passed`);
