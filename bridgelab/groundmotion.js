/*
 * 星屿 桥梁实验室 · 地震动输入
 * 单位：加速度统一为 m/s²。
 * 支持三种导入格式：
 *   1) PEER NGA .at2（头部含 NPTS= / DT=，数据区自由格式，常用 cm/s² 或 g）
 *   2) 两列文本「t a」（空白/逗号分隔，自动识别表头与分隔符）
 *   3) 单列文本（每行一个加速度值，需外部给定 dt）
 * 内置示例波全部为程序合成，仅用于教学，不冒充任何真实台站记录。
 */
"use strict";

var G0 = 9.81;

/* ---------- 解析 ---------- */

function toMps2(value, unit) {
  var u = String(unit || "m/s2").toLowerCase();
  if (u === "g") return value * G0;
  if (u === "cm/s2" || u === "gal") return value * 0.01;
  return value;
}

/* 从 PEER .at2 文本提取：首行元数据（NPTS、DT、单位），其余为数据行。 */
function parseAt2(text) {
  var lines = String(text).split(/\r?\n/);
  var metaLine = -1, npts = 0, dt = 0, unit = "cm/s2";
  for (var i = 0; i < Math.min(lines.length, 8); i++) {
    if (/NPTS\s*=/.test(lines[i])) {
      var nMatch = lines[i].match(/NPTS\s*=\s*(\d+)/i);
      var dMatch = lines[i].match(/DT\s*=\s*([0-9.eE+-]+)/i);
      if (nMatch) npts = parseInt(nMatch[1], 10);
      if (dMatch) dt = parseFloat(dMatch[1]);
      if (/CM\/S|CM\/SEC|CENT/i.test(lines[i])) unit = "cm/s2";
      else if (/\bG\b|M\/S/i.test(lines[i])) unit = "g";
      metaLine = i;
      break;
    }
  }
  if (metaLine < 0 || !(dt > 0) || !(npts > 0)) {
    throw new Error("未能识别 PEER 头部（需要 NPTS= 与 DT= 字段）");
  }
  var tokens = [];
  for (var j = metaLine + 1; j < lines.length && tokens.length < npts; j++) {
    var parts = lines[j].trim().split(/[\s,]+/);
    for (var k = 0; k < parts.length; k++) {
      var v = Number(parts[k]);
      if (Number.isFinite(v)) tokens.push(v);
    }
  }
  if (tokens.length < npts) throw new Error("PEER 数据不完整：期望 " + npts + " 点，实得 " + tokens.length + " 点");
  var acc = new Float64Array(npts);
  var factor = unit === "g" ? G0 : 0.01;
  for (var m = 0; m < npts; m++) acc[m] = tokens[m] * factor;
  return { dt: dt, acc: acc, unitHint: unit };
}

/* 两列「t a」文本。自动跳过非数字表头行；t 必须单调不减。 */
function parseTwoColumn(text, unit) {
  var rows = [];
  String(text).split(/\r?\n/).forEach(function (line) {
    var parts = line.trim().split(/[\s,;，；]+/).filter(Boolean);
    if (parts.length < 2) return;
    var t = Number(parts[0]), a = Number(parts[1]);
    if (Number.isFinite(t) && Number.isFinite(a)) rows.push([t, a]);
  });
  if (rows.length < 2) throw new Error("两列格式至少需要两行「t a」数据");
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] <= rows[i - 1][0]) throw new Error("时间列必须严格递增（第 " + (i + 1) + " 行）");
  }
  var dt = rows[1][0] - rows[0][0];
  if (!(dt > 0)) throw new Error("时间步长无效");
  var acc = new Float64Array(rows.length);
  for (var j = 0; j < rows.length; j++) acc[j] = toMps2(rows[j][1], unit);
  return { dt: dt, acc: acc, unitHint: unit || "m/s2" };
}

/* 单列加速度文本，外部给定 dt。 */
function parseSingleColumn(text, dt, unit) {
  var vals = [];
  String(text).split(/\r?\n/).forEach(function (line) {
    var parts = line.trim().split(/[\s,;，；]+/).filter(Boolean);
    parts.forEach(function (p) {
      var v = Number(p);
      if (Number.isFinite(v)) vals.push(v);
    });
  });
  if (vals.length < 2) throw new Error("单列格式至少需要两个加速度值");
  if (!(dt > 0)) throw new Error("单列格式必须提供 dt");
  var acc = new Float64Array(vals.length);
  for (var i = 0; i < vals.length; i++) acc[i] = toMps2(vals[i], unit);
  return { dt: dt, acc: acc, unitHint: unit || "m/s2" };
}

/* 统一入口：优先 PEER；否则若每行两个数字按两列；否则按单列（需 dt）。 */
function parseGroundMotion(text, options) {
  options = options || {};
  if (/NPTS\s*=/.test(text)) return parseAt2(text);
  var lines = String(text).split(/\r?\n/).filter(function (l) { return l.trim(); });
  var twoCol = 0, oneCol = 0;
  lines.forEach(function (line) {
    var parts = line.trim().split(/[\s,;，；]+/).filter(Boolean);
    if (parts.length >= 2 && parts.slice(0, 2).every(function (p) { return Number.isFinite(Number(p)); })) twoCol++;
    else if (parts.length >= 1 && Number.isFinite(Number(parts[0]))) oneCol++;
  });
  if (twoCol >= 2) return parseTwoColumn(text, options.unit);
  return parseSingleColumn(text, options.dt, options.unit);
}

/* ---------- 处理 ---------- */

function peakAcc(acc) {
  var m = 0;
  for (var i = 0; i < acc.length; i++) m = Math.max(m, Math.abs(acc[i]));
  return m;
}

/* 调幅到目标 PGA（m/s²）。target<=0 时原样返回。 */
function scaleToPGA(wave, target) {
  if (!(target > 0)) return wave;
  var p = peakAcc(wave.acc);
  if (!(p > 0)) throw new Error("波加速度全为零，无法调幅");
  var factor = target / p;
  var acc = new Float64Array(wave.acc.length);
  for (var i = 0; i < acc.length; i++) acc[i] = wave.acc[i] * factor;
  return { dt: wave.dt, acc: acc, unitHint: "scaled" };
}

/* 线性插值重采样到目标 dt。目标 dt 大于原 dt 才有意义。 */
function resample(wave, targetDt) {
  if (!(targetDt > 0)) throw new Error("重采样 dt 无效");
  if (targetDt <= wave.dt * 0.999999) return { dt: wave.dt, acc: Float64Array.from(wave.acc), unitHint: wave.unitHint };
  var n = Math.max(2, Math.floor((wave.acc.length - 1) * wave.dt / targetDt) + 1);
  var acc = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var t = i * targetDt;
    var pos = t / wave.dt;
    var i0 = Math.floor(pos);
    if (i0 >= wave.acc.length - 1) { acc[i] = wave.acc[wave.acc.length - 1]; continue; }
    var f = pos - i0;
    acc[i] = wave.acc[i0] * (1 - f) + wave.acc[i0 + 1] * f;
  }
  return { dt: targetDt, acc: acc, unitHint: wave.unitHint };
}

function duration(wave) { return wave.dt * (wave.acc.length - 1); }

/* 线性插值加密采样（目标 dt 更小时）。Newmark 积分精度受 ω·dt 限制，
 * 导入波偏粗时先加密是常规做法；线性插值即默认的"波在步内线性"假设。 */
function upsample(wave, targetDt) {
  if (!(targetDt > 0)) throw new Error("加密采样 dt 无效");
  if (targetDt >= wave.dt * 0.999999) return { dt: wave.dt, acc: Float64Array.from(wave.acc), unitHint: wave.unitHint };
  var n = Math.round((wave.acc.length - 1) * wave.dt / targetDt) + 1;
  var acc = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var pos = i * targetDt / wave.dt;
    var i0 = Math.min(Math.floor(pos), wave.acc.length - 2);
    var f = Math.min(Math.max(pos - i0, 0), 1);
    acc[i] = wave.acc[i0] * (1 - f) + wave.acc[i0 + 1] * f;
  }
  return { dt: targetDt, acc: acc, unitHint: wave.unitHint };
}

/* ---------- 内置合成示例波（明确标注为合成，非真实记录） ---------- */

/* 正弦拍波：单频正弦 × 高斯包络，适合演示共振与拍振。 */
function synthSineBeat(opts) {
  opts = opts || {};
  var period = Math.max(0.05, Number(opts.period) || 1.0);
  var secs = Math.max(2, Number(opts.seconds) || 12);
  var dt = 0.01;
  var n = Math.round(secs / dt) + 1;
  var t0 = secs / 2, width = secs / 6;
  var acc = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var t = i * dt;
    acc[i] = Math.sin(2 * Math.PI * t / period) * Math.exp(-((t - t0) * (t - t0)) / (2 * width * width));
  }
  var p = peakAcc(acc);
  for (var j = 0; j < n; j++) acc[j] = acc[j] / p * 0.981; // 默认 PGA 0.1g
  return { dt: dt, acc: acc, unitHint: "synthetic" };
}

/* Ricker 脉冲：宽频带，适合演示短周期冲击响应。 */
function synthRicker(opts) {
  opts = opts || {};
  var fp = Math.max(0.5, Number(opts.freq) || 2.5);
  var secs = Math.max(1, Number(opts.seconds) || 6);
  var dt = 0.005;
  var n = Math.round(secs / dt) + 1;
  var t0 = secs / 2;
  var acc = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var t = i * dt - t0;
    var x = Math.PI * fp * t;
    acc[i] = (1 - 2 * x * x) * Math.exp(-x * x);
  }
  var p = peakAcc(acc);
  for (var j = 0; j < n; j++) acc[j] = acc[j] / p * 0.981;
  return { dt: dt, acc: acc, unitHint: "synthetic" };
}

/* 线性扫频波：f1→f2 线性升频，适合对比不同周期结构的响应差异。 */
function synthChirp(opts) {
  opts = opts || {};
  var f1 = Math.max(0.1, Number(opts.f1) || 0.2);
  var f2 = Math.max(f1 + 0.1, Number(opts.f2) || 4.0);
  var secs = Math.max(2, Number(opts.seconds) || 24);
  var dt = 0.01;
  var n = Math.round(secs / dt) + 1;
  var k = (f2 - f1) / secs;
  var acc = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var t = i * dt;
    acc[i] = Math.sin(2 * Math.PI * (f1 * t + 0.5 * k * t * t));
  }
  var ramp = Math.round(0.5 / dt);
  for (var j = 0; j < Math.min(ramp, n); j++) { var f = (j + 1) / ramp; acc[j] *= f; acc[n - 1 - j] *= f; }
  var p = peakAcc(acc);
  for (var m = 0; m < n; m++) acc[m] = acc[m] / p * 0.981;
  return { dt: dt, acc: acc, unitHint: "synthetic" };
}

var BUILTIN = [
  { id: "beat", label: "正弦拍波（T=1.0s，合成）", make: function () { return synthSineBeat({ period: 1.0 }); } },
  { id: "beat03", label: "正弦拍波（T=0.3s，合成）", make: function () { return synthSineBeat({ period: 0.3, seconds: 8 }); } },
  { id: "ricker", label: "Ricker 脉冲（合成）", make: function () { return synthRicker({}); } },
  { id: "chirp", label: "线性扫频 0.2→4 Hz（合成）", make: function () { return synthChirp({}); } }
];

function builtinWave(id) {
  var item = null;
  for (var i = 0; i < BUILTIN.length; i++) if (BUILTIN[i].id === id) item = BUILTIN[i];
  if (!item) item = BUILTIN[0];
  return item.make();
}


/* 绝对加速度反应谱：对输入波逐周期扫描单自由度体系（Newmark-β 平均加速度法，
 * 与时程同一积分口径），返回 { periods, sa }，sa 单位 m/s²。 */
function spectrumOf(ag, dt, zeta, opts) {
  opts = opts || {};
  if (!ag || ag.length < 2) throw new Error("反应谱计算需要至少两个加速度步");
  if (!(dt > 0)) throw new Error("反应谱计算 dt 无效");
  if (!Number.isFinite(zeta) || zeta < 0) zeta = 0.05;
  var Tmin = Number(opts.Tmin) > 0 ? Number(opts.Tmin) : 0.05;
  var Tmax = Number(opts.Tmax) > Tmin ? Number(opts.Tmax) : 5;
  var nT = Math.max(8, Math.round(Number(opts.points) || 64));
  var gamma = 0.5, beta = 0.25;
  var periods = new Array(nT), sa = new Array(nT);
  var n = ag.length;
  for (var k = 0; k < nT; k++) {
    var T = Tmin * Math.pow(Tmax / Tmin, k / (nT - 1));
    var w = 2 * Math.PI / T;
    var cc = 2 * zeta * w, kk = w * w;
    var a1 = 1 / (beta * dt * dt) + gamma * cc / (beta * dt);
    var a2 = 1 / (beta * dt) + (gamma / beta - 1) * cc;
    var a3 = (1 / (2 * beta) - 1) + dt * (gamma / (2 * beta) - 1) * cc;
    var keff = kk + a1;
    var u = 0, v = 0, a = -ag[0];
    var pk = 0;
    for (var i = 1; i < n; i++) {
      var p = -ag[i];
      var un = (p + a1 * u + a2 * v + a3 * a) / keff;
      var an = (un - u) / (beta * dt * dt) - v / (beta * dt) - (1 / (2 * beta) - 1) * a;
      var vn = v + dt * ((1 - gamma) * a + gamma * an);
      var atot = an + ag[i];
      if (Math.abs(atot) > pk) pk = Math.abs(atot);
      u = un; v = vn; a = an;
    }
    periods[k] = T; sa[k] = pk;
  }
  return { periods: periods, sa: sa };
}

var gmApi = {
  G0: G0,
  parseGroundMotion: parseGroundMotion,
  parseAt2: parseAt2,
  parseTwoColumn: parseTwoColumn,
  parseSingleColumn: parseSingleColumn,
  peakAcc: peakAcc,
  scaleToPGA: scaleToPGA,
  resample: resample,
  upsample: upsample,
  duration: duration,
  synthSineBeat: synthSineBeat,
  synthRicker: synthRicker,
  synthChirp: synthChirp,
  BUILTIN: BUILTIN,
  builtinWave: builtinWave,
  spectrumOf: spectrumOf
};

if (typeof module !== "undefined") module.exports = gmApi;
if (typeof window !== "undefined") window.XINGYU_GROUNDMOTION = gmApi;
