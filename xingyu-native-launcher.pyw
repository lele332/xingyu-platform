# -*- coding: utf-8 -*-
"""无控制台启动器：直接用系统 pythonw.exe 并加载 venv 的 site-packages。"""
import os
import sys
import runpy

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, ".venv-native", "Lib", "site-packages")
if os.path.isdir(SITE):
    if SITE not in sys.path:
        sys.path.insert(0, SITE)
    existing = os.environ.get("PYTHONPATH", "")
    parts = [p for p in existing.split(os.pathsep) if p]
    if SITE not in parts:
        os.environ["PYTHONPATH"] = SITE + (os.pathsep + existing if existing else "")

runpy.run_path(os.path.join(ROOT, "xingyu-native.pyw"), run_name="__main__")
