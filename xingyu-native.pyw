# -*- coding: utf-8 -*-
"""星屿原生窗口启动器：pywebview(WebView2) 原生窗口，替代浏览器窗口。

- 双击打开即全面屏；F11 切换全屏，Esc 退出全屏，右上角 X 按钮真正关窗口
- 服务启动逻辑复用 xingyu-app.pyw（本地服务 / 原生后端 / VoxCPM）
- 首次启动自动把浏览器时代的 localStorage 设置迁移进来
- 全屏/关闭通过本地 HTTP 控制接口实现（避开 pywebview js_api 兼容性问题）
"""

import http.server
import importlib.util
import json
import os
import socket
import sys
import threading
import traceback
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
# 桌面端默认开放局域网模式；访问仍由令牌保护。手机扫码体验更简单。
os.environ.setdefault("XINGYU_BIND", "0.0.0.0")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

PROFILE_DIR = os.path.join(ROOT, "webview-data")
MIGRATION_JSON = os.path.join(ROOT, "data", "localstorage-migration.json")
SEED_FLAG = os.path.join(PROFILE_DIR, ".xingyu-seeded")
ICON = os.path.join(ROOT, "xingyu.ico")
DEV_MODE_FLAG = os.path.join(PROFILE_DIR, ".dev-mode")
CONTROL_PORT_BASE = 8630


def load_core():
    """复用原启动器里的服务启动函数（端口探测/静态服务/原生后端/VoxCPM）。"""
    spec = importlib.util.spec_from_file_location(
        "xingyu_core", os.path.join(ROOT, "xingyu-app.pyw")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class WindowControl:
    """本地 HTTP 控制接口：页面 JS 通过 fetch 调用全屏/关闭能力。"""

    def __init__(self, window_holder):
        self.window_holder = window_holder  # {"window": ..., "fullscreen": bool}
        self.port = None
        self.server = None

    def _free_port(self):
        for port in range(CONTROL_PORT_BASE, CONTROL_PORT_BASE + 20):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.2)
                if s.connect_ex(("127.0.0.1", port)) != 0:
                    return port
        raise RuntimeError("没有可用的控制端口")

    def start(self):
        holder = self.window_holder

        def dev_open():
            """立即打开 WebView2 DevTools（并确保其可用）。
            CoreWebView2 只能在 UI 线程访问，所以把整个操作切到窗体线程上执行。"""
            w = holder.get("window")
            if not w:
                return False
            native = getattr(w, "native", None)
            wv = getattr(native, "webview", None) if native else None
            if not wv:
                return False
            try:
                from System import Action
            except Exception:
                return False
            res = {"ok": False}
            def _action():
                try:
                    cw = wv.CoreWebView2
                    if cw:
                        cw.Settings.AreDevToolsEnabled = True
                        cw.OpenDevToolsWindow()
                        res["ok"] = True
                except Exception:
                    res["ok"] = False
            try:
                wv.Invoke(Action(_action))
            except Exception:
                try:
                    wv.BeginInvoke(Action(_action))
                    res["ok"] = True
                except Exception:
                    res["ok"] = False
            return res["ok"]

        class Handler(http.server.BaseHTTPRequestHandler):
            def _origin_allowed(self):
                # 控制接口只接受本机页面发起的跨源调用；普通命令行/无 Origin 请求保留。
                origin = self.headers.get("Origin")
                if not origin:
                    return True
                return origin.startswith(("http://127.0.0.1:", "http://localhost:"))

            def _cors(self):
                origin = self.headers.get("Origin")
                if origin and self._origin_allowed():
                    self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Cache-Control", "no-store")

            def _reply(self, body="ok"):
                data = body.encode("utf-8")
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_OPTIONS(self):
                self.send_response(204)
                self._cors()
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.end_headers()

            def do_GET(self):
                if not self._origin_allowed():
                    self.send_response(403)
                    self._cors()
                    self.end_headers()
                    return
                path = self.path.split("?")[0]
                w = holder.get("window")
                try:
                    if path == "/toggle-fullscreen" and w:
                        w.toggle_fullscreen()
                        holder["fullscreen"] = not holder.get("fullscreen", True)
                        try:
                            w.evaluate_js("window.__xyNativeFullscreen = true;")
                        except Exception:
                            pass
                        self._reply("ok")
                    elif path == "/exit-fullscreen" and w:
                        if holder.get("fullscreen", True):
                            w.toggle_fullscreen()
                            holder["fullscreen"] = False
                        try:
                            w.evaluate_js("window.__xyNativeFullscreen = false;")
                        except Exception:
                            pass
                        self._reply("ok")
                    elif path == "/exit-app":
                        self._reply("ok")
                        if w:
                            threading.Timer(0.2, w.destroy).start()
                    elif path == "/dev-mode":
                        q = parse_qs(urlparse(self.path).query)
                        on = q.get("on", ["0"])[0] in ("1", "true", "True")
                        try:
                            os.makedirs(PROFILE_DIR, exist_ok=True)
                            if on:
                                open(DEV_MODE_FLAG, "w").close()
                                dev_open()
                            else:
                                if os.path.exists(DEV_MODE_FLAG):
                                    os.remove(DEV_MODE_FLAG)
                        except Exception:
                            self._reply("err")
                            return
                        self._reply("ok")
                    elif path == "/wake-agent" and w:
                        # 必须把 evaluate_js 切到 UI 线程；后台线程访问
                        # WebView2 会触发 RemoteDisconnected / 偶发 crash。
                        js = ("window.VoiceAgent && window.VoiceAgent.open(); "
                              "window.VoiceAgent && window.VoiceAgent.listen();")
                        done = {"ok": False, "tried": False}
                        def _on_ui():
                            try:
                                w.evaluate_js(js)
                                done["ok"] = True
                            except Exception:
                                pass
                            finally:
                                done["tried"] = True
                        try:
                            native = getattr(w, "native", None)
                            wv = getattr(native, "webview", None) if native else None
                            from System import Action
                            if wv is not None:
                                wv.Invoke(Action(_on_ui))
                            else:
                                _on_ui()
                        except Exception:
                            _on_ui()
                        if not done["tried"]:
                            self._reply("err")
                            return
                        self._reply("ok")
                    elif path == "/devtools":
                        self._reply("ok" if dev_open() else "no")
                    else:
                        self.send_response(404)
                        self._cors()
                        self.end_headers()
                except Exception:
                    self.send_response(500)
                    self._cors()
                    self.end_headers()

            def log_message(self, *args):
                pass

        self.port = self._free_port()
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", self.port), Handler)
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        return self.port

    def stop(self):
        if self.server:
            try:
                self.server.shutdown()
            except Exception:
                pass


def inject_js(window, control_port):
    js = r"""(function(){
  if (window.__xyNativeInjected) return;
  window.__xyNativeInjected = true;
  window.__xyCtrl = 'http://127.0.0.1:%d';
  function ctrl(path){ try{ fetch(window.__xyCtrl + path, {mode:'cors'}); }catch(e){} }

  // F11: 没有页面级全屏元素时切换窗口全屏；有则交给页面自己的处理
  document.addEventListener('keydown', function(e){
    if (e.key === 'F11' || e.code === 'F11') {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      e.preventDefault(); e.stopImmediatePropagation(); ctrl('/toggle-fullscreen');
    } else if (e.key === 'Escape') {
      // Esc 仅退出窗口全屏；模态框等页面行为不受影响
      if (!document.fullscreenElement && !document.webkitFullscreenElement) ctrl('/exit-fullscreen');
    }
  }, true);

  // 全屏按钮 / 右上角关闭按钮接管
  var fsBtn = document.getElementById('btnFullscreen');
  if (fsBtn) fsBtn.onclick = function(ev){ ev.preventDefault(); ctrl('/toggle-fullscreen'); };
  var closeBtn = document.getElementById('btnCloseWindow');
  if (closeBtn) closeBtn.onclick = function(ev){ ev.preventDefault(); ctrl('/exit-app'); };

  // 兜底：任何 window.close() 调用都真正关闭窗口
  try { window.close = function(){ ctrl('/exit-app'); }; } catch(e){}
})();""" % control_port
    window.evaluate_js(js)


def seed_localstorage(window):
    """首次启动时把浏览器时代的 localStorage 设置迁移进原生窗口。"""
    if os.path.exists(SEED_FLAG) or not os.path.exists(MIGRATION_JSON):
        return
    try:
        with open(MIGRATION_JSON, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return
    if not data:
        os.makedirs(PROFILE_DIR, exist_ok=True)
        open(SEED_FLAG, "w").close()
        return
    payload = json.dumps(data, ensure_ascii=False)
    js = (
        "(function(d){try{var n=0;"
        "for(var k in d){if(localStorage.getItem(k)===null){localStorage.setItem(k,d[k]);n++;}}"
        "console.log('[xingyu] migrated keys:',n);"
        "if(n>0){location.reload();}}catch(e){}})(" + payload + ")"
    )
    try:
        window.evaluate_js(js)
        os.makedirs(PROFILE_DIR, exist_ok=True)
        open(SEED_FLAG, "w").close()
    except Exception:
        traceback.print_exc()


def _smoke_probe(window):
    """冒烟测试：验证注入与迁移结果，稍等落盘后关闭窗口。"""
    try:
        r = window.evaluate_js(
            "JSON.stringify({n: localStorage.length,"
            " theme: localStorage.getItem('zero_theme'),"
            " lang: localStorage.getItem('zero_lang'),"
            " city: localStorage.getItem('zero_wx_city'),"
            " injected: !!window.__xyNativeInjected})"
        )
        print("[smoke] state:", r, flush=True)
    except Exception as e:
        print("[smoke] probe error:", repr(e), flush=True)
    finally:
        threading.Timer(1.5, window.destroy).start()



def _prefer_discrete_gpu():
    """在 Windows「图形设置」里把平台相关进程指定为“高性能 GPU”（即独立/外接显卡）。

    WebView2 真正的渲染进程是 msedgewebview2.exe，而平台本体是 pythonw.exe 启动的，
    所以这里对这几个可执行文件都写入 GpuPreference=2（高性能），让 Windows 自己
    把外接/独立显卡分配给它们，而不是默认省电核显。
    """
    exes = set()
    for exe in (sys.executable, os.path.join(os.path.dirname(sys.executable), "pythonw.exe")):
        exe = os.path.normpath(exe)
        if os.path.isfile(exe):
            exes.add(exe.lower())
    # 顺带把能枚举到的 msedgewebview2.exe 也加入（WebView2 实际渲染进程）
    for env in (r"C:\Program Files (x86)\Microsoft\EdgeWebView\Application",
                r"C:\Program Files\Microsoft\EdgeWebView\Application"):
        if not os.path.isdir(env):
            continue
        try:
            for _ver in os.listdir(env):
                _p = os.path.normpath(os.path.join(env, _ver, "msedgewebview2.exe"))
                if os.path.isfile(_p):
                    exes.add(_p.lower())
        except Exception:
            pass
    if not exes:
        return
    try:
        import winreg
        key = winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER,
                                 r"Software\Microsoft\DirectX\UserGpuPreferences",
                                 0, winreg.KEY_SET_VALUE)
        for _exe in exes:
            winreg.SetValueEx(key, _exe, 0, winreg.REG_SZ, "GpuPreference=2;")
        winreg.CloseKey(key)
    except Exception:
        pass


def _patch_webview2_chromium_args():
    """确保两条关键 Chromium 参数写进环境变量，供 WebView2 Runtime 读取。

    坑（已踩过，别再改回去）：
    早期这里包装 EdgeChrome.__init__，在 orig() 之后把参数追加进
    self.webview.CreationProperties 再赋值回去——**必然抛异常**。因为
    edgechromium.py:120 的 EnsureCoreWebView2Async(None) 在 __init__ 末尾
    已经把初始化跑起来了，此后 CreationProperties 只读：
        System.InvalidOperationException: CreationProperties cannot be
        modified after the initialization of CoreWebView2 has begun.
    异常被 except 吞掉，于是这条路径一直是死代码，从未生效过。

    CreationProperties 唯一有效的时机是 __init__ 内第 92 行赋值之前，而那个
    位置 pywebview 没留钩子；包装 __init__ 也够不到（self.webview 要到 orig()
    里才创建）。因此改为走环境变量：WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
    由 WebView2 Runtime 自身读取，只要在浏览器进程拉起前设置即可
    （本函数在 webview.create_window 之前调用，子进程会继承）。

    1) --autoplay-policy=no-user-gesture-required
       开屏音无需用户手势即可播放，否则无手势时 play() 会被自动播放策略直接拒掉。

    2) --use-fake-ui-for-media-stream
       麦克风 / 摄像头的权限请求自动放行，不弹权限条。原生窗口没有地址栏锁图标，
       一旦 PermissionRequested 事件补丁（见 _patch_webview2_permissions）因
       pythonnet / WebView2 版本差异没挂上，这一条就是第二道保险。
    """
    wanted = (
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream",
    )
    try:
        cur = os.environ.get("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "")
        for flag in wanted:
            if flag.split("=")[0] not in cur:
                cur = (cur + " " + flag).strip()
        os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = cur
        return True
    except Exception:
        traceback.print_exc()
        return False


_patch_webview2_autoplay = _patch_webview2_chromium_args  # 旧名兼容


_PERM_HANDLERS = []  # 保住 .NET 事件委托的引用，防止被 GC 后被静默注销


def _patch_webview2_permissions():
    """自动放行麦克风等权限请求（原生窗口语音功能的必要前提）。

    根因：WebView2 收到麦克风请求时会触发 CoreWebView2.PermissionRequested；
    **若无人订阅该事件，WebView2 一律按「默认拒绝」处理**。pywebview 6.2.1 全程
    没有订阅它（见 webview/platforms/edgechromium.py 的 on_webview_ready），
    而原生窗口既不会自动弹权限条、也没有地址栏锁图标可供手动放行，于是
    SpeechRecognition 必然以 not-allowed 失败——同一个页面在浏览器里能说话，
    进了原生窗口就永远被拒。

    这里包装 EdgeChrome.on_webview_ready：CoreWebView2 就绪后立刻挂上处理函数，
    对麦克风 / 摄像头 / 剪贴板读取直接 Allow，其余权限保持 WebView2 默认行为。
    """
    try:
        from webview.platforms import edgechromium as _ec
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionState as _State
    except Exception:
        traceback.print_exc()
        return False

    cls = getattr(_ec, "EdgeChrome", None)
    if cls is None:
        return False
    orig = cls.on_webview_ready
    if getattr(orig, "_xy_perm_patched", False):
        return True

    # 名称优先（兼容 pythonnet 各版本对枚举 str() 的差异），数值作为兜底
    ALLOW_NAMES = {"Microphone", "Camera", "ClipboardRead", "ScreenCapture", "DisplayCapture"}
    ALLOW_VALUES = {1, 2, 6}  # Microphone / Camera / ClipboardRead

    def _kind_of(args):
        try:
            raw = str(args.PermissionKind)
        except Exception:
            return "", None
        name = raw.split(".")[-1].strip()
        try:
            val = int(raw)
        except Exception:
            val = None
        return name, val

    def _handler(sender, args):
        try:
            name, val = _kind_of(args)
            if name in ALLOW_NAMES or val in ALLOW_VALUES:
                args.State = _State.Allow
        except Exception:
            pass

    def patched(self, sender, args):
        try:
            # pywebview 自己在该回调里用的是 sender.CoreWebView2，self.webview 是
            # 同一个 WebView2 控件（edgechromium.py:61）。两个都试一遍，避免
            # 不同 pywebview 版本把控件挂在别处而挂空。
            cw = None
            for _src in (sender, getattr(self, "webview", None)):
                _c = getattr(_src, "CoreWebView2", None)
                if _c is not None:
                    cw = _c
                    break
            if cw is not None:
                cw.PermissionRequested += _handler
                _PERM_HANDLERS.append(_handler)  # 保持引用，避免被 GC 注销
        except Exception:
            traceback.print_exc()
        return orig(self, sender, args)

    patched._xy_perm_patched = True
    cls.on_webview_ready = patched
    return True


def open_native(url, smoke=False):
    _prefer_discrete_gpu()  # 让 Windows 优先把外接/独立 GPU 分配给本平台及 WebView2
    # 强制 WebView2 全速 GPU 合成/光栅化：嵌入式窗口不是满血浏览器，默认可能被
    # GPU 黑名单或“窗口被遮挡”逻辑降级为软件渲染，导致开屏后界面明显卡顿。
    # 这里显式打开硬件加速与光栅化，并禁止后台/遮挡节流（否则 rAF 被降频到低帧率），
    # 双显卡(Intel 核显直连)下也能稳定出手。
    _base = os.environ.get("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "").split()
    _flags = [
        # —— 视频 / GPU 合成 ——
        "--enable-accelerated-video-decode",
        "--enable-gpu-rasterization",
        "--ignore-gpu-blocklist",
        "--enable-accelerated-2d-canvas",
        "--enable-zero-copy",
        "--enable-native-gpu-memory-buffers",
        "--disable-software-rasterizer",
        "--use-angle=d3d11",
        "--force-high-performance-gpu",   # 强制使用独立/外接显卡，而不是省电核显
        # —— 渲染与合成器不被后台/遮挡节流 ——
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-renderer-throttling",
        # —— 下面两项由 _patch_webview2_chromium_args() 直接写进 CreationProperties
        #     才真正生效；其余各项仅写入环境变量，pywebview 6.2.1 并不消费
        #     （详见 _patch_webview2_chromium_args 的说明）。
        # 1) 允许无用户手势自动播放（开屏音因此得以出声）
        "--autoplay-policy=no-user-gesture-required",
        # 2) 麦克风/摄像头权限自动放行（语音助手不再被 not-allowed 拒掉）
        "--use-fake-ui-for-media-stream",
    ]
    for _f in _flags:
        if _f not in _base:
            _base.append(_f)
    os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = " ".join(_base)
    import webview
    # pywebview 6.2.1 不读上面那个环境变量（见 _patch_webview2_chromium_args 的说明），
    # 必须显式打补丁：否则开屏声会被自动播放策略挡下、麦克风会被权限策略挡下。
    _patch_webview2_chromium_args()
    # 第二道保险：pywebview 不订阅 PermissionRequested，原生窗口里麦克风一律被默认
    # 拒绝，语音助手点下去只会报 not-allowed。这里在 CoreWebView2 就绪后挂上自动放行。
    _patch_webview2_permissions()

    holder = {"window": None, "fullscreen": True}
    control = WindowControl(holder)
    control_port = control.start()

    window = webview.create_window(
        "星屿",
        url,
        fullscreen=not smoke,
        hidden=smoke,
        width=1280,
        height=800,
        background_color="#0b0e14",
        min_size=(960, 600),
    )
    holder["window"] = window

    def on_loaded():
        try:
            inject_js(window, control_port)
            seed_localstorage(window)
        except Exception:
            traceback.print_exc()
        if smoke:
            threading.Timer(3.5, _smoke_probe, (window,)).start()

    window.events.loaded += on_loaded
    dev_mode = os.path.exists(DEV_MODE_FLAG)
    webview.settings["OPEN_DEVTOOLS_IN_DEBUG"] = False  # 不必每次启动都弹调试台，按 F12 手动开
    try:
        webview.start(
            private_mode=False,
            storage_path=PROFILE_DIR,
            icon=ICON if os.path.exists(ICON) else None,
            debug=dev_mode,
        )
    finally:
        control.stop()
    return 0


def main():
    smoke = "--smoke" in sys.argv
    core = load_core()
    try:
        port, should_start = core.choose_port()
        if should_start and not core.start_server(port):
            raise RuntimeError("本地服务启动失败")
        core.start_native()
        core.start_vox_services()
        url = "http://127.0.0.1:%d" % port
    except Exception:
        traceback.print_exc()
        if smoke:
            return 1
        core.main()  # 服务起不来时退回旧浏览器方式
        return 0

    if smoke:
        return open_native(url, smoke=True)
    try:
        return open_native(url)
    except Exception:
        # WebView2 不可用时退回浏览器窗口
        traceback.print_exc()
        try:
            core.open_app(url)
            return 0
        except Exception:
            core.main()
            return 1


if __name__ == "__main__":
    sys.exit(main())


