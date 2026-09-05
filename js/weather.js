/* ============================================================
   weather.js — 实时天气（数据源：中国天气 weather.com.cn，经本机原生后端代理）
   提供：我的城市（固定位置）+ 实时天气 + 空气质量 + 气象预警 + 生活指数 + 7 天预报
   兜底：原生后端不可用时降级到 Open-Meteo（手机/远程访问）
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 常用城市（含中国天气城市编码 + 经纬度兜底） ---------- */
  var CITIES = [
    { id: "101010100", name: "北京", lat: 39.9075, lon: 116.3972 },
    { id: "101020100", name: "上海", lat: 31.2304, lon: 121.4737 },
    { id: "101280101", name: "广州", lat: 23.1291, lon: 113.2644 },
    { id: "101280601", name: "深圳", lat: 22.5431, lon: 114.0579 },
    { id: "101210101", name: "杭州", lat: 30.2741, lon: 120.1551 },
    { id: "101270101", name: "成都", lat: 30.5728, lon: 104.0668 },
    { id: "101200101", name: "武汉", lat: 30.5928, lon: 114.3055 },
    { id: "101110101", name: "西安", lat: 34.3416, lon: 108.9398 },
    { id: "101190101", name: "南京", lat: 32.0603, lon: 118.7969 },
    { id: "101040100", name: "重庆", lat: 29.5630, lon: 106.5516 },
    { id: "101250101", name: "长沙", lat: 28.2282, lon: 112.9388 },
    { id: "101120201", name: "青岛", lat: 36.0671, lon: 120.3826 }
  ];

  /* ---------- 本机原生后端地址 ----------
     ⚠️ 2026-09-05 清理：这个 8621 后端**从未真正提供过天气服务**。
     全项目只有 xingyu-app.pyw 提到 8621（NATIVE_PORT），而它里面并没有 /weather 实现；
     本机实际跑的是 server.py（8620），同样没有 weather 路由。
     => 旧代码每次加载天气都先发一个注定 CONNECTION_REFUSED 的请求，只在控制台留红字。
     且上游 weather.com.cn 的公开接口（/data/cityinfo/、/sk_2d/）现已返回 HTML 页面
     而非 JSON，即便补服务端代理也拿不到数据。
     故改为：GitHub Pages 静态天气（Actions 定时发布）→ Open-Meteo 兜底。
     常量保留仅为将来若真实现服务端代理时可复用。
  */
  var API = (function () {
    try { return location.protocol + "//" + location.hostname + ":8621"; }
    catch (e) { return "http://127.0.0.1:8621"; }
  })();

  /* GitHub Pages 直连地址：手机/远程原生后端不在线时，直接从 GitHub 拉取定时发布的天气 JSON */
  function ghBase() {
    try {
      if (/github\.io/i.test(location.hostname)) {
        return location.origin + location.pathname.replace(/[^/]*$/, "");
      }
    } catch (e) {}
    return "https://lele332.github.io/xingyu-platform/";
  }

  var currentCity = null;
  var MY_KEY = "zero_wx_my_city";
  var CACHE_TTL = 8 * 60 * 1000;
  var REQUEST_TIMEOUT_MS = 12000;

  /* ---------- WMO 天气代码 → emoji + 三语（Open-Meteo 兜底用） ---------- */
  var WMO = {
    0:  { e: "☀️", zh: "晴",         ht: "晴",         en: "Clear" },
    1:  { e: "🌤️", zh: "大部晴朗",   ht: "大致晴朗",   en: "Mostly clear" },
    2:  { e: "⛅", zh: "多云",       ht: "多雲",       en: "Partly cloudy" },
    3:  { e: "☁️", zh: "阴",         ht: "陰",         en: "Overcast" },
    45: { e: "🌫️", zh: "雾",         ht: "霧",         en: "Fog" },
    48: { e: "🌫️", zh: "冻雾",       ht: "凍霧",       en: "Rime fog" },
    51: { e: "🌦️", zh: "毛毛雨",     ht: "毛毛雨",     en: "Drizzle" },
    53: { e: "🌦️", zh: "毛毛雨",     ht: "毛毛雨",     en: "Drizzle" },
    55: { e: "🌦️", zh: "强毛毛雨",   ht: "強毛毛雨",   en: "Dense drizzle" },
    56: { e: "🌧️", zh: "冻毛毛雨",   ht: "凍毛毛雨",   en: "Freezing drizzle" },
    57: { e: "🌧️", zh: "强冻毛毛雨", ht: "強凍毛毛雨", en: "Freezing drizzle" },
    61: { e: "🌧️", zh: "小雨",       ht: "小雨",       en: "Light rain" },
    63: { e: "🌧️", zh: "中雨",       ht: "中雨",       en: "Rain" },
    65: { e: "🌧️", zh: "大雨",       ht: "大雨",       en: "Heavy rain" },
    66: { e: "🌧️", zh: "冻雨",       ht: "凍雨",       en: "Freezing rain" },
    67: { e: "🌧️", zh: "强冻雨",     ht: "強凍雨",     en: "Freezing rain" },
    71: { e: "❄️", zh: "小雪",       ht: "小雪",       en: "Light snow" },
    73: { e: "❄️", zh: "中雪",       ht: "中雪",       en: "Snow" },
    75: { e: "❄️", zh: "大雪",       ht: "大雪",       en: "Heavy snow" },
    77: { e: "❄️", zh: "雪粒",       ht: "雪粒",       en: "Snow grains" },
    80: { e: "🌦️", zh: "小阵雨",     ht: "小陣雨",     en: "Rain showers" },
    81: { e: "🌦️", zh: "阵雨",       ht: "陣雨",       en: "Rain showers" },
    82: { e: "⛈️", zh: "强阵雨",     ht: "強陣雨",     en: "Violent showers" },
    85: { e: "❄️", zh: "小阵雪",     ht: "小陣雪",     en: "Snow showers" },
    86: { e: "❄️", zh: "阵雪",       ht: "陣雪",       en: "Snow showers" },
    95: { e: "⛈️", zh: "雷阵雨",     ht: "雷陣雨",     en: "Thunderstorm" },
    96: { e: "⛈️", zh: "雷雨伴冰雹", ht: "雷雨伴冰雹", en: "Thunderstorm hail" },
    99: { e: "⛈️", zh: "雷雨伴冰雹", ht: "雷雨伴冰雹", en: "Thunderstorm hail" }
  };
  function wmo(code, lg) {
    var w = WMO[code] || { e: "🌡️", zh: "未知", ht: "未知", en: "Unknown" };
    return w.e + " " + (lg === "en" ? w.en : lg === "zh-Hant" ? w.ht : w.zh);
  }

  /* ---------- UI 文案（三语） ---------- */
  var TXT = {
    zh: {
      feels: "体感", humidity: "湿度", wind: "风速", pressure: "气压", vis: "能见度",
      aqi: "空气质量", updated: "更新于", forecast: "未来 7 天", today: "今天",
      searchPh: "搜索城市（如：长沙 / 丽江）", search: "搜索", refresh: "刷新",
      loading: "正在获取实时天气…", loadFail: "天气数据获取失败，请检查网络后重试",
      notFound: "未找到该城市，试试拼音或大城市名", now: "现在",
      myCity: "我的城市", setMyCity: "设为我的城市", high: "最高", low: "最低",
      tipsTitle: "今日提醒", lifeIndex: "生活指数", sunrise: "日出", sunset: "日落", alarm: "气象预警",
      realtimeSource: "数据来源：中国天气网", sourceMeteo: "数据来源：Open-Meteo（兜底）",
      windDir: "风向", windScale: "风力", rain: "降水",
      aqiGood: "优", aqiFine: "良", aqiLight: "轻度污染", aqiModerate: "中度污染",
      aqiHeavy: "重度污染", aqiSevere: "严重污染"
    },
    "zh-Hant": {
      feels: "體感", humidity: "濕度", wind: "風速", pressure: "氣壓", vis: "能見度",
      aqi: "空氣品質", updated: "更新於", forecast: "未來 7 天", today: "今天",
      searchPh: "搜索城市（如：長沙 / 麗江）", search: "搜索", refresh: "刷新",
      loading: "正在獲取實時天氣…", loadFail: "天氣數據獲取失敗，請檢查網絡後重試",
      notFound: "未找到該城市，試試拼音或大城市名", now: "現在",
      myCity: "我的城市", setMyCity: "設為我的城市", high: "最高", low: "最低",
      tipsTitle: "今日提醒", lifeIndex: "生活指數", sunrise: "日出", sunset: "日落", alarm: "氣象預警",
      realtimeSource: "資料來源：中國天氣網", sourceMeteo: "資料來源：Open-Meteo（兜底）",
      windDir: "風向", windScale: "風力", rain: "降水",
      aqiGood: "優", aqiFine: "良", aqiLight: "輕度污染", aqiModerate: "中度污染",
      aqiHeavy: "重度污染", aqiSevere: "嚴重污染"
    },
    en: {
      feels: "Feels like", humidity: "Humidity", wind: "Wind", pressure: "Pressure", vis: "Visibility",
      aqi: "Air quality", updated: "Updated", forecast: "Next 7 days", today: "Today",
      searchPh: "Search city", search: "Search", refresh: "Refresh",
      loading: "Fetching live weather…", loadFail: "Failed to load weather. Check your network.",
      notFound: "City not found. Try Pinyin or a major city.", now: "Now",
      myCity: "My City", setMyCity: "Set as my city", high: "High", low: "Low",
      tipsTitle: "Today's tips", lifeIndex: "Life index", sunrise: "Sunrise", sunset: "Sunset", alarm: "Weather alert",
      realtimeSource: "Source: China Weather", sourceMeteo: "Source: Open-Meteo (fallback)",
      windDir: "Wind dir", windScale: "Wind", rain: "Rain",
      aqiGood: "Good", aqiFine: "Moderate", aqiLight: "Light pollution", aqiModerate: "Moderate pollution",
      aqiHeavy: "Heavy pollution", aqiSevere: "Severe pollution"
    }
  };
  function lang() { return document.documentElement.dataset.lang || "zh"; }
  function txt(k) { return (TXT[lang()] || TXT.zh)[k] || k; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 我的城市（固定位置，长期不变） ---------- */
  function getMyCity() {
    try {
      var c = JSON.parse(localStorage.getItem(MY_KEY) || "null");
      if (c && c.name && (c.id || c.lat)) return c;
    } catch (e) {}
    return null;
  }
  function setMyCity(c) {
    if (!c) return;
    localStorage.setItem(MY_KEY, JSON.stringify({ id: c.id, name: c.name, lat: c.lat, lon: c.lon }));
  }

  async function fetchJson(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    try {
      var resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return await resp.json();
    } finally { clearTimeout(timer); }
  }

  /* ---------- 中国天气数据 ----------
     fetchChina（经 8621 原生后端）已移除：该路由从未实现，见上方 API 常量注释。
     城市搜索同理：/weather/search 也不存在，直接走 Open-Meteo 地理编码。
  */
  async function searchChina(name) {
    return await searchMeteo(name);
  }

  /* 直连 GitHub：读取 Actions 定时发布的 {cityid}.json */
  async function fetchChinaGit(city) {
    var u = ghBase() + "data/weather/" + encodeURIComponent(city.id) + ".json";
    var d = await fetchJson(u);
    if (!d || !d.realtime) throw new Error("bad git weather");
    return d;
  }

  /* ---------- Open-Meteo 兜底 ---------- */
  async function fetchMeteo(lat, lon) {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,pressure_msl,uv_index" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max" +
      "&timezone=Asia%2FShanghai&forecast_days=7";
    return await fetchJson(url);
  }
  async function searchMeteo(name) {
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) +
      "&count=1&language=" + (lang() === "en" ? "en" : "zh") + "&format=json";
    var d = await fetchJson(url);
    var r = d && d.results && d.results[0];
    if (!r) return null;
    return { id: "", name: r.name, lat: r.latitude, lon: r.longitude };
  }

  /* ---------- 空气质量分级 ---------- */
  function aqiInfo(aqi) {
    if (aqi == null || isNaN(aqi)) return { label: "—", cls: "na", color: "" };
    if (aqi <= 50)  return { label: txt("aqiGood"),     cls: "green",  color: "#2ecc71" };
    if (aqi <= 100) return { label: txt("aqiFine"),     cls: "yellow", color: "#f1c40f" };
    if (aqi <= 150) return { label: txt("aqiLight"),    cls: "orange", color: "#e67e22" };
    if (aqi <= 200) return { label: txt("aqiModerate"), cls: "red",    color: "#e74c3c" };
    if (aqi <= 300) return { label: txt("aqiHeavy"),    cls: "purple", color: "#9b59b6" };
    return { label: txt("aqiSevere"), cls: "maroon", color: "#7f1d1d" };
  }

  function fmtNow() {
    var locale = lang() === "en" ? "en-US" : lang() === "zh-Hant" ? "zh-TW" : "zh-CN";
    return new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- 生活指数图标 ---------- */
  var IDX_ICON = {
    ct: "👕", uv: "🧴", gm: "🤧", yd: "🏃", xc: "🚗", ls: "👗", ys: "☂️", fs: "🧴",
    ac: "❄️", tr: "🏖️", pl: "🌫️", cl: "🤸", dy: "🎣", ag: "😷", jt: "🚗", zs: "🥵"
  };

  /* ---------- 渲染：中国天气 ---------- */
  function renderChina(d, city) {
    var box = document.getElementById("weatherContent");
    if (!box) return;
    var rt = d.realtime;
    var my = getMyCity();
    var isMy = my && (my.id === city.id || my.name === city.name);
    var ai = aqiInfo(rt.aqi);
    var warns = d.alarm || [];
    var indices = d.indices || [];
    var fc = d.forecast || [];

    var hero =
      '<div class="weather-hero card">' +
        '<div class="w-left">' +
          '<div class="w-cityline">' +
            '<span class="w-city">' + esc(city.name) + '</span>' +
            (isMy ? '<span class="w-mybadge">' + txt("myCity") + '</span>' : '') +
            '<button class="w-myset' + (isMy ? " on" : "") + '" id="btnSetMyCity">' + (isMy ? "⭐ " + txt("myCity") : "📍 " + txt("setMyCity")) + '</button>' +
          '</div>' +
          '<div class="w-time">' + txt("now") + ' · ' + esc(rt.time || fmtNow()) + '</div>' +
          '<div class="w-temp">' + Math.round(rt.temp) + '<span>°C</span></div>' +
          '<div class="w-desc">' + rt.icon + ' ' + esc(rt.weather) + '</div>' +
          '<div class="w-range">' + (fc[0] ? txt("high") + ' ' + fc[0].high + '° / ' + txt("low") + ' ' + fc[0].low + '°' : '') + '</div>' +
        '</div>' +
        '<div class="w-right">' +
          (rt.aqi != null ? '<div class="w-stat w-aqi" style="--aqi:' + ai.color + '"><b>' + rt.aqi + '</b><span>' + txt("aqi") + ' · ' + ai.label + '</span></div>' : '') +
          (rt.humidity != null ? '<div class="w-stat"><b>' + rt.humidity + '%</b><span>' + txt("humidity") + '</span></div>' : '') +
          '<div class="w-stat"><b>' + esc(rt.wind_dir || "—") + '<small>' + esc(rt.wind_scale || "") + '</small></b><span>' + txt("wind") + '</span></div>' +
          (rt.pressure != null ? '<div class="w-stat"><b>' + Math.round(rt.pressure) + '</b><span>' + txt("pressure") + ' hPa</span></div>' : '') +
          (rt.visibility ? '<div class="w-stat"><b>' + esc(rt.visibility) + '</b><span>' + txt("vis") + '</span></div>' : '') +
          (rt.pm25 != null ? '<div class="w-stat"><b>' + rt.pm25 + '</b><span>PM2.5</span></div>' : '') +
        '</div>' +
      '</div>';

    var alarmHtml = '';
    if (warns.length) {
      var a = warns[0];
      var levelCls = (a.level || "").indexOf("红") >= 0 ? "red" : (a.level || "").indexOf("橙") >= 0 ? "orange" : (a.level || "").indexOf("黄") >= 0 ? "yellow" : "blue";
      alarmHtml =
        '<div class="card w-alarm ' + levelCls + '">' +
          '<div class="w-alarm-head">⚠️ ' + txt("alarm") + ' · <b>' + esc(a.type) + ' ' + esc(a.level) + '</b></div>' +
          '<div class="w-alarm-title">' + esc(a.title) + '</div>' +
          '<div class="w-alarm-detail">' + esc(a.detail) + '</div>' +
          '<div class="w-alarm-time">' + esc(a.time) + '</div>' +
        '</div>';
    }

    var idxHtml = '';
    if (indices.length) {
      idxHtml =
        '<div class="card w-indices">' +
          '<div class="card-head"><h3>🧭 ' + txt("lifeIndex") + '</h3></div>' +
          '<div class="w-idx-grid">' +
          indices.map(function (x) {
            return '<div class="w-idx" title="' + esc(x.desc) + '">' +
              '<span class="w-idx-ic">' + (IDX_ICON[x.key] || "•") + '</span>' +
              '<div class="w-idx-body"><span class="w-idx-name">' + esc(x.name) + '</span><span class="w-idx-hint">' + esc(x.hint) + '</span></div>' +
            '</div>';
          }).join("") +
          '</div>' +
        '</div>';
    }

    var fcHtml =
      '<div class="card w-forecast">' +
        '<div class="card-head"><h3>' + txt("forecast") + '</h3><span class="w-updated">' + txt("updated") + ' ' + esc(d.updated || fmtNow()) + '</span></div>' +
        '<div class="w-days">' +
        fc.map(function (f, i) {
          return '<div class="w-day' + (i === 0 ? " cur" : "") + '">' +
            '<div class="w-day-name">' + esc(f.day) + '</div>' +
            '<div class="w-day-icon">' + f.iconDay + '</div>' +
            '<div class="w-day-text">' + esc(f.textDay) + '</div>' +
            '<div class="w-day-temp"><b>' + f.high + '°</b><span>' + f.low + '°</span></div>' +
            '<div class="w-day-wind">' + esc(f.windDay || "") + ' ' + esc(f.windScaleDay || "") + '</div>' +
          '</div>';
        }).join("") +
        '</div>' +
      '</div>';

    var source = '<div class="w-source">' + txt("realtimeSource") + ' · ' + esc(fmtNow()) + '</div>';

    box.innerHTML = hero + alarmHtml + idxHtml + fcHtml + source;

    var setBtn = document.getElementById("btnSetMyCity");
    if (setBtn) setBtn.onclick = function () {
      setMyCity(city);
      var flag = document.createElement("span");
      flag.className = "w-mybadge";
      flag.textContent = txt("myCity");
      var line = document.querySelector(".w-cityline");
      if (line && !line.querySelector(".w-mybadge")) line.insertBefore(flag, line.querySelector(".w-myset"));
      setBtn.classList.add("on");
      setBtn.innerHTML = "⭐ " + txt("myCity");
      renderCities(city.name);
    };
  }

  /* ---------- 渲染：Open-Meteo 兜底 ---------- */
  function renderMeteo(data, city) {
    var box = document.getElementById("weatherContent");
    if (!box) return;
    var cur = data.current, daily = data.daily;
    var week = lang() === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["日", "一", "二", "三", "四", "五", "六"];
    var sunrise = daily.sunrise[0].slice(11, 16);
    var sunset = daily.sunset[0].slice(11, 16);
    var my = getMyCity();
    var isMy = my && (my.id === city.id || my.name === city.name);
    var wet = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : null;
    var uv = daily.uv_index_max ? daily.uv_index_max[0] : null;
    var tmax = Math.round(daily.temperature_2m_max[0]);
    var tmin = Math.round(daily.temperature_2m_min[0]);

    box.innerHTML =
      '<div class="weather-hero card">' +
        '<div class="w-left">' +
          '<div class="w-cityline">' +
            '<span class="w-city">' + esc(city.name) + '</span>' +
            (isMy ? '<span class="w-mybadge">' + txt("myCity") + '</span>' : '') +
            '<button class="w-myset' + (isMy ? " on" : "") + '" id="btnSetMyCity">' + (isMy ? "⭐ " + txt("myCity") : "📍 " + txt("setMyCity")) + '</button>' +
          '</div>' +
          '<div class="w-time">' + txt("now") + ' · ' + fmtNow() + '</div>' +
          '<div class="w-temp">' + Math.round(cur.temperature_2m) + '<span>°C</span></div>' +
          '<div class="w-desc">' + wmo(cur.weather_code, lang()) + '</div>' +
          '<div class="w-range">' + txt("high") + ' ' + tmax + '° / ' + txt("low") + ' ' + tmin + '°</div>' +
        '</div>' +
        '<div class="w-right">' +
          '<div class="w-stat"><b>' + Math.round(cur.apparent_temperature) + '°</b><span>' + txt("feels") + '</span></div>' +
          '<div class="w-stat"><b>' + cur.relative_humidity_2m + '%</b><span>' + txt("humidity") + '</span></div>' +
          '<div class="w-stat"><b>' + Math.round(cur.wind_speed_10m) + '<small>km/h</small></b><span>' + txt("wind") + '</span></div>' +
          '<div class="w-stat"><b>' + Math.round(cur.pressure_msl) + '</b><span>' + txt("pressure") + ' hPa</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="w-suntimes">' +
        '<span>☀ ' + txt("sunrise") + ' <b>' + sunrise + '</b></span>' +
        '<span>🌇 ' + txt("sunset") + ' <b>' + sunset + '</b></span>' +
        (wet != null ? '<span>🌧 ' + txt("rain") + ' <b>' + wet + '%</b></span>' : '') +
        (uv != null ? '<span>☀️ UV <b>' + uv + '</b></span>' : '') +
      '</div>' +
      '<div class="card w-forecast">' +
        '<div class="card-head"><h3>' + txt("forecast") + '</h3><span class="w-updated">' + txt("updated") + ' ' + fmtNow() + '</span></div>' +
        '<div class="w-days">' +
        daily.time.map(function (d, i) {
          var date = new Date(d + "T00:00:00");
          var label = i === 0 ? txt("today") : (lang() === "en" ? week[date.getDay()] : "周" + week[date.getDay()]);
          return '<div class="w-day' + (i === 0 ? " cur" : "") + '">' +
            '<div class="w-day-name">' + label + '</div>' +
            '<div class="w-day-icon">' + wmo(daily.weather_code[i], lang()).split(" ")[0] + '</div>' +
            '<div class="w-day-temp"><b>' + Math.round(daily.temperature_2m_max[i]) + '°</b><span>' + Math.round(daily.temperature_2m_min[i]) + '°</span></div>' +
          '</div>';
        }).join("") +
        '</div>' +
      '</div>' +
      '<div class="w-source">' + txt("sourceMeteo") + '</div>';

    var setBtn = document.getElementById("btnSetMyCity");
    if (setBtn) setBtn.onclick = function () {
      setMyCity(city);
      var line = document.querySelector(".w-cityline");
      var flag = document.createElement("span");
      flag.className = "w-mybadge";
      flag.textContent = txt("myCity");
      if (line && !line.querySelector(".w-mybadge")) line.insertBefore(flag, line.querySelector(".w-myset"));
      setBtn.classList.add("on");
      setBtn.innerHTML = "⭐ " + txt("myCity");
      renderCities(city.name);
    };
  }

  function renderCities(activeName) {
    var box = document.getElementById("weatherCities");
    if (!box) return;
    activeName = activeName || (currentCity ? currentCity.name : "");
    var my = getMyCity();
    var list = CITIES.slice();
    if (my && !list.some(function (c) { return c.name === my.name; })) list.unshift(my);
    box.innerHTML = list.map(function (c) {
      var isMy = my && c.name === my.name;
      return '<button class="chip' + (c.name === activeName ? " active" : "") + '" data-city="' + esc(c.name) + '">' +
        (isMy ? "⭐ " : "") + esc(c.name) + '</button>';
    }).join("");
    box.querySelectorAll("[data-city]").forEach(function (b) {
      b.onclick = function () {
        var c = list.find(function (x) { return x.name === b.dataset.city; });
        if (c) load(c, true);
      };
    });
  }

  /* ---------- 界面分发：经典 / Aurora（weather-aurora.js） ---------- */
  function renderDispatch(data, city) {
    try {
      if (window.WeatherAurora && localStorage.getItem("zero_wx_style") === "aurora") {
        window.WeatherAurora.render(data, city);
        return;
      }
    } catch (e) {}
    if (data.source === "china") renderChina(data, city);
    else renderMeteo(data, city);
  }

  /* ---------- 加载（优先中国天气，失败降级 Open-Meteo；带本地缓存） ---------- */
  async function load(city, force) {
    if (!city) return;
    currentCity = city;
    localStorage.setItem("zero_wx_city", city.name);
    var loading = document.getElementById("weatherLoading");
    var content = document.getElementById("weatherContent");
    if (loading) loading.style.display = "";
    if (content) content.style.display = "none";
    var cacheKey = "zero_wx_" + (city.id || city.name);

    try {
      var cached = localStorage.getItem(cacheKey);
      if (!force && cached) {
        var c = JSON.parse(cached);
        if (c && c.data && Date.now() - c.ts < CACHE_TTL) {
          renderDispatch(c.data, city);
          renderCities(city.name);
          if (loading) loading.style.display = "none";
          if (content) content.style.display = "";
          if (window.Anim) Anim.quoteIn(content);
          if (window.AnimeFX) AnimeFX.weatherReveal(content);
          return;
        }
      }
    } catch (e) {}

    try {
      var data, gitOk = false;
      // ① GitHub Pages 静态天气（Actions 定时发布，含实时/预警/生活指数/7天）
      //    ⚠️ gitOk 用 !!data 判定：旧写法只要不抛异常就置 true，
      //    GitHub 若返回空/残缺 JSON 会误判成功，后面 renderDispatch(undefined) 直接炸
      if (city.id) {
        try { data = await fetchChinaGit(city); gitOk = !!data; } catch (e) {}
      }
      // ② 兜底 Open-Meteo（需要经纬度）
      if (!gitOk) {
        if (city.lat != null && city.lon != null) {
          data = await fetchMeteo(city.lat, city.lon);
          data.source = "meteo";
        } else {
          throw new Error("天气数据不可用：无城市编码且缺少经纬度");
        }
      }
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data }));
      renderDispatch(data, city);
      renderCities(city.name);
      if (loading) loading.style.display = "none";
      if (content) content.style.display = "";
      if (window.Anim) Anim.quoteIn(content);
      if (window.AnimeFX) AnimeFX.weatherReveal(content);
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (content) {
        content.style.display = "";
        try {
          var stale = JSON.parse(localStorage.getItem(cacheKey) || "null");
          if (stale && stale.data) {
            renderDispatch(stale.data, city);
            renderCities(city.name);
            content.insertAdjacentHTML("afterbegin", '<div class="weather-stale">' + txt("loadFail") + ' · 已显示缓存数据</div>');
            return;
          }
        } catch (ignore) {}
        content.innerHTML = '<div class="empty-state"><p>' + txt("loadFail") + '</p></div>';
      }
    }
  }

  async function doSearch() {
    var input = document.getElementById("weatherCityInput");
    var name = (input.value || "").trim();
    if (!name) return;
    var loading = document.getElementById("weatherLoading");
    var content = document.getElementById("weatherContent");
    if (loading) loading.style.display = "";
    if (content) content.style.display = "none";
    try {
      var found = null;
      try {
        var res = await searchChina(name);
        if (res && res.length) found = { id: res[0].id, name: res[0].name, lat: null, lon: null };
      } catch (e) {}
      if (!found) found = await searchMeteo(name);
      if (!found) {
        if (loading) loading.style.display = "none";
        if (content) { content.style.display = ""; content.innerHTML = '<div class="empty-state"><p>' + txt("notFound") + '</p></div>'; }
        return;
      }
      await load(found, true);
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (content) { content.style.display = ""; content.innerHTML = '<div class="empty-state"><p>' + txt("loadFail") + '</p></div>'; }
    }
  }

  function init() {
    var btn = document.getElementById("btnWeatherSearch");
    if (btn) btn.onclick = doSearch;
    var inp = document.getElementById("weatherCityInput");
    if (inp) inp.onkeydown = function (e) { if (e.key === "Enter") doSearch(); };
    var ref = document.getElementById("btnWeatherRefresh");
    if (ref) ref.onclick = function () { if (currentCity) load(currentCity, true); };
    var myCity = getMyCity();
    var saved = localStorage.getItem("zero_wx_city");
    var city = myCity || (CITIES.find(function (c) { return c.name === saved; }) || CITIES[0]);
    load(city);
  }

  window.Weather = {
    init: init,
    load: load,
    refresh: function () { if (currentCity) load(currentCity, true); },
    reRender: function () {
      if (!currentCity) return;
      var cached = localStorage.getItem("zero_wx_" + (currentCity.id || currentCity.name));
      if (!cached) return;
      try {
        var c = JSON.parse(cached);
        if (c && c.data) {
          renderDispatch(c.data, currentCity);
          renderCities(currentCity.name);
        }
      } catch (e) {}
    },
    renderCities: renderCities,
    currentCity: function () { return currentCity; },
    searchCity: searchChina
  };
})();



