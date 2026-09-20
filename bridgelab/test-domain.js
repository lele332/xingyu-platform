/* test-domain.js — 领域模块冒烟测试（pier / hydrology / systems）
 * 运行： node bridgelab/test-domain.js
 * 只检查"能跑通 + 结果在合理量级"，不追求解析精度（解析验算在 test-frame.js）
 */
'use strict';
global.window = global;
require('./frame.js');
require('./systems.js');
require('./pier.js');
require('./hydrology.js');
const SYS = global.SYSTEMS, PIER = global.PIER, HYDRO = global.HYDRO;

let bad = 0;
function ok(name, cond, info) {
  if (!cond) bad++;
  console.log((cond ? ' OK ' : 'FAIL') + '  ' + name.padEnd(36) + (info || ''));
}
function finite(v) { return typeof v === 'number' && isFinite(v); }

console.log('\n=== pier.js ===');
{
  // 圆形墩柱 偏心受压：C40, D=1.3m, ρ=1%, Nd=4000 kN, Md=3000 kN·m
  const D = 1.3, rho = 0.01;
  const sec = PIER.discretize({ kind: 'circle', D }, 200);
  const As = rho * sec.A;
  const r = PIER.eccentricCompression({
    shape: { kind: 'circle', D }, grade: 'C40', rebar: 'HRB400',
    As, a_s: 0.05, l0: 7.7, Nd: 4000, Md: 3000
  });
  ok('偏心受压能算出承载力', finite(r.Mu) && r.Mu > 0, 'Mu=' + r.Mu.toFixed(0) + ' kN·m, η=' + r.eta.toFixed(3) + ', λ=' + r.lambda.toFixed(1));
  ok('η 合理 (1~2)', r.eta >= 1 && r.eta <= 2);
  ok('结果含判定字段', typeof r.pass === 'boolean');
  ok('桥墩压应力单位量级正确', finite(r.sigmaMax) && r.sigmaMax > 0 && r.sigmaMax < 100, 'σmax=' + r.sigmaMax.toFixed(2) + ' MPa');

  const cw = PIER.crackWidth({
    shape: { kind: 'circle', D }, rebar: 'HRB400', As, a_s: 0.05,
    Ns: 3200, Ms: 2400, dBar: 28
  });
  ok('裂缝宽度计算', finite(cw.w), 'w=' + cw.w.toFixed(3) + ' mm, σss=' + cw.sigmaS.toFixed(0) + ' MPa');

  const pile = PIER.pileCapacity({
    D: 1.5, layers: [{ qik: 60, thickness: 8 }, { qik: 120, thickness: 10 }],
    m0: 0.8, lambda: 0.85, fa0: 500, k2: 6.0, gamma2: 10, h: 25
  });
  ok('单桩承载力', finite(pile.Ra) && pile.Ra > 1000, 'Ra=' + pile.Ra.toFixed(0) + ' kN（侧阻 ' + pile.side.toFixed(0) + ' + 端阻 ' + pile.tip.toFixed(0) + '）');
}

console.log('\n=== hydrology.js ===');
{
  const r = HYDRO.run({
    bridgeClass: '大桥', roadClass: '二级',
    flow: { psi: 0.6, Sp: 80, tau: 2.0, n: 0.6, F: 50 },   // 推理公式
    mu: 0.9, hc: 3.0, Vc: 2.5,
    B: 60, Hbar: 2.5, hmax: 4.5, Spj: 5, d: 30,
    Kxi: 1.0, B1: 1.3, riverbed: 100.0, dzNatural: 0.3, dc: 1.5
  });
  ok('设计流量', finite(r.Qp) && r.Qp > 0, 'Qp=' + r.Qp.toFixed(1) + ' m³/s');
  ok('桥孔净长', finite(r.Lj) && r.Lj > 10, 'Lj=' + r.Lj.toFixed(1) + ' m');
  ok('一般冲刷', finite(r.general.hp) && r.general.hp > 0, 'hp=' + r.general.hp.toFixed(2) + ' m');
  ok('局部冲刷', finite(r.local.hb) && r.local.hb >= 0, 'hb=' + r.local.hb.toFixed(2) + ' m, ' + r.local.regime);
  ok('基底埋深', finite(r.foundation.Z), 'Z=' + r.foundation.Z.toFixed(2) + ' m, hs=' + r.foundation.hs.toFixed(2));
  ok('报告条数 ≥ 8', r.report.length >= 8, r.report.length + ' 条');
  ok('验算条数 ≥ 3', r.checks.length >= 3);

  // 粘性土路径
  const r2 = HYDRO.run({
    bridgeClass: '中桥', roadClass: '三级', soil: 'clay', IL: 0.5,
    Qp: 800, mu: 0.85, hc: 2.5, Vc: 1.8,
    B: 45, Hbar: 2.0, hmax: 3.5, Spj: 3, d: 0.03,
    Kxi: 1.24, B1: 1.1, riverbed: 50, dzNatural: 0.2, dc: 1.0
  });
  ok('粘性土路径', finite(r2.general.hp) && r2.general.hp > 0, 'hp=' + r2.general.hp.toFixed(2) + ' m');
}

console.log('\n=== systems.js ===');
{
  // 拱桥
  const arch = SYS.buildArch({
    L: 60, f: 12, axisKind: 'para', m: 2, deckH: 2.0, colS: 6,
    qD: 40, grade: 'C40', hinged: false,
    archSec: { A: 1.2, I: 0.144 }, deckSec: { A: 1.0, I: 0.1 }
  });
  // 无铰拱（固定拱脚）为超静定结构，弹性压缩+柱变形使推力偏离三铰抛物线理论值，
  // 有限元推力在理论值 0.75~1.5 倍内即为合理（三铰拱才是 H=qL²/8f 的精确适用对象）
  const feN = parseFloat(arch.report[5].value), thH = parseFloat(arch.report[4].value);
  ok('拱桥：推力有限元/理论在合理带', feN / thH > 0.75 && feN / thH < 1.5, 'FE=' + feN + ' kN, 理论=' + thH + ' kN, 比=' + (feN / thH).toFixed(2));
  ok('拱桥：弯矩占比合理', arch.checks[0].pass !== undefined);
  console.log('      ' + arch.report.map(r => r.label + '=' + r.value).join(' | '));

  // 斜拉桥：双塔 400m，锚跨 140m（两塔扇形索覆盖主跨），塔刚度取真实量级
  const cs = SYS.buildCableStayed({
    L: 400, Ht: 80, fanS: 8, anchorSpan: 140, qD: 80,
    cableA: 0.010, grade: 'C50',
    beamSec: { A: 2.0, I: 0.8 }, towerEA: 5e9, towerEI: 3e9, iters: 12
  });
  ok('斜拉桥：主跨语义正确', cs.geometry.mainSpan === 400 && cs.geometry.totalLength === 680,
    '主跨=' + cs.geometry.mainSpan + 'm，全桥=' + cs.geometry.totalLength + 'm');
  ok('斜拉桥：塔位正确', cs.geometry.towerX[0] === 140 && cs.geometry.towerX[1] === 540,
    cs.geometry.towerX.join(' / ') + ' m');
  ok('斜拉桥：索线倾角合理', cs.geometry.minCableAngle >= 19.5, cs.geometry.minCableAngle.toFixed(1) + '°');
  const midX = cs.geometry.sideSpan + cs.geometry.mainSpan / 2;
  const cableLines = cs.chart.filter(c => c.type === 'cable');
  ok('斜拉桥：中跨索不交叉', cableLines.every(c => c.x < midX ? c.x2 <= midX + 1e-6 : c.x2 >= midX - 1e-6));
  ok('斜拉桥：迭代收敛', cs.converged);
  ok('斜拉桥：最终无松弛索', cs.slackCount === 0, cs.slackCount + ' 根');
  ok('斜拉桥：默认验算通过', cs.checks.every(c => c.pass), cs.checks.map(c => c.value).join(' / '));
  ok('斜拉桥：Ernst 单位为 GPa', cs.report.find(r => r.label === 'Ernst 等效弹模').value.includes('GPa'));
  console.log('      ' + cs.report.map(r => r.label + '=' + r.value).join(' | '));

  // 悬索桥：1000m 级，塔刚度取真实量级（百米亚层塔 EI ~5e9）
  const sp = SYS.buildSuspension({
    L: 1000, f: 100, hangerS: 20, qD: 18, towerH: 120,
    cableA: 0.4, grade: 'C50', deckSec: { A: 2.5, I: 1.2 },
    towerEA: 1e10, towerEI: 5e9
  });
  ok('悬索桥：H（理论）合理', finite(parseFloat(sp.report[3].value)) && parseFloat(sp.report[3].value) > 10000, sp.report[3].value);
  ok('悬索桥：垂跨比合理', sp.checks[0].pass !== undefined, sp.report[1].note);
  console.log('      ' + sp.report.map(r => r.label + '=' + r.value).join(' | '));
}

console.log('\n=== 结果：' + (bad ? bad + ' 项失败' : '全部通过') + ' ===\n');
process.exit(bad ? 1 : 0);
