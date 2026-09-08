# 星屿平台优化计划（2026-09-08）

## 目标
保持「零构建、本地优先、单机可维护」的产品约束，把平台从“功能大而全”推进到“学习闭环可靠、数据安全、性能可验证”。

## 已接入的开源能力
以下 Codex skill 来自 `openai/skills`，已通过 skill-installer 安装：

- `pdf`：用于后续 PDF/PDF 工具链的提取、生成与渲染检查。
- `speech`：用于后续 TTS 音频生成与发音/朗读类功能的规范。
- `transcribe`：用于课堂录音、语音笔记、语音 Agent 的转写路径。
- `playwright-interactive`：用于本地 UI 调试与自动化冒烟。
- `security-ownership-map`：用于维护者/敏感代码所有权与热点分析。
- `screenshot`：用于桌面端视觉验证与回归截图。
- `xingyu-performance-optimization`（addyosmani/agent-skills）：性能审计与瓶颈验证。
- `xingyu-code-review-quality`（addyosmani/agent-skills）：修改前后的代码质量复查。
- `xingyu-browser-testing-devtools`（addyosmani/agent-skills）：真实浏览器冒烟、控制台与网络验证。

## 当前优先级

### P0：工程与数据安全
1. 保持 GitHub Actions 冒烟测试：`npm run check`。
2. 测试目录不写真实用户数据；备份/反馈测试使用临时目录。
3. 继续清理大资源：`toolknit` 内 32MB WASM、10MB 字体、测试截图不应无脑入库。
4. 主分支数据自动化必须先 rebase 再提交，避免新闻/天气数据互相冲突。

### P1：学习闭环
1. 知识卡片接入 FSRS 调度，仪表盘提供“今日复习”。
2. AI 生成的卡片输出结构化 JSON，并可一键加入复习队列。
3. 番茄钟已支持绑定任务，形成“任务 → 专注时长 → 复盘”的闭环。
4. 首页应持续回答三个问题：
   - 今天必须完成什么任务；
   - 今天必须复习什么卡片；
   - 最近的考试/DDL 需要预留多少时间。

### P2：知识库与内容处理
1. 大文本、附件、PDF 摘要、历史版本逐步迁到 IndexedDB 或本地数据库。
2. PDF/录音/图片 OCR 可作为“学习资料导入”统一入口，不应散落在工具箱。
3. 笔记应保留 Markdown、标签、反向链接和搜索索引。

### P3：性能与体验
1. `js/app.js` 与 `js/voice-agent.js` 体量较大，后续应按视图拆分。
2. 大媒体资源使用懒加载；核心脚本保持 `defer`。
3. 每次修改核心资源后递增 `sw.js` 的 `CACHE`，并同步更新预缓存清单。
4. 建议用 Playwright 持续检查：
   - 无横向滚动；
   - 无 pageerror；
   - 首屏可交互时间；
   - 今日复习卡片可完成评分。

## 本轮已完成
- 修复平台冒烟测试、UI 冒烟测试、番茄钟冒烟测试的测试隔离问题。
- 新增 GitHub Actions 测试工作流。
- 新增零依赖 FSRS 调度器与仪表盘复习卡。
- AI 知识卡片改为结构化 JSON 输出，并支持一键加入复习队列。
- 知识卡片列表显示“待复习 / 下次复习”。
- 新增 `npm run check` 汇总测试入口。
- 番茄钟支持绑定任务，专注记录可追溯到任务。
- 新增 `Store.addMany()`，AI 卡片、课表/成绩/笔记批量导入改为一次落盘，减少高频全量写。
- localStorage 配额失败时优先清理可再生本地备份并重试，避免当前数据立刻失败。
- 局域网设备访问 `js/local-config.js` 时服务端重写为“同源 AI 代理 + 空 Key”，不再把桌面端 API Key 泄露给已授权设备。
- 新增局域网 local-config 脱敏测试。
- 已完成真实浏览器 UI / 番茄钟 / SRS / Python 平台测试；临时性能探针显示控制台 0 错误，长任务主要来自开屏/启动渲染，后续可做持续性能预算。
