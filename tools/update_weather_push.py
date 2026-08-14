# -*- coding: utf-8 -*-
"""update_weather_push.py — 抓取中国天气并推送到 GitHub（供 Windows 计划任务调用）。
   若天气数据有变化则提交并推送，否则跳过。"""
import os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import fetch_weather

def run(cmd, **kw):
    return subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", **kw)

def main():
    fetch_weather.run()
    run(["git", "add", "data/weather"])
    diff = run(["git", "diff", "--cached", "--quiet"])
    if diff.returncode == 0:
        print("天气数据无变化，跳过", flush=True)
        return
    run(["git", "commit", "-m", "auto: 更新天气数据"])
    push = run(["git", "push", "origin", "main"])
    print("push rc=%d  %s" % (push.returncode, push.stdout.strip()[-200:]), flush=True)
    sys.exit(push.returncode)

if __name__ == "__main__":
    main()
