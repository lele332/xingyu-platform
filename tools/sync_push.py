# -*- coding: utf-8 -*-
"""sync_push.py — 把「本机代码改动」同步到 GitHub Pages（永久二维码指向的站点）。

为什么需要它：
  仓库里原有的自动提交只有 .github/workflows/weather.yml（云端抓天气数据）和
  tools/update_weather_push.py（同样只 `git add data/weather`）。它们运行在
  GitHub 的 runner 上，永远看不到本机的代码改动 —— 所以「永久二维码扫出来的
  线上站点」长期停留在旧版本，这就是用户说的「内容没有更新和同步」。

设计原则（无人值守也不能出事）：
  1. 默认只提交**已跟踪**文件的改动（git add -u）。新增文件必须显式
     --allow-untracked 才收，避免把模型/视频/临时产物自动推上去。
  2. 提交前硬门禁：node --check 全部 .js、py_compile 全部 .py、
     sw.js 的 CORE 预缓存清单必须都能在 Git 索引里找到。任一失败 => 不提交。
  3. 绝不提交密钥：FORBIDDEN 黑名单命中即中止。
  4. 体积保险丝：单次新增内容 > MAX_NEW_MB 即中止。
  5. push 前先 pull --rebase（云端 Action 每小时会推 data/weather）。
  6. 全程写 data/sync-log.txt，退出码 0=成功或无需同步，非 0=失败。

用法：
  python tools/sync_push.py                # 正常同步
  python tools/sync_push.py --dry-run      # 只看会提交什么，不提交不推送
  python tools/sync_push.py -m "说明"       # 自定义提交信息
"""
import argparse, glob, os, re, shutil, subprocess, sys, time, traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "data" / "sync-log.txt"
MAX_NEW_MB = 25.0

FORBIDDEN = [
    "js/local-config.js", "data/ai-key-local.txt", "data/access-token.txt",
    "data/platform.db", "data/platform-state.json", "webview-data/", "edge-profile/",
    "id_rsa", ".pem", ".p12", ".pfx", "token", "secret", "credential",
]

def log(msg):
    line = "[%s] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def find_git():
    """按候选顺序定位 git.exe。本机没有系统级 Git，只有两处便携安装，
       计划任务的 PATH 里都没有，所以必须自己找。"""
    env = os.environ.get("XINGYU_GIT")
    if env and os.path.exists(env):
        return env
    hit = shutil.which("git")
    if hit:
        return hit
    home = os.path.expanduser("~")
    cands = [
        r"C:\Program Files\Git\cmd\git.exe",
        r"C:\Program Files (x86)\Git\cmd\git.exe",
        os.path.join(home, "AppData", "Local", "Programs", "Git", "cmd", "git.exe"),
    ]
    # WorkBuddy 便携 Git（版本目录会随升级增加，取版本号最大的）
    for pat in (os.path.join(home, ".workbuddy", "binaries", "PortableGit", "versions", "*", "cmd", "git.exe"),
                os.path.join(home, ".cache", "codex-runtimes", "*", "dependencies", "native", "git", "cmd", "git.exe")):
        found = sorted(glob.glob(pat))
        if found:
            cands.append(found[-1])
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None

GIT = find_git()

def run(cmd, **kw):
    return subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                          encoding="utf-8", errors="replace", **kw)

def git(*a):
    if not GIT:
        raise RuntimeError("找不到 git.exe（设 XINGYU_GIT 环境变量指定完整路径）")
    return run([GIT] + list(a))

def die(msg, code=1):
    log("ABORT: " + msg)
    sys.exit(code)

def forbidden_hit(path):
    p = path.lower()
    for bad in FORBIDDEN:
        b = bad.lower()
        if b.endswith("/"):
            if p.startswith(b) or ("/" + b) in p:
                return bad
        elif b.startswith("."):
            if p.endswith(b):
                return bad
        elif p == b or p.endswith("/" + b):
            return bad
    return None

def gate_syntax(files):
    bad = []
    node = "node"
    for f in files:
        if f.endswith(".js"):
            r = run([node, "--check", f.replace("/", os.sep)])
            if r.returncode != 0:
                bad.append((f, (r.stderr or "").strip()[:300]))
        elif f.endswith(".py"):
            r = run([sys.executable, "-m", "py_compile", f.replace("/", os.sep)])
            if r.returncode != 0:
                bad.append((f, (r.stderr or "").strip()[:300]))
    return bad

def gate_sw_core():
    """sw.js 的 CORE 预缓存清单必须都在 Git 索引里，否则线上 SW 装不上。"""
    sw = ROOT / "sw.js"
    if not sw.exists():
        return []
    text = sw.read_text(encoding="utf-8")
    m = re.search(r"const\s+CORE\s*=\s*\[(.*?)\];", text, re.S)
    if not m:
        return []
    indexed = set(git("ls-files").stdout.split("\n"))
    miss = []
    for item in re.findall(r"[\"']([^\"']+)[\"']", m.group(1)):
        if item.startswith("http"):
            continue
        rel = item.lstrip("./")
        if rel and rel not in indexed:
            miss.append(item)
    return miss

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--message", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--allow-untracked", action="store_true",
                    help="连未跟踪的新文件一起收（默认只提交已跟踪文件的改动）")
    args = ap.parse_args()

    if not GIT:
        die("找不到 git.exe。本机没有系统级 Git，请设 XINGYU_GIT 指向便携 Git，"
            "或安装 Git for Windows 后重试。")
    log("git = %s" % GIT)
    if git("rev-parse", "--git-dir").returncode != 0:
        die("not a git repo: %s" % ROOT)

    # 暂存
    if args.allow_untracked:
        r = git("add", "-A")
    else:
        r = git("add", "-u")
        # 永久二维码是 server.py 启动时生成的资产，必须能跟着同步
        for extra in ("assets/xingyu-qrcode.png", "xingyu-qrcode.png"):
            if (ROOT / extra).exists() and not forbidden_hit(extra):
                git("add", "--", extra)
    if r.returncode != 0:
        die("git add failed: " + (r.stderr or "").strip())

    staged = [l for l in git("diff", "--cached", "--name-only").stdout.split("\n") if l.strip()]
    if not staged:
        log("nothing to sync (working tree clean)")
        return 0

    for f in staged:
        hit = forbidden_hit(f)
        if hit:
            git("reset", "-q")
            die("refusing to commit %r (matches forbidden pattern %r)" % (f, hit))

    log("staged %d files: %s" % (len(staged), ", ".join(staged[:14]) + (" ..." if len(staged) > 14 else "")))

    bad = gate_syntax(staged)
    if bad:
        git("reset", "-q")
        for f, e in bad:
            log("  syntax fail: %s -> %s" % (f, e))
        die("syntax gate failed (%d files)" % len(bad))
    log("syntax gate OK (%d js/py)" % sum(1 for f in staged if f.endswith((".js", ".py"))))

    miss = gate_sw_core()
    if miss:
        git("reset", "-q")
        die("sw.js CORE references files missing from git index: %s" % ", ".join(miss))
    log("sw.js CORE gate OK")

    if args.dry_run:
        log("--dry-run: stopping before commit")
        git("reset", "-q")
        return 0

    build = ""
    try:
        m = re.search(r'BUILD\s*=\s*"([^"]+)"', (ROOT / "server.py").read_text(encoding="utf-8"))
        if m:
            build = m.group(1)
    except Exception:
        pass
    msg = args.message or ("sync: 同步本机代码到线上 (build %s)" % (build or time.strftime("%Y%m%d-%H%M")))
    c = git("commit", "-m", msg)
    if c.returncode != 0:
        die("commit failed: " + (c.stderr or c.stdout or "").strip())
    log("committed: " + msg)

    # 云端 Action 每小时推 data/weather，先 rebase 再 push
    f = git("fetch", "origin", "main")
    if f.returncode == 0:
        rb = git("pull", "--rebase", "origin", "main")
        if rb.returncode != 0:
            git("rebase", "--abort")
            die("rebase failed (conflict with remote): " + (rb.stderr or rb.stdout or "").strip()[:400])
    p = git("push", "origin", "HEAD:main")
    if p.returncode != 0:
        die("push failed: " + (p.stderr or p.stdout or "").strip()[:400])
    log("pushed OK -> origin/main")
    return 0

if __name__ == "__main__":
    # 计划任务用 pythonw 跑：没有控制台，任何未捕获异常都会悄无声息地变成
    # 「Last Result=1、日志一行没有」。这里兜住并写进日志，方便下次排查。
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:
        log("EXCEPTION:\n" + traceback.format_exc())
        try:
            git("reset", "-q")
        except Exception:
            pass
        sys.exit(1)
