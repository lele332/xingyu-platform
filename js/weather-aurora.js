/* ============================================================
   weather-aurora.js — 天气模块 Aurora 液态玻璃风格（可选界面）
   复用 js/weather.js 的实时数据（中国天气网 / Open-Meteo），
   通过 localStorage["zero_wx_style"] = "aurora" | "classic" 切换。
   ============================================================ */
(function () {
  "use strict";

  var STYLE_KEY = "zero_wx_style";

  /* ---------- 语言 ---------- */
  function lang() { return document.documentElement.dataset.lang || "zh"; }
  function L(o) { return lang() === "en" ? o.en : (lang() === "zh-Hant" ? o.ht : o.zh); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 图标（内联 SVG sprite，注入一次） ---------- */
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="w-sun" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></g></symbol>' +
    '<symbol id="w-cloud" viewBox="0 0 24 24"><path d="M7.2 18.2h9.4a4.1 4.1 0 0 0 .7-8.14A6.1 6.1 0 0 0 5.6 11.5a3.6 3.6 0 0 0 1.6 6.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>' +
    '<symbol id="w-cloud2" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14.6a3.4 3.4 0 0 1 .8-6.7 4.9 4.9 0 0 1 9.3 1.4 3.4 3.4 0 0 1 1.5 5.9"/><circle cx="7.5" cy="6" r="1.8"/></g></symbol>' +
    '<symbol id="w-rain" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 14.8h9.4a4.1 4.1 0 0 0 .7-8.14A6.1 6.1 0 0 0 5.6 8.1a3.6 3.6 0 0 0 1.6 6.7z"/><path d="M8.4 18.2l-1 2.2M12.4 18.2l-1 2.2M16.4 18.2l-1 2.2"/></g></symbol>' +
    '<symbol id="w-snow" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 14.8h9.4a4.1 4.1 0 0 0 .7-8.14A6.1 6.1 0 0 0 5.6 8.1a3.6 3.6 0 0 0 1.6 6.7z"/><path d="M8 18.6v.2M12 19.2v.2M16 18.6v.2" stroke-width="2.6"/></g></symbol>' +
    '<symbol id="w-storm" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 14.2h9.4a4.1 4.1 0 0 0 .7-8.14A6.1 6.1 0 0 0 5.6 7.5a3.6 3.6 0 0 0 1.6 6.7z"/><path d="M13 15.5l-2.6 3.6h3l-2 3.4"/></g></symbol>' +
    '<symbol id="w-fog" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9.5h16M6.5 13h11M4.5 16.5h15"/></g></symbol>' +
    '<symbol id="w-wind" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 8.2h8.6a2.4 2.4 0 1 0-2.3-3.1"/><path d="M3 12.5h13.8a2.5 2.5 0 1 1-2.4 3.2"/><path d="M3 16.8h5.5"/></g></symbol>' +
    '<symbol id="w-drop" viewBox="0 0 24 24"><path d="M12 3.6s5.6 5.8 5.6 9.9a5.6 5.6 0 1 1-11.2 0C6.4 9.4 12 3.6 12 3.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>' +
    '<symbol id="w-gust" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 9.5h10.8a2.3 2.3 0 1 0-2.2-3"/><path d="M3.5 14h7.2"/><path d="M13.5 14a2.6 2.6 0 1 1-2.5 3.3"/></g></symbol>' +
    '<symbol id="w-leaf" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4c-7.5.4-12.5 3.6-13 9.5-.2 2.7 1.3 5.2 3.5 6.2C13.5 13.5 16 9 19 4z"/><path d="M6.5 19.5C10 14 13.5 10.5 17 8.5"/></g></symbol>' +
    '<symbol id="w-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.2s-6.8-5.7-6.8-10.7a6.8 6.8 0 1 1 13.6 0c0 5-6.8 10.7-6.8 10.7z"/><circle cx="12" cy="10.3" r="2.3"/></g></symbol>' +
    "</defs></svg>";

  function ensureSprite() {
    if (!document.getElementById("w-sun")) {
      document.body.insertAdjacentHTML("afterbegin", SPRITE);
    }
  }

  /* ---------- 天气文本 → 图标 ---------- */
  function iconByText(t) {
    t = String(t || "");
    if (/雷/.test(t)) return "w-storm";
    if (/雪|冰雹/.test(t)) return "w-snow";
    if (/雨/.test(t)) return "w-rain";
    if (/雾|霾|沙|尘/.test(t)) return "w-fog";
    if (/阴/.test(t)) return "w-cloud";
    if (/云/.test(t)) return "w-cloud2";
    if (/晴/.test(t)) return "w-sun";
    return "w-cloud";
  }
  var WMO_ICON = { 0:"w-sun",1:"w-sun",2:"w-cloud2",3:"w-cloud",45:"w-fog",48:"w-fog",51:"w-rain",53:"w-rain",55:"w-rain",56:"w-rain",57:"w-rain",61:"w-rain",63:"w-rain",65:"w-rain",66:"w-rain",67:"w-rain",71:"w-snow",73:"w-snow",75:"w-snow",77:"w-snow",80:"w-rain",81:"w-rain",82:"w-storm",85:"w-snow",86:"w-snow",95:"w-storm",96:"w-storm",99:"w-storm" };
  var WMO_TXT = {
    0:{zh:"晴",ht:"晴",en:"Clear"},1:{zh:"大部晴朗",ht:"大致晴朗",en:"Mostly clear"},2:{zh:"多云",ht:"多雲",en:"Partly cloudy"},
    3:{zh:"阴",ht:"陰",en:"Overcast"},45:{zh:"雾",ht:"霧",en:"Fog"},48:{zh:"冻雾",ht:"凍霧",en:"Rime fog"},
    51:{zh:"毛毛雨",ht:"毛毛雨",en:"Drizzle"},53:{zh:"毛毛雨",ht:"毛毛雨",en:"Drizzle"},55:{zh:"强毛毛雨",ht:"強毛毛雨",en:"Dense drizzle"},
    61:{zh:"小雨",ht:"小雨",en:"Light rain"},63:{zh:"中雨",ht:"中雨",en:"Rain"},65:{zh:"大雨",ht:"大雨",en:"Heavy rain"},
    66:{zh:"冻雨",ht:"凍雨",en:"Freezing rain"},67:{zh:"冻雨",ht:"凍雨",en:"Freezing rain"},
    71:{zh:"小雪",ht:"小雪",en:"Light snow"},73:{zh:"中雪",ht:"中雪",en:"Snow"},75:{zh:"大雪",ht:"大雪",en:"Heavy snow"},
    77:{zh:"雪粒",ht:"雪粒",en:"Snow grains"},80:{zh:"阵雨",ht:"陣雨",en:"Showers"},81:{zh:"阵雨",ht:"陣雨",en:"Showers"},
    82:{zh:"强阵雨",ht:"強陣雨",en:"Heavy showers"},85:{zh:"阵雪",ht:"陣雪",en:"Snow showers"},86:{zh:"阵雪",ht:"陣雪",en:"Snow showers"},
    95:{zh:"雷阵雨",ht:"雷陣雨",en:"Thunderstorm"},96:{zh:"雷雨伴冰雹",ht:"雷雨伴冰雹",en:"Thunderstorm"},99:{zh:"雷雨伴冰雹",ht:"雷雨伴冰雹",en:"Thunderstorm"}
  };
  function wmoTxt(code) { var w = WMO_TXT[code]; return w ? w : { zh: "未知", ht: "未知", en: "Unknown" }; }

  /* ---------- 数据归一化 ---------- */
  function normalize(data, city) {
    var m = { city: city.name, temp: null, desc: "", icon: "w-cloud", wind: "—", windIcon: "w-wind",
              m2: null, m3: null, days: [], updated: "", source: data.source };
    function fmtTime() {
      var locale = lang() === "en" ? "en-US" : lang() === "zh-Hant" ? "zh-TW" : "zh-CN";
      return new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    }
    if (data.source === "china") {
      var rt = data.realtime;
      m.temp = Math.round(rt.temp);
      m.desc = rt.weather || "";
      m.icon = iconByText(m.desc);
      m.wind = (rt.wind_dir || "—") + (rt.wind_scale ? " " + rt.wind_scale + L({zh:" 级",ht:" 級",en:" lvl"}) : "");
      if (rt.humidity != null) m.m2 = { icon: "w-drop", label: L({zh:"湿度",ht:"濕度",en:"Humidity"}), value: rt.humidity + "%" };
      if (rt.aqi != null) {
        var aqi = rt.aqi, al = L({zh:"优",ht:"優",en:"Good"});
        if (aqi > 300) al = L({zh:"严重污染",ht:"嚴重污染",en:"Hazardous"});
        else if (aqi > 200) al = L({zh:"重度污染",ht:"重度污染",en:"Very unhealthy"});
        else if (aqi > 150) al = L({zh:"中度污染",ht:"中度污染",en:"Unhealthy"});
        else if (aqi > 100) al = L({zh:"轻度污染",ht:"輕度污染",en:"Unhealthy for sensitive"});
        else if (aqi > 50) al = L({zh:"良",ht:"良",en:"Moderate"});
        m.m3 = { icon: "w-leaf", label: L({zh:"空气质量",ht:"空氣品質",en:"Air quality"}), value: aqi + " · " + al };
      } else if (rt.pressure != null) {
        m.m3 = { icon: "w-gust", label: L({zh:"气压",ht:"氣壓",en:"Pressure"}), value: Math.round(rt.pressure) + " hPa" };
      }
      m.days = (data.forecast || []).slice(0, 7).map(function (f, i) {
        return { name: f.day || "", high: Math.round(f.high), low: Math.round(f.low), text: f.textDay || f.text || "", icon: iconByText(f.textDay || f.text || "") };
      });
      m.updated = data.updated || fmtTime();
    } else {
      var cur = data.current, dl = data.daily;
      m.temp = Math.round(cur.temperature_2m);
      m.desc = wmoTxt(cur.weather_code)[lang() === "en" ? "en" : (lang() === "zh-Hant" ? "ht" : "zh")];
      m.icon = WMO_ICON[cur.weather_code] || "w-cloud";
      m.wind = Math.round(cur.wind_speed_10m) + " km/h";
      m.m2 = { icon: "w-drop", label: L({zh:"湿度",ht:"濕度",en:"Humidity"}), value: cur.relative_humidity_2m + "%" };
      m.m3 = { icon: "w-gust", label: L({zh:"体感",ht:"體感",en:"Feels like"}), value: Math.round(cur.apparent_temperature) + "°" };
      var week = lang() === "en" ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
               : lang() === "zh-Hant" ? ["週日","週一","週二","週三","週四","週五","週六"]
               : ["周日","周一","周二","周三","周四","周五","周六"];
      m.days = (dl.time || []).slice(0, 7).map(function (d, i) {
        var wd = week[new Date(d + "T00:00:00").getDay()];
        return { name: i === 0 ? L({zh:"今天",ht:"今天",en:"Today"}) : wd, high: Math.round(dl.temperature_2m_max[i]), low: Math.round(dl.temperature_2m_min[i]),
                 text: wmoTxt(dl.weather_code[i])[lang() === "en" ? "en" : (lang() === "zh-Hant" ? "ht" : "zh")],
                 icon: WMO_ICON[dl.weather_code[i]] || "w-cloud" };
      });
      m.updated = fmtTime();
    }
    if (m.days.length === 0) { m.days = null; }
    return m;
  }

  /* ---------- 波形曲线（Catmull-Rom → Bezier） ---------- */
  function chartPaths(vals) {
    var n = vals.length, pts = [];
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = Math.max(hi - lo, 6);
    for (var i = 0; i < n; i++) {
      var x = n === 1 ? 417.5 : (835 * i) / (n - 1);
      var y = 40 + (150 - 40) * (1 - (vals[i] - lo) / span);
      pts.push([x, y]);
    }
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var j = 0; j < n - 1; j++) {
      var p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(n - 1, j + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return { line: d, fill: d + " L835,230 L0,230 Z" };
  }

  /* ---------- 暴风雨背景 ---------- */
  function bgSvg() {
    return '<svg class="a-bg" viewBox="0 0 1600 1200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="aSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03101a"/><stop offset=".42" stop-color="#072028"/><stop offset=".68" stop-color="#0b2e34"/><stop offset=".76" stop-color="#0f3835"/><stop offset="1" stop-color="#081f19"/></linearGradient>' +
        '<linearGradient id="aField" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#123722"/><stop offset="1" stop-color="#05130c"/></linearGradient>' +
        '<filter id="aB60" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="60"/></filter>' +
        '<filter id="aGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      "</defs>" +
      '<rect width="1600" height="1200" fill="url(#aSky)"/>' +
      '<g filter="url(#aB60)"><ellipse cx="290" cy="235" rx="540" ry="215" fill="#051820"/><ellipse cx="880" cy="165" rx="650" ry="240" fill="#061c24"/><ellipse cx="1400" cy="285" rx="520" ry="225" fill="#082329"/><ellipse cx="620" cy="420" rx="640" ry="185" fill="#0a2a30" opacity=".8"/><ellipse cx="1220" cy="470" rx="560" ry="170" fill="#0d3339" opacity=".7"/></g>' +
      '<ellipse cx="800" cy="585" rx="780" ry="150" fill="#12434a" opacity=".32" filter="url(#aB60)"/>' +
      '<g filter="url(#aGlow)" stroke="#eef8f4" fill="none" stroke-linecap="round">' +
        '<path d="M520 195 473 400l52-8-74 236" stroke-width="5" opacity=".92" style="animation:aFlicker 9s infinite"/>' +
        '<path d="M1064 250 1032 398l38-6-52 168" stroke-width="3.6" opacity=".7" style="animation:aFlicker 11s 1.6s infinite"/>' +
      "</g>" +
      '<path d="M0 905 Q 400 862 800 890 T 1600 878 V1200 H0 Z" fill="url(#aField)"/>' +
      "</svg>";
  }

  /* ---------- 渲染 ---------- */
  function render(data, city) {
    var box = document.getElementById("weatherContent");
    if (!box) return;
    ensureSprite();
    var m = normalize(data, city);
    var isEn = lang() === "en";

    /* 概述文案 */
    var d0 = m.days && m.days[0];
    var blurb;
    if (isEn) {
      blurb = (d0 ? "High around " + d0.high + "°F".replace("F", "C") + ", low " + d0.low + "°. " : "") +
        "Wind " + m.wind + ". " + (m.m2 ? m.m2.label + " " + m.m2.value + ". " : "") +
        "Updated " + m.updated + ".";
    } else {
      blurb = (d0 ? L({zh:"最高",ht:"最高",en:""}) + " " + d0.high + "° / " + L({zh:"最低",ht:"最低",en:""}) + " " + d0.low + "°，" : "") +
        m.wind + (m.m2 ? "，" + m.m2.label + " " + m.m2.value : "") + "。" +
        L({zh:"更新于",ht:"更新於",en:" Updated "}) + " " + m.updated;
    }

    /* 图表 */
    var chart = "";
    if (m.days && m.days.length >= 2) {
      var vals = m.days.map(function (d) { return d.high; });
      var p = chartPaths(vals);
      chart =
        '<svg class="a-wave" viewBox="0 0 835 230" preserveAspectRatio="none" aria-hidden="true">' +
          "<defs>" +
            '<linearGradient id="aWg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>' +
            '<linearGradient id="aWf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".02"/></linearGradient>' +
            '<linearGradient id="aWgv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".8" stop-color="#777"/><stop offset="1" stop-color="#444"/></linearGradient>' +
            '<mask id="aWfade"><rect x="0" y="0" width="835" height="230" fill="url(#aWgv)"/></mask>' +
            '<clipPath id="aWclip" clipPathUnits="userSpaceOnUse"><rect id="aClipR" x="0" y="0" width="835" height="230"/></clipPath>' +
          "</defs>" +
          '<g clip-path="url(#aWclip)"><path d="' + p.fill + '" fill="url(#aWf)" mask="url(#aWfade)"/></g>' +
          '<path class="a-line" d="' + p.line + '" stroke-width="6.2" opacity=".17" pathLength="1"/>' +
          '<path class="a-line w2" d="' + p.line + '" stroke-width="4.6" opacity=".26" pathLength="1"/>' +
          '<path class="a-line w3" d="' + p.line + '" stroke-width="3.4" opacity="1" pathLength="1"/>' +
        "</svg>";
    }

    /* 温度行 + 日期行（合并生成，保证对齐） */
    var tempsHtml = "", daysHtml = "";
    if (m.days) {
      tempsHtml = '<div class="a-temps">' + m.days.map(function (d) {
        return '<div class="a-tcol"><b>' + d.high + "°</b><svg><use href=\"#" + d.icon + '"/></svg></div>';
      }).join("") + "</div>" + chart;
      daysHtml = '<div class="a-days">' + m.days.map(function (d, i) {
        return '<span' + (i === 0 ? ' class="on"' : "") + ">" + esc(d.name) + "</span>";
      }).join("") + "</div>";
    }

    /* 右侧卡片：今天 + 未来 3 天 */
    var rows = "";
    if (m.days) {
      rows = m.days.slice(1, 4).map(function (d) {
        return '<div class="a-card row"><div class="a-cinfo"><span class="a-cn">' + esc(d.name) + '</span><span class="a-cc">' + esc(d.text) + " · " + d.low + "° ~ " + d.high + "°</span></div>" +
          '<div class="a-cright"><svg><use href="#' + d.icon + '"/></svg><b>' + d.high + "°</b></div></div>";
      }).join("");
    }

    var metrics = "";
    [ { icon: m.windIcon, label: L({zh:"风",ht:"風",en:"Wind"}), value: m.wind }, m.m2, m.m3 ].forEach(function (x) {
      if (x) metrics += '<div class="a-m"><span class="a-mrow"><svg><use href="#' + x.icon + '"/></svg>' + esc(x.label) + '</span><span class="a-mval">' + esc(x.value) + "</span></div>";
    });

    var skyClass = /雪|冰/.test(m.desc) ? " wx-snow" : (/晴/.test(m.desc) && !/云|雨|阴|雷/.test(m.desc) ? " wx-sun" : "");

    box.innerHTML =
      '<div class="aurora' + skyClass + '" role="region" aria-label="Aurora Weather">' +
        '<div class="aurora-stage">' + bgSvg() +
          '<section class="a-hero">' +
            '<span class="a-chip">' + L({zh:"天气预报",ht:"天氣預報",en:"Weather Forecast"}) + "</span>" +
            "<h1>" +
              '<span class="a-ln"><span>' + esc(m.desc) + "</span></span>" +
              '<span class="a-ln"><span>' + esc(m.city) + "</span></span>" +
            "</h1>" +
            '<p class="a-blurb">' + esc(blurb) + "</p>" +
          "</section>" +
          '<section class="a-forecast" aria-label="' + L({zh:"未来几天",ht:"未來幾天",en:"Forecast"}) + '">' + tempsHtml + daysHtml + "</section>" +
          '<aside class="a-rail">' +
            '<div class="a-card big">' +
              '<div class="a-place"><svg><use href="#w-pin"/></svg>' + esc(m.city) + "</div>" +
              '<div class="a-bigtemp">' + m.temp + "°<i> C</i></div>" +
              '<div class="a-metrics">' + metrics + "</div>" +
            "</div>" + rows +
          "</aside>" +
          '<div class="a-src">' + (data.source === "china" ? L({zh:"数据来源：中国天气网",ht:"資料來源：中國天氣網",en:"Source: China Weather"}) : L({zh:"数据来源：Open-Meteo",ht:"資料來源：Open-Meteo",en:"Source: Open-Meteo"})) + "</div>" +
        "</div>" +
      "</div>";
  }

  /* ---------- 切换 ---------- */
  function isAurora() {
    try { return localStorage.getItem(STYLE_KEY) === "aurora"; } catch (e) { return false; }
  }
  function applyBodyClass() {
    document.body.classList.toggle("wx-aurora", isAurora());
  }
  function updateBtn() {
    var btn = document.getElementById("btnWeatherStyle");
    if (!btn) return;
    btn.textContent = isAurora() ? L({zh:"经典界面",ht:"經典介面",en:"Classic"}) : "Aurora";
    btn.title = L({zh:"切换天气界面风格",ht:"切換天氣介面風格",en:"Switch weather UI style"});
  }
  function init() {
    applyBodyClass();
    updateBtn();
    var btn = document.getElementById("btnWeatherStyle");
    if (btn && !btn.dataset.wxBound) {
      btn.dataset.wxBound = "1";
      btn.onclick = function () {
        try { localStorage.setItem(STYLE_KEY, isAurora() ? "classic" : "aurora"); } catch (e) {}
        applyBodyClass();
        updateBtn();
        if (window.Weather && Weather.reRender) Weather.reRender();
      };
    }
    /* 若数据先到、aurora 晚加载，补一次渲染 */
    if (isAurora() && window.Weather && Weather.reRender) Weather.reRender();
  }

  window.WeatherAurora = { render: render, init: init, isAurora: isAurora };
})();
