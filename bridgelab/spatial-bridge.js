/*
 * 星屿空间桥梁模型与模态查看器
 * 依赖：spatial-frame3d.js 提供 window.XINGYU_SPATIAL3D。
 * 本文件只负责：桥梁 3D 梁格示例模型、模态计算编排、零依赖 Canvas 视图。
 */
(function (root) {
  'use strict';

  var FEM3D = root.XINGYU_SPATIAL3D;

  var TYPE_LABEL = {
    girder: '梁桥梁格',
    arch: '上承式拱桥',
    cable: '双塔斜拉桥',
    suspension: '悬索桥'
  };

  function baseLibrary() {
    return {
      materials: [
        { id: 'C50', name: 'C50', E: 34500000, nu: 0.20, density: 2.55 },
        { id: 'STEEL', name: '平行钢丝', E: 195000000, nu: 0.30, density: 7.85 }
      ],
      sections: [
        { id: 'girder', name: '主梁等效截面', A: 1.09, Iy: 0.36, Iz: 2.10, J: 0.22 },
        { id: 'diaphragm', name: '横隔梁', A: 0.24, Iy: 0.03, Iz: 0.12, J: 0.02 },
        { id: 'tower', name: '桥塔', A: 5.0, Iy: 4.0, Iz: 4.0, J: 2.0 },
        { id: 'arch', name: '拱肋', A: 1.8, Iy: 0.55, Iz: 1.20, J: 0.20 },
        { id: 'column', name: '立柱/吊杆等效', A: 0.20, Iy: 0.015, Iz: 0.015, J: 0.01 },
        { id: 'stay', name: '拉索', A: 0.005, Iy: 1e-6, Iz: 1e-6, J: 1e-6 },
        { id: 'mainCable', name: '主缆', A: 0.20, Iy: 1e-6, Iz: 1e-6, J: 1e-6 },
        { id: 'hanger', name: '吊索', A: 0.004, Iy: 1e-6, Iz: 1e-6, J: 1e-6 }
      ]
    };
  }

  function finishModel(type, nodes, elements, restraints, metadata) {
    if (nodes.length > 48) throw new Error('当前浏览器模态原型最多支持 48 个节点，请降低离散密度');
    var lib = baseLibrary();
    return {
      schemaVersion: '0.1.0', units: { force: 'kN', length: 'm', stress: 'kPa' },
      bridgeType: type, bridgeTypeLabel: TYPE_LABEL[type], nodes: nodes, elements: elements,
      materials: lib.materials, sections: lib.sections, restraints: restraints,
      loadCases: [{ id: 'LC-modal', name: '模态分析质量工况', nodalLoads: [] }],
      stages: [{ id: 'ST-all', name: '成桥模型', activeGroups: [] }],
      analysisCases: [{ id: 'A-modal', type: 'modal', loadCaseIds: ['LC-modal'], stageIds: ['ST-all'] }],
      metadata: metadata || {}
    };
  }

  function spanStations(spans, segmentsPerSpan) {
    var xs = [0];
    spans.forEach(function (span) {
      var x0 = xs[xs.length - 1];
      for (var i = 1; i <= segmentsPerSpan; i++) xs.push(x0 + span * i / segmentsPerSpan);
    });
    return xs;
  }

  function buildGirderModel(options) {
    var spans = (options.spans && options.spans.length ? options.spans : [30]).map(function (v) { return Math.max(2, Number(v) || 30); });
    var width = Math.max(4, Number(options.width) || 10);
    var seg = Math.max(2, Math.min(6, Math.round(Number(options.segmentsPerSpan) || 5)));
    var xs = spanStations(spans, seg), nodes = [], elements = [], restraints = [], eid = 1;
    function nid(row, i) { return 'N' + (row * xs.length + i + 1); }
    xs.forEach(function (x, i) {
      nodes.push({ id: nid(0, i), xyz: [x, 0, -width / 2] });
      nodes.push({ id: nid(1, i), xyz: [x, 0, width / 2] });
    });
    for (var j = 0; j < xs.length - 1; j++) {
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: nid(0, j), j: nid(0, j + 1), materialId: 'C50', sectionId: 'girder', group: 'deck', orientation: [0, 1, 0] });
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: nid(1, j), j: nid(1, j + 1), materialId: 'C50', sectionId: 'girder', group: 'deck', orientation: [0, 1, 0] });
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: nid(0, j), j: nid(1, j), materialId: 'C50', sectionId: 'diaphragm', group: 'diaphragm', orientation: [0, 1, 0] });
    }
    elements.push({ id: 'E' + eid++, type: 'frame3d', i: nid(0, xs.length - 1), j: nid(1, xs.length - 1), materialId: 'C50', sectionId: 'diaphragm', group: 'diaphragm', orientation: [0, 1, 0] });
    restraints.push({ nodeId: nid(0, 0), fixed: [true, true, true, false, false, false] });
    restraints.push({ nodeId: nid(1, 0), fixed: [true, true, true, false, false, false] });
    restraints.push({ nodeId: nid(0, xs.length - 1), fixed: [false, true, true, false, false, false] });
    restraints.push({ nodeId: nid(1, xs.length - 1), fixed: [false, true, true, false, false, false] });
    return finishModel('girder', nodes, elements, restraints, { spans: spans, width: width });
  }

  function buildArchModel(options) {
    var L = Math.max(20, Number(options.archL) || 60), f = Math.max(4, Number(options.archF) || 12);
    var width = Math.max(4, Number(options.width) || 10), n = Math.max(6, Math.min(8, (Number(options.segmentsPerSpan) || 5) + 2));
    var nodes = [], elements = [], restraints = [], eid = 1;
    function did(row, i) { return 'D' + row + '_' + i; }
    function aid(row, i) { return 'A' + row + '_' + i; }
    for (var i = 0; i <= n; i++) {
      var x = L * i / n, archY = -4 * f * x * (L - x) / (L * L);
      nodes.push({ id: did(0, i), xyz: [x, 0, -width / 2] });
      nodes.push({ id: did(1, i), xyz: [x, 0, width / 2] });
      nodes.push({ id: aid(0, i), xyz: [x, archY, -width / 2] });
      nodes.push({ id: aid(1, i), xyz: [x, archY, width / 2] });
    }
    for (i = 0; i < n; i++) {
      for (var row = 0; row < 2; row++) {
        elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(row, i), j: did(row, i + 1), materialId: 'C50', sectionId: 'girder', group: 'deck', orientation: [0, 1, 0] });
        elements.push({ id: 'E' + eid++, type: 'frame3d', i: aid(row, i), j: aid(row, i + 1), materialId: 'C50', sectionId: 'arch', group: 'arch', orientation: [0, 1, 0] });
      }
    }
    for (i = 0; i <= n; i++) {
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(0, i), j: did(1, i), materialId: 'C50', sectionId: 'diaphragm', group: 'deckCross', orientation: [0, 1, 0] });
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: aid(0, i), j: aid(1, i), materialId: 'C50', sectionId: 'diaphragm', group: 'archCross', orientation: [0, 1, 0] });
      if (i > 0 && i < n) for (row = 0; row < 2; row++) elements.push({ id: 'E' + eid++, type: 'frame3d', i: aid(row, i), j: did(row, i), materialId: 'C50', sectionId: 'column', group: 'spandrel', orientation: [1, 0, 0] });
    }
    for (row = 0; row < 2; row++) {
      restraints.push({ nodeId: aid(row, 0), fixed: [true, true, true, false, false, false] });
      restraints.push({ nodeId: aid(row, n), fixed: [true, true, true, false, false, false] });
    }
    return finishModel('arch', nodes, elements, restraints, { L: L, f: f, width: width });
  }

  function buildCableModel(options) {
    var mainL = Math.max(100, Number(options.cableL) || 400), sideL = Math.max(40, Number(options.cableSide) || 140);
    var H = Math.max(30, Number(options.cableH) || 80), width = Math.max(4, Number(options.width) || 10);
    var seg = Math.max(2, Math.min(4, Math.round(Number(options.segmentsPerSpan) || 4)));
    var xs = spanStations([sideL, mainL, sideL], seg), nodes = [], elements = [], restraints = [], eid = 1;
    function did(row, i) { return 'D' + row + '_' + i; }
    xs.forEach(function (x, i) { nodes.push({ id: did(0, i), xyz: [x, 0, -width / 2] }); nodes.push({ id: did(1, i), xyz: [x, 0, width / 2] }); });
    for (var i = 0; i < xs.length - 1; i++) for (var row = 0; row < 2; row++) elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(row, i), j: did(row, i + 1), materialId: 'C50', sectionId: 'girder', group: 'deck', orientation: [0, 1, 0] });
    for (i = 0; i < xs.length; i++) elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(0, i), j: did(1, i), materialId: 'C50', sectionId: 'diaphragm', group: 'cross', orientation: [0, 1, 0] });
    var towerStations = [seg, seg * 2], towerTops = [];
    for (var t = 0; t < towerStations.length; t++) for (row = 0; row < 2; row++) {
      var deckId = did(row, towerStations[t]), topId = 'T' + t + '_' + row;
      nodes.push({ id: topId, xyz: [xs[towerStations[t]], H, row ? width / 2 : -width / 2] });
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: deckId, j: topId, materialId: 'C50', sectionId: 'tower', group: 'tower', orientation: [1, 0, 0] });
      towerTops.push({ id: topId, tower: t, row: row, station: towerStations[t] });
    }
    towerTops.forEach(function (top) {
      var candidates = [];
      var midStation = (towerStations[0] + towerStations[1]) / 2;
      for (var si = 0; si < xs.length; si++) {
        if (si === top.station) continue;
        // 两塔的中跨索各自只覆盖半个主跨，不能跨过跨中互相交叉。
        var inner = top.tower === 0
          ? si > top.station && si <= Math.floor(midStation)
          : si < top.station && si >= Math.ceil(midStation);
        var outer = top.tower === 0 ? si < top.station : si > top.station;
        if (inner || outer) candidates.push(si);
      }
      candidates.forEach(function (si) {
        elements.push({ id: 'E' + eid++, type: 'cable3d', i: top.id, j: did(top.row, si), materialId: 'STEEL', sectionId: 'stay', group: 'stay', T0: 2500 });
      });
    });
    restraints.push({ nodeId: did(0, 0), fixed: [true, true, true, false, false, false] }, { nodeId: did(1, 0), fixed: [true, true, true, false, false, false] });
    restraints.push({ nodeId: did(0, xs.length - 1), fixed: [false, true, true, false, false, false] }, { nodeId: did(1, xs.length - 1), fixed: [false, true, true, false, false, false] });
    towerStations.forEach(function (ti) { restraints.push({ nodeId: did(0, ti), fixed: [false, true, false, false, false, false] }); restraints.push({ nodeId: did(1, ti), fixed: [false, true, false, false, false, false] }); });
    return finishModel('cable', nodes, elements, restraints, { mainSpan: mainL, sideSpan: sideL, H: H, width: width, cableApproximation: '轴向索 + 2500 kN 教学初张力几何刚度' });
  }

  function buildSuspensionModel(options) {
    var L = Math.max(200, Number(options.suspL) || 1000), f = Math.max(30, Number(options.suspF) || 100), H = Math.max(f + 10, Number(options.suspH) || 120);
    var width = Math.max(4, Number(options.width) || 10), n = Math.max(6, Math.min(8, (Number(options.segmentsPerSpan) || 5) + 2));
    var nodes = [], elements = [], restraints = [], eid = 1;
    function did(row, i) { return 'D' + row + '_' + i; } function cid(row, i) { return 'C' + row + '_' + i; }
    for (var i = 0; i <= n; i++) {
      var x = L * i / n, cableY = H - 4 * f * x * (L - x) / (L * L);
      for (var row = 0; row < 2; row++) {
        var z = row ? width / 2 : -width / 2;
        nodes.push({ id: did(row, i), xyz: [x, 0, z] });
        nodes.push({ id: cid(row, i), xyz: [x, cableY, z] });
      }
    }
    for (i = 0; i < n; i++) for (row = 0; row < 2; row++) {
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(row, i), j: did(row, i + 1), materialId: 'C50', sectionId: 'girder', group: 'deck', orientation: [0, 1, 0] });
      elements.push({ id: 'E' + eid++, type: 'cable3d', i: cid(row, i), j: cid(row, i + 1), materialId: 'STEEL', sectionId: 'mainCable', group: 'mainCable', T0: 20 * L * L / (8 * f) });
    }
    for (i = 0; i <= n; i++) {
      elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(0, i), j: did(1, i), materialId: 'C50', sectionId: 'diaphragm', group: 'cross', orientation: [0, 1, 0] });
      for (row = 0; row < 2; row++) {
        if (i === 0 || i === n) elements.push({ id: 'E' + eid++, type: 'frame3d', i: did(row, i), j: cid(row, i), materialId: 'C50', sectionId: 'tower', group: 'tower', orientation: [1, 0, 0] });
        else elements.push({ id: 'E' + eid++, type: 'cable3d', i: cid(row, i), j: did(row, i), materialId: 'STEEL', sectionId: 'hanger', group: 'hanger', T0: 10 * L / n });
      }
    }
    restraints.push({ nodeId: did(0, 0), fixed: [true, true, true, false, false, false] }, { nodeId: did(1, 0), fixed: [true, true, true, false, false, false] });
    restraints.push({ nodeId: did(0, n), fixed: [false, true, true, false, false, false] }, { nodeId: did(1, n), fixed: [false, true, true, false, false, false] });
    return finishModel('suspension', nodes, elements, restraints, { L: L, f: f, H: H, width: width, cableApproximation: '轴向索 + 抛物线水平力教学初张力几何刚度' });
  }

  function buildBridgeModel(options) {
    options = options || {};
    var type = options.bridgeType || 'girder';
    if (type === 'arch') return buildArchModel(options);
    if (type === 'cable') return buildCableModel(options);
    if (type === 'suspension') return buildSuspensionModel(options);
    return buildGirderModel(options);
  }

  function parseSpectrum(text) {
    var items = String(text || '').split(/[;\n，；]+/).map(function (row) {
      var pair = row.trim().split(/[\s,]+/).map(Number);
      return pair.length >= 2 && isFinite(pair[0]) && isFinite(pair[1])
        ? { period: pair[0], acceleration: pair[1] * 9.81 } : null;
    }).filter(Boolean).sort(function (a, b) { return a.period - b.period; });
    if (items.length < 2) throw new Error('反应谱至少需要两组“周期, Sa/g”数据');
    return items;
  }

  function buildWave(options) {
    var GM = root.XINGYU_GROUNDMOTION;
    if (!GM) throw new Error('地震动模块（groundmotion.js）未加载');
    var wave, label, note;
    if (options.waveSource === 'paste') {
      wave = GM.parseGroundMotion(options.waveText || '', {
        unit: options.waveUnit || 'm/s2',
        dt: Number(options.waveDt) || 0
      });
      label = '粘贴/文件导入波';
      note = '按文本自动识别格式（PEER .at2 / 两列 t,a / 单列+dt）。导入真实记录时请核对单位与 dt。';
    } else {
      wave = GM.builtinWave(options.builtinWave || 'beat');
      label = '内置合成示例波';
      note = '程序合成的教学波，不代表任何真实地震记录；正式对比应导入实际台站波。';
    }
    var pga = GM.peakAcc(wave.acc);
    var target = Number(options.pgaScale);
    if (target > 0) {
      wave = GM.scaleToPGA(wave, target);
      pga = target;
      note += ' 已调幅到目标 PGA ' + target.toFixed(3) + ' m/s²。';
    }
    // 步数保护：超过上限自动抽稀，控制浏览器内计算量。
    var maxSteps = 6000;
    if (wave.acc.length > maxSteps) {
      wave = GM.resample(wave, GM.duration(wave) / (maxSteps - 1));
      note += ' 为控制计算量已自动重采样到 dt=' + wave.dt.toFixed(4) + ' s。';
    }
    return {
      dt: wave.dt, acc: wave.acc, label: label, pga: pga,
      steps: wave.acc.length,
      durationSec: GM.duration(wave),
      note: note
    };
  }

  function analyze(options) {
    if (!FEM3D) throw new Error('3D 有限元内核未加载');
    var model = buildBridgeModel(options);
    var modal = FEM3D.solveModal(model, {
      stageId: 'ST-all',
      modeCount: Math.max(1, Number(options && options.modeCount) || 8)
    });
    var response = null;
    if (options && options.analysisType === 'spectrum') {
      response = FEM3D.solveResponseSpectrum(model, parseSpectrum(options.spectrumText), {
        modal: modal,
        stageId: 'ST-all',
        direction: options.direction || 'y',
        method: options.method || 'CQC',
        dampingRatio: Number(options.dampingRatio) || 0.05
      });
    }
    if (options && options.analysisType === 'timehistory') {
      var wave = buildWave(options);
      response = FEM3D.solveTimeHistory(model, {
        ag: wave.acc,
        dt: wave.dt,
        direction: options.direction || 'x',
        dampingRatio: Number(options.dampingRatio) || 0.05,
        modal: modal,
        stageId: 'ST-all',
        maxSteps: 6000
      });
      response.waveMeta = wave;
      var cmp = null, cmpErr = null;
      try {
        cmp = runThVsSpectrum(model, modal, response, options);
      } catch (err) {
        cmpErr = err && err.message ? err.message : String(err);
      }
      response.compare = cmp;
      response.compareError = cmpErr;
    }
    return { model: model, modal: modal, response: response };
  }

  function makeViewer(canvas, options) {
    options = options || {};
    var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var state = {
      canvas: canvas, ctx: canvas.getContext('2d'), model: null, modal: null,
      mode: 0, phase: 0, amp: 0.28, yaw: -0.48, pitch: 0.14, zoom: 1, field: 'resultant', response: null,
      playing: !reducedMotion, autoRotate: !reducedMotion, active: false,
      dragging: false, lastX: 0, lastY: 0, raf: 0,
      activeElementSet: new Set(), supportNodeSet: new Set(),
      thData: null, thIndex: 0, thFrame: null,
      onRange: options.onRange || function () {},
      onThTime: options.onThTime || function () {}
    };

    function buildThFrame() {
      var th = state.thData;
      var idx = Math.max(0, Math.min(th.steps - 1, state.thIndex));
      var f = state.thFrame;
      var nn = state.model.nodes.length * 6;
      if (!f || f.length !== nn) { f = new Float64Array(nn); state.thFrame = f; }
      for (var i = 0; i < th.nodeHistory.length; i++) {
        f[i * 6] = th.nodeHistory[i].x[idx];
        f[i * 6 + 1] = th.nodeHistory[i].y[idx];
        f[i * 6 + 2] = th.nodeHistory[i].z[idx];
      }
    }
    if (!state.ctx) throw new Error('当前环境不支持 Canvas 2D');

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.width = rect.width; state.height = rect.height;
    }
    function project(p) {
      var x = p[0] - state.centerX;
      var y = p[1];
      var z = p[2];
      var cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
      var xx = x * cy - z * sy, zz = x * sy + z * cy;
      var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      var yy = y * cp - zz * sp, depth = y * sp + zz * cp;
      return [
        state.width / 2 + xx * state.scale * state.zoom,
        state.height * 0.57 - yy * state.scale * state.zoom - depth * state.scale * 0.20 * state.zoom
      ];
    }
    function line(a, b, color, width, dash) {
      var c = state.ctx;
      c.save(); c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash || []);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.restore();
    }
    function cloudValue(vector, nodeIndex) {
      var x = vector[nodeIndex * 6];
      var y = vector[nodeIndex * 6 + 1];
      var z = vector[nodeIndex * 6 + 2];
      if (state.field === 'x') return Math.abs(x);
      if (state.field === 'y') return Math.abs(y);
      if (state.field === 'z') return Math.abs(z);
      return Math.hypot(x, y, z);
    }
    function colorAt(t) {
      t = Math.max(0, Math.min(1, t));
      var stops = [
        [0, [37, 99, 235]], [0.35, [34, 211, 238]],
        [0.70, [250, 204, 21]], [1, [239, 68, 68]]
      ];
      for (var i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          var a = stops[i - 1], b = stops[i], u = (t - a[0]) / (b[0] - a[0]);
          var rgb = a[1].map(function (v, j) { return Math.round(v + (b[1][j] - v) * u); });
          return 'rgb(' + rgb.join(',') + ')';
        }
      }
      return '#ef4444';
    }
    function render() {
      if (!state.model || !state.modal || !state.modal.modes.length) return;
      resize();
      var c = state.ctx, w = state.width, h = state.height;
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#080b10'; c.fillRect(0, 0, w, h);
      for (var gy = 48; gy < h; gy += 42) line([0, gy], [w, gy], 'rgba(148,163,184,.07)', 1);

      var nodes = state.model.nodes;
      state.centerX = (nodes[0].xyz[0] + nodes[nodes.length - 1].xyz[0]) / 2;
      var minX = nodes[0].xyz[0], maxX = nodes[nodes.length - 1].xyz[0];
      var span = Math.max(maxX - minX, 1);
      state.scale = Math.min(w * 0.78 / span, h * 0.040);
      var mode = state.modal.modes[Math.min(state.mode, state.modal.modes.length - 1)];
      var isTh = !!state.thData;
      var vector = isTh ? state.thFrame : (state.response ? state.response.combinedDisplacement : mode.shape);
      var osc = (isTh || state.response) ? 1 : (state.playing ? Math.sin(state.phase) : 1);
      var maxShape = 1e-12;
      nodes.forEach(function (_, i) {
        maxShape = Math.max(maxShape, Math.hypot(vector[i * 6], vector[i * 6 + 1], vector[i * 6 + 2]));
      });
      // 时程帧是真实位移（m），峰值一般只有毫米级；用 amp/peak 放大到与振型动画相当的视觉幅值。
      var denom = isTh ? Math.max(state.thData.peak.value, 1e-12) : maxShape;
      var scale = state.amp / denom * osc;
      var deformed = nodes.map(function (n, i) {
        return [
          n.xyz[0] + vector[i * 6] * scale,
          n.xyz[1] + vector[i * 6 + 1] * scale,
          n.xyz[2] + vector[i * 6 + 2] * scale
        ];
      });
      var cloud = nodes.map(function (_, i) { return cloudValue(vector, i); });
      var cloudMax = Math.max.apply(null, cloud.concat([1e-12]));
      state.onRange({ min: 0, max: cloudMax, field: state.field, mode: mode.index, response: !!state.response && !isTh, th: isTh });

      state.model.elements.forEach(function (e) {
        if (!state.activeElementSet.has(e.id)) return;
        var a = project(nodes[state.modal.nodeIndex.get(e.i)].xyz);
        var b = project(nodes[state.modal.nodeIndex.get(e.j)].xyz);
        line(a, b, '#64748b', 2.2, [5, 5]);
      });
      state.model.elements.forEach(function (e) {
        if (!state.activeElementSet.has(e.id)) return;
        var ai = state.modal.nodeIndex.get(e.i), bi = state.modal.nodeIndex.get(e.j);
        var a = project(deformed[ai]), b = project(deformed[bi]);
        var gradient = c.createLinearGradient(a[0], a[1], b[0], b[1]);
        gradient.addColorStop(0, colorAt(cloud[ai] / cloudMax));
        gradient.addColorStop(1, colorAt(cloud[bi] / cloudMax));
        line(a, b, gradient, 3.4);
      });
      nodes.forEach(function (n, i) {
        var p = project(n.xyz), q = project(deformed[i]);
        c.fillStyle = state.supportNodeSet.has(n.id) ? '#fbbf24' : '#64748b';
        c.beginPath(); c.arc(p[0], p[1], 3.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = colorAt(cloud[i] / cloudMax);
        c.beginPath(); c.arc(q[0], q[1], 3, 0, Math.PI * 2); c.fill();
      });
    }
    function tick() {
      if (!state.active) { state.raf = 0; return; }
      if (state.playing) {
        if (state.thData) {
          // 约 1× 真实时间播放：每帧推进 dt/0.016 步。
          state.thIndex += Math.max(1, Math.round(state.thData.dt / 0.016));
          if (state.thIndex >= state.thData.steps) state.thIndex = 0;
          buildThFrame();
          state.onThTime(state.thIndex);
        } else {
          state.phase += 0.055;
        }
      }
      if (state.autoRotate && !state.dragging) state.yaw += 0.0012;
      render();
      state.raf = root.requestAnimationFrame(tick);
    }
    function setActive(on) {
      state.active = !!on;
      if (state.active && !state.raf) state.raf = root.requestAnimationFrame(tick);
      if (!state.active && state.raf) {
        root.cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }
    canvas.addEventListener('pointerdown', function (e) {
      state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!state.dragging) return;
      state.yaw += (e.clientX - state.lastX) * 0.008;
      state.pitch = Math.max(-0.9, Math.min(0.9, state.pitch + (e.clientY - state.lastY) * 0.006));
      state.lastX = e.clientX; state.lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', function () { state.dragging = false; });
    canvas.addEventListener('pointercancel', function () { state.dragging = false; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      state.zoom = Math.max(0.55, Math.min(1.8, state.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    }, { passive: false });
    root.addEventListener('resize', resize);
    return {
      setData: function (model, modal, response) {
        state.model = model; state.modal = modal; state.response = response || null; state.mode = 0; state.phase = 0;
        state.thData = null; state.thFrame = null; state.thIndex = 0;
        state.activeElementSet = new Set(modal.activeElementIds || []);
        state.supportNodeSet = new Set((model.restraints || []).map(function (r) { return r.nodeId; }));
        var xs = model.nodes.map(function (n) { return n.xyz[0]; });
        state.amp = Math.max.apply(null, xs) - Math.min.apply(null, xs);
        state.amp *= 0.075;
        render();
      },
      setMode: function (index) { state.mode = Number(index) || 0; render(); },
      setField: function (field) {
        state.field = ['resultant', 'x', 'y', 'z'].indexOf(field) >= 0 ? field : 'resultant';
        render();
      },
      setPlaying: function (on) { state.playing = !!on; },
      setTimeHistory: function (th) {
        state.thData = th || null;
        state.thIndex = 0;
        if (th) buildThFrame();
        render();
      },
      setTimeIndex: function (i) {
        if (!state.thData) return;
        state.thIndex = Math.max(0, Math.min(state.thData.steps - 1, Math.round(i)));
        buildThFrame();
        state.onThTime(state.thIndex);
        render();
      },
      getTimeIndex: function () { return state.thIndex; },
      setAutoRotate: function (on) { state.autoRotate = !!on; },
      setActive: setActive,
      reset: function () { state.yaw = -0.48; state.pitch = 0.14; state.zoom = 1; render(); },
      render: render
    };
  }

  function reportHtml(result) {
    var rows = (result.modal.modes || []).map(function (m) {
      return '<div class="kv"><span>振型 ' + m.index + '</span><b>' + m.frequencyHz.toFixed(3) + ' Hz</b><small>T=' + m.periodSec.toFixed(3) + ' s</small></div>';
    }).join('');
    var p = result.modal.participation;
    var d = result.modal.diagnostics;
    var pct = function (v) { return Math.min(999, Math.max(0, v * 100)).toFixed(1) + '%'; };
    var warnings = d.warnings.length
      ? '<div class="verdict warn">' + d.warnings.join('<br>') + '</div>'
      : '<div class="verdict ok">质量与刚度诊断未发现明显异常。</div>';
    var approximation = result.model.metadata && result.model.metadata.cableApproximation
      ? '<div class="cite">' + result.model.metadata.cableApproximation + '</div>' : '';
    var responseHtml = '';
    if (result.response && result.response.kind !== 'timehistory') {
      var rr = result.response;
      var modeRows = rr.modalResults.map(function (m) {
        return '<div class="kv"><span>振型 ' + m.mode + ' · Sa</span><b>' + (m.acceleration / 9.81).toFixed(3) + ' g</b><small>质量 ' + pct(m.effectiveMassRatio) + '</small></div>';
      }).join('');
      responseHtml = '<section class="rep-sec"><h4>反应谱结果</h4>' +
        '<div class="kv"><span>方向 / 组合</span><b>' + rr.direction.toUpperCase() + ' / ' + rr.method + '</b></div>' +
        '<div class="kv"><span>阻尼比</span><b>' + (rr.dampingRatio * 100).toFixed(1) + '%</b></div>' +
        '<div class="kv"><span>最大组合位移</span><b>' + (rr.maxNodeResultant * 1000).toFixed(2) + ' mm</b><small>' + rr.maxNodeId + '</small></div>' +
        '<div class="kv"><span>该方向累计质量</span><b>' + pct(rr.cumulativeMassRatio) + '</b></div>' +
        '<div class="cite">谱点为用户输入，线性插值；位移按 ' + rr.method + ' 组合。当前不代表任何特定规范设计谱。</div>' +
        modeRows + '</section>';
    }
    var timeHistoryHtml = '';
    if (result.response && result.response.kind === 'timehistory') {
      var th = result.response;
      var wm = th.waveMeta;
      var mm = function (v) { return (v * 1000).toFixed(2) + ' mm'; };
      timeHistoryHtml = '<section class="rep-sec"><h4>时程分析结果</h4>' +
        '<div class="kv"><span>波来源</span><b>' + wm.label + '</b><small>PGA ' + wm.pga.toFixed(3) + ' m/s²</small></div>' +
        '<div class="kv"><span>dt / 步数 / 时长</span><b>' + wm.dt.toFixed(4) + ' s</b><small>' + wm.steps + ' 步 · ' + wm.durationSec.toFixed(2) + ' s</small></div>' +
        '<div class="kv"><span>方向 / 阻尼</span><b>' + th.direction.toUpperCase() + ' / ' + (th.rayleigh.zeta * 100).toFixed(1) + '%</b></div>' +
        '<div class="kv"><span>Rayleigh α / β</span><b>' + th.rayleigh.alpha.toExponential(3) + ' / ' + th.rayleigh.beta.toExponential(3) + '</b><small>f₁=' + th.rayleigh.freq1Hz.toFixed(3) + ' Hz, f₂=' + th.rayleigh.freq2Hz.toFixed(3) + ' Hz</small></div>' +
        '<div class="kv"><span>最大位移</span><b>' + mm(th.peak.value) + '</b><small>' + th.peak.nodeId + ' · t=' + th.peak.time.toFixed(2) + ' s</small></div>' +
        '<div class="kv"><span>最大基底剪力</span><b>' + Math.abs(th.peakBaseShear).toFixed(1) + ' kN</b><small>t=' + th.peakBaseShearTime.toFixed(2) + ' s</small></div>' +
        '<div class="kv"><span>能量平衡</span><b>输入 ' + th.energy.input.toExponential(2) + '</b><small>动能 ' + th.energy.kinetic.toExponential(1) + ' · 势能 ' + th.energy.strain.toExponential(1) + ' · 耗散 ' + th.energy.damped.toExponential(1) + '</small></div>' +
        '<div class="cite">' + wm.note + '</div>' +
        '<div class="cite">Newmark-β 平均加速度法（γ=0.5, β=0.25）直接积分；位移为相对支座坐标。时程保留符号与时间顺序，可与反应谱包络互补对照。</div></section>';
    }
    return '<section class="rep-sec"><h4>3D 空间模型</h4>' +
      '<div class="kv"><span>桥型</span><b>' + result.model.bridgeTypeLabel + '</b></div>' +
      '<div class="kv"><span>节点 / 单元</span><b>' + result.model.nodes.length + ' / ' + result.model.elements.length + '</b></div>' +
      '<div class="kv"><span>自由度</span><b>' + result.modal.freeDofs.length + '</b></div>' +
      '<div class="kv"><span>模态求解</span><b>' + (result.modal.eigensolver.converged ? '收敛' : '未收敛') + '</b></div>' +
      '<div class="cite">本视图为 3D 线性模态分析。振型做了视觉归一化，不能直接读取真实位移。</div>' + approximation + '</section>' +
      '<section class="rep-sec"><h4>有效模态质量</h4>' +
      '<div class="kv"><span>X 向累计</span><b>' + pct(p.cumulativeRatio.x) + '</b></div>' +
      '<div class="kv"><span>竖向 Y 累计</span><b>' + pct(p.cumulativeRatio.y) + '</b></div>' +
      '<div class="kv"><span>横向 Z 累计</span><b>' + pct(p.cumulativeRatio.z) + '</b></div>' +
      '<div class="cite">工程动力分析通常要求目标方向累计有效模态质量达到约 90%；不足时应增加振型数。</div></section>' +
      '<section class="rep-sec"><h4>质量 / 刚度诊断</h4>' +
      '<div class="kv"><span>无质量自由度</span><b>' + d.masslessDofCount + '</b></div>' +
      '<div class="kv"><span>刚度对角量级比</span><b>' + d.stiffnessDiagonal.ratio.toExponential(2) + '</b></div>' +
      '<div class="kv"><span>单元长度范围</span><b>' + d.elementLength.min.toFixed(2) + ' ~ ' + d.elementLength.max.toFixed(2) + ' m</b></div>' +
      warnings + '</section>' +
      responseHtml +
      timeHistoryHtml +
      '<section class="rep-sec"><h4>前 ' + result.modal.modes.length + ' 阶频率</h4>' + rows + '</section>';
  }


  /* 时程 × 同波谱 峰值对照：把输入波换算成反应谱，用同一模型/方向/阻尼做一次谱分析。 */
  function runThVsSpectrum(model, modal, th, options) {
    var GM = root.XINGYU_GROUNDMOTION;
    var dir = th.direction;
    var zeta = th.rayleigh.zeta;
    var spec = GM.spectrumOf(th.waveMeta.acc, th.waveMeta.dt, zeta, { points: 80, Tmin: 0.05, Tmax: 5 });
    var items = spec.periods.map(function (T, i) { return { period: T, acceleration: spec.sa[i] }; });
    var method = options.method || 'SRSS';
    var sp = FEM3D.solveResponseSpectrum(model, items, {
      modal: modal, stageId: 'ST-all', direction: dir, method: method, dampingRatio: zeta
    });
    var thDisp = Math.abs(th.peak.value) * 1000;
    var spDisp = Math.abs(sp.maxNodeResultant) * 1000;
    var thShear = Math.abs(th.peakBaseShear);
    var vectors = [], omegas = [];
    sp.modalResults.forEach(function (mr, i) {
      var eff = modal.modes[i].participation[dir].effectiveMass;
      vectors.push([Math.abs(eff * mr.acceleration)]);
      omegas.push(modal.modes[i].omega);
    });
    var spShear = FEM3D.combineModalResponses(vectors, omegas, method, zeta)[0];
    var rDisp = spDisp > 0 ? thDisp / spDisp : null;
    var rShear = spShear > 0 ? thShear / spShear : null;
    return {
      direction: dir, zeta: zeta,
      spectrumPeaks: { periods: spec.periods, sa: spec.sa },
      rows: [
        { metric: '最大位移', unit: 'mm', thPeak: thDisp, specPeak: spDisp, ratio: rDisp },
        { metric: '基底剪力峰值', unit: 'kN', thPeak: thShear, specPeak: spShear, ratio: rShear }
      ],
      note: '谱列为「同一地震波换算的反应谱」峰值（非规范设计谱）。时程峰值取全时段绝对峰值；谱峰值为模态组合包络，不保留符号与时间顺序，两者口径不同属正常现象。'
    };
  }

  /* CSV 导出：what = nodes | base | wave。位移为相对支座坐标，单位 mm。 */
  function buildThCsv(th, what) {
    var L = [];
    var wm = th.waveMeta;
    L.push('# 星屿桥梁实验室 线性时程分析导出');
    L.push('# 波: ' + wm.label + ' | PGA ' + wm.pga.toFixed(4) + ' m/s2 | dt ' + wm.dt + ' s | 步数 ' + wm.steps);
    L.push('# 方向 ' + th.direction.toUpperCase() + ' | 阻尼 ' + (th.rayleigh.zeta * 100).toFixed(2) + '% | 位移为相对支座坐标(mm)');
    var i;
    if (what === 'wave') {
      L.push('step,t(s),acc(m/s2)');
      for (i = 0; i < wm.steps; i++) L.push(i + ',' + (i * wm.dt).toFixed(4) + ',' + wm.acc[i].toExponential(6));
    } else if (what === 'base') {
      L.push('step,t(s),baseShear(kN)');
      for (i = 0; i < th.steps; i++) L.push(i + ',' + (i * th.dt).toFixed(4) + ',' + th.baseShear[i].toFixed(4));
    } else {
      L.push('node,step,t(s),x(mm),y(mm),z(mm)');
      th.nodeHistory.forEach(function (h) {
        for (i = 0; i < th.steps; i++) {
          L.push(h.id + ',' + i + ',' + (i * th.dt).toFixed(4) + ',' +
            (h.x[i] * 1000).toFixed(6) + ',' + (h.y[i] * 1000).toFixed(6) + ',' + (h.z[i] * 1000).toFixed(6));
        }
      });
    }
    return L.join('\n');
  }

  root.SPATIAL_BRIDGE = {
    buildBridgeModel: buildBridgeModel,
    parseSpectrum: parseSpectrum,
    analyze: analyze,
    makeViewer: makeViewer,
    reportHtml: reportHtml,
    buildThCsv: buildThCsv
  };
})(window);
