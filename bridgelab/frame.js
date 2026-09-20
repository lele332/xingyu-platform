/* ==========================================================================
 * frame.js — 平面框架 / 索单元有限元内核（零依赖，纯数学，不含桥梁术语）
 *
 * 与 fem.js 的分工：
 *   fem.js  = 2 自由度欧拉梁（只有弯曲），用于梁桥，已过 17 项解析验算
 *   frame.js= 3 自由度平面框架（轴力+剪力+弯矩）+ 只受拉索单元
 *             用于拱桥（拱圈轴压）、斜拉桥（塔梁压弯 + 索）、悬索桥
 *
 * 坐标与符号约定（全模块统一，改一处必须全改）：
 *   整体坐标：x 向右，y 向上（注意与 fem.js 的"荷载向下为正"不同，这里荷载直接给正负号）
 *   节点自由度：[u, v, θ]，u 右为正，v 上为正，θ 逆时针为正
 *   单元局部坐标：x' 沿 i→j，y' 按右手系
 *   杆端力（局部）：[N_i, V_i, M_i, N_j, V_j, M_j]
 *                   N 拉为正，V 使杆端顺时针转为正，M 逆时针为正
 *   对内力输出另给一套"桥梁习惯"的换算：轴力 N（压为正）、剪力 V、弯矩 M（下缘受拉为正）
 * ========================================================================== */
(function (root) {
  'use strict';

  /* ---------- 线性方程组：直接复用 LU（与 fem.js 同算法，独立实现以免耦合） ---------- */
  function luDecomp(A) {
    var n = A.length, i, j, k;
    var lu = [], piv = [];
    for (i = 0; i < n; i++) { lu.push(A[i].slice()); piv.push(i); }
    for (k = 0; k < n; k++) {
      var p = k, mx = Math.abs(lu[k][k]);
      for (i = k + 1; i < n; i++) { var v = Math.abs(lu[i][k]); if (v > mx) { mx = v; p = i; } }
      if (mx < 1e-14) return null;
      if (p !== k) { var t = lu[p]; lu[p] = lu[k]; lu[k] = t; var q = piv[p]; piv[p] = piv[k]; piv[k] = q; }
      var d = lu[k][k];
      for (i = k + 1; i < n; i++) {
        var f = lu[i][k] / d; lu[i][k] = f;
        if (f !== 0) for (j = k + 1; j < n; j++) lu[i][j] -= f * lu[k][j];
      }
    }
    return { lu: lu, piv: piv, n: n };
  }

  function luSolve(LU, b) {
    var n = LU.n, lu = LU.lu, piv = LU.piv, i, j;
    var x = new Array(n);
    for (i = 0; i < n; i++) x[i] = b[piv[i]];
    for (i = 1; i < n; i++) { var s = x[i]; for (j = 0; j < i; j++) s -= lu[i][j] * x[j]; x[i] = s; }
    for (i = n - 1; i >= 0; i--) {
      var t = x[i];
      for (j = i + 1; j < n; j++) t -= lu[i][j] * x[j];
      x[i] = t / lu[i][i];
    }
    return x;
  }

  /* ---------- 单元刚度 ---------- */

  /** 平面框架单元 6×6 整体刚度。EA=轴向刚度，EI=抗弯刚度 */
  function frameK(x1, y1, x2, y2, EA, EI) {
    var dx = x2 - x1, dy = y2 - y1;
    var L = Math.sqrt(dx * dx + dy * dy);
    if (L < 1e-12) return null;
    var c = dx / L, s = dy / L;
    var a = EA / L;
    var b1 = 12 * EI / (L * L * L), b2 = 6 * EI / (L * L);
    var b3 = 4 * EI / L, b4 = 2 * EI / L;

    // 局部刚度
    var k = [
      [a, 0, 0, -a, 0, 0],
      [0, b1, b2, 0, -b1, b2],
      [0, b2, b3, 0, -b2, b4],
      [-a, 0, 0, a, 0, 0],
      [0, -b1, -b2, 0, b1, -b2],
      [0, b2, b4, 0, -b2, b3]
    ];
    // 转换矩阵 T：局部 = T · 整体
    var T = [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1]
    ];
    // K = Tᵀ k T
    var kt = mul(mul(transpose(T), k), T);
    return { K: kt, L: L, c: c, s: s, T: T, k: k };
  }

  /** 索 / 桁架单元：只有轴向刚度。用于斜拉索、吊索、主缆离散段 */
  function trussK(x1, y1, x2, y2, EA) {
    var dx = x2 - x1, dy = y2 - y1;
    var L = Math.sqrt(dx * dx + dy * dy);
    if (L < 1e-12) return null;
    var c = dx / L, s = dy / L;
    var k = EA / L;
    var c2 = c * c, s2 = s * s, cs = c * s;
    return {
      K: [
        [k * c2, k * cs, 0, -k * c2, -k * cs, 0],
        [k * cs, k * s2, 0, -k * cs, -k * s2, 0],
        [0, 0, 0, 0, 0, 0],
        [-k * c2, -k * cs, 0, k * c2, k * cs, 0],
        [-k * cs, -k * s2, 0, k * cs, k * s2, 0],
        [0, 0, 0, 0, 0, 0]
      ],
      L: L, c: c, s: s
    };
  }

  function transpose(M) {
    var r = M.length, c = M[0].length, i, j, o = [];
    for (i = 0; i < c; i++) { o.push(new Array(r)); }
    for (i = 0; i < r; i++) for (j = 0; j < c; j++) o[j][i] = M[i][j];
    return o;
  }

  function mul(A, B) {
    var n = A.length, m = B[0].length, p = B.length, i, j, k, o = [];
    for (i = 0; i < n; i++) { o.push(new Array(m).fill(0)); }
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
      var s = 0; for (k = 0; k < p; k++) s += A[i][k] * B[k][j];
      o[i][j] = s;
    }
    return o;
  }

  /* ---------- 组装与求解 ----------
   * nodes: [{x, y, fixed:[bool,bool,bool]}]
   * elems: [{i, j, EA, EI, type:'frame'|'truss', T0(初始索力, 拉为正)}]
   */
  function makeModel(nodes, elems) {
    var nn = nodes.length, ndof = nn * 3;
    var i, j, s;

    // 只连索/桁架单元的节点，转动自由度没有任何刚度 → 必须自动约束，否则总刚度阵奇异
    var hasBending = new Array(nn).fill(false);
    for (i = 0; i < elems.length; i++) {
      if (elems[i].type !== 'truss') { hasBending[elems[i].i] = true; hasBending[elems[i].j] = true; }
    }

    // 约束自由度表
    var fixed = [];
    for (i = 0; i < nn; i++) {
      var f = nodes[i].fixed || [false, false, false];
      for (j = 0; j < 3; j++) if (f[j]) fixed.push(i * 3 + j);
      if (!hasBending[i]) fixed.push(i * 3 + 2);   // 铰接节点：自动锁 θ
    }
    var isFixed = new Array(ndof).fill(false);
    for (s = 0; s < fixed.length; s++) isFixed[fixed[s]] = true;

    // 自由自由度映射
    var map = new Array(ndof).fill(-1), nfree = 0;
    for (i = 0; i < ndof; i++) if (!isFixed[i]) map[i] = nfree++;

    function buildK() {
      var K = [];
      for (i = 0; i < nfree; i++) K.push(new Array(nfree).fill(0));
      for (var e = 0; e < elems.length; e++) {
        var el = elems[e];
        var n1 = nodes[el.i], n2 = nodes[el.j];
        var r = el.type === 'truss'
          ? trussK(n1.x, n1.y, n2.x, n2.y, el.EA)
          : frameK(n1.x, n1.y, n2.x, n2.y, el.EA, el.EI);
        if (!r) continue;
        el._geo = r;
        var dofs = [el.i * 3, el.i * 3 + 1, el.i * 3 + 2, el.j * 3, el.j * 3 + 1, el.j * 3 + 2];
        for (i = 0; i < 6; i++) {
          var gi = map[dofs[i]]; if (gi < 0) continue;
          for (j = 0; j < 6; j++) {
            var gj = map[dofs[j]]; if (gj < 0) continue;
            K[gi][gj] += r.K[i][j];
          }
        }
        // 几何刚度（应力刚化）：受拉单元 T>0 对横向位移提供附加刚度
        // k_g = (T/L)·垂直方向投影，叠加在 u_i,v_i,u_j,v_j 四个自由度上。
        // 悬索桥主缆/吊索的"重力刚度"即来源于此，缺了它整体结构是机构。
        var Tg = el.Tg || 0;
        if (Tg > 0) {
          var Lg = r.L, cg = r.c, sg = r.s;
          var kg = Tg / Lg;
          // 4×4（局部整体一致，只需方向余弦）：[u_i,v_i,u_j,v_j] 顺序
          var g4 = [
            [sg * sg, -cg * sg, -sg * sg, cg * sg],
            [-cg * sg, cg * cg, cg * sg, -cg * cg],
            [-sg * sg, cg * sg, sg * sg, -cg * sg],
            [cg * sg, -cg * cg, -cg * sg, cg * cg]
          ];
          var pos4 = [0, 1, 3, 4];   // 6×6 中的平动自由度位置
          for (i = 0; i < 4; i++) {
            var gi2 = map[dofs[pos4[i]]]; if (gi2 < 0) continue;
            for (j = 0; j < 4; j++) {
              var gj2 = map[dofs[pos4[j]]]; if (gj2 < 0) continue;
              K[gi2][gj2] += kg * g4[i][j];
            }
          }
        }
      }
      return K;
    }

    /**
     * 求解给定荷载向量。F 长度 = ndof（含约束位，约束位的值忽略）
     * 返回：{ d (长度 ndof 的全量位移), ok }
     */
    function solveF(F) {
      // 先组装刚度阵：buildK 会顺手写入 el._geo（单元几何），T0 等效荷载要用
      // 顺序不能反——首次求解时若先装 T0 再 buildK，_geo  undefined，初索力会被静默丢弃
      var K = buildK();

      var Ff = new Array(nfree).fill(0);
      for (i = 0; i < ndof; i++) if (map[i] >= 0) Ff[map[i]] = F[i];

      // 索单元初始索力的等效节点力（初应变 → 等效荷载）
      for (var e = 0; e < elems.length; e++) {
        var el = elems[e];
        if (!el.T0) continue;
        if (el.noEquivLoad) continue;   // 仅用于内力报告的预张力（悬索桥成桥索力），不组装进荷载向量
        var g = el._geo;
        if (!g) continue;
        // 索对两端的作用：i 端受拉向 j，j 端受拉向 i
        var fx = el.T0 * g.c, fy = el.T0 * g.s;
        // 索受拉 T0 时，把 i 端拉向 j 端、把 j 端拉向 i 端 → 等价节点荷载自平衡
        var di = el.i * 3, dj = el.j * 3;
        var addF = [fx, fy, 0, -fx, -fy, 0];
        var dofs = [di, di + 1, di + 2, dj, dj + 1, dj + 2];
        for (var t = 0; t < 6; t++) {
          var gidx = map[dofs[t]];
          if (gidx >= 0) Ff[gidx] += addF[t];
        }
      }

      var LU = luDecomp(K);
      if (!LU) return { ok: false, d: null, reason: '矩阵奇异：结构可能缺少约束或存在机构' };
      var df = luSolve(LU, Ff);
      var d = new Array(ndof).fill(0);
      for (i = 0; i < ndof; i++) d[i] = map[i] >= 0 ? df[map[i]] : 0;
      return { ok: true, d: d };
    }

    /** 单元内力（局部坐标）。返回 {N, Vi, Mi, Vj, Mj} —— N 拉为正 */
    function elemForces(el, d) {
      var g = el._geo;
      if (!g) return null;
      var N0 = el.T0 || 0;
      if (el.type === 'truss') {
        /* 索/桁架单元：只有轴向，由两端沿索向的相对位移求伸长
         *  受拉为正 → N = EA/L · [(c·u_j + s·v_j) − (c·u_i + s·v_i)] + N0 */
        var duI = g.c * d[el.i * 3] + g.s * d[el.i * 3 + 1];
        var duJ = g.c * d[el.j * 3] + g.s * d[el.j * 3 + 1];
        var N = (duJ - duI) * el.EA / g.L + N0;
        return { N: N, Vi: 0, Mi: 0, Vj: 0, Mj: 0, T: N };
      }
      var dofs = [el.i * 3, el.i * 3 + 1, el.i * 3 + 2, el.j * 3, el.j * 3 + 1, el.j * 3 + 2];
      var dg = new Array(6);
      for (var i = 0; i < 6; i++) dg[i] = d[dofs[i]];
      var dl = mul(g.T, [[dg[0]], [dg[1]], [dg[2]], [dg[3]], [dg[4]], [dg[5]]]);
      var v = [];
      for (i = 0; i < 6; i++) v.push(dl[i][0]);
      var f = mul(g.k, [[v[0]], [v[1]], [v[2]], [v[3]], [v[4]], [v[5]]]);
      var q = [];
      for (i = 0; i < 6; i++) q.push(f[i][0]);
      /* 符号换算（与 fem.js 保持一致，务必不要改）：
       *   q = k·d 是"施加在单元上的外力"，内力需按约定换算
       *   N  : 受拉为正 → N = -q[0]         （q[0] 为压时为正）
       *   Mi : 下缘受拉（正弯矩）为正 → Mi = -q[2]
       *   Mj : 下缘受拉为正 → Mj = +q[5]
       *   Vi : q[1]；Vj : -q[4]
       */
      return {
        N: -q[0] + N0,
        Vi: q[1], Mi: -q[2],
        Vj: -q[4], Mj: +q[5],
        T: -q[0] + N0
      };
    }

    return { nodes: nodes, elems: elems, ndof: ndof, nfree: nfree, solveF: solveF, elemForces: elemForces, buildK: buildK };
  }

  /* ---------- Ernst 等效弹性模量（斜拉索垂度修正） ----------
   * 经典割线模量式：E_eq = E0 / (1 + γ²·L²·E0 / (12·σ³))
   *   γ  = 拉索换算重度 (kN/m³)，钢索常取 78.5~82
   *   L  = 索水平投影长度 (m)
   *   σ  = 索应力 (kPa，与 E0 同单位)
   * 量纲校验：[kN/m³ · m / kPa]² · kPa / kPa³ → 无量纲 ✓
   * 出处：Ernst (1965)；JTG/T D65-01 亦推荐此式（切线模量形式在 σ0=σ1 时退化为本式）
   */
  function ernstE(E0, gamma, Lh, sigma) {
    if (!(sigma > 0)) return E0 * 0.2;
    var denom = 1 + (gamma * Lh) * (gamma * Lh) * E0 / (12 * sigma * sigma * sigma);
    return E0 / denom;
  }

  /* ---------- 悬链线 / 抛物线几何 ---------- */

  /** 悬链线拱轴：y = f/(m-1)·(cosh(k·ξ) − 1)，ξ = 2x/L，k = arccosh(m) = ln(m+√(m²−1))
   *  返回相对拱顶的"下垂量"（正值向下） */
  function catenaryAxis(x, L, f, m) {
    if (Math.abs(m - 1) < 1e-9) {
      // m→1 退化为抛物线
      var xi = 2 * x / L;
      return f * xi * xi;
    }
    var k = Math.log(m + Math.sqrt(m * m - 1));
    var xi = 2 * x / L;
    return f / (m - 1) * (Math.cosh(k * xi) - 1);
  }

  /** 抛物线拱轴（均布荷载下的合理拱轴线） */
  function parabolaAxis(x, L, f) {
    var xi = 2 * x / L;
    return f * xi * xi;
  }

  /** 圆弧拱轴 */
  function circleAxis(x, L, f) {
    var R = (L * L / 4 + f * f) / (2 * f);
    var xx = Math.abs(x);
    var yy = R - f - Math.sqrt(Math.max(0, R * R - xx * xx));
    return -yy; // 相对拱顶向下
  }

  /** 悬索桥主缆抛物线：y = 4f·x(L−x)/L²（以两支点连线为 0，向下为正） */
  function suspCable(x, L, f) {
    return 4 * f * x * (L - x) / (L * L);
  }

  root.FRAME = {
    luDecomp: luDecomp, luSolve: luSolve,
    frameK: frameK, trussK: trussK,
    makeModel: makeModel,
    ernstE: ernstE,
    catenaryAxis: catenaryAxis, parabolaAxis: parabolaAxis, circleAxis: circleAxis,
    suspCable: suspCable,
    transpose: transpose, mul: mul
  };
})(typeof window !== 'undefined' ? window : globalThis);
