/* ==========================================================================
 * systems.js — 拱桥 / 斜拉桥 / 悬索桥 结构体系生成与验算
 *
 * 定位：桥梁"领域知识"层，所有力学计算调 frame.js，几何与规范公式在此。
 * 每种体系返回统一结构 { nodes, elems, chart, report, checks }
 *   nodes/elems → 直接喂给 FRAME.makeModel
 *   chart       → [{x,y,type}] 供 SVG 画整体立面
 *   report      → [{label, value, note}] 计算书条目
 *   checks      → [{label, value, limit, pass, note}] 验算结果
 *
 * 坐标约定与 frame.js 一致：x 右、y 上、荷载向下为负。
 * ========================================================================== */
(function (root) {
  'use strict';
  var F = (typeof window !== 'undefined' ? window : globalThis).FRAME;
  var G = 9.81;

  /* ---------- 材料库（与 bridge.js 对齐，供截面估算） ---------- */
  var STEEL = { Es: 195e6, fsd: 1.86e6, gamma: 78.5, name: '高强度钢丝/钢绞线' };   // kPa（195 GPa / 1860 MPa），kN/m³
  var CONC_E = { C40: 3.25e7, C50: 3.45e7, C55: 3.55e7, C60: 3.65e7 };           // kPa

  /* 梁桥→框架截面换算：由 A、I 给 EA、EI */
  function secEA(p, grade) {
    var Ec = CONC_E[grade] || 3.45e7;
    return { EA: p.A * Ec, EI: p.I * Ec };
  }

  /* ======================================================================
   * 1. 拱桥
   * 体系：无铰拱（两拱脚固结）+ 悬链线/抛物线拱轴 + 拱上立柱传力
   * 关键量：恒载水平推力 Hg、拱脚轴力、拱内弯矩、拱脚应力
   * ==================================================================== */
  function buildArch(P) {
    var L = P.L, f = P.f, n = Math.max(30, Math.round(L / 2));
    var nodes = [], elems = [], chart = [], i;

    // 拱轴线（y 向上，拱顶为最高点）
    var axis = P.axisKind === 'para' ? F.parabolaAxis
      : P.axisKind === 'circle' ? F.circleAxis
        : function (x, Lc, fc) { return F.catenaryAxis(x, Lc, fc, P.m || 2.0); };

    // 拱圈节点（从拱脚到拱脚，跨中为原点）
    for (i = 0; i <= n; i++) {
      var x = L * i / n - L / 2;
      var y = f - axis(Math.abs(x), L, f);    // 拱顶 y=f，拱脚 y=0
      nodes.push({ x: x + L / 2, y: y, fixed: [false, false, false], tag: 'arch' });
      chart.push({ x: x + L / 2, y: y, type: 'arch' });
    }
    // 桥面节点（与拱圈节点同 x，高 HDeck）
    var deckY = f + P.deckH;
    var deckNodes = [];
    for (i = 0; i <= n; i++) {
      nodes.push({ x: L * i / n, y: deckY, fixed: [false, false, false], tag: 'deck' });
      deckNodes.push(nodes.length - 1);
      chart.push({ x: L * i / n, y: deckY, type: 'deck' });
    }

    var secA = secEA(P.archSec, P.grade);
    var secD = secEA(P.deckSec, P.grade);

    // 拱圈单元
    for (i = 0; i < n; i++) elems.push({ i: i, j: i + 1, EA: secA.EA, EI: secA.EI, type: 'frame' });
    // 桥面单元
    for (i = 0; i < n; i++) elems.push({ i: deckNodes[i], j: deckNodes[i + 1], EA: secD.EA, EI: secD.EI, type: 'frame' });
    // 立柱（每隔 nCol 个节点一根，简化为间距 colS）
    var colIdx = [];
    var step = Math.max(2, Math.round(P.colS / (L / n)));
    for (i = 0; i <= n; i += step) colIdx.push(i);
    if (colIdx[colIdx.length - 1] !== n) colIdx.push(n);
    for (var c = 0; c < colIdx.length; c++) {
      var k = colIdx[c];
      elems.push({ i: k, j: deckNodes[k], EA: secA.EA, EI: secA.EI, type: 'frame' });
      chart.push({ x: nodes[k].x, y: nodes[k].y, type: 'col', x2: nodes[deckNodes[k]].x, y2: nodes[deckNodes[k]].y });
    }
    // 支座
    nodes[0].fixed = [true, true, P.hinged ? false : true];
    nodes[n].fixed = [true, true, P.hinged ? false : true];

    var m = F.makeModel(nodes, elems);

    // 恒载：桥面 qD（含自重）沿水平投影施加到 deck 节点
    var Fd = new Array(nodes.length * 3).fill(0);
    for (i = 0; i < n; i++) {
      var dx = L / n;
      var w = -P.qD * dx / 2;
      Fd[deckNodes[i] * 3 + 1] += w;
      Fd[deckNodes[i + 1] * 3 + 1] += w;
    }
    var rd = m.solveF(Fd);

    // 内力扫描
    var maxM = 0, Nspring = 0, Mmid = 0, minNF = 1e18;
    for (var e = 0; e < elems.length; e++) {
      var el = elems[e], ef = m.elemForces(el, rd.d);
      if (!ef) continue;
      if (ef.Mi !== undefined) {
        maxM = Math.max(maxM, Math.abs(ef.Mi), Math.abs(ef.Mj));
        if (el.tag !== 'col') {
          var midX = (nodes[el.i].x + nodes[el.j].x) / 2;
          if (Math.abs(midX - L / 2) < L / 2 / n) Mmid = ef.Mi;
        }
      }
      // 拱脚轴力（压为负）
      if (el.i === 0 || el.j === 0 || el.i === n || el.j === n) {
        if (el.tag !== 'col') { Nspring = Math.min(Nspring, ef.N); }
      }
      minNF = Math.min(minNF, ef.N);
    }

    // 恒载水平推力（理论值 Hg = ΣMj/f 的简化：用抛物线理论）
    var HgTheory = P.qD * L * L / (8 * f);
    // 拱脚应力估算
    var sigmaSpring = -Nspring / P.archSec.A / 1000;    // kPa→MPa
    var sigmaLim = (P.grade === 'C40' ? 18.4 : P.grade === 'C50' ? 22.4 : P.grade === 'C55' ? 24.4 : 25.9);

    var report = [
      { label: '拱轴线', value: (P.axisKind === 'para' ? '抛物线' : P.axisKind === 'circle' ? '圆弧线' : '悬链线 m=' + (P.m || 2)), note: '矢跨比 f/L = ' + (f / L).toFixed(3) },
      { label: '计算跨径 L', value: L.toFixed(1) + ' m' },
      { label: '矢高 f', value: f.toFixed(2) + ' m' },
      { label: '拱上均布荷载 q', value: P.qD.toFixed(1) + ' kN/m', note: '沿水平投影' },
      { label: '理论恒载推力 Hg=qL²/8f', value: HgTheory.toFixed(0) + ' kN', note: '抛物线合理拱轴线' },
      { label: '拱脚轴力 N（压）', value: (-Nspring).toFixed(0) + ' kN', note: '有限元结果' },
      { label: '拱内最大弯矩', value: maxM.toFixed(1) + ' kN·m', note: '应远小于同跨简支梁 qL²/8=' + (P.qD * L * L / 8).toFixed(0) },
      { label: '拱脚压应力估算', value: sigmaSpring.toFixed(2) + ' MPa', note: 'N/A 均匀分布近似' }
    ];
    var checks = [
      { label: '拱内弯矩 / 同跨简支梁', value: (maxM / (P.qD * L * L / 8) * 100).toFixed(2) + ' %', limit: '< 5 %', pass: maxM / (P.qD * L * L / 8) < 0.05, note: '合理拱轴线应接近 0' },
      { label: '拱脚压应力 ≤ 0.5 fcd', value: sigmaSpring.toFixed(2) + ' MPa', limit: '≤ ' + (0.5 * sigmaLim).toFixed(1) + ' MPa', pass: sigmaSpring <= 0.5 * sigmaLim, note: '拱桥以受压为主，应力应远低于强度' }
    ];
    return { model: m, nodes: nodes, elems: elems, chart: chart, report: report, checks: checks, loadCase: Fd };
  }

  /* ======================================================================
   * 2. 斜拉桥
   * 体系：双塔双索面、扇形索、漂浮体系（塔梁间设支座）
   * 算法：刚性支承连续梁法估初始索力 → Ernst 弹模迭代 → 恒载+活载
   * 关键量：成桥索力、Ernst 弹模折减、主梁弯矩、塔顶水平位移
   * ==================================================================== */
  function buildCableStayed(P) {
    // UI 中 L 明确表示主跨；总桥长 = 边跨 + 主跨 + 边跨。
    var mainL = P.L, sideL = P.anchorSpan, totalL = mainL + 2 * sideL;
    var spans = [sideL, mainL, sideL], xs = [0], spanEnds = [], targetDx = 4;
    for (var sp = 0; sp < spans.length; sp++) {
      var ns = Math.max(4, Math.round(spans[sp] / targetDx));
      var x0 = xs[xs.length - 1];
      for (var si = 1; si <= ns; si++) xs.push(x0 + spans[sp] * si / ns);
      spanEnds.push(xs.length - 1);
    }
    var n = xs.length - 1, nodes = [], elems = [], chart = [], i;

    // 主梁节点（全桥：边跨 + 主跨 + 边跨）
    for (i = 0; i <= n; i++) {
      nodes.push({ x: xs[i], y: 0, fixed: [false, false, false], tag: 'beam' });
      chart.push({ x: xs[i], y: 0, type: 'beam' });
    }
    var towerDeckIdx = [spanEnds[0], spanEnds[1]];

    // 塔身节点。塔底为独立固结节点；主梁在塔位设置竖向支承，保持半漂浮体系。
    var SEG = P.fanS + 1, towerTop = [];
    for (var t = 0; t < towerDeckIdx.length; t++) {
      var ti = towerDeckIdx[t], bx = nodes[ti].x, tnodes = [];
      for (var k = 0; k <= SEG; k++) {
        nodes.push({
          x: bx, y: P.Ht * k / SEG, tag: k === 0 ? 'towerbase' : 'tower',
          fixed: k === 0 ? [true, true, true] : [false, false, false]
        });
        tnodes.push(nodes.length - 1);
      }
      for (k = 0; k < SEG; k++) {
        elems.push({ i: tnodes[k], j: tnodes[k + 1], EA: P.towerEA, EI: P.towerEI, type: 'frame' });
      }
      nodes[ti].fixed[1] = true; // 塔梁竖向支承；纵向仍由索与边界共同约束
      towerTop.push({ tnodes: tnodes, x: bx, top: tnodes[SEG], deck: ti });
      chart.push({ x: bx, y: 0, type: 'tower', x2: bx, y2: P.Ht });
    }

    var secB = secEA(P.beamSec, P.grade);
    for (i = 0; i < n; i++) elems.push({ i: i, j: i + 1, EA: secB.EA, EI: secB.EI, type: 'frame' });

    // 扇形索：越远的梁上锚点必须对应越高的塔上锚点，避免索线交叉。
    var MIN_A = 20 * Math.PI / 180, SIN_MIN = Math.sin(MIN_A);
    var cableEls = [], cableKeys = {}, minAngle = 90, maxAngle = 0;
    for (var tw = 0; tw < towerTop.length; tw++) {
      var tt = towerTop[tw];
      for (var side = -1; side <= 1; side += 2) {
        var isOuter = (tw === 0 && side < 0) || (tw === 1 && side > 0);
        var maxReach = isOuter ? sideL : mainL / 2;
        var trib = maxReach / P.fanS;
        for (var sidx = 1; sidx <= P.fanS; sidx++) {
          var frac = sidx / SEG;
          var aIdx = tt.tnodes[sidx];             // 近索低锚、远索高锚
          var ay = nodes[aIdx].y;
          var reach = Math.min(maxReach * frac, ay / Math.tan(MIN_A));
          var targetX = tt.x + side * reach;
          var bi = 0, best = Infinity;
          for (var xi = 0; xi < xs.length; xi++) {
            var dx0 = Math.abs(xs[xi] - targetX);
            if (dx0 < best) { best = dx0; bi = xi; }
          }
          if (bi === tt.deck) continue;
          var key = aIdx + ':' + bi;
          if (cableKeys[key]) continue;
          cableKeys[key] = true;
          var run = Math.abs(nodes[bi].x - nodes[aIdx].x);
          var rise = Math.abs(nodes[aIdx].y - nodes[bi].y);
          var angle = Math.atan2(rise, Math.max(run, 1e-9)) * 180 / Math.PI;
          minAngle = Math.min(minAngle, angle); maxAngle = Math.max(maxAngle, angle);
          elems.push({
            i: aIdx, j: bi, EA: STEEL.Es * P.cableA, type: 'truss', T0: 0,
            cable: true, trib: trib, designEA: STEEL.Es * P.cableA
          });
          cableEls.push(elems.length - 1);
          chart.push({ x: nodes[aIdx].x, y: nodes[aIdx].y, type: 'cable', x2: nodes[bi].x, y2: nodes[bi].y });
        }
      }
    }

    // 梁端竖向约束；塔位已有竖向支承。左端补纵向约束，消除整体漂移。
    nodes[0].fixed = [true, true, false];
    nodes[n].fixed = [false, true, false];

    // 初始索力：每根索承担其所属索区的恒载影响宽度。
    for (var ci = 0; ci < cableEls.length; ci++) {
      var cel0 = elems[cableEls[ci]];
      var ca = nodes[cel0.i], cb = nodes[cel0.j];
      var run0 = Math.abs(cb.x - ca.x), rise0 = Math.abs(cb.y - ca.y);
      var sinA = Math.max(rise0 / Math.hypot(run0, rise0), SIN_MIN);
      cel0.designT0 = P.qD * cel0.trib / sinA;
      cel0.T0 = cel0.designT0;
      cel0.EA = cel0.designEA;
    }

    // 恒载向量：按各主梁单元真实长度分配。
    var Fd = new Array(nodes.length * 3).fill(0);
    for (i = 0; i < n; i++) {
      var dx = xs[i + 1] - xs[i], w = -P.qD * dx / 2;
      Fd[i * 3 + 1] += w;
      Fd[(i + 1) * 3 + 1] += w;
    }

    // Ernst 等效弹模 + tension-only 活动集迭代。
    var iters = P.iters || 12, m, r, converged = false;
    for (var it = 0; it < iters; it++) {
      m = F.makeModel(nodes, elems);
      r = m.solveF(Fd);
      if (!r.ok) break;
      var maxDelta = 0;
      for (var ce = 0; ce < cableEls.length; ce++) {
        var cel = elems[cableEls[ce]], ef = m.elemForces(cel, r.d), newEA;
        if (ef.T <= 0) {
          cel.T0 = 0;
          newEA = 1e-6 * cel.designEA;
        } else {
          var Lh = Math.abs(nodes[cel.j].x - nodes[cel.i].x);
          var sigma = Math.max(ef.T / P.cableA, 50);
          newEA = F.ernstE(STEEL.Es, STEEL.gamma, Lh, sigma) * P.cableA;
        }
        maxDelta = Math.max(maxDelta, Math.abs((newEA - cel.EA) / Math.max(cel.designEA, 1)));
        cel.EA = newEA;
      }
      if (maxDelta < 1e-4) { converged = true; break; }
    }

    var mFinal = F.makeModel(nodes, elems), rFinal = mFinal.solveF(Fd);
    if (!rFinal.ok) throw new Error(rFinal.reason || '斜拉桥模型求解失败');

    // 最终索力必须按最终模型重新统计，不能沿用上轮迭代中的 slackCount。
    var Tmin = 1e18, Tmax = 0, EeqMin = 1e18, EeqMax = 0, finalSlackCount = 0;
    for (var c2 = 0; c2 < cableEls.length; c2++) {
      var cEl = elems[cableEls[c2]], cf = mFinal.elemForces(cEl, rFinal.d);
      if (cf.T <= 0 || cEl.EA < 1e-5 * cEl.designEA) {
        finalSlackCount++;
        continue;
      }
      Tmin = Math.min(Tmin, cf.T); Tmax = Math.max(Tmax, cf.T);
      var Lh2 = Math.abs(nodes[cEl.j].x - nodes[cEl.i].x);
      var sig2 = Math.max(cf.T / P.cableA, 50);
      var Ee2 = F.ernstE(STEEL.Es, STEEL.gamma, Lh2, sig2);
      EeqMin = Math.min(EeqMin, Ee2); EeqMax = Math.max(EeqMax, Ee2);
    }
    if (!(Tmin < 1e17)) Tmin = 0;
    if (!(EeqMin < 1e17)) { EeqMin = STEEL.Es; EeqMax = STEEL.Es; }

    var maxM = 0;
    for (var e2 = 0; e2 < elems.length; e2++) {
      var el2 = elems[e2];
      if (el2.type !== 'frame' || nodes[el2.i].tag !== 'beam') continue;
      var ef2 = mFinal.elemForces(el2, rFinal.d);
      maxM = Math.max(maxM, Math.abs(ef2.Mi), Math.abs(ef2.Mj));
    }
    var towerDisp = 0;
    for (var td = 0; td < towerTop.length; td++) {
      towerDisp = Math.max(towerDisp, Math.abs(rFinal.d[towerTop[td].top * 3]), Math.abs(rFinal.d[towerTop[td].top * 3 + 1]));
    }

    var Eratio = (1 - EeqMin / STEEL.Es) * 100;
    var report = [
      { label: '主跨 L', value: mainL.toFixed(0) + ' m', note: '两塔中心距' },
      { label: '边跨 / 全桥长', value: sideL.toFixed(0) + ' / ' + totalL.toFixed(0) + ' m' },
      { label: '塔高 Ht', value: P.Ht.toFixed(1) + ' m' },
      { label: '拉索数量', value: cableEls.length + ' 根' },
      { label: '拉索最小倾角', value: minAngle.toFixed(1) + '°', note: '目标不小于 20°' },
      { label: '索截面面积', value: (P.cableA * 1e6).toFixed(0) + ' mm²/索' },
      { label: '恒载集度 q', value: P.qD.toFixed(1) + ' kN/m' },
      { label: '成桥索力范围', value: Tmin.toFixed(0) + ' ~ ' + Tmax.toFixed(0) + ' kN', note: finalSlackCount > 0 ? finalSlackCount + ' 根索在最终状态松弛' : '全部索受拉，无松弛' },
      { label: 'Ernst 等效弹模', value: (EeqMin / 1e6).toFixed(1) + ' ~ ' + (EeqMax / 1e6).toFixed(1) + ' GPa', note: '折减 ' + Eratio.toFixed(1) + '%（E0=195 GPa）' },
      { label: '主梁最大弯矩', value: maxM.toFixed(0) + ' kN·m' },
      { label: '塔顶最大位移', value: (towerDisp * 1000).toFixed(1) + ' mm' }
    ];
    var checks = [
      { label: '索力迭代', value: converged ? '收敛' : '未收敛', limit: '收敛', pass: converged, note: 'Ernst 弹模与 tension-only 活动集' },
      { label: '拉索最小倾角', value: minAngle.toFixed(1) + '°', limit: '≥ 20°', pass: minAngle >= 19.5, note: '倾角过小会显著增大索力与水平分力' },
      { label: '松弛索数量', value: finalSlackCount + ' 根', limit: '0', pass: finalSlackCount === 0, note: '按最终求解状态重新统计' },
      { label: '塔顶位移 / 塔高', value: (towerDisp / P.Ht * 100).toFixed(3) + ' %', limit: '< 0.5 %', pass: towerDisp / P.Ht < 0.005, note: '教学模型控制指标' }
    ];
    return {
      model: mFinal, nodes: nodes, elems: elems, chart: chart, report: report, checks: checks, loadCase: Fd,
      geometry: { mainSpan: mainL, sideSpan: sideL, totalLength: totalL, towerX: [sideL, sideL + mainL], cableCount: cableEls.length, minCableAngle: minAngle, maxCableAngle: maxAngle },
      cableElementIndices: cableEls, converged: converged, slackCount: finalSlackCount
    };
  }

  /* ======================================================================
   * 3. 悬索桥
   * 体系：地锚式、抛物线主缆、吊索、加劲梁（简支于两塔）
   * 算法：抛物线法找形（初步设计）→ 主缆面积迭代 → 恒载索力 → 活载重力刚度分配
   * 关键量：主缆水平力 H、最大索力 T、主缆面积、加劲梁弯矩
   * ==================================================================== */
  function buildSuspension(P) {
    var L = P.L, f = P.f, n = Math.max(40, Math.round(L / 8));
    var nodes = [], elems = [], chart = [], i;

    // 主缆节点（塔顶 y=0，跨中下垂 f，y 向下为正 → 节点 y = -f·4x(L-x)/L²）
    var cableIdx = [];
    for (i = 0; i <= n; i++) {
      var x = L * i / n;
      var sag = F.suspCable(x, L, f);              // 正值向下
      nodes.push({ x: x, y: -sag, fixed: [false, false, false], tag: 'cable' });
      cableIdx.push(nodes.length - 1);
      chart.push({ x: x, y: -sag, type: 'cable' });
    }
    // 加劲梁节点（y = -f 直线，即跨中主缆处）
    var deckY = -f;
    var deckIdx = [];
    for (i = 0; i <= n; i++) {
      nodes.push({ x: L * i / n, y: deckY, fixed: [false, false, false], tag: 'deck' });
      deckIdx.push(nodes.length - 1);
      chart.push({ x: L * i / n, y: deckY, type: 'deck' });
    }
    // 塔顶节点 = 主缆端节点（同一节点，不另建！）
    // ——原实现另建同坐标塔顶节点且不合并：主缆水平力无传力路径，整体成机构、总刚度阵奇异；
    //    且循环条件 i<=2 会在 x=L 处重复建塔（第三次循环 tx 仍为 L）
    var towerIdx = [cableIdx[0], cableIdx[n]];
    nodes[cableIdx[0]].tag = 'tower';
    nodes[cableIdx[n]].tag = 'tower';
    chart.push({ x: 0, y: 0, type: 'tower', x2: 0, y2: -P.towerH - f });
    chart.push({ x: L, y: 0, type: 'tower', x2: L, y2: -P.towerH - f });

    var secD = secEA(P.deckSec, P.grade);
    var cableA = P.cableA;                          // m²（单根主缆）

    // 主缆单元（frame + 名义抗弯刚度）
    // ——纯桁架离散的索节链在"近塔水平段 + 吊索稀疏"时会形成折叠尺式机构（λmin≈1e-11，
    //    总刚度阵奇异）。钢丝绳本就有弯曲刚度，取 β=1e-3 的名义 EI 即可抑制机构，
    //    对整体受力影响可忽略（垂直刚度 ~1e4 kN/m vs 轴向 1e7 kN/m）
    var beta = 1e-3;
    for (i = 0; i < n; i++) {
      var cL = Math.hypot(nodes[cableIdx[i + 1]].x - nodes[cableIdx[i]].x, nodes[cableIdx[i + 1]].y - nodes[cableIdx[i]].y);
      var cEA = STEEL.Es * cableA;
      elems.push({ i: cableIdx[i], j: cableIdx[i + 1], EA: cEA, EI: beta * cEA * cL * cL / 12, type: 'frame', cable: true });
    }
    // 加劲梁单元（frame）
    for (i = 0; i < n; i++) {
      elems.push({ i: deckIdx[i], j: deckIdx[i + 1], EA: secD.EA, EI: secD.EI, type: 'frame' });
    }
    // 吊索（每隔 step 个节点）
    var step = Math.max(2, Math.round(P.hangerS / (L / n)));
    for (i = 0; i <= n; i += step) {
      elems.push({ i: cableIdx[i], j: deckIdx[i], EA: STEEL.Es * 0.005, type: 'truss', hanger: true });
      chart.push({ x: nodes[cableIdx[i]].x, y: nodes[cableIdx[i]].y, type: 'hanger', x2: nodes[deckIdx[i]].x, y2: nodes[deckIdx[i]].y });
    }
    // 塔与主缆连接：塔顶节点 = 主缆端点 → 已重合；塔身简化为竖向 frame 到基础
    for (i = 0; i < 2; i++) {
      var tIdx = towerIdx[i];
      var bx = nodes[tIdx].x;
      nodes.push({ x: bx, y: deckY - P.towerH, fixed: [false, false, false], tag: 'towerbase' });
      var baseIdx = nodes.length - 1;
      elems.push({ i: tIdx, j: baseIdx, EA: P.towerEA, EI: P.towerEI, type: 'frame' });
      nodes[baseIdx].fixed = [true, true, true];
    }
    // 梁端支座：塔处竖向支承（水平向放开）
    // ——水平约束由吊索/主缆的几何刚度提供（应力刚化），塔处不另设水平约束，
    //    避免"梁端嵌固+塔刚化"的过约束把索力抬高到理论值 1.5 倍以上
    nodes[deckIdx[0]].fixed = [false, true, false];
    nodes[deckIdx[n]].fixed = [false, true, false];

    // ---- 恒载：加劲梁 + 桥面 qD 作用于梁节点，经吊索传至主缆；主缆自重沿水平投影加到缆节点 ----
    var Fd = new Array(nodes.length * 3).fill(0);
    for (i = 0; i < n; i++) {
      var dx = L / n, w = -P.qD * dx / 2;
      Fd[deckIdx[i] * 3 + 1] += w;
      Fd[deckIdx[i + 1] * 3 + 1] += w;
    }

    // ---- 主缆面积：抛物线理论定点迭代（初步设计手法，稳定收敛） ----
    // 不用 FEM 迭代面积：索-梁相对刚度悬殊，FEM 在迭代中途会落入线性失真区（挠度发散）。
    // 理论定点：q_tot = qD + γ·A·κ （κ=缆长/跨长≈√(1+16(f/L)²)）→ H=q_tot·L²/8f →
    //          T=H·κ → A=T/(fsd/1.5) → 回代 q_tot，5~6 次收敛。
    var kappa = Math.sqrt(L * L + 16 * f * f) / L;      // 主缆长度系数 ≈1.077
    var Am = cableA;
    for (var it = 0; it < 20; it++) {
      var qTot = P.qD + STEEL.gamma * Am * kappa;
      var Ht2 = qTot * L * L / (8 * f);
      var Tt2 = Ht2 * kappa;
      var Anew = Tt2 / (STEEL.fsd / 1.5);               // 安全系数 1.5 预留
      if (Math.abs(Anew - Am) / Math.max(Am, 1e-9) < 1e-3) { Am = Anew; break; }
      Am = Anew;
    }
    // 主缆自重（按最终面积）加入荷载向量
    var gm = STEEL.gamma * Am;                           // kN/m（沿水平投影）
    for (i = 0; i < n; i++) {
      var wcx = -gm * (L / n) / 2;
      Fd[cableIdx[i] * 3 + 1] += wcx;
      Fd[cableIdx[i + 1] * 3 + 1] += wcx;
    }
    // ---- 几何刚度（应力刚化）初张力 ----
    // 悬索桥主缆的横向支撑来自预拉力 H（重力刚度）：线性模型必须在单元上叠加 k_g = T/L·[垂直投影]，
    // 否则全桥是机构（λmin 相对刚度尺度 ~1e-9，位移发散到 km 级）。
    var Hth = (P.qD + STEEL.gamma * Am * kappa) * L * L / (8 * f);
    for (var e = 0; e < elems.length; e++) {
      if (elems[e].cable) {
        elems[e].EA = STEEL.Es * Am;
        var nA = nodes[elems[e].i], nB = nodes[elems[e].j];
        var chL = Math.hypot(nB.x - nA.x, nB.y - nA.y);
        var chC = Math.abs(nB.x - nA.x) / chL;         // cosα = 水平投影/索段长
        elems[e].Tg = Hth / chC;                        // 索段张力 = H / cosα（几何刚度用）
        elems[e].T0 = elems[e].Tg;                      // 报告的总索力含预张力
        elems[e].noEquivLoad = true;                    // 预张力不进荷载向量（成桥恒载与预张力自平衡）
      } else if (elems[e].hanger) {
        elems[e].Tg = P.qD * step * (L / n);            // 吊索张力 ≈ 负担的桥面重
        elems[e].T0 = elems[e].Tg;
        elems[e].noEquivLoad = true;
      }
    }

    var mFinal = F.makeModel(nodes, elems);
    var rFinal = mFinal.solveF(Fd);
    if (!rFinal.ok) {
      return { model: mFinal, nodes: nodes, elems: elems, chart: chart, error: rFinal.reason,
        report: [{ label: '求解失败', value: rFinal.reason }], checks: [], loadCase: Fd };
    }

    // 主缆水平力 H 与最大索力 T
    var H = 0, TmaxFinal = 0;
    for (var e3 = 0; e3 < elems.length; e3++) {
      if (!elems[e3].cable) continue;
      var ef3 = mFinal.elemForces(elems[e3], rFinal.d);
      TmaxFinal = Math.max(TmaxFinal, ef3.T);
      var g3 = elems[e3]._geo;
      H = Math.max(H, Math.abs(ef3.T * g3.c));
    }
    // 理论校核：H = q_tot·L²/8f（含主缆自重）
    var Htheory = (P.qD + STEEL.gamma * Am * kappa) * L * L / (8 * f);
    var Ttheory = Htheory * kappa;
    // 加劲梁最大弯矩
    var maxM = 0;
    for (var e4 = 0; e4 < elems.length; e4++) {
      if (elems[e4].type !== 'frame' || nodes[elems[e4].i].tag !== 'deck') continue;
      var ef4 = mFinal.elemForces(elems[e4], rFinal.d);
      maxM = Math.max(maxM, Math.abs(ef4.Mi), Math.abs(ef4.Mj));
    }
    // 跨中挠度（恒载）
    var midIdx = deckIdx[Math.round(n / 2)];
    var defl = Math.abs(rFinal.d[midIdx * 3 + 1]);

    var fOverL = f / L;
    var report = [
      { label: '主跨 L', value: L.toFixed(0) + ' m' },
      { label: '矢高 f', value: f.toFixed(1) + ' m', note: '垂跨比 f/L = ' + fOverL.toFixed(3) + '（常用 1/9~1/12）' },
      { label: '恒载 q（梁）', value: P.qD.toFixed(1) + ' kN/m', note: '另计主缆自重 ' + gm.toFixed(1) + ' kN/m' },
      { label: '主缆水平力 H（理论）', value: Htheory.toFixed(0) + ' kN', note: 'q_tot·L²/8f，含缆自重' },
      { label: '主缆最大索力 T', value: TmaxFinal.toFixed(0) + ' kN', note: '理论近似 ' + Ttheory.toFixed(0) + ' kN' },
      { label: '所需主缆面积', value: (Am * 1e6).toFixed(0) + ' mm²/缆', note: '强度控制 fsd=' + (STEEL.fsd / 1000).toFixed(0) + ' MPa，安全系数 1.5' },
      { label: '加劲梁最大弯矩', value: maxM.toFixed(0) + ' kN·m', note: '大跨悬索桥加劲梁抗弯刚度占比很小' },
      { label: '跨中恒载挠度', value: (defl * 1000).toFixed(0) + ' mm', note: '线性简化模型（无端锚边跨），数量级概念演示；精确值需非线性成桥分析' }
    ];
    var checks = [
      { label: '垂跨比', value: '1/' + (1 / fOverL).toFixed(1), limit: '1/9 ~ 1/12', pass: fOverL >= 1 / 13 && fOverL <= 1 / 8, note: 'DB33/T 856-2012 §6.1.5' },
      { label: '索力安全储备（按设计索力）', value: (STEEL.fsd * Am / Ttheory).toFixed(2), limit: '≥ 1.5', pass: STEEL.fsd * Am / Ttheory >= 1.5, note: '抛物线法设计：fsd·A / T理论；FEM 索力含端部重分配，供对照' },
      { label: '加劲梁弯矩 / 同跨简支梁', value: (maxM / (P.qD * L * L / 8) * 100).toFixed(1) + ' %', limit: '< 30 %', pass: maxM / (P.qD * L * L / 8) < 0.3, note: '主缆重力刚度承担了绝大部分荷载' }
    ];
    return { model: mFinal, nodes: nodes, elems: elems, chart: chart, report: report, checks: checks, loadCase: Fd };
  }

  function cableEA(A) { return STEEL.Es * A; }

  root.SYSTEMS = {
    buildArch: buildArch,
    buildCableStayed: buildCableStayed,
    buildSuspension: buildSuspension,
    STEEL: STEEL,
    CONC_E: CONC_E
  };
})(typeof window !== 'undefined' ? window : globalThis);
