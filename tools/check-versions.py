#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星屿 · 前端版本号守卫
====================
用途：揪出「改了 JS/CSS 但忘了升 index.html 的 ?v= 版本号」这类漏网之鱼。
      浏览器 + Service Worker 会按 URL 缓存，版本号不升 => 用户端拿到的还是旧代码，
      表现为「明明改了但用户看不到效果」，极难排查。

用法：
    python tools/check-versions.py              # 检查自 BASE 以来的改动
    python tools/check-versions.py --base HEAD~3
    python tools/check-versions.py --all        # 全量检查（噪音大，含首次入库文件）

判定逻辑（重要，别简化）：
    不能用文件 mtime 判断！git checkout / rebase / 批量恢复会重写 mtime，
    导致几十个文件同一分钟内「被修改」的假象（2026-09-04 踩过）。
    权威依据是 git：取 --base..HEAD 区间内真正有 diff 的文件。
"""
import os
import re
import sys
import argparse
import subprocess
import datetime

# 扫描范围
SCAN_DIRS = ("js", "css")
EXTS = (".js", ".css")


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True,
                          encoding="utf-8", errors="replace").stdout


def collect_html_versions(root="."):
    """从所有 html 里抓 `js/xxx.js?v=YYYYMMDD.N` 版本号，同名保留最高"""
    ver = {}
    for fn in sorted(os.listdir(root)):
        if not fn.endswith(".html"):
            continue
        try:
            txt = open(os.path.join(root, fn), encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        for m in re.finditer(
            r'["\']((?:\./|/)?(?:js|css)/[A-Za-z0-9_\-./]+?\.(?:js|css))\?v=([0-9.]+)["\']', txt
        ):
            path = re.sub(r"^(\./|/)", "", m.group(1)).replace("\\", "/")
            if path not in ver or m.group(2) > ver[path][0]:
                ver[path] = (m.group(2), fn)
    return ver


def collect_files():
    out = []
    for base in SCAN_DIRS:
        if not os.path.isdir(base):
            continue
        for dp, _dn, fns in os.walk(base):
            for fn in fns:
                if fn.endswith(EXTS):
                    out.append(os.path.join(dp, fn).replace("\\", "/"))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="8020271",
                    help="比较基线 commit（默认 8020271 = 深审计修复起点）")
    ap.add_argument("--all", action="store_true", help="全量检查（含首次入库噪音）")
    args = ap.parse_args()

    ver = collect_html_versions()

    if args.all:
        changed = set(collect_files())
    else:
        changed = set(sh("git", "diff", "--name-only", args.base + "..HEAD").split())
        # 未提交的改动也算（正在改还没 commit 的更要提醒）
        changed |= set(sh("git", "diff", "--name-only").split())
        changed |= set(sh("git", "diff", "--cached", "--name-only").split())

    rows = []
    for fp in collect_files():
        if fp not in changed:
            continue
        ct = sh("git", "log", "-1", "--format=%ct", "--", fp).strip()
        ts = (datetime.datetime.fromtimestamp(int(ct)) if ct
              else datetime.datetime.fromtimestamp(os.stat(fp).st_mtime))
        v = ver.get(fp, (None, None))[0]
        rows.append((fp, ts, v))

    rows.sort(key=lambda r: r[1], reverse=True)
    print(f"基线 {args.base}..HEAD   待核对 {len(rows)} 个文件")
    print(f"{'文件':42} {'最后改动':17} {'html版本':11} 判定")
    print("-" * 90)

    bad = 0
    for fp, ts, v in rows:
        need = ts.strftime("%Y%m%d")
        if v is None:
            verdict = "?? 未带版本引用（按需加载/iframe 请忽略）"
        elif need > v:
            verdict = f">>> 版本落后！需 >= {need}"
            bad += 1
        else:
            verdict = "ok"
        print(f"{fp:42} {ts.strftime('%Y-%m-%d %H:%M'):17} {str(v):11} {verdict}")

    print()
    if bad:
        print(f"[FAIL] {bad} 个文件版本号落后。修完记得同时升 sw.js 的 CACHE 常量。")
        return 1
    print("[OK] 版本号全部跟上。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
