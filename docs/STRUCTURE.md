# 星屿 · 项目结构说明

> 2026-09-14 结构优化时建立。约定：**根目录只放入口与配置**，文档进 `docs/`，
> 调试产物不进仓库。长期维护请先读这份，再动手。

## 目录职责

| 路径 | 职责 | 备注 |
|---|---|---|
| `index.html` | 平台主页面（唯一入口） | 体量偏大，拆分见下文路线图 |
| `schedule.html` | 超级课程表子页面 | 独立页面 |
| `agent-pet.html` / `ai-orb*.html` / `avatar-lab.html` | 桌面宠物 / 球体编辑器等独立工具页 | 各自独立加载 |
| `server.py` | 本机 HTTP 服务（8620）：静态托管 + API + 语音/AI 代理 | 拆分见路线图 |
| `server-launcher.pyw` | 桌面快捷方式入口（推导 ROOT、配 venv、重定向日志） | 路径不写死，勿改坏 |
| `xingyu-*.pyw` | 原生壳 / 宠物 / 唤醒等本机启动器 | 不入库（本机专用） |
| `platform_db.py` | 本地数据层 | |
| `js/` `css/` `assets/` | 前端代码与静态资源 | **不留 .bak**，回退用 git |
| `docs/` | 全部项目文档（设计/产品/审计/交接/更新说明） | 根目录只留 README |
| `tests/` | 正式测试（`npm run check` 驱动） | 只留 6 个用例文件 |
| `tests/dev/` | 一次性调试/诊断脚本 | 不入库 |
| `tests/artifacts/` | 测试截图产物 | 不入库 |
| `scripts/` `tools/` | 维护脚本（新闻抓取、快捷方式、同步推送等） | scripts 不入库 |
| `voxcpm/` | TTS 适配层（8000 端口） | 不入库（本机后端） |
| `agent-service/` `focus*/` `synapse-run/` `orb/` `nexus/` `toolknit/` `foldcraft/` `hero/` `particles/` `securify/` `news/` | 各功能子模块 / 子应用 | 部分为独立小应用 |
| `data/` | 运行时数据（db、日志、密钥） | 敏感文件严禁入库 |
| `_bak/` | 本地历史归档（20260914 前的散落 .bak 都归这里） | 不入库，非必需可删 |
| `.github/workflows/` | CI（test.yml）与每日新闻/天气（weather.yml） | |

## 版本与发布纪律（沿用既有约定）

1. 改前端必须双升版本号：`index.html` 资源 `?v=` + `sw.js` 的 `CACHE` 常量。
2. 本地验证：`npm run check`（SRS + AI 上下文 + Python 冒烟 + 质量冒烟）。
3. 备份一律靠 git 提交，**禁止再留 `*.bak-*` 散落文件**（`.gitignore` 已兜底忽略）。
4. 密钥只写 `js/local-config.js` / `data/ai-key-local.txt`，两者均已忽略且有 CI 扫描。

## 巨文件拆分路线图（按优先级，未动手，每步带验证门槛）

> 原则（参考成熟开源项目做法）：**先描边界、再小步搬移、每步可回退**。
> 前端拆分受限于「本机沙箱无法用浏览器实测 UI」，必须用户亲自验收后才合并。

1. **`server.py`（~94KB，可优先做，可无头验证）**
   按现有函数自然分四层：`server/lan.py`（局域网/二维码）、
   `server/proxy_vox.py`（/vox-proxy + ASR）、`server/proxy_ai.py`（AI/视觉代理）、
   `server/api_data.py`（/api/data CRUD + 备份），`server.py` 只留 Handler 路由与启动。
   每搬一层跑 `python -m unittest tests.test_platform` + 起服务打 `/__xingyu_health__`。
2. **`js/app.js`（279KB）**：先抽纯工具函数（无 DOM 依赖）到 `js/lib/`，
   再按视图拆模块；全程 `node --check` + 双升版本号 + 用户 UI 验收。
3. **`css/style.css`（221KB）**：按视图分区注释 → 抽 `css/views/*.css`，
   引入顺序保持原文件内顺序（避免级联回归）。
4. **`index.html`（135KB）**：最后做；把内联大段模板/脚本外置到 `js/` 后再评估。
