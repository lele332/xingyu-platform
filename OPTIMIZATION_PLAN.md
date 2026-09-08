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

## 第二轮（2026-09-09）：App 完备性升级

对标 GitHub 高星项目（Shiori-v1 / Synapse / FocusTide / DoHabit / skola / Alexandrie）后的差距修复：

- PWA manifest 新增 `shortcuts`（专注/复习/笔记/任务四项）、`share_target`（从其他 app 分享文本到星屿）、`categories`、`launch_handler`、`display_override`。
- 新增 `js/app-shell.js`：
  - App Badge（系统级待办角标 setAppBadge/clearAppBadge）。
  - Service Worker 更新提示（新版本缓存完成→底部横幅→点击刷新）。
  - PWA 安装引导横幅（beforeinstallprompt → 延迟显示 → 一键安装）。
  - 键盘快捷键系统：Alt+1~9 切视图，Ctrl+K 搜索，Alt+N 新笔记，Alt+T 新任务，Alt+P 开始专注，Alt+, 设置，Alt+/ 帮助面板。
  - URL 参数处理：?view=xxx 直接跳转，?shortcut=pomo/new-note/new-task 触发动作，?share=1 接收分享内容。
- 新增 `js/reminders.js`：
  - 桌面通知提醒：任务截止 / 考试到期 / FSRS 复习到期。
  - 每分钟检查，仅在 7:00-23:00 之间。
  - 设置页提供开关 + 测试通知按钮。
- 课程页新增 iCal (.ics) 导出：课程表（周循环）+ 考试日程，可直接导入 Apple Calendar / Google Calendar / Outlook。
- Service Worker 缓存版本升至 `xingyu-static-20260909-01`，预缓存清单加入 app-shell.js 和 reminders.js。


## 第三至第五轮（2026-09-09）：AI 更懂我 / 更聪明

- AI 上下文引擎 v2：
  - BM25 笔记检索（IDF + TF 饱和 + 标题/标签加权 + 时间衰减）。
  - 学习状态感知（压力、精力、逾期、考试、深夜/早晨）。
  - 自适应建议根据状态调整行动。
- AI 本地长期偏好记忆：
  - 支持“请记住……”、学习目标、偏好/回避等显式信号。
  - AI 回答新增“有用 / 不够好”反馈；连续负面反馈会自动校准为短结论 + 明确下一步。
  - 偏好保存在本机 `settings.aiMemory`，可随星屿备份导出，首页提供“忘记偏好”。
- 首页新增 AI 今日洞察：把当前状态、自适应建议和已记住偏好变成可见、可操作的入口。
- 移植 MineEcho 的上下文预算思想（零依赖实现）：
  - 按复习 / 规划 / 排障 / 研究 / 写作 / 通用任务自动分场景。
  - 控制系统上下文与历史预算，保头尾、压缩中段，避免内容量大时无关信息稀释关键上下文。
  - 新增 `npm run test:ai`，并纳入 `npm run check`。
- 公开仓库调研结论：
  - `manderwall/aplusstudyapp`：零构建离线 FSRS PWA，其 PIN + PBKDF2 + AES-GCM + IndexedDB 的本地加密思路可作为后续本地数据加密参考。
  - `Health-Yang/MineEcho`：L0-L3 记忆树、重要性/时效混合排序、上下文预算与检索重排，适合后续升级星屿 AI 记忆。
  - 两者的共同启发：AI 的长期能力不只靠模型，更靠“可压缩、可检索、可解释、可遗忘”的本地上下文架构。

## 验证
- `npm run check`：SRS + AI context budget + 11 项平台测试通过。
- `npm run test:pomo`：番茄钟冒烟通过。
- `npm run test:ui`：三视口布局、AI 洞察、AI 偏好学习、AI 反馈、保存笔记、主题、图标全部通过。
