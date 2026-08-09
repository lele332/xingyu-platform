# -*- coding: utf-8 -*-
"""
fetch_news.py — 抓取国内外热点新闻（官网首页解析），输出 news-data.json
仅使用 Python 标准库，无需安装依赖。

新闻源（国内网络可达）：
  国内：央视网、中新网
  国际：联合早报（新加坡主流媒体，中文报道国际与中国新闻）

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
# 新闻详情页链接特征：URL 中带日期路径（/2026/ 、/2026-08/ 、/2026/08-09/ 等）
# 专题页/导航页通常不含日期路径，以此过滤栏目名
RE_DATE_URL = re.compile(r"/(20\d{2})[/-](0[1-9]|1[0-2])|/(20\d{2})[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])|/story(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])")


def fetch_html(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    # 尝试常见编码
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
    # 去掉常见的来源前缀【】或栏目名
    t = re.sub(r"^【[^】]{1,12}】", "", t).strip()
    return t


def is_news_title(t):
    if not (10 <= len(t) <= 50):
        return False
    if not RE_CHINESE.search(t):
        return False
    for kw in BLACKLIST:
        if kw in t:
            return False
    # 排除带过多符号的（多为功能链接）
    if t.count("|") > 1 or t.count("/") > 1:
        return False
    return True


def extract_links(html, base_url):
    """通用提取：<a href>标题</a>，返回去重后的 [(title, url)]"""
    # 去掉 script/style 干扰
    html = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.I)
    out = []
    seen = set()
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', html, flags=re.I):
        href, inner = m.group(1), m.group(2)
        title = clean_title(inner)
        if not is_news_title(title):
            continue
        url = urljoin(base_url, href)
        # 链接必须带日期路径（新闻详情页特征），过滤栏目/专题/导航链接
        if not RE_DATE_URL.search(url):
            continue
        if title in seen:
            continue
        seen.add(title)
        out.append({"title": title, "link": url})
    return out


# ---------- 各源专用配置 ----------
SOURCES = [
    {
        "name": "央视网", "region": "🇨🇳", "category": "国内",
        "url": "https://news.cctv.com/",
        "max": 12,
    },
    {
        "name": "中新网", "region": "🇨🇳", "category": "国内",
        "url": "https://www.chinanews.com/",
        "max": 12,
    },
    {
        "name": "联合早报", "region": "🌍", "category": "国际",
        "url": "https://www.zaobao.com/news/world",
        "max": 14,
    },
    {
        "name": "联合早报·中国", "region": "🇸🇬", "category": "国内",
        "url": "https://www.zaobao.com/news/china",
        "max": 10,
    },
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
            items = extract_links(html, src["url"])
            count = 0
            for it in items:
                if it["title"] in seen_global:
                    continue
                seen_global.add(it["title"])
                all_items.append({
                    "title": it["title"],
                    "link": it["link"],
                    "summary": "",
                    "source": src["name"],
                    "region": src["region"],
                    "category": src["category"],
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
        "news": all_items,
    }
    out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入 {out_file}，共 {len(all_items)} 条", flush=True)


if __name__ == "__main__":
    main()
