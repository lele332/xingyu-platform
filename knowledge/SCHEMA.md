# 星屿课程知识库数据规范 v1

所有文件 UTF-8 **无 BOM**，JSON 缩进 2 空格，末尾换行。除注明外，缺失值用 `null`，不得省略键。

---

## 0. 通用字段

每个可检索实体都必须带：

| 字段 | 含义 |
|---|---|
| `id` | 全局唯一，格式 `<subjectId>-<type>-<序号>`，如 `bridge-engineering-formula-003` |
| `subjectId` | 课程 id，必须存在于 `catalog/subjects.json` |
| `chapter` | 所属章节号字符串，如 `"3.2"`，与 syllabus 对应；跨章用 `"/"` 分隔 |
| `figure` | 图示（见 §0.1）；没有则 `null` |
| `confidence` | `"high"` \| `"medium"` \| `"low"`：对本条目技术准确性的自评 |
| `cite` | `{book, edition, chapter, page}`；`page` 未知时必须写 `null`（**禁止猜测页码**） |
| `verify` | 字符串：本条目需要用户回本机/教材核对什么；无则 `null` |

### 0.1 `figure` — 图示（2026-09-15 新增）

工程课的概念与公式离不开图，但**教材原图不入库**（版权 + 无法核实）。`figure` 登记的是自绘示意图：

```json
"figure": {
  "src": "/knowledge/assets/<subjectId>/<name>.svg",
  "caption": "一句话说明这张图在讲什么",
  "readPoints": ["读图要点 1", "读图要点 2"]
}
```

纪律：
- SVG 放在 `knowledge/assets/<subjectId>/`，由 server 直出静态文件，不引外网、不引 CDN。
- `caption` 里必须能看出这是示意图而非教材原图；`readPoints` 每条是**一句能直接指导看图/做题的话**，不写"如图所示"这类废话。
- 图上的尺寸、系数若与教材不同，必须在 `readPoints` 或 `verify` 里说明（示意图按通用教学口径绘制）。

**诚实原则**：
- 教材、规范的**具体页码、表号、公式编号、条文编号**在没有原书时一律 `null`，不得编造。
- 通用工程知识（定义、公式、方法）可以写，但要在 `confidence` 里如实标注。
- `verify` 字段要把"我不知道但我怀疑的地方"写清楚，让智能体能提醒用户核对。

---

## 1. `syllabus.json` — 章节地图

```json
{
  "subjectId": "bridge-engineering",
  "book": { "title": "桥梁工程", "edition": "第6版", "publisher": "人民交通出版社", "year": null, "isbn": null },
  "outlineBasis": "依据该教材通行目录结构整理；章节标题为通用教学大纲口径，页码待核对",
  "confidence": "medium",
  "chapters": [
    {
      "no": "1",
      "title": "总论",
      "anchorPage": null,
      "hours": null,
      "summary": "本章解决的问题一句话",
      "sections": [
        {
          "no": "1.1",
          "title": "桥梁的组成与分类",
          "keypoints": ["要点1", "要点2"],
          "terms": ["术语1", "术语2"],
          "homeworkFocus": "本章作业常见考点",
          "practice": "课程设计/实验/实习环节（没有则 null）"
        }
      ]
    }
  ]
}
```

要求：章节数 8–14 章，每章 2–6 节。这是整门课的骨架，决定后续检索的上下文前置质量。

---

## 2. `concepts.json` — 概念卡

```json
{
  "items": [
    {
      "id": "bridge-engineering-concept-001",
      "subjectId": "bridge-engineering",
      "chapter": "1.1",
      "term": "计算跨径",
      "en": "computed span",
      "definition": "桥跨结构相邻两个支座中心线之间的水平距离。",
      "formulaId": null,
      "symbols": ["l"],
      "unit": "m",
      "relations": ["净跨径", "标准跨径"],
      "pitfalls": ["常与标准跨径混淆：标准跨径用于跨径分级，计算跨径用于结构计算"],
      "examAngle": "常考概念辨析",
      "confidence": "high",
      "cite": { "book": "桥梁工程", "edition": "第6版", "chapter": "1", "page": null },
      "verify": null
    }
  ]
}
```

每门课 **40–80 条**，覆盖全书核心术语，优先考试中易混淆的。

---

## 3. `formulas.json` — 公式卡

```json
{
  "items": [
    {
      "id": "hydraulics-hydrology-formula-001",
      "subjectId": "hydraulics-hydrology",
      "chapter": "4.3",
      "name": "推理公式（小流域设计流量）",
      "expr": "Qp = 0.278 * psi * i * F",
      "latex": "Q_p = 0.278 \\, \\psi \\, i \\, F",
      "vars": [
        { "sym": "Qp", "name": "设计洪峰流量", "unit": "m³/s", "note": "重现期 P 对应的峰值" },
        { "sym": "psi", "name": "径流系数", "unit": "—", "note": "按汇水区地表覆盖取值" },
        { "sym": "i", "name": "设计暴雨强度", "unit": "mm/h", "note": "需按降雨历时=汇流历时迭代确定" },
        { "sym": "F", "name": "汇水面积", "unit": "km²", "note": "地形图上勾绘" }
      ],
      "conditions": ["适用于汇水面积较小（通常 < 50 km²）的小流域", "假定降雨在汇水面上均匀分布"],
      "derivationHint": "由暴雨强度×汇水面积，再乘单位换算系数 0.278 得到。",
      "typicalUse": "桥涵孔径水文计算第一步",
      "pitfalls": ["单位必须统一为 mm/h 与 km²，否则 0.278 系数失效", "汇流历时与降雨历时需迭代收敛"],
      "standardRef": ["JTG C30"],
      "confidence": "medium",
      "cite": { "book": "水利学与桥涵水文", "edition": null, "chapter": "4", "page": null },
      "verify": "系数 0.278 与单位换算请以原书为准；适用汇水面积上限按教材表述核对"
    }
  ]
}
```

每门课 **30–70 条**。`expr` 必须是可计算的 ASCII 表达式（用于自测与单位检查）；`latex` 用于渲染；两者要一致。

---

## 4. `exercises.json` — 典型题 / 作业辅导卡

```json
{
  "items": [
    {
      "id": "engineering-economics-exercise-001",
      "subjectId": "engineering-economics",
      "chapter": "3",
      "title": "等额系列终值计算",
      "kind": "计算题",
      "difficulty": "medium",
      "frequency": "高频",
      "stem": "某企业每年年末存入 10 万元，年利率 6%，求第 5 年末本利和。",
      "given": [["A", "10 万元/年"], ["i", "6%"], ["n", "5 年"]],
      "goal": "F",
      "approachSteps": [
        "判断现金流形态：年末等额 → 普通年金，用等额系列终值公式",
        "查/写公式 F = A[(1+i)^n − 1]/i",
        "代入 A=10, i=0.06, n=5",
        "复核数量级：F 应略大于 A×n"
      ],
      "keyFormulas": ["engineering-economics-formula-007"],
      "answer": "F ≈ 56.37 万元",
      "answerPolicy": "默认只给到思路与关键式；用户要求「给答案」时再展示",
      "selfCheck": ["n 与计息期数一致", "年末/年初约定是否匹配公式", "利率与计息周期是否同步"],
      "commonErrors": ["把年金现值公式误用到终值", "期初年金与期末年金混淆"],
      "confidence": "high",
      "cite": { "book": "工程经济学", "edition": "第5版", "chapter": "3", "page": null },
      "verify": null
    }
  ]
}
```

每门课 **15–30 题**，覆盖作业高频题型。`answerPolicy` 固定为上述默认策略字符串。

---

## 5. `standards.json` — 规范索引（**不含条文全文**）

```json
{
  "items": [
    {
      "id": "bridge-engineering-standard-001",
      "subjectId": "bridge-engineering",
      "code": "JTG D60",
      "name": "公路桥涵设计通用规范",
      "year": null,
      "status": "需核对现行版本",
      "appliesTo": ["作用组合", "通行净空", "桥梁设计基准期"],
      "usedInChapters": ["2", "4"],
      "notes": "教材中引用的版本可能与现行版本不同，作业取值前必须确认教师要求的版本。",
      "confidence": "medium",
      "verify": "现行版本号与实施日期请查交通运输部官网或学校指定的规范汇编"
    }
  ]
}
```

每门课 **8–20 条**。只登记编号与适用范围，**绝不写条文原文**。

---

## 6. `books.json` — 延伸优质书目

```json
{
  "items": [
    {
      "id": "bridge-engineering-book-001",
      "subjectId": "bridge-engineering",
      "title": "桥梁工程",
      "author": "范立础",
      "publisher": "人民交通出版社",
      "level": "教材",
      "why": "与用户所用教材互补的经典版本，体系更偏受力分析。",
      "readPlan": "预习时读第1章建立整体概念；作业卡壳时按章对照理解。",
      "relatesToChapters": ["1", "3", "5"],
      "acquireNote": "图书馆可借 / 出版社正版渠道",
      "confidence": "medium",
      "verify": "书名与作者请按馆藏或出版社目录核对"
    }
  ]
}
```

每门课 **8–15 本**：包括更经典的替代教材、考研/执业考试辅导、行业手册/规范实施指南、英文经典（如有）、科普/工程实务书。**只给书目元数据与导读，正文不入库。**

### 6.1 书目核实字段（2026-09-15 新增）

书目是唯一允许「在线核实」的实体（书名 / 作者 / 出版社可通过出版社官网、图书馆 OPAC、教材采选系统查证），因此额外登记：

| 字段 | 含义 |
|---|---|
| `edition` | 版次字符串，如 `"第 5 版（2020-10）"`；未知为 `null` |
| `year` | 版次对应出版年（整数）；未知为 `null` |
| `isbn` | ISBN-13 字符串；**未查到可靠来源时必须为 `null`，禁止推测** |
| `verification.status` | `"confirmed"`（书名/作者/出版社已用可靠来源核对）\| `"partial"`（仅部分字段确认）\| `"unverified"`（未查到可靠来源，多为类别占位条目） |
| `verification.source` | 核实依据，写清来源机构（如"高等教育出版社产品信息检索系统"），不写裸链接 |
| `verification.checkedAt` | 核实日期 `YYYY-MM-DD` |
| `verification.note` | 修正说明 / 残余疑问，例如"原条目出版社有误，已修正" |

纪律：
- 纠正原值时（`title` / `author` / `publisher` 写错了），必须在 `verification.note` 里写明**原值是什么、改成了什么、依据是什么**，不得静默改写。
- `unverified` 条目如果本身只是「类别占位」（作者写着"需核对""待核"），`why` 与 `readPlan` 一律不能当作真实导读使用，智能体回答时必须提示用户按馆藏确认。

### 6.2 `sources.json` — 文献源索引（2026-09-15 新增，9 门课各一份）

`sources.json` **不是文献全文**，只登记「去哪儿查、查什么、以谁为准」。论文受版权保护，一律不入库。

顶层：`{ subjectId, note, updatedAt, items[], searchTemplates[] }`

`items[]` 每个对象：

| 字段 | 含义 |
|---|---|
| `id` | `<subjectId>-source-NNN` |
| `type` | `journal`（期刊）/ `standard`（规范）/ `database`（数据库）/ `org`（机构）/ `method`（方法） |
| `name` | 名称。规范类写成 `"<编号> <名称>"`，并另填 `code` |
| `en` / `org` | 英文刊名 / 主办单位（可选） |
| `level` | 层级提示：`A` / `B`（期刊），`S`（规范），`D`（数据库），`O`（机构），`M`（方法） |
| `why` | 为什么值得查（一句话） |
| `howToUse` | 怎么用（检索式、看哪类文章、体系差异提醒） |
| `access` | 获取途径 |
| `confidence` | `high` / `medium` / `low` |
| `verify` | 版本、编号、替代关系等需核对的说明；无误为 `null` |

纪律：
- **不写条文号、表号、限值、页码。** 规范类只给编号与用途，取值一律让用户查现行版。
- 发现编号错误（例：曾把《公路桥梁荷载试验规程》误写为 JTG/T J22，实为 **JTG/T J21-01-2015**）时，在 `verify` 里写明原值、正确值与依据，不静默改写。
- 涉及税率、折现率、物价指数等政策参数，必须标 `medium` 并在 `howToUse` 里提示"以现行政策/教师要求为准"。

---

## 7. 输出纪律

- 一个 np.nan / Python True / 尾逗号都不许出现——必须是严格合法 JSON。
- 中文标点正常使用；技术符号、变量名保持 ASCII。
- 写完后**必须**自己 `python -c "import json;json.load(open(...))"` 校验（用 Read 检查也行，但必须校验）。
- 文件写到 `knowledge/subjects/<subjectId>/<type>.json`。
