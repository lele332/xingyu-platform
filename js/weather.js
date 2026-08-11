/* ============================================================
   weather.js — 实时天气（数据源：Open-Meteo，免费 · 无需 key · 支持 CORS）
   提供：当前城市实时天气 + 未来 7 天预报 + 城市搜索/切换 + 10 分钟本地缓存
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 常用城市 ---------- */
  var CITIES = [
    { name: "北京", lat: 39.9075, lon: 116.3972 },
    { name: "上海", lat: 31.2304, lon: 121.4737 },
    { name: "广州", lat: 23.1291, lon: 113.2644 },
    { name: "深圳", lat: 22.5431, lon: 114.0579 },
    { name: "杭州", lat: 30.2741, lon: 120.1551 },
    { name: "成都", lat: 30.5728, lon: 104.0668 },
    { name: "武汉", lat: 30.5928, lon: 114.3055 },
    { name: "西安", lat: 34.3416, lon: 108.9398 },
    { name: "南京", lat: 32.0603, lon: 118.7969 },
    { name: "重庆", lat: 29.5630, lon: 106.5516 },
    { name: "长沙", lat: 28.2282, lon: 112.9388 },
    { name: "青岛", lat: 36.0671, lon: 120.3826 }
  ];

  /* ---------- WMO 天气代码 → emoji + 三语描述 ---------- */
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

  function wmo(code, lang) {
    var w = WMO[code] || { e: "🌡️", zh: "未知", ht: "未知", en: "Unknown" };
    return w.e + " " + (lang === "en" ? w.en : lang === "zh-Hant" ? w.ht : w.zh);
  }

  /* ---------- UI 文案（三语） ---------- */
  var TXT = {
    zh:       { feels: "体感", humidity: "湿度", wind: "风速", pressure: "气压", sunrise: "日出", sunset: "日落", updated: "更新于", forecast: "未来 7 天", today: "今天", searchPh: "搜索城市（如：上海）", search: "搜索", refresh: "刷新", loading: "正在获取实时天气…", loadFail: "天气数据获取失败，请检查网络后重试", notFound: "未找到该城市，试试拼音或大城市名", now: "现在" },
    "zh-Hant": { feels: "體感", humidity: "濕度", wind: "風速", pressure: "氣壓", sunrise: "日出", sunset: "日落", updated: "更新於", forecast: "未來 7 天", today: "今天", searchPh: "搜索城市（如：上海）", search: "搜索", refresh: "刷新", loading: "正在獲取實時天氣…", loadFail: "天氣數據獲取失敗，請檢查網絡後重試", notFound: "未找到該城市，試試拼音或大城市名", now: "現在" },
    en:       { feels: "Feels like", humidity: "Humidity", wind: "Wind", pressure: "Pressure", sunrise: "Sunrise", sunset: "Sunset", updated: "Updated", forecast: "Next 7 days", today: "Today", searchPh: "Search city", search: "Search", refresh: "Refresh", loading: "Fetching live weather…", loadFail: "Failed to load weather. Check your network.", notFound: "City not found. Try Pinyin or a major city.", now: "Now" }
  };
  function lang() { return document.documentElement.dataset.lang || "zh"; }
  function txt(k) { return (TXT[lang()] || TXT.zh)[k] || k; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var currentCity = null;
  var REQUEST_TIMEOUT_MS = 12000;

  /* ---------- 数据获取 ---------- */
  async function fetchJson(url) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    try {
      var resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchWeather(lat, lon) {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,pressure_msl" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset" +
      "&timezone=Asia%2FShanghai&forecast_days=7";
    return await fetchJson(url);
  }

  async function searchCity(name) {
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) +
      "&count=1&language=" + (lang() === "en" ? "en" : "zh") + "&format=json";
    var d = await fetchJson(url);
    var r = d && d.results && d.results[0];
    if (!r) return null;
    return { name: r.name, lat: r.latitude, lon: r.longitude };
  }

  /* ---------- 渲染 ---------- */
  function fmtNow() {
    var locale = lang() === "en" ? "en-US" : lang() === "zh-Hant" ? "zh-TW" : "zh-CN";
    return new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  function render(data, city) {
    var box = document.getElementById("weatherContent");
    if (!box) return;
    var cur = data.current;
    var daily = data.daily;
    var week = lang() === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["日", "一", "二", "三", "四", "五", "六"];
    var sunrise = daily.sunrise[0].slice(11, 16);
    var sunset = daily.sunset[0].slice(11, 16);
    box.innerHTML =
      '<div class="weather-hero card">' +
        '<div class="w-left">' +
          '<div class="w-city">' + esc(city.name) + '</div>' +
          '<div class="w-time">' + txt("now") + ' · ' + fmtNow() + '</div>' +
          '<div class="w-temp">' + Math.round(cur.temperature_2m) + '<span>°C</span></div>' +
          '<div class="w-desc">' + wmo(cur.weather_code, lang()) + '</div>' +
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
      '</div>';
  }

  function renderCities(activeName) {
    var box = document.getElementById("weatherCities");
    if (!box) return;
    activeName = activeName || (currentCity ? currentCity.name : "");
    box.innerHTML = CITIES.map(function (c) {
      return '<button class="chip' + (c.name === activeName ? " active" : "") + '" data-city="' + esc(c.name) + '">' + esc(c.name) + '</button>';
    }).join("");
    box.querySelectorAll("[data-city]").forEach(function (b) {
      b.onclick = function () {
        var c = CITIES.find(function (x) { return x.name === b.dataset.city; });
        if (c) load(c, true);
      };
    });
  }

  /* ---------- 加载（带 10 分钟本地缓存） ---------- */
  async function load(city, force) {
    if (!city) return;
    currentCity = city;
    localStorage.setItem("zero_wx_city", city.name);
    var loading = document.getElementById("weatherLoading");
    var content = document.getElementById("weatherContent");
    if (loading) loading.style.display = "";
    if (content) content.style.display = "none";
    var cacheKey = "zero_wx_" + city.name;
    try {
      var cached = localStorage.getItem(cacheKey);
      if (!force && cached) {
        var c = JSON.parse(cached);
        if (c && c.data && Date.now() - c.ts < 600000) {
          render(c.data, city);
          renderCities(city.name);
          if (loading) loading.style.display = "none";
          if (content) content.style.display = "";
          if (window.Anim) Anim.quoteIn(content);
          return;
        }
      }
    } catch (e) { /* 缓存损坏则忽略 */ }
    try {
      var data = await fetchWeather(city.lat, city.lon);
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data }));
      render(data, city);
      renderCities(city.name);
      if (loading) loading.style.display = "none";
      if (content) content.style.display = "";
      if (window.Anim) Anim.quoteIn(content);
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (content) {
        content.style.display = "";
        try {
          var stale = JSON.parse(localStorage.getItem(cacheKey) || "null");
          if (stale && stale.data) {
            render(stale.data, city);
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
      var city = await searchCity(name);
      if (!city) {
        if (loading) loading.style.display = "none";
        if (content) {
          content.style.display = "";
          content.innerHTML = '<div class="empty-state"><p>' + txt("notFound") + '</p></div>';
        }
        return;
      }
      await load(city, true);
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (content) {
        content.style.display = "";
        content.innerHTML = '<div class="empty-state"><p>' + txt("loadFail") + '</p></div>';
      }
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var btn = document.getElementById("btnWeatherSearch");
    if (btn) btn.onclick = doSearch;
    var inp = document.getElementById("weatherCityInput");
    if (inp) inp.onkeydown = function (e) { if (e.key === "Enter") doSearch(); };
    var ref = document.getElementById("btnWeatherRefresh");
    if (ref) ref.onclick = function () { if (currentCity) load(currentCity, true); };
    // 默认城市：上次选择 or 北京
    var saved = localStorage.getItem("zero_wx_city");
    var city = CITIES.find(function (c) { return c.name === saved; }) || CITIES[0];
    load(city);
  }

  window.Weather = {
    init: init,
    load: load,
    refresh: function () { if (currentCity) load(currentCity, true); },
    reRender: function () {
      // 用缓存数据按当前语言重渲染（语言切换用，不重新请求）
      if (!currentCity) return;
      var cached = localStorage.getItem("zero_wx_" + currentCity.name);
      if (!cached) return;
      try {
        var c = JSON.parse(cached);
        if (c && c.data) { render(c.data, currentCity); renderCities(currentCity.name); }
      } catch (e) {}
    },
    renderCities: renderCities,
    searchCity: searchCity
  };
})();
