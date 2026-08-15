/* running.js — 跑步与马拉松训练记录（支持导入华为运动健康导出的 JSON） */
(function () {
  "use strict";

  var TYPE_LABELS = { run: "跑步", half: "半马", full: "全马" };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel, root) { root = root || document; return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(v, def) { var n = parseFloat(v); return isFinite(n) ? n : (def || 0); }
  function uid() { return (Store && Store.uid) ? Store.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function toast(msg, type) { if (window.toast) window.toast(msg, type); else if (window.alert) window.alert(msg); }

  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDate(iso) {
    if (!iso) return "";
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5];
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }
  function fmtDuration(min) {
    min = num(min, 0);
    var h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.round((min - Math.floor(min)) * 60) % 60;
    if (s === 60) { m++; s = 0; }
    if (h > 0) return h + ":" + p2(m) + ":" + p2(s);
    return m + ":" + p2(s);
  }
  function fmtPace(pace) {
    if (!isFinite(pace) || pace <= 0) return "—";
    var m = Math.floor(pace), s = Math.round((pace - m) * 60);
    if (s === 60) { m++; s = 0; }
    return m + "'" + p2(s) + '"';
  }
  function fmtKm(km) { return (num(km, 0)).toFixed(2); }

  /* ---------- 华为运动健康 JSON 解析 ---------- */
  function fixHuaweiJson(text) {
    // 华为导出中 partTimeMap 等含未加引号的数值 key，例如 {1.0:439.0,...}
    return text.replace(/([{,])(\d+(?:\.\d+)?):/g, '$1"$2":');
  }

  var LBS_RE = /tp=lbs;k=\d+;lat=([-0-9.]+);lon=([-0-9.]+);alt=([-0-9.]+);t=([-0-9.Ee+]+);/g;
  var HR_RE = /tp=h-r;k=(\d+);v=([-0-9.]+);/g;
  var CAD_RE = /tp=s-r;k=(\d+);v=([-0-9.]+);/g;

  function haversine(a, b) {
    var R = 6371.0088;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLon = (b.lon - a.lon) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function tzOffsetSec(tzStr) {
    try {
      if (!tzStr || tzStr.length < 5) return 8 * 3600;
      var sign = tzStr[0] === "+" ? 1 : -1;
      var h = parseInt(tzStr.slice(1, 3), 10);
      var m = parseInt(tzStr.slice(3, 5), 10);
      return isFinite(h) ? sign * (h * 3600 + m * 60) : 8 * 3600;
    } catch (e) { return 8 * 3600; }
  }

  function wallDateTime(unixSec, tzStr) {
    var d = new Date((unixSec + tzOffsetSec(tzStr)) * 1000);
    return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate()) +
           "T" + p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()) + ":" + p2(d.getUTCSeconds());
  }

  function parseActivity(act) {
    var attr = String(act.attribute || "");
    var points = [], m;
    LBS_RE.lastIndex = 0;
    while ((m = LBS_RE.exec(attr)) !== null) {
      var lat = parseFloat(m[1]), lon = parseFloat(m[2]);
      if (lat === 90 && lon === -80) continue; // 暂停/停止标记
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      points.push({ t: parseFloat(m[4]), lat: lat, lon: lon });
    }
    if (points.length < 2) return null;

    var hrs = [], cads = [];
    HR_RE.lastIndex = 0;
    while ((m = HR_RE.exec(attr)) !== null) { var hv = parseInt(m[2], 10); if (hv > 20 && hv < 240) hrs.push(hv); }
    CAD_RE.lastIndex = 0;
    while ((m = CAD_RE.exec(attr)) !== null) { var cv = parseInt(m[2], 10); if (cv > 60 && cv < 260) cads.push(cv); }

    var dist = 0;
    for (var i = 1; i < points.length; i++) {
      var d = haversine(points[i - 1], points[i]);
      if (d >= 0 && d < 5) dist += d; // 忽略 >5km 的异常跳变点
    }

    var moving = 0;
    for (var j = 1; j < points.length; j++) {
      var gap = points[j].t - points[j - 1].t;
      if (gap > 0 && gap <= 60) moving += gap;
    }
    var durationSec = num(act.duration, 0);
    if (!durationSec) durationSec = moving || (points[points.length - 1].t - points[0].t);
    if (durationSec <= 0) durationSec = moving;

    var avgHr = hrs.length ? Math.round(hrs.reduce(function (a, b) { return a + b; }, 0) / hrs.length) : null;
    var maxHr = hrs.length ? Math.max.apply(null, hrs) : null;
    var avgCad = cads.length ? Math.round(cads.reduce(function (a, b) { return a + b; }, 0) / cads.length) : null;

    var tz = act.timeZone || "+0800";
    var type = "run";
    if (dist >= 42.195) type = "full";
    else if (dist >= 21.0975) type = "half";

    return {
      id: uid(),
      recordId: act.recordId || null,
      type: type,
      date: wallDateTime(points[0].t, tz),
      dateKey: wallDateTime(points[0].t, tz).slice(0, 10),
      distanceKm: +dist.toFixed(2),
      durationMin: +(durationSec / 60).toFixed(1),
      avgHr: avgHr,
      maxHr: maxHr,
      cadence: avgCad,
      pace: durationSec > 0 ? durationSec / 60 / (dist || 1) : null,
      source: "huawei",
      importedAt: new Date().toISOString(),
      note: ""
    };
  }

  function parseHuaweiFiles(files) {
    var results = [], errors = [];
    var pending = Array.from(files);
    var processed = 0;
    return new Promise(function (resolve) {
      function next() {
        if (processed >= pending.length) { resolve({ records: results, errors: errors }); return; }
        var file = pending[processed++];
        if (file.name.indexOf("motion path detail data") !== 0) { next(); return; }
        var reader = new FileReader();
        reader.onerror = function () { errors.push(file.name + "：读取失败"); next(); };
        reader.onload = function () {
          try {
            var data = JSON.parse(fixHuaweiJson(String(reader.result)));
            var arr = Array.isArray(data) ? data : ((data && Array.isArray(data.sportList)) ? data.sportList : [data]);
            arr.forEach(function (act) {
              var st = num(act.sportType, -1);
              if (st !== 2 && st !== 4) return; // sportType 2/4 = 跑步
              var r = parseActivity(act);
              if (r) results.push(r);
            });
          } catch (e) {
            errors.push(file.name + "：解析失败（" + (e && e.message || e) + "）");
          }
          next();
        };
        reader.readAsText(file, "utf-8");
      }
      next();
    });
  }

  /* ---------- 数据持久化 ---------- */
  function getRecords() {
    if (!Store) return [];
    var list = Store.getAll("running") || [];
    return list.slice().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
  }

  function addRecord(rec, silent) {
    if (!Store) return null;
    var r = Store.add("running", rec);
    if (r && !silent) { render(); }
    return r;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var root = document.getElementById("view-running");
    if (!root) return;
    var records = getRecords();
    renderStats(records);
    renderWeekly(records);
    renderBest(records);
    renderList(records);
  }

  function statBox(value, label, note) {
    return '<div class="running-stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span>' +
           (note ? '<em>' + esc(note) + '</em>' : '') + '</div>';
  }

  function totals(records) {
    var t = { km: 0, count: 0, full: 0, half: 0, run: 0, hrs: [], paceSum: 0, paceN: 0 };
    records.forEach(function (r) {
      t.km += num(r.distanceKm, 0);
      t.count++;
      if (r.type === "full") t.full++;
      else if (r.type === "half") t.half++;
      else t.run++;
      if (num(r.avgHr, 0) > 0) t.hrs.push(num(r.avgHr, 0));
      if (num(r.pace, 0) > 0) { t.paceSum += num(r.pace, 0); t.paceN++; }
    });
    t.avgPace = t.paceN ? t.paceSum / t.paceN : null;
    t.avgHr = t.hrs.length ? Math.round(t.hrs.reduce(function (a, b) { return a + b; }, 0) / t.hrs.length) : null;
    return t;
  }

  function renderStats(records) {
    var el = document.getElementById("runningStats");
    if (!el) return;
    var t = totals(records);
    el.innerHTML =
      '<div class="running-stats">' +
        statBox(t.km.toFixed(1), "总里程 (km)", t.count + " 次") +
        statBox(fmtPace(t.avgPace), "平均配速", "/km") +
        statBox(t.avgHr ? t.avgHr : "—", "平均心率", "bpm") +
        statBox(t.full + " / " + t.half, "全马 / 半马", "完成次数") +
      '</div>';
  }

  function weekStart(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function renderWeekly(records) {
    var el = document.getElementById("runningWeekly");
    if (!el) return;
    var now = new Date();
    var weeks = [];
    var start = weekStart(now);
    for (var i = 7; i >= 0; i--) {
      var s = new Date(start);
      s.setDate(s.getDate() - 7 * i);
      var e = new Date(s);
      e.setDate(e.getDate() + 7);
      weeks.push({ s: s, e: e, km: 0, label: (s.getMonth() + 1) + "/" + s.getDate() });
    }
    records.forEach(function (r) {
      var d = new Date(r.date);
      if (isNaN(d)) return;
      weeks.forEach(function (w) {
        if (d >= w.s && d < w.e) w.km += num(r.distanceKm, 0);
      });
    });
    var max = Math.max.apply(null, weeks.map(function (w) { return w.km; })) || 1;
    el.innerHTML = '<div class="running-weekly-bars">' + weeks.map(function (w) {
      var h = Math.max(4, Math.round(w.km / max * 100));
      var isCur = w.s.getTime() === start.getTime();
      return '<div class="running-week-col' + (isCur ? ' cur' : '') + '">' +
               '<div class="running-week-val">' + (w.km > 0 ? w.km.toFixed(1) : "") + '</div>' +
               '<div class="running-week-bar" style="height:' + h + '%"></div>' +
               '<div class="running-week-label">' + w.label + '</div>' +
             '</div>';
    }).join('') + '</div>' +
    '<p class="hint">近 8 周每周跑步里程（km），绿色为本周进度。</p>';
  }

  function renderBest(records) {
    var el = document.getElementById("runningBest");
    if (!el) return;
    var full = records.filter(function (r) { return r.type === "full"; });
    var half = records.filter(function (r) { return r.type === "half"; });
    function best(list) {
      if (!list.length) return null;
      return list.slice().sort(function (a, b) { return num(a.pace, 999) - num(b.pace, 999); })[0];
    }
    var bf = best(full), bh = best(half);
    var boxes = [];
    boxes.push('<div class="running-best-box"><div class="running-best-label">全程马拉松最佳</div>' +
      (bf ? '<div class="running-best-time">' + esc(fmtDuration(bf.durationMin)) + '</div>' +
            '<div class="running-best-meta">' + esc(fmtPace(bf.pace)) + ' /km · ' + esc(fmtDate(bf.date)) + '</div>'
         : '<div class="running-best-meta">暂无记录</div>') + '</div>');
    boxes.push('<div class="running-best-box"><div class="running-best-label">半程马拉松最佳</div>' +
      (bh ? '<div class="running-best-time">' + esc(fmtDuration(bh.durationMin)) + '</div>' +
            '<div class="running-best-meta">' + esc(fmtPace(bh.pace)) + ' /km · ' + esc(fmtDate(bh.date)) + '</div>'
         : '<div class="running-best-meta">暂无记录</div>') + '</div>');
    el.innerHTML = '<div class="running-best">' + boxes.join('') + '</div>';
  }

  function renderList(records) {
    var el = document.getElementById("runningList");
    if (!el) return;
    if (!records.length) {
      el.innerHTML = '<div class="empty-state"><div class="big">🏃</div><p>还没有跑步记录，点击右上角「导入华为数据」或「+ 手动记录」开始。</p></div>';
      return;
    }
    el.innerHTML = records.map(function (r) {
      var typeBadge = '<span class="tag-chip ' + (r.type === "full" ? "pri-high" : r.type === "half" ? "pri-mid" : "pri-low") + '" style="margin-right:8px">' + (TYPE_LABELS[r.type] || "跑步") + '</span>';
      var meta = [];
      meta.push(fmtDuration(r.durationMin));
      meta.push(fmtPace(r.pace) + " /km");
      if (num(r.avgHr, 0) > 0) meta.push("♥ " + r.avgHr);
      if (num(r.cadence, 0) > 0) meta.push("步频 " + r.cadence);
      if (r.source === "huawei") meta.push('<span class="running-src">华为</span>');
      return '<div class="lit-item running-item">' +
        '<div class="lit-main">' +
          '<div class="lit-title">' + typeBadge + esc(fmtKm(r.distanceKm)) + ' km · ' + esc(fmtDate(r.date)) + '</div>' +
          '<div class="lit-meta">' + meta.join(' · ') + '</div>' +
          (r.note ? '<div class="lit-notes">' + esc(r.note) + '</div>' : '') +
        '</div>' +
        '<div class="row-actions"><button class="text-btn running-del" data-id="' + esc(r.id) + '" title="删除该记录">删除</button></div>' +
      '</div>';
    }).join('');
    $$(".running-del", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-id");
        if (!confirm("确定删除这条跑步记录吗？")) return;
        if (Store) Store.remove("running", id, { permanent: true });
        render();
      };
    });
  }

  /* ---------- 导入 ---------- */
  function openImportModal() {
    if (window.showModal) window.showModal("runningImportModal");
    else { var m = document.getElementById("runningImportModal"); if (m) m.classList.add("show"); }
  }
  function openAddModal() {
    if (window.showModal) window.showModal("runningModal");
    else { var m = document.getElementById("runningModal"); if (m) m.classList.add("show"); }
  }

  function handleImportFiles(files) {
    if (!files || !files.length) return;
    var list = Array.from(files); // FileList 是实时的，先复制成数组再清空 input
    var fileInput = document.getElementById("runningImportFile");
    if (fileInput) fileInput.value = "";
    parseHuaweiFiles(list).then(function (res) {
      if (!res.records.length) {
        toast("没有找到可用的跑步轨迹（motion path detail data*.json），请检查文件", "err");
        return;
      }
      var existing = getRecords();
      var existingIds = {};
      existing.forEach(function (r) { if (r.recordId) existingIds[r.recordId] = true; });
      var added = 0, skipped = 0;
      res.records.forEach(function (r) {
        if (r.recordId && existingIds[r.recordId]) { skipped++; return; }
        addRecord(r, true);
        added++;
      });
      if (res.errors.length) toast(res.errors[0], "err");
      if (added) toast("已导入 " + added + " 条跑步记录" + (skipped ? "，跳过 " + skipped + " 条重复" : ""), "ok");
      else toast("没有新增记录" + (skipped ? "（" + skipped + " 条已存在）" : ""), "ok");
      render();
    });
  }

  function saveManual() {
    var f = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
    var date = f("runDate");
    if (!date) { toast("请填写日期时间", "err"); return; }
    var type = f("runType") || "run";
    var dist = num(f("runDistance"), NaN);
    if (!isFinite(dist) || dist <= 0) { toast("请填写有效距离", "err"); return; }
    var durMin = num(f("runDuration"), NaN);
    if (!isFinite(durMin) || durMin <= 0) { toast("请填写有效时长", "err"); return; }
    var rec = {
      id: uid(),
      type: type,
      date: date.replace(" ", "T"),
      dateKey: date.slice(0, 10),
      distanceKm: +dist.toFixed(2),
      durationMin: +durMin.toFixed(1),
      pace: durMin / dist,
      avgHr: f("runAvgHr") ? num(f("runAvgHr"), null) : null,
      cadence: f("runCadence") ? num(f("runCadence"), null) : null,
      source: "manual",
      createdAt: new Date().toISOString(),
      note: f("runNote")
    };
    addRecord(rec);
    if (window.closeModal) window.closeModal("runningModal");
    toast("已添加跑步记录", "ok");
  }

  /* ---------- 事件绑定 ---------- */
  function wire() {
    var importBtn = document.getElementById("btnImportRunning");
    if (importBtn) importBtn.onclick = openImportModal;
    var addBtn = document.getElementById("btnAddRunning");
    if (addBtn) addBtn.onclick = openAddModal;

    var fileInput = document.getElementById("runningImportFile");
    if (fileInput) fileInput.onchange = function () { handleImportFiles(fileInput.files); };

    // 拖拽导入
    var drop = document.getElementById("runningDropZone");
    if (drop) {
      drop.onclick = function () { if (fileInput) fileInput.click(); };
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("drag-over"); };
      drop.ondragleave = function () { drop.classList.remove("drag-over"); };
      drop.ondrop = function (e) {
        e.preventDefault();
        drop.classList.remove("drag-over");
        handleImportFiles(e.dataTransfer.files);
      };
    }

    var saveBtn = document.getElementById("btnSaveRunning");
    if (saveBtn) saveBtn.onclick = saveManual;
  }

  window.Running = {
    render: render,
    getRecords: getRecords,
    addRecord: addRecord,
    parseHuaweiFiles: parseHuaweiFiles
  };

  wire();
})();
