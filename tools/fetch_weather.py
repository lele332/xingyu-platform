# -*- coding: utf-8 -*-
"""fetch_weather.py — 抓取中国天气（weather.com.cn）多城市实时天气，输出到 data/weather/
   供 GitHub Actions 定时运行：把天气 JSON 提交到仓库，前端（手机/远程）直连 GitHub 获取。
   仅使用 Python 标准库。
用法：python tools/fetch_weather.py
输出：data/weather/<cityid>.json  +  data/weather/index.json
"""
import json, re, sys, time, urllib.request, urllib.parse
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "weather"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Referer": "http://www.weather.com.cn/",
}

# 城市（中国天气城市编码 + 名称）
CITIES = [
    ("101010100", "北京"), ("101020100", "上海"), ("101280101", "广州"), ("101280601", "深圳"),
    ("101210101", "杭州"), ("101270101", "成都"), ("101200101", "武汉"), ("101110101", "西安"),
    ("101190101", "南京"), ("101040100", "重庆"), ("101250101", "长沙"), ("101120201", "青岛"),
    ("101030100", "天津"), ("101190401", "苏州"), ("101180101", "郑州"), ("101120101", "济南"),
    ("101070101", "沈阳"), ("101070201", "大连"), ("101050101", "哈尔滨"), ("101060101", "长春"),
    ("101090101", "石家庄"), ("101100101", "太原"), ("101230101", "福州"), ("101230201", "厦门"),
    ("101290101", "昆明"), ("101260101", "贵阳"), ("101300101", "南宁"), ("101310101", "海口"),
    ("101160101", "兰州"), ("101150101", "西宁"), ("101170101", "银川"), ("101130101", "乌鲁木齐"),
    ("101080101", "呼和浩特"), ("101140101", "拉萨"), ("101240101", "南昌"), ("101220101", "合肥"),
    ("101210401", "宁波"), ("101190201", "无锡"), ("101280800", "佛山"), ("101281600", "东莞"),
    ("101280701", "珠海"), ("101180901", "洛阳"),
]

WCODE = {
    "00": ["晴", "☀️"], "01": ["多云", "⛅"], "02": ["阴", "☁️"],
    "03": ["阵雨", "🌦️"], "04": ["雷阵雨", "⛈️"], "05": ["雷阵雨伴有冰雹", "⛈️"],
    "06": ["雨夹雪", "🌧️"], "07": ["小雨", "🌧️"], "08": ["中雨", "🌧️"], "09": ["大雨", "🌧️"],
    "10": ["暴雨", "🌧️"], "11": ["大暴雨", "🌧️"], "12": ["特大暴雨", "🌧️"],
    "13": ["阵雪", "🌨️"], "14": ["小雪", "🌨️"], "15": ["中雪", "🌨️"], "16": ["大雪", "🌨️"],
    "17": ["暴雪", "🌨️"], "18": ["雾", "🌫️"], "19": ["冻雨", "🌧️"], "20": ["沙尘暴", "🌪️"],
    "21": ["小雨-中雨", "🌧️"], "22": ["中雨-大雨", "🌧️"], "23": ["大雨-暴雨", "🌧️"],
    "24": ["暴雨-大暴雨", "🌧️"], "25": ["大暴雨-特大暴雨", "🌧️"],
    "26": ["小雪-中雪", "🌨️"], "27": ["中雪-大雪", "🌨️"], "28": ["大雪-暴雪", "🌨️"],
    "29": ["浮尘", "🌫️"], "30": ["扬沙", "🌪️"], "31": ["强沙尘暴", "🌪️"], "32": ["霾", "😷"],
    "33": ["特殊", "⛈️"], "49": ["强浓雾", "🌫️"], "53": ["霾", "😷"],
}

def _fetch(url, timeout=10):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")

def _extract(html, name):
    m = re.search(r"var\s+" + re.escape(name) + r"[\w]*\s*=\s*(\{.*?\})\s*;", html, re.S)
    if not m:
        m = re.search(r"var\s+" + re.escape(name) + r"[\w]*\s*=\s*(\{.*\})\s*$", html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None

def _num(v):
    try:
        s = str(v).replace("%", "").replace("℃", "").strip()
        if not s:
            return None
        f = float(s)
        return int(f) if f == int(f) else f
    except Exception:
        return None

def fetch_one(cityid):
    html = _fetch("http://d1.weather.com.cn/weather_index/" + cityid + ".html")
    sk = _extract(html, "dataSK") or {}
    zs = _extract(html, "dataZS") or {}
    fc = _extract(html, "fc") or {}
    alarm = _extract(html, "alarmDZ") or {}
    wi = _extract(html, "cityDZ") or {}

    code = str(sk.get("weathercode", "00"))[1:] if sk.get("weathercode") else "00"
    winfo = WCODE.get(code, ["未知", "🌡️"])
    realtime = {
        "temp": _num(sk.get("temp")), "weather": sk.get("weather") or winfo[0],
        "code": code, "icon": winfo[1],
        "wind_dir": sk.get("WD") or "", "wind_scale": sk.get("WS") or "",
        "wind_speed": sk.get("wse") or "", "humidity": _num(sk.get("SD")),
        "pressure": _num(sk.get("qy")), "visibility": sk.get("njd") or "",
        "aqi": _num(sk.get("aqi")), "pm25": _num(sk.get("aqi_pm25")),
        "rain": _num(sk.get("rain")), "time": sk.get("time") or "",
    }
    warns = []
    for w in (alarm.get("w") or []):
        warns.append({"type": w.get("w5", ""), "level": w.get("w7", ""),
                      "title": w.get("w13") or w.get("w1", ""),
                      "detail": w.get("w9", ""), "time": w.get("w8", "")})
    z = zs.get("zs") or {}
    order = ["ct", "uv", "gm", "yd", "xc", "ls", "ys", "fs", "ac", "tr", "pl", "cl", "dy", "ag", "jt", "zs"]
    indices = []
    for k in order:
        name = z.get(k + "_name"); hint = z.get(k + "_hint"); desc = z.get(k + "_des_s")
        if name:
            indices.append({"key": k, "name": name, "hint": hint or "", "desc": desc or ""})
    forecast = []
    for d in (fc.get("f") or []):
        cd = str(d.get("fa", "00")); cn = str(d.get("fb", "00"))
        wd = WCODE.get(cd, ["未知", "🌡️"]); wn = WCODE.get(cn, ["未知", "🌡️"])
        forecast.append({
            "date": d.get("fi", ""), "day": d.get("fj", ""),
            "codeDay": cd, "textDay": wd[0], "iconDay": wd[1],
            "codeNight": cn, "textNight": wn[0], "iconNight": wn[1],
            "high": _num(d.get("fc")), "low": _num(d.get("fd")),
            "windDay": d.get("fe") or "", "windScaleDay": d.get("fg") or "",
            "windScaleNight": d.get("fh") or "",
        })
    return {
        "source": "china", "cityid": cityid,
        "cityname": sk.get("cityname") or wi.get("weatherinfo", {}).get("city", ""),
        "updated": realtime["time"], "realtime": realtime,
        "alarm": warns, "indices": indices, "forecast": forecast,
    }

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok, fail = 0, 0
    index = {"updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"), "cities": []}
    for cid, name in CITIES:
        try:
            data = fetch_one(cid)
            data["cityname"] = data["cityname"] or name
            (OUT_DIR / (cid + ".json")).write_text(
                json.dumps(data, ensure_ascii=False), encoding="utf-8")
            index["cities"].append({"id": cid, "name": data["cityname"]})
            ok += 1
            print("[OK] %s %s" % (name, cid), flush=True)
        except Exception as e:
            print("[FAIL] %s: %s" % (name, e), file=sys.stderr, flush=True)
            fail += 1
        time.sleep(0.3)
    (OUT_DIR / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print("done: ok=%d fail=%d -> %s" % (ok, fail, OUT_DIR), flush=True)
    sys.exit(0 if fail == 0 else 1)

if __name__ == "__main__":
    main()
