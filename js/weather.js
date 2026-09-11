/* ============================================================
   weather.js — professional weather workbench
   Local-first: every response is cached in localStorage and rendered offline first.
   ============================================================ */
(function () {
  "use strict";

  const CITIES = [
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

  const WMO = {
    0: ["☀️", "晴", "晴", "Clear"], 1: ["🌤️", "大部晴朗", "大致晴朗", "Mostly clear"],
    2: ["⛅", "多云", "多雲", "Partly cloudy"], 3: ["☁️", "阴", "陰", "Overcast"],
    45: ["🌫️", "雾", "霧", "Fog"], 48: ["🌫️", "冻雾", "凍霧", "Rime fog"],
    51: ["🌦️", "毛毛雨", "毛毛雨", "Drizzle"], 53: ["🌦️", "毛毛雨", "毛毛雨", "Drizzle"], 55: ["🌦️", "强毛毛雨", "強毛毛雨", "Dense drizzle"],
    56: ["🌧️", "冻毛毛雨", "凍毛毛雨", "Freezing drizzle"], 57: ["🌧️", "强冻毛毛雨", "強凍毛毛雨", "Freezing drizzle"],
    61: ["🌧️", "小雨", "小雨", "Light rain"], 63: ["🌧️", "中雨", "中雨", "Rain"], 65: ["🌧️", "大雨", "大雨", "Heavy rain"],
    66: ["🌧️", "冻雨", "凍雨", "Freezing rain"], 67: ["🌧️", "强冻雨", "強凍雨", "Freezing rain"],
    71: ["❄️", "小雪", "小雪", "Light snow"], 73: ["❄️", "中雪", "中雪", "Snow"], 75: ["❄️", "大雪", "大雪", "Heavy snow"],
    77: ["❄️", "雪粒", "雪粒", "Snow grains"], 80: ["🌦️", "小阵雨", "小陣雨", "Showers"], 81: ["🌦️", "阵雨", "陣雨", "Showers"],
    82: ["⛈️", "强阵雨", "強陣雨", "Violent showers"], 85: ["🌨️", "阵雪", "陣雪", "Snow showers"], 86: ["🌨️", "阵雪", "陣雪", "Snow showers"],
    95: ["⛈️", "雷阵雨", "雷陣雨", "Thunderstorm"], 96: ["⛈️", "雷雨伴冰雹", "雷雨伴冰雹", "Thunderstorm hail"], 99: ["⛈️", "雷雨伴冰雹", "雷雨伴冰雹", "Thunderstorm hail"]
  };

  const TXT = {
    zh: {
      searchPh: "搜索城市（如：长沙 / Shanghai）", search: "搜索", refresh: "刷新", loading: "正在获取实时天气…",
      notFound: "未找到该城市", loadFail: "天气数据获取失败", now: "现在", feels: "体感", humidity: "湿度",
      wind: "风速", gust: "阵风", pressure: "气压", precip: "降水", uv: "紫外线", cloud: "云量",
      sunrise: "日出", sunset: "日落", aqi: "空气质量", pm25: "PM2.5", pm10: "PM10", o3: "臭氧",
      no2: "二氧化氮", so2: "二氧化硫", co: "一氧化碳", hourly: "24 小时趋势", forecast: "7 天预测",
      compare: "多城市对比", alerts: "预警与提醒", noAlerts: "当前没有明显天气风险", updated: "更新于",
      myCity: "我的城市", setMyCity: "设为我的城市", high: "最高", low: "最低", windDir: "风向", source: "数据来源 Open-Meteo · 本地缓存",
      aqiGood: "优", aqiFine: "良", aqiLight: "轻度", aqiModerate: "中度", aqiHeavy: "重度", aqiSevere: "严重",
      alertRain: "降水提醒", alertRainBody: "降水概率较高，建议随身带伞。",
      alertWind: "大风提醒", alertWindBody: "风力较强，户外活动请注意安全。",
      alertHeat: "高温提醒", alertHeatBody: "气温偏高，注意补水和防晒。",
      alertCold: "低温提醒", alertColdBody: "气温偏低，请注意保暖。",
      alertUv: "紫外线提醒", alertUvBody: "紫外线较强，建议做好防晒。",
      alertAqi: "空气污染提醒", alertAqiBody: "空气污染物偏高，敏感人群减少户外活动。",
      alertStorm: "雷雨提醒", alertStormBody: "有雷雨风险，请远离空旷和高处。",
      alertSnow: "降雪提醒", alertSnowBody: "有降雪风险，出行注意道路湿滑。",
      alertFog: "低能见度提醒", alertFogBody: "有雾，出行请注意能见度。"
    },
    "zh-Hant": {
      searchPh: "搜索城市（如：長沙 / Shanghai）", search: "搜索", refresh: "刷新", loading: "正在獲取實時天氣…",
      notFound: "未找到該城市", loadFail: "天氣數據獲取失敗", now: "現在", feels: "體感", humidity: "濕度",
      wind: "風速", gust: "陣風", pressure: "氣壓", precip: "降水", uv: "紫外線", cloud: "雲量",
      sunrise: "日出", sunset: "日落", aqi: "空氣品質", pm25: "PM2.5", pm10: "PM10", o3: "臭氧",
      no2: "二氧化氮", so2: "二氧化硫", co: "一氧化碳", hourly: "24 小時趨勢", forecast: "7 天預測",
      compare: "多城市對比", alerts: "預警與提醒", noAlerts: "當前沒有明顯天氣風險", updated: "更新於",
      myCity: "我的城市", setMyCity: "設為我的城市", high: "最高", low: "最低", windDir: "風向", source: "資料來源 Open-Meteo · 本地快取",
      aqiGood: "優", aqiFine: "良", aqiLight: "輕度", aqiModerate: "中度", aqiHeavy: "重度", aqiSevere: "嚴重",
      alertRain: "降水提醒", alertRainBody: "降水機率較高，建議隨身帶傘。",
      alertWind: "大風提醒", alertWindBody: "風力較強，戶外活動請注意安全。",
      alertHeat: "高溫提醒", alertHeatBody: "氣溫偏高，注意補水和防曬。",
      alertCold: "低溫提醒", alertColdBody: "氣溫偏低，請注意保暖。",
      alertUv: "紫外線提醒", alertUvBody: "紫外線較強，建議做好防曬。",
      alertAqi: "空氣污染提醒", alertAqiBody: "空氣污染物偏高，敏感人群減少戶外活動。",
      alertStorm: "雷雨提醒", alertStormBody: "有雷雨風險，請遠離空曠和高處。",
      alertSnow: "降雪提醒", alertSnowBody: "有降雪風險，出行注意道路濕滑。",
      alertFog: "低能見度提醒", alertFogBody: "有霧，出行請注意能見度。"
    },
    en: {
      searchPh: "Search city (e.g. Shanghai)", search: "Search", refresh: "Refresh", loading: "Fetching live weather…",
      notFound: "City not found", loadFail: "Failed to load weather", now: "Now", feels: "Feels", humidity: "Humidity",
      wind: "Wind", gust: "Gusts", pressure: "Pressure", precip: "Precip", uv: "UV", cloud: "Cloud",
      sunrise: "Sunrise", sunset: "Sunset", aqi: "Air quality", pm25: "PM2.5", pm10: "PM10", o3: "O₃",
      no2: "NO₂", so2: "SO₂", co: "CO", hourly: "24h trend", forecast: "7-day forecast",
      compare: "City compare", alerts: "Alerts & advisories", noAlerts: "No notable weather risks", updated: "Updated",
      myCity: "My city", setMyCity: "Set as my city", high: "High", low: "Low", windDir: "Dir", source: "Source Open-Meteo · local cache",
      aqiGood: "Good", aqiFine: "Fair", aqiLight: "Light", aqiModerate: "Moderate", aqiHeavy: "Heavy", aqiSevere: "Severe",
      alertRain: "Rain advisory", alertRainBody: "High chance of rain. Carry an umbrella.",
      alertWind: "Wind advisory", alertWindBody: "Strong wind. Take care outdoors.",
      alertHeat: "Heat advisory", alertHeatBody: "High temperature. Hydrate and use sun protection.",
      alertCold: "Cold advisory", alertColdBody: "Low temperature. Dress warmly.",
      alertUv: "UV advisory", alertUvBody: "Strong UV. Sun protection recommended.",
      alertAqi: "Air-quality advisory", alertAqiBody: "Elevated pollution. Sensitive groups should limit outdoor activity.",
      alertStorm: "Thunderstorm advisory", alertStormBody: "Thunderstorm risk. Avoid open and elevated areas.",
      alertSnow: "Snow advisory", alertSnowBody: "Snow risk. Expect slippery roads.",
      alertFog: "Visibility advisory", alertFogBody: "Foggy conditions. Allow extra travel time."
    }
  };

  let currentCity = null;
  let compareData = new Map();
  const MY_KEY = "zero_wx_my_city";
  const COMPARE_KEY = "zero_wx_compare_v1";
  const CACHE_TTL = 8 * 60 * 1000;
  const TIMEOUT_MS = 10000;

  function lang() { return document.documentElement.dataset.lang || "zh"; }
  function txt(k) { return (TXT[lang()] || TXT.zh)[k] || k; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function num(v, f = 0) { return Number.isFinite(v) ? v.toFixed(f) : "—"; }
  function locale() { return lang() === "en" ? "en-US" : lang() === "zh-Hant" ? "zh-TW" : "zh-CN"; }
  function fmtTime(v) { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? String(v).slice(11, 16) : d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false }); }
  function dayName(v, idx) { const d = new Date(v); if (isNaN(d)) return "—"; if (idx === 0) return txt("today"); return d.toLocaleDateString(locale(), { weekday: "short" }); }
  function compass(deg) { if (!Number.isFinite(deg)) return "—"; const a = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]; return a[Math.round((deg % 360) / 22.5) % 16]; }
  function wmo(code) { const w = WMO[code] || ["🌡️", "未知", "未知", "Unknown"]; return lang() === "en" ? w[3] : lang() === "zh-Hant" ? w[2] : w[1]; }
  function wmoIcon(code) { return (WMO[code] || ["🌡️"])[0]; }

  function getMyCity() { try { const c = JSON.parse(localStorage.getItem(MY_KEY) || "null"); return c && c.name ? c : null; } catch { return null; } }
  function setMyCity(c) { try { localStorage.setItem(MY_KEY, JSON.stringify(c)); } catch {} }
  function getCompareCities() {
    try { const a = JSON.parse(localStorage.getItem(COMPARE_KEY) || "null"); if (Array.isArray(a) && a.length) return a.slice(0, 6); } catch {}
    return CITIES.slice(0, 4);
  }
  function saveCompareCities(a) { try { localStorage.setItem(COMPARE_KEY, JSON.stringify(a.slice(0, 6))); } catch {} }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try { const r = await fetch(url, { signal: controller.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    finally { clearTimeout(timer); }
  }

  async function fetchAir(lat, lon) {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&timezone=auto`;
    const d = await fetchJson(url);
    return d && d.current ? d.current : null;
  }

  async function fetchMeteo(lat, lon) {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index" +
      "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max" +
      "&forecast_days=7&timezone=auto";
    const data = await fetchJson(url);
    try { data.air = await fetchAir(lat, lon); } catch (e) { data.air = null; }
    return data;
  }

  async function searchMeteo(name) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${lang() === "en" ? "en" : "zh"}&format=json`;
    const d = await fetchJson(url);
    const r = d && d.results && d.results[0];
    return r ? { id: "", name: r.name, lat: r.latitude, lon: r.longitude } : null;
  }

  function cacheKey(city) { return "zero_wx_" + (city.id || city.name) + "_v2"; }
  function readCache(city, maxAge = CACHE_TTL) {
    try { const c = JSON.parse(localStorage.getItem(cacheKey(city)) || "null"); if (c && c.data && Date.now() - c.ts < maxAge) return c; } catch {}
    return null;
  }

  function aqiInfo(aqi) {
    if (!Number.isFinite(aqi)) return { label: "—", color: "var(--ink-3)" };
    if (aqi <= 50) return { label: txt("aqiGood"), color: "#34c759" };
    if (aqi <= 100) return { label: txt("aqiFine"), color: "#ffd60a" };
    if (aqi <= 150) return { label: txt("aqiLight"), color: "#ff9f0a" };
    if (aqi <= 200) return { label: txt("aqiModerate"), color: "#ff453a" };
    if (aqi <= 300) return { label: txt("aqiHeavy"), color: "#bf5af2" };
    return { label: txt("aqiSevere"), color: "#7f1d1d" };
  }

  function deriveAlerts(d) {
    const alerts = [];
    const cur = d.current || {};
    const daily = d.daily || {};
    const air = d.air || {};
    const push = (title, body) => alerts.push({ title, body });
    if ([95, 96, 99].includes(cur.weather_code)) push(txt("alertStorm"), txt("alertStormBody"));
    if (Number.isFinite(daily.precipitation_probability_max?.[0]) && daily.precipitation_probability_max[0] >= 70) push(txt("alertRain"), txt("alertRainBody"));
    if ([71, 73, 75, 77, 85, 86].includes(cur.weather_code)) push(txt("alertSnow"), txt("alertSnowBody"));
    if ([45, 48].includes(cur.weather_code)) push(txt("alertFog"), txt("alertFogBody"));
    if (Number.isFinite(cur.wind_gusts_10m) && cur.wind_gusts_10m >= 45) push(txt("alertWind"), txt("alertWindBody"));
    if (Number.isFinite(cur.temperature_2m) && cur.temperature_2m >= 35) push(txt("alertHeat"), txt("alertHeatBody"));
    if (Number.isFinite(cur.temperature_2m) && cur.temperature_2m <= -8) push(txt("alertCold"), txt("alertColdBody"));
    if (Number.isFinite(cur.uv_index) && cur.uv_index >= 7) push(txt("alertUv"), txt("alertUvBody"));
    if (Number.isFinite(air.us_aqi) && air.us_aqi > 150) push(txt("alertAqi"), txt("alertAqiBody"));
    return alerts.slice(0, 4);
  }

  function stat(label, value, unit = "") {
    return `<div class="w-stat"><b>${esc(value)}<small>${esc(unit)}</small></b><span>${esc(label)}</span></div>`;
  }

  function chartSvg(d) {
    const h = d.hourly || {};
    const times = h.time || [];
    if (!times.length) return "";
    const now = new Date();
    let start = times.findIndex(t => new Date(t) >= new Date(now.getTime() - 3600000));
    if (start < 0) start = 0;
    const end = Math.min(start + 24, times.length);
    const temps = [], precips = [];
    for (let i = start; i < end; i++) { temps.push(h.temperature_2m[i]); precips.push(h.precipitation_probability[i]); }
    const w = 720, hh = 170, pad = 26;
    const min = Math.min(...temps.filter(Number.isFinite)), max = Math.max(...temps.filter(Number.isFinite));
    const lo = Number.isFinite(min) ? min - 2 : 0, hi = Number.isFinite(max) ? max + 2 : 10;
    const x = i => pad + i * (w - pad * 2) / Math.max(1, temps.length - 1);
    const y = v => hh - pad - ((v - lo) / Math.max(1, hi - lo)) * (hh - pad * 2);
    let line = "", area = "";
    temps.forEach((v, i) => { if (!Number.isFinite(v)) return; line += `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; });
    area = line ? line + `L${x(temps.length - 1)},${hh - pad} L${x(0)},${hh - pad} Z` : "";
    let bars = "";
    precips.forEach((p, i) => {
      if (!Number.isFinite(p) || p <= 0) return;
      const bw = Math.max(3, (w - pad * 2) / precips.length - 4);
      const bh = (p / 100) * (hh - pad * 2);
      bars += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(hh - pad - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="rgba(10,132,255,.25)"/>`;
    });
    let labels = "";
    for (let i = 0; i < temps.length; i += 6) {
      const d = new Date(times[start + i]);
      labels += `<text x="${x(i).toFixed(1)}" y="${hh - 7}" text-anchor="middle" fill="currentColor" opacity=".55" font-size="11">${d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false })}</text>`;
    }
    return `<svg class="w-chart" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" role="img" aria-label="${esc(txt("hourly"))}">
      <defs><linearGradient id="wtemp" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${bars}<path d="${area}" fill="url(#wtemp)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>${labels}</svg>`;
  }

  function compareCard(city) {
    const d = compareData.get(city.name);
    if (!d) return `<div class="w-compare-item empty"><b>${esc(city.name)}</b><span>—</span></div>`;
    const cur = d.current || {};
    return `<button class="w-compare-item" data-compare-city="${esc(city.name)}">
      <span class="w-compare-city">${esc(city.name)}</span>
      <b>${num(cur.temperature_2m)}°</b>
      <span>${wmoIcon(cur.weather_code)} ${esc(wmo(cur.weather_code))}</span>
      <span>${txt("feels")} ${num(cur.apparent_temperature)}° · ${txt("humidity")} ${num(cur.relative_humidity_2m)}%</span>
    </button>`;
  }

  function renderCompare() {
    const cities = [];
    const seen = new Set();
    [currentCity, ...getCompareCities()].forEach(c => { if (c && !seen.has(c.name)) { seen.add(c.name); cities.push(c); } });
    return `<div class="card weather-compare"><div class="card-head"><h3>${esc(txt("compare"))}</h3></div><div class="w-compare-grid">${cities.map(compareCard).join("")}</div></div>`;
  }

  function bindCompare(box) {
    box.querySelectorAll("[data-compare-city]").forEach(btn => {
      btn.onclick = () => {
        const c = [currentCity, ...getCompareCities()].find(x => x && x.name === btn.dataset.compareCity);
        if (c) load(c, true);
      };
    });
  }

  function renderWorkbench(data, city) {
    const box = document.getElementById("weatherContent");
    if (!box || !data || !data.current) return;
    const cur = data.current, daily = data.daily || {}, air = data.air || {};
    const ai = aqiInfo(air.us_aqi);
    const alerts = deriveAlerts(data);
    const my = getMyCity();
    const isMy = my && my.name === city.name;
    const days = daily.time || [];
    const compare = renderCompare();
    const hourly = chartSvg(data);

    const alertHtml = alerts.length ? alerts.map(a => `<div class="w-alert-item"><b>${esc(a.title)}</b><span>${esc(a.body)}</span></div>`).join("") : `<div class="w-alert-empty">${esc(txt("noAlerts"))}</div>`;

    const forecastHtml = days.map((day, i) => {
      const p = daily.precipitation_probability_max?.[i];
      const min = daily.temperature_2m_min?.[i], max = daily.temperature_2m_max?.[i];
      const weekMin = Math.min(...(daily.temperature_2m_min || []).filter(Number.isFinite));
      const weekMax = Math.max(...(daily.temperature_2m_max || []).filter(Number.isFinite));
      const left = Number.isFinite(min) ? ((min - weekMin) / Math.max(1, weekMax - weekMin)) * 100 : 0;
      const width = Number.isFinite(min) && Number.isFinite(max) ? Math.max(8, ((max - min) / Math.max(1, weekMax - weekMin)) * 100) : 8;
      return `<div class="w-day-row${i === 0 ? " cur" : ""}">
        <span class="w-day-name">${esc(dayName(day, i))}</span>
        <span class="w-day-icon">${wmoIcon(daily.weather_code?.[i])}</span>
        <span class="w-day-text">${esc(wmo(daily.weather_code?.[i]))}</span>
        <span class="w-day-rain">${Number.isFinite(p) ? p + "%" : "—"}</span>
        <span class="w-day-bar"><i style="left:${left}%;width:${width}%"></i></span>
        <span class="w-day-temp"><b>${num(max)}°</b><span>${num(min)}°</span></span>
      </div>`;
    }).join("");

    const airChips = [
      [txt("pm25"), air.pm2_5], [txt("pm10"), air.pm10], [txt("o3"), air.ozone], [txt("no2"), air.nitrogen_dioxide], [txt("so2"), air.sulphur_dioxide], [txt("co"), air.carbon_monoxide]
    ].map(([k, v]) => `<div class="w-air-chip"><span>${esc(k)}</span><b>${num(v, 1)}</b></div>`).join("");

    box.innerHTML = `
      <div class="weather-hero card">
        <div class="weather-hero-main">
          <div class="w-cityline">
            <span class="w-city">${esc(city.name)}</span>
            ${isMy ? `<span class="w-mybadge">${esc(txt("myCity"))}</span>` : ""}
            <button class="w-myset${isMy ? " on" : ""}" id="btnSetMyCity">${isMy ? "⭐ " + esc(txt("myCity")) : "📍 " + esc(txt("setMyCity"))}</button>
          </div>
          <div class="w-temp">${num(cur.temperature_2m)}<span>°C</span></div>
          <div class="w-desc">${wmoIcon(cur.weather_code)} ${esc(wmo(cur.weather_code))}</div>
          <div class="w-sub">${esc(txt("feels"))} ${num(cur.apparent_temperature)}° · ${esc(txt("sunrise"))} ${esc(fmtTime(daily.sunrise?.[0]))} · ${esc(txt("sunset"))} ${esc(fmtTime(daily.sunset?.[0]))}</div>
        </div>
        <div class="weather-hero-metrics">
          ${stat(txt("humidity"), num(cur.relative_humidity_2m), "%")}
          ${stat(txt("wind"), num(cur.wind_speed_10m, 1), "km/h")}
          ${stat(txt("gust"), num(cur.wind_gusts_10m, 1), "km/h")}
          ${stat(txt("windDir"), compass(cur.wind_direction_10m))}
          ${stat(txt("pressure"), num(cur.pressure_msl), "hPa")}
          ${stat(txt("precip"), num(cur.precipitation, 1), "mm")}
          ${stat(txt("uv"), num(cur.uv_index, 1))}
          ${stat(txt("cloud"), num(cur.cloud_cover), "%")}
        </div>
      </div>

      ${compare}
      ${hourly ? `<div class="card weather-hourly"><div class="card-head"><h3>${esc(txt("hourly"))}</h3></div>${hourly}</div>` : ""}

      <div class="weather-grid">
        <div class="card weather-forecast"><div class="card-head"><h3>${esc(txt("forecast"))}</h3></div><div class="w-days">${forecastHtml}</div></div>
        <div class="card weather-aqi"><div class="card-head"><h3>${esc(txt("aqi"))}</h3><span style="color:${ai.color};font-weight:700">${esc(ai.label)} · US AQI ${num(air.us_aqi)}</span></div><div class="w-air-grid">${airChips}</div></div>
        <div class="card weather-alerts"><div class="card-head"><h3>${esc(txt("alerts"))}</h3></div>${alertHtml}</div>
      </div>
      <div class="w-source">${esc(txt("source"))} · ${esc(txt("updated"))} ${esc(new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false }))}</div>`;

    const setBtn = document.getElementById("btnSetMyCity");
    if (setBtn) setBtn.onclick = () => { setMyCity(city); load(city, true); };
    bindCompare(box);
  }

  function renderCities(activeName) {
    const box = document.getElementById("weatherCities");
    if (!box) return;
    activeName = activeName || (currentCity ? currentCity.name : "");
    const my = getMyCity();
    const list = CITIES.slice();
    if (my && !list.some(c => c.name === my.name)) list.unshift(my);
    box.innerHTML = list.map(c => `<button class="chip${c.name === activeName ? " active" : ""}" data-city="${esc(c.name)}">${my && c.name === my.name ? "⭐ " : ""}${esc(c.name)}</button>`).join("");
    box.querySelectorAll("[data-city]").forEach(btn => btn.onclick = () => { const c = list.find(x => x.name === btn.dataset.city); if (c) load(c, true); });
  }

  function renderDispatch(data, city) { renderWorkbench(data, city); }

  async function load(city, force = false) {
    if (!city || Number.isNaN(city.lat) || Number.isNaN(city.lon)) return;
    currentCity = city;
    try { localStorage.setItem("zero_wx_city", city.name); } catch {}
    const loading = document.getElementById("weatherLoading");
    const content = document.getElementById("weatherContent");
    const cached = !force && readCache(city);
    if (cached) {
      currentCity = city;
      renderDispatch(cached.data, city);
      renderCities(city.name);
      if (loading) loading.style.display = "none";
      if (content) content.style.display = "";
      loadCompareData();
      return;
    }
    if (loading) loading.style.display = "";
    if (content) content.style.display = "none";
    try {
      const data = await fetchMeteo(city.lat, city.lon);
      data.source = "workbench";
      try { localStorage.setItem(cacheKey(city), JSON.stringify({ ts: Date.now(), data })); } catch {}
      if (loading) loading.style.display = "none";
      if (content) content.style.display = "";
      renderDispatch(data, city);
      renderCities(city.name);
      loadCompareData();
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (content) {
        content.style.display = "";
        const stale = readCache(city, Number.MAX_SAFE_INTEGER);
        if (stale) renderDispatch(stale.data, city);
        else content.innerHTML = `<div class="empty-state"><p>${esc(txt("loadFail"))}</p></div>`;
      }
    }
  }

  async function loadCompareData() {
    const cities = getCompareCities().slice(0, 4);
    await Promise.allSettled(cities.map(async city => {
      const cached = readCache(city);
      if (cached) { compareData.set(city.name, cached.data); return; }
      const data = await fetchMeteo(city.lat, city.lon);
      data.source = "workbench";
      compareData.set(city.name, data);
      try { localStorage.setItem(cacheKey(city), JSON.stringify({ ts: Date.now(), data })); } catch {}
    }));
    if (currentCity) {
      const content = document.getElementById("weatherContent");
      if (content && content.style.display !== "none") renderCompareOnly();
    }
  }

  function renderCompareOnly() {
    const old = document.querySelector(".weather-compare");
    if (!old) return;
    old.outerHTML = renderCompare();
    bindCompare(document.getElementById("weatherContent"));
  }

  async function doSearch() {
    const input = document.getElementById("weatherCityInput");
    const name = (input?.value || "").trim();
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
      if (loading) loading.style.display = "none";
      if (content) { content.style.display = ""; content.innerHTML = `<div class="empty-state"><p>${esc(txt("loadFail"))}</p></div>`; }
    }
  }

  function init() {
    const btn = document.getElementById("btnWeatherSearch");
    if (btn) btn.onclick = doSearch;
    const input = document.getElementById("weatherCityInput");
    if (input) input.onkeydown = e => { if (e.key === "Enter") doSearch(); };
    const ref = document.getElementById("btnWeatherRefresh");
    if (ref) ref.onclick = () => currentCity && load(currentCity, true);
    const my = getMyCity();
    const saved = localStorage.getItem("zero_wx_city");
    load(my || CITIES.find(c => c.name === saved) || CITIES[0]);
  }

  window.Weather = {
    init,
    load,
    refresh: () => currentCity && load(currentCity, true),
    reRender: () => currentCity && load(currentCity, false),
    renderCities,
    currentCity: () => currentCity,
    searchCity: searchMeteo
  };
})();
