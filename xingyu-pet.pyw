# -*- coding: utf-8 -*-
"""星屿桌面宠物：pywebview 无边框透明窗，常驻置顶，支持 Live2D / AIRI Runtime。

单实例约定（2026-09-03 加固）：
- 锁端口 8640 同时是控制通道：已运行时再点"桌面宠物"，
  server 会连上来发 b"SHOW"，持锁窗口把自己带回前台。
- webview.start() 返回后 os._exit(0)，保证端口随进程退出释放，
  不再出现"残留进程占锁 → 之后再点永远没反应"的死局。

⚠️ 必须在 import webview 之前 import pet_webview_patch：
   pywebview EdgeChrome.__init__ 是动态打包的，patch 要趁 webview.start()
   还没启动 GUI 消息循环前装好。import 时机之后即它。
"""
import pet_webview_patch  # noqa: F401  必须先于 webview

import os
import socket
import threading
import webview

ROOT = os.path.dirname(os.path.abspath(__file__))
URL = "http://127.0.0.1:8620/agent-pet.html"
PROFILE = os.path.join(ROOT, "webview-data", "pet")
LOCK_PORT = 8640
_lock = None


class PetApi:
    def __init__(self):
        self.window = None
        self.mode = "live2d"

    def set_mode(self, mode):
        self.mode = "airi" if mode == "airi" else "live2d"
        return self.mode

    def close_pet(self):
        try:
            self.window.destroy()
        except Exception:
            pass


def _lock_server(api):
    """锁端口复用为控制通道：SHOW = 把宠物窗带回前台。"""
    while True:
        try:
            conn, _ = _lock.accept()
        except OSError:
            break
        try:
            conn.settimeout(0.5)
            data = conn.recv(64).decode("utf-8", "ignore")
        except Exception:
            data = ""
        if data.startswith("SHOW"):
            try:
                api.window.restore()
            except Exception:
                pass
            try:
                api.window.show()
            except Exception:
                pass
        try:
            conn.close()
        except Exception:
            pass


def main():
    global _lock
    try:
        _lock = socket.socket()
        _lock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        _lock.bind(("127.0.0.1", LOCK_PORT))
        _lock.listen(4)
    except OSError:
        return  # 已有实例在跑；由 launcher 走 SHOW 通道唤起

    os.makedirs(PROFILE, exist_ok=True)
    api = PetApi()
    # 远程调试端口：set REMOTE_DEBUGGING_PORT=0 关闭。
    # 设 9229 后，http://127.0.0.1:9229/json 可枚举 Page target，CDP 协议连进去
    # 看 DOM / console / network，调试「宠物窗里 WebView2 画不出内容」用。
    if os.environ.get("REMOTE_DEBUGGING_PORT"):
        webview.settings["REMOTE_DEBUGGING_PORT"] = int(os.environ["REMOTE_DEBUGGING_PORT"])
    window = webview.create_window(
        "XingyuPet",   # ASCII 标题，方便自动化按窗口标题探针；UI 里的徽章仍是中文
        URL,
        js_api=api,
        width=330,
        height=470,
        min_size=(260, 380),
        frameless=True,
        easy_drag=True,
        transparent=True,
        on_top=True,
        shadow=False,
        resizable=True,
        background_color="#000000",
    )
    api.window = window
    threading.Thread(target=_lock_server, args=(api,), daemon=True).start()
    webview.start(private_mode=False, storage_path=PROFILE)
    # 无论正常关闭还是 destroy，都必须把端口交还给系统
    os._exit(0)


if __name__ == "__main__":
    main()