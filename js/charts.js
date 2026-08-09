/* ============================================================
   charts.js — SVG 图表组件（深色主题）
   ============================================================ */
const Charts = (() => {

  /* ---------- 环形图 ---------- */
  function donut(container, opts) {
    const { segments, size = 150, thickness = 18, centerLabel = "", centerSub = "" } = opts;
    const r = (size - thickness) / 2;
    const cx = size / 2, cy = size / 2;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let angle = -90;
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(99,130,255,0.1)" stroke-width="${thickness}"/>`;
    segments.forEach(seg => {
      if (seg.value <= 0) return;
      const frac = seg.value / total;
      const a1 = angle, a2 = angle + frac * 360;
      const large = (a2 - a1) > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos(a1 * Math.PI / 180);
      const y1 = cy + r * Math.sin(a1 * Math.PI / 180);
      const x2 = cx + r * Math.cos(a2 * Math.PI / 180);
      const y2 = cy + r * Math.sin(a2 * Math.PI / 180);
      svg += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${seg.color}" stroke-width="${thickness}" stroke-linecap="round"/>`;
      angle = a2;
    });
    svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="20" font-weight="700" fill="#ffffff">${centerLabel}</text>`;
    if (centerSub) svg += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="rgba(235,235,245,0.6)">${centerSub}</text>`;
    svg += `</svg>`;
    container.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;">${svg}</div>`;
  }

  /* ---------- 柱状图 ---------- */
  function bars(container, opts) {
    const { labels, values, height = 180, color = "#0a84ff", unit = "" } = opts;
    const max = Math.max(...values, 1);
    const pad = { t: 20, r: 8, b: 26, l: 34 };
    const w = 560, h = height;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const n = values.length;
    const bw = Math.min(44, (innerW / n) * 0.55);
    const gap = (innerW - bw * n) / (n + 1);
    let svg = `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">`;
    // 网格线
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (innerH / 4) * i;
      const val = max * (4 - i) / 4;
      svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="rgba(99,130,255,0.08)"/>`;
      svg += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="rgba(235,235,245,0.32)">${Math.round(val)}${unit}</text>`;
    }
    values.forEach((v, i) => {
      const bh = (v / max) * innerH;
      const x = pad.l + gap + i * (bw + gap);
      const y = pad.t + innerH - bh;
      const gid = `bar-grad-${i}`;
      svg += `<defs><linearGradient id="${gid}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}"/>
      </linearGradient></defs>`;
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 2)}" rx="5" fill="url(#${gid})"/>`;
      svg += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="10" fill="rgba(235,235,245,0.6)">${v}</text>`;
      svg += `<text x="${x + bw / 2}" y="${h - 8}" text-anchor="middle" font-size="10" fill="rgba(235,235,245,0.32)">${labels[i]}</text>`;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
  }

  /* ---------- 折线图 ---------- */
  function line(container, opts) {
    const { labels, values, height = 200, color = "#64d2ff" } = opts;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const pad = { t: 22, r: 10, b: 26, l: 34 };
    const w = 600, h = height;
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;
    const n = values.length;
    const stepX = n > 1 ? innerW / (n - 1) : 0;
    const pt = (i, v) => {
      const x = pad.l + stepX * i;
      const y = pad.t + innerH - ((v - min) / range) * innerH;
      return [x, y];
    };
    let path = "";
    values.forEach((v, i) => {
      const [x, y] = pt(i, v);
      path += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    let svg = `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">`;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (innerH / 4) * i;
      svg += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="rgba(99,130,255,0.08)"/>`;
    }
    // 面积
    const last = pt(n - 1, values[n - 1]);
    svg += `<defs><linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>`;
    svg += `<path d="${path} L ${last[0]} ${pad.t + innerH} L ${pad.l} ${pad.t + innerH} Z" fill="url(#line-fill)"/>`;
    svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    values.forEach((v, i) => {
      const [x, y] = pt(i, v);
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#1c1c1e" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="rgba(235,235,245,0.6)">${v}</text>`;
      svg += `<text x="${x}" y="${h - 8}" text-anchor="middle" font-size="10" fill="rgba(235,235,245,0.32)">${labels[i]}</text>`;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
  }

  /* ---------- 倒计时数字 ---------- */
  function countdownBox(days) {
    const cls = days <= 3 ? "urgent" : "";
    return `<div class="cd-item ${cls}">
      <div class="cd-num"><b>${Math.max(days, 0)}</b><span>天</span></div>
      <div class="cd-info"><b id="cd-title"></b><span id="cd-sub"></span></div>
    </div>`;
  }

  return { donut, bars, line };
})();
