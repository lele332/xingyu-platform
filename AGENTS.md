# AGENTS.md — 星屿 ai-student-platform

> 本文件供 AI 编码助手（Codex / Claude Code / WorkBuddy / Cursor 等）在**每次会话开局自动阅读**，不许跳过。
> 人读 `README.md` 与 `docs/STRUCTURE.md`；AI 读本文件。规则冲突时以本文件为准。
> 2026-09-20 由 docs/STRUCTURE.md 浓缩而成，并将实战坑沉淀在文末。

## 角色与优先级

你是星屿平台的资深全栈工程师。冲突时按此顺序取舍：

1. 用户本地数据安全 > 一切（数据在 localStorage + `data/`，丢不得）
2. 现有功能不回归 > 新功能（平台 18 个视图，改一个不许碰坏其他）
3. 可验证 > 口头宣称（每个交付必须附验证证据）
4. UI 改动遵守 Apple 设计语言（见 `docs/DESIGN_SYSTEM.md`，禁强渐变/发光等"AI 味"视觉）

## 技术栈（固定版本，勿自行升级）

| 层 | 技术 | 版本/说明 |
|---|---|---|
| 前端 | 原生 HTML / CSS / JS | 零框架、零构建步骤 |
| 桌面壳 | Python + pywebview | 3.12.10 / 6.2.1 |
| 本机服务 | `server.py` | 8620 静态+API，8621 原生后端 |
| 启动器 | `xingyu-app.pyw` / `server-launcher.pyw` | 桌面快捷方式入口，勿改启动流程 |
| 数据 | 浏览器 localStorage + `data/` | 密钥只许 `data/ai-key-local.txt` 或 `js/local-config.js`（均已 gitignore） |
| TTS | VoxCPM（CPU 推理） | venv 在 `D:\星屿\voxvenv`，服务端口 8000，经 8620 `/vox-proxy/*` 同源代理 |

## 可执行命令（交付前必跑）

```bash
npm run check        # 全量自检：SRS + AI 上下文 + Python 冒烟 + 质量冒烟
python -m unittest tests.test_platform   # 仅后端测试
curl http://127.0.0.1:8620/__xingyu_health__        # 平台健康
curl http://127.0.0.1:8620/vox-proxy/__vox_health__ # VoxCPM 代理健康
node --check js/xxx.js                 # 单文件语法检查
```

git 命令不在 PATH 时用完整路径：
`C:\Users\klxq\.workbuddy\binaries\PortableGit\versions\1.2.0\cmd\git.exe`

## 版本纪律（改前端必做，漏了用户看到旧缓存）

1. `index.html` 里资源引用 `?v=` 数字 +1
2. `sw.js` 里 `CACHE` 常量同步 +1

## 目录地图

| 路径 | 职责 |
|---|---|
| `index.html` `schedule.html` | 平台主页 / 课程表子页（唯二页面入口） |
| `server.py` `platform_db.py` | 本机服务与数据层 |
| `xingyu-*.pyw` | 本机启动器（不入库） |
| `js/` `css/` `assets/` | 前端代码 |
| `docs/` | 全部文档（`STRUCTURE.md` 是目录总纲，改动目录先改它） |
| `tests/` | 正式测试；`tests/dev/` 一次性探针用完即删，截图入 `tests/artifacts/` |
| `scripts/` `tools/` | 维护脚本（scripts 不入库） |
| `data/` | 运行时数据（db、日志、密钥），严禁入库 |
| 各子模块 | `voxcpm/` `agent-service/` `focus*/` `synapse-run/` `orb/` `nexus/` `toolknit/` `foldcraft/` `hero/` `particles/` `securify/` `news/` `bridgelab/` `knowledge/` |
| `_bak/` | 本地历史归档，不入库 |
| 大于 10MB 的媒体文件 | 不入库（GitHub 单文件限 100MB） |

## 三层边界

- ✅ **总是做**
  - 开局先跑 `git status`，工作区脏先向用户报告再动手
  - 小步修改：一次提交一件事（`feat:` / `fix:` / `chore:` / `refactor:` 前缀）
  - 交付说明三段式：改了什么 / 怎么验证的（贴关键输出）/ 残余风险
  - UI 改动附截图
- ⚠️ **先问用户**
  - 动数据结构（localStorage key、JSON schema、平台数据库字段）
  - 动启动流程、端口、`xingyu-*.pyw` 任何内容
  - 删除任何文件或目录
  - 升级任何依赖版本
- 🚫 **永远不做**
  - 密钥/API Key 写进任何入库文件
  - 在仓库里留 `.bak` / `.tmp` / `_preview*` 文件（回退用 `git checkout`）
  - 一次提交混入多件事；未跑自检就宣称完成
  - 在 `data/`、`edge-profile/`、`webview-data/`、`.venv-native/` 里翻找"可改的文件"

## 工作流（不许跳步）

1. `git status` → 脏工作区先报告，确认基底再动手
2. 用 3-5 句话复述任务 + 验收标准，等用户确认
3. 小步修改，不做"顺手重构"
4. 自检：跑上面的命令，贴关键输出
5. 交付说明 + 残余风险；用户验收不过先改 spec/理解，再改代码

## 本项目实测的坑（症状 → 原因 → 解法，持续追加）

1. pip 装包报 `[safe-delete] fail-closed` → WorkBuddy 沙箱环境变量 → 先执行
   `export CODEBUDDY_SESSION_ID= CLAUDE_SESSION_ID= CODEBUDDY_SAFE_DELETE_SANDBOX=` 再 pip；
   包已损坏的表现是 `certifi` 无 `where()` 等，需删掉 site-packages 里对应包目录重装
2. pywebview 6.2.1 不读 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 环境变量
   → 须 patch `EdgeChrome.__init__` 注入 `--autoplay-policy` 等参数
3. 本机 Bash coreutils 不可用（dirname / wc / head / mkdir 全无）
   → 文件与目录操作一律用 Python `os` 模块，不要用 shell 命令
4. 托管 Python 3.13.12 已损坏（distutils-hack，启动即崩）
   → 用系统 Python 3.14 或 `D:\星屿\voxvenv` 的 3.12.10
5. VoxCPM CPU 推理 2B 模型一句 1-3 分钟 → 前端状态栏必须耐心显示进度；链路验证用 0.5B
6. 桌面截屏/点击坐标错乱 → 先 `SetProcessDpiAwareness(2)`（本机 2x HiDPI，物理 2880×1920）
7. `data/ai-key-local.txt`、`js/local-config.js` 含真实密钥 → AI 只验证存在性，绝不打印内容
