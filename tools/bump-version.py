"""
星屿 · 前端版本号升级工具

改了 js/ 或 css/ 下的文件后必须做两件事，否则用户端吃不到（SW + 浏览器按 URL 缓存）：
    1. index.html 里该资源的 ?v=YYYYMMDD.N 查询串
    2. sw.js 的 CACHE 常量（触发 activate 清理旧缓存）
本工具一次做完，避免手改漏掉。

用法：
    python tools/bump-version.py js/app.js                 # 升 app.js
    python tools/bump-version.py js/app.js css/apple.css   # 多个
    python tools/bump-version.py js/app.js --sw            # 顺带升 SW 缓存键
    python tools/bump-version.py --sw                      # 只升 SW

规则：
    - 版本号格式 YYYYMMDD.N；已是今天则 N+1，否则重置为今天的 .1
    - 找不到的资源会报错退出（不会静默跳过），防止手误打错文件名

⚠️ 2026-09-05：之前手改时写过 io.open(p,'w').read() —— 'w' 模式打开即清空文件，
   结果 index.html 变成 0 字节。本工具严格读写分离 + assert 兜底。
"""
import argparse
import datetime
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")


def read(path):
    with io.open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    """⚠️ 两道保证：
       1. 读写分离：先读后写，绝不在 'w' 模式上调 read()
          （2026-09-05 这样把 index.html 清空过，见文件头注释）
       2. 不指定 newline：交给 Python 按平台转换（Windows -> CRLF）。
          曾经显式写 newline="\\n"，文件被改成 LF，与仓库的 CRLF 不一致，
          git 报「LF will be replaced by CRLF」，后续改动会变成整文件 diff。
    """
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(text)


def next_version(old, today):
    """已是今天 -> 序号+1；否则重置为今天的 .1"""
    if old and old.startswith(today + "."):
        try:
            return "%s.%d" % (today, int(old.split(".")[1]) + 1)
        except (IndexError, ValueError):
            pass
    return today + ".1"


def bump_html(resources, today):
    """升 index.html 里指定资源的 ?v="""
    text = read(HTML)
    changed = []
    for res in resources:
        res = res.replace("\\", "/").lstrip("./")
        # 匹配 src="js/app.js?v=20260905.5" 或 href="css/apple.css?v=..."
        pat = re.compile(r'(["\'])((?:\./|/)?' + re.escape(res) + r')\?v=([0-9.]+)(["\'])')
        matches = pat.findall(text)
        if not matches:
            print("  [跳过] index.html 里找不到 %s 的 ?v= 引用" % res)
            continue
        # 同名可能多处引用，统一升到同一个新版本
        old_versions = {m[2] for m in matches}
        old = sorted(old_versions)[-1]
        new = next_version(old, today)
        text = pat.sub(lambda m: m.group(1) + m.group(2) + "?v=" + new + m.group(4), text)
        changed.append((res, old, new))
    if changed:
        write(HTML, text)
    return changed


def bump_sw(today):
    """升 sw.js 的 CACHE 常量：xingyu-static-20260905-8 -> ...-9"""
    text = read(SW)
    m = re.search(r'(const\s+CACHE\s*=\s*["\'])(xingyu-static-)(\d{8})(?:-(\d+))?(["\'])', text)
    if not m:
        print("  [跳过] sw.js 里没找到 CACHE 常量，请手动改")
        return None
    old_date, old_seq = m.group(3), m.group(4)
    if old_date == today.replace("-", ""):
        new_seq = (int(old_seq) if old_seq else 1) + 1
    else:
        new_seq = 1
    new_val = "%s%s-%d" % (m.group(2), today.replace("-", ""), new_seq)
    old_val = m.group(2) + old_date + ("-" + old_seq if old_seq else "")
    write(SW, text[: m.start()] + m.group(1) + new_val + m.group(5) + text[m.end():])
    return (old_val, new_val)


def main():
    ap = argparse.ArgumentParser(description="星屿前端版本号升级")
    ap.add_argument("resources", nargs="*", help="要升级的资源，如 js/app.js css/apple.css")
    ap.add_argument("--sw", action="store_true", help="同时升级 sw.js 的 CACHE 常量")
    args = ap.parse_args()

    today = datetime.date.today().strftime("%Y%m%d")
    print("星屿 · 版本号升级（今天 %s）" % today)
    print("-" * 60)

    if not os.path.exists(HTML):
        print("错误：找不到 index.html：%s" % HTML)
        return 1

    if args.resources:
        for res, old, new in bump_html(args.resources, today):
            print("  index.html  %-22s %s -> %s" % (res, old, new))

    if args.sw:
        r = bump_sw(today)
        if r:
            print("  sw.js       CACHE               %s -> %s" % r)

    if not args.resources and not args.sw:
        print("  没有指定要升级的内容。用法见文件头注释。")
        return 1

    print("-" * 60)
    print("完成。记得跑 tools/check-versions.py 复核。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
