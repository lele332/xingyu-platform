/* ==========================================================================
 * hydrology.js — 桥涵水文计算（JTG C30-2015）
 *
 * 流程：设计洪水频率 → 设计流量 → 桥孔长度 → 一般冲刷(64-1修正式)
 *       → 局部冲刷(65-2式) → 基底最小埋深
 *
 * 公式出处（均注明"请核实现行版本"）：
 *   [1] JTG C30-2015《公路工程水文勘测设计规范》表1.0.8、§6~§8
 *   [2] 64-1修正式：h_p = [A·Qc/(μ·Lj)·(h_max/h_c)^(5/3)/(E·d^(1/6))]^(3/5)
 *       A = (√B̄/H̄)^0.15；E：Spj<1→0.46，1~10→0.66，>10→0.86
 *   [3] 65-2式：h_b = K_ξ·K_η2·B1^0.6·h_p^0.15·((V−V0')/V0)^n2
 *       K_η2 = 0.0023/d̄^2.2 + 0.375·d̄^0.24
 *       V0  = 0.28·(d̄+0.7)^0.5      （起动流速）
 *       V0' = 0.12·(d̄+0.5)^0.55     （起冲流速）
 *       n2  = (V0/V)^(0.23+0.19·lg d̄)
 * ========================================================================== */
(function (root) {
  'use strict';

  /* 设计洪水频率（JTG C30-2015 表1.0.8） */
  var FLOOD_FREQ = {
    '特大桥': { '高速': 300, '一级': 300, '二级': 100, '三级': 100, '四级': 100 },
    '大桥': { '高速': 100, '一级': 100, '二级': 100, '三级': 50, '四级': 50 },
    '中桥': { '高速': 100, '一级': 100, '二级': 100, '三级': 50, '四级': 50 },
    '小桥': { '高速': 100, '一级': 100, '二级': 50, '三级': 25, '四级': 25 },
    '涵洞': { '高速': 100, '一级': 100, '二级': 50, '三级': 25, '四级': 0 }
  };

  /** 推理公式法设计流量：Qp = 0.278·ψ·(Sp/τ^n)·F
   *  ψ 洪峰径流系数；Sp 设计雨力(mm/h)；τ 汇流时间(h)；n 暴雨衰减指数；F 流域面积(km²) */
  function rationalFormula(o) {
    var Q = 0.278 * o.psi * (o.Sp / Math.pow(o.tau, o.n)) * o.F;
    return Q;
  }

  /** 单宽流量集中系数 A = (√B̄/H̄)^0.15 */
  function concentrationFactor(B, H) {
    var A = Math.pow(Math.sqrt(B) / H, 0.15);
    return Math.min(A, 1.8);
  }

  /** 含沙量系数 E */
  function siltFactor(Spj) {
    if (Spj < 1.0) return 0.46;
    if (Spj <= 10.0) return 0.66;
    return 0.86;
  }

  /** 桥孔净长（按设计流量与容许单宽流量反算）
   *  Lj = Qp / (μ · h_c · V_c)，V_c 天然河槽平均流速 */
  function openingLength(o) {
    var qAllow = o.hc * o.Vc;             // 容许单宽流量 m²/s
    var Lj = o.Qp / (o.mu * qAllow);
    return Lj;
  }

  /** 64-1修正式（非粘性土河槽一般冲刷）
   *  h_p = [ A·Qc/(μ·Lj)·(h_max/h_c)^(5/3)/(E·d^(1/6)) ]^(3/5) */
  function generalScour641(o) {
    var A = concentrationFactor(o.B, o.Hbar);
    var E = siltFactor(o.Spj);
    var q = A * o.Qc / (o.mu * o.Lj);                    // 最大单宽流量
    var ratio = Math.pow(o.hmax / o.hc, 5 / 3);
    var denom = E * Math.pow(o.d, 1 / 6);
    var hp = Math.pow(q * ratio / denom, 3 / 5);
    return { hp: hp, A: A, E: E, cite: 'JTG C30-2015 §8.3，64-1修正式，请核实现行版本' };
  }

  /** 64-1修正式（粘性土河槽）：h_p = [ A·Qc/(μ·Lj)·(h_max/h_c)^(5/3)/(0.33/I_L) ]^(3/5) */
  function generalScourClay(o) {
    var A = concentrationFactor(o.B, o.Hbar);
    var q = A * o.Qc / (o.mu * o.Lj);
    var ratio = Math.pow(o.hmax / o.hc, 5 / 3);
    var hp = Math.pow(q * ratio / (0.33 / o.IL), 3 / 5);
    return { hp: hp, A: A, cite: 'JTG C30-2015 §8.3，粘性土河槽64-1修正式，I_L=' + o.IL.toFixed(2) };
  }

  /** 行近流速（一般冲刷后墩前）：V = E·d̄^(1/6)·h_p^(2/3)（非粘性土冲止流速） */
  function approachVelocity(E, d, hp) {
    return E * Math.pow(d, 1 / 6) * Math.pow(hp, 2 / 3);
  }

  /** 65-2式 桥墩局部冲刷（非粘性土） */
  function localScour652(o) {
    var d = o.d;                       // 泥沙平均粒径 mm
    var Keta2 = 0.0023 / Math.pow(d, 2.2) + 0.375 * Math.pow(d, 0.24);
    var V0 = 0.28 * Math.sqrt(d + 0.7);
    var V0p = 0.12 * Math.pow(d + 0.5, 0.55);
    var V = o.V;                       // 一般冲刷后行近流速
    var n2 = Math.pow(V0 / V, 0.23 + 0.19 * Math.log10(d));
    var base = o.Kxi * Keta2 * Math.pow(o.B1, 0.6) * Math.pow(o.hp, 0.15);
    var ratio = (V - V0p) / V0;
    var hb;
    if (V <= V0) hb = base * ratio;
    else hb = base * Math.pow(ratio, n2);
    hb = Math.max(hb, 0);
    return { hb: hb, Keta2: Keta2, V0: V0, V0p: V0p, n2: n2, regime: V <= V0 ? 'V≤V0 线性段' : 'V>V0 指数段', cite: 'JTG C30-2015 §8.4，65-2式，请核实现行版本' };
  }

  /** 墩台基底最小埋置高程
   *  Z_base = 河床高程 − 自然冲刷Δz − h_p − h_b − 安全值Δc */
  function foundationElevation(o) {
    var hs = o.dzNatural + o.hp + o.hb;        // 总冲刷深度
    var Z = o.riverbed - hs - o.dc;
    return { Z: Z, hs: hs };
  }

  /** 一次性全流程 */
  function run(P) {
    var Qp = P.Qp || rationalFormula(P.flow);
    var Lj = P.Lj || openingLength({ Qp: Qp, mu: P.mu, hc: P.hc, Vc: P.Vc });

    var gs = P.soil === 'clay'
      ? generalScourClay({ B: P.B, Hbar: P.Hbar, Qc: P.Qc || Qp, mu: P.mu, Lj: Lj, hmax: P.hmax, hc: P.hc, IL: P.IL })
      : generalScour641({ B: P.B, Hbar: P.Hbar, Qc: P.Qc || Qp, mu: P.mu, Lj: Lj, hmax: P.hmax, hc: P.hc, Spj: P.Spj, d: P.d });

    var E = siltFactor(P.Spj);
    var V = approachVelocity(E, P.d, gs.hp);

    var ls = localScour652({ Kxi: P.Kxi, B1: P.B1, hp: gs.hp, V: V, d: P.d });

    var fe = foundationElevation({ riverbed: P.riverbed, dzNatural: P.dzNatural, hp: gs.hp, hb: ls.hb, dc: P.dc });

    var report = [
      { label: '设计洪水频率', value: '1/' + (FLOOD_FREQ[P.bridgeClass] ? FLOOD_FREQ[P.bridgeClass][P.roadClass] : '—'), note: 'JTG C30-2015 表1.0.8' },
      { label: '设计流量 Qp', value: Qp.toFixed(1) + ' m³/s' },
      { label: '桥孔净长 Lj', value: Lj.toFixed(1) + ' m', note: 'μ=' + P.mu.toFixed(2) + '，容许单宽流量 ' + (P.hc * P.Vc).toFixed(2) + ' m²/s' },
      { label: '单宽流量集中系数 A', value: gs.A.toFixed(3), note: 'A=(√B̄/H̄)^0.15，上限1.8' },
      { label: '一般冲刷深度 h_p（64-1修正式）', value: gs.hp.toFixed(2) + ' m', note: P.soil === 'clay' ? '粘性土，I_L=' + P.IL.toFixed(2) : '非粘性土，E=' + (gs.E !== undefined ? gs.E.toFixed(2) : '—') + '，d̄=' + P.d + ' mm' },
      { label: '行近流速 V', value: V.toFixed(2) + ' m/s', note: '冲止流速 E·d̄^(1/6)·h_p^(2/3)' },
      { label: '局部冲刷深度 h_b（65-2式）', value: ls.hb.toFixed(2) + ' m', note: ls.regime + '，K_η2=' + ls.Keta2.toFixed(3) },
      { label: '总冲刷深度 h_s', value: fe.hs.toFixed(2) + ' m', note: '自然' + P.dzNatural.toFixed(2) + ' + 一般' + gs.hp.toFixed(2) + ' + 局部' + ls.hb.toFixed(2) },
      { label: '基底最小埋置高程', value: fe.Z.toFixed(2) + ' m', note: '河床 ' + P.riverbed.toFixed(2) + ' − 总冲刷 − 安全值 ' + P.dc.toFixed(2) }
    ];

    var checks = [
      { label: 'A ≤ 1.8', value: gs.A.toFixed(3), limit: '≤ 1.8', pass: gs.A <= 1.8 },
      { label: '行近流速 V 合理性', value: V.toFixed(2) + ' m/s', limit: '< 6 m/s', pass: V < 6, note: '山区河段流速可更大，需结合河段类型判断' },
      { label: '局部冲刷非负', value: ls.hb.toFixed(2) + ' m', limit: '≥ 0', pass: ls.hb >= 0 }
    ];

    return { Qp: Qp, Lj: Lj, general: gs, local: ls, foundation: fe, report: report, checks: checks };
  }

  root.HYDRO = {
    FLOOD_FREQ: FLOOD_FREQ,
    rationalFormula: rationalFormula,
    concentrationFactor: concentrationFactor,
    siltFactor: siltFactor,
    openingLength: openingLength,
    generalScour641: generalScour641,
    generalScourClay: generalScourClay,
    approachVelocity: approachVelocity,
    localScour652: localScour652,
    foundationElevation: foundationElevation,
    run: run
  };
})(typeof window !== 'undefined' ? window : globalThis);
