# 星屿专业课程知识库

## 目标
把平台从“会记笔记的 AI”升级成“懂工程建设专业学习过程的学习教练”：能按课程预习、讲概念、推导公式、辅导作业、整理错题、生成复习计划，并且每个教材型回答都能回溯到来源文件、章节和页码。

## 当前课程目录
见 `knowledge/catalog/subjects.json`。已登记用户指定的 9 门课程与版本信息。

## 重要边界
- 目录登记不等于教材全文已经入库。用户需要把自己拥有或获授权的 PDF/DOCX/TXT/Markdown 放入 `knowledge/sources/`，再运行导入脚本。
- 不自动从网络下载或复制受版权保护的教材全文。
- 没有检索证据时，智能体必须标记“需要核对教材/规范”，不能假装知道页码。

## 长期结构
```
knowledge/
  SCHEMA.md                   # 数据规范（6 类资产的字段与诚实原则）
  catalog/subjects.json       # 课程、版本、别名与来源规则
  subjects/<subject-id>/      # 知识资产：syllabus / concepts / formulas / exercises / standards / books
  sources/<subject-id>/       # 用户授权的原始教材/讲义
  chunks/<subject-id>.jsonl   # 可重建的分块索引（不手改）
  manifests/                  # 导入批次、校验和、页码映射
  prompts/coach-system.md     # 课程教练系统提示
  index/                      # 检索索引（可重建，缓存）
scripts/knowledge/
  kbcore.py                   # 核心：加载、中文分词、BM25、混合检索、上下文组装
  ingest.py                   # 导入（按页提取、页码映射、去重、manifest）
  query.py                    # CLI：search / context / subjects / outline / stats
```

## 服务端与前端（M2 已落地）
- `server.py` 暴露 `/api/kb/{stats,subjects,outline,list,search,context,prompt}`。
- 前端视图 `专业课程库`（`js/course-kb.js` + `css/course-kb.css`）：课程列表、章节地图、
  概念/公式/题型/规范/参考书浏览、全库检索、「问这门课」（检索证据 + 课程教练提示词注入 AI）。
- 笔记编辑器内可一键「让课程教练基于这篇笔记讲解」，自动按笔记的所属课程路由。
- 内置 mini-LaTeX 渲染器（无 KaTeX 依赖），公式卡直接可视化。

## 智能体工作协议
1. 先识别课程、任务类型（预习/作业/复习/整理/考试）。
2. 先查用户笔记与课程知识库，再补充通用知识；两者冲突时分别标注。
3. 作业只给“思路 → 关键公式/假设 → 分步计算 → 自检”，除非用户要求再给最终答案。
4. 公式必须带变量定义、单位和适用条件；工程判断必须说明假设。
5. 每次引用知识库都返回 `[课程 · 章节/页码 · 来源文件]`；无页码时标记“页码未解析”。
6. 遇到规范、设计参数、现行标准，提示用户确认采用的标准版本，不把教材结论当成现行规范。

## 分阶段路线
- M1（已落地）：课程目录、授权导入（按页/页码映射/去重/manifest）、可重建文本分块、检索命令。
- M2（已落地）：2236 条结构化知识条目入库（9 门课 × 章节地图/概念/公式/题型/规范/书目）、
  BM25+上下文前缀检索、`/api/kb/*` 服务、课程教练视图、AI 证据注入与引用协议。
- M3：向量检索 + BM25 混合召回 + rerank + 引用卡片。
- M4：每门课建立进度诊断、错题反思与复习闭环（对接 srs.js）。
- M5：作业拍照/OCR、图表/结构示意图识别、答案过程评分。

## 导入教材全文（版权边界内）
把你自己拥有或获授权的 PDF/DOCX/MD/TXT 放入任意目录后：
```
python scripts/knowledge/ingest.py --subject bridge-engineering --file 桥梁工程.pdf
python scripts/knowledge/ingest.py --subject bridge-engineering --dir D:\books\bridge
```
- PDF 按页提取并保留页码，检索结果可定位到页；扫描版 PDF 需先 OCR。
- 同一文件重复导入自动去重（按 sha256）；`--reindex` 只重建索引。
- 导入的教材原文在检索中优先于结构化摘要（source 类型加权）。

## 验收标准
- 导入可重复运行，不产生重复分块。✅（sha256 去重已验证）
- 任意回答可以定位到源文件和章节/页码。✅（引用协议 + 页码映射）
- 删除/替换教材后可重建索引。✅（--reindex 已验证）
- 知识库不可用时平台仍能正常记笔记和对话。✅（/api/kb 返回 503 降级，前端静默）
- 所有更改通过 `npm run check`。✅（srs / context-budget / unittest 11 项 / quality-smoke 全通过，
  另有 tests/kb-smoke.js 专测本模块）
