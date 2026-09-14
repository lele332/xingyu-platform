/* ============================================================
   weather.js v2.1 · 星屿天气工作台（2026-09-14 重塑 + 健壮性修复）
   设计语言：Apple HIG 深色玻璃（灵感归档见 HAN 16.1：
   hoverstat.es 微交互 / footer.design 结构化页脚 / reeoo.com
   色彩情绪 / collectui.com 部件密度，统一 iOS 化收编）
   核心理念：不做手机天气的复制品——手机给「现在什么天」，
   这里给「接下来怎么决策 + 大气怎么运作」。
   数据源：Open-Meteo（forecast / air-quality / archive），本地缓存优先。
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 预置城市 ---------------- */
  const CITIES = [
    { id: "101250101", name: "长沙", lat: 28.2282, lon: 112.9382 },
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
    { id: "101120201", name: "青岛", lat: 36.0671, lon: 120.3826 }
  ];

  /* ---------------- WMO 天气码 ---------------- */
  const WMO = {
    0: ["☀️", "晴", "Clear"], 1: ["🌤️", "大部晴朗", "Mostly clear"], 2: ["⛅", "多云", "Partly cloudy"], 3: ["☁️", "阴", "Overcast"],
    45: ["🌫️", "雾", "Fog"], 48: ["🌫️", "冻雾", "Rime fog"],
    51: ["🌦️", "毛毛雨", "Drizzle"], 53: ["🌦️", "毛毛雨", "Drizzle"], 55: ["🌧️", "浓毛毛雨", "Dense drizzle"],
    56: ["🌧️", "冻毛毛雨", "Freezing drizzle"], 57: ["🌧️", "强冻毛毛雨", "Freezing drizzle"],
    61: ["🌧️", "小雨", "Light rain"], 63: ["🌧️", "中雨", "Rain"], 65: ["🌧️", "大雨", "Heavy rain"],
    66: ["🌧️", "冻雨", "Freezing rain"], 67: ["🌧️", "强冻雨", "Freezing rain"],
    71: ["❄️", "小雪", "Light snow"], 73: ["❄️", "中雪", "Snow"], 75: ["❄️", "大雪", "Heavy snow"], 77: ["❄️", "雪粒", "Snow grains"],
    80: ["🌦️", "小阵雨", "Showers"], 81: ["🌦️", "阵雨", "Showers"], 82: ["⛈️", "强阵雨", "Violent showers"],
    85: ["🌨️", "阵雪", "Snow showers"], 86: ["🌨️", "阵雪", "Snow showers"],
    95: ["⛈️", "雷阵雨", "Thunderstorm"], 96: ["⛈️", "雷雨伴冰雹", "T-storm hail"], 99: ["⛈️", "雷雨伴冰雹", "T-storm hail"]
  };

  const TXT = {
    zh: {
      searchPh: "搜索城市（如：长沙 / Shanghai）", notFound: "未找到该城市", loadFail: "天气数据获取失败",
      myCity: "我的城市", setMyCity: "设为我的城市", feels: "体感", high: "高", low: "低",
      nowcast: "降水临近预报 · 未来 6 小时", nowcastDry: "未来 6 小时无降水", nowcastNone: "分钟级数据暂不可用",
      advisories: "今日决策", hourly: "24 小时趋势", forecast: "7 天预测", compare: "多城市对比",
      aqi: "空气质量", alerts: "风险提示", noAlerts: "当前没有明显天气风险",
      atmosphere: "大气剖面 · 专业视角", astro: "天文 · 日月", lastyear: "往年同期", updated: "更新于",
      source: "数据 Open-Meteo", localCache: "本地缓存优先", cape: "CAPE 对流能量", blh: "边界层高度", freezing: "冻结层高度",
      shear: "高空风切变 10/80/120m", dewpoint: "露点", vis: "能见度", soil: "土壤 6cm", soilmoist: "土壤湿度",
      daylight: "昼长", sunshine: "日照", moon: "月相", golden: "黄金时刻", blue: "蓝调时刻",
      sunrise: "日出", sunset: "日落", uvmax: "最大紫外线", precipSum: "降水量", precipHours: "降水时数",
      gust: "阵风", humidity: "湿度", wind: "风速", pressure: "气压", cloud: "云量", uv: "紫外线",
      vsLastYear: "较去年同期", footerNote: "星屿天气工作台 · 手机给天气，这里给决策"
    },
    en: {
      searchPh: "Search city (e.g. Shanghai)", notFound: "City not found", loadFail: "Failed to load weather",
      myCity: "My city", setMyCity: "Set as my city", feels: "Feels", high: "H", low: "L",
      nowcast: "Rain nowcast · next 6h", nowcastDry: "No rain in the next 6 hours", nowcastNone: "Minutely data unavailable",
      advisories: "Today's calls", hourly: "24h trend", forecast: "7-day forecast", compare: "City compare",
      aqi: "Air quality", alerts: "Risk notes", noAlerts: "No notable weather risks",
      atmosphere: "Atmosphere · pro view", astro: "Sky & moon", lastyear: "This week last year", updated: "Updated",
      source: "Data Open-Meteo", localCache: "local-first", cape: "CAPE", blh: "Boundary layer", freezing: "Freezing level",
      shear: "Wind shear 10/80/120m", dewpoint: "Dew point", vis: "Visibility", soil: "Soil 6cm", soilmoist: "Soil moisture",
      daylight: "Daylight", sunshine: "Sunshine", moon: "Moon", golden: "Golden hour", blue: "Blue hour",
      sunrise: "Sunrise", sunset: "Sunset", uvmax: "Max UV", precipSum: "Precip", precipHours: "Precip hours",
      gust: "Gusts", humidity: "Humidity", wind: "Wind", pressure: "Pressure", cloud: "Cloud", uv: "UV",
      vsLastYear: "vs last year", footerNote: "Xingyu Weather · phones tell weather, we tell decisions"
    }
  };

  /* ---------------- 状态 ---------------- */
  let currentCity = null;
  let compareData = new Map();
  let painted = false;          // 是否已成功渲染过（看门狗判据）
  let lastLoadAt = 0;           // 最近一次 load() 起始时间
  let loadToken = 0;            // 竞态守卫：只有最新一次 load 允许触发看门狗
  const WX_VERSION = "20260914.2";
  const MY_KEY = "zero_wx_my_city";
  const COMPARE_KEY = "zero_wx_compare_v1";
  const CACHE_TTL = 8 * 60 * 1000;
  const TIMEOUT_MS = 10000;

  /* ---------------- 工具 ---------------- */
  function lang() { return document.documentElement.dataset.lang || "zh"; }
  function txt(k) { return (TXT[lang()] || TXT.zh)[k] || (TXT.zh[k] || k); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function num(v, f = 0) { return Number.isFinite(v) ? v.toFixed(f) : "—"; }
  function locale() { return lang() === "en" ? "en-US" : "zh-CN"; }
  function fmtTime(v) { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? String(v).slice(11, 16) : d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false }); }
  function dayName(v, idx) { const d = new Date(v); if (isNaN(d)) return "—"; if (idx === 0) return lang() === "en" ? "Today" : "今天"; return d.toLocaleDateString(locale(), { weekday: "short" }); }
  function compass(deg) { if (!Number.isFinite(deg)) return "—"; const a = ["北", "NNE", "东北", "ENE", "东", "ESE", "东南", "SSE", "南", "SSW", "西南", "WSW", "西", "WNW", "西北", "NNW"]; return lang() === "en" ? ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round((deg % 360) / 22.5) % 16] : a[Math.round((deg % 360) / 22.5) % 16]; }
  function wmo(code) { const w = WMO[code] || ["🌡️", "未知", "Unknown"]; return lang() === "en" ? w[2] : w[1]; }
  function wmoIcon(code) { return (WMO[code] || ["🌡️"])[0]; }
  function hhmm(v) { return String(v || "").length >= 16 ? String(v).slice(11, 16) : "—"; }

  /* 月相：以 2000-01-06 18:14 UTC 新月为基准的月龄 → 8 相 */
  function moonInfo(date) {
    const synodic = 29.530588853;
    const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
    const now = date.getTime() / 86400000;
    let age = ((now - ref) % synodic + synodic) % synodic;
    const phases = [
      [0.0, "🌑", "新月", "New moon"], [0.125, "🌒", "蛾眉月", "Waxing crescent"],
      [0.25, "🌓", "上弦月", "First quarter"], [0.375, "🌔", "盈凸月", "Waxing gibbous"],
      [0.5, "🌕", "满月", "Full moon"], [0.625, "🌖", "亏凸月", "Waning gibbous"],
      [0.75, "🌗", "下弦月", "Last quarter"], [0.875, "🌘", "残月", "Waning crescent"]
    ];
    const f = age / synodic;
    let best = phases[0];
    for (const p of phases) { if (Math.abs(p[0] - f) < Math.abs(best[0] - f)) best = p; }
    const illum = Math.round((1 - Math.cos(2 * Math.PI * f)) / 2 * 100);
    return { icon: best[1], name: lang() === "en" ? best[3] : best[2], illum, age: Math.round(age) };
  }

  /* ---- 2026-09-14 健壮性修复 ----------------------------------------
     旧版 getMyCity() 只校验 name，load() 只用 Number.isNaN 挡坐标。
     localStorage 里遗留的旧结构（{name, latitude, longitude}、坐标为 null 或字符串）
     会让 load() 要么静默 return（loading 永不消失），要么拼出 latitude=undefined
     的请求被 Open-Meteo 打回 400。这里统一用 okCity()/normCity() 收口。 */
  function okCity(c) {
    return !!(c && typeof c.name === "string" && c.name.trim()
      && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lon))
      && Math.abs(Number(c.lat)) <= 90 && Math.abs(Number(c.lon)) <= 180);
  }
  function normCity(c) {
    if (!c || typeof c !== "object" || !c.name) return null;
    const lat = Number(c.lat != null ? c.lat : c.latitude);
    const lon = Number(c.lon != null ? c.lon : (c.longitude != null ? c.longitude : c.lng));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { id: c.id != null ? String(c.id) : String(c.name), name: String(c.name).trim(), lat, lon };
  }
  function getMyCity() {
    try {
      const raw = localStorage.getItem(MY_KEY);
      const c = normCity(JSON.parse(raw || "null"));
      if (c && okCity(c)) return c;
      if (raw) {                        // 存了但结构不对 -> 清掉，别每次启动都踩
        report("my_city_invalid", { raw: String(raw).slice(0, 200) });
        localStorage.removeItem(MY_KEY);
      }
    } catch {}
    return null;
  }
  function setMyCity(c) { try { localStorage.setItem(MY_KEY, JSON.stringify(c)); } catch {} }
  function getCompareCities() {
    try {
      const a = JSON.parse(localStorage.getItem(COMPARE_KEY) || "null");
      if (Array.isArray(a) && a.length) {
        const good = a.map(normCity).filter(okCity);   // 过滤旧结构，杜绝 latitude=undefined
        if (good.length) return good.slice(0, 6);
      }
    } catch {}
    return CITIES.slice(0, 4);
  }
  /* 兜底城市：任何异常都不允许让界面停在 loading */
  function fallbackCity() {
    let saved = null;
    try { saved = localStorage.getItem("zero_wx_city"); } catch {}
    return CITIES.find(c => c.name === saved) || CITIES[0];
  }
  function resolveCity(c) { const n = normCity(c); return okCity(n) ? n : fallbackCity(); }

  /* ---------------- 诊断上报（真机现场留证，落盘 data/diag.log） ---------------- */
  const diagLog = [];
  function report(msg, detail) {
    const rec = { mod: "weather", v: WX_VERSION, msg: String(msg), ts: new Date().toISOString(), detail: detail || null };
    diagLog.push(rec); if (diagLog.length > 40) diagLog.shift();
    try {
      if (/^https?:$/.test(location.protocol)) {
        fetch("/api/diag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mod: "weather", v: WX_VERSION, msg: String(msg), detail: detail || null, city: (currentCity && currentCity.name) || null })
        }).catch(() => {});
      }
    } catch {}
  }
  function saveCompareCities(a) { try { localStorage.setItem(COMPARE_KEY, JSON.stringify(a.slice(0, 6))); } catch {} }
  function cacheKey(city) { return "zero_wx_" + (city.id || city.name) + "_v3"; }
  function readCache(city, maxAge = CACHE_TTL) {
    try { const o = JSON.parse(localStorage.getItem(cacheKey(city)) || "null"); if (o && (maxAge <= 0 || Date.now() - o.ts < maxAge)) return o; } catch {}
    return null;
  }

  /* ---------------- 数据获取 ---------------- */
  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try { const r = await fetch(url, { signal: controller.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    finally { clearTimeout(timer); }
  }

  async function fetchMeteo(lat, lon) {
    const base = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon;
    const url = base +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index" +
      "&minutely_15=precipitation&forecast_minutely_15=24" +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,relative_humidity_2m,dew_point_2m,visibility,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_direction_10m,cape,boundary_layer_height,freezing_level_height,soil_temperature_6cm,soil_moisture_3_9cm,uv_index" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant" +
      "&timezone=auto&forecast_days=7";
    return await fetchJson(url);
  }

  async function fetchAir(lat, lon) {
    const url = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + lat + "&longitude=" + lon +
      "&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&timezone=auto";
    const d = await fetchJson(url);
    return d && d.current ? d.current : null;
  }

  /* 往年同期：去年今天前后各 3 天的日均高/低温 */
  async function fetchLastYear(lat, lon) {
    const now = new Date();
    const y = now.getFullYear() - 1;
    const mk = dt => {
      const d = new Date(dt); d.setFullYear(y);
      return d.toISOString().slice(0, 10);
    };
    const start = mk(new Date(now.getTime() - 3 * 86400000));
    const end = mk(new Date(now.getTime() + 3 * 86400000));
    const url = "https://archive-api.open-meteo.com/v1/archive?latitude=" + lat + "&longitude=" + lon +
      "&start_date=" + start + "&end_date=" + end + "&daily=temperature_2m_max,temperature_2m_min&timezone=auto";
    const d = await fetchJson(url);
    const tmax = (d.daily?.temperature_2m_max || []).filter(Number.isFinite);
    const tmin = (d.daily?.temperature_2m_min || []).filter(Number.isFinite);
    if (!tmax.length) return null;
    return {
      tmax: tmax.reduce((a, b) => a + b, 0) / tmax.length,
      tmin: tmin.reduce((a, b) => a + b, 0) / tmin.length
    };
  }

  async function searchMeteo(name) {
    const url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=1&language=" + (lang() === "en" ? "en" : "zh") + "&format=json";
    const d = await fetchJson(url);
    const g = d.results && d.results[0];
    return g ? { id: String(g.id), name: g.name, lat: g.latitude, lon: g.longitude } : null;
  }

  /* ---------------- 决策引擎（今天的「怎么办」） ---------------- */
  function deriveAdvisories(data, air) {
    const cur = data.current || {}, daily = data.daily || {}, hourly = data.hourly || {};
    const pops = daily.precipitation_probability_max || [];
    const popToday = pops[0];
    const nowIdx = hourlyHourIndex(data);
    const vis = nowIdx != null ? (hourly.visibility || [])[nowIdx] : null;
    const aqi = air && Number.isFinite(air.us_aqi) ? air.us_aqi : null;
    const out = [];

    if ((popToday != null && popToday >= 40) || (cur.precipitation || 0) > 0.1)
      out.push(["☂️", lang() === "en" ? "Umbrella" : "带伞", lang() === "en" ? popToday + "% rain chance" : "降水概率 " + popToday + "%，出门带伞"]);
    else if (popToday != null && popToday <= 15)
      out.push(["☂️", lang() === "en" ? "No umbrella" : "免伞", lang() === "en" ? "Only " + popToday + "% rain chance" : "降水概率仅 " + popToday + "%，可空手出门"]);

    const at = cur.apparent_temperature;
    if (Number.isFinite(at)) {
      if (at >= 32) out.push(["🥵", lang() === "en" ? "Heat" : "防暑", lang() === "en" ? "Feels " + at.toFixed(0) + "°" : "体感 " + at.toFixed(0) + "°，避开午后暴晒、多补水"]);
      else if (at >= 24) out.push(["👕", lang() === "en" ? "Light wear" : "穿薄点", lang() === "en" ? "Feels " + at.toFixed(0) + "°" : "体感 " + at.toFixed(0) + "°，短袖正好"]);
      else if (at >= 12) out.push(["🧥", lang() === "en" ? "Layer up" : "加外套", lang() === "en" ? "Feels " + at.toFixed(0) + "°" : "体感 " + at.toFixed(0) + "°，薄外套合适"]);
      else out.push(["🧣", lang() === "en" ? "Cold" : "保暖", lang() === "en" ? "Feels " + at.toFixed(0) + "°" : "体感 " + at.toFixed(0) + "°，厚外套围巾"]);
    }

    const uv = cur.uv_index;
    if (Number.isFinite(uv)) {
      if (uv >= 6) out.push(["🧴", lang() === "en" ? "Sunscreen" : "防晒", "UV " + uv.toFixed(0) + "，" + (lang() === "en" ? "SPF50 & hat advised" : "建议 SPF50+ / 遮阳帽")]);
      else if (uv >= 3) out.push(["🧴", lang() === "en" ? "Mild UV" : "弱防晒", "UV " + uv.toFixed(0) + "，" + (lang() === "en" ? "light protection" : "长时间户外涂一点")]);
    }

    const dryHours = countDryHours(data, 12);
    const cloud = cur.cloud_cover;
    if (Number.isFinite(cloud) && popToday != null)
      out.push(["🧺", lang() === "en" ? "Laundry" : "晾晒", (dryHours >= 10 && cloud <= 60) ? (lang() === "en" ? "Good window: ~" + dryHours + "h dry" : "未来 " + dryHours + " 小时基本无雨，适合晾晒") : (lang() === "en" ? "Poor drying day" : "不宜晾晒，雨/云偏多")]);

    const washPop = Math.max(...(pops.slice(0, 2).filter(Number.isFinite), [0]));
    if (Number.isFinite(popToday)) {
      const next48 = Math.max(popToday, pops[1] || 0);
      out.push(["🚗", lang() === "en" ? "Car wash" : "洗车", next48 >= 40 ? (lang() === "en" ? "Rain likely (" + next48 + "%), skip" : "近两天降水概率 " + next48 + "%，先别洗") : (lang() === "en" ? "Fine to wash" : "适合洗车")]);
    }

    const runOk = Number.isFinite(at) && at < 32 && (popToday == null || popToday < 50) && (aqi == null || aqi < 100);
    out.push(["🏃", lang() === "en" ? "Run" : "运动", runOk ? (lang() === "en" ? "Good conditions now" : "现在适合户外运动") : (lang() === "en" ? "Indoor better today" : "今天建议室内训练")]);

    if (Number.isFinite(vis) && vis < 2000)
      out.push(["🌫️", lang() === "en" ? "Fog" : "低能见度", (lang() === "en" ? "Visibility " + (vis / 1000).toFixed(1) + " km — extra commute time" : "能见度 " + (vis / 1000).toFixed(1) + " km，通勤多留时间")]);

    const gust = cur.wind_gusts_10m;
    if (Number.isFinite(gust) && gust >= 45)
      out.push(["💨", lang() === "en" ? "Wind" : "大风", (lang() === "en" ? "Gusts " + gust.toFixed(0) + " km/h" : "阵风 " + gust.toFixed(0) + " km/h，高空作业/骑行注意")]);

    if (aqi != null && aqi >= 100)
      out.push(["😷", lang() === "en" ? "Air" : "空气", "AQI " + aqi.toFixed(0) + "，" + (lang() === "en" ? "mask for sensitive groups" : "敏感人群建议戴口罩")]);

    return out;
  }

  function hourlyHourIndex(data) {
    const t = data.hourly?.time || [];
    if (!t.length) return null;
    const nowIso = new Date().toISOString().slice(0, 13);
    let idx = t.findIndex(x => x.slice(0, 13) === nowIso);
    if (idx < 0) idx = Math.max(0, t.findIndex(x => new Date(x) >= new Date()));
    return Math.max(0, idx);
  }

  function countDryHours(data, span) {
    const idx = hourlyHourIndex(data);
    const pp = data.hourly?.precipitation_probability || [];
    if (idx == null || !pp.length) return 0;
    let n = 0;
    for (let i = idx; i < Math.min(idx + span, pp.length); i++) { if ((pp[i] ?? 0) < 30) n++; else break; }
    return n;
  }

  /* 分钟级降水摘要 */
  function nowcastSummary(data) {
    const m = data.minutely_15;
    if (!m || !Array.isArray(m.time) || !m.time.length) return null;
    const pre = m.precipitation || [];
    const fmt = iso => iso.slice(11, 16);
    let startIdx = -1, endIdx = -1, total = 0;
    for (let i = 0; i < pre.length; i++) {
      if (Number.isFinite(pre[i]) && pre[i] > 0.05) { if (startIdx < 0) startIdx = i; endIdx = i; total += pre[i]; }
    }
    if (startIdx < 0) return { dry: true, text: txt("nowcastDry") };
    return {
      dry: false,
      start: fmt(m.time[startIdx]), end: fmt(m.time[endIdx]),
      total,
      text: (lang() === "en"
        ? "Rain ~" + fmt(m.time[startIdx]) + "–" + fmt(m.time[endIdx]) + " (" + total.toFixed(1) + " mm)"
        : "预计 " + fmt(m.time[startIdx]) + " 前后开始降水，" + fmt(m.time[endIdx]) + " 前后结束（合计约 " + total.toFixed(1) + " mm）")
    };
  }

  /* ---------------- 图表（SVG） ---------------- */
  function hourlyChart(data) {
    const H = data.hourly || {};
    const t = H.time || [], temps = H.temperature_2m || [], pops = H.precipitation_probability || [];
    const idx = hourlyHourIndex(data);
    if (!t.length || idx == null) return "";
    const N = 24, codes = H.weather_code || [];
    const xs = [], ys = [];
    for (let i = 0; i < N; i++) { xs.push(t[idx + i]); ys.push(temps[idx + i]); }
    const W = 980, HH = 190, padL = 34, padR = 34, padT = 26, padB = 44;
    const fin = ys.filter(Number.isFinite);
    if (fin.length < 4) return "";
    let min = Math.min(...fin), max = Math.max(...fin);
    if (max - min < 4) { const mid = (max + min) / 2; min = mid - 2; max = mid + 2; }
    const X = i => padL + i * (W - padL - padR) / (N - 1);
    const Y = v => padT + (1 - (v - min) / (max - min)) * (HH - padT - padB - 46) + 46;
    // 温度平滑曲线（Catmull-Rom → Bezier）
    let path = "", area = "";
    const pts = ys.map((v, i) => [X(i), Y(v)]);
    for (let i = 0; i < pts.length; i++) {
      if (!Number.isFinite(ys[i])) continue;
      if (!path) { path = "M" + pts[i][0] + " " + pts[i][1]; area = "M" + pts[i][0] + " " + (HH - padB); continue; }
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(pts.length - 1, i + 1)];
      const cx1 = p0[0] + (p1[0] - p0[0]) / 2, cy1 = p0[1], cx2 = p1[0] - (p1[0] - p0[0]) / 2, cy2 = p1[1] + (p2[1] - p1[1]) * 0.5;
      path += " C" + cx1 + " " + cy1 + " " + cx2 + " " + cy2 + " " + p1[0] + " " + p1[1];
      area += " C" + cx1 + " " + cy1 + " " + cx2 + " " + cy2 + " " + p1[0] + " " + p1[1];
    }
    area += " L" + pts[pts.length - 1][0] + " " + (HH - padB) + " Z";
    // 逐时元素
    let bars = "", labels = "", icons = "", dots = "";
    const bw = (W - padL - padR) / N;
    for (let i = 0; i < N; i++) {
      const p = pops[idx + i];
      if (Number.isFinite(p) && p > 4) {
        const h = Math.max(2, p / 100 * 40);
        bars += '<rect x="' + (X(i) - bw * .32) + '" y="' + (HH - padB - h) + '" width="' + bw * .64 + '" height="' + h + '" rx="2.5" fill="rgba(100,170,255,.55)"/>';
        if (p >= 30) labels += '<text x="' + X(i) + '" y="' + (HH - padB - h - 5) + '" font-size="10" fill="rgba(160,205,255,.9)" text-anchor="middle">' + Math.round(p) + '</text>';
      }
      if (i % 3 === 0) {
        labels += '<text x="' + X(i) + '" y="' + (HH - padB + 16) + '" font-size="10.5" fill="rgba(255,255,255,.45)" text-anchor="middle">' + String(t[idx + i]).slice(11, 13) + '</text>';
        icons += '<text x="' + X(i) + '" y="' + (padT - 8) + '" font-size="11" text-anchor="middle">' + wmoIcon(codes[idx + i]) + '</text>';
      }
    }
    // 现在 + 最高最低点
    const iMax = ys.indexOf(Math.max(...fin)), iMin = ys.indexOf(Math.min(...fin));
    if (Number.isFinite(ys[0])) dots += '<circle cx="' + X(0) + '" cy="' + Y(ys[0]) + '" r="4.5" fill="#0a84ff" stroke="rgba(255,255,255,.85)" stroke-width="1.5"/>';
    dots += '<circle cx="' + X(iMax) + '" cy="' + Y(ys[iMax]) + '" r="3.5" fill="#ff9f0a"/>' +
            '<text x="' + X(iMax) + '" y="' + (Y(ys[iMax]) - 8) + '" font-size="11" font-weight="700" fill="#ffd9a0" text-anchor="middle">' + num(ys[iMax]) + '°</text>';
    dots += '<circle cx="' + X(iMin) + '" cy="' + Y(ys[iMin]) + '" r="3.5" fill="#64d2ff"/>' +
            '<text x="' + X(iMin) + '" y="' + (Y(ys[iMin]) - 8) + '" font-size="11" font-weight="700" fill="#bfeaff" text-anchor="middle">' + num(ys[iMin]) + '°</text>';
    return '<svg class="w-chart" viewBox="0 0 ' + W + ' ' + HH + '" preserveAspectRatio="none" style="width:100%;height:' + HH + 'px">' +
      '<defs><linearGradient id="wTempFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="rgba(10,132,255,.32)"/><stop offset="1" stop-color="rgba(10,132,255,0)"/></linearGradient></defs>' +
      bars + '<path d="' + area + '" fill="url(#wTempFill)"/>' +
      '<path d="' + path + '" fill="none" stroke="#0a84ff" stroke-width="2.6" stroke-linecap="round"/>' +
      dots + labels + icons + '</svg>';
  }

  function stat(label, value, unit = "", cls = "") {
    return '<div class="w-stat ' + cls + '"><span class="w-stat-v">' + value + (unit ? '<i>' + unit + '</i>' : '') + '</span><span class="w-stat-k">' + esc(label) + '</span></div>';
  }

  function aqiInfo(aqi) {
    if (!Number.isFinite(aqi)) return { label: "—", color: "rgba(255,255,255,.4)", w: 0 };
    if (aqi <= 50) return { label: lang() === "en" ? "Good" : "优", color: "#30d158", w: aqi / 300 };
    if (aqi <= 100) return { label: lang() === "en" ? "Moderate" : "良", color: "#ffd60a", w: aqi / 300 };
    if (aqi <= 150) return { label: lang() === "en" ? "Sensitive" : "轻度污染", color: "#ff9f0a", w: aqi / 300 };
    if (aqi <= 200) return { label: lang() === "en" ? "Unhealthy" : "中度污染", color: "#ff453a", w: aqi / 300 };
    if (aqi <= 300) return { label: lang() === "en" ? "Very bad" : "重度污染", color: "#bf5af2", w: aqi / 300 };
    return { label: lang() === "en" ? "Hazardous" : "严重污染", color: "#ff2d55", w: 1 };
  }

  function deriveAlerts(data, air) {
    const cur = data.current || {}, daily = data.daily || {};
    const alerts = [];
    const push = (t, b) => alerts.push({ title: t, body: b });
    const code = cur.weather_code;
    if (code >= 95) push(lang() === "en" ? "Thunderstorm" : "雷雨提醒", lang() === "en" ? "Avoid open and elevated areas." : "有雷雨风险，请远离空旷和高处。");
    else if ([61, 63, 65, 80, 81, 82, 51, 53, 55].includes(code)) push(lang() === "en" ? "Rain" : "降水提醒", lang() === "en" ? "Carry an umbrella." : "降水概率较高，建议随身带伞。");
    else if ([71, 73, 75, 85, 86, 77].includes(code)) push(lang() === "en" ? "Snow" : "降雪提醒", lang() === "en" ? "Roads may be slippery." : "有降雪风险，出行注意道路湿滑。");
    else if ([45, 48].includes(code)) push(lang() === "en" ? "Fog" : "低能见度", lang() === "en" ? "Allow extra travel time." : "有雾，出行注意能见度。");
    if (Number.isFinite(cur.apparent_temperature)) {
      if (cur.apparent_temperature >= 35) push(lang() === "en" ? "Heat" : "高温提醒", lang() === "en" ? "Hydrate and avoid midday sun." : "气温偏高，注意补水和防晒。");
      if (cur.apparent_temperature <= 0) push(lang() === "en" ? "Cold" : "低温提醒", lang() === "en" ? "Dress warmly." : "气温偏低，请注意保暖。");
    }
    if (Number.isFinite(cur.wind_gusts_10m) && cur.wind_gusts_10m >= 60) push(lang() === "en" ? "Strong wind" : "大风提醒", lang() === "en" ? "Take care outdoors." : "风力较强，户外活动请注意安全。");
    if (air && Number.isFinite(air.us_aqi) && air.us_aqi >= 150) push(lang() === "en" ? "Air quality" : "空气污染提醒", lang() === "en" ? "Limit outdoor activity." : "空气污染物偏高，敏感人群减少户外活动。");
    return alerts;
  }

  /* ---------------- 渲染 ---------------- */
  function renderWorkbench(data, city, extras) {
    const box = document.getElementById("weatherContent");
    if (!box) return;
    /* 旧版这里是静默 return：数据形状不对时界面一片空白 / 停在 loading。
       现在显式抛错，由 load() 的 paint try/catch 转成可重试的失败卡片。 */
    if (!data || !data.current) throw new Error("bad weather payload: missing data.current");
    const cur = data.current, daily = data.daily || {}, air = extras.air || {};
    const ly = extras.lastYear;
    const ai = aqiInfo(air.us_aqi);
    const alerts = deriveAlerts(data, air);
    const advisories = deriveAdvisories(data, air);
    const my = getMyCity();
    const isMy = my && my.name === city.name;
    const days = daily.time || [];
    const nowcast = nowcastSummary(data);

    /* --- hero --- */
    const popToday = (daily.precipitation_probability_max || [])[0];
    const hero = `
      <div class="wx-hero">
        <div class="wx-hero-top">
          <div class="wx-cityline">
            <span class="wx-city">${esc(city.name)}</span>
            ${isMy ? `<span class="wx-badge">${esc(txt("myCity"))}</span>` : ""}
            <button class="wx-myset${isMy ? " on" : ""}" id="btnSetMyCity">${isMy ? "⭐ " + esc(txt("myCity")) : "📍 " + esc(txt("setMyCity"))}</button>
          </div>
          <div class="wx-hero-cond">${wmoIcon(cur.weather_code)} ${esc(wmo(cur.weather_code))}</div>
        </div>
        <div class="wx-temp">${num(cur.temperature_2m)}<span>°</span></div>
        <div class="wx-subline">${esc(txt("feels"))} ${num(cur.apparent_temperature)}°${Number.isFinite(popToday) ? ` · ${lang() === "en" ? "rain" : "降水"} ${popToday}%` : ""} · ${esc(txt("high"))} ${num(daily.temperature_2m_max?.[0])}° ${esc(txt("low"))} ${num(daily.temperature_2m_min?.[0])}°</div>
        <div class="wx-hero-grid">
          ${stat(txt("humidity"), num(cur.relative_humidity_2m), "%")}
          ${stat(txt("wind"), num(cur.wind_speed_10m, 1), "km/h")}
          ${stat(txt("gust"), num(cur.wind_gusts_10m, 1), "km/h")}
          ${stat(lang() === "en" ? "Dir" : "风向", compass(cur.wind_direction_10m))}
          ${stat(txt("pressure"), num(cur.pressure_msl), "hPa")}
          ${stat(txt("uv"), num(cur.uv_index, 1))}
          ${stat(txt("cloud"), num(cur.cloud_cover), "%")}
        </div>
      </div>`;

    /* --- 分钟级 nowcast --- */
    const nowcastHtml = nowcast ? `
      <div class="wx-card wx-nowcast${nowcast.dry ? " dry" : ""}">
        <div class="wx-card-head"><h3>${esc(txt("nowcast"))}</h3></div>
        <p class="wx-nowcast-text">${nowcast.dry ? "🌤️ " : "🌧️ "}${esc(nowcast.text)}</p>
        ${nowcastBars(data)}
      </div>` : "";

    /* --- 决策 --- */
    const advHtml = advisories.length ? `
      <div class="wx-card wx-adv">
        <div class="wx-card-head"><h3>${esc(txt("advisories"))}</h3></div>
        <div class="wx-adv-grid">${advisories.map(a => `
          <div class="wx-adv-item"><span class="wx-adv-ic">${a[0]}</span><div><b>${esc(a[1])}</b><span>${esc(a[2])}</span></div></div>`).join("")}
        </div>
      </div>` : "";

    /* --- 24h --- */
    const chart = hourlyChart(data);
    const hourlyHtml = chart ? `<div class="wx-card wx-hourly"><div class="wx-card-head"><h3>${esc(txt("hourly"))}</h3><span class="wx-head-note">°C · ${lang() === "en" ? "rain %" : "降水概率%"}</span></div>${chart}</div>` : "";

    /* --- 7 天 --- */
    const weekMin = Math.min(...(daily.temperature_2m_min || []).filter(Number.isFinite));
    const weekMax = Math.max(...(daily.temperature_2m_max || []).filter(Number.isFinite));
    const forecastHtml = `
      <div class="wx-card wx-forecast">
        <div class="wx-card-head"><h3>${esc(txt("forecast"))}</h3></div>
        <div class="wx-days">${days.map((day, i) => {
          const min = daily.temperature_2m_min?.[i], max = daily.temperature_2m_max?.[i];
          const left = Number.isFinite(min) ? ((min - weekMin) / Math.max(1, weekMax - weekMin)) * 100 : 0;
          const width = Number.isFinite(min) && Number.isFinite(max) ? Math.max(8, ((max - min) / Math.max(1, weekMax - weekMin)) * 100) : 8;
          const dd = daily;
          return `<div class="wx-day${i === 0 ? " cur" : ""}">
            <span class="wx-day-name">${esc(dayName(day, i))}</span>
            <span class="wx-day-icon">${wmoIcon(dd.weather_code?.[i])}</span>
            <span class="wx-day-rain">${Number.isFinite(dd.precipitation_probability_max?.[i]) ? dd.precipitation_probability_max[i] + "%" : "—"}</span>
            <span class="wx-day-bar"><i style="left:${left}%;width:${width}%"></i></span>
            <span class="wx-day-temp"><b>${num(max)}°</b><span>${num(min)}°</span></span>
            <span class="wx-day-detail">${esc(txt("uvmax"))} ${num(dd.uv_index_max?.[i], 1)} · ${esc(txt("wind"))} ${num(dd.wind_speed_10m_max?.[i])} · ${esc(txt("precipSum"))} ${num(dd.precipitation_sum?.[i], 1)}mm · ${esc(txt("sunshine"))} ${num((dd.sunshine_duration?.[i] || 0) / 3600, 1)}h</span>
          </div>`;
        }).join("")}</div>
      </div>`;

    /* --- 大气剖面（专业视角） --- */
    const H = data.hourly || {};
    const nIdx = hourlyHourIndex(data);
    const gv = k => (H[k] || [])[nIdx];
    const shearHtml = `
      <div class="wx-card wx-atmo">
        <div class="wx-card-head"><h3>${esc(txt("atmosphere"))}</h3><span class="wx-head-note">${esc(txt("source"))}</span></div>
        <div class="wx-atmo-grid">
          ${stat(txt("cape"), num(gv("cape")), "J/kg")}
          ${stat(txt("blh"), num(gv("boundary_layer_height")), "m")}
          ${stat(txt("freezing"), num(gv("freezing_level_height")), "m")}
          ${stat(txt("dewpoint"), num(gv("dew_point_2m"), 1), "°C")}
          ${stat(txt("vis"), Number.isFinite(gv("visibility")) ? (gv("visibility") / 1000).toFixed(1) : "—", "km")}
          ${stat(txt("soil"), num(gv("soil_temperature_6cm"), 1), "°C")}
          ${stat(txt("soilmoist"), Number.isFinite(gv("soil_moisture_3_9cm")) ? (gv("soil_moisture_3_9cm") * 100).toFixed(0) : "—", "%")}
        </div>
        <div class="wx-shear">
          <div class="wx-shear-row"><span>10m</span><i style="width:${shearPct(gv("wind_speed_10m"))}%"></i><b>${num(gv("wind_speed_10m"))} km/h</b></div>
          <div class="wx-shear-row"><span>80m</span><i style="width:${shearPct(gv("wind_speed_80m"))}%"></i><b>${num(gv("wind_speed_80m"))} km/h</b></div>
          <div class="wx-shear-row"><span>120m</span><i style="width:${shearPct(gv("wind_speed_120m"))}%"></i><b>${num(gv("wind_speed_120m"))} km/h</b></div>
          <p class="wx-shear-note">${esc(txt("shear"))}${shearNote(gv("wind_speed_10m"), gv("wind_speed_120m"))}</p>
        </div>
      </div>`;

    /* --- 天文 --- */
    const moon = moonInfo(new Date());
    const dl0 = (daily.daylight_duration?.[0] || 0) / 3600, dl1 = (daily.daylight_duration?.[1] || 0) / 3600;
    const dld = dl1 - dl0;
    const astroHtml = `
      <div class="wx-card wx-astro">
        <div class="wx-card-head"><h3>${esc(txt("astro"))}</h3></div>
        <div class="wx-sun-arc">${sunArc(daily.sunrise?.[0], daily.sunset?.[0])}</div>
        <div class="wx-astro-grid">
          ${stat(txt("sunrise"), hhmm(daily.sunrise?.[0]))}
          ${stat(txt("sunset"), hhmm(daily.sunset?.[0]))}
          ${stat(txt("daylight"), num(dl0, 1) + "h" + (Math.abs(dld) >= 0.05 ? `<i class="wx-trend">${dld > 0 ? "+" : ""}${num(dld * 60, 0)}min</i>` : ""), "")}
          ${stat(txt("moon"), moon.icon + " " + esc(moon.name) + " " + moon.illum + "%")}
        </div>
        <p class="wx-golden">🌅 ${esc(txt("golden"))} ${esc(goldenWindow(daily.sunrise?.[0], 1))} / ${esc(goldenWindow(daily.sunset?.[0], -1))} · 🌃 ${esc(txt("blue"))} ${esc(goldenWindow(daily.sunrise?.[0], -1))} / ${esc(goldenWindow(daily.sunset?.[0], 1))}</p>
      </div>`;

    /* --- AQI --- */
    const airChips = [
      ["PM2.5", air.pm2_5], ["PM10", air.pm10], ["O₃", air.ozone], ["NO₂", air.nitrogen_dioxide], ["SO₂", air.sulphur_dioxide], ["CO", air.carbon_monoxide]
    ].map(([k, v]) => `<div class="wx-air-chip"><span>${esc(k)}</span><b>${num(v, 1)}</b></div>`).join("");
    const aqiHtml = `
      <div class="wx-card wx-aqi">
        <div class="wx-card-head"><h3>${esc(txt("aqi"))}</h3><span class="wx-aqi-badge" style="color:${ai.color};border-color:${ai.color}55">${esc(ai.label)} · US AQI ${num(air.us_aqi)}</span></div>
        <div class="wx-aqi-bar"><i style="width:${Math.min(100, ai.w * 100)}%;background:${ai.color}"></i></div>
        <div class="wx-air-grid">${airChips}</div>
      </div>`;

    /* --- 往年同期 --- */
    let lyHtml = "";
    if (ly && Number.isFinite(ly.tmax)) {
      const dTmax = (daily.temperature_2m_max?.[0] ?? NaN) - ly.tmax;
      const arrow = dTmax > 0.3 ? "🔺" : dTmax < -0.3 ? "🔻" : "▪️";
      lyHtml = `
        <div class="wx-card wx-lastyear">
          <div class="wx-card-head"><h3>${esc(txt("lastyear"))}</h3></div>
          <p class="wx-ly-main">${arrow} ${esc(txt("vsLastYear"))} <b class="${dTmax > 0.3 ? "up" : dTmax < -0.3 ? "down" : ""}">${dTmax >= 0 ? "+" : ""}${num(dTmax, 1)}°C</b></p>
          <p class="wx-ly-sub">${lang() === "en" ? "Last year this week avg " : "去年本周平均 "} ${num(ly.tmax, 1)}° / ${num(ly.tmin, 1)}°</p>
        </div>`;
    }

    /* --- 预警 --- */
    const alertHtml = alerts.length
      ? alerts.map(a => `<div class="wx-alert-item"><b>${esc(a.title)}</b><span>${esc(a.body)}</span></div>`).join("")
      : `<div class="wx-alert-empty">✅ ${esc(txt("noAlerts"))}</div>`;

    const compareHtml = renderCompare();

    box.innerHTML = `
      ${hero}
      ${nowcastHtml}
      ${advHtml}
      ${hourlyHtml}
      <div class="wx-cols">${forecastHtml}${aqiHtml}${alertWrap(alertHtml)}</div>
      <div class="wx-cols">${shearHtml}${astroHtml}</div>
      <div class="wx-cols">${lyHtml || compareOnlySlot()}</div>
      ${compareHtml}
      <div class="wx-footer">
        <div class="wx-footer-brand"><b>星屿 · 天气工作台</b><span>${esc(txt("footerNote"))}</span></div>
        <div class="wx-footer-meta"><span>${esc(txt("source"))}</span><span>${esc(txt("localCache"))}</span><span>${esc(txt("updated"))} ${esc(new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false }))}</span></div>
      </div>`;

    const setBtn = document.getElementById("btnSetMyCity");
    if (setBtn) setBtn.onclick = () => { setMyCity(city); load(city, true); };
    bindCompare(box);
  }

  function alertWrap(html) {
    return `<div class="wx-card wx-alerts"><div class="wx-card-head"><h3>${esc(txt("alerts"))}</h3></div>${html}</div>`;
  }
  function compareOnlySlot() { return ""; }
  function shearPct(v) { return Number.isFinite(v) ? Math.min(100, v / 60 * 100) : 0; }
  function shearNote(v10, v120) {
    if (!Number.isFinite(v10) || !Number.isFinite(v120)) return "";
    const d = v120 - v10;
    if (d >= 10) return lang() === "en" ? " · strong shear aloft" : " · 高空风速显著增大，高层风资源可观";
    return "";
  }
  function goldenWindow(iso, sign) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    d.setMinutes(d.getMinutes() + sign * 35);
    return d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function sunArc(sunriseIso, sunsetIso) {
    if (!sunriseIso || !sunsetIso) return "";
    const W = 320, Hh = 92;
    const sr = new Date(sunriseIso), ss = new Date(sunsetIso);
    const now = new Date();
    const f = Math.max(0, Math.min(1, (now - sr) / Math.max(1, ss - sr)));
    const px = t => 18 + t * (W - 36);
    const py = t => 78 - Math.sin(t * Math.PI) * 58;
    const nowPt = [px(f), py(f)];
    return `<svg viewBox="0 0 ${W} ${Hh}" class="wx-sun-arc-svg">
      <path d="M18 78 Q ${W / 2} -18 ${W - 18} 78" fill="none" stroke="rgba(255,214,102,.35)" stroke-width="1.6" stroke-dasharray="3 4"/>
      <line x1="10" y1="78" x2="${W - 10}" y2="78" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
      <circle cx="${nowPt[0]}" cy="${nowPt[1]}" r="7" fill="#ffd60a" opacity="${now > ss || now < sr ? 0.25 : 0.95}"/>
      <text x="18" y="90" font-size="9.5" fill="rgba(255,255,255,.5)">${hhmm(sunriseIso)}</text>
      <text x="${W - 18}" y="90" font-size="9.5" fill="rgba(255,255,255,.5)" text-anchor="end">${hhmm(sunsetIso)}</text>
    </svg>`;
  }
  function nowcastBars(data) {
    const m = data.minutely_15;
    if (!m || !Array.isArray(m.time) || !m.time.length) return "";
    const pre = m.precipitation || [];
    const max = Math.max(0.6, ...pre.filter(Number.isFinite));
    const bars = pre.map((v, i) => {
      const h = Number.isFinite(v) ? Math.max(v > 0.02 ? 4 : 1.5, v / max * 44) : 1.5;
      const hot = Number.isFinite(v) && v > 0.05;
      return `<i style="height:${h.toFixed(1)}px" class="${hot ? "hot" : ""}" title="${esc(m.time[i].slice(11, 16))} ${num(v, 2)}mm"></i>`;
    }).join("");
    const labels = [0, 8, 16, pre.length - 1].map(i => `<span>${esc(m.time[i]?.slice(11, 16) || "")}</span>`).join("");
    return `<div class="wx-m15"><div class="wx-m15-bars">${bars}</div><div class="wx-m15-labels">${labels}</div></div>`;
  }

  /* ---------------- 对比城市 ---------------- */
  function compareCard(city) {
    const d = compareData.get(city.name);
    if (!d || !d.current) return `<div class="wx-cmp-card"><b>${esc(city.name)}</b><span class="wx-cmp-temp">—</span><span class="wx-cmp-sub">…</span></div>`;
    const c = d.current;
    return `<div class="wx-cmp-card" data-cmp="${esc(city.name)}">
      <button class="wx-cmp-del" title="移除" data-del="${esc(city.name)}">✕</button>
      <b>${esc(city.name)}</b>
      <span class="wx-cmp-temp">${num(c.temperature_2m)}°</span>
      <span class="wx-cmp-sub">${wmoIcon(c.weather_code)} ${esc(wmo(c.weather_code))} · ${esc(txt("feels"))} ${num(c.apparent_temperature)}°</span>
      <span class="wx-cmp-sub2">${esc(txt("humidity"))} ${num(c.relative_humidity_2m)}% · ${esc(txt("wind"))} ${num(c.wind_speed_10m, 0)}</span>
    </div>`;
  }
  function renderCompare() {
    const cities = getCompareCities().slice(0, 4);
    if (!cities.length) return "";
    const loaded = cities.filter(c => compareData.has(c.name)).length;
    return `<div class="wx-card wx-compare">
      <div class="wx-card-head"><h3>${esc(txt("compare"))}</h3><span class="wx-head-note">${loaded}/${cities.length}</span></div>
      <div class="wx-cmp-grid">${cities.map(compareCard).join("")}
        <div class="wx-cmp-add"><input id="wxAddCity" placeholder="+ ${esc(txt("searchPh"))}" maxlength="20"></div>
      </div></div>`;
  }
  function bindCompare(box) {
    const add = box.querySelector("#wxAddCity");
    if (add) add.onkeydown = async e => {
      if (e.key !== "Enter") return;
      const name = add.value.trim(); if (!name) return;
      try {
        const found = await searchMeteo(name);
        if (!found) return;
        const list = getCompareCities();
        if (!list.some(c => c.name === found.name)) { list.unshift(found); saveCompareCities(list); }
        add.value = "";
        loadCompareData(true);
      } catch {}
    };
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      saveCompareCities(getCompareCities().filter(c => c.name !== b.dataset.del));
      compareData.delete(b.dataset.del);
      renderCompareOnly();
    });
    box.querySelectorAll("[data-cmp]").forEach(el => {
      el.style.cursor = "pointer";
      el.onclick = e => {
        if (e.target.dataset.del) return;
        const c = getCompareCities().find(x => x.name === el.dataset.cmp);
        if (c) load(c, true);
      };
    });
  }
  function renderCompareOnly() {
    const old = document.querySelector(".wx-compare");
    if (!old || !currentCity) return;
    const html = renderCompare();
    old.outerHTML = html;
    bindCompare(document.getElementById("weatherContent"));
  }

  function renderCities(activeName) {
    const bx = document.getElementById("weatherCities");
    if (!bx) return;
    activeName = activeName || (currentCity ? currentCity.name : "");
    const my = getMyCity();
    const list = CITIES.slice();
    if (my && !list.some(c => c.name === my.name)) list.unshift(my);
    bx.innerHTML = list.map(c => `<button class="chip${c.name === activeName ? " active" : ""}" data-city="${esc(c.name)}">${my && c.name === my.name ? "⭐ " : ""}${esc(c.name)}</button>`).join("");
    bx.querySelectorAll("[data-city]").forEach(btn => btn.onclick = () => { const c = list.find(x => x.name === btn.dataset.city); if (c) load(c, true); });
  }

  /* ---------------- 数据编排 ---------------- */
  /* 失败态：永远给一个可点的「重试」，绝不让界面停在 loading */
  function showFailure(reason, detail) {
    const loading = document.getElementById("weatherLoading");
    const content = document.getElementById("weatherContent");
    if (loading) loading.style.display = "none";
    if (!content) return;
    content.style.display = "";
    const zh = lang() !== "en";
    content.innerHTML =
      '<div class="empty-state wx-fail" style="padding:48px 20px;text-align:center">' +
        '<div class="big" style="font-size:38px;line-height:1">\u{1F327}\uFE0F</div>' +
        '<p style="margin:14px 0 6px;font-size:15px;opacity:.92">' + esc(zh ? "天气数据没拿到" : "Weather unavailable") + '</p>' +
        '<p style="margin:0 0 18px;font-size:12px;opacity:.45;word-break:break-all">' + esc(reason || "") + '</p>' +
        '<button class="btn btn-primary" id="wxRetryBtn">' + esc(zh ? "重试" : "Retry") + '</button>' +
      '</div>';
    const b = document.getElementById("wxRetryBtn");
    if (b) b.onclick = () => load(resolveCity(currentCity), true);
    report("load_failure", { reason: String(reason || "").slice(0, 200), detail: detail || null });
  }

  async function load(city, force = false) {
    /* 2026-09-14 关键修复：旧代码遇到坐标非法直接 `return`，既不隐藏 loading 也不报错，
       界面会永远停在「正在获取实时天气…」。现在统一 resolveCity 兜底（默认长沙）。 */
    const requested = city;
    city = resolveCity(city);
    if (!okCity(city)) { showFailure("no valid city"); return; }
    if (!okCity(requested)) report("city_repaired", { from: requested || null, to: city.name });
    currentCity = city;
    lastLoadAt = Date.now();
    const token = ++loadToken;
    painted = false;
    armWatchdog(token);
    try { localStorage.setItem("zero_wx_city", city.name); } catch {}
    const loading = document.getElementById("weatherLoading");
    const content = document.getElementById("weatherContent");
    const cached = !force && readCache(city);
    const paint = (data, extras) => {
      if (loading) loading.style.display = "none";
      if (content) content.style.display = "";
      try {
        renderWorkbench(data, city, extras || {});
        painted = true;
      } catch (err) {
        /* 渲染异常也不能白屏：退回失败卡片并留证 */
        report("render_throw", { msg: err && err.message, stack: String((err && err.stack) || "").slice(0, 400) });
        showFailure((err && err.message) || "render error");
      }
    };
    if (cached) {
      paint(cached.data, cached.extras);
      renderCities(city.name);
      loadCompareData();
      enrich(city, cached.data, extras => {
        try { localStorage.setItem(cacheKey(city), JSON.stringify({ ts: Date.now(), data: cached.data, extras })); } catch {}
        if (currentCity === city) paint(cached.data, extras);
      });
      return;
    }
    if (loading) loading.style.display = "";
    // 陈旧缓存秒出：网络慢时（实测偶发 >10s）用户先看旧数据而不是白屏转圈，
    // 顶部来源行会随 enrich 热更新到最新。彻底无缓存才显示 loading。
    const staleNow = readCache(city, Number.MAX_SAFE_INTEGER);
    if (staleNow) {
      if (loading) loading.style.display = "none";
      if (content) content.style.display = "";
      paint(staleNow.data, staleNow.extras);
      renderCities(city.name);
    }
    try {
      const data = await fetchMeteo(city.lat, city.lon);
      try { localStorage.setItem(cacheKey(city), JSON.stringify({ ts: Date.now(), data, extras: {} })); } catch {}
      paint(data, {});
      renderCities(city.name);
      loadCompareData();
      enrich(city, data, extras => {
        try { localStorage.setItem(cacheKey(city), JSON.stringify({ ts: Date.now(), data, extras })); } catch {}
        if (currentCity === city) paint(data, extras);
      });
    } catch (e) {
      const stale = readCache(city, Number.MAX_SAFE_INTEGER);
      if (stale && stale.data && stale.data.current) {
        if (loading) loading.style.display = "none";
        paint(stale.data, stale.extras);
        report("network_fail_stale_shown", { msg: e && e.message });
      } else {
        showFailure((e && e.message) || txt("loadFail"), { city: city.name });
      }
    }
  }

  /* AQI + 往年同期为「增强层」：不阻塞首屏，回来后热更新 */
  async function enrich(city, data, done) {
    const extras = {};
    const tasks = [
      fetchAir(city.lat, city.lon).then(a => { extras.air = a || {}; }).catch(() => { extras.air = {}; }),
      fetchLastYear(city.lat, city.lon).then(l => { extras.lastYear = l; }).catch(() => { extras.lastYear = null; })
    ];
    await Promise.allSettled(tasks);
    done(extras);
  }

  async function loadCompareData(force = false) {
    const cities = getCompareCities().slice(0, 4);
    await Promise.allSettled(cities.map(async city => {
      const cached = !force && readCache(city);
      if (cached) { compareData.set(city.name, cached.data); return; }
      const data = await fetchMeteo(city.lat, city.lon);
      compareData.set(city.name, data);
      try { localStorage.setItem(cacheKey(city), JSON.stringify({ ts: Date.now(), data, extras: {} })); } catch {}
    }));
    if (currentCity) renderCompareOnly();
  }

  async function doSearch() {
    const input = document.getElementById("weatherCityInput");
    const name = (input && input.value ? input.value : "").trim();
    if (!name) return;
    const loading = document.getElementById("weatherLoading");
    const content = document.getElementById("weatherContent");
    if (loading) loading.style.display = "";
    if (content) content.style.display = "none";
    try {
      const found = await searchMeteo(name);
      if (!found) {
        if (loading) loading.style.display = "none";
        if (content) { content.style.display = ""; content.innerHTML = `<div class="empty-state"><p>${esc(txt("notFound"))}</p></div>`; }
        return;
      }
      const cities = getCompareCities();
      if (!cities.some(c => c.name === found.name)) { cities.unshift(found); saveCompareCities(cities); }
      await load(found, true);
    } catch (e) {
      showFailure((e && e.message) || txt("loadFail"), { search: name });
    }
  }

  /* 看门狗：load() 起飞后若 16s 仍未渲染成功且界面还停在 loading，强制转失败卡片。
     这一层保证「正在获取实时天气…」不可能永久停留。 */
  function armWatchdog(token) {
    setTimeout(() => {
      if (token !== loadToken || painted) return;
      const loading = document.getElementById("weatherLoading");
      const content = document.getElementById("weatherContent");
      const visible = loading && getComputedStyle(loading).display !== "none";
      const empty = !content || !content.innerHTML.trim();
      if (visible && empty) {
        report("watchdog_timeout", { city: (currentCity && currentCity.name) || null, waited: Date.now() - lastLoadAt });
        showFailure(lang() === "en" ? "Timed out (watchdog)" : "请求超时，未获得数据");
      }
    }, 16000);
  }

  let inited = false;
  function init() {
    if (inited) return; inited = true;
    const btn = document.getElementById("btnWeatherSearch");
    if (btn) btn.onclick = doSearch;
    const input = document.getElementById("weatherCityInput");
    if (input) input.onkeydown = e => { if (e.key === "Enter") doSearch(); };
    const ref = document.getElementById("btnWeatherRefresh");
    /* 旧版 `currentCity && load(...)`：首次就失败时 currentCity 为 null，刷新按钮成了死按钮 */
    if (ref) ref.onclick = () => load(resolveCity(currentCity), true);
    try {
      const my = getMyCity();
      let saved = null;
      try { saved = localStorage.getItem("zero_wx_city"); } catch {}
      load(my || CITIES.find(c => c.name === saved) || CITIES[0]);
    } catch (e) {
      report("init_throw", { msg: e && e.message });
      showFailure((e && e.message) || "init error");
    }
  }

  /* 真机排障：控制台执行 Weather.diagnose() 一次性打印现场并落盘 */
  function diagnose() {
    const loading = document.getElementById("weatherLoading");
    const content = document.getElementById("weatherContent");
    const d = {
      version: WX_VERSION, painted, lastLoadAt, loadToken,
      currentCity: currentCity ? currentCity.name : null,
      myCity: (getMyCity() || {}).name || null,
      compare: getCompareCities().map(c => c.name),
      lang: lang(),
      loadingDisplay: loading ? getComputedStyle(loading).display : "(missing #weatherLoading)",
      contentLen: content ? content.innerHTML.length : -1,
      viewActive: !!document.querySelector("#view-weather.active"),
      online: navigator.onLine,
      swController: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      diag: diagLog.slice(-12)
    };
    try { console.log("[Weather.diagnose]", JSON.stringify(d, null, 1)); } catch {}
    report("diagnose", { painted: d.painted, loading: d.loadingDisplay, contentLen: d.contentLen, viewActive: d.viewActive, online: d.online });
    return d;
  }

  window.Weather = {
    init,
    load: (c, force) => load(resolveCity(c), force),
    refresh: () => load(resolveCity(currentCity), true),
    reRender: () => load(resolveCity(currentCity), false),
    renderCities,
    currentCity: () => currentCity,
    searchCity: searchMeteo,
    diagnose, report,
    version: WX_VERSION,
    ping: () => "pong:" + WX_VERSION     // 供 index.html 看门狗确认模块存活
  };
  try { report("module_loaded", { ua: navigator.userAgent.slice(0, 120), ping: "pong:" + WX_VERSION }); } catch {}
})();
