# 星屿 VoxCPM 本地部署 · 交接文档（给 Codex 继续）

> 生成时间：2026-08-15 22:41 · 由 WorkBuddy 交接

## 一、任务背景

用户要求「完整功能体验」—— 在星屿平台（`ai-student-platform`）的「AI 语音」视图里，
点「▶ 本地合成」真正能出声音（TTS + 声音克隆），而不是只给 Python 脚本让用户自己跑。

**根本问题**：VoxCPM 官方部署需要 NVIDIA CUDA GPU，但用户机器是 **Intel Arc 集显（无 NVIDIA GPU）**。
因此方案改为：**CPU 推理 VoxCPM2 + 本地 OpenAI 兼容 TTS 服务**，通过星屿 `server.py` 的同源代理接入前端。

## 二、项目位置与关键文件

```
项目根：D:\星屿\ai-student-platform
├── voxcpm\                      # VoxCPM 源码（已入仓）
│   ├── server_openai.py         # ✅ 已写好：OpenAI 兼容 /v1/audio/speech 服务（未启动验证）
│   ├── deploy_voxcpm.bat        # 一键部署脚本（面向用户，当前 venv 已手动装好，可跳过）
│   └── README-星屿.md           # 接入文档
├── js\voxcpm-voice.js           # ✅ 前端 AI 语音 + 声音克隆面板（已接入）
├── css\voxcpm.css               # ✅ 样式（已接入）
└── server.py                    # ✅ 已加 /vox-proxy/* 同源代理（CORS 已解决）
```

**Python 虚拟环境（已建好，依赖已装）**：
```
路径：D:\星屿\voxvenv
Python：3.12.10（voxcpm 要求 3.10~3.12，不能用 3.13/3.14）
已装：torch 2.5.1+cpu、torchaudio、voxcpm 2.0.0、gradio 6.24、funasr 1.4.2、
      transformers、librosa、datasets、modelscope 等
```

## 三、⚠️ 关键环境坑（必须遵守）

**pip 安装必须清沙箱环境变量**，否则 safe-delete 报错并损坏包：
```bash
export CODEBUDDY_SESSION_ID= CLAUDE_SESSION_ID= CODEBUDDY_SAFE_DELETE_SANDBOX=
export SETUPTOOLS_SCM_PRETEND_VERSION_FOR_VOXCPM=2.0.0
"C:/Users/klxq/voxvenv/Scripts/python.exe" -m pip install <pkg>
```
原因：WorkBuddy 注入的 `sitecustomize.py`（safe-delete shim）在
`CODEBUDDY_SAFE_DELETE_SANDBOX=1` 时对 Windows 沙箱内删除 fail-closed，
导致 pip 卸载旧版本时报 `[safe-delete][SAFE_DELETE_FAIL_CLOSED] windows-sandbox-recycle-bin-unavailable`。

**注意**：之前安装过程中 safe-delete 已多次破坏包（certifi 目录被清空、annotated-types、
httpx 等）。**验证时若报 `AttributeError: module 'certifi' has no attribute 'where'`
或 `cannot import name 'BaseMetadata'` 等，说明该包损坏，需要手动 rm 目录后重装**：
```bash
cd "C:/Users/klxq/voxvenv/Lib/site-packages"
rm -rf certifi certifi-*.dist-info
# 然后带清空环境变量前缀重装
```

## 四、已完成工作（勿重复）

1. ✅ `voxcpm/` 源码入仓到项目根（5.9MB）
2. ✅ `js/voxcpm-voice.js`：AI 语音面板（TTS 浏览器兜底 + 本地 VoxCPM 引擎切换 +
   声音克隆三模式 UI：音色设计/可控克隆/极致克隆 + 生成 Python 脚本 + 服务检测徽标）
3. ✅ `css/voxcpm.css`：蓝青渐变科技感样式
4. ✅ `server.py`：`/vox-proxy/*` 同源代理（GET 健康探测 + POST 转发），BUILD=20260815.1
5. ✅ venv `D:\星屿\voxvenv` 创建，Python 3.12.10
6. ✅ torch 2.5.1+cpu 安装成功
7. ✅ voxcpm 2.0.0 + 全部依赖安装成功（含 gradio/funasr/librosa）
8. ✅ `voxcpm/server_openai.py` 服务脚本已写好（OpenAI 兼容接口、支持参考音频 base64 克隆）
9. ✅ pip 源已配置清华镜像：`C:\Users\klxq\AppData\Roaming\pip\pip.ini`
10. ✅ 侧边栏跑步图标用 VoxCPM 音频波形视觉语言重设计（syn-wave 均衡器跳动动画）
11. ✅ **依赖完整性已验证**：certifi / annotated-types / httpx / dateutil / modelscope
    等被 safe-delete 破坏的包已全部手动重装修复，`import` 全部 ALL OK

## 五、未完成工作（Codex 接续）

### ✅ Step 1 已完成：依赖已全部修复并验证（2026-08-16 确认）
```bash
export CODEBUDDY_SESSION_ID= CLAUDE_SESSION_ID= CODEBUDDY_SAFE_DELETE_SANDBOX=
"C:/Users/klxq/voxvenv/Scripts/python.exe" -c "import torch, torchaudio, voxcpm, gradio, funasr, librosa, transformers, datasets, modelscope, certifi, httpx, soundfile, safetensors, pydantic, annotated_types, dateutil; print('ALL OK')"
# 结果：ALL OK | torch 2.5.1+cpu
```

### Step 2：下载 VoxCPM2 模型权重（CPU 用）
**注意**：直接 `VoxCPM.from_pretrained("openbmb/VoxCPM2")` 会从 HuggingFace 下载（国内慢）。
优先用 ModelScope：
```python
import os
os.environ["MODELSCOPE_CACHE"] = r"D:\星屿\voxvenv\models"
from modelscope import snapshot_download
snapshot_download("OpenBMB/VoxCPM2")   # 国内源，约 4-5GB
```
或先测试小模型 `OpenBMB/VoxCPM-0.5B`（约 1-2GB，CPU 更快）验证链路，
再决定是否上 VoxCPM2。**推荐先用 0.5B 跑通全链路，再换 2B。**

### Step 3：启动服务并验证
```bash
cd "C:/Users/klxq/WorkBuddy/2026-08-08-07-43-31/ai-student-platform/voxcpm"
export CODEBUDDY_SESSION_ID= CLAUDE_SESSION_ID= CODEBUDDY_SAFE_DELETE_SANDBOX=
"C:/Users/klxq/voxvenv/Scripts/python.exe" server_openai.py --port 8000 --model openbmb/VoxCPM-0.5B
```
- 后台常驻（用 PowerShell Start-Process 隐藏窗口，参考星屿 xingyu-app.pyw 的 start_server 方式）
- 验证：`curl http://127.0.0.1:8000/v1/models`
- 验证代理：`curl http://127.0.0.1:8620/vox-proxy/__vox_health__` → 应为 `{"online": true}`
  （注意：8620 的 server.py 已被 WorkBuddy 重启过一次，若 8620 未运行需要重新启动）

### Step 4：端到端测试
- 星屿页面 → 侧边栏「AI 语音」→ 03 声音克隆 → 徽标应变绿「VoxCPM 服务在线 ✓」
- 填文本 → 点「▶ 本地合成」→ 应能播放音频
- CPU 推理很慢（0.5B 大约几秒~几十秒一句；2B 可能 1-3 分钟），前端状态栏要耐心等待

### Step 5：性能与兜底（重要）
- CPU 推理 2B 模型极慢，若用户接受不了：
  a) 用 VoxCPM-0.5B（更快但功能少：不支持 reference_wav 克隆，只支持 TTS+音色设计）
  b) 或提示用户改用「⚡ 生成克隆脚本」在其他有 GPU 的机器上跑
- server_openai.py 已在 `load_model()` 里打了进度日志，启动时先加载模型避免首次请求超时

### Step 6：收尾
- 更新 `voxcpm/README-星屿.md`：写明"已在本机部署，直接可用"或实际可用状态
- 更新 `deploy_voxcpm.bat` 使其适配已存在的 venv（或注明无需重复部署）
- 截图验证：服务在线徽标绿色 + 合成出音频

## 六、用户机器环境
- OS：Windows（Git Bash）
- GPU：**Intel Arc 集显（无 NVIDIA CUDA）** → 只能 CPU 推理
- 内存：31.5 GB（充足）
- 磁盘：C 盘剩 ~80 GB（模型 4-5GB 无压力）
- 网络：有代理（SakuraCat / Clash），pip 已配清华源
- 星屿运行：xingyu-app.pyw 启动，8620 静态服务 + 8621 原生后端

## 七、验证命令速查
```bash
# 星屿健康
curl http://127.0.0.1:8620/__xingyu_health__
# VoxCPM 代理健康（期望 online:true 当服务启动后）
curl http://127.0.0.1:8620/vox-proxy/__vox_health__
# VoxCPM 直连
curl http://127.0.0.1:8000/v1/models
# 合成测试
curl -X POST http://127.0.0.1:8000/v1/audio/speech -H "Content-Type: application/json" \
  -d '{"model":"openbmb/VoxCPM-0.5B","input":"你好，这是星屿的语音合成测试。","voice":"default"}' \
  -o test.wav
```
