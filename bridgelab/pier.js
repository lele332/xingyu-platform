/* ==========================================================================
 * pier.js — 桥墩验算（JTG 3362-2018 / JTG 3363-2019）
 *
 * 覆盖：
 *   1. 截面分类        重力式（矩形/圆端形）· 桩柱式（圆形/矩形）
 *   2. 几何 + 材料      计算长度 l0、长细比 λ、偏心距增大系数 η
 *   3. 偏心受压承载力   条带数值积分（平截面假定 + 等效矩形应力图）
 *   4. 斜截面抗剪       JTG 3362 §5.2.9（与上部结构共用）
 *   5. 裂缝宽度         JTG 3362 §6.4.3（正常使用极限状态）
 *   6. 桩基承载力       JTG 3363 §5.3.3 单桩轴向受压容许值
 *
 * 单位约定：kN、m、kPa（MPa=1000 kPa 时自行换算）
 * ========================================================================== */
(function (root) {
  'use strict';

  var CONC = {
    C30: { fcd: 13.8, ftd: 1.39, fcu: 30, Ec: 3.0e7 },
    C35: { fcd: 16.1, ftd: 1.52, fcu: 35, Ec: 3.15e7 },
    C40: { fcd: 18.4, ftd: 1.65, fcu: 40, Ec: 3.25e7 },
    C50: { fcd: 22.4, ftd: 1.83, fcu: 50, Ec: 3.45e7 }
  };
  var REBAR = { HRB400: { fsd: 330, Es: 2.0e8 }, HRB500: { fsd: 415, Es: 2.0e8 } };

  /* α1、β1：混凝土等效矩形应力图系数（C50 及以下取 1.0/0.8，C80 取 0.94/0.74，线性内插） */
  function ab1(fcu) {
    if (fcu <= 50) return { a1: 1.0, b1: 0.8 };
    if (fcu >= 80) return { a1: 0.94, b1: 0.74 };
    var t = (fcu - 50) / 30;
    return { a1: 1.0 - 0.06 * t, b1: 0.8 - 0.06 * t };
  }

  /* ======================================================================
   * 截面条带化：把任意凸截面切成水平条带，供数值积分
   * shape: {kind:'rect', b, h} | {kind:'circle', D} | {kind:'roundRect', B, H, r}
   * 返回 {strips:[{y, dA, yc}], A, I, ybar, h}
   *   y 从截面底缘算起
   * ==================================================================== */
  function discretize(shape, nStrip) {
    nStrip = nStrip || 300;
    var strips = [], A = 0, I = 0;
    var h, i;

    if (shape.kind === 'rect') {
      h = shape.h;
      var dy = h / nStrip;
      for (i = 0; i < nStrip; i++) {
        var y = (i + 0.5) * dy;
        var dA = shape.b * dy;
        strips.push({ y: y, dA: dA, yc: y });
        A += dA; I += dA * y * y;
      }
    } else if (shape.kind === 'circle') {
      h = shape.D;
      var dy = h / nStrip, R = shape.D / 2;
      for (i = 0; i < nStrip; i++) {
        var y = (i + 0.5) * dy;
        var yy = y - R;
        var w = 2 * Math.sqrt(Math.max(0, R * R - yy * yy));
        var dA = w * dy;
        strips.push({ y: y, dA: dA, yc: y });
        A += dA; I += dA * y * y;
      }
    } else if (shape.kind === 'roundRect') {
      // 圆端形墩：矩形 + 两端半圆
      h = shape.H;
      var dy = h / nStrip, R = shape.H / 2, rectW = shape.B - shape.H;
      for (i = 0; i < nStrip; i++) {
        var y = (i + 0.5) * dy;
        var yy = y - R;
        var w = rectW + 2 * Math.sqrt(Math.max(0, R * R - yy * yy));
        var dA = w * dy;
        strips.push({ y: y, dA: dA, yc: y });
        A += dA; I += dA * y * y;
      }
    }
    var ybar = h / 2;  // 对称截面
    // 惯性矩换轴
    var I2 = 0; for (i = 0; i < strips.length; i++) I2 += strips[i].dA * Math.pow(strips[i].yc - ybar, 2);
    return { strips: strips, A: A, I: I2, ybar: ybar, h: h };
  }

  /* ======================================================================
   * 偏心受压承载力（条带法）
   * 输入：shape、材料、配筋 As（总面积）、纵筋重心到边缘距离 a_s、
   *       轴力设计值 Nd (kN, 压为正)、弯矩设计值 Md (kN·m)
   * 输出：{Mu, x, e0, eta, l0, lambda, sigmaMax, pass, notes[]}
   * ==================================================================== */
  function eccentricCompression(o) {
    var conc = CONC[o.grade] || CONC.C30;
    var bar = REBAR[o.rebar] || REBAR.HRB400;
    var sec = discretize(o.shape, 400);
    var h = sec.h, h0 = h - o.a_s;
    var fcu = conc.fcu;
    var ab = ab1(fcu);
    var ecu = 0.0033, Es = bar.Es;

    // 纵筋布置：简化为两排（受压边一排、受拉边一排），各占 As/2
    var As = o.As, asC = o.a_s, asT = o.a_s;
    var steel = [
      { y: h - asC, A: As / 2 },   // 受压边（假定弯矩使此边受压）
      { y: asT, A: As / 2 }        // 受拉边
    ];

    /* 给定中和轴深度 x（从受压边缘量起），求 N(x)、M(x) */
    function NM(x) {
      var N = 0, M = 0;
      var a = ab.b1 * x;                       // 等效压区深度
      var yComp = h - a;                       // 压区下缘高度
      for (var i = 0; i < sec.strips.length; i++) {
        var st = sec.strips[i];
        if (st.y + st.dA / 2 < yComp) continue; // 条带全在压区外（受拉侧忽略混凝土）
        // 条带中心若在压区内 → 全压
        if (st.yc >= yComp) {
          var dFc = ab.a1 * conc.fcd * 1000 * st.dA;   // kN
          N += dFc;
          M += dFc * (st.yc - sec.ybar);
        } else {
          // 条带部分在压区：线性近似
          var frac = (st.y + st.dA - yComp) / st.dA;
          var dFc2 = ab.a1 * conc.fcd * 1000 * st.dA * frac;
          N += dFc2;
          M += dFc2 * (st.yc - sec.ybar);
        }
      }
      // 钢筋
      for (var s = 0; s < steel.length; s++) {
        var stl = steel[s];
        var eps = ecu * (x - (h - stl.y)) / x;   // 受压为正（y 从底量起，受压边缘在 y=h）
        var sig = Math.max(-bar.fsd, Math.min(bar.fsd, Es * eps / 1000));  // kPa→MPa
        var Fs = sig * 1000 * stl.A;              // kN
        N += Fs;
        M += Fs * (stl.y - sec.ybar);
      }
      return { N: N, M: Math.abs(M) };
    }

    // 二阶效应：偏心距增大系数 η（JTG 3362-2018 §5.3.3 简化式）
    var l0 = o.l0, e0 = o.Md / o.Nd;             // m
    var xi1 = Math.min(1.0, 0.2 + 2.7 * (e0 / h0));
    var xi2 = Math.min(1.0, 1.15 - 0.01 * (l0 / h));
    var eta = 1 + 1 / (1300 * (e0 / h0)) * Math.pow(l0 / h, 2) * xi1 * xi2;
    // 长细比
    var i = Math.sqrt(sec.I / sec.A);
    var lambda = l0 / i;

    // 求 x 使 N(x) = η·Nd（η 已放大偏心 → 用放大后的弯矩）
    var Nd = o.Nd, Mdd = eta * o.Md;
    var lo = 1e-6, hi = h * 3;
    for (var it = 0; it < 60; it++) {
      var mid = (lo + hi) / 2;
      var v = NM(mid);
      if (v.N < Nd) lo = mid; else hi = mid;
    }
    var x = (lo + hi) / 2;
    var cap = NM(x);
    var Mu = cap.M;

    // 最大混凝土压应力（弹性估算，供报告）
    // Nd/A 与 M·y/I 均为 kN/m² = kPa；报告使用 MPa，因此除以 1000。
    var sigmaMax = (Nd / sec.A + Mdd * (h / 2) / sec.I) / 1000;

    var pass = Mdd <= Mu;
    var xib = 0.8 / (1 + bar.fsd / (Es * ecu / 1000));   // 相对界限受压区高度 β1/(1+fsd/(Es·εcu))
    var notes = [
      '中和轴深度 x = ' + x.toFixed(3) + ' m，ξ = ' + (x / h0).toFixed(3) + (x / h0 <= xib ? ' ≤ ξb（大偏心）' : ' > ξb（小偏心）'),
      'η·Md = ' + Mdd.toFixed(1) + ' kN·m，承载力 Mu = ' + Mu.toFixed(1) + ' kN·m',
      '长细比 λ = l₀/i = ' + lambda.toFixed(1)
    ];
    return { Mu: Mu, Mdd: Mdd, x: x, xi: x / h0, eta: eta, l0: l0, lambda: lambda, e0: e0, sigmaMax: sigmaMax, pass: pass, notes: notes, sec: sec };
  }

  /* ======================================================================
   * 裂缝宽度（JTG 3362-2018 §6.4.3，圆形截面偏心受压）
   * σ_ss = Ns·(es − z)/(As·z)，z = [0.87 − 0.12(h0/es)²]·h0
   * wfk = C1·C2·C3·(σss/Es)·(30+d)/(0.28+10ρ)
   * ==================================================================== */
  function crackWidth(o) {
    var bar = REBAR[o.rebar] || REBAR.HRB400;
    var sec = discretize(o.shape, 200);
    var h = sec.h, h0 = h - o.a_s;
    var Ns = o.Ns, es = o.Ms / Math.max(Ns, 1e-9);
    var z = (0.87 - 0.12 * Math.pow(h0 / es, 2)) * h0;
    z = Math.max(z, 0.5 * h0);                 // 仅防数值异常，不得钳到 ≥ es（否则 σss=0）
    // 单位：Ns(kN)·es(m) → kN·m；As(m²)·z(m) → m³；→ kN/m² = kPa
    var sig = Ns * (es - z) / (o.As * z);      // kPa
    var rho = o.As / sec.A;
    var C1 = 1.0, C2 = 1.4, C3 = 1.0;
    // σss/Es 为应变：sig(kPa) 与 Es(kPa) 同单位直接相除，勿再除 1000（否则裂缝宽度假大 1000 倍）
    var w = C1 * C2 * C3 * (sig / bar.Es) * (30 + o.dBar) / (0.28 + 10 * rho);
    return { w: w, sigmaS: sig / 1000, z: z, rho: rho, pass: w <= 0.2, limit: 0.2 };
  }

  /* ======================================================================
   * 桩基单桩轴向受压容许值（JTG 3363-2019 §5.3.3）
   * [Ra] = 0.5·u·Σqik·li + Ap·(m0·λ·[fa0] + k2·γ2·(h − 3))
   * ==================================================================== */
  function pileCapacity(o) {
    var u = Math.PI * o.D;
    var sum = 0, li = o.layers;
    for (var i = 0; i < li.length; i++) sum += li[i].qik * li[i].thickness;
    var Ap = Math.PI * o.D * o.D / 4;
    var side = 0.5 * u * sum;
    var tip = Ap * (o.m0 * o.lambda * o.fa0 + o.k2 * o.gamma2 * Math.max(0, o.h - 3));
    return { Ra: side + tip, side: side, tip: tip, u: u, Ap: Ap };
  }

  root.PIER = {
    CONC: CONC, REBAR: REBAR,
    discretize: discretize,
    eccentricCompression: eccentricCompression,
    crackWidth: crackWidth,
    pileCapacity: pileCapacity,
    ab1: ab1
  };
})(typeof window !== 'undefined' ? window : globalThis);
