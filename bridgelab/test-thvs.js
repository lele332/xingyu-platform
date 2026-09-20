/* 时程 × 反应谱对照 + CSV 导出 验证（Node 直接跑，无需浏览器） */
'use strict';
globalThis.self = globalThis;
globalThis.window = globalThis;
require(__dirname + '/groundmotion.js');
globalThis.XINGYU_SPATIAL3D = require(__dirname + '/spatial-frame3d.js');
require(__dirname + '/spatial-bridge.js');
const GM = globalThis.XINGYU_GROUNDMOTION;
const SPB = globalThis.SPATIAL_BRIDGE;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok - ' + msg); }
  else { fail++; console.log('  FAIL - ' + msg); }
}

/* 1) spectrumOf 物理校验 */
const ricker = GM.builtinWave('ricker');
const pga = GM.peakAcc(ricker.acc);
const spec = GM.spectrumOf(ricker.acc, ricker.dt, 0.05, { points: 80, Tmin: 0.02, Tmax: 5 });
ok(spec.periods.length === 80 && spec.sa.length === 80, 'spectrumOf 返回长度一致 (80)');
ok(spec.periods[0] >= 0.02 - 1e-9 && spec.periods[79] <= 5 + 1e-9, '周期范围 0.02~5 s');
ok(Math.abs(spec.sa[0] - pga) / pga < 0.05, '短周期 Sa→PGA（刚体段）' + (spec.sa[0] / pga).toFixed(3) + 'x');
const saMax = Math.max.apply(null, spec.sa);
ok(saMax > 1.5 * pga, '谱峰值明显大于 PGA（动力放大 ' + (saMax / pga).toFixed(2) + 'x）');

/* 2) 共振正弦（等幅 20 s，T=1.0）ζ=0.02：放大 ≈ 1/(2ζ)·(1-e^{-ζωt}) ≈ 23 */
const sdt = 0.01, ssecs = 20, sn = Math.round(ssecs / sdt) + 1;
const sacc = new Float64Array(sn);
for (let i = 0; i < sn; i++) sacc[i] = Math.sin(2 * Math.PI * i * sdt);
const specB = GM.spectrumOf(sacc, sdt, 0.02, { points: 120, Tmin: 0.5, Tmax: 1.6 });
let iPk = 0;
for (let i = 1; i < specB.sa.length; i++) if (specB.sa[i] > specB.sa[iPk]) iPk = i;
const expectAmp = 25 * (1 - Math.exp(-0.02 * 2 * Math.PI * ssecs));
const amp = specB.sa[iPk];
ok(Math.abs(specB.periods[iPk] - 1.0) < 0.08, '谱峰周期≈调谐周期 1.0s（实际 ' + specB.periods[iPk].toFixed(3) + '）');
ok(Math.abs(amp - expectAmp) / expectAmp < 0.15, '调谐放大≈1/(2ζ)(1-e^-ζωt)=' + expectAmp.toFixed(1) + '（实际 ' + amp.toFixed(1) + '）');

/* 3) analyze 时程分支：compare 结构与量级 */
function analyzeTh(bridgeType, extra) {
  return SPB.analyze(Object.assign({
    bridgeType: bridgeType, analysisType: 'timehistory',
    spans: [30], width: 10, segmentsPerSpan: 5,
    spectrumText: '0.10,0.40\n0.50,0.90\n1.00,0.50\n2.00,0.10',
    direction: 'x', method: 'srss', dampingRatio: 0.05,
    waveSource: 'builtin', builtinWave: 'ricker', waveText: '', waveUnit: 'g',
    waveDt: 0.02, pgaScale: 0.1, modeCount: 8
  }, extra || {}));
}
const res = analyzeTh('girder');
const th = res.response;
ok(th && th.kind === 'timehistory', '时程响应结构正常');
ok(th.compareError === null, '对照计算无错误');
ok(th.compare && th.compare.rows.length === 2, 'compare 两行（位移 + 基底剪力）');
const rowD = th.compare.rows[0], rowV = th.compare.rows[1];
ok(rowD.metric === '最大位移' && rowD.unit === 'mm' && isFinite(rowD.thPeak) && isFinite(rowD.specPeak), '位移对照行字段完整');
ok(rowV.metric.indexOf('基底剪力') === 0 && rowV.unit === 'kN' && isFinite(rowV.thPeak) && isFinite(rowV.specPeak), '剪力对照行字段完整');
ok(rowD.thPeak > 0 && rowD.specPeak > 0, '位移峰值均为正（th ' + rowD.thPeak.toFixed(3) + ' / spec ' + rowD.specPeak.toFixed(3) + ' mm）');
ok(rowD.ratio > 0.2 && rowD.ratio < 5, '位移时程/谱比值合理带: ' + rowD.ratio.toFixed(2));
ok(rowV.ratio > 0.2 && rowV.ratio < 5, '剪力时程/谱比值合理带: ' + rowV.ratio.toFixed(2));
ok(th.compare.spectrumPeaks && th.compare.spectrumPeaks.sa.length === 80, '对照附带波谱曲线数据');

/* 4) 拱桥 + 横向 Z 向路径 */
const resA = analyzeTh('arch', { direction: 'z', archL: 60, archF: 12 });
const thA = resA.response;
ok(thA.compare && isFinite(thA.compare.rows[0].ratio), '拱桥 Z 向对照可用（比值 ' + thA.compare.rows[0].ratio.toFixed(2) + '）');

/* 5) CSV 导出 */
const csvW = SPB.buildThCsv(th, 'wave');
const linesW = csvW.split('\n').filter(l => l && !l.startsWith('#'));
ok(linesW[0] === 'step,t(s),acc(m/s2)' && linesW.length === th.steps + 1, '波 CSV 行数 = 步数+1（' + linesW.length + '）');
const csvB = SPB.buildThCsv(th, 'base');
const linesB = csvB.split('\n').filter(l => l && !l.startsWith('#'));
ok(linesB[0] === 'step,t(s),baseShear(kN)' && linesB.length === th.steps + 1, '基底剪力 CSV 行数 = 步数+1（' + linesB.length + '）');
const csvN = SPB.buildThCsv(th, 'nodes');
const linesN = csvN.split('\n').filter(l => l && !l.startsWith('#'));
ok(linesN[0] === 'node,step,t(s),x(mm),y(mm),z(mm)', '位移 CSV 表头正确');
ok(linesN.length === th.nodeHistory.length * th.steps + 1, '位移 CSV 行数 = 节点数×步数+1（' + linesN.length + '）');
const c1 = linesN[1].split(',');
ok(c1.length === 6 && isFinite(Number(c1[3])) && isFinite(Number(c1[5])), '位移 CSV 数据行可解析为数值');

console.log('========================================');
console.log('thvs: ' + pass + ' 通过, ' + fail + ' 失败');
console.log('========================================');
process.exit(fail ? 1 : 0);