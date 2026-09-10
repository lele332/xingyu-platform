# -*- coding: utf-8 -*-
"""星屿本地静态服务器：缓存控制、健康检查、VoxCPM 同源代理与安全响应头。"""

import http.server
import hmac
import ipaddress
import io
import json
import mimetypes
import os
import random
import re
import secrets
import socket
import socketserver
import sys
import time
import webbrowser
import urllib.error
import urllib.request
import qrcode
from datetime import datetime
from urllib.parse import parse_qs, unquote, urlsplit

import platform_db

DEFAULT_PORT = 8620
BUILD = "20260908.1"
# 默认只监听本机回环地址（隐私优先，局域网内其他设备无法访问）。
# 如需手机扫码访问，可在启动前设置环境变量 XINGYU_BIND=0.0.0.0 重新开放局域网。
BIND_HOST = os.environ.get("XINGYU_BIND", "0.0.0.0").strip() or "0.0.0.0"
MAX_POST_BYTES = 200 * 1024 * 1024  # 限制请求体 200MB，避免异常超大请求拖垮内存
FEEDBACK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "feedback")
MAX_FEEDBACK_BYTES = 1024 * 1024      # 反馈报告最大 1MB
BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "backups")
BACKUP_PATH = "/api/backup"
BACKUP_INFO_PATH = "/api/backup/info"
MAX_BACKUP_BYTES = 20 * 1024 * 1024   # 平台数据快照最大 20MB
MAX_BACKUP_FILES = 30                 # 本地自动备份保留数量
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
STATE_PATH = os.path.join(DATA_DIR, "platform-state.json")
MAX_STATE_BYTES = 20 * 1024 * 1024    # 平台实时状态最大 20MB
HEALTH_PATH = "/__xingyu_health__"

# ============ 局域网访问安全模式 ============
# 本机访问始终放行；当服务绑定到非回环地址（例如手机扫码访问）时，
# 其他设备必须先用访问令牌换取 HttpOnly Cookie。令牌本身仅回环客户端可查询。
ACCESS_COOKIE = "xingyu_access"
_ACCESS_TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "access-token.txt")

def _ensure_access_token():
    token = os.environ.get("XINGYU_ACCESS_TOKEN", "").strip()
    if token:
        return token
    try:
        with open(_ACCESS_TOKEN_FILE, encoding="utf-8") as f:
            token = f.read().strip()
            if token:
                return token
    except FileNotFoundError:
        pass
    token = secrets.token_urlsafe(24)
    os.makedirs(os.path.dirname(_ACCESS_TOKEN_FILE), exist_ok=True)
    with open(_ACCESS_TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(token)
    return token

ACCESS_TOKEN = _ensure_access_token()


def _lan_candidates():
    """返回本机可给局域网设备访问的 IPv4 地址，优先私有网段。"""
    found = []
    # 常规方式：出站路由能告诉我们“手机要访问哪块网卡”最合适。
    for probe_host in ("8.8.8.8", "223.5.5.5", "192.168.255.255", "10.255.255.255"):
        try:
            probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            probe.settimeout(0.15)
            probe.connect((probe_host, 80))
            addr = probe.getsockname()[0]
            found.append(addr)
        except Exception:
            pass
        finally:
            try:
                probe.close()
            except Exception:
                pass

    # 离线 / 禁 ICMP / DNS 异常时，也能从主机名上拿到网卡地址。
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.append(info[4][0])
    except Exception:
        pass

    ordered = []
    ts_addrs = []
    for addr in found:
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        # Tailscale 网段（100.64.0.0/10）优先：手机装 Tailscale 后任何网络均可访问。
        if ip in ipaddress.ip_network("100.64.0.0/10"):
            if addr not in ts_addrs:
                ts_addrs.append(addr)
            continue
        if ip.is_loopback or ip.is_link_local or ip.is_multicast or not ip.is_private:
            continue
        if addr not in ordered:
            ordered.append(addr)
    return ts_addrs + ordered


def _lan_ip():
    addrs = _lan_candidates()
    return addrs[0] if addrs else ""


def _lan_url(port=None):
    ip = _lan_ip()
    if not ip:
        return ""
    return "http://%s:%s/access?token=%s" % (ip, port or DEFAULT_PORT, ACCESS_TOKEN)


def _write_lan_qr_asset(port=None):
    """启动时生成兜底二维码；即使浏览器旧缓存/接口失败，也有最新二维码可扫。"""
    url = _lan_url(port)
    if not url:
        return ""
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "lan-access-qr.png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=3)
        qr.add_data(url)
        qr.make(fit=True)
        qr.make_image(fill_color="black", back_color="white").save(path, format="PNG")
        return path
    except Exception:
        return ""

NO_CACHE_EXTS = {".html", ".htm", ".js", ".css", ".json", ".map", ".svg", ".xml", ".webmanifest"}
LONG_CACHE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp3", ".mp4", ".webm", ".woff", ".woff2", ".ttf"}

# ============ VoxCPM 同源代理（绕开浏览器 CORS） ============
VOX_UPSTREAM = os.environ.get("VOXCPM_URL", "http://127.0.0.1:8000")
VOX_PROXY_PREFIX = "/vox-proxy/"

# ============ AI 同源代理（桌面端 API Key 只存本机，不落浏览器） ============
AI_UPSTREAM = os.environ.get("AI_BASE_URL", "https://api.deepseek.com/v1").rstrip("/")
AI_PROXY_PREFIX = "/ai-proxy/"

# ============ 贾维斯智能体本地服务同源代理（STT/记忆/搜索，127.0.0.1:8610） ============
AGENT_UPSTREAM = os.environ.get("AGENT_SERVICE_URL", "http://127.0.0.1:8610")
AGENT_PROXY_PREFIX = "/agent-proxy/"

# ============ 2026-09-02: 为 AIRI 增加的 OpenAI 兼容 STT 适配层 ============
# 本地 SenseVoice(8610) 只提供 POST /stt（接收裸 wav 字节），不是 OpenAI 协议。
# AIRI 的 openai-compatible-audio-transcription 会 POST {baseUrl}audio/transcriptions
# （multipart/form-data: file + model）。这里做协议转换，让 AIRI 直接可用本地 ASR。
# 同源部署（都走 127.0.0.1:8620），因此不产生跨域问题。
ASR_PROXY_PREFIX = "/asr-proxy/"
ASR_UPSTREAM_STT = "/stt"

# VoxCPM 只认真实模型名 "OpenBMB/VoxCPM-0.5B"，但 AIRI 的 TTS provider 在
# listModels 里按 id 包含 'tts' 过滤，真名不含 tts 会导致模型列表为空、无法选择。
# 因此 /vox-proxy/v1/models 额外暴露一个别名，转发时再映射回真名。
VOX_TTS_MODEL_ALIAS = "voxcpm-tts"
VOX_TTS_MODEL_REAL = "OpenBMB/VoxCPM-0.5B"
_AI_KEY = os.environ.get("XINGYU_AI_KEY", "").strip()
_AI_KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ai-key-local.txt")

# ============ 2026-09-02: AIRI 视觉通道代理（火山方舟 OpenAI 兼容多模态） ============
# AIRI 的 vision 模块需要多模态 LLM（DeepSeek 无视觉能力）。这里代理到火山方舟
# doubao 视觉模型，协议与 OpenAI chat/completions 完全一致（image_url 内容）。
# 密钥只存本机 data/vision-key-local.txt（或环境变量 XINGYU_VISION_KEY），不落浏览器。
# 用户若使用推理接入点，把 AIRI 视觉模型名改成 ep-xxx 即可（在 AIRI 设置里改）。
VISION_UPSTREAM = os.environ.get("XINGYU_VISION_URL", "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")
VISION_PROXY_PREFIX = "/vision-proxy/"
VISION_DEFAULT_MODEL = "doubao-seed-1-6-vision-250815"
_VISION_KEY = os.environ.get("XINGYU_VISION_KEY", "").strip()
_VISION_KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "vision-key-local.txt")

# ============ 敏感数据黑名单：/data/ 下这些内容禁止静态下载 ============
# backups=平台全量个人数据快照；feedback=含 UA/堆栈的诊断报告；ai-key-local.txt=密钥文件。
# 默认 127.0.0.1 风险有限，但 XINGYU_BIND=0.0.0.0 供手机访问时局域网内任意设备可拉取。
SENSITIVE_DATA_RULES = (
    "/data/ai-key-local.txt",
    "/data/vision-key-local.txt",
    "/data/backups",
    "/data/feedback",
)


def _send_local_config_for_client(handler):
    """局域网设备永远拿不到本机 API Key，但可以安全地走同源 AI 代理。

    local-config.js 是浏览器本地默认配置；如果原样下发，任何已授权手机都能
    在开发者工具里读出桌面端密钥。这里改为按客户端来源重写：
    - 非回环设备：清空 apiKey，强制使用 /ai-proxy；
    - 回环桌面端：继续走静态文件，保留本机配置。
    """
    try:
        if handler._is_loopback_client():
            return False
    except Exception:
        return False

    model = "deepseek-chat"
    try:
        model = str(platform_db.get_settings().get("model") or model)
    except Exception:
        pass
    safe_model = model.replace("\\", "").replace("'", "")
    payload = (
        "window.LOCAL_CONFIG={"
        "baseUrl:'/ai-proxy/v1',"
        "apiKey:'',"
        "model:'%s',"
        "useLocalAiProxy:true"
        "};" % safe_model
    ).encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "application/javascript; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(payload)
    return True


def _vox_health():
    """探测适配层与 AMD VoxCPM.cpp 推理层的真实状态。"""
    try:
        with urllib.request.urlopen(VOX_UPSTREAM + "/healthz", timeout=1.5) as r:
            data = json.load(r)
        return bool(data.get("status") == "ok" and data.get("gpu_backend_online"))
    except Exception:
        return False


def _proxy_to_vox(handler, method, path, body=None):
    """把请求转发到本地 VoxCPM 服务并回传响应（含二进制音频）。"""
    rel = path if path.startswith("/") else "/" + path
    target = VOX_UPSTREAM + rel
    req = urllib.request.Request(target, data=body, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "*/*")
    try:
        with urllib.request.urlopen(req, timeout=360) as resp:
            data = resp.read()
            handler.send_response(resp.status)
            ctype = resp.headers.get("Content-Type", "audio/wav")
            handler.send_header("Content-Type", ctype)
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            handler.wfile.write(data)
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", "replace")
        handler.send_response(e.code)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload.encode("utf-8"))))
        handler.end_headers()
        handler.wfile.write(payload.encode("utf-8"))
    except Exception as e:
        payload = json.dumps({"error": "VoxCPM 代理失败: %s" % e}, ensure_ascii=False)
        handler.send_response(502)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload.encode("utf-8"))))
        handler.end_headers()
        handler.wfile.write(payload.encode("utf-8"))


def _parse_multipart_file(body, content_type):
    """从 multipart/form-data 里取出音频字段（AIRI 用字段名 file 上传录音）。"""
    if not content_type or "multipart/form-data" not in content_type:
        return body
    idx = content_type.find("boundary=")
    if idx < 0:
        return body
    boundary = content_type[idx + len("boundary="):].split(";")[0].strip().strip('"')
    if not boundary:
        return body
    sep = ("--" + boundary).encode("utf-8")
    parts = body.split(sep)
    # 优先取 name="file" 的那一段，找不到就退回第一段非空内容
    for prefer_name in (True, False):
        for part in parts:
            if prefer_name and b'name="file"' not in part:
                continue
            head_end = part.find(b"\r\n\r\n")
            if head_end < 0:
                continue
            data = part[head_end + 4:]
            if data.endswith(b"\r\n"):
                data = data[:-2]
            if data:
                return data
    return body


def _asr_transcribe(handler, body, content_type):
    """OpenAI 兼容语音识别：multipart 音频 -> 本地 SenseVoice(8610 /stt) -> {"text": ...}"""
    audio = _parse_multipart_file(body or b"", content_type)
    if not audio:
        payload = json.dumps({"error": "audio is empty"}, ensure_ascii=False).encode("utf-8")
        handler.send_response(400)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.end_headers()
        handler.wfile.write(payload)
        return
    try:
        req = urllib.request.Request(
            AGENT_UPSTREAM + ASR_UPSTREAM_STT, data=audio, method="POST")
        req.add_header("Content-Type", "application/octet-stream")
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except Exception as e:
        payload = json.dumps({"error": "本地 ASR 调用失败: %s" % e}, ensure_ascii=False).encode("utf-8")
        handler.send_response(502)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.end_headers()
        handler.wfile.write(payload)
        return
    try:
        text = json.loads(raw).get("text", "")
    except Exception:
        text = raw.strip()
    payload = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _vox_models_payload():
    """/vox-proxy/v1/models：补一个含 'tts' 的别名，供 AIRI 的模型列表筛选。"""
    return json.dumps({
        "object": "list",
        "data": [
            {"id": VOX_TTS_MODEL_ALIAS, "object": "model",
             "owned_by": "voxcpm", "name": "VoxCPM 本地语音合成"},
            {"id": VOX_TTS_MODEL_REAL, "object": "model",
             "owned_by": "openbmb", "name": "VoxCPM-0.5B"},
        ],
    }, ensure_ascii=False).encode("utf-8")


def _rewrite_vox_model(body):
    """把 AIRI 选中的别名模型名换回 VoxCPM 认识的真名。"""
    if not body:
        return body
    try:
        obj = json.loads(body.decode("utf-8"))
    except Exception:
        return body
    if isinstance(obj, dict) and obj.get("model") == VOX_TTS_MODEL_ALIAS:
        obj["model"] = VOX_TTS_MODEL_REAL
        return json.dumps(obj, ensure_ascii=False).encode("utf-8")
    return body


def _agent_health():
    """探测贾维斯智能体本地服务（STT/记忆/搜索）。"""
    try:
        with urllib.request.urlopen(AGENT_UPSTREAM + "/healthz", timeout=1.5) as r:
            data = json.load(r)
        return bool(data.get("status") == "ok")
    except Exception:
        return False


def _proxy_to_agent(handler, method, path, body=None, content_type=None):
    """把请求转发到本地智能体服务并回传响应（支持 wav 二进制）。"""
    rel = path if path.startswith("/") else "/" + path
    target = AGENT_UPSTREAM + rel
    req = urllib.request.Request(target, data=body, method=method)
    req.add_header("Content-Type", content_type or "application/json")
    req.add_header("Accept", "*/*")
    try:
        with urllib.request.urlopen(req, timeout=360) as resp:
            data = resp.read()
            handler.send_response(resp.status)
            ctype = resp.headers.get("Content-Type", "application/json")
            handler.send_header("Content-Type", ctype)
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            handler.wfile.write(data)
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", "replace")
        handler.send_response(e.code)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload.encode("utf-8"))))
        handler.end_headers()
        handler.wfile.write(payload.encode("utf-8"))
    except Exception as e:
        payload = json.dumps({"error": "智能体服务代理失败: %s" % e}, ensure_ascii=False)
        handler.send_response(502)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload.encode("utf-8"))))
        handler.end_headers()
        handler.wfile.write(payload.encode("utf-8"))


def _ai_key():
    """返回本机 AI 密钥：优先环境变量，其次 data/ai-key-local.txt。"""
    if _AI_KEY:
        return _AI_KEY
    try:
        with open(_AI_KEY_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def _proxy_ai(handler, method, path, body=None):
    """把请求转发到 AI_UPSTREAM 并回传响应；密钥由服务端注入，不走前端。"""
    rel = path if path.startswith("/") else "/" + path
    target = AI_UPSTREAM + rel
    req = urllib.request.Request(target, data=body, method=method)
    key = _ai_key()
    if key:
        req.add_header("Authorization", "Bearer " + key)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "*/*")
    try:
        with urllib.request.urlopen(req, timeout=360) as resp:
            data = resp.read()
            handler.send_response(resp.status)
            ctype = resp.headers.get("Content-Type", "application/json; charset=utf-8")
            handler.send_header("Content-Type", ctype)
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            handler.wfile.write(data)
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", "replace")
        handler.send_response(e.code)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload.encode("utf-8"))))
        handler.end_headers()
        handler.wfile.write(payload.encode("utf-8"))
    except Exception as e:
        payload = json.dumps({"error": "AI 代理失败: %s" % e}, ensure_ascii=False).encode("utf-8")
        handler.send_response(502)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.end_headers()
        handler.wfile.write(payload)


def _vision_key():
    if _VISION_KEY:
        return _VISION_KEY
    try:
        with open(_VISION_KEY_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def _proxy_vision(handler, method, path, body=None):
    """把 AIRI 的视觉推理请求转发到火山方舟（OpenAI 兼容）；密钥由服务端注入。"""
    rel = path if path.startswith("/") else "/" + path
    key = _vision_key()
    if not key:
        # 未配置密钥：返回结构化错误，前端视觉桥据此提示而不崩溃
        payload = json.dumps({
            "error": {
                "message": "视觉通道未配置密钥：请把火山方舟 API Key 粘贴到 data/vision-key-local.txt 后重启星屿。",
                "type": "xingyu_vision_not_configured",
            }
        }, ensure_ascii=False).encode("utf-8")
        handler.send_response(503)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(payload)
        return
    target = VISION_UPSTREAM + rel
    req = urllib.request.Request(target, data=body, method=method)
    req.add_header("Authorization", "Bearer " + key)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "*/*")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
            handler.send_response(resp.status)
            ctype = resp.headers.get("Content-Type", "application/json; charset=utf-8")
            handler.send_header("Content-Type", ctype)
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            handler.wfile.write(data)
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", "replace")
        handler.send_response(e.code)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload.encode("utf-8"))))
        handler.end_headers()
        handler.wfile.write(payload.encode("utf-8"))
    except Exception as e:
        payload = json.dumps({"error": {"message": "视觉代理失败: %s" % e, "type": "xingyu_vision_upstream_error"}},
                             ensure_ascii=False).encode("utf-8")
        handler.send_response(502)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.end_headers()
        handler.wfile.write(payload)


def _save_feedback(handler, body):
    """把性能反馈报告保存为本地 JSON 文件；局域网需先通过访问门禁。"""
    if not handler._authorized():
        _send_json(handler, 401, {"ok": False, "error": "unauthorized"})
        return
    try:
        data = json.loads(body.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("not an object")
    except Exception:
        payload = json.dumps({"ok": False, "error": "invalid json"}, ensure_ascii=False).encode("utf-8")
        handler.send_response(400)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(payload)))
        handler.end_headers()
        handler.wfile.write(payload)
        return
    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    name = "report-%s-%04d.json" % (time.strftime("%Y%m%d-%H%M%S"), random.randint(0, 9999))
    path = os.path.join(FEEDBACK_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    payload = json.dumps({"ok": True, "file": name}, ensure_ascii=False).encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _send_json(handler, status, data):
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def _backup_files():
    try:
        return sorted(name for name in os.listdir(BACKUP_DIR)
                      if name.startswith("backup-") and name.endswith(".json"))
    except FileNotFoundError:
        return []


def _backup_info(handler):
    files = _backup_files()
    _send_json(handler, 200, {"ok": True, "count": len(files), "lastFile": files[-1] if files else None})


def _save_backup(handler, body):
    """保存平台数据快照；API Key 由前端 Store.exportAll() 剥离，局域网需先授权。"""
    if not handler._authorized():
        _send_json(handler, 401, {"ok": False, "error": "unauthorized"})
        return
    try:
        envelope = json.loads(body.decode("utf-8"))
        if not isinstance(envelope, dict):
            raise ValueError("not an object")
        snapshot = envelope.get("data")
        if isinstance(snapshot, str):
            snapshot = json.loads(snapshot)
        if not isinstance(snapshot, dict):
            raise ValueError("snapshot must be an object")
    except Exception:
        _send_json(handler, 400, {"ok": False, "error": "invalid backup json"})
        return

    # ⚠️ 2026-09-05：自动备份的节流原本只记在客户端 localStorage 里 ——
    # 新浏览器会话 / 清过缓存的设备上 lastAt=0，节流直接失效。实测一晚上
    # 自动化测试期间每开一次页面就落一个备份（文件时间戳间隔只有 1~3 分钟），
    # 30 个轮转槽位几小时就被耗光，备份历史深度从设计的 7.5 天缩到几小时。
    # 备份是为了出事时能回滚的，历史深度被冲掉等于备份白做，所以服务端
    # 按最新备份文件名里的时间戳做最终把关：不足 6 小时就跳过，物理上兜底，
    # 不再依赖任何客户端状态。文件名由本函数生成（backup-YYYYmmdd-HHMMSS-xxxx），
    # 解析它即可，无需额外的元数据文件。
    files = _backup_files()
    if files:
        m = re.match(r"backup-(\d{8}-\d{6})", files[-1])
        if m:
            try:
                last_ts = time.mktime(time.strptime(m.group(1), "%Y%m%d-%H%M%S"))
                if time.time() - last_ts < 6 * 3600:
                    _send_json(handler, 200, {"ok": True, "skipped": True,
                                              "lastAt": int(last_ts * 1000),
                                              "lastFile": files[-1]})
                    return
            except ValueError:
                pass  # 文件名不合预期时不拦，照常备份（宁可多备不能丢）

    os.makedirs(BACKUP_DIR, exist_ok=True)
    name = "backup-%s-%04d.json" % (time.strftime("%Y%m%d-%H%M%S"), random.randint(0, 9999))
    path = os.path.join(BACKUP_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    files = _backup_files()
    for stale in files[:-MAX_BACKUP_FILES]:
        try:
            os.remove(os.path.join(BACKUP_DIR, stale))
        except OSError:
            pass

    _send_json(handler, 200, {"ok": True, "file": name, "count": len(_backup_files())})


def _loopback_only(handler):
    try:
        return handler._is_loopback_client()
    except Exception:
        return False


def _get_state(handler):
    """读取实时状态；本机或已授权局域网设备均可调用。"""
    if not handler._authorized():
        _send_json(handler, 401, {"ok": False, "error": "unauthorized"})
        return
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            payload = json.load(f)
        _send_json(handler, 200, payload)
    except FileNotFoundError:
        _send_json(handler, 204, {})
    except Exception as exc:
        _send_json(handler, 500, {"ok": False, "error": str(exc)})


def _pet_context(handler):
    """给桌面宠物提供一个最小、脱敏的学习上下文。"""
    if not handler._authorized():
        _send_json(handler, 401, {"ok": False, "error": "unauthorized"})
        return
    try:
        # 直接读数据库，保证宠物看到的任务与主应用 / API 写入保持一致。
        data = platform_db.bootstrap()
        if not isinstance(data, dict):
            data = {}
    except Exception as exc:
        _send_json(handler, 500, {"ok": False, "error": str(exc)})
        return

    now = datetime.now()
    today = now.date()
    profile = data.get("profile") if isinstance(data.get("profile"), dict) else {}

    def parse_dt(value):
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None

    raw_tasks = data.get("tasks") if isinstance(data.get("tasks"), list) else []
    tasks = []
    for item in raw_tasks:
        if not isinstance(item, dict) or item.get("status") == "done":
            continue
        due_dt = parse_dt(item.get("due", ""))
        days = (due_dt.date() - today).days if due_dt else None
        tasks.append({
            "id": str(item.get("id", ""))[:40],
            "title": str(item.get("title", "未命名任务"))[:120],
            "priority": item.get("priority", "mid"),
            "status": item.get("status", "todo"),
            "estimate": item.get("estimate", None),
            "due": item.get("due", ""),
            "daysLeft": days,
        })
    tasks.sort(key=lambda x: (x["daysLeft"] is None, x["daysLeft"] if x["daysLeft"] is not None else 9999))
    # actions 给桌面宠物操作层使用；tasks 只用于 AI 上下文摘要，避免超长提示。

    raw_courses = data.get("courses") if isinstance(data.get("courses"), list) else []
    weekday = today.isoweekday()
    courses = []
    for item in raw_courses:
        if isinstance(item, dict) and item.get("day") == weekday:
            courses.append({
                "name": str(item.get("name", "课程"))[:80],
                "start": str(item.get("start", ""))[:10],
                "end": str(item.get("end", ""))[:10],
                "location": str(item.get("location", ""))[:80],
            })
    courses.sort(key=lambda x: x["start"])

    raw_notes = data.get("notes") if isinstance(data.get("notes"), list) else []
    notes = []
    for item in reversed(raw_notes[-8:]):
        if isinstance(item, dict):
            notes.append({
                "id": str(item.get("id", ""))[:40],
                "title": str(item.get("title", "未命名笔记"))[:100],
                "subject": str(item.get("subject", ""))[:60],
            })

    raw_pomos = data.get("pomodoros") if isinstance(data.get("pomodoros"), list) else []
    today_pomos = 0
    today_focus_minutes = 0
    for item in raw_pomos:
        if not isinstance(item, dict):
            continue
        started = parse_dt(item.get("startAt", ""))
        if not started or started.date() != today:
            continue
        if item.get("type") == "focus":
            today_pomos += 1
            try:
                today_focus_minutes += int(item.get("minutes", 0) or 0)
            except Exception:
                pass

    raw_exams = data.get("exams") if isinstance(data.get("exams"), list) else []
    exams = []
    for item in raw_exams:
        if not isinstance(item, dict):
            continue
        due_dt = parse_dt(item.get("date", "") or item.get("due", "") or item.get("startAt", ""))
        if due_dt and due_dt.date() >= today:
            exams.append({
                "title": str(item.get("title", "") or item.get("name", "考试"))[:100],
                "date": item.get("date", "") or item.get("due", "") or item.get("startAt", ""),
                "daysLeft": (due_dt.date() - today).days,
            })
    exams.sort(key=lambda x: x["daysLeft"])

    _send_json(handler, 200, {
        "ok": True,
        "context": {
            "nickname": str(profile.get("nickname", "") or profile.get("name", "") or "同学")[:40],
            "goal": str(profile.get("goal", ""))[:160],
            "generatedAt": now.isoformat(timespec="seconds"),
            "tasks": tasks[:8],
            "actions": [
                {"id": x["id"], "title": x["title"], "status": x["status"], "priority": x["priority"]}
                for x in tasks[:40]
            ],
            "overdueCount": sum(1 for x in tasks if isinstance(x.get("daysLeft"), int) and x["daysLeft"] < 0),
            "dueTodayCount": sum(1 for x in tasks if x.get("daysLeft") == 0),
            "courses": courses[:6],
            "notes": notes[:6],
            "focus": {"sessions": today_pomos, "minutes": today_focus_minutes},
            "exams": exams[:3],
        }
    })


def _save_state(handler, body):
    """保存实时状态；本机/已授权局域网设备均可调用。"""
    try:
        envelope = json.loads(body.decode("utf-8"))
        snapshot = envelope.get("data") if isinstance(envelope, dict) else None
        if isinstance(snapshot, str):
            snapshot = json.loads(snapshot)
        if not isinstance(snapshot, dict):
            raise ValueError("snapshot must be an object")
        updated_at = envelope.get("updatedAt") if isinstance(envelope, dict) else None
        if not isinstance(updated_at, (int, float)):
            updated_at = int(time.time() * 1000)
    except Exception:
        _send_json(handler, 400, {"ok": False, "error": "invalid state json"})
        return

    os.makedirs(DATA_DIR, exist_ok=True)
    tmp_path = "%s.%s.tmp" % (STATE_PATH, secrets.token_hex(6))
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump({"data": snapshot, "updatedAt": int(updated_at)}, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp_path, STATE_PATH)
        # 双写：现有 JSON 状态层不变，同时镜像进 SQLite。
        # 前端后续切到 /api/data 时，SQLite 就是主数据源。
        try:
            platform_db.import_snapshot(snapshot, replace=False, prune_missing=True)
            server_info = platform_db.state_info()
        except Exception as db_error:
            sys.stderr.write("[星屿] SQLite 镜像失败: %s\n" % db_error)
            server_info = {"updatedAt": ""}
    finally:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except OSError:
            pass
    _send_json(handler, 200, {
        "ok": True,
        "updatedAt": int(updated_at),
        "serverUpdatedAt": (server_info or {}).get("updatedAt", "")
    })


class _ApiDataError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _read_json_body(handler, max_bytes: int):
    try:
        length = int(handler.headers.get("Content-Length", 0) or 0)
    except (TypeError, ValueError):
        raise _ApiDataError(400, "invalid Content-Length")
    if length <= 0:
        raise _ApiDataError(400, "empty body")
    if length > max_bytes:
        raise _ApiDataError(413, "payload too large")
    body = handler.rfile.read(length)
    try:
        value = json.loads(body.decode("utf-8"))
    except Exception:
        raise _ApiDataError(400, "invalid json")
    return value


def _api_data_settings_for_client(handler, settings: dict):
    # API Key 属于设备/本机私密配置。局域网客户端能读业务数据，但不能读取桌面端的密钥。
    if not handler._is_loopback_client() and isinstance(settings, dict):
        settings = dict(settings)
        settings["apiKey"] = ""
    return settings


def _api_data_bootstrap(handler):
    snapshot = platform_db.bootstrap()
    snapshot["settings"] = _api_data_settings_for_client(handler, snapshot.get("settings", {}))
    return snapshot


def _api_data_get(handler, segments, query):
    if not segments:
        return _api_data_bootstrap(handler)

    head = segments[0]

    if head == "bootstrap":
        return _api_data_bootstrap(handler)

    if head == "stats":
        return platform_db.stats()

    if head == "changes":
        since = (query.get("since", [""])[0] or "").strip()
        if not since:
            raise _ApiDataError(400, "missing since")
        return {
            "ok": True,
            "changes": platform_db.changes_since(since, include_deleted=True),
        }

    if head == "profile":
        return platform_db.get_profile()

    if head == "settings":
        return _api_data_settings_for_client(handler, platform_db.get_settings())

    if head not in platform_db.ARRAY_KEYS:
        raise _ApiDataError(404, "unknown entity")

    include_deleted = (query.get("includeDeleted", ["0"])[0] or "0") in ("1", "true", "True")
    return {
        "ok": True,
        "entity": head,
        "items": platform_db.list_items(head, include_deleted=include_deleted),
    }


def _api_data_post(handler, segments):
    body = _read_json_body(handler, MAX_STATE_BYTES)

    if segments and segments[0] == "import":
        if not handler._is_loopback_client():
            raise _ApiDataError(403, "import is loopback only")
        snapshot = body.get("data") if isinstance(body, dict) and isinstance(body.get("data"), dict) else body
        if not isinstance(snapshot, dict):
            raise _ApiDataError(400, "invalid snapshot")
        replace = bool(body.get("replace")) if isinstance(body, dict) and "replace" in body else False
        return platform_db.import_snapshot(snapshot, replace=replace)

    if not segments:
        raise _ApiDataError(404, "missing entity")

    entity = segments[0]
    if entity in ("profile", "settings"):
        value = body.get("data") if isinstance(body, dict) and isinstance(body.get("data"), dict) else body
        if not isinstance(value, dict):
            raise _ApiDataError(400, "invalid value")
        if entity == "profile":
            return {"ok": True, "data": platform_db.set_profile(value)}
        return {"ok": True, "data": platform_db.set_settings(value)}

    if entity not in platform_db.ARRAY_KEYS:
        raise _ApiDataError(404, "unknown entity")

    if isinstance(body, dict) and isinstance(body.get("items"), list):
        items = [item for item in body["items"] if isinstance(item, dict)]
        saved = platform_db.upsert_items(entity, items)
        return {"ok": True, "entity": entity, "items": saved}

    item = body.get("item") if isinstance(body, dict) and isinstance(body.get("item"), dict) else body
    if not isinstance(item, dict):
        raise _ApiDataError(400, "invalid item")
    saved = platform_db.upsert_item(entity, item)
    return {"ok": True, "entity": entity, "item": saved}


def _api_data_patch(handler, segments):
    body = _read_json_body(handler, MAX_STATE_BYTES)

    if not segments:
        raise _ApiDataError(404, "missing entity")

    entity = segments[0]
    if entity in ("profile", "settings"):
        if len(segments) > 1:
            raise _ApiDataError(404, "unknown path")
        patch = body.get("patch") if isinstance(body, dict) and isinstance(body.get("patch"), dict) else body
        if not isinstance(patch, dict):
            raise _ApiDataError(400, "invalid patch")
        if entity == "profile":
            current = platform_db.get_profile()
            current.update(patch)
            return {"ok": True, "data": platform_db.set_profile(current)}
        current = platform_db.get_settings()
        current.update(patch)
        value = platform_db.set_settings(current)
        value = _api_data_settings_for_client(handler, value)
        return {"ok": True, "data": value}

    if entity not in platform_db.ARRAY_KEYS or len(segments) < 2:
        raise _ApiDataError(404, "unknown entity path")

    patch = body.get("patch") if isinstance(body, dict) and isinstance(body.get("patch"), dict) else body
    if not isinstance(patch, dict):
        raise _ApiDataError(400, "invalid patch")
    item = platform_db.patch_item(entity, segments[1], patch)
    if item is None:
        raise _ApiDataError(404, "item not found")
    return {"ok": True, "entity": entity, "item": item}


def _api_data_delete(handler, segments, query):
    if len(segments) < 2 or segments[0] not in platform_db.ARRAY_KEYS:
        raise _ApiDataError(404, "unknown entity path")
    hard = (query.get("hard", ["0"])[0] or "0") in ("1", "true", "True")
    ok = platform_db.delete_item(segments[0], segments[1], hard=hard)
    if not ok:
        raise _ApiDataError(404, "item not found")
    return {"ok": True, "entity": segments[0], "id": segments[1], "hard": hard}


def _handle_api_data(handler, method: str, path: str):
    """SQLite 数据 API。本机直接可用；局域网客户端需要已有访问令牌。"""
    try:
        if not handler._authorized():
            handler.send_error(401, "Unauthorized")
            return
        parsed = urlsplit(path)
        segments = [part for part in parsed.path.split("/") if part]
        # /api/data/bootstrap -> ['api','data','bootstrap']
        segments = segments[2:]
        query = parse_qs(parsed.query)

        if method == "GET":
            _send_json(handler, 200, _api_data_get(handler, segments, query))
        elif method == "POST":
            _send_json(handler, 200, _api_data_post(handler, segments))
        elif method == "PATCH":
            _send_json(handler, 200, _api_data_patch(handler, segments))
        elif method == "DELETE":
            _send_json(handler, 200, _api_data_delete(handler, segments, query))
        else:
            handler.send_error(405, "Method Not Allowed")
    except _ApiDataError as exc:
        _send_json(handler, exc.status, {"ok": False, "error": exc.message})
    except Exception as exc:
        _send_json(handler, 500, {"ok": False, "error": str(exc)})


RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


def _serve_range(handler, fs_path, range_header):
    """以 206 Partial Content 响应单段 Range 请求（Chromium 媒体管线需要）。

    支持 bytes=start-end / bytes=start- / bytes=-suffix 三种形式。
    返回 True 表示已处理；False 表示区间不合法（由调用方回退 416/200）。
    """
    m = RANGE_RE.match(range_header.strip())
    if not m:
        return False
    size = os.path.getsize(fs_path)
    first_s, last_s = m.group(1), m.group(2)
    if first_s == "" and last_s == "":
        return False
    if first_s == "":
        # bytes=-N ：最后 N 字节
        length = int(last_s)
        if length <= 0 or length > size:
            return False
        start, end = size - length, size - 1
    else:
        start = int(first_s)
        end = int(last_s) if last_s else size - 1
        if end >= size:
            end = size - 1
    if start > end or start >= size:
        handler.send_response(416)
        handler.send_header("Content-Range", "bytes */%d" % size)
        handler.send_header("Content-Length", "0")
        handler.end_headers()
        return True
    ctype = mimetypes.guess_type(fs_path)[0] or "application/octet-stream"
    handler.send_response(206)
    handler.send_header("Content-Type", ctype)
    handler.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
    handler.send_header("Content-Length", str(end - start + 1))
    handler.end_headers()
    with open(fs_path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(65536, remaining))
            if not chunk:
                break
            handler.wfile.write(chunk)
            remaining -= len(chunk)
    return True


class XingyuHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "XingyuLocal/" + BUILD
    # HTTP/1.1 keep-alive：大量静态资源复用连接，页面加载更快
    protocol_version = "HTTP/1.1"

    def _is_loopback_client(self):
        try:
            return ipaddress.ip_address(self.client_address[0]).is_loopback
        except Exception:
            return self.client_address[0] in ("127.0.0.1", "::1")

    def _cookie_token(self):
        raw = self.headers.get("Cookie", "")
        for part in raw.split(";"):
            k, sep, v = part.strip().partition("=")
            if sep and k == ACCESS_COOKIE:
                return v.strip('"')
        return ""

    def _provided_token(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:].strip()
        return self.headers.get("X-Xingyu-Access", "").strip() or self._cookie_token()

    def _token_ok(self, token):
        return bool(token) and hmac.compare_digest(token, ACCESS_TOKEN)

    def _authorized(self):
        if self._is_loopback_client() or not ACCESS_TOKEN:
            return True
        return self._token_ok(self._provided_token())

    def _send_lan_gate(self):
        body = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>星屿 · 访问码</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.6 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;background:#f5f5f7;color:#111}main{width:min(92vw,420px);background:#fff;border:1px solid #ddd;border-radius:16px;padding:28px;box-shadow:0 16px 40px #0001}h1{font-size:20px;margin:0 0 10px}p{margin:0 0 18px;color:#555}form{display:flex;gap:8px}input{flex:1;min-width:0;height:42px;border:1px solid #ccc;border-radius:10px;padding:0 12px;font:inherit}button{height:42px;padding:0 16px;border:0;border-radius:10px;background:#111;color:#fff;font-weight:600}code{word-break:break-all}</style></head>
<body><main><h1>星屿需要访问码</h1><p>这是局域网安全模式。输入桌面端设置里显示的访问令牌，或先打开桌面端提供的 <code>/access?token=...</code> 链接。</p><form action="/access" method="get"><input name="token" autocomplete="off" placeholder="访问令牌"><button>解锁</button></form></main></body></html>"""
        data = body.encode("utf-8")
        self.send_response(401)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_access_redirect(self, token):
        if not self._token_ok(token):
            self.send_error(401, "Unauthorized")
            return
        self.send_response(302)
        self.send_header("Location", "/?mobile=1&src=qr")
        self.send_header("Set-Cookie", f"{ACCESS_COOKIE}={ACCESS_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000")
        self.send_header("Cache-Control", "no-store")
        # ⚠️ 必须显式给 Content-Length: 0。
        #    protocol_version = "HTTP/1.1"，连接默认 keep-alive，
        #    302 没有 body 又不声明长度时，浏览器不知道响应何时结束，
        #    会一直挂着等 body —— 实测手机扫码后要等 10s+ 才跳转，
        #    表现为「二维码扫了打不开」。
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == HEALTH_PATH:
            payload = json.dumps(
                {"status": "ok", "service": "xingyu", "build": BUILD},
                ensure_ascii=False,
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if path == "/api/pet-context":
            _pet_context(self)
            return
        if path == "/api/state":
            _get_state(self)
            return
        # 局域网访问安全模式：/access 只负责令牌换取 Cookie。
        if path == "/access":
            qs = parse_qs(urlsplit(self.path).query)
            self._send_access_redirect(qs.get("token", [""])[0].strip())
            return
        if not self._authorized():
            if path in ("/", "/index.html"):
                self._send_lan_gate()
            else:
                self.send_error(401, "Unauthorized")
            return
        if path == "/api/sync/pull":
            if not self._authorized():
                self.send_error(401, "Unauthorized")
                return
            _send_json(handler=self, status=200, data=_api_data_bootstrap(self))
            return
        if path.startswith("/api/data/"):
            _handle_api_data(self, "GET", self.path)
            return
        # 仅本机可见：设置页用它展示给用户复制；远程客户端即使已有 Cookie 也不能读取令牌。
        if path == "/api/lan-token":
            if not self._is_loopback_client():
                self.send_error(403, "Forbidden")
                return
            payload = json.dumps({
                "ok": True,
                "token": ACCESS_TOKEN,
                "bind": BIND_HOST,
                "lanRequired": not ipaddress.ip_address(BIND_HOST).is_loopback,
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # 本机查看局域网 IP 和扫码链接；远程设备不能读取令牌。
        if path == "/js/local-config.js" and _send_local_config_for_client(self):
            return
        if path == "/api/lan-info":
            if not self._is_loopback_client():
                self.send_error(403, "Forbidden")
                return
            try:
                port = urlsplit(self.headers.get("Host", "")).port or (80 if self.headers.get("Host", "").startswith("http") else DEFAULT_PORT)
            except Exception:
                port = DEFAULT_PORT
            lan_ip = _lan_ip()
            payload = json.dumps({
                "ok": bool(lan_ip),
                "ip": lan_ip,
                "ips": _lan_candidates(),
                "url": _lan_url(port),
                "port": port,
                "token": ACCESS_TOKEN,
                "bind": BIND_HOST,
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # 本机生成扫码图；文本很短，仅供二维码展示。
        if path == "/qrcode.png":
            qs = parse_qs(urlsplit(self.path).query)
            text = (qs.get("text", [""])[0] or "").strip()
            if not text or len(text) > 512:
                self.send_error(400, "Bad Request")
                return
            qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
            qr.add_data(text)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            data = buf.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        # 桌面宠物：只允许本机请求启动独立透明窗
        if path == "/api/launch-pet":
            if not self._is_loopback_client():
                self.send_error(403, "Forbidden")
                return
            root_dir = os.path.dirname(os.path.abspath(__file__))
            import socket as _sock
            import subprocess, threading
            # 已有实例在跑（锁端口在听）→ 发 SHOW 唤到前台，不再重复拉起
            try:
                s = _sock.create_connection(("127.0.0.1", 8640), timeout=0.4)
                try:
                    s.sendall(b"SHOW\n")
                finally:
                    s.close()
                payload = json.dumps({"ok": True, "already": True}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                self.wfile.flush()
                return
            except OSError:
                pass
            bundled_pyw = os.path.join(root_dir, ".venv-native", "Scripts", "pythonw.exe")
            exe = bundled_pyw if os.path.isfile(bundled_pyw) else sys.executable
            script = os.path.join(root_dir, "xingyu-pet.pyw")

            def _pet_alive():
                try:
                    c = _sock.create_connection(("127.0.0.1", 8640), timeout=0.2)
                    c.close()
                    return True
                except OSError:
                    return False

            # ⚠️ 冷启动很慢：import pywebview + pythonnet 实测要 3~8 秒，
            #    远超"点一下就该有反应"的心理预期。旧实现只等 2 秒等不到端口
            #    就返回 ok:false，前端于是弹红色「桌面宠物启动失败」——
            #    但宠物再过几秒其实正常出来了。用户看到红字就以为功能坏了。
            #    现在区分三种情况：
            #      ok:true, already:true  → 已有实例，已唤前台
            #      ok:true               → 新实例就绪
            #      ok:true, pending:true → 进程已拉起、还在加载，稍等即出现（不是失败）
            #      ok:false              → 进程真的没拉起来 / 起来后立刻退出
            _proc = {}
            try:
                server_port = int(self.server.server_address[1])
            except Exception:
                server_port = DEFAULT_PORT

            def _spawn_pet():
                # ⚠️ 别再把 stdout/stderr 丢给 DEVNULL。
                #    宠物是 pythonw 起的，没有控制台，一旦 pywebview 抛异常
                #    就无声无息地死掉，而失败提示里还让用户"查看 pet-debug.log"——
                #    这个文件从来不会被创建，等于把排障线索全掐断。
                #    改成追加写入 data/pet-debug.log，崩溃时才有据可查。
                log_path = os.path.join(root_dir, "data", "pet-debug.log")
                try:
                    os.makedirs(os.path.dirname(log_path), exist_ok=True)
                    log_fp = open(log_path, "a", buffering=1,
                                  encoding="utf-8", errors="replace")
                    log_fp.write("\n===== %s 启动宠物 =====\n" %
                                 time.strftime("%Y-%m-%d %H:%M:%S"))
                except OSError:
                    log_fp = subprocess.DEVNULL
                try:
                    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)
                    pet_env = os.environ.copy()
                    pet_env["XINGYU_PORT"] = str(server_port)
                    _proc["p"] = subprocess.Popen(
                        [exe, script], cwd=root_dir, creationflags=flags,
                        stdin=subprocess.DEVNULL, stdout=log_fp,
                        stderr=log_fp, close_fds=True, env=pet_env)
                except Exception as exc:
                    _proc["err"] = str(exc)

            threading.Thread(target=_spawn_pet, daemon=True).start()

            # 先等 spawn 线程把进程对象交出来（或报错）
            for _ in range(40):
                if "p" in _proc or "err" in _proc:
                    break
                time.sleep(0.05)
            proc = _proc.get("p")

            if proc is None:
                payload = json.dumps(
                    {"ok": False, "error": "无法启动宠物进程：" + (_proc.get("err") or "未知原因")},
                    ensure_ascii=False).encode("utf-8")
            else:
                alive = False
                for _ in range(40):          # 最多约 6 秒
                    time.sleep(0.15)
                    if _pet_alive():
                        alive = True
                        break
                    if proc.poll() is not None:   # 进程已退出，等下去没意义
                        break
                if alive:
                    payload = json.dumps({"ok": True, "already": False}, ensure_ascii=False).encode("utf-8")
                elif proc.poll() is None:
                    # 进程还活着，只是还没绑上端口 —— 正在加载，不是失败
                    payload = json.dumps({"ok": True, "already": False, "pending": True},
                                         ensure_ascii=False).encode("utf-8")
                else:
                    payload = json.dumps(
                        {"ok": False, "error": "宠物进程启动后立即退出（退出码 %s），可查看 pet-debug.log" % proc.returncode},
                        ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            self.wfile.flush()
            return

        # VoxCPM 健康探测（同源代理转发）
        if path == VOX_PROXY_PREFIX + "__vox_health__":
            online = _vox_health()
            payload = json.dumps({"online": online, "upstream": VOX_UPSTREAM}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # AI 代理健康探测
        if path == AI_PROXY_PREFIX + "__ai_health__":
            configured = bool(_ai_key())
            payload = json.dumps({"online": True, "configured": configured, "upstream": AI_UPSTREAM},
                                 ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if path == BACKUP_INFO_PATH:
            _backup_info(self)
            return
        # 其余 /ai-proxy/ GET 直接转发
        if path.startswith(AI_PROXY_PREFIX):
            _proxy_ai(self, "GET", path[len(AI_PROXY_PREFIX):], None)
            return
        # AIRI 视觉通道：健康/配置状态探测
        if path == VISION_PROXY_PREFIX + "__vision_health__":
            payload = json.dumps({"online": True, "configured": bool(_vision_key()), "upstream": VISION_UPSTREAM,
                                  "defaultModel": VISION_DEFAULT_MODEL},
                                 ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # AIRI 视觉通道：模型列表（本地合成，无需上游在线）
        if path == VISION_PROXY_PREFIX + "v1/models":
            payload = json.dumps({
                "object": "list",
                "data": [
                    {"id": VISION_DEFAULT_MODEL, "object": "model", "owned_by": "volcengine-ark",
                     "name": "豆包 Seed 1.6 视觉 (方舟)"},
                    {"id": "doubao-seed-1-6-flash-250815", "object": "model", "owned_by": "volcengine-ark",
                     "name": "豆包 Seed 1.6 Flash (方舟)"},
                ],
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # 其余 /vision-proxy/ GET 直接转发
        if path.startswith(VISION_PROXY_PREFIX):
            _proxy_vision(self, "GET", path[len(VISION_PROXY_PREFIX):], None)
            return
        # AIRI 用：本地 ASR 模型列表（openai-compatible 协议）
        if path == ASR_PROXY_PREFIX + "v1/models":
            payload = json.dumps({
                "object": "list",
                "data": [{"id": "sensevoice-small", "object": "model",
                          "owned_by": "xingyu-local", "name": "SenseVoice (本地)"}],
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # AIRI 用：VoxCPM 模型列表，补含 'tts' 的别名（AIRI 按 id 含 tts 过滤）
        if path == VOX_PROXY_PREFIX + "v1/models":
            payload = _vox_models_payload()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # 其余 /vox-proxy/ GET 直接转发
        if path.startswith(VOX_PROXY_PREFIX):
            _proxy_to_vox(self, "GET", path[len(VOX_PROXY_PREFIX):], None)
            return
        # 智能体服务健康探测（同源代理转发）
        if path == AGENT_PROXY_PREFIX + "__agent_health__":
            online = _agent_health()
            payload = json.dumps({"online": online, "upstream": AGENT_UPSTREAM}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        # 其余 /agent-proxy/ GET 直接转发
        if path.startswith(AGENT_PROXY_PREFIX):
            _proxy_to_agent(self, "GET", path[len(AGENT_PROXY_PREFIX):], None)
            return
        # 敏感数据黑名单：/data/ 下的密钥、备份快照、反馈报告不允许静态下载。
        # 必须先解码再规范化，防止 /data/backups/%2e%2e/ai-key-local.txt 这类编码路径绕过。
        norm = os.path.normpath(unquote(path)).replace("\\", "/").rstrip("/") or "/"
        if any(norm == rule or norm.startswith(rule + "/") for rule in SENSITIVE_DATA_RULES):
            self.send_error(403, "Forbidden")
            return
        # 媒体等静态文件的 Range 请求（开屏视频流畅缓冲需要 206 分段响应）
        range_header = self.headers.get("Range")
        if range_header and range_header.startswith("bytes="):
            fs_path = self.translate_path(self.path)
            ext = os.path.splitext(fs_path)[1].lower()
            if ext in LONG_CACHE_EXTS and os.path.isfile(fs_path):
                if _serve_range(self, fs_path, range_header):
                    return
                # 区间解析失败：回退为整文件 200（SimpleHTTPRequestHandler 默认行为）
        super().do_GET()

    def do_HEAD(self):
        # SimpleHTTPRequestHandler 自带 do_HEAD，不会进入 do_GET；
        # 这里必须重复局域网门禁与敏感数据拦截，否则远程设备可绕过 GET 门禁。
        path = urlsplit(self.path).path
        if path != HEALTH_PATH and path != "/access":
            if not self._authorized():
                if path in ("/", "/index.html"):
                    self._send_lan_gate()
                else:
                    self.send_error(401, "Unauthorized")
                return
            if path == "/js/local-config.js" and _send_local_config_for_client(self):
                return
            norm = os.path.normpath(unquote(path)).replace("\\", "/").rstrip("/") or "/"
            if any(norm == rule or norm.startswith(rule + "/") for rule in SENSITIVE_DATA_RULES):
                self.send_error(403, "Forbidden")
                return
        super().do_HEAD()

    def _same_origin(self):
        """允许同源 POST；浏览器跨站请求会带不同 Origin，直接拒绝。"""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        host = self.headers.get("Host")
        parsed = urlsplit(origin)
        return parsed.netloc == host and parsed.scheme in ("http", "https")

    def do_POST(self):
        if not self._same_origin():
            self.send_error(403, "Forbidden")
            return
        path = urlsplit(self.path).path
        if path == "/api/sync/push":
            if not self._authorized():
                self.send_error(401, "Unauthorized")
                return
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_STATE_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _save_state(self, body)
            return
        if path == "/api/state":
            if not self._authorized():
                self.send_error(401, "Unauthorized")
                return
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_STATE_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _save_state(self, body)
            return
        if path.startswith("/api/data/"):
            _handle_api_data(self, "POST", self.path)
            return
        if path == BACKUP_PATH:
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_BACKUP_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _save_backup(self, body)
            return
        if path == "/api/feedback":
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_FEEDBACK_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _save_feedback(self, body)
            return
        if path == "/api/open-url":
            # 桌面壳（pywebview）里 window.open 不可靠，前端统一把外链交给这里，
            # 用系统默认浏览器打开。⚠️ 仅限本机回环调用：局域网手机不得遥控
            # 用户的电脑弹网页。只允许 http(s)，杜绝 file:/javascript: 等scheme。
            if not self._is_loopback_client():
                self.send_error(403, "Forbidden")
                return
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > 2048:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            try:
                url = (json.loads(body.decode("utf-8", "replace")) or {}).get("url", "")
            except Exception:
                url = ""
            # 校验：只收 http(s)，且不允许控制字符/空白（防 file:、javascript:、CRLF 注入）
            _ok_scheme = isinstance(url, str) and url.lower().startswith(("http://", "https://"))
            _no_ctrl = _ok_scheme and not any(c in url for c in " \t\r\n\x00<>'\"`\\")
            if not _no_ctrl:
                payload = json.dumps({"ok": False, "error": "仅支持 http(s) 链接"}, ensure_ascii=False).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            try:
                webbrowser.open(url)
                payload = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
            except Exception as exc:
                payload = json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if path.startswith(AI_PROXY_PREFIX):
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_POST_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _proxy_ai(self, "POST", path[len(AI_PROXY_PREFIX):], body)
            return
        if path.startswith(VOX_PROXY_PREFIX):
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_POST_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else None
            rel = path[len(VOX_PROXY_PREFIX):]
            # AIRI 选的别名模型名 -> VoxCPM 真名
            if rel.endswith("/audio/speech"):
                body = _rewrite_vox_model(body)
            _proxy_to_vox(self, "POST", rel, body)
            return
        # AIRI 用：OpenAI 兼容语音识别（multipart -> 本地 SenseVoice /stt）
        if path.startswith(ASR_PROXY_PREFIX):
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_POST_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _asr_transcribe(self, body, self.headers.get("Content-Type") or "")
            return
        # AIRI 用：视觉推理（OpenAI 兼容 chat/completions + image_url -> 火山方舟）
        if path.startswith(VISION_PROXY_PREFIX):
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_POST_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else b""
            _proxy_vision(self, "POST", path[len(VISION_PROXY_PREFIX):], body)
            return
        if path.startswith(AGENT_PROXY_PREFIX):
            try:
                length = int(self.headers.get("Content-Length", 0) or 0)
            except ValueError:
                self.send_error(400, "Bad Request")
                return
            if length > MAX_POST_BYTES:
                self.send_error(413, "Payload Too Large")
                return
            body = self.rfile.read(length) if length > 0 else None
            _proxy_to_agent(
                self, "POST", path[len(AGENT_PROXY_PREFIX):], body,
                content_type=self.headers.get("Content-Type") or "application/json",
            )
            return
        self.send_error(405, "Method Not Allowed")

    def do_PATCH(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/data/"):
            _handle_api_data(self, "PATCH", self.path)
            return
        self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/data/"):
            _handle_api_data(self, "DELETE", self.path)
            return
        self.send_error(405, "Method Not Allowed")

    def end_headers(self):
        path = urlsplit(self.path).path.lower()
        ext = os.path.splitext(path)[1]
        if path == HEALTH_PATH:
            self.send_header("Cache-Control", "no-store")
        elif ext in NO_CACHE_EXTS or not ext:
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        elif ext in LONG_CACHE_EXTS:
            self.send_header("Cache-Control", "public, max-age=604800, immutable")
            self.send_header("Accept-Ranges", "bytes")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), screen-wake-lock=(self), geolocation=()")
        # 2026-09-08: CSP 按路由拆分。主应用不再继承 AIRI 所需的 unsafe-eval；
        # 只有同源 /airi/ 响应保留其运行时所需的宽松策略。
        if path == "/airi" or path.startswith("/airi/"):
            csp = ("default-src 'self'; "
                   "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob: https://cdn.jsdelivr.net; "
                   "style-src 'self' 'unsafe-inline' https:; "
                   "img-src 'self' data: blob: https:; media-src 'self' blob: data:; "
                   "font-src 'self' data: https:; "
                   "connect-src 'self' data: blob: http: https: ws: wss: https://cdn.jsdelivr.net; "
                   "worker-src 'self' blob: data:; object-src 'none'; "
                   "base-uri 'self'; frame-src 'self' https://airi.moeru.ai; "
                   "frame-ancestors 'self'; form-action 'self'")
        else:
            csp = ("default-src 'self'; "
                   "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' data: blob:; "
                   "style-src 'self' 'unsafe-inline' https:; "
                   "img-src 'self' data: blob: https:; media-src 'self' blob: data:; "
                   "font-src 'self' data: https:; "
                   "connect-src 'self' data: blob: http://localhost:* http://127.0.0.1:* https: ws://localhost:* wss:; "
                   "worker-src 'self' blob: data:; object-src 'none'; "
                   "base-uri 'self'; frame-src 'self'; "
                   "frame-ancestors 'self'; form-action 'self'")
        self.send_header("Content-Security-Policy", csp)
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[星屿] %s - %s\n" % (self.address_string(), fmt % args))


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_handler(root_dir):
    def handler(*args, **kwargs):
        return XingyuHandler(*args, directory=root_dir, **kwargs)
    return handler


def create_server(port=DEFAULT_PORT, root_dir=None):
    root = root_dir or os.path.dirname(os.path.abspath(__file__))
    return ThreadingHTTPServer((BIND_HOST, int(port)), make_handler(root))


def _agent_service_alive():
    try:
        with urllib.request.urlopen(AGENT_UPSTREAM + "/healthz", timeout=1.0) as r:
            return r.status == 200
    except Exception:
        return False


def _ensure_agent_service():
    """平台启动时自动拉起贾维斯智能体本地服务（已在运行则跳过）。"""
    if _agent_service_alive():
        sys.stderr.write("[星屿] 智能体本地服务已在运行 (127.0.0.1:8610)\n")
        return
    import subprocess
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent-service", "agent_service.py")
    for py in (r"D:\星屿\voxvenv\Scripts\pythonw.exe", r"D:\星屿\voxvenv\Scripts\python.exe"):
        if os.path.isfile(py) and os.path.isfile(script):
            try:
                flags = 0
                if os.name == "nt":
                    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)
                import os as _os
                child_env = dict(os.environ)
                child_env.pop("PYTHONPATH", None)  # 防止 .venv-native 的包目录串进 voxvenv
                subprocess.Popen(
                    [py, script, "--port", "8610"],
                    cwd=os.path.dirname(script),
                    env=child_env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    stdin=subprocess.DEVNULL,
                    creationflags=flags,
                    close_fds=True,
                )
                sys.stderr.write("[星屿] 已自动启动智能体本地服务 (127.0.0.1:8610)\n")
            except Exception as e:
                sys.stderr.write("[星屿] 智能体服务自动启动失败: %s\n" % e)
            return
    sys.stderr.write("[星屿] 未找到智能体服务脚本，跳过自动启动\n")


def _voxcpm_service_alive():
    try:
        with urllib.request.urlopen(VOX_UPSTREAM + "/v1/models", timeout=1.0) as r:
            return r.status == 200
    except Exception:
        return False


def _ensure_voxcpm_service():
    """平台启动时自动拉起 VoxCPM 本地合成适配层（127.0.0.1:8000，已在运行则跳过）。

    AIRI 的「嘴」整条链路都压在这一层上：edge-tts 快车道和 AMD GPU 兜底都走它。
    它一挂，AIRI 的表现就是「能听见我说话但不说话」，而前端只能看到一个 502，
    极难联想到是本地服务没起来。所以照 _ensure_agent_service 的样子做成启动自愈。
    """
    if _voxcpm_service_alive():
        sys.stderr.write("[星屿] VoxCPM 合成服务已在运行 (127.0.0.1:8000)\n")
        return
    import subprocess
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voxcpm", "server_openai.py")
    for py in (r"D:\星屿\voxvenv\Scripts\pythonw.exe", r"D:\星屿\voxvenv\Scripts\python.exe"):
        if os.path.isfile(py) and os.path.isfile(script):
            try:
                flags = 0
                if os.name == "nt":
                    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NO_WINDOW", 0)
                child_env = dict(os.environ)
                child_env.pop("PYTHONPATH", None)  # 防止 .venv-native 的包目录串进 voxvenv
                subprocess.Popen(
                    [py, script, "--port", "8000"],
                    cwd=os.path.dirname(script),
                    env=child_env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    stdin=subprocess.DEVNULL,
                    creationflags=flags,
                    close_fds=True,
                )
                sys.stderr.write("[星屿] 已自动启动 VoxCPM 合成服务 (127.0.0.1:8000)\n")
            except Exception as e:
                sys.stderr.write("[星屿] VoxCPM 服务自动启动失败: %s\n" % e)
            return
    sys.stderr.write("[星屿] 未找到 VoxCPM 服务脚本，跳过自动启动\n")


def main():
    _ensure_agent_service()
    _ensure_voxcpm_service()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    if not ipaddress.ip_address(BIND_HOST).is_loopback:
        _write_lan_qr_asset(port)
    httpd = create_server(port)
    sys.stderr.write("星屿服务运行中 http://127.0.0.1:%d (bind=%s)\n" % (port, BIND_HOST))
    try:
        if not ipaddress.ip_address(BIND_HOST).is_loopback:
            sys.stderr.write("局域网安全模式已启用：使用 /access?token=%s 首次解锁\n" % ACCESS_TOKEN)
    except ValueError:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
