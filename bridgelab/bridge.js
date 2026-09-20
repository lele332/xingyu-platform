/* ==========================================================================
 * bridge.js — 桥梁荷载、截面特性、规范验算
 *
 * ⚠️ 严谨性约定（务必遵守，别为了"好看"破坏它）：
 *   1. 凡涉及规范条文值，必须在 cite 字段写清「规范号 + 章节/表号 + 请核实现行版本」。
 *   2. 不确定的条目，confidence 标 'medium'，并在 UI 上打「需核实」角标。
 *   3. 几何尺寸（跨径、梁高、板厚）是设计变量，不是规范数据，可以自由给默认值。
 *   4. 承载力验算是「教学用简化算法」，必须明确它不等于完整规范算法。
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. 材料
   * JTG 3362-2018 表 3.1.4（强度设计值）、表 3.1.5（弹性模量）
   * 单位：Ec / f_cd / f_td / f_cu,k 均为 MPa
   * ---------------------------------------------------------------- */
  var CONCRETE = {
    C40: { Ec: 3.25e4, fcd: 18.4, ftd: 1.65, fcuk: 40 },
    C50: { Ec: 3.45e4, fcd: 22.4, ftd: 1.83, fcuk: 50 },
    C55: { Ec: 3.55e4, fcd: 24.4, ftd: 1.89, fcuk: 55 },
    C60: { Ec: 3.60e4, fcd: 26.5, ftd: 1.96, fcuk: 60 }
  };

  var REBAR = {
    HPB300: { fsd: 250, Es: 2.0e5, name: 'HPB300' },
    HRB400: { fsd: 330, Es: 2.0e5, name: 'HRB400' },
    HRB500: { fsd: 415, Es: 2.0e5, name: 'HRB500' }
  };

  var GAMMA_C = 26;    // 钢筋混凝土/预应力混凝土重度 kN/m³（JTG D60-2015 表 4.2.1）
  var G = 9.81;

  /* ------------------------------------------------------------------
   * 2. 截面
   * 统一用「矩形条带列表」描述，任意组合截面都能算 A / I。
   * rects: [{b, h, yc}]，yc 为该条带形心距截面底缘的高度 (m)
   * ---------------------------------------------------------------- */
  function sectionProps(rects) {
    var A = 0, Sy = 0, i, r;
    for (i = 0; i < rects.length; i++) { r = rects[i]; A += r.b * r.h; Sy += r.b * r.h * r.yc; }
    if (A <= 0) return { A: 0, I: 0, ybar: 0, ytop: 0, ybot: 0, Wtop: 0, Wbot: 0 };
    var ybar = Sy / A, I = 0;
    for (i = 0; i < rects.length; i++) {
      r = rects[i];
      I += r.b * r.h * r.h * r.h / 12 + r.b * r.h * Math.pow(r.yc - ybar, 2);
    }
    var H = 0, top = 0;
    for (i = 0; i < rects.length; i++) { top = Math.max(top, rects[i].yc + rects[i].h / 2); }
    H = top;
    var ytop = H - ybar, ybot = ybar;
    return {
      A: A, I: I, ybar: ybar, H: H, ytop: ytop, ybot: ybot,
      Wtop: I / ytop, Wbot: I / ybot
    };
  }

  /** 由界面参数生成矩形条带列表。 */
  function makeRects(p) {
    if (p.secKind === 'rect') {
      return [{ b: p.bw, h: p.H, yc: p.H / 2 }];
    }
    if (p.secKind === 'box') {
      // 单箱单室：顶板 + 腹板（两侧合计）+ 底板
      var t1 = Math.min(p.t1, p.H * 0.4), t2 = Math.min(p.t2, p.H * 0.4);
      var hw = Math.max(0.05, p.H - t1 - t2);
      return [
        { b: p.B, h: t1, yc: p.H - t1 / 2 },
        { b: p.bw, h: hw, yc: t2 + hw / 2 },
        { b: p.B, h: t2, yc: t2 / 2 }
      ];
    }
    // T 形（含 I 形近似：I 形下翼缘较窄时会有偏差，教学够用）
    // 注意：界面上「顶板厚 / 翼缘厚」共用参数 t1，这里做兼容
    var hfRaw = (p.hf !== undefined && p.hf !== null) ? p.hf : p.t1;
    var hf = Math.min(hfRaw, p.H * 0.5);
    return [
      { b: p.B, h: hf, yc: p.H - hf / 2 },
      { b: p.bw, h: p.H - hf, yc: (p.H - hf) / 2 }
    ];
  }

  /* ------------------------------------------------------------------
   * 3. 汽车荷载（JTG D60-2015 第 4.3 节）
   * ---------------------------------------------------------------- */

  /** 多车道横向折减系数。JTG D60-2015 表 4.3.1-4（表号请核对现行版本）。 */
  var LANE_REDUCTION = { 1: 1.0, 2: 1.0, 3: 0.78, 4: 0.67, 5: 0.60, 6: 0.55, 7: 0.52, 8: 0.50 };

  /**
   * 车道荷载的均布荷载 qk 与集中荷载 Pk。JTG D60-2015 4.3.1。
   * 公路-I级：qk = 10.5 kN/m；Pk 按计算跨径 L0 内插：
   *   L0 ≤ 5 m → 180 kN；L0 ≥ 50 m → 360 kN；5 < L0 < 50 m 线性内插。
   * 公路-II级：取公路-I级的 0.75 倍。
   */
  function laneLoad(cls, L0) {
    var k = (cls === 'II') ? 0.75 : 1.0;
    var qk = 10.5 * k;
    var Pk;
    if (L0 <= 5) Pk = 180;
    else if (L0 >= 50) Pk = 360;
    else Pk = 180 + (360 - 180) * (L0 - 5) / (50 - 5);
    Pk *= k;
    return {
      qk: qk, Pk: Pk, cls: cls,
      cite: 'JTG D60-2015 第 4.3.1 条（公路-' + (cls === 'II' ? 'II' : 'I') + '级车道荷载）· 请核实现行版本'
    };
  }

  /**
   * 冲击系数 μ。JTG D60-2015 4.3.2：
   *   f < 1.5 Hz  → μ = 0.05
   *   1.5 ≤ f ≤ 14 Hz → μ = 0.1767 ln f − 0.0157
   *   f > 14 Hz   → μ = 0.45
   */
  function impactFactor(f) {
    var mu;
    if (f < 1.5) mu = 0.05;
    else if (f <= 14) mu = 0.1767 * Math.log(f) - 0.0157;
    else mu = 0.45;
    return {
      mu: mu, f: f,
      cite: 'JTG D60-2015 第 4.3.2 条（汽车冲击系数）· 请核实现行版本'
    };
  }

  /**
   * 简支梁基频估算（教学用）：f1 = π/(2L²) · √(EI/m_c)
   * m_c = 跨中每延米质量 (kg/m)。连续梁此式仅为粗略估计，已在 UI 标注。
   */
  function baseFrequency(E_MPa, I, g1, g2, L) {
    var E = E_MPa * 1e6;                 // Pa
    var mc = (g1 + g2) * 1000 / G;       // kg/m
    if (mc <= 0 || I <= 0 || L <= 0) return 0;
    return Math.PI / (2 * L * L) * Math.sqrt(E * I / mc);
  }

  /** 公路-I级车辆荷载（JTG D60-2015 表 4.3.1-2）：总重 550 kN。 */
  var VEHICLE = {
    total: 550,
    // 轴重 kN 与距前轴距离 m（轴距 3 + 1.4 + 7 + 1.4）
    axles: [
      { P: 30, dx: 0 }, { P: 120, dx: 3 }, { P: 120, dx: 4.4 },
      { P: 140, dx: 11.4 }, { P: 140, dx: 12.8 }
    ],
    len: 12.8,
    cite: 'JTG D60-2015 车辆荷载（公路-I级，总重 550 kN）· 请核实现行版本'
  };

  /* ------------------------------------------------------------------
   * 4. 横向分布系数
   * ---------------------------------------------------------------- */

  /**
   * 偏心压力法（刚性横梁法）。
   * 适用：有横隔梁、宽跨比 B/L ≤ 0.5 的窄桥。超出范围 UI 会提示改用比拟正交异性板法（G-M 法）。
   * 对每根主梁 k：m_k(nl) = nl/n + nl·a_k·e/Σa_j²
   *   其中 e 为 nl 个车道合力偏心（车道靠该梁一侧布置）
   * 各车道数取 ξ·m 的最大值，单车道加载不折减 —— 工程上常见由「少车道无折减」控制。
   */
  function transverseFactor(n, s, nlDesign, W) {
    var a = [], i, k, sum2 = 0;
    for (i = 0; i < n; i++) a.push((i - (n - 1) / 2) * s);
    for (i = 0; i < n; i++) sum2 += a[i] * a[i];
    var laneW = 3.5;
    var maxNl = Math.min(nlDesign, Math.max(1, Math.floor(W / laneW + 1e-9)));
    var best = { m: 0, nl: 1, girder: 0, e: 0, xi: 1.0, warn: '' };
    var log = [];
    for (var nl = 1; nl <= maxNl; nl++) {
      var edge = W / 2;                       // 车道组贴边布置
      var e = edge - laneW * nl / 2;
      for (k = 0; k < n; k++) {
        var mk = nl / n + nl * a[k] * e / sum2;
        var xi = LANE_REDUCTION[nl] !== undefined ? LANE_REDUCTION[nl] : 0.5;
        log.push({ nl: nl, girder: k + 1, m: mk, xi: xi, prod: xi * mk });
        if (xi * mk > best.m) {
          best = { m: xi * mk, mk: mk, nl: nl, girder: k + 1, e: e, xi: xi, warn: '' };
        }
      }
    }
    best.sum2 = sum2;
    best.log = log;
    best.cite = '偏心压力法（刚性横梁法）· 适用于 B/L ≤ 0.5 且有横隔梁的窄桥';
    return best;
  }

  /* ------------------------------------------------------------------
   * 5. 承载力验算（JTG 3362-2018，教学简化版）
   * ---------------------------------------------------------------- */

  /** 相对界限受压区高度 ξ_b = β / (1 + f_sd/(Es·ε_cu))，β = 0.8，ε_cu = 0.0033。 */
  function xiB(fsd, Es) {
    return 0.8 / (1 + fsd / (Es * 0.0033));
  }

  /**
   * 受弯承载力 Mu（kN·m）。
   * 单筋矩形/T 形：先判断 x 与 hf 的关系。
   * @param p {fcd, bf, bw, hf, H, as} as = 受拉钢筋合力点至底缘距离 (m)
   * @param As 受拉钢筋面积 (m²)
   * @param fsd 钢筋抗拉强度设计值 (MPa)
   */
  function bendingCapacity(p, As, fsd) {
    var fcd = p.fcd * 1000;               // kN/m²
    var sd = fsd * 1000;                  // kN/m²
    var h0 = p.H - p.as;
    var bf = p.bf, bw = p.bw, hf = p.hf;
    var N = sd * As;                      // kN
    // 先按矩形（宽 bf）估算 x
    var x = N / (fcd * bf);
    var kind = 'rect';
    if (x > hf) {
      // 第二类 T 形：α1 f_cd [bw·x + (bf−bw)·hf] = f_sd·As
      x = (N - fcd * (bf - bw) * hf) / (fcd * bw);
      kind = 'T';
    }
    var Mu;
    if (kind === 'rect') {
      Mu = fcd * bf * x * (h0 - x / 2);
    } else {
      Mu = fcd * (bf - bw) * hf * (h0 - hf / 2) + fcd * bw * x * (h0 - x / 2);
    }
    var xib = xiB(fsd, p.Es || 2.0e5);
    var xi = x / h0;
    return {
      Mu: Mu, x: x, kind: kind, h0: h0, xi: xi, xib: xib,
      over: xi > xib,
      rho: As / (bw * h0),
      cite: 'JTG 3362-2018 第 5.2 节（受弯承载力，α1 = 1.0）· 教学简化，请核实现行版本'
    };
  }

  /**
   * 斜截面抗剪承载力 V_cs（kN）。JTG 3362-2018 式 (5.2.9)。
   * V_cs = α1·α2·α3·0.45×10⁻³·b·h0·√[(2+0.6P)·√f_cu,k·ρ_sv·f_sv]
   *   b、h0 以 mm 计；P = 100ρ ≤ 2.5
   */
  function shearCapacity(p, rhoSv, fsv, alphas) {
    var b = p.bw * 1000, h0 = (p.H - p.as) * 1000;
    var P = Math.min(2.5, Math.max(0.1, p.P100 !== undefined ? p.P100 : 1.5));
    var a1 = alphas.a1, a2 = alphas.a2, a3 = alphas.a3;
    var inner = (2 + 0.6 * P) * Math.sqrt(p.fcuk) * rhoSv * fsv;
    if (inner <= 0) inner = 0;
    var Vcs = a1 * a2 * a3 * 0.45e-3 * b * h0 * Math.sqrt(inner);
    var Vmax = 0.51e-3 * Math.sqrt(p.fcuk) * b * h0;   // 截面尺寸上限，式 (5.2.11)
    return {
      Vcs: Vcs, Vmax: Vmax, P: P,
      cite: 'JTG 3362-2018 式 (5.2.9) / (5.2.11)· 教学简化，请核实现行版本'
    };
  }

  /** 最小配筋率：ρ_min = max(0.20%, 45·f_td/f_sd %)。JTG 3362-2018 9.1.12。 */
  function minRho(ftd, fsd) {
    return Math.max(0.0020, 45 * ftd / fsd / 100);
  }

  /* ------------------------------------------------------------------
   * 6. 作用组合（JTG D60-2015 第 4.1 节）
   * ---------------------------------------------------------------- */
  var COMBINE = {
    gammaG: 1.2,     // 永久作用分项系数（不利）
    gammaQ: 1.4,     // 汽车荷载分项系数
    gamma0: { 1: 1.1, 2: 1.0, 3: 0.9 },
    psiF: 0.7,       // 频遇值系数（挠度验算）
    cite: 'JTG D60-2015 第 4.1.5 条（承载能力极限状态基本组合）· 请核实现行版本'
  };

  /** 挠度限值：主梁跨中 L/600。JTG D60-2015 第 6.5.3 条。 */
  var DEFLECTION_LIMIT = { ratio: 600, cite: 'JTG D60-2015 第 6.5.3 条（主梁跨中挠度限值 L/600）· 请核实现行版本' };

  global.BRIDGE = {
    CONCRETE: CONCRETE, REBAR: REBAR, GAMMA_C: GAMMA_C, G: G,
    LANE_REDUCTION: LANE_REDUCTION, VEHICLE: VEHICLE,
    COMBINE: COMBINE, DEFLECTION_LIMIT: DEFLECTION_LIMIT,
    sectionProps: sectionProps, makeRects: makeRects,
    laneLoad: laneLoad, impactFactor: impactFactor, baseFrequency: baseFrequency,
    transverseFactor: transverseFactor, xiB: xiB,
    bendingCapacity: bendingCapacity, shearCapacity: shearCapacity, minRho: minRho
  };
})(window);
