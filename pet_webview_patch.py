# -*- coding: utf-8 -*-
"""pywebview EdgeChromium 在 WinForms 下的三个坑的修复。

坑 A：WebView2 控件的 Win32 子窗停在 0×0，整个窗什么都不画。
   - 现象：截图里只看到 WinForms form 的 BackColor（例如透明窗默认的 240-gray，
     或 background_color 设的纯色），看不到任何 WebView2 内容。
   - 根因：pywebview EdgeChrome.__init__ 在 form.Controls.Add(self.webview) 之后
     立即 self.webview.Dock = WinForms.DockStyle.Fill。但此时 webview 控件的
     HWND 尚未创建（WinForms 里 Dock 仅对已创建 HWND 的控件起 layout 作用），
     接着 EnsureCoreWebView2Async(None) 异步初始化 WebView2，可能把 Bounds
     重置为 0×0，不会重新走 Dock layout。
   - 修法：在 CoreWebView2InitializationCompleted 回调里强制
     self.webview.Bounds = self.form.ClientRectangle；form.Shown /
     form.Resize 再各补一道，保证最终可见时控件是填满的。

坑 B（2026-09-03 重写）：transparent=True 时整窗变成不透明 240-gray 灰框盖住桌面。
   - 现象：宠物窗里看板娘正常显示，但**窗体本身是不透明灰框**，把桌面完全遮住。
     实测 86.5% 像素是 RGB(240,240,240) = WinForms 默认 COLOR_BTNFACE。
   - 根因：pywebview winforms.py:286-292 的 transparent 分支只设了
        self.browser.DefaultBackgroundColor = Color.Transparent
     其中 self.browser 是 EdgeChrome **Python 包装对象**，设了个无效属性；
     真正的 WebView2 控件是 self.browser.webview ——
     edgechromium.py:113-114 那行设的 self.webview.DefaultBackgroundColor
     倒是没问题，但 form.BackColor 一直没设，沿用 WinForms 默认 240-gray。
     最终：WebView2 层透明是对的，但 form 层是不透明灰，整个窗灰扑扑。
   - 修法：WinForms 真正的透明靠 chromakey ——
        self.form.BackColor = Color.Black
        self.form.TransparencyKey = Color.Black
     把黑色像素抠掉，露出下面的桌面。WebView2 那一层已经是
     Color.Transparent，HTML body 也是 background:transparent —— 端到端透明。
   - 不要做的：
     * form.BackColor = Color.FromArgb(255,0,0,0) — Color.FromArgb 第一个参数是
       alpha=255，**完全不透明**，结果黑框盖住桌面。
     * 在 CoreWebView2InitializationCompleted 里覆盖 self.webview.DefaultBackgroundColor
       — pywebview 的 edgechromium.py:113-114 已经设了 Color.Transparent，
       覆盖它要么破坏初始化顺序变白框，要么重新引入黑框。
     * 干脆什么都不改 — 240-gray 灰框回来。

坑 C（2026-09-03 加）：页面加载完成后，宠物窗里所有新的 HTTP 请求永久 pending。
   - 现象：首屏脚本 / model.json / model.moc 都能拉到，但之后再无任何请求完成
     —— Live2D 的贴图永远等不到，模型加载卡死，看板娘容器停在
     transform: translateY(130%)（窗口外），canvas 一个像素都没有，
     l2d-widget 的「正在加载」提示一直挂着。
   - 根因：pywebview 在 on_webview_ready 里注册了
         CoreWebView2.AddWebResourceRequestedFilter('*', WebResourceContext.All)
     这个「全 URL + 全资源类型」的过滤器让每一个请求都必须往返宿主线程回调
     on_web_resource_request。实测在宠物窗（frameless + transparent + on_top）
     下，这条链路在页面加载完成后就不再放行新请求：
         * data: URL 图片正常加载（不走网络栈）
         * requestAnimationFrame 稳定 144fps（渲染进程没卡）
         * 但任意 http(s) 请求 —— img / XHR / fetch —— 全部无响应，
           XHR 连 readyState=1 都不触发
     摘掉过滤器后同一份代码立刻恢复：贴图 200 加载成功、XHR 走完 rs2→rs3→rs4、
     看板娘正常滑入（截图内容占比 1.74% → 18.97%）。
   - 修法：CoreWebView2InitializationCompleted 之后调用
     RemoveWebResourceRequestedFilter('*', All)。
     护栏：只有 window.events.request_sent 没有任何监听者时才摘——
     这个过滤器是 pywebview 给 request_sent 事件用的，有人监听就不能摘。
     （WebResourceResponseReceived 不受此过滤器影响，无需连带处理。）

⚠️ 已证否、不要再尝试的方案：
   - 注入 WebGL 软件渲染开关（--use-angle=swiftshader 等）：
     pythonnet 不允许给 .NET 类型打补丁，
     ``WebView2.EnsureCoreWebView2Async = ...`` 会抛
     AttributeError('attribute is read-only')，是彻头彻尾的死代码。
     而且实测宠物窗的 WebGL 本来就是硬件 ANGLE（AMD Radeon RX 7600M XT
     D3D11），根本不需要软渲染。

调用：
    import pet_webview_patch  # noqa  安装即生效
    import webview
    ...
"""
import os
import sys
import time

_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pet-debug.log")


def _log(msg):
    """宠物是 .pyw 启动，没有控制台。设 PET_DEBUG_LOG=1 才落日志，默认静默。"""
    if not os.environ.get("PET_DEBUG_LOG"):
        return
    try:
        with open(_LOG, "a", encoding="utf-8") as f:
            f.write("%s %s\n" % (time.strftime("%H:%M:%S"), msg))
    except Exception:
        pass


_PATCH_APPLIED = False


def _patch():
    global _PATCH_APPLIED
    if _PATCH_APPLIED:
        return
    _PATCH_APPLIED = True

    try:
        from webview.platforms import edgechromium as _ec
    except Exception:
        return

    _orig_init = _ec.EdgeChrome.__init__

    def _new_init(self, form, window, cache_dir):
        _orig_init(self, form, window, cache_dir)
        try:
            from System.Drawing import Rectangle, Color

            def _force_bounds():
                try:
                    cs = self.form.ClientSize
                    if not cs.Width or not cs.Height:
                        return
                    self.webview.Bounds = Rectangle(0, 0, int(cs.Width), int(cs.Height))
                    self.webview.BringToFront()
                except Exception:
                    pass

            # ---- 坑 B（重写）：WinForms 透明靠 chromakey，不是靠涂色 ----
            #
            #    ⚠️ 历史坑，别再踩：
            #    - 早先看到 240-gray，以为是 form.BackColor 没设，涂成 Color.Black
            #      → 变成「不透明黑框」，桌面被整个盖住。
            #    - 后来改成 DefaultBackgroundColor = Color.FromArgb(255,0,0,0)，
            #      以为 alpha=255 是透明 —— 其实 Color.FromArgb 第一个参数是 alpha，
            #      255 = 完全不透明，照样是黑框。
            #    - 再改成 Color.Transparent 也不行：会覆盖掉 pywebview 自己在
            #      edgechromium.py:113-114 设的值，而且 form 层还是不透明，
            #      实测变「白框」。
            #    - 干脆不改 → 回到 240-gray 灰框（实测 86.5% 像素是 RGB(240,240,240)）。
            #
            #    根因：pywebview winforms.py:286-292 的 transparent 分支只设了
            #        self.browser.DefaultBackgroundColor = Color.Transparent
            #    而 self.browser 是 EdgeChrome 这个 **Python 包装对象**，
            #    真正的 WebView2 控件是 self.browser.webview ——
            #    这行赋值等于给 Python 对象加了个没人读的属性，完全无效，
            #    于是 form.BackColor 一直沿用 WinForms 默认的 240-gray。
            #    （WebView2 层反而是对的：edgechromium.py:113-114 已经给
            #     self.webview.DefaultBackgroundColor 设了 Color.Transparent。）
            #
            #    修法：WinForms 要让窗体透明，标准做法是 chromakey ——
            #    BackColor 设成要抠掉的颜色，TransparencyKey 设成同色，
            #    该颜色的像素会被抠成透明，露出下面的桌面。
            def _fix_transparency():
                try:
                    if not getattr(window, "transparent", False):
                        return
                    self.form.BackColor = Color.Black
                    self.form.TransparencyKey = Color.Black
                    # WebView2 层的 DefaultBackgroundColor 由 pywebview 自己管，
                    # 这里一个字都别动（覆盖它反而会变白框）。
                except Exception:
                    _log("坑B 失败: 无 TransparencyKey 支持")

            # ---- 坑 C：摘掉全局资源请求过滤器 ----
            def _drop_resource_filter():
                try:
                    from Microsoft.Web.WebView2.Core import (
                        CoreWebView2WebResourceContext as _Ctx,
                    )
                    # 护栏：这个过滤器是 pywebview 给 request_sent 事件用的，
                    # 有人监听就绝对不能摘，否则它的回调再也不触发。
                    try:
                        n = len(window.events.request_sent)
                    except Exception:
                        n = 0
                    if n:
                        _log("坑C: request_sent 有 %d 个监听者，保留过滤器" % n)
                        return
                    self.webview.CoreWebView2.RemoveWebResourceRequestedFilter(
                        "*", _Ctx.All
                    )
                    _log("坑C: 已摘除 WebResourceRequested 过滤器")
                except Exception as e:
                    _log("坑C 失败: %r" % (e,))

            self._force_bounds = _force_bounds

            _orig_ready = self.on_webview_ready

            def _new_ready(sender, args):
                _orig_ready(sender, args)
                _fix_transparency()
                _force_bounds()
                _drop_resource_filter()

            self.on_webview_ready = _new_ready
            try:
                self.webview.CoreWebView2InitializationCompleted -= _orig_ready
                self.webview.CoreWebView2InitializationCompleted += _new_ready
            except Exception:
                pass

            try:
                self.form.Shown += lambda s, e: (_fix_transparency(), _force_bounds())
            except Exception:
                pass
            try:
                self.form.Resize += lambda s, e: _force_bounds()
            except Exception:
                pass
        except Exception as e:
            _log("init 失败: %r" % (e,))
            sys.stderr.write("[pet_webview_patch] init failed: %s\n" % e)

    _ec.EdgeChrome.__init__ = _new_init


_patch()
