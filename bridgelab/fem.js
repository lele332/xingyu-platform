/* ==========================================================================
 * fem.js — 平面欧拉-伯努利梁单元有限元内核（零依赖）
 *
 * 约定（全模块统一，改动前先读这里）：
 *   坐标 x：沿桥纵向，单位 m，从左端 0 起
 *   自由度：每个节点 2 个 —— [v, θ]，v 向上为正，θ 逆时针为正
 *   荷载：向下为正（与 v 反向），弯矩 M 取下缘受拉（正弯矩/跨中正弯矩）为正
 *   单位：力 kN，长度 m，弹性模量 E 输入 MPa（内部转 kN/m² = ×1000）
 *
 * 单元刚度矩阵（dof 序 [v_i, θ_i, v_j, θ_j]）：
 *        EI
 *   k = ──  × [[12,  6L, -12,  6L],
 *       L³     [6L, 4L², -6L, 2L²],
 *              [-12,-6L,  12, -6L],
 *              [6L, 2L², -6L, 4L²]]
 *
 * 结点力 f = k·d − F_equiv，其中 F_equiv 是等效结点荷载向量（由形函数积分得到）。
 * 由此得内力（已用简支梁、悬臂梁两套解析解校核过符号）：
 *   V_i = f[0]      M_i(下缘受拉正) = −f[1]
 *   V_j = −f[2]     M_j(下缘受拉正) = +f[3]
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- 线性代数 ---------- */

  /** LU 分解（部分选主元）。返回 {lu, piv, n}，奇异返回 null。 */
  function luDecomp(A) {
    var n = A.length;
    var lu = new Array(n), piv = new Array(n), i, j, k;
    for (i = 0; i < n; i++) { lu[i] = A[i].slice(); piv[i] = i; }
    for (k = 0; k < n; k++) {
      var p = k, mx = Math.abs(lu[k][k]);
      for (i = k + 1; i < n; i++) {
        var v = Math.abs(lu[i][k]);
        if (v > mx) { mx = v; p = i; }
      }
      if (!(mx > 1e-12)) return null;
      if (p !== k) {
        var t = lu[p]; lu[p] = lu[k]; lu[k] = t;
        var q = piv[p]; piv[p] = piv[k]; piv[k] = q;
      }
      for (i = k + 1; i < n; i++) {
        var f = lu[i][k] / lu[k][k];
        lu[i][k] = f;
        if (f !== 0) for (j = k + 1; j < n; j++) lu[i][j] -= f * lu[k][j];
      }
    }
    return { lu: lu, piv: piv, n: n };
  }

  /** 用已分解的 LU 解 A·x = b。 */
  function luSolve(LU, b) {
    var n = LU.n, x = new Array(n), i, j, s;
    for (i = 0; i < n; i++) x[i] = b[LU.piv[i]];
    for (i = 1; i < n; i++) {
      s = x[i];
      for (j = 0; j < i; j++) s -= LU.lu[i][j] * x[j];
      x[i] = s;
    }
    for (i = n - 1; i >= 0; i--) {
      s = x[i];
      for (j = i + 1; j < n; j++) s -= LU.lu[i][j] * x[j];
      x[i] = s / LU.lu[i][i];
    }
    return x;
  }

  /** 一次性求解（内部做 LU）。 */
  function solve(A, b) {
    var LU = luDecomp(A);
    if (!LU) return null;
    return luSolve(LU, b);
  }

  /* ---------- 网格 ---------- */

  /**
   * 由跨径数组生成节点坐标。
   * @param {number[]} spans 各跨跨径 (m)
   * @param {number}   mesh  目标单元长度 (m)
   * @returns {{xs:number[], supIdx:number[], spans:number[], cum:number[], total:number}}
   */
  function buildMesh(spans, mesh) {
    var cum = [0], i, k;
    for (i = 0; i < spans.length; i++) cum.push(cum[cum.length - 1] + spans[i]);
    var raw = [0];
    for (k = 0; k < spans.length; k++) {
      var n = Math.max(6, Math.round(spans[k] / mesh));
      for (i = 1; i <= n; i++) raw.push(cum[k] + spans[k] * i / n);
    }
    var xs = [];
    for (i = 0; i < raw.length; i++) {
      if (xs.length === 0 || raw[i] - xs[xs.length - 1] > 1e-6) xs.push(raw[i]);
    }
    var supIdx = [];
    for (i = 0; i < cum.length; i++) {
      var best = 0, bd = Infinity;
      for (var m = 0; m < xs.length; m++) {
        var d = Math.abs(xs[m] - cum[i]);
        if (d < bd) { bd = d; best = m; }
      }
      if (supIdx.indexOf(best) < 0) supIdx.push(best);
    }
    supIdx.sort(function (a, b) { return a - b; });
    return {
      xs: xs, supIdx: supIdx, spans: spans.slice(), cum: cum,
      total: cum[cum.length - 1]
    };
  }

  /** 由节点坐标生成单元表。 */
  function buildElems(xs) {
    var els = [];
    for (var i = 0; i < xs.length - 1; i++) {
      els.push({ i: i, j: i + 1, x0: xs[i], x1: xs[i + 1], L: xs[i + 1] - xs[i] });
    }
    return els;
  }

  /* ---------- 形函数积分（等效结点荷载用） ---------- */

  /** ∫_0^x N_k(x) dx，Hermite 形函数，k = 0..3 对应 [v_i, θ_i, v_j, θ_j]。 */
  function Nint(k, x, L) {
    switch (k) {
      case 0: return x - x * x * x / (L * L) + Math.pow(x, 4) / (2 * L * L * L);
      case 1: return x * x / 2 - 2 * x * x * x / (3 * L) + Math.pow(x, 4) / (4 * L * L);
      case 2: return x * x * x / (L * L) - Math.pow(x, 4) / (2 * L * L * L);
      default: return -x * x * x / (3 * L) + Math.pow(x, 4) / (4 * L * L);
    }
  }

  /** Hermite 形函数值 N_k(ξ)，ξ = x/L。 */
  function shapeN(xi, L) {
    var x2 = xi * xi, x3 = x2 * xi;
    return [
      1 - 3 * x2 + 2 * x3,
      L * (xi - 2 * x2 + x3),
      3 * x2 - 2 * x3,
      L * (-x2 + x3)
    ];
  }

  /* ---------- 荷载分配 ---------- */

  /**
   * 把整体坐标下的荷载分配到单元局部坐标。
   * @param {{x1,x2,q}[]} udl 分布荷载（q 向下为正，kN/m）
   * @param {{x,P}[]}     pt  集中荷载（P 向下为正，kN）
   */
  function distribute(els, xs, udl, pt) {
    var lastX = xs[xs.length - 1], e;
    for (var n = 0; n < els.length; n++) {
      e = els[n]; e.udl = []; e.pt = [];
    }
    var i, u, a, b;
    for (i = 0; i < (udl || []).length; i++) {
      u = udl[i];
      for (var n2 = 0; n2 < els.length; n2++) {
        e = els[n2];
        a = Math.max(u.x1, e.x0) - e.x0;
        b = Math.min(u.x2, e.x1) - e.x0;
        if (b > a + 1e-9) e.udl.push({ a: a, b: b, q: u.q });
      }
    }
    for (i = 0; i < (pt || []).length; i++) {
      var p = pt[i], placed = false;
      for (var n3 = 0; n3 < els.length; n3++) {
        e = els[n3];
        if (p.x >= e.x0 - 1e-9 && p.x < e.x1 - 1e-9) {
          e.pt.push({ a: p.x - e.x0, P: p.P }); placed = true; break;
        }
      }
      if (!placed && Math.abs(p.x - lastX) < 1e-6) {
        els[els.length - 1].pt.push({ a: els[els.length - 1].L, P: p.P });
      }
    }
  }

  /** 单元的等效结点荷载向量（向下荷载 → 与 v 正向相反，故取负）。 */
  function elemEquiv(e) {
    var F = [0, 0, 0, 0], L = e.L, u, k;
    for (var i = 0; i < e.udl.length; i++) {
      u = e.udl[i];
      for (k = 0; k < 4; k++) F[k] -= u.q * (Nint(k, u.b, L) - Nint(k, u.a, L));
    }
    for (var j = 0; j < e.pt.length; j++) {
      var p = e.pt[j], N = shapeN(p.a / L, L);
      for (k = 0; k < 4; k++) F[k] -= p.P * N[k];
    }
    return F;
  }

  /* ---------- 组装 ---------- */

  /**
   * 组装总刚（约束自由度先保留在矩阵里，求解时再消元）。
   * @returns {{K:number[][], ndof:number, EI:number}}
   */
  function assembleK(xs, els, EI) {
    var nd = xs.length, ndof = nd * 2;
    var K = new Array(ndof), a, b;
    for (a = 0; a < ndof; a++) { K[a] = new Array(ndof); for (b = 0; b < ndof; b++) K[a][b] = 0; }
    for (var n = 0; n < els.length; n++) {
      var e = els[n], L = e.L, c = EI / (L * L * L);
      var ke = [
        [12 * c, 6 * L * c, -12 * c, 6 * L * c],
        [6 * L * c, 4 * L * L * c, -6 * L * c, 2 * L * L * c],
        [-12 * c, -6 * L * c, 12 * c, -6 * L * c],
        [6 * L * c, 2 * L * L * c, -6 * L * c, 4 * L * L * c]
      ];
      var d = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1];
      for (a = 0; a < 4; a++) for (b = 0; b < 4; b++) K[d[a]][d[b]] += ke[a][b];
    }
    return { K: K, ndof: ndof, EI: EI };
  }

  /** 组装整体等效结点荷载向量。 */
  function assembleF(els, ndof) {
    var F = new Array(ndof), i;
    for (i = 0; i < ndof; i++) F[i] = 0;
    for (var n = 0; n < els.length; n++) {
      var e = els[n], Fe = elemEquiv(e);
      var d = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1];
      for (i = 0; i < 4; i++) F[d[i]] += Fe[i];
    }
    return F;
  }

  /* ---------- 求解器 ---------- */

  /**
   * 建立「可重复求解」的求解器：总刚只分解一次，之后任意荷载都能快速回代。
   * 这是影响线扫描（同一 K、上百个荷载位置）能跑到毫秒级的关键。
   */
  function makeSolver(xs, els, EI, fixedDofs) {
    var A = assembleK(xs, els, EI);
    var ndof = A.ndof;
    var isFixed = new Array(ndof), i;
    for (i = 0; i < ndof; i++) isFixed[i] = false;
    for (i = 0; i < fixedDofs.length; i++) isFixed[fixedDofs[i]] = true;
    var free = [];
    for (i = 0; i < ndof; i++) if (!isFixed[i]) free.push(i);
    var m = free.length;
    var Kr = new Array(m);
    for (i = 0; i < m; i++) {
      Kr[i] = new Array(m);
      for (var j = 0; j < m; j++) Kr[i][j] = A.K[free[i]][free[j]];
    }
    var LU = luDecomp(Kr);
    if (!LU) return null;

    return {
      ndof: ndof, free: free, isFixed: isFixed, LU: LU, els: els, xs: xs, EI: EI,

      /** 传入整体荷载向量 F（长度 ndof），返回全量位移 d。 */
      solveF: function (F) {
        var b = new Array(m), i2;
        for (i2 = 0; i2 < m; i2++) b[i2] = F[free[i2]];
        var xr = luSolve(LU, b);
        var d = new Array(ndof);
        for (i2 = 0; i2 < ndof; i2++) d[i2] = 0;
        for (i2 = 0; i2 < m; i2++) d[free[i2]] = xr[i2];
        return d;
      }
    };
  }

  /** 单元刚度矩阵（4×4），供回代内力使用。 */
  function elemK(e, EI) {
    var L = e.L, c = EI / (L * L * L);
    return [
      [12 * c, 6 * L * c, -12 * c, 6 * L * c],
      [6 * L * c, 4 * L * L * c, -6 * L * c, 2 * L * L * c],
      [-12 * c, -6 * L * c, 12 * c, -6 * L * c],
      [6 * L * c, 2 * L * L * c, -6 * L * c, 4 * L * L * c]
    ];
  }

  /**
   * 由位移反算每个单元的端内力与内力分布采样。
   * @returns {[{Mi,Vi,Mj,Vj, M:[], V:[], xs:[]}]}
   *   M：下缘受拉为正（跨中正弯矩为正）；V：左段对右段向上为正。
   */
  function elemResults(solver, d, samplesPerElem) {
    var out = [], n, e, k, i;
    var ns = samplesPerElem || 6;
    for (n = 0; n < solver.els.length; n++) {
      e = solver.els[n];
      var map = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1];
      var de = [d[map[0]], d[map[1]], d[map[2]], d[map[3]]];
      var ke = elemK(e, solver.EI);
      var Fe = elemEquiv(e);
      var f = [0, 0, 0, 0];
      for (i = 0; i < 4; i++) {
        var s = 0;
        for (k = 0; k < 4; k++) s += ke[i][k] * de[k];
        f[i] = s - Fe[i];
      }
      var rec = {
        i: e.i, j: e.j, x0: e.x0, x1: e.x1, L: e.L,
        Vi: f[0], Mi: -f[1], Vj: -f[2], Mj: f[3],
        M: [], V: [], xs: []
      };
      for (var t = 0; t <= ns; t++) {
        var x = e.L * t / ns;
        var M = rec.Mi + rec.Vi * x;
        var V = rec.Vi;
        for (var a = 0; a < e.udl.length; a++) {
          var u = e.udl[a];
          var lo = Math.min(x, u.a), hi = Math.min(x, u.b);
          if (hi > lo) { M -= u.q * (hi - lo) * (x - (lo + hi) / 2); V -= u.q * (hi - lo); }
        }
        for (var b2 = 0; b2 < e.pt.length; b2++) {
          var p = e.pt[b2];
          if (x > p.a) { M -= p.P * (x - p.a); V -= p.P; }
        }
        rec.M.push(M); rec.V.push(V); rec.xs.push(e.x0 + x);
      }
      out.push(rec);
    }
    return out;
  }

  /** 由端剪力反推支座反力（向上为正）。 */
  function reactions(solver, d, results) {
    var R = {}, k;
    for (k = 0; k < solver.xs.length; k++) R[k] = 0;
    for (var n = 0; n < results.length; n++) {
      var r = results[n];
      R[r.i] += r.Vi;
      R[r.j] -= r.Vj;
    }
    return R;
  }

  global.FEM = {
    luDecomp: luDecomp, luSolve: luSolve, solve: solve,
    buildMesh: buildMesh, buildElems: buildElems,
    distribute: distribute, elemEquiv: elemEquiv,
    assembleK: assembleK, assembleF: assembleF,
    makeSolver: makeSolver, elemResults: elemResults, reactions: reactions,
    Nint: Nint, shapeN: shapeN
  };
})(window);
