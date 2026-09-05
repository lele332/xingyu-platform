"""
星屿 · 死控件普查
找出「HTML 里存在、但 JS 里从未引用」的带 id 交互控件。
背景：2026-09-05 发现 #taskFilterStatus / #taskFilterPriority 只被 renderTaskList() 读值、
      从未绑定 change，是死的（用户选了筛选条件列表纹丝不动）。
      这类问题靠肉眼翻代码很难找全，故做成脚本批量对账。

判定（保守，宁可多报不可漏报）：
    元素在 js/ 下任何 .js 文件里都没出现过 => 可疑（完全没接线）
    出现过但没有事件绑定迹象            => 提示人工确认（可能是纯展示/读值）
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根
HTML = os.path.join(ROOT, "index.html")
JS_DIR = os.path.join(ROOT, "js")

# 交互型标签才查（div/span 多为展示容器，噪音太大）
INTERACTIVE = {"input", "select", "textarea", "button", "a"}
# 事件绑定迹象：① 直接赋值 .onclick/.onchange  ② addEventListener('click'...)
# ③ 事件委托：bind('#id', fn)（motivation.js 就是这么绑的，不认这个会全片误报）
EVT_RE = re.compile(
    r"\.(onclick|onchange|oninput|onsubmit|onkeydown|onkeyup|onkeypress|onblur|onfocus)\s*="
    r"|addEventListener\s*\(\s*['\"](click|change|input|submit|keydown|keyup|keypress|blur|focus)"
    r"|\bbind\s*\(\s*['\"]#"
)
# 绑定可能离引用很远（先 getElementById 存变量，几十行后再 addEventListener），
# 窗口必须够大；3000 字符基本覆盖同一个函数块。
EVT_WINDOW = 3000


def read(path):
    with io.open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def collect_html_elements():
    """抓 index.html 里所有带 id 的交互元素"""
    html = read(HTML)
    out = []
    # 逐个标签匹配，取同标签内的 id / type / class
    for m in re.finditer(r"<(input|select|textarea|button|a)\b([^>]*)>", html, re.I):
        tag = m.group(1).lower()
        attrs = m.group(2)
        mid = re.search(r"\bid\s*=\s*[\"']([^\"']+)[\"']", attrs)
        if not mid:
            continue
        mtype = re.search(r"\btype\s*=\s*[\"']([^\"']+)[\"']", attrs)
        mcls = re.search(r"\bclass\s*=\s*[\"']([^\"']+)[\"']", attrs)
        out.append({
            "tag": tag,
            "id": mid.group(1),
            "type": (mtype.group(1).lower() if mtype else ""),
            "cls": (mcls.group(1) if mcls else ""),
            "line": html[: m.start()].count("\n") + 1,
        })
    return out


def collect_js_text():
    """把 js/ 下所有 .js + index.html 的内联 <script> 拼成一个大文本。

    ⚠️ 必须带上 index.html 的内联脚本：开屏逻辑（#splashSkip / #splashSoundHint）
    就写在 index.html 的 <script> 里，只扫 js/ 会把它们误报成死控件。
    """
    parts = []
    for dirpath, dirnames, filenames in os.walk(JS_DIR):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", "bak", "backups")]
        for fn in filenames:
            if fn.endswith(".js"):
                parts.append(read(os.path.join(dirpath, fn)))
    html = read(HTML)
    for m in re.finditer(r"<script\b[^>]*>(.*?)</script>", html, re.S | re.I):
        parts.append(m.group(1))
    return "\n".join(parts)


# 元素被引用的证据：$("#id") / $("#id") / getElementById("id") / querySelector('#id')
# ⚠️ 必须带 # 的形式：jQuery 选择器写作 "#taskFilterStatus"，
#    只匹配 ["']id["'] 会漏掉，导致整片元素被误判成「未绑定事件」。
MENTION_RE_TMPL = r"(?:[\"']#?|#){id}\b"


def main():
    elems = collect_html_elements()
    js = collect_js_text()

    dead = []       # JS 里完全没提到
    no_evt = []     # 提到了但看不出事件绑定
    for e in elems:
        eid = e["id"]
        mention_re = re.compile(MENTION_RE_TMPL.format(id=re.escape(eid)))
        if not mention_re.search(js):
            dead.append(e)
            continue
        # 提到了，找事件绑定迹象（同一函数块内，窗口 3000 字符）
        bound = False
        for m in mention_re.finditer(js):
            window = js[m.start(): m.start() + EVT_WINDOW]
            if EVT_RE.search(window):
                bound = True
                break
        if not bound:
            no_evt.append(e)

    print("=" * 78)
    print("星屿 · 死控件普查")
    print("=" * 78)
    print("扫描 index.html 带 id 的交互元素: %d 个" % len(elems))
    print("JS 目录: %s" % JS_DIR)
    print()

    print("【A】JS 里完全没提到 —— 高度可疑（100%% 是死控件）: %d 个" % len(dead))
    if dead:
        print("%-26s %-9s %-9s %s" % ("id", "标签", "type", "class"))
        print("-" * 78)
        for e in dead:
            print("%-26s %-9s %-9s %s" % (e["id"], e["tag"], e["type"] or "-", e["cls"][:34]))
    else:
        print("  无")
    print()

    print("【B】提到过但未见事件绑定 —— 需人工确认: %d 个" % len(no_evt))
    if no_evt:
        print("%-26s %-9s %-9s %s" % ("id", "标签", "type", "class"))
        print("-" * 78)
        for e in no_evt:
            print("%-26s %-9s %-9s %s" % (e["id"], e["tag"], e["type"] or "-", e["cls"][:34]))
    else:
        print("  无")
    print()

    if dead:
        print("判定：A 类可以直接判定为死控件，逐一确认是忘了接线还是该删。")


if __name__ == "__main__":
    main()
