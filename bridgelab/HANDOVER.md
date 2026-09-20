# 桥梁结构实验室 · HANDOVER 交接文档

> 交接日期：2026-09-18　|　模块版本：`?v=20260918.15`
> 定位：星屿平台的桥梁专业教学演示模块——平面杆系有限元 + 影响线最不利布载 + 规范验算 + 六大模块 UI。

---

## 1. 文件结构

```
bridgelab/
├── index.html        六模块 UI：梁桥 / 拱桥 / 斜拉桥 / 悬索桥 / 桥墩与桩基 / 桥涵水文
├── style.css         Apple 深色语言（纯黑底 #000、系统蓝 #0a84ff、14px 圆角、无渐变无发光）
├── app.js            控制器：模块切换、参数绑定、数值输入双向同步、SVG 渲染、计算书
├── fem.js            2 自由度梁单元 FEM（挠度+转角），服务于梁桥模块
├── frame.js          3 自由度平面框架单元 + 桁架/索单元 + 几何刚度 + Ernst 折减
├── bridge.js         梁桥领域层：截面、车道荷载、横向分布、冲击系数、JTG 3362 验算
├── systems.js        体系桥：拱桥 / 斜拉桥 / 悬索桥 几何生成 + 成桥计算 + 验算
├── pier.js           桥墩：条带法偏心受压、裂缝宽度、单桩容许承载力
├── hydrology.js      桥涵水文：设计流量 → 桥孔 → 一般/局部冲刷 → 基底埋深
├── groundmotion.js   地震动导入：PEER .at2 / 两列「t,a」/ 单列+dt，PGA 调幅，重采样/加密，内置合成波
├── spatial-frame3d.js 3D 空间杆系：装配/静力/模态/反应谱/**Newmark-β 时程积分**
├── spatial-bridge.js 四种桥型 3D 建模 + analyze 编排 + Canvas 查看器（含时程播放）
├── test-fem.js       fem.js 解析验证（17 项）
├── test-frame.js     frame.js 解析验证（17 项）
├── test-domain.js    pier / hydrology / systems 冒烟测试
├── test-spatial-frame3d.js 3D 内核验算（13 项）
├── test-timehistory.js 时程积分解析验算（25 项）
└── HANDOVER.md       本文档
```

测试运行：`npm run test:bridge`（fem 17 + frame 17 + domain 全部 + spatial3d 13 + timehistory 25，当前全过）。

## 2. 单位与符号约定（全模块统一）

- **单位**：kN、m、kPa（frame.js EA/EI 用 kPa×m²）；`STEEL.fsd = 1.86e6` kPa（1860 MPa）。
- **坐标**：x 向右、y 向上、荷载向下为负。
- **弯矩 M**：下缘受拉为正；**画图时正弯矩在轴线下方**（受拉侧），这是 app.js 里 `+1×M` 偏移的由来，勿改。
- **轴力 N**：受拉为正（拱圈压力为负）。
- **位移 d**：全量数组，节点 i 的 u/d[3i]、v/d[3i+1]、θ/d[3i+2]。

## 3. 计算内核要点

### frame.js（平面框架 + 索）
- `FRAME.makeModel(nodes, elems)` → `{ solveF(F), elemForces(el, d) }`。
- nodes: `[{x, y, fixed:[ux,uy,θ]}]`；只连索/桁架的节点**自动锁 θ**（否则奇异）。
- 索单元 `T0` 初索力以等效节点力组装进右端项；`noEquivLoad: true` 时不组装（悬索桥成桥态：恒载与预张力自平衡，重复施加会错）。
- **几何刚度**：`el.Tg > 0` 时按 `k_g = (T/L)·垂直投影` 叠加 4 个平动自由度——悬索桥主缆"重力刚度"的来源，缺了整体是机构。
- `elemForces` 返回总内力 `N = -q[0] + N0`（含初索力）。

### systems.js（三种体系桥）
统一返回 `{ model, nodes, elems, chart, report, checks, loadCase }`：
- `chart: [{x, y, type, x2?, y2?}]`，type ∈ deck/beam/arch/tower/col/cable/hanger；带 x2/y2 的是线段，否则是折线点。
- 拱桥：无铰（拱脚固结）/铰接可选，悬链线 m、抛物线、圆弧三种拱轴；恒载沿水平投影施加到桥面节点。
- 斜拉桥：**锚点必须是塔身框架节点**（`SEG = fanS+1` 分段）；刚性支承连续梁法估初索力 → Ernst 折减迭代 8 轮；松弛索降级为 `EA=1e-6·Es·A` 并计数报告。
- 悬索桥：**塔顶节点必须与主缆端节点同对象合并**；主缆名义抗弯刚度 `EI = 1e-3·EA·L²/12` 抑制"折尺"机构；主缆面积用抛物线理论定点迭代（非 FEM 迭代）；吊索/主缆 `T0 = Tg` + `noEquivLoad` 报告总索力。

### pier.js
- 条带法（400 带）数值积分偏心受压：二分求中和轴 x 使 N(x) = η·Nd，η 按 JTG 3362 §5.3.3 简化式。
- 裂缝宽度 §6.4.3：`σss/Es` 直接用 kPa/kPa 得应变（⚠️ 历史事故：曾错除以 Es/1000，裂缝宽度假大 1000 倍）。
- 单桩承载力 §5.3.3：`[Ra] = 0.5uΣqik·li + Ap(m0λ[fa0] + k2γ2(h−3))`。

### hydrology.js
- 流程：推理公式 `Qp = 0.278ψ(Sp/τⁿ)F` → `Lj = Qp/(μ·hc·Vc)` → 64-1 修正式一般冲刷 → 65-2 式局部冲刷 → `Z = 河床 − Δz − hp − hb − Δc`。
- 粘性土走 `generalScourClay`（0.33/IL 替代 E·d^(1/6) 项）。

## 4. UI 架构（app.js）

- **模块系统**：`S.mod` + `setModule(m)`；面板 `modBeam/modArch/modCable/modSusp/modPier/modHydro` 显隐切换；深链 `?m=arch|cable|susp|pier|hydro`，梁桥预设深链 `?p=N`。
- **数值输入（midas Civil 式）**：`injectNum(range)` 给左栏**每个**滑块程序化生成孪生 `<input type="number">`，flex 容器 `.ctl` 双向同步；数字框 change → 钳到 [min,max] → 吸附 step → 回发 `input` 事件统一调度。
- **标签同步约定**：滑块值标签 span id = `"v" + rangeId.slice(1)`（如 `aL` → `vaL`）；梁桥面板沿用原 `syncLabels()`。
- **渲染复用**：所有模块共用 `#svgElev`（立面）/`#svgChart`（内力/对比图）/`#report`（计算书）；体系桥变形线**按节点 tag 分段**绘制，否则在拱圈/桥面/塔序列切换处出现横穿全桥的"飞线"。
- 调度：`run()` 按模块分发 → `runBeam()` / `renderSysMod` / `renderPierMod` / `renderHydroMod`，rAF 去抖。

## 5. 七个关键调试教训（踩过的坑，勿重蹈）

1. **solveF 顺序**：必须先 `buildK()` 再组装 T0 等效荷载——`el._geo` 在 buildK 里写入，顺序反了首次求解静默丢初索力（斜拉桥 T=0 的根因之一）。
2. **悬空锚点**：只连索的节点在 Ernst 折减使 EA 变小后让总刚退化为机构。斜拉桥锚点必须挂在塔身框架分段节点上。
3. **塔顶合并**：悬索桥塔顶与主缆端必须是同一节点对象，否则主缆水平推力无传力路径。
4. **fsd 单位**：1860 MPa 写成 `1860`（kPa 槽位）使面积迭代每轮放大 91.7 倍。所有强度值先查单位再进公式。
5. **重力刚度**：线性模型里悬索桥没有 k_g 就是机构（λmin≈1e-11，挠度 1.3 km）。诊断套路：LU 主元失败映射自由 DOF → 逆幂迭代求机构振型 → 针对性补刚度。
6. **只拉索**：索受压即退出工作（EA→1e-6 哨兵值 + T0=0），并把松弛计数如实写进验算。
7. **Ernst 统计口径**：折减率只统计受拉索，松弛索的 σ=50 kPa 下限会把 Eeq 拉到 ≈0 虚增折减率。

## 6. 已知简化与限制（诚实清单）

- 梁桥：平面梁单元，无空间横向分布（偏心压力法近似）、无剪力滞/扭转/徐变/施工阶段；宽跨比 >0.5 时偏心压力法偏不安全（UI 已提示）。
- 悬索桥：无端锚边跨的线性简化，FEM 索力 ≈1.6× 理论值、挠度偏大，报告中已标注"数量级概念演示"。
- 拱桥：固定拱脚 FE 推力/三铰理论 ≈1.16（弹性压缩+柱变形），测试按 0.75~1.5 合理带断言。
- 斜拉桥：仅恒载成桥态，未模拟活载与施工阶段索力调整。
- 水文：推理公式适合小流域；参数为常见量级，正式设计须核实现行规范版本。
- **所有模块均为教学演示，正式设计请用专业软件（midas Civil 等）复核。**

## 7. 扩展指南（加一个新模块的最短路径）

1. 建领域层 `xxx.js`，IIFE 挂 `root.XXX`，返回 `{ report:[{label,value,note}], checks:[{label,value,limit,pass,note}] }`（力学计算如需 FEM 走 frame.js）。
2. index.html 加 `<div class="modpane" id="modXxx">` 参数卡（滑块 id 起唯一前缀）+ 顶部模块按钮 + script 标签。
3. app.js：`PANES/MODS/BANNERS` 加条目 → 写 `renderXxxMod()`（用 `renderReportList()` 出计算书，SVG 直绘进 svgElev/svgChart）→ `run()` 加分发分支。
4. 版本号统一升 `?v=`（index.html 内 7 处 + 星屿父页 iframe 1 处）。
5. 冒烟测试加进 test-domain.js，截图过 headless-edge-screenshot 技能。

## 8. 验证记录（2026-09-16）

- `test-frame.js`：17/17 通过（悬臂/简支/连续/温度/初索力/Ernst/几何刚度等解析对拍）。
- `test-domain.js`：全部通过（拱推力比 1.16 在带内；斜拉 Ernst 12.5%@A=0.005、无松弛；悬索 H=24774 kN；墩 Mu=4556、w=0.030 mm；水文全流程）。
- 六模块 UI 截图验证通过（1720×3200 无头 Edge，无 Uncaught 报错）。
- 本次修复：裂缝宽度 ÷1000 单位事故、Ernst 折减统计口径、默认索面积 0.005 m²、变形线飞线。

## 9. 桌面端修复（2026-09-16 第二轮）

**用户反馈"桌面端是很小的窗口根本用不了"——属实，且每轮验证都只测了宽屏网页端，漏掉了真实运行环境。**

根因与修复：
1. **iframe 无尺寸规则（根因）**：星屿主页面 `css/style.css` 里 prisma/toolknit 等模块都有 `#view-xxx iframe { width:100%; height:calc(100vh - 62px) }` 全屏规则，`#view-bridgelab` 被遗漏 → 浏览器默认 iframe 300×150px 小方块。已补齐（含 767px 以下移动端高度）。
2. **桌面端真实视口**：Edge `--app --start-fullscreen`，HiDPI 200% → 逻辑宽 1440 − 侧边栏 248 ≈ **1192px iframe 视口**。此宽度落在 bridgelab `@media (max-width:1480px)` 两栏降级区间内，布局自动适配，900 宽 SVG 近 1:1 显示。**此后验证一律加测 1192×898。**
3. **桥墩面板 ID 冲突（连带揪出的数据 bug）**：`pT1/pT2`（土层厚度）与梁桥 `pT1/pT2`（顶/底板厚）重名 → 土层厚度实际读到 0.25/0.22 m，桩基侧阻被算成 98 kN（应 3958）、桩在立面图上几乎不可见。已改名 `pPT1/pPT2`。`pB`（矩形截面宽）同理改名 `pPB`。**教训：多模块共页时每个 input id 必须唯一前缀，用脚本全量扫 `id=` 重复作回归项。**
4. 桥墩立面坐标修正：yUp 从桩底量起（地面=pileL、柱顶=totalH），此前地面线错位导致柱/桩画反；土层顺序改为①浅②深（地质惯例）。
5. `syncPaneLabels` 标签匹配加 fallback（`v+id.slice(1)` 或 `v+id`，桥墩面板 pD→vpD）。
6. 版本号 20260916.2 → **20260916.3**（bridgelab index.html 8 处 + 星屿父页 iframe）。改了 JS 必须升 `?v=`，否则启发式缓存会让截图验证失效（本轮已踩）。
7. 验证手段升级：`--dump-dom` 直接量渲染后 SVG rect 坐标，比目测截图可靠；桥墩三种截面（圆/矩/圆端）数值链 node 冒烟全过（Mu=4556/13115/11273，Ra=6892=侧阻3958+端阻2933）。

## 10. 侧边栏图标（2026-09-16 第三、四轮）

### 为什么必须做
星屿侧边栏图标由 `js/icons.js` 的 `paths` 映射驱动，`decorateNavigation()` 按按钮的 `data-view` 取图标。
**key 缺失时不报错，静默 fallback 成 `paths.more`（三个点）** —— 所以新增视图后忘了加 key，界面上只是「图标有点怪」，不会有人发现。bridgelab 就踩过。

### 定稿图标：斜拉桥
用户明确要求「我要斜拉桥的图标」（此前是梁桥剪影）。参考 `lucide:bridge`（塔柱 + 斜向缆索语汇）
与 `game-icons/cable-stayed-bridge`（真实扇形索布置）后定稿：

```js
/* 独塔斜拉桥：中央塔柱 + 塔顶横梁 + 桥面 + 每侧 3 根细长索（共 6 根，塔上错标高锚固，索长梯度 3.5→16.1px） */
bridgelab: '<path d="M12 4.2v11.6"/><path d="M10.4 4.2h3.2"/><path d="M1.2 16.2h21.6"/><path d="M12 4.2 1.2 16.2"/><path d="M12 8.9 4.2 16.2"/><path d="M12 13.6 9.6 16.2"/><path d="M12 4.2 22.8 16.2"/><path d="M12 8.9 19.8 16.2"/><path d="M12 13.6 14.4 16.2"/><path d="M1.2 20.6h5.4"/><path d="M17.4 20.6h5.4"/>',
```

### 画 24px 线性图标的铁律（迭代 13 次换来的）

1. 🔴 **「线太粗/糊在一起」是间距问题，不是线宽问题。** 量化判据：
   **同组线的「最小水平间距」必须 > stroke-width（本图标 1.75px）**。
   采样脚本：沿 y 逐点算各线 x 坐标 → 排序 → 取相邻差的最小值。
   - 双塔 6 根索 → 0.12px（糊）
   - 双塔 4 根索**从塔顶同一点**出发 → 0.75px（糊，**几何宿命**：同点出发的线在起点附近必然重合，
     改落点毫无用处）
   - 独塔 4 根 + 错标高锚固 → 3.41px；最终 6 根 → 3.01px
2. 🔴 **索不得交叉 —— 这是间距的前提。** 塔上锚点标高顺序 与 桥面落点远近顺序必须
   **单调一致**（塔顶→落最远，塔腰→落最近）。顺序一交叉，索互相穿越，最小间距从 2.0px 掉到 **0.01px**。
3. 🔴 **「数学间距达标 ≠ 视觉分离」（最重要的教训）**：每侧 5 根（共 10 根）时数学间距 2.00px 达标，
   但渲染出来是**一整块实心三角** —— 倾角接近（45°~49°）的近平行斜线铺满三角区，必然糊。
   → **24px 密索图标索数上限 6 根（3/侧）**；**数值断言必须配缩略图人眼复核，缺一不可**。
   实测对照：10 根 = 实心块；6 根 = 骨架清晰。
4. 🔴 **连接件必须真的连到承托面。** 首版索的落点写成 y=12.4 而桥面线在 y=16.2，
   **悬空 3~4px**，用户一眼看出「绳索都没有到桥面」。**索与塔、索与桥面两端都要核**。
5. **塔顶要有横梁**（锚固区），否则塔被索收成尖角、看着像帐篷顶。
6. **独塔 > 双塔**（对 24px 图标而言）：双塔中间有视觉空洞，独塔轮廓辨识度最高。
7. 必须与其余 20 个图标**同光轴**：24×24 viewBox / `stroke-width="1.75"` / 圆角端点 / `fill="none"`。

### 图标验证方法（可复用）
写一个 preview.html，含 **6 档尺寸（16/20/24/32/64/140）+ 与相邻图标同排对照**，
无头 Edge 一次截图 —— 同时看清小尺寸可识别性与光轴一致性，比在真实页面反复截图快得多。
**多个方案就出并排对比图**（本次 A 双塔 / B 独塔 / C 双塔+横梁 三方案一次拉出来挑）。

### 图形类回归断言（三条，写进验证脚本）
1. **结构语义**：索终点必须锚在桥面 —— 解析每条索路径终点坐标，断言 `|y − 16.2| < 0.001`
   （首版 13 条 path 全在、DOM 也全注入，但索全悬空，纯"路径存在"断言抓不到）。
2. **可读性**：同组线最小水平间距 > stroke-width（见铁律 1）。
3. **⚠️ 数值断言之外必须看图**：铁律 3 的 10 根索案例，前两条断言全过，视觉仍是一坨 ——
   这类"数学及格但观感失败"的问题只能靠缩略图发现。

### 免费图标参考的取图接口（实测）
- ❌ `raw.githubusercontent.com` **ECONNRESET 不可用**。
- ✅ **iconify API**：搜索 `https://api.iconify.design/search?query=bridge&limit=64`；
  取图 `https://api.iconify.design/<prefix>/<name>.svg`（如 `lucide/bridge`）。
- ✅ unpkg：`https://unpkg.com/@tabler/icons@3.46.0/icons/outline/<name>.svg`。

### 版本
`js/icons.js` 20260915.2 → 20260916.1（首版梁桥）→ **20260916.2（斜拉桥定稿）**。
**改 icons.js 必须同步升星屿 index.html 里的 `?v=`，否则缓存会让新图标看不到。**

## 11. 3D 空间模态、云图与模型诊断（2026-09-18）

新增 `spatial-frame3d.js` 与 `spatial-bridge.js`，并正式接入顶部「3D 模态」模块。

### 当前能力

- 3D 空间梁单元：每节点 6 自由度 `[ux,uy,uz,rx,ry,rz]`。
- 一致质量矩阵、节点集中质量、施工阶段单元激活。
- 广义特征值模态求解、固有频率、周期与质量归一化振型。
- X / Y / Z 三向有效模态质量参与系数与累计质量。
- 质量/刚度诊断：无质量自由度、刚度对角量级比、单元长度范围。
- Canvas 梁格查看器：振型动画、拖拽旋转、滚轮缩放、合位移与 X/Y/Z 幅值云图。
- 退出 3D 模块后停止 RAF；系统开启“减少动态效果”时默认不自动动画和旋转。

### 重要修复

1. 模态向量计算原先误用了只处理 3 个分量的 `dot()`，会让有效模态质量累计达到 200%。现新增任意维 `vectorDot()`，回归测试确保三向累计不超过 100%。
2. 桥墩最大压应力原为 kPa 数值却标成 MPa，默认显示 17513 MPa；现正确除以 1000，默认约 17.55 MPa。
3. 桥墩土层 SVG 的矩形高度方向写反，浏览器会报负高度；现统一使用 `min(y1,y2)` 与 `abs(y2-y1)`。

### 验证

- `test-spatial-frame3d.js`：8/8 通过。
- `npm run test:bridge`：梁、框架、领域、3D 全部通过。
- 真实 Edge 集成：8 阶模态、三向累计有效质量、云图切换、无横向溢出、控制台零错误。
- 父页 iframe 与 Service Worker 版本：`20260918.12` / `xingyu-static-20260918-12`。

## 12. 3D 多桥型与斜拉桥结构修复（2026-09-18）

### 3D 多桥型

「3D 模态」不再只有单一梁格，现支持：

1. 梁桥梁格；
2. 双肋上承式拱桥；
3. 双塔双索面斜拉桥；
4. 双主缆悬索桥。

`spatial-frame3d.js` 新增 `truss3d / cable3d`，拉索可用 `T0` 形成
`T/L·(I−nnᵀ)` 初张力几何刚度。纯索节点的三个伪转动自由度会自动锁定，避免零质量/零刚度导致模态矩阵非正定。

### 原斜拉桥的真实问题与修复

1. UI 的 `L=400m` 标成“主跨”，旧模型却把它当成全桥长，塔位固定在 `0.22L / 0.78L`，真实塔距只有 224m。
   现改为全桥三跨：`140 + 400 + 140 = 680m`，塔位为 140m / 540m。
2. 旧索面“远索接低锚、近索接高锚”，专业语义反了；现改为远索接高锚，索线单调不交叉。
3. 最终松弛索数量旧代码沿用上一轮迭代变量，可能出现索力范围为负却显示“0 根松弛”；现按最终模型重新统计。
4. Ernst 弹模数值除以 `1e6` 后实际单位是 GPa，旧页面误标 MPa；现修正为 GPa。
5. 塔梁处补竖向支承，梁端补纵向约束；默认塔 EI 调整为 `30×10⁸ kN·m²`，默认四项教学检查全部通过。

### 回归

- `test-domain.js` 新增主跨语义、塔位、倾角、索线不交叉、最终松弛和 GPa 单位断言。
- `test-spatial-frame3d.js`：10/10，通过四种 3D 桥型和 3D 桁架解析测试。
- 真实 Edge 切换四桥型均收敛、无横向溢出、控制台零错误。

## 13. 3D 用户定义反应谱（2026-09-18）

### 能力

- 反应谱点按 `周期(s), Sa(g)` 输入，内部转换为 m/s² 并线性插值。
- X / Y / Z 地震输入方向。
- SRSS 与等阻尼 CQC 模态组合。
- 用户可设置 1%～15% 阻尼比。
- 输出每阶 `Sa`、参与系数、有效模态质量、组合位移包络、最大位移节点。
- 反应谱结果直接进入 3D 云图；动画按钮停用，因为反应谱是峰值包络而不是时程。

### 算法边界

- 模态振型采用质量归一化。
- 第 i 阶峰值广义坐标：`q_i = Γ_i · Sa(T_i) / ω_i²`。
- SRSS：`R = sqrt(ΣRi²)`。
- CQC 使用等阻尼相关系数；频率接近的模态会产生非零交叉项。
- 当前谱是用户定义谱，不冒充 JTG 或其他规范设计谱；正式使用必须替换为项目采用规范、场地类别和阻尼对应的数据。

### 回归

- `test-spatial-frame3d.js`：13/13。
- 覆盖谱线性插值、CQC 自相关/近频相关、SRSS 解析值及完整反应谱位移包络。
- 真实 Edge：拱桥 Z 向、5% 阻尼、CQC/SRSS 切换均成功，控制台零错误。
- 版本：`20260918.14` / `xingyu-static-20260918-14`。

## 14. 地震波导入 + Newmark-β 线性时程分析（2026-09-18）

### 能力

- **地震动导入**（`groundmotion.js`）：PEER NGA `.at2`（自动读 NPTS/DT/单位，cm/s² 与 g 自动换算）、两列「t,a」文本（自动识别表头）、单列加速度+外部 dt；支持文件读取（.txt/.at2/.asc/.csv）与直接粘贴；PGA 调幅（`scaleToPGA`）、抽稀（`resample`）与加密（`upsample`）。内置 4 条**程序合成**示例波（正弦拍波 T=1.0/0.3、Ricker 脉冲、扫频 0.2→4Hz），页面明确标注"合成，不代表真实记录"。
- **Newmark-β 直接积分**（`spatial-frame3d.js::solveTimeHistory`）：平均加速度法 γ=0.5 β=0.25；基础激励相对坐标方程 `Mü + Cu̇ + Ku = -M·ι·ag(t)`；Rayleigh 阻尼 C=αM+βK，α/β 由前两阶模态频率在目标阻尼比下确定；有效刚度 `(1+a1β)K+(a0+a1α)M` **LU 一次分解逐步回代**（平铺 Float64Array）；逐步记录节点平动位移、基底剪力 `Q(t)=ιᵀM(ü_rel+ι·ag)`、能量（输入功/动能/势能/阻尼耗散，梯形格式二阶精度）；支持初值 `u0/v0`（自动反算初始加速度）。
- **UI**：「3D 模态」模块分析类型新增「时程分析」——地震动输入卡片（来源/单位/dt/调幅/方向/阻尼比），3D 视图按真实时程**逐帧播放**（约 1× 真实时间、循环、可拖时间轴定格），下方新增位移时程曲线卡（节点/分量/基底剪力可选，峰值标记）；计算书输出波信息、Rayleigh 系数、峰值位移与基底剪力、能量平衡。

### 验证（全部实测）

- `test-timehistory.js` 25 项：无阻尼/有阻尼自由振动 vs 解析解（maxErr 3.7e-7/3.0e-7）；正弦激励 vs 闭式解 3.2e-5；拍波 vs Duhamel 参考 1.4e-4；2DOF 桁架模型 vs 独立模态叠加 2.6e-4；能量平衡残差 ≤1e-3；梁格/拱桥冒烟（支座零相对位移、能量闭合、量级合理）；maxSteps 超限报错；三种格式解析与单位换算、调幅、重采样、加密。
- 真实 Edge（playwright-core + 系统 Edge，headless）：梁桥 X 向时程峰值 0.04mm @ N12，曲线卡 1202 点，时间轴拖动生效；切基底剪力分量正常；拱桥 Z 向时程峰值 30.55mm @ A0_3；计算书含"时程分析结果/Rayleigh/最大位移"区块；控制台零错误。
- `npm run test:bridge` 全链路回归通过。

### 边界与坑（下轮别再踩）

- **只算线性时程**：材料/几何线性、支座均匀基础激励（各支座同一地震动），不含多点激励、非线性（支座屈服/碰撞/索松弛大变形）、行波效应。频域上建议 ω·dt ≤ 0.05，导入波偏粗时先用内置 `upsample` 加密——拍波测试里 dt=0.01→0.002 才把 Newmark 周期伸长误差压出容差。
- **页面上限 6000 步**（analyze 内 maxSteps），超限自动抽稀并在计算书注明；超大模型会直接报"时程有效刚度矩阵奇异"类错误。
- **`groundmotion.js` 的全局导出名是 `gmApi`**：classic script 顶层 `const api` 会与 spatial-frame3d.js 的 `api` 冲突（ Identifier 'api' has already been declared，整个 3D 内核直接挂掉）。以后给 bridgelab 加新文件，顶层变量一律加前缀。
- 时程响应对象没有 `combinedDisplacement`：`app.js` 里 `setData(model, modal, isTh ? null : response)`，反应谱分支的 render/report 代码靠 `kind !== 'timehistory'` 区分，别把时程结果当反应谱传。
- Rayleigh 阻尼比下限 0.0001，写 `||0.05` 会把 0 误判成默认（已修：`Number.isFinite` 判断）。

### 版本

`20260918.15` / 父页 SW `xingyu-static-20260918-15`；父页 iframe 已同步；`sw.js` 缓存清单新增 `groundmotion.js`。


## 15. 20260918.16：时程 × 反应谱 峰值对照卡片 + CSV 导出（2026-09-19）

### 能力
- 时程分析完成后自动对照：把同一地震波换算成反应谱（`gmApi.spectrumOf`，Newmark-β 平均加速度逐周期扫描），同一模型/方向/阻尼跑一次谱分析，「最大位移」「基底剪力峰值」两行并排，附「时程/谱」比值（>1.15 或 <0.87 橙色提示），并注明口径差异（时程为全时段绝对峰值，谱为模态组合包络）。
- CSV 导出三按钮：节点位移时程（node×step 长表，mm）、基底剪力时程（kN）、地震波数据（acc）；UTF-8 BOM，Excel 直接打开。
- 谱基底剪力：内核未返回，用 `modalResults` 逐模态 `effectiveMass × Sa(T_n)` 再 `combineModalResponses` 组合，与位移同口径。

### 验证
- `test-thvs.js` 21 项全过（挂入 `npm run test:bridge`）：谱物理（短周期→PGA 1.004×、20s 等幅共振 ζ=2% 放大 23.0 vs 理论 23.0）、compare 结构与比值带（梁桥 X 0.97/1.27、拱桥 Z 1.04）、CSV 行数与表头。
- `npm run test:bridge` 全链路 93 项通过（fem17+frame17+domain+3d13+th25+thvs21）。
- 真实浏览器冒烟本轮被沙箱 spawn 拦截（EPERM），未补截图；UI 为既有模式纯 DOM 操作。

### 边界与坑
- 对照是「同一波谱」对照，不是规范设计谱对照（卡面已注明）。
- `response.compareError`：对照计算失败不阻断主结果，错误显示在卡内。
- 在 Node 下引用本模块做集成测试：先 `globalThis.self = globalThis; globalThis.window = globalThis;`，按序 require groundmotion → 注入 `XINGYU_SPATIAL3D` → require spatial-bridge（范式见 test-thvs.js 头部）。
- 测试共振放大时别用内置高斯包络拍波（有效时长短，放大被低估约 2.5 倍），用等幅长正弦 + (1-e^-ζωt) 修正。


## 16. 20260918.17：实验引导模块（智能体带做实验，2026-09-19）

### 能力
- 新增「实验引导」模块（bridgelab 第 8 个模块）：数据驱动的实验目录 + 步骤引擎。
- 每步四件套：任务说明 → 学生亲手操作真实模块 → 「检查本步」（校验器调用平台真实状态判定，通过才解锁下一步）→ 「要点提示」三级梯子；带选择题（quiz）步骤。
- 「问 AI」按钮：自动拼上下文（实验/步骤/当前输入/最新结果/对照卡比值/已用提示数），经父页 `js/ai.js` 的 `AI.chat` 走 `/ai-proxy/`（Key 在服务端）；父页 AI 未配置时降级为可复制的问题文本。
- 步骤卡是 **body 级浮动卡**（`#guideFloat`，右下、可收起/关闭、切模块不丢）——这是关键设计：引导面板和目标模块面板互斥，浮动卡才能"带着做"。
- 进度持久化 localStorage（`bl-guide-v1`），中断可续。
- 内置 2 个实验：「时程分析五步走」（modal3d，5 步）和「跨度四次方定律」（beam，3 步含 quiz）。
- 引擎核心（getExp/newRunState/checkStep）与 UI 分离，Node 可单测。

### 接线
- `app.js`：PANES/MODS/BANNERS 加 guide；setModule 对 guide 隐藏 stage 卡片；`window.BL_STATE = S`（labguide 经此读 S.mod/S.lastTh/S.last）。
- `index.html`：导航按钮 + `modGuide` 面板（列表容器 + 占位）+ `labguide.js` script（app.js 之前）。
- `labguide.js` 顶层只挂 `window.LABGUIDE`（classic script 撞名教训）。
- AI 桥：`const AI` 在父页全局词法作用域（不在 window 上），iframe 内用 `new parent.Function('return AI')()` 取。

### 验证
- `test-guide.js` 33 项全过（挂入 `npm run test:bridge`，全链 17+17+domain+13+25+21+33 绿）。
- 真实 Edge headless 冒烟：浮动卡出现/切模块保持可见/校验器正确拒绝与放行/提示梯子渲染/截图已存（outputs\桥梁实验室-实验引导-20260919.png）。
- 遗留 1 条 `[PAGEERROR] page is not defined`：来自父页 shell（bridgelab 各文件无 page 引用），与本轮无关，未处理。

### 边界与坑
- 加实验只需在 `EXPERIMENTS` 加数据（check 是 (ctx)→{ok,msg} 纯函数，ctx 注入 mod/val/th/last/note）。
- 测试 ctx.note 必须用共享 notes 袋（每 run 一个），跨 ctx 传递基准值（如 defl0）。
- headless 下 bridgelab 在 shell 的懒加载 iframe 里：需先点父页 `[data-view=bridgelab]`，再 `page.frames()` 找 frame 操作；`__bridgeLabReady` 标志在磁盘代码中不存在（旧测试脚本误用）。


## 17. 20260918.18：自动演示 + 讲解视频（AI 替你操作，2026-09-19）

### 能力
- 「▶ 看演示」按钮（3D 模态参数区，计算按钮旁，运行时动态挂载）：一键自动执行「时程分析 2 分钟演示」——自动切模块、逐个高亮并设置参数、点击计算、等结果、滚动到对照卡/曲线卡讲解、换横向 Z 对比，全程右下角浮动卡同步讲解，可随时停止。
- 讲解视频：`bridgelab/media/demo-th.webm`（10.2 MB，Playwright 录屏），嵌入 3D 模态面板顶部「讲解视频」卡（`<video controls>`）。
- 对照卡可见性复核：真实浏览器验证 display:block + 2 行数据正常；用户端看不到属旧缓存，重启星屿或重开桥梁实验室即好（SW 缓存已 bump）。

### 实现
- `labguide.js` 新增 `DEMOS`（数据驱动脚本：say/set/run/waitResult/sayResult/scroll/sayDirection）+ `runDemo` 异步执行器（高亮 class .guide-hl、floatEl 讲解、demoRun.stop 停止标志）；`runDemo` 浏览器导出。
- 演示按钮用 1s 间隔轮询挂载（m3dRun 是 app.js 动态创建，DOMContentLoaded 时还不存在；进入 modal3d 后自动出现）。
- `index.html`：modal3d 面板顶部视频卡；版本 20260918.18（sw.js/父页 iframe 同步）。

### 验证
- test-guide 37/37（含演示脚本数据完整性 4 项）。
- 录屏实测：演示完整跑完（约 2.5 分钟），视频含全部讲解字幕卡，已入库 media/demo-th.webm。

### 坑
- Playwright 录制：page.video().path() 是 Promise（新版必须 await，否则拿到 Promise 对象）；上下文关闭后视频才落盘。
- 录屏直接导航 `bridgelab/index.html?v=...` 即可，不必走父页 shell（懒加载 iframe + 导航点击在 headless 下很不稳定）。
- waitForFunction 谓词里不能引用 Node 侧的 page（会抛 page is not defined，且超时时误导排查方向）。

## 18. 20260919.1：讲解视频配音（TTS 解说，2026-09-19）

### 能力
- `media/demo-th.webm` 带中文配音音轨（opus，4 分钟），音轨与讲解卡时间轴对齐；静音版备份 `demo-th-mute.bak.webm`；index.html bump 到 `?v=20260919.1`。
- 「▶ 看演示」线上节奏放慢：labguide.js `demoSpeakTime()` = 700ms + 字数×330ms（1.6~16s 夹紧），字幕读得完。

### 实现
- 录屏重录取 `__demoLog`（12 条带时间戳）→ edge_tts 11 条配音 → imageio-ffmpeg 解码 → stdlib wave 混音 → `-c:v copy -c:a libopus` 封装。
- 管线脚本：`D:\植物6-09-18
i\work\` 下 `tts_patch.py` / `record5.js` / `build_narr.py`。

### 验证
- `npm run test:bridge` 全绿；volumedetect 3~11s 窗 mean -24.3dB；ffprobe 见 vp8+opus 双流。

### 坑
- Playwright 自带 ffmpeg 无音频编码器，封装必须换 imageio-ffmpeg 全功能版。
- gyan.dev/BtbN zip 下载在此网络卡死，勿用。

## 19. 20260919.2：高清详解视频 + 视频卡片包装 + AI 按钮修复（2026-09-19）

### 能力
- 讲解视频升级：1920×1080、约 6 分钟、中文配音（libopus 128k），15 步详细解说（原理/选波/参数/Newmark-β/结果解读/对照卡/横向对比）。封面 media/demo-th-cover.jpg。静音旧版仍备份 demo-th-mute.bak.webm。
- 视频包装：index.html 用封面卡 + 居中遮罩弹层播放（Esc/外圈/× 关闭暂停），不再裸 <video>。
- 「▶ AI 演示」按钮：紫蓝渐变 + 呼吸光晕，挂 m3dPlay 旁。

### 修复
- m3dRun 在全工程不存在 → 按钮从未挂载（用户看不到 AI 操作的根因）；锚点改 m3dPlay。run 步骤的点击是仪式，计算由 demoSetVal 的 change 事件自动触发。

### 实现
- labguide.js：demoSpeakTime 700+260/字（≤26s）；run 步骤补播 say；DEMOS 15 步详解；按钮样式+注入 @keyframes demoPulse。
- 版本全部 bump 20260919.2（style.css/labguide.js/封面/视频 query）。

### 验证
- test:bridge 全绿；headless 实测封面/按钮/弹层/371s/1920px/音轨齐全。

## 20. 20260919.3：讲解视频烧录硬字幕（2026-09-19）

### 能力
- demo-th.webm 带硬字幕：雅黑 44px 白字黑边 + 黑底盒、底部居中、34 字折行；14 段与配音对齐。80.8MB。无字幕版备份 demo-th-nosub.bak.webm；?v bump 20260919.3。

### 实现
- 14×drawtext(enable=between) 单链 -vf；-c:v libvpx good/cpu4 2200k，-c:a copy；s01..s14.txt 在 C:\subwork（ASCII 路径）。
- 验证：t=8s 底部 260px 条带子版亮度 16 vs 无字幕版 1；流 vp8+opus、时长 6:10.69。

### 坑
- -filter_script:v 在本环境静默失效→用 -vf 内联；-vf 不可含非 ASCII→中文全进 textfile；textfile 用 C:\subwork ASCII 绝对路径；亮度测量用 rawvideo→文件，scale 要 flags=area。

## 21. 20260919.4：ASS 专业字幕 + 演示按钮健壮性（2026-09-19）

### 字幕
- drawtext 盒式字幕废弃，改 ASS/libass：demo-th.ass（C:\subwork，UTF-8 BOM），雅黑 46、描边 2.4+投影、底部居中、淡入淡出、30 字折行；cpu-used 3 / 3500k 重烧，fontselect 命中 MicrosoftYaHei。media/demo-th.webm 109.4MB，盒版备份 demo-th-boxsub.bak.webm。

### 按钮
- 「点了没反应」防御：try/finally 保证 busy 复位；运行中按钮即时反馈「⏸ 演示运行中…再点停止」；再点=停止；讲解卡 z-index 99999 + 滑入动画。headless 全链路实测通过。

### 验证
- t=8s 底部条带亮度 23（字幕在）；时长 6:10.69 vp8+opus；test:bridge 全绿。
