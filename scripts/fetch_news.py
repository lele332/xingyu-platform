# -*- coding: utf-8 -*-
"""
fetch_news.py — 抓取国内外热点新闻（官网首页解析），输出 news-data.json
仅使用 Python 标准库，无需安装依赖。

新闻源（国内网络可达）：
  国内综合：央视网、中新网
  国内科技：少数派、爱范儿、品玩、雷锋网
  国际综合：联合早报（新加坡主流媒体）
  国际科技：TechCrunch（美国科技媒体，英文）

用法：python fetch_news.py
输出：../data/news-data.json
"""
import gzip
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin
from pathlib import Path

CN_TZ = timezone(timedelta(hours=8))
TIMEOUT = 14
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# 关键词黑名单（导航/功能/广告类文本，非新闻）
BLACKLIST = (
    "首页", "登录", "注册", "退出", "客户端", "APP", "app", "专题", "频道", "滚动", "更多",
    "广告", "订阅", "设为首页", "收藏", "下载", "视频", "图片", "直播", "电台", "论坛",
    "微博", "微信", "微博微信", "公众号", "邮箱", "RSS", "English", "中文简体", "繁體",
    "搜索", "投稿", "爆料", "热搜", "手机", "数字报", "回到顶部", "分享", "打印", "纠错",
    "责任编辑", "版权声明", "帮助中心", "网站地图", "意见反馈", "违法和不良", "网络文化",
    "许可证", "ICP", "京ICP", "公安", "备案", "关于我们", "联系我们", "人才招聘", "加入",
    "安全文明", "网络举报", "信息网络传播", "广播电视节目", "增值电信", "互联网新闻信息",
)
# 标题必须包含中文才视为新闻（排除纯英文导航等）
RE_CHINESE = re.compile(r"[一-鿿]")
# 新闻详情页链接特征：URL 中带日期路径
# 支持 /2026/08/、/2026-08/、/202608/（年月无分隔符）、/t20260807_ 等格式
RE_DATE_URL = re.compile(r"/(20\d{2})[/-](0[1-9]|1[0-2])|/(20\d{2})[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])|/story(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])|/(20\d{2})(0[1-9]|1[0-2])|/t(20\d{6})")
# 科技/行业站文章ID路径（无日期，用 ID 或特定目录）
RE_TECH_URL = re.compile(r"/(article|a|video|p|post|news|xinwen|content|bullet|create|banner)/|/\d{6,}|/\d{6,}\.html|/t(20\d{6})")
# 科技媒体链接特征（不带日期路径，用文章ID路径）
RE_TECH_URL = re.compile(r"/(a|article|post|p|news)/\d+|/\d{6,}|/banner/\w+/id/\d+|/create/|/bullet/\d+")

# ---------- 科技/AI 关键词（用于分类过滤） ----------
TECH_KEYWORDS = [
    # 中文
    "AI", "人工智能", "大模型", "大语言模型", "AIGC", "芯片", "半导体", "机器人", "自动驾驶",
    "无人驾驶", "科技", "互联网", "算法", "编程", "开源", "算力", "云计算", "大数据",
    "量子", "区块链", "元宇宙", "VR", "AR", "5G", "6G", "新能源", "电池", "无人机",
    "软件", "硬件", "智能", "数字化", "网络", "计算机", "GPU", "CPU", "操作系统",
    "数据库", "网络安全", "黑客", "隐私", "加密", "脑机", "空间计算", "电动车",
    "固态电池", "锂电", "光伏", "储能", "芯片厂", "晶圆", "制程", "光刻", "流媒体",
    "游戏", "手游", "电竞", "数码", "手机", "笔记本", "平板", "穿戴", "开发者",
    "苹果", "华为", "小米", "特斯拉", "比亚迪", "谷歌", "微软", "英伟达", "AMD",
    "Intel", "英特尔", "高通", "字节", "腾讯", "阿里", "百度", "京东", "美团",
    "滴滴", "拼多多", "网易", "OpenAI", "GPT", "Claude", "Gemini", "Sora",
    # 英文（国外科技媒体标题用）
    "OpenAI", "GPT", "Claude", "Gemini", "LLM", "machine learning", "deep learning",
    "neural", "chip", "semiconductor", "robot", "tech", "computer", "algorithm", "quantum",
    "data center", "model", "autonomous", "self-driving", "electric vehicle", "battery",
    "software", "cloud", "cybersecurity", "startup", "app", "digital", "Internet", "coding",
    "programming", "open source", "crypto", "blockchain", "VR", "AR", "streaming", "gaming",
    "Apple", "Google", "Microsoft", "NVIDIA", "AMD", "Intel", "Tesla", "Amazon", "Meta",
    "iPhone", "Android", "MacBook", "laptop", "tablet", "smartphone", "AI ", " AI", "artificial intelligence",
]


def is_tech_related(text):
    """判断标题/摘要是否与科技或AI相关"""
    if not text:
        return False
    for kw in TECH_KEYWORDS:
        if kw in text:
            return True
    return False


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    for enc in ("utf-8", "gbk", "gb18030"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "ignore")


def clean_title(t):
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"&[a-zA-Z#0-9]+;", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"^【[^】]{1,12}】", "", t).strip()
    # 清理爱范儿等站的"产品 | 作者 日期"前缀
    t = re.sub(r"^(产品|视频|资讯|快讯|深度|专栏)\s*[｜|]\s*[^|]{1,12}\s*[｜|]?\s*", "", t).strip()
    t = re.sub(r"^(产品|视频|资讯)\s*[｜|]\s*\S+\s+\d{2}-\d{2}\s+\d{2}:\d{2}\s*", "", t).strip()
    # 清理少数派"xxx 174 位派友参与 去看看"后缀
    t = re.sub(r"\s*\d+\s*位派友参与\s*去看看\s*$", "", t).strip()
    t = re.sub(r"^(派早报|本周看什么)[：:]\s*", "", t).strip()
    # 清理末尾多余符号
    t = re.sub(r"[。\.。]+$", "", t).strip()
    return t


def is_news_title(t, lang="cn"):
    if not (10 <= len(t) <= 50):
        return False
    if lang == "cn" and not RE_CHINESE.search(t):
        return False
    for kw in BLACKLIST:
        if kw in t:
            return False
    if t.count("|") > 1 or t.count("/") > 1:
        return False
    return True


def extract_links(html, base_url, lang="cn", use_date_filter=True):
    """通用提取：<a href>标题</a>，返回去重后的 [(title, url)]
    use_date_filter: True=要求链接带日期路径（综合新闻站）；False=科技站（用文章ID路径）"""
    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    out = []
    seen = set()
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', html, flags=re.I):
        href, inner = m.group(1), m.group(2)
        title = clean_title(inner)
        if not is_news_title(title, lang):
            continue
        url = urljoin(base_url, href)
        if use_date_filter:
            if not RE_DATE_URL.search(url):
                continue
        else:
            # 科技站：链接需匹配文章ID路径特征
            if not RE_TECH_URL.search(url):
                continue
        if title in seen:
            continue
        seen.add(title)
        out.append({"title": title, "link": url})
    return out


# ---------- 土木/道桥行业关键词（用于过滤行业新闻） ----------
TUMU_KEYWORDS = [
    "公路", "道路", "桥梁", "大桥", "隧道", "高速", "高速公", "铁路", "交通", "运输",
    "工程", "施工", "建设", "基建", "基建设", "混凝土", "沥青", "路基", "路面", "桥墩",
    "桥隧", "墩台", "涵洞", "立交", "匝道", "桥面", "桥台", "钢箱梁", "箱梁", "预制",
    "装配式", "盾构", "隧道掘进", "BIM", "装配式", "监理", "造价", "招投标", "工程局",
    "中铁", "中建", "中交", "路桥", "建工", "交建", "水运", "港口", "航道", "码头",
    "枢纽", "客货", "物流", "货运", "航运", "海事", "民航", "机场", "地铁", "城轨",
    "智慧交通", "绿色交通", "交通强国", "公路局", "交通厅", "交通部", "运输部",
    "养护", "改扩建", "扩建", "改造", "加固", "检测", "监测", "预警", "防灾", "防汛",
    "抢险", "应急", "保通", "贯通", "通车", "开工", "竣工", "完工", "合龙", "封顶",
]

def is_tumu_related(text):
    if not text:
        return False
    # 排除明显的政治/健康类非行业新闻
    exclude = ("习近平", "总书记", "求是", "人民情怀", "健康中国", "主席", "元首", "领路", "会客厅", "征订", "研讨会")
    for kw in exclude:
        if kw in text:
            return False
    for kw in TUMU_KEYWORDS:
        if kw in text:
            return True
    return False


# ---------- 各源专用配置 ----------
SOURCES = [
    # 国内综合
    {"name": "央视网", "region": "🇨🇳", "category": "国内", "topic": "综合",
     "url": "https://news.cctv.com/", "max": 10, "lang": "cn"},
    {"name": "中新网", "region": "🇨🇳", "category": "国内", "topic": "综合",
     "url": "https://www.chinanews.com/", "max": 10, "lang": "cn"},
    # 国内科技
    {"name": "少数派", "region": "🇨🇳", "category": "国内", "topic": "科技AI",
     "url": "https://sspai.com/", "max": 8, "lang": "cn", "date_filter": False},
    {"name": "爱范儿", "region": "🇨🇳", "category": "国内", "topic": "科技AI",
     "url": "https://www.ifanr.com/", "max": 8, "lang": "cn", "date_filter": False},
    {"name": "品玩", "region": "🇨🇳", "category": "国内", "topic": "科技AI",
     "url": "https://www.pingwest.com/", "max": 8, "lang": "cn", "date_filter": False},
    {"name": "雷锋网", "region": "🇨🇳", "category": "国内", "topic": "科技AI",
     "url": "https://www.leiphone.com/", "max": 8, "lang": "cn", "date_filter": False},
    # 国际综合
    {"name": "联合早报", "region": "🌍", "category": "国际", "topic": "综合",
     "url": "https://www.zaobao.com/news/world", "max": 12, "lang": "cn"},
    {"name": "联合早报·中国", "region": "🇸🇬", "category": "国内", "topic": "综合",
     "url": "https://www.zaobao.com/news/china", "max": 8, "lang": "cn"},
    # 国际科技
    {"name": "TechCrunch", "region": "🌍", "category": "国际", "topic": "科技AI",
     "url": "https://techcrunch.com/", "max": 10, "lang": "en"},
    # 土木/道桥行业（专业）
    {"name": "中国公路网", "region": "🇨🇳", "category": "国内", "topic": "土木行业",
     "url": "https://www.chinahighway.com/", "max": 10, "lang": "cn", "date_filter": False},
    {"name": "交通运输部", "region": "🇨🇳", "category": "国内", "topic": "土木行业",
     "url": "https://www.mot.gov.cn/", "max": 10, "lang": "cn", "date_filter": True, "tumu_filter": True},
]


def main():
    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "news-data.json"

    now = datetime.now(CN_TZ)
    all_items = []
    seen_global = set()

    for src in SOURCES:
        try:
            html = fetch_html(src["url"])
            items = extract_links(html, src["url"], src.get("lang", "cn"), src.get("date_filter", True))
            count = 0
            for it in items:
                if it["title"] in seen_global:
                    continue
                # 交通部等综合政府源：只保留土木/交通行业相关
                if src.get("tumu_filter") and not is_tumu_related(it["title"]):
                    continue
                seen_global.add(it["title"])
                # 科技/AI 相关判断（用于前端分类）
                tech = is_tech_related(it["title"])
                all_items.append({
                    "title": it["title"],
                    "link": it["link"],
                    "summary": "",
                    "source": src["name"],
                    "region": src["region"],
                    "category": src["category"],
                    "topic": src["topic"],          # 综合 / 科技AI
                    "tech": tech,                    # 是否科技AI相关
                    "time": now.isoformat(),
                })
                count += 1
                if count >= src["max"]:
                    break
            print(f"[OK] {src['name']}: {count} 条", flush=True)
        except Exception as e:
            print(f"[FAIL] {src['name']}: {e}", file=sys.stderr, flush=True)

    data = {
        "updatedAt": now.isoformat(),
        "date": now.strftime("%Y年%m月%d日 %A").replace("Monday", "周一").replace("Tuesday", "周二")
                 .replace("Wednesday", "周三").replace("Thursday", "周四").replace("Friday", "周五")
                 .replace("Saturday", "周六").replace("Sunday", "周日"),
        "count": len(all_items),
        "techCount": sum(1 for n in all_items if n.get("tech") or n.get("topic") == "科技AI"),
        "news": all_items,
    }
    out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入 {out_file}，共 {len(all_items)} 条（科技AI {data['techCount']} 条）", flush=True)


if __name__ == "__main__":
    main()
