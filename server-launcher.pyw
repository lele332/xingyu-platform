# -*- coding: utf-8 -*-
import os, sys, runpy
# ROOT 用脚本自身位置推导，不要写死绝对路径 ——
# 这个项目已经从 C:\Users\klxq\WorkBuddy 迁到过 D:\星屿，
# 路径一旦写死，下次搬家快捷方式会静默失效（pythonw 无控制台，报错都看不见）。
ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, ".venv-native", "Lib", "site-packages")
if SITE not in sys.path:
    sys.path.insert(0, SITE)
os.environ["PYTHONPATH"] = SITE + (os.pathsep + os.environ.get("PYTHONPATH", "") if os.environ.get("PYTHONPATH", "") else "")

# ⚠️ 局域网绑定：二维码「同一 WiFi · 配置拉满」能不能用的开关。
#    server.py 的 BIND_HOST 默认 127.0.0.1（server.py:29），只听本机回环，
#    手机扫码访问 http://<局域网IP>:8620/... 会直接连接被拒 ——
#    表现就是「二维码扫了打不开 / 一直转圈」，而电脑上一切正常，极难自查。
#    这里默认放开到 0.0.0.0，让桌面快捷方式启动即可扫码。
#    安全性由 server.py 已有的两层门禁保证，不需要额外担心：
#      * /access 需要 token（_send_lan_gate 未带正确 cookie 一律 401）
#      * /api/lan-info 只对本机回环客户端开放（_is_loopback_client），
#        局域网设备拿不到 token，扫不到也猜不到
#    想退回仅本机：设环境变量 XINGYU_BIND=127.0.0.1 再启动即可。
os.environ.setdefault("XINGYU_BIND", "0.0.0.0")
# pythonw（无控制台）下 sys.stdout/stderr 是 None，server.py 里 print(file=sys.stderr)
# 会直接 AttributeError 静默退出 —— 重定向到日志文件，顺带留档排查。
# 环境变量 XINGYU_SERVER_STDIO=console 时跳过（控制台调试想直接看输出就用 console python）。
if sys.stdout is None or sys.stderr is None:
    _log_dir = os.path.join(ROOT, "data")
    try:
        os.makedirs(_log_dir, exist_ok=True)
        _log = open(os.path.join(_log_dir, "server-log.txt"), "a", buffering=1,
                    encoding="utf-8", errors="replace")
        if sys.stdout is None:
            sys.stdout = _log
        if sys.stderr is None:
            sys.stderr = _log
    except OSError:
        pass
runpy.run_path(os.path.join(ROOT, "server.py"), run_name="__main__")
