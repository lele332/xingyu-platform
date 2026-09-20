/* ==========================================================================
 * app.js — 参数绑定、求解调度、图形渲染、计算书生成
 * ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var B = window.BRIDGE, F = window.FEM;

  /* ---------- 工具 ---------- */
  function fmt(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    d = d === undefined ? 1 : d;
    var s = v.toFixed(d);
    return s;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- 状态 ---------- */
  var S = {
    tab: 'M',
    mod: 'beam',        // beam | arch | cable | susp | pier | hydro
    convoy: 0,          // 0..100
    playing: false,
    playTimer: null,
    ilSec: 0.5,         // 影响线截面位置（0..1 归一化）
    ilCache: { key: '', Mn: null, Vn: null },
    last: null
  };

  /* ---------- 模块元数据 ---------- */
  var MODS = {
    beam:  { hint: '梁桥：影响线最不利布载 + 规范验算' },
    arch:  { hint: '拱桥：合理拱轴线 · 恒载推力 · 无铰/铰拱' },
    cable: { hint: '斜拉桥：成桥索力 · Ernst 折减迭代' },
    susp:  { hint: '悬索桥：主缆重力刚度 · 线性简化模型' },
    pier:  { hint: '桥墩：偏心受压 · 裂缝 · 单桩承载力' },
    hydro: { hint: '桥涵水文：设计流量 → 冲刷 → 基底埋深' },
    modal3d: { hint: '3D 模态：空间梁格 · 固有频率 · 振型动画' },
    guide: { hint: '实验引导：跟着步骤亲手做实验' }
  };
  var BANNERS = {
    beam: '这是<b>教学演示内核</b>：平面欧拉-伯努利梁单元，只算竖向弯曲，不含横向分布的空间效应、剪力滞、扭转、徐变与施工阶段。荷载与抗力按 JTG D60-2015 / JTG 3362-2018 的常用条文实现，<b>正式设计请核实现行版本，并用专业软件复核</b>。',
    arch: '拱桥以<b>受压</b>为主：合理拱轴线让恒载主要变成轴向压力。无铰拱是二次超静定结构，拱脚推力与弯矩受拱轴系数、约束条件影响；本演示按弹性平面杆系计算，恒载沿水平投影施加，<b>正式设计请核实现行版本并用专业软件复核</b>。',
    cable: '斜拉桥演示<b>成桥状态</b>：初始索力按刚性支承连续梁法估算，再用 Ernst 折减弹性模量迭代到变形协调；只计入恒载。塔足够刚、索不松弛是迭代收敛的前提，结果供学习索力分布概念，<b>正式设计请用专业软件复核</b>。',
    susp: '悬索桥的横向稳定来自主缆<b>重力刚度</b>（拉力对横向位移的恢复作用），本模型已计入。这是无端锚边跨的线性简化演示，挠度与索力为数量级概念（FEM 结果会在报告中与抛物线理论对照），<b>正式设计请用专业软件复核</b>。',
    pier: '桥墩按 JTG 3362-2018 偏心受压承载力（含二阶效应 η 增大系数）与裂缝宽度验算，桩基按 JTG 3363-2019 单桩轴向受压容许承载力。条带法数值积分，结果供学习概念，<b>正式设计请核实现行版本</b>。',
    hydro: '按 JTG C30-2015 教学流程：设计洪水频率 → 推理公式设计流量 → 桥孔净长 → 64-1 修正式一般冲刷 → 65-2 式局部冲刷 → 基底最小埋置高程。参数取常见量级，<b>正式设计请核实现行版本</b>。',
    modal3d: '这是<b>3D 空间桥型模态分析</b>：可切换梁桥、拱桥、斜拉桥和悬索桥，计算固有频率、振型与有效模态质量。当前仍是线性杆系教学模型，结果用于专业课学习与模型验证。',
    guide: '实验引导模块给出演示，<b>动手操作的是你自己</b>：按步骤设置参数、运行计算、读结果。每步有检查器验收、分层提示和 AI 助教，<b>建议先把答案写下来再点「检查」</b>。'
  };

  /* ---------- 预设 ---------- */
  var PRESETS = [
    { name: '20m 简支 T 梁', spans: '20', secKind: 'T', B: 2.0, H: 1.2, t1: 0.16, t2: 0.18, bw: 0.40, grade: 'C50', g2: 8, lanes: 2, n: 5, s: 2.0, As: 160 },
    { name: '30m 简支 T 梁', spans: '30', secKind: 'T', B: 2.2, H: 1.8, t1: 0.16, t2: 0.18, bw: 0.45, grade: 'C50', g2: 10, lanes: 3, n: 5, s: 2.2, As: 300 },
    { name: '40m 简支箱梁', spans: '40', secKind: 'box', B: 2.5, H: 2.3, t1: 0.25, t2: 0.22, bw: 0.60, grade: 'C50', g2: 12, lanes: 3, n: 4, s: 2.6, As: 480 },
    { name: '3×30m 连续箱梁', spans: '30,30,30', secKind: 'box', B: 2.5, H: 1.8, t1: 0.25, t2: 0.22, bw: 0.60, grade: 'C50', g2: 10, lanes: 3, n: 4, s: 2.6, As: 380 },
    { name: '45+70+45 连续箱梁', spans: '45,70,45', secKind: 'box', B: 2.8, H: 3.5, t1: 0.28, t2: 0.25, bw: 0.70, grade: 'C55', g2: 14, lanes: 4, n: 4, s: 2.9, As: 900 }
  ];

  /* ---------- 读参数 ---------- */
  try { window.BL_STATE = (typeof S !== "undefined") ? S : null; } catch (e) { }

  function readParams() {
    var spansRaw = $('pSpans').value.split(/[,，\s]+/).map(parseFloat).filter(function (v) { return isFinite(v) && v > 0; });
    if (!spansRaw.length) spansRaw = [30];
    spansRaw = spansRaw.map(function (v) { return clamp(v, 2, 200); });

    var secKind = segVal('pSecKind');
    var H = +$('pH').value;
    var t1 = +$('pT1').value, t2 = +$('pT2').value;
    // 几何自洽：板厚之和不得吃掉梁高
    if (secKind === 'box') {
      var mx = H * 0.45;
      if (t1 + t2 > H * 0.8) { t1 = Math.min(t1, mx); t2 = Math.min(t2, mx); }
    }

    return {
      spans: spansRaw, mesh: +$('pMesh').value,
      grade: $('pGrade').value,
      secKind: secKind,
      B: +$('pB').value, H: H, t1: t1, t2: t2, bw: +$('pBW').value,
      g2: +$('pG2').value,
      cls: segVal('pCls'),
      lanes: +$('pLanes').value,
      nGirder: +$('pNG').value, girderSpacing: +$('pGS').value,
      mMode: segVal('pMMode'), mMan: +$('pMMan').value,
      muMode: segVal('pMuMode'), muMan: +$('pMuMan').value,
      As: +$('pAs').value / 10000,   // cm² → m²
      as: +$('pAsDist').value,
      rebar: $('pRebar').value,
      svD: +$('pSd').value, svN: +$('pSn').value, svS: +$('pSv').value,
      safe: +$('pSafe').value
    };
  }

  function segVal(id) {
    var el = $(id), on = el.querySelector('button.on');
    return on ? on.getAttribute('data-v') : '';
  }

  /* ==========================================================================
   * 求解主流程
   * ========================================================================== */
  function compute(P) {
    var mesh = F.buildMesh(P.spans, P.mesh);
    var xs = mesh.xs, els = F.buildElems(xs);
    var nn = xs.length, total = mesh.total;

    // ---- 截面 ----
    var rects = B.makeRects(P);
    var sec = B.sectionProps(rects);
    var mat = B.CONCRETE[P.grade];
    var EI = mat.Ec * 1000 * sec.I;           // kN·m²
    var g1 = B.GAMMA_C * sec.A;               // 主梁自重 kN/m
    var gDead = g1 + P.g2;

    // ---- 求解器（支座处 v = 0）----
    var fixed = mesh.supIdx.map(function (i) { return 2 * i; });
    var solver = F.makeSolver(xs, els, EI, fixed);
    if (!solver) return null;

    // ---- 恒载 ----
    F.distribute(els, xs, [{ x1: 0, x2: total, q: gDead }], []);
    var Fd = F.assembleF(els, solver.ndof);
    var dD = solver.solveF(Fd);
    var resD = F.elemResults(solver, dD, 4);
    var RD = F.reactions(solver, dD, resD);
    var nodalD = sampleNodal(resD, nn, dD);  // {M[], V[], v[]}

    // ---- 活载参数 ----
    var L0 = Math.max.apply(null, P.spans);   // 计算跨径：连续梁取最大跨（简化，已在 UI 标注）
    var lane = B.laneLoad(P.cls, L0);
    var fq = B.baseFrequency(mat.Ec, sec.I, g1, P.g2, L0);
    var imp = B.impactFactor(fq);
    var mu = (P.muMode === 'man') ? P.muMan : imp.mu;

    var W = P.nGirder * P.girderSpacing;
    var tf = B.transverseFactor(P.nGirder, P.girderSpacing, P.lanes, W);
    var m = (P.mMode === 'man') ? P.mMan : tf.m;
    var xi = B.LANE_REDUCTION[P.lanes] !== undefined ? B.LANE_REDUCTION[P.lanes] : 0.5;
    var amp = (1 + mu) * m * xi;              // 车道荷载 → 单片主梁荷载的综合放大系数

    // ---- 影响线扫描（几何不变时缓存）----
    var key = [P.spans.join(','), P.mesh, EI.toFixed(3)].join('|');
    var Mn, Vn;
    if (S.ilCache.key === key) {
      Mn = S.ilCache.Mn; Vn = S.ilCache.Vn;
    } else {
      var scan = ilScan(solver, xs, els, nn);
      Mn = scan.Mn; Vn = scan.Vn;
      S.ilCache = { key: key, Mn: Mn, Vn: Vn };
    }

    // ---- 活载包络（影响线最不利布载）----
    var w = trapz(xs);
    var envMmax = new Array(nn), envMmin = new Array(nn);
    var envVmax = new Array(nn), envVmin = new Array(nn);
    var liveMmax = new Array(nn), liveMmin = new Array(nn);
    var s, p;
    for (s = 0; s < nn; s++) {
      var posM = 0, negM = 0, mxM = 0, mnM = 0;
      var posV = 0, negV = 0, mxV = 0, mnV = 0;
      for (p = 0; p < nn; p++) {
        var vm = Mn[p][s], vv = Vn[p][s];
        if (vm > 0) posM += vm * w[p]; else negM += vm * w[p];
        if (vm > mxM) mxM = vm;
        if (vm < mnM) mnM = vm;
        if (vv > 0) posV += vv * w[p]; else negV += vv * w[p];
        if (vv > mxV) mxV = vv;
        if (vv < mnV) mnV = vv;
      }
      liveMmax[s] = amp * (lane.qk * posM + lane.Pk * (mxM > 0 ? mxM : 0));
      liveMmin[s] = amp * (lane.qk * negM + lane.Pk * (mnM < 0 ? mnM : 0));
      envMmax[s] = nodalD.M[s] + liveMmax[s];
      envMmin[s] = nodalD.M[s] + liveMmin[s];
      envVmax[s] = nodalD.V[s] + amp * (lane.qk * posV + lane.Pk * (mxV > 0 ? mxV : 0));
      envVmin[s] = nodalD.V[s] + amp * (lane.qk * negV + lane.Pk * (mnV < 0 ? mnV : 0));
    }

    // ---- 车队过桥（车辆荷载时程）----
    var vehLen = B.VEHICLE.len;
    var xh = -vehLen + (S.convoy / 100) * (total + vehLen);
    var pt = [];
    for (var a = 0; a < B.VEHICLE.axles.length; a++) {
      var ax = B.VEHICLE.axles[a];
      var xa = xh + ax.dx;                 // 前轴在 xh，其余轴落后
      if (xa >= -1e-9 && xa <= total + 1e-9) {
        pt.push({ x: clamp(xa, 0, total), P: ax.P * amp });
      }
    }
    var resV, dV, convoyOn = pt.length > 0;
    if (convoyOn) {
      F.distribute(els, xs, [], pt);
      var Fv = F.assembleF(els, solver.ndof);
      dV = solver.solveF(Fv);
      resV = F.elemResults(solver, dV, 4);
    } else {
      dV = dD.map(function () { return 0; });
      resV = resD.map(function (r) {
        return { i: r.i, j: r.j, x0: r.x0, x1: r.x1, L: r.L, Mi: 0, Vi: 0, Mj: 0, Vj: 0, M: r.M.map(function () { return 0; }), V: r.V.map(function () { return 0; }), xs: r.xs };
      });
    }

    // ---- 车队工况下的总内力（恒载 + 车队）----
    var resT = resD.map(function (r, k) {
      var rv = resV[k];
      return {
        i: r.i, j: r.j, x0: r.x0, x1: r.x1, L: r.L,
        Mi: r.Mi + rv.Mi, Vi: r.Vi + rv.Vi, Mj: r.Mj + rv.Mj, Vj: r.Vj + rv.Vj,
        M: r.M.map(function (v, t) { return v + rv.M[t]; }),
        V: r.V.map(function (v, t) { return v + rv.V[t]; }),
        xs: r.xs
      };
    });
    var nodalT = sampleNodal(resT, nn);
    var vT = xs.map(function (x, i) { return nodalD.v[i] + (dV[2 * i] || 0); });

    return {
      P: P, mesh: mesh, xs: xs, els: els, nn: nn, total: total,
      sec: sec, mat: mat, EI: EI, g1: g1, gDead: gDead,
      solver: solver, resD: resD, RD: RD, nodalD: nodalD,
      resT: resT, nodalT: nodalT, vT: vT, convoyOn: convoyOn, xh: xh, convoyPt: pt,
      lane: lane, fq: fq, mu: mu, tf: tf, m: m, xi: xi, amp: amp, L0: L0, W: W,
      Mn: Mn, Vn: Vn,
      envMmax: envMmax, envMmin: envMmin, envVmax: envVmax, envVmin: envVmin,
      liveMmax: liveMmax, liveMmin: liveMmin
    };
  }

  /** 影响线扫描：对每个节点施加单位竖向向下荷载，记录所有节点的 M、V。 */
  function ilScan(solver, xs, els, nn) {
    var Mn = [], Vn = [], p;
    for (p = 0; p < nn; p++) {
      F.distribute(els, xs, [], [{ x: xs[p], P: 1 }]);
      var Fv = F.assembleF(els, solver.ndof);
      var d = solver.solveF(Fv);
      var res = F.elemResults(solver, d, 1);
      var mRow = new Array(nn), vRow = new Array(nn);
      for (var n = 0; n < res.length; n++) {
        mRow[res[n].i] = res[n].Mi;
        vRow[res[n].i] = res[n].Vi;
      }
      mRow[nn - 1] = res[res.length - 1].Mj;
      vRow[nn - 1] = res[res.length - 1].Vj;
      Mn.push(mRow); Vn.push(vRow);
    }
    return { Mn: Mn, Vn: Vn };
  }

  /**
   * 把单元结果采样成节点量。
   * ⚠️ v 必须从位移向量里取（d[2i] 即第 i 节点的竖向位移 v，向上为正），
   *    不能留空 —— 挠度验算直接依赖它。
   */
  function sampleNodal(res, nn, d) {
    var M = new Array(nn), V = new Array(nn), v = new Array(nn), n;
    for (n = 0; n < nn; n++) { M[n] = 0; V[n] = 0; v[n] = d ? (d[2 * n] || 0) : 0; }
    for (n = 0; n < res.length; n++) { M[res[n].i] = res[n].Mi; V[res[n].i] = res[n].Vi; }
    M[nn - 1] = res[res.length - 1].Mj;
    V[nn - 1] = res[res.length - 1].Vj;
    return { M: M, V: V, v: v };
  }

  /** 梯形积分权重。 */
  function trapz(xs) {
    var n = xs.length, w = new Array(n), i;
    for (i = 0; i < n; i++) {
      if (i === 0) w[i] = (xs[1] - xs[0]) / 2;
      else if (i === n - 1) w[i] = (xs[n - 1] - xs[n - 2]) / 2;
      else w[i] = (xs[i + 1] - xs[i - 1]) / 2;
    }
    return w;
  }

  /* ==========================================================================
   * 验算
   * ========================================================================== */
  function check(R) {
    var P = R.P, mat = R.mat;
    var rebar = B.REBAR[P.rebar];
    var bf = (P.secKind === 'rect') ? P.bw : P.B;
    var hf = (P.secKind === 'box') ? P.t1 : (P.secKind === 'T' ? P.t1 : 0);
    if (P.secKind === 'rect') hf = 0;

    var g0 = B.COMBINE.gamma0[P.safe];
    var s;

    /* ---- 弯矩控制截面 ----
     * ⚠️ 控制截面必须用「组合后的设计值」找，不能拿标准值包络的最大值代替：
     *    恒载分项系数 1.2、活载 1.4，两者权重不同。一个包络值略小但活载占比高的截面，
     *    组合后反而可能更大。所以对每个截面都算出 γ₀Md，再取最不利的那个。 */
    var iMax = 0, iMin = 0, Md = -Infinity, MdMin = Infinity;
    for (s = 0; s < R.nn; s++) {
      var mdPos = g0 * (B.COMBINE.gammaG * R.nodalD.M[s] + B.COMBINE.gammaQ * R.liveMmax[s]);
      var mdNeg = g0 * (B.COMBINE.gammaG * R.nodalD.M[s] + B.COMBINE.gammaQ * R.liveMmin[s]);
      if (mdPos > Md) { Md = mdPos; iMax = s; }
      if (mdNeg < MdMin) { MdMin = mdNeg; iMin = s; }
    }
    var Mn = MdMin;

    var h0tmp = P.H - P.as;
    var bp = {
      fcd: mat.fcd, bf: bf, bw: P.bw, hf: hf, H: P.H, as: P.as, Es: rebar.Es,
      fcuk: mat.fcuk, ftd: mat.ftd,
      P100: Math.min(2.5, Math.max(0.1, 100 * P.As / (P.bw * h0tmp)))
    };
    var bend = B.bendingCapacity(bp, P.As, rebar.fsd);
    var rhoMin = B.minRho(mat.ftd, rebar.fsd);
    var rhoNow = P.As / (P.bw * h0tmp);

    /* ---- 剪力控制截面 ----
     * ⚠️ 两个易错点：
     *   1. 活载剪力有正负两种布置，必须「分别组合」后再比绝对值。早期版本把活载当成
     *      恒载的同号增量，导致右支座算出 −258 kN（真值应为 1123 kN）。
     *   2. 同样要用组合后的设计值找控制截面，不能用标准值包络。 */
    var iV = 0, Vd = 0, vAbsBest = 0;
    for (s = 0; s < R.nn; s++) {
      var vg = R.nodalD.V[s];
      var vd1 = g0 * (B.COMBINE.gammaG * vg + B.COMBINE.gammaQ * (R.envVmax[s] - vg));
      var vd2 = g0 * (B.COMBINE.gammaG * vg + B.COMBINE.gammaQ * (R.envVmin[s] - vg));
      var bb = Math.max(Math.abs(vd1), Math.abs(vd2));
      if (bb > vAbsBest) { vAbsBest = bb; iV = s; Vd = Math.abs(vd1) >= Math.abs(vd2) ? vd1 : vd2; }
    }
    var Asv = P.svN * Math.PI * Math.pow(P.svD / 2, 2);      // mm²
    var rhoSv = Asv / (P.bw * 1000 * P.svS);
    var a2f = 1.0, a3f = (P.secKind === 'rect') ? 1.0 : 1.1;
    var shear = B.shearCapacity(bp, rhoSv, rebar.fsd, { a1: 1.0, a2: a2f, a3: a3f });

    // ---- 挠度：频遇组合 S = S_G + ψ_f·S_Q，汽车荷载不计冲击 ----
    var Lmax = Math.max.apply(null, P.spans);
    var defl = deflectionCheck(R, Lmax);

    return {
      g0: g0, iMax: iMax, iMin: iMin, Md: Md, Mn: Mn, bend: bend,
      rhoMin: rhoMin, rhoNow: rhoNow, rebar: rebar,
      // 抗剪承载力取 Vcs 与截面尺寸上限的较小值：超过上限是斜压破坏，加密箍筋无效
      iV: iV, Vd: Vd, shear: shear, Vgov: Math.min(shear.Vcs, shear.Vmax), rhoSv: rhoSv, Asv: Asv,
      defl: defl, bf: bf, hf: hf
    };
  }

  /**
   * 挠度验算：S = S_G + ψ_f·S_Q，汽车荷载不计冲击。
   *
   * 活载位移走「位移影响线 + 最不利布载」，不拍脑袋全跨满布：
   *   由 Maxwell–Betti 互等定理，δ(s 处｜p 点单位力) = δ(p 处｜s 点单位力)。
   *   所以只要在 s 点加一个单位力解一次，解出来的整条位移曲线
   *   就是 s 点的位移影响线 —— 一次求解搞定，不用 O(n²) 扫描。
   */
  function deflectionCheck(R, Lmax) {
    var P = R.P, xs = R.xs, els = R.els, solver = R.solver, nn = R.nn, i;
    var w = trapz(xs);
    var psi = B.COMBINE.psiF;
    var ampNoImp = R.m * R.xi;              // 不含冲击
    var lane = R.lane;

    // 控制截面：最大跨的跨中
    var kMax = 0, cum = R.mesh.cum;
    for (var k = 0; k < P.spans.length; k++) if (P.spans[k] > P.spans[kMax]) kMax = k;
    var sX = (cum[kMax] + cum[kMax + 1]) / 2;
    var sIdx = 0, bd = Infinity;
    for (i = 0; i < nn; i++) { var d0 = Math.abs(xs[i] - sX); if (d0 < bd) { bd = d0; sIdx = i; } }

    F.distribute(els, xs, [], [{ x: xs[sIdx], P: 1 }]);
    var Fu = F.assembleF(els, solver.ndof);
    var du = solver.solveF(Fu);
    var il = new Array(nn);
    for (i = 0; i < nn; i++) il[i] = du[2 * i];       // v，向上为正

    // 最不利：qk 铺在影响线为负（产生下挠）的区段，Pk 放在最小值处
    var area = 0, peak = 0;
    for (i = 0; i < nn; i++) {
      if (il[i] < 0) area += il[i] * w[i];
      if (il[i] < peak) peak = il[i];
    }
    var vQ = ampNoImp * (lane.qk * area + lane.Pk * peak);
    var vG = R.nodalD.v[sIdx];
    var vFreq = vG + psi * vQ;

    var limit = Lmax / B.DEFLECTION_LIMIT.ratio;
    return {
      worst: vFreq, worstX: xs[sIdx], limit: limit, sIdx: sIdx,
      vG: vG, vQ: vQ, il: il,
      ratio: Math.abs(vFreq) / limit,
      cite: B.DEFLECTION_LIMIT.cite
    };
  }

  /* ==========================================================================
   * 渲染
   * ========================================================================== */
  var CW = 900, CH = 260, PL = 66, PR = 34, PT = 26, PB = 42;
  var EW = 900, EH = 210, EL = 60, ER = 40, ET = 54, EB = 56;

  function sxOf(total) { return (EW - EL - ER) / total; }
  function cxOf(total) { return (CW - PL - PR) / total; }

  function renderElev(R) {
    var xs = R.xs, total = R.total, sup = R.mesh.supIdx;
    var sx = sxOf(total), base = 122;
    var g = [];

    // 变形放大
    var vmax = 0, i;
    for (i = 0; i < R.vT.length; i++) vmax = Math.max(vmax, Math.abs(R.vT[i]));
    var mag = vmax > 1e-9 ? 34 / vmax : 0;
    var exag = mag / sx;

    // 地面线
    g.push('<line x1="' + EL + '" y1="' + (base + 44) + '" x2="' + (EW - ER) + '" y2="' + (base + 44) + '" stroke="#2c2c2e" stroke-width="1"/>');

    // 墩 / 台
    for (i = 0; i < sup.length; i++) {
      var X0 = EL + xs[sup[i]] * sx;
      var isEnd = (i === 0 || i === sup.length - 1);
      var pw = isEnd ? 16 : 12;
      g.push('<rect x="' + (X0 - pw / 2) + '" y="' + (base + 8) + '" width="' + pw + '" height="36" fill="#1c1c1e" stroke="#48484a" stroke-width="1" rx="2"/>');
      // 支座三角
      g.push('<path d="M' + (X0 - 7) + ' ' + (base + 8) + ' L' + (X0 + 7) + ' ' + (base + 8) + ' L' + X0 + ' ' + (base - 2) + ' Z" fill="#0a84ff" opacity="0.85"/>');
      g.push('<text x="' + X0 + '" y="' + (base + 62) + '" fill="#636366" font-size="10" text-anchor="middle">' + fmt(xs[sup[i]], 1) + '</text>');
    }

    // 主梁（未变形轮廓）
    g.push('<rect x="' + EL + '" y="' + (base - 7) + '" width="' + (xs[xs.length - 1] * sx) + '" height="14" rx="3" fill="#2c2c2e" stroke="#48484a" stroke-width="1"/>');

    // 变形曲线
    var pts = [];
    for (i = 0; i < xs.length; i++) pts.push((EL + xs[i] * sx) + ',' + (base - R.vT[i] * mag));
    g.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="#0a84ff" stroke-width="2.2" stroke-linejoin="round"/>');

    // 跨径标注
    for (i = 0; i < R.mesh.spans.length; i++) {
      var xa = EL + R.mesh.cum[i] * sx, xb = EL + R.mesh.cum[i + 1] * sx;
      g.push('<line x1="' + xa + '" y1="' + (ET - 16) + '" x2="' + xb + '" y2="' + (ET - 16) + '" stroke="#48484a" stroke-width="0.8"/>');
      g.push('<line x1="' + xa + '" y1="' + (ET - 20) + '" x2="' + xa + '" y2="' + (ET - 12) + '" stroke="#48484a" stroke-width="0.8"/>');
      g.push('<line x1="' + xb + '" y1="' + (ET - 20) + '" x2="' + xb + '" y2="' + (ET - 12) + '" stroke="#48484a" stroke-width="0.8"/>');
      g.push('<text x="' + ((xa + xb) / 2) + '" y="' + (ET - 22) + '" fill="#98989d" font-size="11" text-anchor="middle">' + fmt(R.mesh.spans[i], 1) + ' m</text>');
    }

    // 车队
    if (R.convoyOn) {
      var ax = R.xh;
      var tx = EL + clamp(ax, 0, total) * sx;
      var tw = B.VEHICLE.len * sx;
      var ty = base - 30;
      g.push('<rect x="' + (tx - tw) + '" y="' + ty + '" width="' + tw + '" height="16" rx="3" fill="#ff9f0a" opacity="0.9"/>');
      g.push('<text x="' + (tx - tw / 2) + '" y="' + (ty + 12) + '" fill="#000" font-size="9" text-anchor="middle" font-weight="600">550kN</text>');
      for (i = 0; i < R.convoyPt.length; i++) {
        var px = EL + R.convoyPt[i].x * sx;
        g.push('<line x1="' + px + '" y1="' + (ty + 16) + '" x2="' + px + '" y2="' + (ty + 26) + '" stroke="#ff9f0a" stroke-width="1.5"/>');
        g.push('<circle cx="' + px + '" cy="' + (ty + 28) + '" r="2.6" fill="#ff9f0a"/>');
      }
    }

    g.push('<text x="' + EL + '" y="' + (EH - 8) + '" fill="#636366" font-size="10">变形放大 ×' + (exag > 0 ? fmt(exag, 0) : '—') + '（纵向比例 ' + fmt(sx, 1) + ' px/m）</text>');
    g.push('<text x="' + (EW - ER) + '" y="' + (EH - 8) + '" fill="#636366" font-size="10" text-anchor="end">单位：m · kN · kN·m</text>');

    $('svgElev').innerHTML = g.join('');

    var maxV = 0, ix = 0;
    for (i = 0; i < R.vT.length; i++) if (Math.abs(R.vT[i]) > Math.abs(maxV)) { maxV = R.vT[i]; ix = i; }
    $('elevRead').innerHTML =
      '<b>读图要点：</b>蓝线是主梁在「恒载 + 车队」下的真实变形曲线（已放大）。' +
      '向下凹 = 下缘受拉 = <span class="k">正弯矩区</span>；在中间墩上方向上凸 = <span class="k">负弯矩区</span>，那里裂缝出现在<b>梁顶</b>。' +
      '<br>当前最大竖向位移 <b>' + fmt(maxV * 1000, 1) + ' mm</b>（x = ' + fmt(R.xs[ix], 1) + ' m）。' +
      '挠度限值按 JTG D60-2015 取 <b>L/' + B.DEFLECTION_LIMIT.ratio + '</b>。';
    $('elevHint').textContent = R.convoyOn ? '车队已上桥，内力实时重算' : '拖动下方滑块让车队上桥';
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / e;
    var s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return s * e;
  }

  function renderChart(R, C) {
    var xs = R.xs, total = R.total, sup = R.mesh.supIdx;
    var cx = cxOf(total);
    var mid = PT + (CH - PT - PB) / 2;
    var g = [], i, s;
    var title = '', hint = '', legend = '', read = '';
    var half = (CH - PT - PB) / 2 - 6;

    function X(x) { return PL + x * cx; }

    // 支座竖线
    for (i = 0; i < sup.length; i++) {
      g.push('<line x1="' + X(xs[sup[i]]) + '" y1="' + PT + '" x2="' + X(xs[sup[i]]) + '" y2="' + (CH - PB) + '" stroke="#3a3a3c" stroke-width="0.8" stroke-dasharray="3 3"/>');
    }

    if (S.tab === 'M' || S.tab === 'V') {
      var isM = S.tab === 'M';
      var res = R.resT, key = isM ? 'M' : 'V';
      var vals = [];
      for (i = 0; i < res.length; i++) for (var t = 0; t < res[i][key].length; t++) vals.push(res[i][key][t]);
      var mx = 0;
      for (i = 0; i < vals.length; i++) mx = Math.max(mx, Math.abs(vals[i]));
      var sc = mx > 1e-9 ? half / niceMax(mx) : 1;
      var top = niceMax(mx);

      /* 绘图惯例必须与「弯矩正负号约定」一致，否则图会反过来：
       *   本次采用 M 下缘受拉为正（跨中正弯矩为正）。
       *   → 正弯矩画在轴线【下方】，负弯矩画在【上方】。
       *   所以偏移量 = +1 × M。早期写成 −1，导致简支梁弯矩画到了上方、负弯矩画到了下方。
       * 剪力取负号纯粹是为了「上半部画正剪力」的视觉习惯，不影响数值。 */
      var pts = [];
      for (i = 0; i < res.length; i++) {
        for (var t2 = 0; t2 < res[i][key].length; t2++) {
          pts.push(X(res[i].xs[t2]) + ',' + (mid + (isM ? 1 : -1) * res[i][key][t2] * sc));
        }
      }
      g.push('<line x1="' + PL + '" y1="' + mid + '" x2="' + (CW - PR) + '" y2="' + mid + '" stroke="#48484a" stroke-width="1"/>');
      g.push('<polygon points="' + X(0) + ',' + mid + ' ' + pts.join(' ') + ' ' + X(total) + ',' + mid + '" fill="' + (isM ? 'rgba(10,132,255,.22)' : 'rgba(191,90,242,.22)') + '" stroke="' + (isM ? '#0a84ff' : '#bf5af2') + '" stroke-width="1.8"/>');

      // 标注正负两个极值
      var extP = 0, extPX = 0, extN = 0, extNX = 0;
      for (i = 0; i < res.length; i++) for (var t3 = 0; t3 < res[i][key].length; t3++) {
        var v = res[i][key][t3];
        if (v > extP) { extP = v; extPX = res[i].xs[t3]; }
        if (v < extN) { extN = v; extNX = res[i].xs[t3]; }
      }
      var mkExt = function (val, xx) {
        if (Math.abs(val) < 1e-6) return '';
        var ey = mid + (isM ? 1 : -1) * val * sc;
        var below = (isM ? (val > 0) : (val < 0));
        return '<circle cx="' + X(xx) + '" cy="' + ey + '" r="3.5" fill="#fff"/>' +
          '<text x="' + X(xx) + '" y="' + (ey + (below ? 18 : -11)) + '" fill="#f5f5f7" font-size="11" text-anchor="middle">' + fmt(val, 0) + '</text>';
      };
      g.push(mkExt(extP, extPX) + mkExt(extN, extNX));

      g.push('<text x="' + PL + '" y="' + (PT - 8) + '" fill="#636366" font-size="10">+' + fmt(top, 0) + '</text>');
      g.push('<text x="' + PL + '" y="' + (CH - PB + 14) + '" fill="#636366" font-size="10">−' + fmt(top, 0) + '</text>');

      title = isM ? '弯矩图 M（恒载 + 车队）' : '剪力图 V（恒载 + 车队）';
      hint = isM ? '正弯矩画在下方（受拉侧），单位 kN·m' : '单位 kN';
      legend = '<span><i style="background:' + (isM ? '#0a84ff' : '#bf5af2') + '"></i>' + (isM ? '弯矩' : '剪力') + '</span>';
      read = isM
        ? '<b>读图要点：</b>简支梁弯矩是一条<b>抛物线</b>（均布恒载）叠加车队集中力造成的<b>折线</b>；连续梁在中墩上方出现<b>负弯矩</b>（画在轴线上方），这是连续梁省材料的原因——它把跨中的弯矩"借"给了支点。'
        : '<b>读图要点：</b>剪力图在<b>每个集中轴重处会突变</b>，突变量等于该轴重；在均布荷载段是一条斜线。弯矩的极值出现在<b>剪力为零</b>的位置——这两张图一定要对照看。';

    } else if (S.tab === 'D') {
      var mxv = 0;
      for (i = 0; i < R.vT.length; i++) mxv = Math.max(mxv, Math.abs(R.vT[i]));
      var scd = mxv > 1e-12 ? half / mxv : 1;
      var pd = [];
      for (i = 0; i < xs.length; i++) pd.push(X(xs[i]) + ',' + (mid + R.vT[i] * scd));
      g.push('<line x1="' + PL + '" y1="' + mid + '" x2="' + (CW - PR) + '" y2="' + mid + '" stroke="#48484a" stroke-width="1"/>');
      g.push('<polygon points="' + X(0) + ',' + mid + ' ' + pd.join(' ') + ' ' + X(total) + ',' + mid + '" fill="rgba(48,209,88,.20)" stroke="#30d158" stroke-width="1.8"/>');
      // 限值线
      var lim = Math.max.apply(null, R.P.spans) / B.DEFLECTION_LIMIT.ratio;
      var lyUp = mid - lim * scd, lyDn = mid + lim * scd;
      g.push('<line x1="' + PL + '" y1="' + lyUp + '" x2="' + (CW - PR) + '" y2="' + lyUp + '" stroke="#ff453a" stroke-width="1" stroke-dasharray="6 4"/>');
      g.push('<line x1="' + PL + '" y1="' + lyDn + '" x2="' + (CW - PR) + '" y2="' + lyDn + '" stroke="#ff453a" stroke-width="1" stroke-dasharray="6 4"/>');
      g.push('<text x="' + (CW - PR) + '" y="' + (lyDn + 14) + '" fill="#ff453a" font-size="10" text-anchor="end">L/600 = ±' + fmt(lim * 1000, 0) + ' mm</text>');
      title = '竖向变形（恒载 + 车队）';
      hint = '绿线为实际变形，红色虚线为 L/600 限值';
      legend = '<span><i style="background:#30d158"></i>变形</span><span><i style="background:#ff453a"></i>L/600 限值</span>';
      read = '<b>读图要点：</b>变形曲线是弯矩图的<b>二次积分</b>，所以比弯矩"更平滑"。连续梁因为中墩的负弯矩把跨中"抬"了回来，跨中挠度明显小于同跨径简支梁——这就是连续梁的刚度优势.';

    } else if (S.tab === 'IL') {
      var sIdx = Math.round(S.ilSec * (R.nn - 1));
      var sX = xs[sIdx];
      var mRow = [], vRow = [], p;
      for (p = 0; p < R.nn; p++) { mRow.push(R.Mn[p][sIdx]); vRow.push(R.Vn[p][sIdx]); }
      var mxm = 0, mxv2 = 0;
      for (p = 0; p < R.nn; p++) { mxm = Math.max(mxm, Math.abs(mRow[p])); mxv2 = Math.max(mxv2, Math.abs(vRow[p])); }
      var scm = mxm > 1e-12 ? half / mxm : 1, scv = mxv2 > 1e-12 ? half / mxv2 : 1;
      var pm = [], pv = [];
      for (p = 0; p < R.nn; p++) {
        pm.push(X(xs[p]) + ',' + (mid + mRow[p] * scm));
        pv.push(X(xs[p]) + ',' + (mid - vRow[p] * scv));
      }
      g.push('<line x1="' + PL + '" y1="' + mid + '" x2="' + (CW - PR) + '" y2="' + mid + '" stroke="#48484a" stroke-width="1"/>');
      g.push('<polygon points="' + X(0) + ',' + mid + ' ' + pv.join(' ') + ' ' + X(total) + ',' + mid + '" fill="rgba(255,159,10,.16)" stroke="#ff9f0a" stroke-width="1.6"/>');
      g.push('<polygon points="' + X(0) + ',' + mid + ' ' + pm.join(' ') + ' ' + X(total) + ',' + mid + '" fill="rgba(10,132,255,.16)" stroke="#0a84ff" stroke-width="1.8"/>');
      g.push('<line x1="' + X(sX) + '" y1="' + PT + '" x2="' + X(sX) + '" y2="' + (CH - PB) + '" stroke="#fff" stroke-width="1.2" stroke-dasharray="2 3"/>');
      g.push('<text x="' + X(sX) + '" y="' + (PT - 8) + '" fill="#f5f5f7" font-size="11" text-anchor="middle">截面 x=' + fmt(sX, 1) + ' m</text>');
      title = '影响线（单位竖向力移动时截面内力的变化）';
      hint = '蓝 = 弯矩影响线，橙 = 剪力影响线';
      legend = '<span><i style="background:#0a84ff"></i>M 影响线（纵轴 ' + fmt(mxm, 2) + ' m）</span><span><i style="background:#ff9f0a"></i>V 影响线（纵轴 ' + fmt(mxv2, 2) + '）</span>';
      read = '<b>读图要点：</b>影响线回答的是"<b>荷载放在哪儿最要命</b>"。把均布车道荷载 q<sub>k</sub> 铺在影响线<b>同号</b>的区域、把集中荷载 P<sub>k</sub> 放在影响线<b>峰值</b>上，就得到该截面的最不利内力——这就是右侧包络的算法。' +
        '<br>连续梁的弯矩影响线在相邻跨会<b>反号</b>，所以要隔跨布置车队，这是连续梁与简支梁加载最大的区别。';

    } else if (S.tab === 'ENV') {
      var allM = R.envMmax.concat(R.envMmin);
      var mm = 0;
      for (i = 0; i < allM.length; i++) mm = Math.max(mm, Math.abs(allM[i]));
      var sce = mm > 1e-9 ? half / niceMax(mm) : 1;
      var pmax = [], pmin = [];
      for (i = 0; i < R.nn; i++) {
        pmax.push(X(xs[i]) + ',' + (mid + R.envMmax[i] * sce));
        pmin.push(X(xs[i]) + ',' + (mid + R.envMmin[i] * sce));
      }
      g.push('<line x1="' + PL + '" y1="' + mid + '" x2="' + (CW - PR) + '" y2="' + mid + '" stroke="#48484a" stroke-width="1"/>');
      g.push('<polygon points="' + X(0) + ',' + mid + ' ' + pmax.join(' ') + ' ' + X(total) + ',' + mid + '" fill="rgba(48,209,88,.16)" stroke="#30d158" stroke-width="1.6"/>');
      g.push('<polygon points="' + X(0) + ',' + mid + ' ' + pmin.join(' ') + ' ' + X(total) + ',' + mid + '" fill="rgba(255,69,58,.16)" stroke="#ff453a" stroke-width="1.6"/>');
      title = '弯矩包络图（恒载 + 最不利活载）';
      hint = '绿 = 最大弯矩 Mmax，红 = 最小弯矩 Mmin';
      legend = '<span><i style="background:#30d158"></i>Mmax</span><span><i style="background:#ff453a"></i>Mmin</span>';
      read = '<b>读图要点：</b>包络图就是"<b>每个截面一生中可能遇到的最大和最小弯矩</b>"。设计时把配筋包络线盖住这两条线才安全。注意中墩上方的红色（负弯矩）往往比跨中绿色还大，那里必须配<b>顶部</b>钢筋。';

    } else if (S.tab === 'CHK') {
      return renderCheck(R, C);
    }

    g.push('<line x1="' + PL + '" y1="' + (CH - PB) + '" x2="' + (CW - PR) + '" y2="' + (CH - PB) + '" stroke="#3a3a3c" stroke-width="1"/>');
    for (i = 0; i < sup.length; i++) {
      g.push('<text x="' + X(xs[sup[i]]) + '" y="' + (CH - PB + 16) + '" fill="#636366" font-size="10" text-anchor="middle">' + fmt(xs[sup[i]], 0) + '</text>');
    }
    g.push('<text x="' + (CW - PR) + '" y="' + (CH - PB + 32) + '" fill="#636366" font-size="10" text-anchor="end">x (m)</text>');

    $('svgChart').setAttribute('viewBox', '0 0 ' + CW + ' ' + CH);
    $('svgChart').innerHTML = g.join('');
    $('chartTitle').textContent = title;
    $('chartHint').textContent = hint;
    $('chartLegend').innerHTML = legend;
    $('chartRead').innerHTML = read;
  }

  /** 承载力对比条形图。 */
  function renderCheck(R, C) {
    var b = C.bend, sh = C.shear, df = C.defl;
    var rows = [
      { name: '正截面抗弯 Mu / γ₀Md', cap: b.Mu, dem: C.Md, unit: 'kN·m', note: 'x=' + fmt(R.xs[C.iMax], 1) + ' m' },
      { name: '斜截面抗剪 min(Vcs,Vmax) / γ₀Vd', cap: C.Vgov, dem: Math.abs(C.Vd), unit: 'kN', note: 'x=' + fmt(R.xs[C.iV], 1) + ' m' },
      { name: '截面尺寸上限 Vmax / γ₀Vd', cap: sh.Vmax, dem: Math.abs(C.Vd), unit: 'kN', note: '不发生斜压破坏' },
      { name: '挠度限值 L/600 / 计算值', cap: df.limit, dem: Math.abs(df.worst), unit: 'm', note: '频遇组合' }
    ];
    var g = [], i;
    var top = PT + 6, rowH = 46, barX = 250, barW = CW - PR - barX - 96;
    var mx = 0;
    for (i = 0; i < rows.length; i++) mx = Math.max(mx, rows[i].cap, rows[i].dem);
    $('svgChart').setAttribute('viewBox', '0 0 ' + CW + ' ' + (PT + rows.length * rowH + 30));

    for (i = 0; i < rows.length; i++) {
      var y = top + i * rowH;
      var ok = rows[i].cap >= rows[i].dem;
      var col = ok ? '#30d158' : '#ff453a';
      g.push('<text x="' + PL + '" y="' + (y + 12) + '" fill="#f5f5f7" font-size="12">' + rows[i].name + '</text>');
      g.push('<text x="' + PL + '" y="' + (y + 27) + '" fill="#636366" font-size="10">' + rows[i].note + '</text>');
      // 抗力
      var w1 = rows[i].cap / mx * barW;
      g.push('<rect x="' + barX + '" y="' + (y + 2) + '" width="' + w1 + '" height="13" rx="3" fill="' + col + '" opacity="0.35"/>');
      g.push('<rect x="' + barX + '" y="' + (y + 2) + '" width="' + Math.min(w1, 3) + '" height="13" fill="' + col + '"/>');
      // 需求
      var w2 = rows[i].dem / mx * barW;
      g.push('<rect x="' + barX + '" y="' + (y + 19) + '" width="' + w2 + '" height="13" rx="3" fill="#0a84ff" opacity="0.5"/>');
      var scaleUnit = rows[i].unit === 'm' ? 1000 : 1;
      var suffix = rows[i].unit === 'm' ? ' mm' : ' ' + rows[i].unit;
      g.push('<text x="' + (barX + barW + 8) + '" y="' + (y + 13) + '" fill="' + col + '" font-size="11">' + fmt(rows[i].cap * scaleUnit, 0) + '</text>');
      g.push('<text x="' + (barX + barW + 8) + '" y="' + (y + 30) + '" fill="#85b7eb" font-size="11">' + fmt(rows[i].dem * scaleUnit, 0) + '</text>');
      // 比值
      var ratio = rows[i].dem > 1e-12 ? rows[i].cap / rows[i].dem : 99;
      g.push('<text x="' + (PL + 200) + '" y="' + (y + 20) + '" fill="' + col + '" font-size="12" text-anchor="end">' + (ratio > 99 ? '∞' : fmt(ratio, 2)) + '</text>');
    }
    g.push('<text x="' + barX + '" y="' + (top + rows.length * rowH + 14) + '" fill="#636366" font-size="10">上排 = 抗力（规范公式）　下排 = 需求（荷载组合）　左侧数字 = 抗力/需求</text>');
    $('svgChart').innerHTML = g.join('');
    $('chartTitle').textContent = '承载力与正常使用校核';
    $('chartHint').textContent = '比值 ≥ 1.0 为通过';
    $('chartLegend').innerHTML = '<span><i style="background:#30d158"></i>通过</span><span><i style="background:#ff453a"></i>不通过</span><span><i style="background:#0a84ff"></i>需求</span>';
    $('chartRead').innerHTML = '<b>读图要点：</b>抗力来自<b>截面与配筋</b>，需求来自<b>荷载组合</b>。' +
      '想让比值变大只有三条路：加大截面（H↑ 让 h₀ 变大）、多加钢筋（As↑）、或减小跨度（弯矩按 L² 增长，效果最猛）。' +
      '<br><b>超筋警告</b>：当 x > ξ_b·h₀ 时，钢筋还没屈服混凝土就压碎了，属于<b>脆性破坏</b>，此时再加钢筋也没用——必须加大截面或提高混凝土等级。';
  }

  /* ==========================================================================
   * 计算书
   * ========================================================================== */
  function renderReport(R, C) {
    var P = R.P, h = [];
    var b = C.bend, sh = C.shear, df = C.defl, rebar = C.rebar;

    h.push(sec('1 · 截面特性', [
      kv('截面形式', ({ box: '单箱单室', T: 'T 形', rect: '矩形' })[P.secKind]),
      kv('面积 A', fmt(R.sec.A, 3) + ' m²'),
      kv('惯性矩 I', fmt(R.sec.I, 4) + ' m⁴'),
      kv('形心距底缘', fmt(R.sec.ybar, 3) + ' m'),
      kv('抗弯模量 W下', fmt(R.sec.Wbot, 3) + ' m³')
    ]));

    h.push('<div class="formula">A = Σbᵢhᵢ = <em>' + fmt(R.sec.A, 3) + '</em> m²　　I = Σ(bᵢhᵢ³/12 + bᵢhᵢdᵢ²) = <em>' + fmt(R.sec.I, 4) + '</em> m⁴</div>');
    h.push('<div class="cite">I 直接决定刚度：变形与 I 成反比，而梁高 H 以<b>三次方</b>贡献 I —— 加高 10% 梁高，刚度涨约 33%。</div>');

    h.push(sec('2 · 荷载', [
      kv('主梁自重 g₁ = γ·A', fmt(R.g1, 2) + ' kN/m'),
      kv('二期恒载 g₂', fmt(P.g2, 1) + ' kN/m'),
      kv('恒载合计 g', fmt(R.gDead, 2) + ' kN/m'),
      kv('车道均布荷载 qₖ', fmt(R.lane.qk, 2) + ' kN/m'),
      kv('车道集中荷载 Pₖ', fmt(R.lane.Pk, 1) + ' kN'),
      kv('冲击系数 μ', fmt(R.mu, 3)),
      kv('横向分布系数 m', fmt(R.m, 3) + (P.mMode === 'ecc' ? '（偏心压力法）' : '（手动）')),
      kv('多车道折减 ξ', fmt(R.xi, 2)),
      kv('综合放大 (1+μ)·m·ξ', fmt(R.amp, 3))
    ]));
    h.push('<div class="formula">Pₖ = 180 + (360−180)·(L₀−5)/45 = <em>' + fmt(R.lane.Pk, 1) + '</em> kN　（L₀ = ' + fmt(R.L0, 1) + ' m）</div>');
    h.push('<div class="formula">μ = 0.1767·ln f₁ − 0.0157 = <em>' + fmt(R.mu, 3) + '</em>　（f₁ ≈ ' + fmt(R.fq, 3) + ' Hz，按简支梁基频公式估算）</div>');
    if (P.mMode === 'ecc') {
      h.push('<div class="formula">m = n<sub>车道</sub>/n + n<sub>车道</sub>·a·e/Σa² → ξ·m 取大 = <em>' + fmt(R.m, 3) + '</em>（' + R.tf.nl + ' 车道控制，' + R.tf.girder + ' 号梁）</div>');
      h.push('<div class="cite">' + esc(R.tf.cite) + '。当前宽跨比 W/L = ' + fmt(R.W / R.L0, 2) + (R.W / R.L0 > 0.5 ? ' <b style="color:#ff9f0a">＞ 0.5，刚性横梁法可能偏不安全，宜用 G-M 法</b>' : '，在适用范围内') + '。</div>');
    }
    h.push('<div class="cite">' + esc(R.lane.cite) + '　' + esc(B.COMBINE.cite) + '</div>');

    h.push(sec('3 · 内力（影响线最不利布载）', [
      kv('恒载最大弯矩', fmt(Math.max.apply(null, R.nodalD.M), 0) + ' kN·m'),
      kv('弯矩包络 Mmax', fmt(Math.max.apply(null, R.envMmax), 0) + ' kN·m'),
      kv('弯矩包络 Mmin', fmt(Math.min.apply(null, R.envMmin), 0) + ' kN·m'),
      kv('剪力包络 Vmax', fmt(Math.max.apply(null, R.envVmax), 0) + ' kN'),
      kv('剪力包络 Vmin', fmt(Math.min.apply(null, R.envVmin), 0) + ' kN')
    ]));
    h.push('<div class="formula">S<sub>Q</sub> = (1+μ)·m·ξ·[ qₖ·∫IL<sub>+</sub>dx + Pₖ·IL<sub>peak</sub> ]</div>');
    h.push('<div class="cite">均布荷载铺在影响线同号区、集中荷载放在影响线峰值，取正负两种布置各算一次 —— 这是桥梁与建筑结构加载最大的区别。</div>');

    h.push(sec('4 · 作用组合', [
      kv('结构重要性系数 γ₀', fmt(C.g0, 2)),
      kv('永久作用 γG', fmt(B.COMBINE.gammaG, 1)),
      kv('汽车荷载 γQ', fmt(B.COMBINE.gammaQ, 1)),
      kv('γ₀Md 最大正弯矩', fmt(C.Md, 0) + ' kN·m（x=' + fmt(R.xs[C.iMax], 1) + ' m）'),
      kv('γ₀Md 最大负弯矩', fmt(C.Mn, 0) + ' kN·m（x=' + fmt(R.xs[C.iMin], 1) + ' m）'),
      kv('γ₀Vd 控制剪力', fmt(C.Vd, 0) + ' kN（x=' + fmt(R.xs[C.iV], 1) + ' m）')
    ]));
    h.push('<div class="formula">γ₀M<sub>d</sub> = γ₀(γG·M<sub>G</sub> + γQ·M<sub>Q</sub>) = ' + fmt(C.g0, 2) + '×(' + fmt(B.COMBINE.gammaG, 1) + '×' + fmt(R.nodalD.M[C.iMax], 0) + ' + ' + fmt(B.COMBINE.gammaQ, 1) + '×' + fmt(R.liveMmax[C.iMax], 0) + ') = <em>' + fmt(C.Md, 0) + '</em> kN·m</div>');

    // 抗弯
    h.push(sec('5 · 正截面抗弯', [
      kv('受压翼缘宽 bf', fmt(C.bf, 2) + ' m'),
      kv('翼缘/顶板厚 hf', fmt(C.hf, 2) + ' m'),
      kv('有效高度 h₀', fmt(b.h0, 3) + ' m'),
      kv('受拉钢筋 As', fmt(P.As * 10000, 0) + ' cm²（' + rebar.name + ' f_sd=' + rebar.fsd + '）'),
      kv('受压区高度 x', fmt(b.x, 3) + ' m（' + (b.kind === 'T' ? '第二类 T 形' : '矩形截面') + '）'),
      kv('相对受压区 ξ = x/h₀', fmt(b.xi, 3) + '　ξ_b = ' + fmt(b.xib, 3)),
      kv('配筋率 ρ', fmt(C.rhoNow * 100, 3) + '%　最小 ' + fmt(C.rhoMin * 100, 3) + '%'),
      kv('抗弯承载力 Mu', fmt(b.Mu, 0) + ' kN·m')
    ]));
    h.push('<div class="formula">x = f<sub>sd</sub>A<sub>s</sub>/(f<sub>cd</sub>b<sub>f</sub>) = <em>' + fmt(b.x, 3) + '</em> m　→　M<sub>u</sub> = f<sub>cd</sub>b x(h₀ − x/2) = <em>' + fmt(b.Mu, 0) + '</em> kN·m</div>');
    var bendOk = b.Mu >= C.Md && !b.over && C.rhoNow >= C.rhoMin;
    h.push('<div class="verdict ' + (bendOk ? 'ok' : (b.over ? 'bad' : 'bad')) + '">' +
      (b.over ? '<b>超筋。</b> ξ = ' + fmt(b.xi, 3) + ' ＞ ξ_b = ' + fmt(b.xib, 3) + '，属脆性破坏。加钢筋无效，应<b>加大梁高</b>或提高混凝土等级。'
        : (b.Mu >= C.Md ? '<b>满足。</b> Mu/Md = ' + fmt(b.Mu / Math.max(C.Md, 1e-9), 2)
          : '<b>不足。</b> Mu = ' + fmt(b.Mu, 0) + ' ＜ γ₀Md = ' + fmt(C.Md, 0) + ' kN·m，需加大 As 或梁高。')) +
      (C.rhoNow < C.rhoMin ? '<br><b>且低于最小配筋率</b> ' + fmt(C.rhoMin * 100, 3) + '%，按构造也要加大 As。' : '') +
      '</div>');
    h.push('<div class="cite">' + esc(b.cite) + '</div>');

    // 抗剪
    h.push(sec('6 · 斜截面抗剪', [
      kv('箍筋', 'Φ' + P.svD + ' @ ' + P.svS + ' mm，' + P.svN + ' 肢'),
      kv('箍筋面积 Asv', fmt(C.Asv, 0) + ' mm²'),
      kv('配箍率 ρsv', fmt(C.rhoSv * 100, 3) + '%'),
      kv('P = 100ρ', fmt(sh.P, 2) + '（≤2.5）'),
      kv('抗剪承载力 Vcs', fmt(sh.Vcs, 0) + ' kN'),
      kv('截面尺寸上限 Vmax', fmt(sh.Vmax, 0) + ' kN'),
      kv('取小值（真正抗力）', fmt(C.Vgov, 0) + ' kN'),
      kv('需求 γ₀Vd', fmt(Math.abs(C.Vd), 0) + ' kN')
    ]));
    h.push('<div class="formula">V<sub>cs</sub> = α₁α₂α₃·0.45×10⁻³·b·h₀·√[(2+0.6P)·√f<sub>cu,k</sub>·ρ<sub>sv</sub>·f<sub>sv</sub>] = <em>' + fmt(sh.Vcs, 0) + '</em> kN</div>');
    var shOk = C.Vgov >= Math.abs(C.Vd);
    h.push('<div class="verdict ' + (shOk ? 'ok' : 'bad') + '">' +
      (sh.Vmax < Math.abs(C.Vd)
        ? '<b>截面太小。</b> γ₀Vd = ' + fmt(Math.abs(C.Vd), 0) + ' kN ＞ 斜压上限 ' + fmt(sh.Vmax, 0) + ' kN，会发生斜压破坏，必须<b>加大腹板宽或梁高</b>（加密箍筋无效）。'
        : (sh.Vcs >= Math.abs(C.Vd)
          ? '<b>满足。</b> Vcs/Vd = ' + fmt(sh.Vcs / Math.max(Math.abs(C.Vd), 1e-9), 2)
          : '<b>不足。</b> 需减小箍筋间距或加大肢数/直径。')) +
      '</div>');
    h.push('<div class="cite">' + esc(sh.cite) + '</div>');

    // 挠度
    h.push(sec('7 · 正常使用（挠度）', [
      kv('频遇组合值系数 ψf', fmt(B.COMBINE.psiF, 2)),
      kv('控制跨径 L', fmt(Math.max.apply(null, P.spans), 1) + ' m'),
      kv('限值 L/600', fmt(df.limit * 1000, 1) + ' mm'),
      kv('计算最大挠度', fmt(Math.abs(df.worst) * 1000, 1) + ' mm'),
      kv('位置', 'x = ' + fmt(df.worstX, 1) + ' m')
    ]));
    var dfOk = Math.abs(df.worst) <= df.limit;
    h.push('<div class="verdict ' + (dfOk ? 'ok' : 'warn') + '">' +
      (dfOk ? '<b>满足。</b> ' + fmt(Math.abs(df.worst) * 1000, 1) + ' mm ≤ ' + fmt(df.limit * 1000, 1) + ' mm，富余 ' + fmt((1 - Math.abs(df.worst) / df.limit) * 100, 0) + '%。'
        : '<b>超限。</b> 挠度 ' + fmt(Math.abs(df.worst) * 1000, 1) + ' mm ＞ ' + fmt(df.limit * 1000, 1) + ' mm。加高梁（I 按 H³ 涨）<b>比加钢筋有效得多</b>。') +
      '</div>');
    h.push('<div class="cite">' + esc(df.cite) + '。计算取恒载 + ψf×汽车荷载（<b>不计冲击</b>）。</div>');

    // 支座反力
    var rk = Object.keys(R.RD), rl = [];
    for (var i = 0; i < R.mesh.supIdx.length; i++) {
      var idx = R.mesh.supIdx[i];
      rl.push(kv('支座 ' + (i + 1) + '（x=' + fmt(R.xs[idx], 1) + ' m）', fmt(R.RD[idx] || 0, 0) + ' kN'));
    }
    h.push(sec('8 · 恒载支座反力', rl));

    $('report').innerHTML = h.join('');
  }

  function sec(title, items) {
    return '<div class="rep-sec"><h4>' + title + '</h4>' + items.join('') + '</div>';
  }
  function kv(k, v) {
    return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>';
  }

  /* ==========================================================================
   * 模块面板：拱桥 / 斜拉桥 / 悬索桥 / 桥墩 / 水文
   * 数据层（systems.js / pier.js / hydrology.js）返回统一结构
   *   { report:[{label,value,note}], checks:[{label,value,limit,pass,note}] }
   * ========================================================================== */

  function trimNum(v) { return (+v).toFixed(4).replace(/\.?0+$/, ''); }

  /** 通用报告渲染：report 列表 + checks 判定。返回通过数。 */
  function renderReportList(report, checks) {
    var h = [], i, npass = 0;
    h.push('<div class="rep-sec"><h4>计算结果</h4>');
    for (i = 0; i < report.length; i++) {
      h.push('<div class="kv"><span>' + esc(report[i].label) + '</span><b>' + esc(report[i].value) + '</b></div>');
      if (report[i].note) h.push('<div class="cite" style="margin:1px 0 5px">' + esc(report[i].note) + '</div>');
    }
    h.push('</div>');
    if (checks && checks.length) {
      h.push('<div class="rep-sec"><h4>验算</h4>');
      for (i = 0; i < checks.length; i++) {
        var c = checks[i];
        if (c.pass) npass++;
        h.push('<div class="chk"><span>' + esc(c.label) + '</span><b>' + esc(c.value) +
          ' <span style="color:var(--text-3)">/ ' + esc(c.limit) + '</span>' +
          '<span class="tag ' + (c.pass ? 'ok' : 'bad') + '">' + (c.pass ? '通过' : '超限') + '</span></b></div>');
        if (c.note) h.push('<div class="cite" style="margin:0 0 3px">' + esc(c.note) + '</div>');
      }
      h.push('</div>');
    }
    $('report').innerHTML = h.join('');
    return { pass: npass, total: checks ? checks.length : 0 };
  }

  /* ---------- 体系桥：读参数 ---------- */
  function sysParams(kind) {
    if (kind === 'arch') return {
      L: +$('aL').value, f: +$('aF').value,
      axisKind: segVal('aAxis'), m: +$('aM').value,
      deckH: +$('aDeckH').value, colS: +$('aColS').value,
      qD: +$('aQ').value, grade: $('aGrade').value,
      hinged: segVal('aHinge') === 'hinged',
      archSec: { A: +$('aAA').value, I: +$('aAI').value },
      deckSec: { A: +$('aDA').value, I: +$('aDI').value }
    };
    if (kind === 'cable') return {
      L: +$('cL').value, Ht: +$('cHt').value, fanS: Math.round(+$('cFan').value),
      anchorSpan: +$('cAnch').value, qD: +$('cQ').value, cableA: +$('cCA').value,
      grade: $('cGrade').value,
      beamSec: { A: +$('cBA').value, I: +$('cBI').value },
      towerEA: +$('cTEA').value * 1e9, towerEI: +$('cTEI').value * 1e8, iters: 8
    };
    return {
      L: +$('sL').value, f: +$('sF').value, hangerS: +$('sHang').value,
      qD: +$('sQ').value, towerH: +$('sTH').value, cableA: +$('sCA').value,
      grade: $('sGrade').value,
      deckSec: { A: +$('sDA').value, I: +$('sDI').value },
      towerEA: +$('sTEA').value * 1e9, towerEI: +$('sTEI').value * 1e8
    };
  }

  /** chart 数组求边界。 */
  function chartBounds(chart) {
    var x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18, i;
    for (i = 0; i < chart.length; i++) {
      var c = chart[i];
      x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
      y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
      if (c.x2 !== undefined) { x0 = Math.min(x0, c.x2); x1 = Math.max(x1, c.x2); }
      if (c.y2 !== undefined) { y0 = Math.min(y0, c.y2); y1 = Math.max(y1, c.y2); }
    }
    if (y0 > 0) y0 = 0;                       // 拱/梁在 y≥0，塔向下延伸时 y0<0
    return { x0: x0, x1: x1, y0: y0, y1: y1 };
  }

  var SYSSTYLE = {
    deck:  { w: 4,   col: '#3a3a3c' },
    beam:  { w: 4,   col: '#3a3a3c' },
    arch:  { w: 3.5, col: '#48484a' },
    tower: { w: 5,   col: '#48484a' },
    col:   { w: 2.5, col: '#48484a' },
    cable: { w: 1.4, col: '#0a84ff' },
    hanger:{ w: 1,   col: '#636366' }
  };

  /** 体系桥立面：几何 + 变形（变形自动放大）。 */
  function sysElevation(out, readHtml) {
    var chart = out.chart, nodes = out.nodes;
    var res = out.model.solveF(out.loadCase);
    var d = res && res.ok ? res.d : null;
    var b = chartBounds(chart);
    var mx = 46, mt = 30, padB = 42;
    var sx = (EW - EL - ER) / Math.max(1e-9, b.x1 - b.x0);
    var sy = (EH - mt - padB) / Math.max(1e-9, b.y1 - b.y0);
    var sc = Math.min(sx, sy);
    var ox = EL + (EW - EL - ER - (b.x1 - b.x0) * sc) / 2;
    var oy = mt + (b.y1) * sc + (EH - mt - padB - (b.y1 - b.y0) * sc) / 2;
    function X(x) { return ox + (x - b.x0) * sc; }
    function Y(y) { return oy - y * sc; }
    var g = [], i;

    // 地面线（y=0）
    if (b.y0 < 0.5) g.push('<line x1="' + EL + '" y1="' + Y(0) + '" x2="' + (EW - ER) + '" y2="' + Y(0) + '" stroke="#2c2c2e" stroke-width="1"/>');

    // 几何：先折线类（deck/beam/arch/cable 折线），再连线类
    var seq = { deck: [], beam: [], arch: [], cable: [] };
    for (i = 0; i < chart.length; i++) {
      var c = chart[i], st = SYSSTYLE[c.type];
      if (!st) continue;
      if (c.x2 !== undefined) {
        g.push('<line x1="' + X(c.x) + '" y1="' + Y(c.y) + '" x2="' + X(c.x2) + '" y2="' + Y(c.y2) + '" stroke="' + st.col + '" stroke-width="' + st.w + '"' + (c.type === 'cable' || c.type === 'hanger' ? ' opacity="0.85"' : '') + '/>');
      } else if (seq[c.type]) {
        seq[c.type].push(X(c.x) + ',' + Y(c.y));
      }
    }
    var seqCol = { deck: '#3a3a3c', beam: '#3a3a3c', arch: '#48484a', cable: '#0a84ff' };
    var seqW = { deck: 4, beam: 4, arch: 3.5, cable: 2 };
    for (var t in seq) {
      if (seq[t].length > 1) g.push('<polyline points="' + seq[t].join(' ') + '" fill="none" stroke="' + seqCol[t] + '" stroke-width="' + seqW[t] + '" stroke-linejoin="round"/>');
    }

    // 变形
    var mag = 0, exag = 0;
    if (d) {
      var vmax = 0;
      for (i = 0; i < nodes.length; i++) vmax = Math.max(vmax, Math.abs(d[i * 3 + 1] || 0), Math.abs(d[i * 3] || 0));
      if (vmax > 1e-12) {
        mag = 30 / vmax;
        // 按 tag 分段画变形线：拱圈/桥面/塔/索是独立的节点序列，
        // 直接顺序连线会在序列切换处出现横穿全桥的"飞线"
        var segsD = [], curD = null, curTag = null;
        for (i = 0; i < nodes.length; i++) {
          var tg = nodes[i].tag || '';
          if (tg !== curTag) {
            if (curD && curD.length > 1) segsD.push(curD);
            curD = []; curTag = tg;
          }
          curD.push(X(nodes[i].x + (d[i * 3] || 0)) + ',' + Y(nodes[i].y + (d[i * 3 + 1] || 0)));
        }
        if (curD && curD.length > 1) segsD.push(curD);
        for (i = 0; i < segsD.length; i++) {
          g.push('<polyline points="' + segsD[i].join(' ') + '" fill="none" stroke="#0a84ff" stroke-width="1.6" opacity="0.9" stroke-linejoin="round"/>');
        }
        exag = mag / sc;
      }
    }
    g.push('<text x="' + EL + '" y="' + (EH - 8) + '" fill="#636366" font-size="10">' + (d ? '变形放大 ×' + fmt(exag, 0) + '（纵向 ' + fmt(sc, 1) + ' px/m）' : '求解失败，仅显示几何') + '</text>');
    g.push('<text x="' + (EW - ER) + '" y="' + (EH - 8) + '" fill="#636366" font-size="10" text-anchor="end">单位：m · kN</text>');
    $('svgElev').setAttribute('viewBox', '0 0 ' + EW + ' ' + EH);
    $('svgElev').innerHTML = g.join('');
    $('elevRead').innerHTML = readHtml;
    $('elevHint').textContent = '恒载成桥状态 · 变形已放大';
  }

  /** 体系桥内力图：arch 画轴力 N，cable/susp 画弯矩 M。 */
  function sysForceChart(out, kind) {
    var model = out.model, elems = out.elems, nodes = out.nodes;
    var res = model.solveF(out.loadCase);
    var g = [];
    if (!res || !res.ok) {
      $('svgChart').innerHTML = '<text x="60" y="120" fill="#ff8f88" font-size="13">刚度矩阵奇异：结构为机构或缺少约束</text>';
      $('chartTitle').textContent = '内力图';
      $('chartHint').textContent = '求解失败';
      $('chartLegend').innerHTML = '';
      $('chartRead').innerHTML = '<b>排查方向：</b>检查约束是否足够、是否存在只连索的悬空节点、索是否全部松弛。';
      return;
    }
    var d = res.d;
    var isN = kind === 'arch';
    var b = chartBounds(out.chart);
    var mt2 = 26, pb2 = 40;
    var cx2 = (CW - PL - PR) / Math.max(1e-9, b.x1 - b.x0);
    var mid = mt2 + (CH - mt2 - pb2) / 2;
    var half = (CH - mt2 - pb2) / 2 - 8;
    function X(x) { return PL + (x - b.x0) * cx2; }

    // 逐单元端部值
    var rows = [], mx = 0;
    for (var e = 0; e < elems.length; e++) {
      var el = elems[e];
      if (el.type === 'truss' && !isN) continue;          // M 图跳过索
      var ef = model.elemForces(el, d);
      if (!ef) continue;
      var ni = nodes[el.i], nj = nodes[el.j];
      var vi, vj;
      if (isN) { vi = ef.N; vj = ef.N; }
      else { vi = ef.Mi; vj = -ef.Mj; }
      if (!isFinite(vi) || !isFinite(vj)) continue;
      rows.push({ xi: ni.x, xj: nj.x, vi: vi, vj: vj });
      mx = Math.max(mx, Math.abs(vi), Math.abs(vj));
    }
    var top = niceMax(mx);
    var sc2 = mx > 1e-12 ? half / top : 1;
    for (var r = 0; r < rows.length; r++) {
      var rw = rows[r];
      var y1 = mid + rw.vi * sc2, y2 = mid + rw.vj * sc2;
      g.push('<polygon points="' + X(rw.xi) + ',' + mid + ' ' + X(rw.xi) + ',' + y1 + ' ' + X(rw.xj) + ',' + y2 + ' ' + X(rw.xj) + ',' + mid + '" fill="' + (isN ? 'rgba(191,90,242,.20)' : 'rgba(10,132,255,.18)') + '" stroke="none"/>');
      g.push('<line x1="' + X(rw.xi) + '" y1="' + y1 + '" x2="' + X(rw.xj) + '" y2="' + y2 + '" stroke="' + (isN ? '#bf5af2' : '#0a84ff') + '" stroke-width="0.9" opacity="0.8"/>');
    }
    // 极值
    var eP = 0, ePx = 0, eN = 0, eNx = 0;
    for (r = 0; r < rows.length; r++) {
      if (rows[r].vi > eP) { eP = rows[r].vi; ePx = rows[r].xi; }
      if (rows[r].vj > eP) { eP = rows[r].vj; ePx = rows[r].xj; }
      if (rows[r].vi < eN) { eN = rows[r].vi; eNx = rows[r].xi; }
      if (rows[r].vj < eN) { eN = rows[r].vj; eNx = rows[r].xj; }
    }
    g.push('<line x1="' + PL + '" y1="' + mid + '" x2="' + (CW - PR) + '" y2="' + mid + '" stroke="#48484a" stroke-width="1"/>');
    g.push('<text x="' + PL + '" y="' + (mt2 - 8) + '" fill="#636366" font-size="10">' + (isN ? '压 ' : '−') + fmt(top, 0) + '</text>');
    g.push('<text x="' + PL + '" y="' + (CH - pb2 + 14) + '" fill="#636366" font-size="10">' + (isN ? '拉 ' : '+') + fmt(top, 0) + '</text>');
    if (eP > 1e-9) g.push('<circle cx="' + X(ePx) + '" cy="' + (mid + eP * sc2) + '" r="3" fill="#fff"/>');
    if (eN < -1e-9) g.push('<circle cx="' + X(eNx) + '" cy="' + (mid + eN * sc2) + '" r="3" fill="#fff"/>');
    g.push('<line x1="' + PL + '" y1="' + (CH - pb2) + '" x2="' + (CW - PR) + '" y2="' + (CH - pb2) + '" stroke="#3a3a3c" stroke-width="1"/>');
    g.push('<text x="' + (CW - PR) + '" y="' + (CH - pb2 + 24) + '" fill="#636366" font-size="10" text-anchor="end">x (m)</text>');
    $('svgChart').setAttribute('viewBox', '0 0 ' + CW + ' ' + CH);
    $('svgChart').innerHTML = g.join('');
  }

  var SYS_READS = {
    arch: '<b>读图要点：</b>灰线是拱圈与桥面，蓝线是恒载下的变形（已放大）。拱的合理轴线应使恒载弯矩接近零——内力主要变成<b>沿拱轴的压力</b>，所以拱桥能用砖石混凝土这些抗压材料建造。立柱把桥面荷载传给拱圈，拱脚处推力最大。',
    cable: '<b>读图要点：</b>双塔的扇形索像"弹性支座"把主梁吊住——索越密，主梁弯矩越小。塔顶无背索侧靠塔身受弯平衡，注意塔身反弯点。若某根索在恒载下变松弛（索力&lt;0），说明初始索力布置不合理，计算书会如实报告。',
    susp: '<b>读图要点：</b>主缆（蓝线）呈抛物线形，把加劲梁用吊索"提"住；加劲梁弯矩很小（<30% 同跨简支梁），荷载主要由主缆轴向拉力承担。塔把主缆的竖向分力传给基础，水平分力由两端锚碇平衡——本简化模型无端锚边跨，挠度偏大属正常。'
  };
  var SYS_CHART_META = {
    arch:  { title: '轴力图 N（恒载）', hint: '拉为正、压为负，单位 kN · 拱圈以压为主', legend: '<span><i style="background:#bf5af2"></i>轴力 N</span>', read: '<b>读图要点：</b>拱圈轴力从拱顶向拱脚逐渐增大，拱脚处最大（压力）。轴力"负得越多"说明压力越大——把这条曲线和弯矩图对照看：合理拱轴线应让<b>轴力占绝对主导、弯矩接近零</b>。' },
    cable: { title: '弯矩图 M（恒载）', hint: '单位 kN·m · 含塔与主梁', legend: '<span><i style="background:#0a84ff"></i>弯矩 M</span>', read: '<b>读图要点：</b>和简支梁的抛物线弯矩比，斜拉桥主梁弯矩被索"切"成小段、幅值大幅下降——这就是斜拉桥能跨 400~1000m 的原因。塔根处弯矩最大，塔身以悬臂受力为主。' },
    susp:  { title: '加劲梁弯矩 M（恒载）', hint: '单位 kN·m · 线性简化模型', legend: '<span><i style="background:#0a84ff"></i>弯矩 M</span>', read: '<b>读图要点：</b>悬索桥加劲梁弯矩非常小（通常 &lt; 同跨简支梁的 30%），因为荷载被主缆-吊索系统承担了。对比梁桥模块同跨径的弯矩图，能直观看到"缆索承重体系"的优势。' }
  };

  function renderSysMod(kind) {
    var SYS = window.SYSTEMS;
    var P = sysParams(kind);
    var out = kind === 'arch' ? SYS.buildArch(P) : kind === 'cable' ? SYS.buildCableStayed(P) : SYS.buildSuspension(P);
    sysElevation(out, SYS_READS[kind]);
    sysForceChart(out, kind);
    $('elevTitle').textContent = { arch: '拱桥立面与变形', cable: '斜拉桥立面与变形', susp: '悬索桥立面与变形' }[kind];
    var meta = SYS_CHART_META[kind];
    $('chartTitle').textContent = meta.title;
    $('chartHint').textContent = meta.hint;
    $('chartLegend').innerHTML = meta.legend;
    $('chartRead').innerHTML = meta.read;
    var rc = renderReportList(out.report, out.checks);
    $('pillMesh').textContent = out.nodes.length + ' 节点 / ' + out.elems.length + ' 单元';
    if (rc.total) {
      var allOk = rc.pass === rc.total;
      $('pillValid').textContent = '验算 ' + rc.pass + '/' + rc.total + ' 项通过';
      $('pillValid').className = 'pill ' + (allOk ? 'ok' : 'warn');
    } else {
      $('pillValid').textContent = '—';
      $('pillValid').className = 'pill';
    }
  }

  /* ---------- 桥墩与桩基 ---------- */
  function renderPierMod() {
    var PIER = window.PIER;
    var kind = segVal('pShapeKind');
    var shape = kind === 'circle' ? { kind: 'circle', D: +$('pD').value }
      : kind === 'rect' ? { kind: 'rect', b: +$('pPB').value, h: +$('pH2').value }
        : { kind: 'roundRect', B: Math.max(+$('pPB').value, +$('pRRH').value + 0.2), H: +$('pRRH').value };
    var sec = PIER.discretize(shape, 200);
    var As = (+$('pRho').value / 100) * sec.A;
    var grade = $('pPGrade').value, rebar = $('pPRebar').value;
    var as = +$('pAsD').value, l0 = +$('pL0').value;
    var Nd = +$('pNd').value, Md = +$('pMd').value;
    var ec = PIER.eccentricCompression({ shape: shape, grade: grade, rebar: rebar, As: As, a_s: as, l0: l0, Nd: Nd, Md: Md });
    var cw = PIER.crackWidth({ shape: shape, rebar: rebar, As: As, a_s: as, Ns: +$('pNs').value, Ms: +$('pMs').value, dBar: +$('pDBar').value });
    var pile = PIER.pileCapacity({
      D: +$('pPD').value,
      layers: [{ qik: +$('pQ1').value, thickness: +$('pPT1').value }, { qik: +$('pQ2').value, thickness: +$('pPT2').value }],
      m0: +$('pM0').value, lambda: +$('pLam').value, fa0: +$('pFa0').value,
      k2: +$('pK2').value, gamma2: +$('pG2s').value, h: +$('pPH').value
    });
    $('vpA').textContent = fmt(sec.A, 2) + ' m²';

    /* 立面：墩柱 + 地面 + 桩与土层 */
    var g = [], i;
    var colW = kind === 'circle' ? shape.D : (kind === 'rect' ? shape.b : shape.B);
    var colH = Math.max(l0, 4);
    var pileL = (+$('pPT1').value) + (+$('pPT2').value);
    var totalH = colH + pileL;
    var base = 26, sx = 60, sy = (EH - 70) / totalH;
    var cxM = 300;
    function YY(yUp) { return base + (totalH - yUp) * sy; }   // yUp 从桩底量起
    // 土层（土层①从地面向下，符合地质惯例：浅层软、深层硬）
    var yAcc = pileL;
    var layers = [{ q: +$('pQ1').value, t: +$('pPT1').value }, { q: +$('pQ2').value, t: +$('pPT2').value }];
    for (i = 0; i < layers.length; i++) {
      var y1 = YY(yAcc), y2 = YY(yAcc - layers[i].t);
      var yTop = Math.min(y1, y2), layerH = Math.abs(y2 - y1);
      g.push('<rect x="' + (cxM - 230) + '" y="' + yTop + '" width="460" height="' + layerH + '" fill="' + (i === 0 ? '#1c1c1e' : '#242426') + '" stroke="#3a3a3c" stroke-width="0.6"/>');
      g.push('<text x="' + (cxM + 236) + '" y="' + ((y1 + y2) / 2 + 3) + '" fill="#636366" font-size="10">土层' + (i + 1) + '　qik=' + layers[i].q + ' kPa　' + layers[i].t + ' m</text>');
      yAcc -= layers[i].t;
    }
    // 地面线（yUp 从桩底量起：桩底 0 → 地面 pileL → 柱顶 totalH）
    g.push('<line x1="' + (cxM - 250) + '" y1="' + YY(pileL) + '" x2="' + (cxM + 250) + '" y2="' + YY(pileL) + '" stroke="#48484a" stroke-width="1.2"/>');
    g.push('<text x="' + (cxM - 248) + '" y="' + (YY(pileL) - 5) + '" fill="#636366" font-size="10">地面</text>');
    // 墩柱（地面以上 l₀）
    var dw = Math.max(14, colW * sx * 0.6);
    g.push('<rect x="' + (cxM - dw / 2) + '" y="' + YY(totalH) + '" width="' + dw + '" height="' + (YY(pileL) - YY(totalH)) + '" rx="2" fill="#2c2c2e" stroke="#636366" stroke-width="1"/>');
    // 桩（地面以下 pileL）——用亮描边与土层底色区分
    var pw = Math.max(12, +$('pPD').value * sx * 0.6);
    g.push('<rect x="' + (cxM - pw / 2) + '" y="' + YY(pileL) + '" width="' + pw + '" height="' + (YY(0) - YY(pileL)) + '" fill="#3a3a3c" stroke="#98989d" stroke-width="1"/>');
    // 尺寸标注
    g.push('<text x="' + (cxM - dw / 2 - 8) + '" y="' + ((YY(pileL) + YY(totalH)) / 2 + 3) + '" fill="#98989d" font-size="10" text-anchor="end">l₀=' + fmt(l0, 1) + ' m</text>');
    g.push('<text x="' + (cxM - pw / 2 - 8) + '" y="' + ((YY(0) + YY(pileL)) / 2 + 3) + '" fill="#98989d" font-size="10" text-anchor="end">桩 D=' + $('pPD').value + ' m</text>');
    g.push('<text x="' + (cxM + dw / 2 + 8) + '" y="' + (YY(totalH) + 12) + '" fill="#636366" font-size="10">柱 ' + (kind === 'circle' ? 'D=' + shape.D : kind === 'rect' ? 'b×h=' + shape.b + '×' + shape.h : 'B×H=' + shape.B.toFixed(1) + '×' + shape.H) + ' m</text>');

    // 截面草图（右上角）
    var sx0 = 700, sy0 = 40, ss = 52 / Math.max(colW, kind === 'rect' ? shape.h : shape.D);
    if (kind === 'circle') {
      g.push('<circle cx="' + sx0 + '" cy="' + sy0 + '" r="' + shape.D * ss / 2 + '" fill="none" stroke="#98989d" stroke-width="1.4"/>');
    } else if (kind === 'rect') {
      g.push('<rect x="' + (sx0 - shape.b * ss / 2) + '" y="' + (sy0 - shape.h * ss / 2) + '" width="' + shape.b * ss + '" height="' + shape.h * ss + '" fill="none" stroke="#98989d" stroke-width="1.4"/>');
    } else {
      var rR = shape.H * ss / 2, rw = (shape.B - shape.H) * ss;
      g.push('<path d="M' + (sx0 - rw / 2) + ' ' + (sy0 - rR) + ' h' + rw + ' a' + rR + ' ' + rR + ' 0 0 1 0 ' + (2 * rR) + ' h' + (-rw) + ' a' + rR + ' ' + rR + ' 0 0 1 0 ' + (-2 * rR) + '" fill="none" stroke="#98989d" stroke-width="1.4"/>');
    }
    g.push('<text x="' + sx0 + '" y="' + (sy0 + 74) + '" fill="#636366" font-size="10" text-anchor="middle">截面 · ρ=' + (+$('pRho').value).toFixed(1) + '%</text>');
    $('svgElev').setAttribute('viewBox', '0 0 ' + EW + ' ' + EH);
    $('svgElev').innerHTML = g.join('');
    $('elevTitle').textContent = '桥墩立面与地层';
    $('elevRead').innerHTML = '<b>读图要点：</b>墩柱受压弯共同作用（偏心受压），计算长度 l₀ 决定二阶效应大小——l₀ 越大、η 越大，承载力被"打折"越多。桩穿过两层土，侧摩阻沿桩身累计、端阻在桩尖集中，<b>桩越长侧阻占比越高</b>。';
    $('elevHint').textContent = '示意比例，非严格按尺寸';

    /* 图：承载力对比 */
    var rows = [
      { name: '偏心受压 Mu / η·Md', cap: ec.Mu, dem: ec.Mdd, unit: 'kN·m', note: 'η=' + fmt(ec.eta, 3) + '，λ=' + fmt(ec.lambda, 1) },
      { name: '裂缝限值 0.2 / w', cap: 0.2, dem: cw.w, unit: 'mm', note: 'σss=' + fmt(cw.sigmaS, 0) + ' MPa' }
    ];
    var g2 = [], top2 = PT + 6, rowH = 46, barX = 240, barW = CW - PR - barX - 96;
    var mx2 = 0;
    for (i = 0; i < rows.length; i++) mx2 = Math.max(mx2, rows[i].cap, rows[i].dem);
    $('svgChart').setAttribute('viewBox', '0 0 ' + CW + ' ' + (PT + rows.length * rowH + 66));
    for (i = 0; i < rows.length; i++) {
      var y = top2 + i * rowH;
      var ok = rows[i].cap >= rows[i].dem;
      var col = ok ? '#30d158' : '#ff453a';
      g2.push('<text x="' + PL + '" y="' + (y + 12) + '" fill="#f5f5f7" font-size="12">' + rows[i].name + '</text>');
      g2.push('<text x="' + PL + '" y="' + (y + 27) + '" fill="#636366" font-size="10">' + rows[i].note + '</text>');
      var w1 = rows[i].cap / mx2 * barW;
      g2.push('<rect x="' + barX + '" y="' + (y + 2) + '" width="' + w1 + '" height="13" rx="3" fill="' + col + '" opacity="0.35"/>');
      var w2 = rows[i].dem / mx2 * barW;
      g2.push('<rect x="' + barX + '" y="' + (y + 19) + '" width="' + w2 + '" height="13" rx="3" fill="#0a84ff" opacity="0.5"/>');
      g2.push('<text x="' + (barX + barW + 8) + '" y="' + (y + 13) + '" fill="' + col + '" font-size="11">' + fmt(rows[i].cap, 2) + '</text>');
      g2.push('<text x="' + (barX + barW + 8) + '" y="' + (y + 30) + '" fill="#85b7eb" font-size="11">' + fmt(rows[i].dem, 2) + '</text>');
      var ratio = rows[i].dem > 1e-12 ? rows[i].cap / rows[i].dem : 99;
      g2.push('<text x="' + (PL + 190) + '" y="' + (y + 20) + '" fill="' + col + '" font-size="12" text-anchor="end">' + (ratio > 99 ? '∞' : fmt(ratio, 2)) + '</text>');
    }
    // 桩基组成条
    var yP = top2 + rows.length * rowH + 6;
    var sc3 = barW / Math.max(pile.Ra, 1) * 0.9;
    g2.push('<text x="' + PL + '" y="' + (yP + 12) + '" fill="#f5f5f7" font-size="12">单桩 [Ra]</text>');
    g2.push('<rect x="' + barX + '" y="' + (yP + 2) + '" width="' + pile.side * sc3 + '" height="13" rx="3" fill="#40c8e0" opacity="0.55"/>');
    g2.push('<rect x="' + (barX + pile.side * sc3) + '" y="' + (yP + 2) + '" width="' + pile.tip * sc3 + '" height="13" rx="3" fill="#bf5af2" opacity="0.55"/>');
    g2.push('<text x="' + (barX + pile.Ra * sc3 + 8) + '" y="' + (yP + 13) + '" fill="#f5f5f7" font-size="11">' + fmt(pile.Ra, 0) + ' kN</text>');
    g2.push('<text x="' + barX + '" y="' + (yP + 30) + '" fill="#636366" font-size="10">侧阻 ' + fmt(pile.side, 0) + ' kN（青）　端阻 ' + fmt(pile.tip, 0) + ' kN（紫）　D=' + $('pPD').value + ' m</text>');
    $('svgChart').innerHTML = g2.join('');
    $('chartTitle').textContent = '墩柱验算与单桩承载力';
    $('chartHint').textContent = '比值 ≥ 1.0 为通过';
    $('chartLegend').innerHTML = '<span><i style="background:#30d158"></i>通过</span><span><i style="background:#ff453a"></i>超限</span><span><i style="background:#0a84ff"></i>需求</span>';
    $('chartRead').innerHTML = '<b>读图要点：</b>墩柱是<b>压弯构件</b>：轴力越大越"耐压"，但弯矩+二阶效应会吃掉承载力。ρ 配筋率 1%~2% 是常见区间，加太多钢筋对偏心受压承载力帮助有限（混凝土压碎控制）。裂缝宽度超 0.2 mm 时加大配筋或放松截面。';

    /* 报告 */
    var report = [
      { label: '截面形式', value: ({ circle: '圆形', rect: '矩形', roundRect: '圆端形' })[kind] + '　A=' + fmt(sec.A, 2) + ' m²' },
      { label: '配筋 As', value: fmt(As * 10000, 0) + ' cm²（ρ=' + (+$('pRho').value).toFixed(2) + '%）' },
      { label: '偏心距 e₀ = Md/Nd', value: fmt(ec.e0, 3) + ' m' },
      { label: '长细比 λ = l₀/i', value: fmt(ec.lambda, 1) },
      { label: '二阶效应 η', value: fmt(ec.eta, 3), note: 'η·Md 为等效弯矩' },
      { label: 'η·Md', value: fmt(ec.Mdd, 0) + ' kN·m' },
      { label: '偏心受压承载力 Mu', value: fmt(ec.Mu, 0) + ' kN·m' },
      { label: '最大压应力估算', value: fmt(ec.sigmaMax, 2) + ' MPa' },
      { label: '裂缝宽度 w', value: fmt(cw.w, 3) + ' mm', note: 'σss=' + fmt(cw.sigmaS, 0) + ' MPa，z=' + fmt(cw.z, 2) + ' m' },
      { label: '单桩容许承载力 [Ra]', value: fmt(pile.Ra, 0) + ' kN', note: '侧阻 ' + fmt(pile.side, 0) + ' + 端阻 ' + fmt(pile.tip, 0) + ' kN' }
    ];
    var checks = [
      { label: 'η·Md ≤ Mu', value: fmt(ec.Mdd, 0) + ' / ' + fmt(ec.Mu, 0) + ' kN·m', limit: '比值 ≥ 1.0', pass: ec.pass, note: ec.notes ? ec.notes.join('；') : '' },
      { label: 'w ≤ 0.2 mm', value: fmt(cw.w, 3) + ' mm', limit: '≤ 0.2', pass: cw.pass }
    ];
    renderReportList(report, checks);
    $('pillMesh').textContent = '条带法 400 带 · 2 土层';
    var pOk = (ec.pass ? 1 : 0) + (cw.pass ? 1 : 0);
    $('pillValid').textContent = '验算 ' + pOk + '/2 项通过';
    $('pillValid').className = 'pill ' + (pOk === 2 ? 'ok' : 'warn');
  }

  /* ---------- 桥涵水文 ---------- */
  function renderHydroMod() {
    var HYDRO = window.HYDRO;
    var P = {
      bridgeClass: $('hClass').value, roadClass: $('hRoad').value,
      soil: segVal('hSoil'),
      mu: +$('hMu').value, hc: +$('hHc').value, Vc: +$('hVc').value,
      B: +$('hB').value, Hbar: +$('hHbar').value, hmax: +$('hHmax').value,
      Spj: +$('hSpj').value, d: +$('hD').value,
      Kxi: +$('hKxi').value, B1: +$('hB1').value,
      riverbed: +$('hRB').value, dzNatural: +$('hDz').value, dc: +$('hDc').value
    };
    if (segVal('hQMode') === 'rational') P.flow = { psi: +$('hPsi').value, Sp: +$('hSp').value, tau: +$('hTau').value, n: +$('hN').value, F: +$('hF').value };
    else P.Qp = +$('hQp').value;
    if (P.soil === 'clay') P.IL = +$('hIL').value;
    var out = HYDRO.run(P);

    /* 立面：河道剖面 + 桥孔 + 冲刷 + 基底 */
    var rb = P.riverbed;
    var yTop = rb + P.hmax + 3, yBot = out.foundation.Z - 3;
    var mt3 = 16, pb3 = 30;
    var sy2 = (EH - mt3 - pb3) / (yTop - yBot);
    function Y2(z) { return mt3 + (yTop - z) * sy2; }
    var span = Math.max(out.Lj * 1.3, 60);
    var sx3 = (EW - EL - ER) / span;
    function X2(x) { return EL + x * sx3; }
    var g = [];
    // 水
    g.push('<rect x="' + EL + '" y="' + Y2(rb + P.hmax) + '" width="' + (EW - EL - ER) + '" height="' + (Y2(rb) - Y2(rb + P.hmax)) + '" fill="rgba(10,132,255,0.10)"/>');
    g.push('<line x1="' + EL + '" y1="' + Y2(rb + P.hmax) + '" x2="' + (EW - ER) + '" y2="' + Y2(rb + P.hmax) + '" stroke="#0a84ff" stroke-width="1.2" opacity="0.7"/>');
    g.push('<text x="' + (EL + 4) + '" y="' + (Y2(rb + P.hmax) - 4) + '" fill="#85b7eb" font-size="10">设计水位 ' + fmt(rb + P.hmax, 2) + ' m</text>');
    // 原始河床
    g.push('<line x1="' + EL + '" y1="' + Y2(rb) + '" x2="' + (EW - ER) + '" y2="' + Y2(rb) + '" stroke="#8a6d3b" stroke-width="1.6"/>');
    g.push('<text x="' + (EW - ER - 4) + '" y="' + (Y2(rb) - 4) + '" fill="#98989d" font-size="10" text-anchor="end">原河床 ' + fmt(rb, 2) + ' m</text>');
    // 一般冲刷后床面
    var bedAfter = rb - P.dzNatural - out.general.hp;
    g.push('<line x1="' + X2(0) + '" y1="' + Y2(bedAfter) + '" x2="' + X2(out.Lj) + '" y2="' + Y2(bedAfter) + '" stroke="#b08850" stroke-width="1.4"/>');
    // 局部冲刷坑（墩附近）
    var px = out.Lj * 0.45, pwp = Math.max(P.B1 * sx3 * 2, 10);
    var locAfter = bedAfter - out.local.hb;
    g.push('<path d="M' + X2(px - pwp * 2.2) + ' ' + Y2(bedAfter) + ' L' + X2(px - pwp) + ' ' + Y2(locAfter) + ' L' + X2(px + pwp) + ' ' + Y2(locAfter) + ' L' + X2(px + pwp * 2.2) + ' ' + Y2(bedAfter) + '" fill="none" stroke="#b08850" stroke-width="1.4"/>');
    // 桥跨与墩
    g.push('<rect x="' + X2(0) + '" y="' + (Y2(rb + P.hmax) - 8) + '" width="' + (out.Lj * sx3) + '" height="5" rx="2" fill="#3a3a3c"/>');
    g.push('<rect x="' + (X2(px) - 3) + '" y="' + (Y2(rb + P.hmax) - 4) + '" width="6" height="' + (Y2(locAfter) - Y2(rb + P.hmax) + 4) + '" fill="#48484a"/>');
    // 基底高程
    g.push('<line x1="' + X2(px - 26) + '" y1="' + Y2(out.foundation.Z) + '" x2="' + X2(px + 26) + '" y2="' + Y2(out.foundation.Z) + '" stroke="#ff453a" stroke-width="1.6" stroke-dasharray="7 4"/>');
    g.push('<text x="' + X2(px + 30) + '" y="' + (Y2(out.foundation.Z) + 4) + '" fill="#ff8f88" font-size="10.5">基底 ' + fmt(out.foundation.Z, 2) + ' m</text>');
    // 标注
    g.push('<text x="' + (EL + 4) + '" y="' + ((Y2(rb) + Y2(bedAfter)) / 2 + 3) + '" fill="#b08850" font-size="10">自然+一般冲刷 ' + fmt(P.dzNatural + out.general.hp, 2) + ' m</text>');
    g.push('<text x="' + (X2(px) + 8) + '" y="' + ((Y2(bedAfter) + Y2(locAfter)) / 2 + 3) + '" fill="#b08850" font-size="10">局部 ' + fmt(out.local.hb, 2) + ' m</text>');
    g.push('<text x="' + X2(out.Lj / 2) + '" y="' + (Y2(rb + P.hmax) - 14) + '" fill="#98989d" font-size="10.5" text-anchor="middle">桥孔净长 Lj=' + fmt(out.Lj, 1) + ' m　Qp=' + fmt(out.Qp, 0) + ' m³/s</text>');
    $('svgElev').setAttribute('viewBox', '0 0 ' + EW + ' ' + EH);
    $('svgElev').innerHTML = g.join('');
    $('elevTitle').textContent = '河床冲刷与基底埋深';
    $('elevRead').innerHTML = '<b>读图要点：</b>水位漫过桥孔时，流速增大带走河床泥沙：<b>一般冲刷</b>使全床面下降（64-1 修正式），<b>局部冲刷</b>在墩前冲出深坑（65-2 式）。基底必须埋在"总冲刷深度 + 安全值"之下——这就是桥墩基础要埋那么深的原因。';
    $('elevHint').textContent = '示意剖面（按高程真实比例）';

    /* 图：冲刷组成堆叠条 */
    var i;
    var segs2 = [
      { v: P.dzNatural, name: '自然冲刷 Δz', col: '#40c8e0' },
      { v: out.general.hp, name: '一般冲刷 hp', col: '#0a84ff' },
      { v: out.local.hb, name: '局部冲刷 hb', col: '#bf5af2' },
      { v: P.dc, name: '安全值 Δc', col: '#30d158' }
    ];
    var g3 = [], y0c = PT + 34, bh = 40;
    var totW = 0; for (i = 0; i < segs2.length; i++) totW += segs2[i].v;
    var scB = (CW - PL - PR - 120) / Math.max(totW, 1e-9);
    var xc = PL;
    for (i = 0; i < segs2.length; i++) {
      var w = segs2[i].v * scB;
      g3.push('<rect x="' + xc + '" y="' + y0c + '" width="' + w + '" height="' + bh + '" fill="' + segs2[i].col + '" opacity="0.55" rx="2"/>');
      if (w > 46) g3.push('<text x="' + (xc + w / 2) + '" y="' + (y0c + bh / 2 + 4) + '" fill="#fff" font-size="11" text-anchor="middle">' + fmt(segs2[i].v, 2) + '</text>');
      xc += w;
    }
    g3.push('<text x="' + PL + '" y="' + (y0c - 10) + '" fill="#f5f5f7" font-size="12">总冲刷 + 安全值 = ' + fmt(totW, 2) + ' m</text>');
    g3.push('<text x="' + (PL) + '" y="' + (y0c + bh + 30) + '" fill="#636366" font-size="11">基底最小埋深（从原河床算起）＝ ' + fmt(totW, 2) + ' m　→　基底高程 ' + fmt(out.foundation.Z, 2) + ' m</text>');
    var ly = y0c + bh + 56;
    for (i = 0; i < segs2.length; i++) {
      g3.push('<rect x="' + PL + '" y="' + (ly - 8) + '" width="10" height="10" rx="2" fill="' + segs2[i].col + '" opacity="0.7"/>');
      g3.push('<text x="' + (PL + 16) + '" y="' + ly + '" fill="#98989d" font-size="11">' + segs2[i].name + ' = ' + fmt(segs2[i].v, 2) + ' m</text>');
      ly += 20;
    }
    $('svgChart').setAttribute('viewBox', '0 0 ' + CW + ' ' + (ly + 10));
    $('svgChart').innerHTML = g3.join('');
    $('chartTitle').textContent = '冲刷深度组成';
    $('chartHint').textContent = '单位 m';
    $('chartLegend').innerHTML = '';
    $('chartRead').innerHTML = '<b>读图要点：</b>四段相加就是基底要"躲进去"的深度。自然冲刷是河道天然变形；一般冲刷与水流量、单宽流量成正比；局部冲刷与墩宽 B₁、流速超过"起冲流速"的程度有关。想减小冲刷：加大桥孔净长 Lj（流速降下来）、或把墩做成流线形（Kξ 减小）。';

    var rc = renderReportList(out.report, out.checks);
    $('pillMesh').textContent = 'JTG C30-2015 流程';
    $('pillValid').textContent = '验算 ' + rc.pass + '/' + rc.total + ' 项通过';
    $('pillValid').className = 'pill ' + (rc.pass === rc.total ? 'ok' : 'warn');
  }

  /* ==========================================================================
   * 主循环
   * ========================================================================== */
  var dirty = false;
  function schedule() {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(function () { dirty = false; run(); });
  }

  /* 总调度：按当前模块分发 */
  function run() {
    if (S.mod === 'beam') return runBeam();
    try {
      if (S.mod === 'modal3d') return runModal3d();
      if (S.mod === 'arch' || S.mod === 'cable' || S.mod === 'susp') return renderSysMod(S.mod);
      if (S.mod === 'pier') return renderPierMod();
      if (S.mod === 'hydro') return renderHydroMod();
    } catch (err) {
      $('pillValid').textContent = '计算出错：' + (err && err.message ? err.message : err);
      $('pillValid').className = 'pill bad';
    }
  }

  function runBeam() {
    var P = readParams();
    var R = compute(P);
    if (!R) { $('pillValid').textContent = '模型奇异'; $('pillValid').className = 'pill bad'; return; }
    var C = check(R);
    S.last = { R: R, C: C };

    $('pillMesh').textContent = R.nn + ' 节点 / ' + R.els.length + ' 单元';
    $('vA').textContent = fmt(R.sec.A, 3) + ' m²';
    $('vI').textContent = fmt(R.sec.I, 4) + ' m⁴';
    $('vFreq').textContent = fmt(R.fq, 3) + ' Hz';
    var warns = [];
    if (R.W / R.L0 > 0.5 && P.mMode === 'ecc') warns.push('宽跨比超限');
    if (C.bend.over) warns.push('超筋');
    if (Math.abs(C.defl.worst) > C.defl.limit) warns.push('挠度超限');
    if (C.bend.Mu < C.Md) warns.push('抗弯不足');
    if (warns.length) {
      $('pillValid').textContent = warns.join(' · ');
      $('pillValid').className = 'pill bad';
    } else {
      $('pillValid').textContent = '各项验算通过';
      $('pillValid').className = 'pill ok';
    }

    renderElev(R);
    renderChart(R, C);
    renderReport(R, C);
  }

  function runModal3d() {
    if (!window.SPATIAL_BRIDGE) {
      $('pillMesh').textContent = '3D 内核未加载';
      $('pillValid').textContent = '模块加载失败';
      $('pillValid').className = 'pill bad';
      return;
    }
    var spansRaw = $('pSpans').value.split(/[,，\s]+/).map(parseFloat).filter(function (v) {
      return isFinite(v) && v > 0;
    });
    if (!spansRaw.length) spansRaw = [30];
    var thOn = $('m3dAnalysis').value === 'timehistory';
    var result = window.SPATIAL_BRIDGE.analyze({
      bridgeType: $('m3dType').value,
      analysisType: $('m3dAnalysis').value,
      spans: spansRaw,
      width: +$('m3dWidth').value,
      segmentsPerSpan: +$('m3dSeg').value,
      archL: +$('aL').value,
      archF: +$('aF').value,
      cableL: +$('cL').value,
      cableSide: +$('cAnch').value,
      cableH: +$('cHt').value,
      suspL: +$('sL').value,
      suspF: +$('sF').value,
      suspH: +$('sTH').value,
      spectrumText: $('m3dSpectrum').value,
      direction: thOn ? $('m3dThDirection').value : $('m3dDirection').value,
      method: $('m3dCombine').value,
      dampingRatio: thOn ? (+$('m3dThDamping').value / 100) : (+$('m3dDamping').value / 100),
      waveSource: $('m3dWaveSource').value,
      builtinWave: $('m3dBuiltinWave').value,
      waveText: $('m3dWaveText').value,
      waveUnit: $('m3dWaveUnit').value,
      waveDt: +$('m3dWaveDt').value,
      pgaScale: +$('m3dPga').value,
      modeCount: 8
    });
    $('vm3dWidth').textContent = (+$('m3dWidth').value).toFixed(1).replace(/\.0$/, '');
    $('vm3dSeg').textContent = $('m3dSeg').value;
    S.modal3d = result;
    $('pillMesh').textContent = result.model.nodes.length + ' 节点 / ' + result.model.elements.length + ' 单元';
    $('pillValid').textContent = result.modal.eigensolver.converged ? '模态求解收敛' : '模态未收敛';
    $('pillValid').className = result.modal.eigensolver.converged ? 'pill ok' : 'pill bad';
    $('report').innerHTML = window.SPATIAL_BRIDGE.reportHtml(result);
    var isTh = result.response && result.response.kind === 'timehistory';
    if (isTh) {
      $('m3dHint').textContent = result.model.bridgeTypeLabel + ' · ' + result.response.direction.toUpperCase() +
        ' 向时程 · 峰值 ' + (result.response.peak.value * 1000).toFixed(2) + ' mm @ ' + result.response.peak.nodeId;
    } else if (result.response) {
      $('m3dHint').textContent = result.model.bridgeTypeLabel + ' · ' + result.response.direction.toUpperCase() + ' 向 ' +
        result.response.method + ' · 最大位移 ' + (result.response.maxNodeResultant * 1000).toFixed(2) + ' mm';
    } else {
      $('m3dHint').textContent = result.model.bridgeTypeLabel + ' · ' + result.modal.modes.length + ' 阶 · 第1阶 ' + result.modal.modes[0].frequencyHz.toFixed(3) + ' Hz';
    }
    var boundary = {
      girder: '两道主梁 + 横隔梁的空间梁格，可观察竖弯、横弯与扭转振型。',
      arch: '双肋上承式拱桥：桥面系、拱肋、横撑与立柱共同参与空间振动。',
      cable: '双塔双索面斜拉桥：拉索采用轴向单元，并计入教学初张力几何刚度。',
      suspension: '双主缆悬索桥：主缆与吊索采用轴向单元，并计入抛物线水平力近似几何刚度。'
    };
    $('m3dBoundary').textContent = boundary[result.model.bridgeType] || '3D 杆系模态模型。';
    $('m3dRead').innerHTML = isTh
      ? '<b>读图要点：</b>动画与云图是真实位移时程的放大显示（峰值约放大到主跨 7.5% 量级），时序与符号真实。' +
        '拖动时间轴可定格任意时刻；反应谱给峰值包络，时程给过程，两者互补。'
      : (result.response
        ? '<b>读图要点：</b>彩色结构是反应谱模态组合后的位移包络，数值来自用户输入谱。' +
          '反应谱给出峰值包络，不保留各响应同时发生的正负号与时间顺序。'
        : '<b>读图要点：</b>灰色是未变形梁格，彩色结构是当前振型。' +
          '振型是相对形状，不等于实际地震位移；频率变化可用于判断刚度、质量和边界条件是否合理。');
    if (S.modal3dViewer) S.modal3dViewer.setData(result.model, result.modal, isTh ? null : result.response);
    var sel = $('m3dMode');
    sel.innerHTML = result.modal.modes.map(function (m, i) {
      return '<option value="' + i + '">振型 ' + m.index + ' · ' + m.frequencyHz.toFixed(3) + ' Hz</option>';
    }).join('');
    sel.value = '0';
    var isSpec = result.response && !isTh;
    sel.disabled = !!result.response;
    $('m3dPlay').disabled = isSpec;
    $('m3dPlay').textContent = isSpec ? '反应谱为静态包络' : (isTh ? '暂停时程动画' : '暂停振型动画');
    if (S.modal3dViewer) S.modal3dViewer.setPlaying(!isSpec);
    if (isTh) {
      S.lastTh = result.response;
      setupThResult(result.response);
      renderThCompare(result.response);
    } else {
      S.lastTh = null;
    }
    syncModuleVisibility();
  }

  /* ---------- 时程分析：曲线绘制与播放控件 ---------- */
  function setupThResult(th) {
    var nodeSel = $('m3dThNode');
    nodeSel.innerHTML = th.nodeHistory.map(function (h) {
      return '<option value="' + h.id + '">' + h.id + '</option>';
    }).join('');
    nodeSel.value = th.peak.nodeId;
    $('m3dTime').max = th.steps - 1;
    $('m3dTime').value = th.peak.step;
    $('vM3dTime').textContent = 't = ' + th.peak.time.toFixed(2) + ' s';
    if (S.modal3dViewer) {
      S.modal3dViewer.setTimeHistory(th);
      S.modal3dViewer.setTimeIndex(th.peak.step);
    }
    drawThChart();
  }

  function drawThChart() {
    var th = S.lastTh;
    var svg = $('svgTh');
    if (!th) { svg.innerHTML = ''; return; }
    var comp = $('m3dThComp').value;
    var W = 900, H = 240, padL = 64, padR = 18, padT = 14, padB = 30;
    var iw = W - padL - padR, ih = H - padT - padB;
    var steps = th.steps;
    var stride = Math.max(1, Math.ceil(steps / 1400));
    var series, unit, label;
    if (comp === 'baseShear') {
      series = th.baseShear; unit = 'kN'; label = '基底剪力';
    } else {
      var h = th.nodeHistory.find(function (x) { return x.id === $('m3dThNode').value; }) || th.nodeHistory[0];
      if (comp === 'resultant') {
        series = new Float64Array(steps);
        for (var i = 0; i < steps; i++) series[i] = Math.hypot(h.x[i], h.y[i], h.z[i]);
        label = h.id + ' 合位移';
      } else {
        series = h[comp]; label = h.id + ' ' + comp.toUpperCase() + ' 向';
      }
      unit = 'm';
    }
    var vmin = Infinity, vmax = -Infinity;
    for (var j = 0; j < steps; j++) {
      if (series[j] < vmin) vmin = series[j];
      if (series[j] > vmax) vmax = series[j];
    }
    if (!(vmax > vmin)) { vmax = vmin + 1; }
    var xOf = function (i) { return padL + (th.times[i] / th.durationSec) * iw; };
    var yOf = function (v) { return padT + (1 - (v - vmin) / (vmax - vmin)) * ih; };
    var pts = [];
    for (var k = 0; k < steps; k += stride) pts.push(xOf(k).toFixed(1) + ',' + yOf(series[k]).toFixed(1));
    pts.push(xOf(steps - 1).toFixed(1) + ',' + yOf(series[steps - 1]).toFixed(1));
    var zeroY = (vmin < 0 && vmax > 0) ? yOf(0) : null;
    var html = '';
    html += '<rect x="' + padL + '" y="' + padT + '" width="' + iw + '" height="' + ih + '" fill="rgba(148,163,184,.05)" stroke="rgba(148,163,184,.25)"/>';
    if (zeroY) html += '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (padL + iw) + '" y2="' + zeroY + '" stroke="rgba(148,163,184,.4)" stroke-dasharray="4 4"/>';
    html += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#0a84ff" stroke-width="1.6"/>';
    var tStep = Math.max(1, Math.round(th.durationSec / 8 / th.dt)) * th.dt;
    for (var tt = 0; tt <= th.durationSec + 1e-9; tt += tStep) {
      var tx = padL + (tt / th.durationSec) * iw;
      html += '<line x1="' + tx.toFixed(1) + '" y1="' + (padT + ih) + '" x2="' + tx.toFixed(1) + '" y2="' + (padT + ih + 5) + '" stroke="rgba(148,163,184,.5)"/>';
      html += '<text x="' + tx.toFixed(1) + '" y="' + (padT + ih + 18) + '" font-size="11" fill="#8a8a8a" text-anchor="middle">' + tt.toFixed(1) + '</text>';
    }
    [vmin, (vmin + vmax) / 2, vmax].forEach(function (v) {
      html += '<text x="' + (padL - 6) + '" y="' + (yOf(v) + 4).toFixed(1) + '" font-size="11" fill="#8a8a8a" text-anchor="end">' +
        (unit === 'm' ? (v * 1000).toFixed(2) + 'mm' : v.toFixed(1)) + '</text>';
    });
    // 峰值标记
    var pk = 0, pkI = 0;
    for (var q = 0; q < steps; q++) if (Math.abs(series[q]) > Math.abs(pk)) { pk = series[q]; pkI = q; }
    html += '<circle cx="' + xOf(pkI).toFixed(1) + '" cy="' + yOf(pk).toFixed(1) + '" r="4" fill="#ff9f0a"/>';
    html += '<text x="' + Math.min(xOf(pkI) + 8, padL + iw - 90).toFixed(1) + '" y="' + Math.max(yOf(pk) - 6, 12).toFixed(1) + '" font-size="11.5" fill="#ff9f0a">峰值 ' +
      (unit === 'm' ? (pk * 1000).toFixed(2) + ' mm' : Math.abs(pk).toFixed(1) + ' kN') + ' @ t=' + th.times[pkI].toFixed(2) + 's</text>';
    html += '<text x="' + padL + '" y="12" font-size="11.5" fill="#8a8a8a">' + label + '（' + (unit === 'm' ? 'mm' : 'kN') + '）· ' + th.waveMeta.label + ' PGA ' + th.waveMeta.pga.toFixed(3) + ' m/s²</text>';
    svg.innerHTML = html;
    $('thHint').textContent = label + ' · ' + th.waveMeta.steps + ' 步 · dt=' + th.waveMeta.dt.toFixed(4) + ' s';
  }

  /* ---------- 时程 × 反应谱 对照卡片与 CSV 导出 ---------- */
  function renderThCompare(th) {
    var box = $('thCompare');
    if (!box) return;
    bindThExportButtons();
    if (!th || !th.compare) {
      box.innerHTML = (th && th.compareError) ? '<div class="readpts">对照计算未完成：' + th.compareError + '</div>' : '';
      return;
    }
    var html = '<table class="thcmp"><thead><tr><th>指标</th><th>时程</th><th>同波反应谱</th><th>时程/谱</th></tr></thead><tbody>';
    th.compare.rows.forEach(function (r) {
      var warn = r.ratio !== null && (r.ratio > 1.15 || r.ratio < 0.87);
      html += '<tr><td>' + r.metric + '</td><td>' + r.thPeak.toFixed(2) + ' ' + r.unit + '</td><td>' +
        r.specPeak.toFixed(2) + ' ' + r.unit + '</td><td class="ratio' + (warn ? ' warn' : '') + '">' +
        (r.ratio === null ? '—' : r.ratio.toFixed(2)) + '</td></tr>';
    });
    html += '</tbody></table><div class="thcmp-note">' + th.compare.note + '</div>';
    box.innerHTML = html;
  }

  function bindThExportButtons() {
    var map = { btnCsvNodes: 'nodes', btnCsvBase: 'base', btnCsvWave: 'wave' };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el && !el.__thcsvBound) {
        el.__thcsvBound = true;
        el.addEventListener('click', function () { exportThCsv(map[id]); });
      }
    });
  }

  function exportThCsv(what) {
    var th = S.lastTh;
    if (!th || !window.SPATIAL_BRIDGE || !window.SPATIAL_BRIDGE.buildThCsv) return;
    var csv = window.SPATIAL_BRIDGE.buildThCsv(th, what);
    var names = { nodes: '位移', base: '基底剪力', wave: '波数据' };
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '星屿桥梁-时程-' + (names[what] || what) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  /* ---------- 参数面板显隐 ---------- */
  function syncLabels() {
    var k = segVal('pSecKind');
    $('lB').textContent = k === 'T' ? '翼缘宽 bf' : '顶板宽 B';
    $('lT1').textContent = k === 'T' ? '翼缘厚 hf' : '顶板厚';
    $('lBW').textContent = k === 'rect' ? '截面宽 b' : '腹板总宽 bw';
    var hides = document.querySelectorAll('[data-hide]');
    for (var i = 0; i < hides.length; i++) {
      var el = hides[i], hn = el.getAttribute('data-hide');
      el.closest('.field').style.display = (hn.indexOf(k) >= 0) ? 'none' : '';
    }
    var v = function (id) { return (+$(id).value).toFixed(2).replace(/\.?0+$/, ''); };
    $('vB').textContent = (+$('pB').value).toFixed(1);
    $('vH').textContent = (+$('pH').value).toFixed(2);
    $('vT1').textContent = (+$('pT1').value).toFixed(2);
    $('vT2').textContent = (+$('pT2').value).toFixed(2);
    $('vBW').textContent = (+$('pBW').value).toFixed(2);
    $('vMesh').textContent = (+$('pMesh').value).toFixed(1);
    $('vG2').textContent = $('pG2').value;
    $('vLanes').textContent = $('pLanes').value;
    $('vNG').textContent = $('pNG').value;
    $('vGS').textContent = (+$('pGS').value).toFixed(1);
    $('vMMan').textContent = (+$('pMMan').value).toFixed(2);
    $('vMuMan').textContent = (+$('pMuMan').value).toFixed(2);
    $('vAs').textContent = $('pAs').value;
    $('vAs2').textContent = (+$('pAsDist').value).toFixed(2);
    $('vSd').textContent = $('pSd').value;
    $('vSn').textContent = $('pSn').value;
    $('vSv').textContent = $('pSv').value;
    $('wrapMMan').style.display = segVal('pMMode') === 'man' ? '' : 'none';
    $('wrapMuMan').style.display = segVal('pMuMode') === 'man' ? '' : 'none';
  }

  function syncConvoyLabel(R) {
    if (!R || !R.convoyOn) { $('vConvoy').textContent = '车队未上桥'; return; }
    $('vConvoy').textContent = '前轴 x = ' + fmt(R.xh, 1) + ' m';
  }

  /* ---------- 模块切换 ---------- */
  var PANES = { beam: 'modBeam', arch: 'modArch', cable: 'modCable', susp: 'modSusp', pier: 'modPier', hydro: 'modHydro', modal3d: 'modModal3d', guide: 'modGuide' };

  function setModule(m) {
    if (!PANES[m]) m = 'beam';
    S.mod = m;
    var bs = $('modbar').querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-m') === m);
    $('modsHint').textContent = MODS[m].hint;
    for (var k in PANES) $(PANES[k]).style.display = (k === m) ? '' : 'none';
    var beamOnly = (m === 'beam');
    var modalOnly = (m === 'modal3d');
    $('tabs').style.display = beamOnly ? '' : 'none';
    $('convoyBar').style.display = beamOnly ? '' : 'none';
    var stageHide = modalOnly || m === 'guide';
    $('elevCard').style.display = stageHide ? 'none' : '';
    $('chartCard').style.display = stageHide ? 'none' : '';
    if (m === 'guide') { $('thChartCard').style.display = 'none'; $('thExtraCard').style.display = 'none'; $('thTimeBar').style.display = 'none'; }
    $('modal3dCard').style.display = modalOnly ? '' : 'none';
    $('bannerText').innerHTML = BANNERS[m];
    if (S.playing) { S.playing = false; $('btnPlay').textContent = '播放车队'; if (S.playTimer) clearTimeout(S.playTimer); }
    syncAllInputLabels();
    if (modalOnly && !S.modal3dViewer && window.SPATIAL_BRIDGE) {
      S.modal3dViewer = window.SPATIAL_BRIDGE.makeViewer($('m3dCanvas'), {
        onRange: function (range) {
          var names = { resultant: '合位移', x: 'X 向', y: '竖向 Y', z: '横向 Z' };
          $('m3dRange').textContent = (range.response || range.th)
            ? (names[range.field] || range.field) + '：0 ~ ' + (range.max * 1000).toFixed(2) + ' mm'
            : (names[range.field] || range.field) + '：0 ~ ' + range.max.toExponential(2);
        },
        onThTime: function (idx) {
          if (!S.lastTh) return;
          $('m3dTime').value = idx;
          $('vM3dTime').textContent = 't = ' + (idx * S.lastTh.dt).toFixed(2) + ' s';
        }
      });
      $('m3dTime').addEventListener('input', function () {
        if (S.modal3dViewer) S.modal3dViewer.setTimeIndex(+this.value);
      });
      $('m3dThNode').addEventListener('change', function () { drawThChart(); });
      $('m3dThComp').addEventListener('change', function () { drawThChart(); });
      $('m3dWaveFile').addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          $('m3dWaveText').value = String(reader.result || '');
          schedule();
        };
        reader.readAsText(f);
      });
      $('m3dMode').addEventListener('change', function () {
        var index = +this.value;
        if (S.modal3dViewer) S.modal3dViewer.setMode(index);
        if (S.modal3d && S.modal3d.modal.modes[index]) {
          var mode = S.modal3d.modal.modes[index];
          $('m3dHint').textContent = '振型 ' + mode.index + ' · ' + mode.frequencyHz.toFixed(3) + ' Hz · T=' + mode.periodSec.toFixed(3) + ' s';
        }
      });
      $('m3dCloud').addEventListener('change', function () {
        if (S.modal3dViewer) S.modal3dViewer.setField(this.value);
      });
      $('m3dPlay').addEventListener('click', function () {
        var on = this.textContent.indexOf('暂停') === 0;
        if (S.modal3dViewer) S.modal3dViewer.setPlaying(!on);
        var thMode = S.lastTh && $('m3dAnalysis').value === 'timehistory';
        this.textContent = on ? (thMode ? '播放时程动画' : '播放振型动画') : (thMode ? '暂停时程动画' : '暂停振型动画');
      });
      $('m3dReset').addEventListener('click', function () {
        if (S.modal3dViewer) S.modal3dViewer.reset();
      });
    }
    if (S.modal3dViewer) S.modal3dViewer.setActive(modalOnly);
    schedule();
  }

  /* ---------- 数值输入框：滑块两侧双向同步（midas 式） ---------- */
  function injectNum(range) {
    if (range.dataset.num) return;
    range.dataset.num = '1';
    var num = document.createElement('input');
    num.type = 'number';
    num.className = 'num';
    num.min = range.min; num.max = range.max;
    num.step = range.step || 'any';
    num.value = range.value;
    num.setAttribute('aria-label', '数值输入');
    var wrap = document.createElement('div');
    wrap.className = 'ctl';
    range.parentNode.insertBefore(wrap, range);
    wrap.appendChild(range);
    wrap.appendChild(num);
    range.addEventListener('input', function () { num.value = range.value; });
    range.addEventListener('change', function () { num.value = range.value; });
    num.addEventListener('change', function () {
      var v = parseFloat(num.value);
      if (!isFinite(v)) { num.value = range.value; return; }
      var mn = parseFloat(range.min), mx = parseFloat(range.max), st = parseFloat(range.step);
      if (isFinite(mn) && v < mn) v = mn;
      if (isFinite(mx) && v > mx) v = mx;
      if (isFinite(st) && st > 0) v = Math.round(v / st) * st;
      v = Math.round(v * 1e9) / 1e9;
      range.value = v;
      num.value = v;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /** 活动面板的滑块值标签同步。命名约定：span = "v" + rangeId 去掉首字母（aL→vaL），
   *  或 "v" + 完整 id（桥墩面板 pD→vpD）。两种都试，兼容两种命名。 */
  function syncPaneLabels() {
    var pane = $(PANES[S.mod]);
    if (!pane) return;
    var rs = pane.querySelectorAll('input[type="range"]');
    for (var i = 0; i < rs.length; i++) {
      var span = $('v' + rs[i].id.slice(1)) || $('v' + rs[i].id);
      if (span) span.textContent = trimNum(rs[i].value);
    }
  }

  /** 模块面板内联动显隐（墩柱截面形式 / 水文流量来源与土类）。 */
  function syncModuleVisibility() {
    if (S.mod === 'pier') {
      var k = segVal('pShapeKind');
      var fs = $('modPier').querySelectorAll('[data-show]');
      for (var i = 0; i < fs.length; i++) {
        var shows = fs[i].getAttribute('data-show').split(',');
        fs[i].style.display = shows.indexOf(k) >= 0 ? '' : 'none';
      }
    } else if (S.mod === 'hydro') {
      var rat = segVal('hQMode') === 'rational';
      var q1 = document.querySelectorAll('.hQRat');
      for (var j = 0; j < q1.length; j++) q1[j].style.display = rat ? '' : 'none';
      var q2 = document.querySelectorAll('.hQDir');
      for (var j2 = 0; j2 < q2.length; j2++) q2[j2].style.display = rat ? 'none' : '';
      var clay = segVal('hSoil') === 'clay';
      var c1 = document.querySelectorAll('.hClay');
      for (var j3 = 0; j3 < c1.length; j3++) c1[j3].style.display = clay ? '' : 'none';
    } else if (S.mod === 'modal3d') {
      var a = $('m3dAnalysis').value;
      $('m3dSpectrumFields').style.display = a === 'spectrum' ? '' : 'none';
      $('m3dThFields').style.display = a === 'timehistory' ? '' : 'none';
      var paste = $('m3dWaveSource').value === 'paste';
      var bs = $('m3dThFields').querySelectorAll('.thBuiltinOnly');
      for (var bi = 0; bi < bs.length; bi++) bs[bi].style.display = paste ? 'none' : '';
      var ps = $('m3dThFields').querySelectorAll('.thPasteOnly');
      for (var pi = 0; pi < ps.length; pi++) ps[pi].style.display = paste ? '' : 'none';
      var thOn = a === 'timehistory' && !!S.lastTh;
      $('thTimeBar').style.display = thOn ? '' : 'none';
      $('thChartCard').style.display = thOn ? '' : 'none';
    $('thExtraCard').style.display = thOn ? '' : 'none';
      var pga = +$('m3dPga').value;
      $('vm3dPga').textContent = pga > 0 ? pga.toFixed(2) + ' m/s²' : '不调幅';
      $('vm3dThDamping').textContent = trimNum($('m3dThDamping').value);
    }
  }

  function syncAllInputLabels() {
    syncLabels();            // 梁桥面板（含截面形式联动）
    syncPaneLabels();        // 活动模块面板
    syncModuleVisibility();  // 模块内联动
  }

  /* ---------- 事件绑定 ---------- */
  function bindSeg(id, after) {
    var el = $(id);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var bs = el.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].classList.remove('on');
      b.classList.add('on');
      syncAllInputLabels();
      if (after) after();
      schedule();
    });
  }

  function init() {
    // 预设
    var pb = $('presets');
    PRESETS.forEach(function (p, i) {
      var b = document.createElement('button');
      b.textContent = p.name;
      b.setAttribute('data-pidx', i);
      b.onclick = function () { applyPreset(p, i); };
      pb.appendChild(b);
    });

    // 所有面板（梁桥 + 各模块）的输入统一绑定：滑块/数值/下拉改动即重算
    for (var pk in PANES) {
      var pane = $(PANES[pk]);
      var inputs = pane.querySelectorAll('input, select');
      for (var ii = 0; ii < inputs.length; ii++) {
        if (inputs[ii].hasAttribute('data-no-recompute')) continue;
        inputs[ii].addEventListener('input', function () { syncAllInputLabels(); schedule(); });
        inputs[ii].addEventListener('change', function () { syncAllInputLabels(); schedule(); });
      }
      // 滑块配套数值输入框（midas 式）
      var ranges = pane.querySelectorAll('input[type="range"]');
      for (var ri = 0; ri < ranges.length; ri++) injectNum(ranges[ri]);
    }

    bindSeg('pSecKind'); bindSeg('pCls'); bindSeg('pMMode'); bindSeg('pMuMode');
    bindSeg('aAxis'); bindSeg('aHinge'); bindSeg('pShapeKind');
    bindSeg('hQMode'); bindSeg('hSoil');
    $('m3dSpectrum').addEventListener('input', schedule);
    if (window.XINGYU_GROUNDMOTION) {
      $('m3dBuiltinWave').innerHTML = window.XINGYU_GROUNDMOTION.BUILTIN.map(function (w) {
        return '<option value="' + w.id + '">' + w.label + '</option>';
      }).join('');
    }

    // 模块切换
    $('modbar').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      setModule(b.getAttribute('data-m'));
    });

    // 车队
    $('pConvoy').addEventListener('input', function () {
      S.convoy = +this.value;
      var R = S.last && S.last.R;
      if (R) {
        // 仅重算车队工况，避免拖动时反复扫描影响线
        var P = readParams();
        var R2 = compute(P);
        if (R2) {
          S.last.R = R2;
          S.last.C = check(R2);
          renderElev(R2);
          if (S.tab === 'M' || S.tab === 'V' || S.tab === 'D') renderChart(R2, S.last.C);
          syncConvoyLabel(R2);
        }
      }
    });

    $('btnPlay').addEventListener('click', function () {
      S.playing = !S.playing;
      this.textContent = S.playing ? '暂停' : '播放车队';
      if (S.playing) {
        var step = function () {
          if (!S.playing) return;
          var v = +$('pConvoy').value + 0.9;
          if (v > 100) v = 0;
          $('pConvoy').value = v;
          $('pConvoy').dispatchEvent(new Event('input'));
          S.playTimer = setTimeout(step, 40);
        };
        step();
      } else if (S.playTimer) clearTimeout(S.playTimer);
    });

    // 图表 tab
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var bs = this.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].classList.remove('on');
      b.classList.add('on');
      S.tab = b.getAttribute('data-v');
      ensureIlSlider(S.tab === 'IL');
      if (S.last) renderChart(S.last.R, S.last.C);
    });

    syncAllInputLabels();
    // 深链：?m=arch|cable|susp|pier|hydro 直达模块；?p=N 直接打开第 N 个梁桥预设（0 起）
    var mm = /[?&]m=(\w+)/.exec(location.search);
    var mod = (mm && PANES[mm[1]]) ? mm[1] : 'beam';
    if (mod !== 'beam') {
      setModule(mod);
    } else {
      var pm = /[?&]p=(\d+)/.exec(location.search);
      var pIdx = pm ? Math.min(Math.max(+pm[1], 0), PRESETS.length - 1) : 1;
      applyPreset(PRESETS[pIdx], pIdx);
    }
  }

  /** 影响线截面位置滑块（仅在 IL 标签页出现）。 */
  var ilBox = null;
  function ensureIlSlider(show) {
    if (show && !ilBox) {
      ilBox = document.createElement('div');
      ilBox.className = 'convoy';
      ilBox.style.marginBottom = '10px';
      ilBox.innerHTML = '<span class="val" style="min-width:52px;text-align:left">截面</span>' +
        '<input type="range" id="pIlSec" min="0" max="100" step="0.5" value="50">' +
        '<span class="val" id="vIlSec">—</span>';
      var chart = $('svgChart').parentNode;
      chart.insertBefore(ilBox, $('svgChart'));
      $('pIlSec').addEventListener('input', function () {
        S.ilSec = +this.value / 100;
        if (S.last) { renderChart(S.last.R, S.last.C); $('vIlSec').textContent = fmt(S.ilSec * (S.last.R.total), 1) + ' m'; }
      });
    }
    if (ilBox) ilBox.style.display = show ? '' : 'none';
    if (show && S.last) $('vIlSec').textContent = fmt(S.ilSec * S.last.R.total, 1) + ' m';
  }

  function applyPreset(p, idx) {
    $('pSpans').value = p.spans;
    $('pB').value = p.B; $('pH').value = p.H;
    $('pT1').value = p.t1; $('pT2').value = p.t2; $('pBW').value = p.bw;
    $('pGrade').value = p.grade;
    $('pG2').value = p.g2;
    $('pLanes').value = p.lanes;
    $('pNG').value = p.n; $('pGS').value = p.s;
    $('pAs').value = p.As;
    var kinds = $('pSecKind').querySelectorAll('button');
    for (var i = 0; i < kinds.length; i++) kinds[i].classList.toggle('on', kinds[i].getAttribute('data-v') === p.secKind);
    // 预设高亮：与真实选中项同步（原先从不设置，导致高亮一直在骗人）
    if (idx === undefined) idx = PRESETS.indexOf(p);
    var pbs = $('presets').querySelectorAll('button');
    for (var j = 0; j < pbs.length; j++) {
      pbs[j].classList.toggle('on', j === idx);
    }
    syncAllInputLabels();
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
