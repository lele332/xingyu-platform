/* knowledge.js — 文献资料页：顶级期刊 + 专业书籍沉浸阅读 + 每日知识推送 */
(function () {
  "use strict";

  /* ================= 顶级期刊（世界级成果入口） ================= */
  var JOURNALS = [
    { name: "Nature · 自然", org: "英国 自然出版集团", level: "顶刊", desc: "跨学科顶级科学期刊，近 160 年历史，发表影响全球的重大科学发现。", url: "https://www.nature.com" },
    { name: "Science · 科学", org: "美国 科学促进会 AAAS", level: "顶刊", desc: "美国顶级综合科学期刊，与 Nature 并称全球科学双雄。", url: "https://www.science.org" },
    { name: "Cell · 细胞", org: "美国 爱思唯尔", level: "顶刊", desc: "生命科学领域顶级期刊，细胞与分子生物学研究的风向标。", url: "https://www.cell.com" },
    { name: "The Lancet · 柳叶刀", org: "英国 柳叶刀出版", level: "顶刊", desc: "全球最权威的医学期刊之一，发表改变临床实践的研究。", url: "https://www.thelancet.com" },
    { name: "NEJM 新英格兰医学杂志", org: "美国 麻省医学会", level: "顶刊", desc: "世界上历史最悠久的持续出版医学期刊，临床医学的黄金标准。", url: "https://www.nejm.org" },
    { name: "JAMA 美国医学会杂志", org: "美国医学会 AMA", level: "顶刊", desc: "美国权威医学期刊，覆盖临床研究与公共卫生重大问题。", url: "https://jamanetwork.com" },
    { name: "PNAS 美国科学院院刊", org: "美国国家科学院", level: "顶刊", desc: "高产出综合期刊，覆盖自然科学与社会科学的前沿进展。", url: "https://www.pnas.org" },
    { name: "Nature Reviews · 自然综述", org: "英国 自然出版集团", level: "权威", desc: "自然系列综述期刊，快速掌握领域发展与前沿观点。", url: "https://www.nature.com/nature-reviews/" },
    { name: "IEEE Spectrum 纵览", org: "美国 IEEE 学会", level: "权威", desc: "全球工程与科技界权威刊物，读懂最新技术趋势与创新。", url: "https://spectrum.ieee.org" },
    { name: "The Economist · 经济学人", org: "英国 经济学人集团", level: "权威", desc: "全球最具影响力的财经时政周刊，冷静犀利的全球化视角。", url: "https://www.economist.com" },
    { name: "Scientific American 科学美国人", org: "美国 Springer Nature", level: "权威", desc: "面向大众的顶级科普杂志，把复杂科学讲得生动易懂。", url: "https://www.scientificamerican.com" },
    { name: "National Geographic 国家地理", org: "美国 国家地理学会", level: "权威", desc: "以绝美影像与深度报道，探索地球、文明与人类的边界。", url: "https://www.nationalgeographic.com" }
  ];

  /* ================= 专业书籍（按领域） ================= */
  var BOOKS = [
    { field: "学习方法", title: "如何阅读一本书", author: "莫提默·艾德勒 / 查尔斯·范多伦",
      why: "读书方法论经典，教你如何把书读透、读深。",
      excerpt: "阅读是一门主动的艺术：带着问题，像侦探一样追踪作者。艾德勒把阅读分成四个层次——基础阅读、检视阅读、分析阅读、主题阅读。绝大多数人终身停留在第一层，而真正把一本书读透，需要走到第四层。先检视全书摸清结构，再带着问题精读，最后跳出这本书，去比较不同作者的观点——这才是'会读书'。" },
    { field: "学习方法", title: "刻意练习", author: "安德斯·艾利克森",
      why: "解释天才背后的训练方法，人人都可掌握。",
      excerpt: "天才不是天生的，而是'练'出来的。艾利克森追踪小提琴家、棋手、运动员后得出结论：拉开差距的不是天赋，而是刻意练习——有明确目标、有即时反馈、始终待在舒适区边缘。一万小时只是表象，'怎么练'才是关键：把大目标拆成小目标，一次次突破极限，让错误成为反馈。" },
    { field: "学习方法", title: "认知天性", author: "彼得·布朗 等",
      why: "用记忆与学习科学提升学习效率。",
      excerpt: "学习不是反复翻阅同一页，而是主动检索。本书用认知科学告诉你：为什么划重点、抄笔记常常无效，而'自我测验'与'间隔重复'才是真正把知识装进长时记忆的钥匙。越轻松的学习越不牢靠，越费力的遗忘与回忆，记得越深。" },
    { field: "计算机 / 编程", title: "代码大全", author: "史蒂夫·迈克康奈尔",
      why: "软件构建领域圣经，适合系统打基础。",
      excerpt: "代码大全不是教你某个语言，而是教你好代码的通用法则：如何命名、如何注释、如何组织控制结构、如何做防御式编程、何时重构。它把'软件构建'这门手艺拆成看得见的规范，任何写代码的人都值得把它当作桌面常备。" },
    { field: "计算机 / 编程", title: "算法图解", author: "阿迪亚·巴加瓦",
      why: "用图解讲算法，入门友好不枯燥。",
      excerpt: "算法并不高冷。本书用大量插图，把二分查找、选择排序、递归、图与动态规划讲得明明白白，专为'看得懂算法'而写。读完之后，你会建立'遇到问题该选哪种算法'的直觉，为深入数据结构打下地基。" },
    { field: "历史社科", title: "万历十五年", author: "黄仁宇",
      why: "以小见大剖析晚明社会，中国历史经典。",
      excerpt: "1587 年，万历十五年，看似平淡无奇，却是大明王朝走向衰落的隐喻。黄仁宇以'大历史观'，从万历皇帝、张居正、海瑞、戚继光、李贽几个切片，剖析一个庞大帝国如何困在制度里慢慢窒息。一个人的怠惰、一批人的无力，写尽一个朝代的命运。" },
    { field: "历史社科", title: "人类简史", author: "尤瓦尔·赫拉利",
      why: "从认知革命到科技革命，重新认识人类。",
      excerpt: "十万年前，地球上至少有六种不同的人，今天只剩下我们。赫拉利带你从认知革命、农业革命到科学革命，看智人如何凭借'讲故事'的能力登上食物链顶端——国家、宗教、公司，本质上都是共同想象。我们创造了历史，也被历史重塑。" },
    { field: "文学", title: "活着", author: "余华",
      why: "用最朴素的文字写尽人生坚韧，直击心灵。",
      excerpt: "'我决定要写作一个中国的故事，讲述人是怎样活着的。'余华用最朴素的语言，写福贵一生不断失去至亲，却始终坚韧地活。苦难之下，悲欢之中，'活着'本身就成了最大的意义。没有华丽的技巧，只有打动人心的力量。" },
    { field: "文学", title: "百年孤独", author: "加西亚·马尔克斯",
      why: "魔幻现实主义巅峰，想象力的盛宴。",
      excerpt: "'多年以后，面对行刑队，奥雷里亚诺·布恩迪亚上校将会回想起父亲带他去见识冰块的那个遥远的下午。'魔幻与现实交织，布恩迪亚家族七代人的孤独，是一个关于命运与轮回的寓言。马孔多小镇，装下了整个拉丁美洲的百年沧桑。" },
    { field: "经济商业", title: "国富论", author: "亚当·斯密",
      why: "现代经济学奠基之作，理解市场与财富。",
      excerpt: "'看不见的手'——斯密在 1776 年提出：每个人追求自身利益，却仿佛被一只无形的手引导，促进了社会整体的财富。这是现代经济学的奠基之作，也是理解市场如何运行、分工如何创造财富的起点。读懂它，你就读懂了现代社会的地基。" },
    { field: "经济商业", title: "穷查理宝典", author: "查理·芒格",
      why: "多元思维模型，投资与人生的智慧。",
      excerpt: "查理·芒格说：'我这一生只做两类事——阅读和思考。'这本书汇集他的多元思维模型：逆向思考、能力圈、误判心理学。比金钱更重要的，是决策的智慧。别只盯着'怎么赚钱'，先学会'怎么想对'。" },
    { field: "科普", title: "时间简史", author: "史蒂芬·霍金",
      why: "用易懂语言讲宇宙起源与黑洞，科普经典。",
      excerpt: "霍金说：'我的目标是让宇宙学像侦探故事一样引人入胜。'从大爆炸到黑洞，从时间箭头到虫洞，他用普通人能懂的语言，讲清楚宇宙从何而来、又将去向何方。物理学的尽头，是人类对'我们从哪里来'的追问。" },
    { field: "科普", title: "自私的基因", author: "理查德·道金斯",
      why: "从基因视角理解生命演化，颠覆认知。",
      excerpt: "道金斯提出：我们是基因的生存机器，基因才是自然选择的基本单位。'自私的基因'不是鼓吹自私，而是解释利他行为如何从基因层面演化出来——母爱的牺牲、蜂群的协作，都写着基因的算计。读它，你会重新理解生命与演化。" },
    { field: "心理成长", title: "思考，快与慢", author: "丹尼尔·卡尼曼",
      why: "诺贝尔奖得主讲决策偏差，看清思考本质。",
      excerpt: "卡尼曼把大脑分成系统一（快、直觉）与系统二（慢、理性）。这本书讲透了几十种认知偏差：锚定效应、损失厌恶、可得性启发。诺贝尔奖得主带你看见那些你平时看不见的思考误区，学会在关键决策时慢下来。" },
    { field: "心理成长", title: "被讨厌的勇气", author: "岸见一郎 / 古贺史健",
      why: "用对话体讲阿德勒心理学，活得轻松自在。",
      excerpt: "'自由，就是不再寻求他人的认可。'全书以哲人与迷茫青年的对话，讲述阿德勒心理学：课题分离、活在当下、接纳自己。别人的期待是他们的课题，你的人生是你的课题。读完你会学会，如何不被别人的看法绑架。" },
    { field: "考公申论", title: "申论的规矩", author: "李永新（中公）",
      why: "申论分题型讲解答题套路，备考实用。",
      excerpt: "申论是'用公文的语言，答公职的题'。本书按归纳概括、综合分析、对策建议、公文写作、大作文分题型拆解，教你如何从材料里提炼要点、规范表达、写好一篇像样的申论。是考公备考的实用手册，也是练'规范表达'的捷径。" },
    { field: "考公申论", title: "半月谈", author: "半月谈编辑部",
      why: "权威时政读物，积累热点与规范表达。",
      excerpt: "半月谈是权威时政读物。它把复杂的政策、社会热点讲得通俗清楚，是积累申论素材、训练'热点思维'与'规范表达'的绝佳来源。考公期间，它既是时政风向标，也是大作文的素材库——热点、金句、角度，一页一页攒起来。" },
    { field: "健康生活", title: "我们为什么要睡觉", author: "马修·沃克",
      why: "讲透睡眠科学，帮你睡出高效与健康。",
      excerpt: "沃克教授用大量实验证明：睡眠不足会损害记忆、免疫与情绪，而'睡个好觉'是提升效率最简单的方式。睡眠不是浪费时间，而是大脑在离线整理记忆、清除代谢废物。读完你不仅会理解睡眠，还会立刻想早点睡。" }
  ];

  /* ================= 每日知识分类（无图标，保持简约） ================= */
    var CATS = [
    { key: "debate", name: "思辨议题" },
    { key: "magazine", name: "前沿视野" },
    { key: "life", name: "科学思维" },
    { key: "tech", name: "科技与AI" },
    { key: "mineral", name: "数学与物理" },
    { key: "exam", name: "科研素养" },
    { key: "car", name: "道路桥梁" },
    { key: "history", name: "历史洞察" },
    { key: "geo", name: "经济与社会" },
    { key: "food", name: "生命科学" },
    { key: "fun", name: "认知边界" },
    { key: "health", name: "身心健康" }
  ];

  /* ================= 知识条目（图文并茂） ================= */
  var KNOWLEDGE = [
    /* 思辨议题 */
    { c: "debate", t: "AI 会取代人类，还是重塑分工？", d: "与其争论「会不会取代」，不如拆解「哪些环节被替代」：AI 擅长模式匹配与检索，但缺乏「问题为什么值得解、目标由谁定义、责任由谁承担」的判断。历史上打字员没被消灭而变成了文员，消失的是技能组合而非岗位。对本科生真正的护城河是「定义问题+跨域整合+承担责任」，而这三种能力都依赖深度阅读与真实项目实践。" },
    { c: "debate", t: "贫穷的本质为什么难以打破？", d: "诺奖得主班纳吉发现，贫困不是「不努力」，而是「稀缺心态」占据认知带宽：水电、房租、贷款的即时压力挤掉了长期规划的空间，于是更易借贷、更难储蓄、更难投资教育与健康。这解释了为何单纯「给钱」常无效，而「自动储蓄+默认选择」等制度设计更有用。把这个框架用在自己身上，就能理解为什么「忙到没时间规划」反而最需要规划。" },
    { c: "debate", t: "自由市场真的更公平吗？", d: "市场能在「给定初始禀赋」下高效配置资源，但初始禀赋本身（教育、遗产、地域、健康）极不平等。经济学里的「效率」与「公平」是两个正交维度：帕累托最优并不保证分配公平。所以「市场 vs 政府」常是伪命题，真正的问题是「用市场分配什么、用制度矫正什么」。读经济学先区分「实证」与「规范」，能省去大量情绪化争论。" },
    { c: "debate", t: "学历贬值了吗？", d: "学历回报率确在下降，但下降的是「信号价值」而非「能力价值」。当大学普遍扩招，文凭的稀缺信号被稀释，用人单位转向实习、项目、作品集来筛选——信号从「证明你上过学」转向「证明你会做事」。对本科生，与其焦虑文凭贬值，不如尽早积累可展示的成果（论文、项目、竞赛、开源），让能力信号跑赢文凭信号。" },
    { c: "debate", t: "该不该继续大规模修路修桥？", d: "正方：基础设施带动经济、缩短时空，是长期公共资产；反方：边际收益递减，盲目扩张造成债务与耕地占用。科学的答案藏在「交通量预测与成本收益分析」里——不是「修不修」，而是「修哪里、修多宽、何时修」。工程决策的本质，是用数据在「需求」与「代价」之间找平衡。" },

    /* 前沿视野 */
    { c: "magazine", t: "[Nature] 室温超导为何屡屡被证伪？", d: "超导意味着零电阻传输，能彻底改变电网、磁悬浮与量子计算。但每一次室温超导的宣布都引来疯狂复制与漫长证伪，因为「临界温度」极易被测量误差、杂质相与样本不均污染。2023 年的 LK-99 风波正是「科学如何自我纠错」的活教材：预印本→同行评审→独立复现，每一步都在过滤噪音。对本科生，这场戏比结论更值得学。" },
    { c: "magazine", t: "[Science] 大语言模型真的「理解」语言吗？", d: "LLM 的机制是「预测下一个词」，却涌现出推理、翻译、编程等能力。争议在于：这算「理解」还是「统计巧合」？哲学上，「理解」需要因果模型与意向性，而模型只学到相关关系；实践上，它却能通过大量推理任务。与其陷入口头之争，不如把它当作「概率推理引擎」：审慎使用、主动验证输出，才是真正有用的态度。" },
    { c: "magazine", t: "[Cell] 基因编辑的伦理红线在哪？", d: "CRISPR 让「编辑基因」像改文档一样精准，能治愈镰刀型贫血、改良作物。但体细胞编辑（只改本人）与生殖系编辑（会遗传给后代）是两条完全不同的伦理线：后者一旦出错无法回退，还涉及「设计婴儿」的公平问题。科学突破的速度总快于伦理共识的形成——这正是「技术乐观」与「审慎治理」需要持续较量的原因。" },
    { c: "magazine", t: "[中国公路] 桥梁健康监测：给大桥装「体检仪」", d: "现代大跨桥布满传感器：应变、挠度、振动、温度、风荷载源源不断传回监测中心，用数据判断结构是否「生病」。难点不在采集而在解释——环境温度引起的变形常常淹没异常信号，需要剔除噪声、建立健康基线。数字孪生让「实体桥」与「数字模型」同步，是未来养护的方向。这比「坏了再修」先进一个时代。" },
    { c: "magazine", t: "[中国公路] 车路协同：让聪明的路配合聪明的车", d: "纯靠车自己的传感器有盲区（被前车挡住、雨天看不清），车路协同（V2X）让路侧设备把信号灯、事故、拥堵直接发给车，车再把状态传回去。难点在「通信时延、标准统一、路侧覆盖」以及「谁为基础设施买单」。智慧公路的瓶颈常常不是技术，而是商业模式与多部门协同。" },
    { c: "magazine", t: "[经济学人] 全球供应链为什么在重构？", d: "过去三十年「全球效率优先」，一条手机链路可跨越十几个国家。疫情与地缘冲突让「韧性」开始超越「效率」：近岸外包、库存冗余、多源采购成为新共识。这背后是「效率—韧性」的权衡曲线：没有最优解，只有基于风险偏好的选择。理解供应链，就是理解现代经济如何在不确定性中维持秩序。" },

    /* 科学思维 */
    { c: "life", t: "为什么「相关」不等于「因果」？", d: "冰淇淋销量与溺水人数正相关，但共同原因是夏天。观察到相关不等于因果，需要随机对照、自然实验或因果推断工具（工具变量、双重差分等）才能逼近因果。许多「健康饮食」结论站不住脚，正因无法控制混杂因素。训练自己追问「这个相关能否被第三个变量解释」，是本科阶段最重要的思维升级之一。" },
    { c: "life", t: "幸存者偏差如何扭曲你的判断？", d: "你只看见成功者，却看不见同样努力却失败的千万人——这就是幸存者偏差。「创业成功秘籍」「学习方法」大多由幸存者撰写，样本本身被选择过。对抗它的方法：去看失败样本、看对照组、看被淘汰者。读任何「成功学」前先问一句：那些没成功的人，后来怎么样了？" },
    { c: "life", t: "贝叶斯视角：观点如何被证据更新？", d: "贝叶斯定理说：后验信念 = 先验 × 似然。即「新证据对观点的影响，取决于你原本有多确信」。这解释了为什么先入为主者很难被说服——除非证据足够强。对本科生，把「相信」当成可更新的概率，而非非黑即白的事实，能大幅减少认知固执，也让你更善于在信息不全时做决策。" },
    { c: "life", t: "第一性原理思维是什么？", d: "马斯克把电池成本拆到「原材料每公斤多少钱」，再从底层重新组合方案，而非参照行业定价——这就是第一性原理：回到最基础、不可再分解的事实，再重新推导。它与「类比思维」相对。对学业而言，别只背「结论」，去拆「前提与推导」，遇到新问题才能从底层重建方案。" },
    { c: "life", t: "为什么有限元是桥梁设计的「幕后英雄」？", d: "复杂桥梁无法用解析公式精确手算，有限元法把结构离散成成千上万个单元，用计算机解出每一点的应力与位移。关键在于「建模是否合理」：边界条件、单元类型、网格密度都直接影响结果。有限元不会替你思考，它只是放大你对「结构如何受力」的理解。先懂力学、再会建模，顺序不能反。" },

    /* 科技与AI */
    { c: "tech", t: "神经网络为什么能学习？", d: "神经元接收输入加权求和并做非线性激活，大量神经元分层堆叠后，通过反向传播（求梯度）逐层调整权重，让输出逼近目标。深度学习「能 work」靠三件事：足够的数据、足够的算力、可微的损失函数。它没有「魔法」，只是把「拟合高维函数」做到了极致。理解梯度下降，你就理解了 AI 的引擎。" },
    { c: "tech", t: "Transformer 的核心：注意力机制", d: "Transformer 的创新是「自注意力」：每个词与序列中所有词计算相关性权重，再加权整合，从而让模型一次性看到全局。相比 RNN 的串行记忆，注意力让长距离依赖变得直接。所谓「大模型」，本质上就是把可并行、可扩张的注意力层堆叠起来，配合海量语料预训练——这是 2017 年以来最深刻的架构突破。" },
    { c: "tech", t: "为什么大模型会有「幻觉」？", d: "LLM 生成文本时，本质是在概率空间里采样「听起来合理」的接续，而非检索事实。当训练数据里没有对应事实，或常见说法被当成「答案」，它就会自信地编造。幻觉不是 bug，而是「语言模型」这一目标函数的天然副作用。所以用 AI 处理事实性内容必须人工核验，这也是 RAG（检索增强生成）兴起的根本原因。" },
    { c: "tech", t: "强化学习：智能体如何从试错中学会行动？", d: "强化学习的核心是「奖励信号」：智能体在环境中行动、根据奖励调整策略，目标是最大化长期回报。它不需要标注好的「正确答案」，只需要环境反馈。AlphaGo 靠自我对弈强化提升，ChatGPT 也包含基于人类反馈的强化（RLHF）。其核心难题是「信用分配」——如何判断哪一步行动带来了最终奖励。" },
    { c: "tech", t: "BIM 和数字孪生怎么改变道路桥梁行业？", d: "BIM 把设计、施工、运维放进同一个三维信息模型：碰撞检查、工程量统计、进度模拟都基于同一个「数据底座」。数字孪生更进一步，让实时监测数据回流，使「实体」与「模型」同步。行业转型的难点不在软件，而在「数据标准」与「流程再造」——这恰恰是土木专业最值得提前掌握的数字化能力。" },

    /* 数学与物理 */
    { c: "mineral", t: "黎曼猜想为什么值一百万美元？", d: "黎曼猜想关乎素数分布：它断言 ζ 函数的非平凡零点都落在临界线上。素数看似随机，却隐藏着精密规律，而零点分布控制着素数计数与真实分布之间的误差。它悬而未决一百多年，是数论与量子混沌交汇的深水区。理解它「为什么重要」，比记住结论更能让你感受数学的深邃。" },
    { c: "mineral", t: "为什么自然常数 e 无处不在？", d: "e=2.718…出现在复利、人口增长、放射性衰变、概率论与信息论中。它镌刻着「连续复利」的本质：当增长与时间同步连续发生时，增长率自身成为指数。e 还连接了欧拉公式 e^{iπ}+1=0，把指数、三角函数、虚数统一在一个等式中。同一种结构反复出现，正是数学强大的原因。" },
    { c: "mineral", t: "为什么说「弯矩是设计的纲」？", d: "简支梁最大弯矩与跨度的平方成正比：跨径翻倍，抗弯需求变成四倍——这就是为什么大跨桥如此依赖拱、索来「化弯为压/拉」。看懂弯矩图，就能看懂为什么梁桥做不大、为什么悬索桥主缆受「拉」而拱桥受「压」。结构的美感，其实是「如何驯服弯矩」的工程美学。" },
    { c: "mineral", t: "量子纠缠真的「超光速」吗？", d: "两个纠缠粒子的测量结果强相关，看起来似乎在传信息。但贝尔不等式与实验证明：纠缠是「关联」而非「通信」——你无法用它编码信息，因为测量结果是随机的。所以它不违反相对论，却能实现量子密钥分发与量子计算。理解「关联 ≠ 信息」，是读懂量子力学的第一道坎。" },
    { c: "mineral", t: "熵增定律为什么是宇宙的「时间箭头」？", d: "热力学第二定律说孤立系统熵不减。宏观上「过去有序、未来无序」的直觉，来自宇宙初始状态极低熵这一边界条件。熵增不是「混乱」的玄学，而是「可区分的微观状态数」在增长。它解释了时间为何不可逆、能量为何不能无限回收，也解释了计算与信息为何必然耗散——物理学里它最接近「为什么」。" },

    /* 科研素养 */
    { c: "exam", t: "怎么读懂一本桥梁设计规范？", d: "规范不是「背诵手册」而是「限制性逻辑」：先看总则了解适用范围与设计原则，再看荷载组合理解「哪些力同时出现、如何乘系数」，最后看条文说明明白「为什么这么规定」。规范的变化往往反映事故教训与技术进步。会读规范的人，能说出每条背后的「为什么」，而不是只会照抄。" },
    { c: "exam", t: "论文写作的 IMRaD 逻辑", d: "科学论文按 Introduction（为何做）、Methods（怎么做）、Results（得到什么）、Discussion（意味着什么）组织。它不只是格式，而是「可复现论证」的骨架：方法要透明到别人能复现，结果只陈述事实不做解释，解释留给讨论。对本科生，模仿这个结构，等于把「讲清楚一件事」练成可迁移的思维模板。" },
    { c: "exam", t: "统计显著 ≠ 实际重要", d: "p<0.05 只说明「差异不像随机」，不说明「差异有多大、值不值得关心」。样本越大，微小到无意义的差异也能「显著」。看论文先看效应量（effect size）与置信区间，而不是只看星星。科研素养的第一课：被数字唬住，通常是因为没分清「统计显著」与「科学意义」。" },
    { c: "exam", t: "复现性危机到底在危机什么？", d: "心理学与癌症生物学等领域大量经典结果无法被复现，根源是 p-hacking（改分析直到显著）、样本量过小、发表偏倚（只发阳性结果）。科学不是「权威说了算」，而是「可复现才算数」。对本科生，越早养成预注册、公开数据、报告全部结果的习惯，越能避开科研的雷区。" },
    { c: "exam", t: "如何做一次合格的课堂汇报？", d: "汇报的本质是「降低听众的认知负担」：先讲结论与结构，再谈细节；一页一主张，图表配一句话解释；讲清「为什么重要、怎么做、有什么局限」。PPT 不是提词器，而是导引。把每次汇报当成「把复杂事讲简单」的训练，这是论文、答辩、面试都通用的能力。" },

    /* 工程与产业 */
    { c: "car", t: "为什么桥梁要预留「冗余」而不是「刚好够用」？", d: "结构设计遵循「极限状态法」：承载能力极限状态（别塌）与正常使用极限状态（别开裂、振动别太大）。设计荷载包含车道荷载、温度、风、地震与疲劳，并乘以分项系数与材料折减。所谓「冗余」不是浪费，而是给不确定性留余量——材料劣化、施工偏差、超载车辆都在考虑之内。看懂「安全系数从哪来」，是结构工程师的第一课。" },
    { c: "car", t: "为什么梁桥、拱桥、斜拉桥、悬索桥各有所长？", d: "桥梁靠「受力合理」跨越：梁桥以受弯为主，适合中短跨；拱桥把荷载转为压力，适合地基好的中长跨；斜拉桥用斜索分担主梁，适合 200—600m 跨；悬索桥靠主缆受拉，适合千米级跨。选型是「跨径—地质—造价—工期」的权衡。理解「荷载如何传力、材料如何承力」，就理解了所有桥。" },
    { c: "car", t: "预应力混凝土为什么是桥梁的主力？", d: "混凝土怕拉，预应力钢筋先给混凝土「压紧」，抵消使用荷载产生的拉应力，从而少开裂甚至不开裂。先张法在厂内张拉、后张法现场穿束张拉并压浆。预应力让跨径更大、梁更薄、耐久性更好，是桥梁工程最核心的先进技术之一。看懂「预应力」，就接近了桥梁设计的核心。" },
    { c: "car", t: "沥青路面的病害里藏着什么学问？", d: "车辙（高温下沥青老化+重载碾压）、裂缝（温缩、疲劳、反射裂缝）、坑槽（水渗入基层+集料松散）是三大常见病害。它们对应着材料性能（高温稳定、低温抗裂、水稳）、结构设计（层厚与模量）和施工质量（压实度、接缝）。养护不是简单「补路」，而是先诊断病害机理再对症处理。" },
    { c: "car", t: "为什么「设计速度」要匹配「视距」？", d: "道路设计的本质是让人在安全视距内完成「感知—判断—操作」。设计速度决定停车视距：速度越高，所需视距越长；弯道要验算视距是否被内侧树木/边坡遮挡，还要设置超高与加宽来平衡离心力。「设计速度」不是限速，而是决定线形、视距、超高、加宽整体协调的参数。" },
    { c: "car", t: "软土地基为什么是道路施工的难题？", d: "软土含水率高、承载力低、压缩性大，直接在软土上修路会缓慢下沉、路面开裂。处理手段：堆载预压、塑料排水板、水泥/石灰搅拌桩、换填垫层。地基处理是「看不见的工程」——它决定一条路能用多少年。看懂软基，就理解了为什么「地基比路面更难」。" },
    { c: "car", t: "为什么会出现「桥头跳车」？", d: "桥台是刚性结构沉降小，路基是柔性结构沉降大，两者在桥头形成台阶，行车到此便「跳车」。对策：台背回填分层压实、设置搭板、过渡段刚度渐变、预压处理台背地基。它是「刚柔过渡」的经典难题，也是每条路都绕不开的耐久性痛点——路的毛病常常出在桥与路的交界处。" },
    { c: "car", t: "路面为什么要分「面层—基层—垫层」？", d: "每一层承担不同功能：面层抗磨耗、提平整、防水；基层承重、把轮载扩散到更大面积；垫层排水、防冻胀、隔离毛细水。层的模量由高到低渐变，才能把荷载逐层摊薄。路面设计本质是「分层受力」的优化——看懂层间配合，就懂了路面为什么会坏、怎么修。" },

    /* 历史洞察 */
    { c: "history", t: "为什么工业革命首先发生在英国？", d: "不是单一发明，而是制度与要素的耦合：专利法保护创新、煤炭与铁矿便宜、圈地运动释放劳动力、全球贸易提供市场与资本。珍妮纺纱机只需改进工艺，但让它扩产的是「市场激励+能源禀赋+产权制度」。历史给后发者的启示：技术是果，制度与激励才是因。" },
    { c: "history", t: "科学革命：从「相信权威」到「让实验说话」", d: "16—17 世纪，哥白尼、伽利略、培根把「观察+实验+数学」确立为知识的标准，取代亚里士多德与教廷的权威。伽利略的斜面实验、牛顿的《原理》，本质是建立「可证伪、可量化」的方法论。科学革命真正的遗产不是某个结论，而是「用证据修正信念」的程序——今天依然在运行。" },
    { c: "history", t: "赵州桥为什么能挺立一千四百年？", d: "赵州桥（安济桥）建于隋朝，采用敞肩圆弧拱：大拱两侧开小拱，既泄洪又减重，还降低了拱脚的水平推力。拱的受力以压为主，恰好利用石料耐压不耐拉的特性，加上基础坐落在承载力好的河床。它印证一个朴素的道理：好的结构，是让材料「扬长避短」的系统。" },
    { c: "history", t: "为什么「唐宋变革」是理解中国的钥匙？", d: "历史学家提出「唐宋变革论」：唐代门阀贵族主导，宋代转为平民社会——科举普及、城市经济繁荣、印刷术让知识扩散。从「身份社会」到「能力社会」的转变，塑造了此后千年的治理逻辑。读历史不是背年份，而是看「结构怎样演化、今天继承了哪些」。" },
    { c: "history", t: "冷战如何塑造了现代科技？", d: "太空竞赛与军备竞赛极大加速了火箭、计算机、芯片与互联网的研发：NASA 的预算、DARPA 的 ARPANET（互联网前身）、硅谷的半导体，都与国防需求深度绑定。技术史提醒我们，许多「民用便利」源自「军事与地缘竞争的溢出」。理解科技史，就是理解「需求如何塑造创新方向」。" },

    /* 经济与社会 */
    { c: "geo", t: "为什么「通胀」是隐形的财富再分配？", d: "通胀让名义收入上涨，但购买力下降。它最冲击储蓄者与固定收入者，却利好负债者（债务实际变轻）与持有实物资产者。这正是「货币是政策工具」的体现：央行通过通胀/紧缩在借债人与储户之间重新分配财富。理解通胀，就理解了现代金融政策的底层张力。" },
    { c: "geo", t: "负外部性：为什么市场会「失灵」？", d: "工厂排污损害邻居，但成本由社会承担，市场不会自动定价——这就是负外部性。破解之道是「谁污染谁付费」：碳税、排放权交易、排污许可。科斯定理说，只要产权清晰且交易成本低，双方可通过谈判达到最优。经济学不是「市场万能」，而是「识别市场在哪里失灵，再用制度修复」。" },
    { c: "geo", t: "为什么说「要致富先修路」是对的？", d: "交通基础设施降低交易成本：缩短通勤、扩大市场半径、促进产业集聚。世界银行大量研究表明，公路对经济增长有显著正效应，但「先修哪、修多宽」取决于交通量与区域战略。基础设施是「降低摩擦的公共品」，收益往往由全社会分享，所以常由公共投资承担。理解这一点，就理解了基建背后的经济学逻辑。" },
    { c: "geo", t: "机会成本：最被低估的决策工具", d: "你做一件事的代价，不是花了多少钱，而是「放弃了什么」——这就是机会成本。读大学的机会成本是这四年时间与你可能放弃的工作收入。考研、就业、选城市等重大选择，都应列出「放弃的次优选项」来比较。它把决策从「我喜不喜欢」提升到「我放弃的值不值」。" },
    { c: "geo", t: "为什么「制度」决定长期繁荣？", d: "诺奖得主阿西莫格鲁用大量历史证据论证：包容性制度（保护产权、鼓励创新、广泛参与）带来繁荣，汲取性制度导致停滞。同一地理位置的南北韩、东西德命运迥异，关键在制度。对个人也类似：你给自己设计的「制度」（习惯、流程、环境）决定长期成长，而非一时激情。" },

    /* 生命科学 */
    { c: "food", t: "为什么「减糖」比「减脂」更关系健康？", d: "游离糖进入血液会引起陡峭的血糖曲线，刺激过量胰岛素，长期导致胰岛素抵抗、脂肪囤积与代谢紊乱。相比脂肪，现代饮食中糖更「隐藏」（含糖饮料、酱料、加工主食）。读懂营养成分表里的「碳水化合物—糖」，是本科阶段最实用的健康技能之一。" },
    { c: "food", t: "肠道菌群真的是「第二大脑」吗？", d: "肠道约有 100 万亿微生物，通过「肠脑轴」（迷走神经+免疫+代谢）影响情绪、食欲甚至认知。无菌小鼠的行为差异、益生菌对焦虑的初步证据，都指向肠道与大脑的对话。但「第二大脑」仍是夸张修辞——因果关系尚未完全坐实。保持纤维饮食、食物多样化，是给微生物群最实在的照顾。" },
    { c: "food", t: "为什么有些人「怎么吃都不胖」？", d: "能量平衡是「摄入—消耗」的动态方程，但个体差异巨大：基础代谢率、肠道吸收效率、肌肉量、棕色脂肪以及「食物热效应」都影响天平。「易瘦体质」更多是遗传+代谢+习惯的组合，而非纯粹意志。理解能量平衡里哪些变量可调，比盲目节食更科学。" },
    { c: "food", t: "蛋白质怎么吃才算「够」？", d: "每公斤体重约 1.2—1.6g 蛋白质是维持与增肌的基础，但「一次吃够」与「均匀分配」效果不同：肌肉蛋白合成有「封顶效应」，每餐 20—40g 优质蛋白更利于持续合成。植物蛋白（豆类）与动物蛋白在必需氨基酸上互补。读懂「氨基酸谱」与「吸收率」，比只看「蛋白质含量」更专业。" },
    { c: "food", t: "为什么要区分「成瘾」与「习惯」？", d: "成瘾的神经机制是「多巴胺预测误差」：不确定的奖励（刷到下一个视频）比固定奖励更能激活奖赏回路，形成「渴望—消费—空虚—再渴望」的循环。习惯则是「情境—动作—奖励」的自动化。识别「我是否在被变量奖励劫持」，是自我管理的第一步——把刺激源移出环境，比只靠意志更有效。" },

    /* 认知边界 */
    { c: "fun", t: "为什么「记忆」其实是重构出来的？", d: "每次回忆都不是放录像，而是按「模式+情境线索」重建，因此极易被事后信息污染（目击者证词的经典教训）。记忆巩固发生在睡眠中，海马体把短期记忆转写为皮层长期表征。这解释了为什么「间隔重复+主动回忆」比反复阅读有效——你每次回忆都在强化可提取的路径。" },
    { c: "fun", t: "为什么我们会「自欺」？", d: "自我欺骗常被视为认知缺陷，但进化上它可能有用：向他人发送「我很有信心」的信号，能提升在群体中的地位。大脑会优先维持「自我一致」的叙事，把矛盾信息选择性忽略。理解自欺，是批判性思维的前提——因为它让你意识到「我看世界的镜头本身有滤镜」。" },
    { c: "fun", t: "为什么「多任务」会降低效率？", d: "人类的工作记忆是「单一通道」，所谓多任务只是「快速切换」，每次切换都有认知成本（任务切换损耗），频繁切换的损失可高达 40% 的效率。「心流」恰恰需要连续的注意投入。所以「整块时间+单任务深度工作」，是单位时间产出最高的方式，也最被低估。" },
    { c: "fun", t: "为什么「直觉」有时比分析更准？", d: "直觉是「内隐学习」的产物：大量经验在大脑里压缩成无意识的模式识别。棋手看局面、医生看症状瞬间的「感觉」，常来自过去数千小时的经验统计。但直觉在「低反馈、高噪声」的环境（股市、选专业）里会失灵。关键区分：你的直觉是否建立在高质量反馈之上。" },
    { c: "fun", t: "为什么「达克效应」让我们高估自己？", d: "能力低的人往往高估自己，因为「不知道自己的不知道」——评估自己水平的能力，本身就是被评估的能力。能力高的人反而低估自己，因为见过更多的复杂度。对抗达克效应：主动寻求外部反馈、把自己放到「会被检验」的场合（考试、答辩、公开发布），让现实来校准自信。" },

    /* 身心健康 */
    { c: "health", t: "睡眠时大脑在做什么？", d: "睡眠不是关机，而是「清理+巩固」：深睡期脑脊液清除代谢废物（如 β 淀粉样蛋白），REM 期整合情绪与程序性记忆。慢性睡眠剥夺直接损害海马体的记忆编码与情绪调节。睡前远离屏幕、固定作息、卧室黑暗凉爽，是性价比最高的认知增强。" },
    { c: "health", t: "为什么「运动」是最被低估的「药物」？", d: "有氧运动提高脑源性神经营养因子（BDNF），促进海马体神经新生，改善记忆与情绪；抗阻训练提高胰岛素敏感性、保护骨骼。运动对抑郁的缓解效果可与部分药物相当，同时作用于心血管、代谢与神经系统——没有任何单一干预有此广度。" },
    { c: "health", t: "压力是敌人还是朋友？", d: "耶克斯—多德森定律：中等压力下表现最佳，过高则瘫痪。关键不是「消灭压力」而是调节觉醒水平：呼吸、正念、运动都能把应激系统从「战斗—逃跑」切回「休息—消化」。压力真正有害的是「长期慢性且无恢复」。学会「压力+恢复」的节律，比羡慕「从不紧张」的人更可行。" },
    { c: "health", t: "为什么「专注」也是一种稀缺资源？", d: "注意力是有限且可损耗的认知资源：每次被打断，回到任务平均需要约 23 分钟重新进入状态。频繁的通知与切换会持续抬高「基线唤醒」，让人难以进入深度专注。保护专注就是保护产出：把手机移出视线、设定「勿扰时段」、提前规划整块时间。" },
    { c: "health", t: "如何建立「可持续」而非「自律」的习惯？", d: "靠意志力硬撑的「自律」不可持续，因为意志力本身会耗尽。可持续习惯的设计原则：降低启动成本（如「2 分钟规则」）、绑定既有情境（把新习惯接在现有习惯之后）、设计即时奖励与环境默认选项。习惯不是「更努力」，而是「减少摩擦」——环境设计，比自我鞭策更可靠。" }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function catName(key) {
    var c = CATS.find(function (x) { return x.key === key; });
    return c ? c.name : key;
  }
  function imgFor(seed) {
    return "https://picsum.photos/seed/" + encodeURIComponent(seed) + "/720/380";
  }

  /* ================= 沉浸式阅读器 ================= */
  /* ================= 电子书多源搜索 ================= */
  var SOURCES = [
    { name: "鸠摩搜索", note: "中文电子书聚合搜 · 国内可用", url: "https://www.jiumodiary.com/?q=" },
    { name: "微信读书", note: "正版阅读 · 国内可用", url: "https://weread.qq.com/web/search/books?keyword=" },
    { name: "豆瓣读书", note: "书目与版本信息", url: "https://book.douban.com/subject_search?search_text=" },
    { name: "古登堡计划", note: "全球公版原著 · 多英文", url: "https://www.gutenberg.org/ebooks/search/?query=" },
    { name: "书格", note: "古籍 / 公版扫描", url: "https://www.shuge.org/?s=" },
    { name: "古诗文网", note: "文言 / 诗词原文", url: "https://so.gushiwen.cn/search.aspx?value=" },
    { name: "Z-Library", note: "免费电子书 · 国内需代理", url: "https://z-lib.io/s/" }
  ];
  function sourceUrl(src, q) { return src.url + encodeURIComponent(q); }
  function openSource(src, q) { if (q && window.openExternal) window.openExternal(sourceUrl(src, q)); }
  function renderEbookSources(containerId, picker) {
    var box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = SOURCES.map(function (src, i) {
      return '<button class="ebook-source" data-src="' + i + '">' +
        '<span class="ebook-source-name">' + esc(src.name) + '</span>' +
        '<span class="ebook-source-note">' + esc(src.note) + '</span>' +
      '</button>';
    }).join("");
    box.querySelectorAll("[data-src]").forEach(function (b) {
      b.onclick = function () {
        var src = SOURCES[parseInt(b.dataset.src, 10)];
        var q = picker
          ? (readerState.book && readerState.book.title || "")
          : (document.getElementById("ebookInput") && document.getElementById("ebookInput").value || "").trim();
        if (picker && window.closeModal) window.closeModal("readerSourceModal");
        openSource(src, q);
      };
    });
  }
  function wireEbook() {
    var go = document.getElementById("ebookGo");
    var input = document.getElementById("ebookInput");
    var doSearch = function () {
      var q = (input && input.value || "").trim();
      if (!q) return;
      openSource(SOURCES[0], q);
    };
    if (go) go.onclick = doSearch;
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });
    renderEbookSources("ebookSources", false);
  }
  function openSourceModal() {
    var m = document.getElementById("readerSourceModal");
    if (!m) return;
    var tt = document.getElementById("sourceBookTitle");
    if (tt && readerState.book) tt.textContent = "「" + readerState.book.title + "」";
    renderEbookSources("sourceList", true);
    if (window.showModal) window.showModal("readerSourceModal");
  }
  var readerState = { fontSize: 19, light: false, book: null };

  function openReader(book) {
    var mask = document.getElementById("readerMask");
    if (!mask) return;
    readerState.book = book;
    try { var fs = localStorage.getItem("lit.reader.fontSize"); if (fs) readerState.fontSize = parseInt(fs, 10) || 19; } catch (e) {}
    try { readerState.light = localStorage.getItem("lit.reader.light") === "1"; } catch (e) {}
    var title = document.getElementById("readerTopTitle");
    var cover = document.getElementById("readerCover");
    var main = document.getElementById("readerMain");
    if (title) title.textContent = book.title;
    if (cover) {
      cover.innerHTML =
        '<div class="reader-cover-inner">' +
          '<div class="reader-cover-title">' + esc(book.title) + '</div>' +
          '<div class="reader-cover-author">' + esc(book.author) + '</div>' +
          '<div class="reader-cover-field">' + esc(book.field) + '</div>' +
        '</div>';
    }
    if (main) {
      main.innerHTML =
        '<div class="reader-chapter-title">' + esc(book.title) + '</div>' +
        '<div class="reader-chapter-sub">' + esc(book.author) + ' · ' + esc(book.field) + '</div>' +
        '<div class="reader-lead">' + esc(book.why) + '</div>' +
        '<div class="reader-body-text">' + esc(book.excerpt) + '</div>' +
        '<div class="reader-actions">' +
          '<button class="btn btn-primary" id="readerZlibBtn">在线阅读完整版 ↗</button>' +
          '<a class="btn btn-ghost" id="readerMoreBtn" target="_blank" rel="noopener">了解这本书 ↗</a>' +
        '</div>';
      var zb = document.getElementById("readerZlibBtn");
      if (zb) zb.onclick = openSourceModal;
      var mb = document.getElementById("readerMoreBtn");
      if (mb) mb.href = "https://www.douban.com/search?q=" + encodeURIComponent(book.title);
    }
    mask.classList.remove("closing");
    mask.classList.add("show");
    mask.setAttribute("aria-hidden", "false");
    document.body.classList.add("reader-open");
    applyReaderTheme();
    applyReaderFont();
    updateReaderProgress();
    var sc = document.getElementById("readerMain");
    if (sc) sc.scrollTop = 0;
  }

  function closeReader() {
    var mask = document.getElementById("readerMask");
    if (!mask) return;
    mask.classList.add("closing");
    setTimeout(function () {
      mask.classList.remove("show", "closing");
      mask.setAttribute("aria-hidden", "true");
      document.body.classList.remove("reader-open");
    }, 200);
  }

  function applyReaderFont() {
    var main = document.getElementById("readerMain");
    if (main) main.style.fontSize = readerState.fontSize + "px";
    var btnDown = document.getElementById("readerFontDown");
    var btnUp = document.getElementById("readerFontUp");
    if (btnDown) btnDown.disabled = readerState.fontSize <= 14;
    if (btnUp) btnUp.disabled = readerState.fontSize >= 26;
  }
  function applyReaderTheme() {
    var mask = document.getElementById("readerMask");
    if (!mask) return;
    mask.classList.toggle("reader-light", readerState.light);
    var btn = document.getElementById("readerTheme");
    if (btn) btn.textContent = readerState.light ? "☾" : "☀";
  }
  function updateReaderProgress() {
    var sc = document.getElementById("readerMain");
    var fill = document.getElementById("readerProgressFill");
    if (!sc || !fill) return;
    var max = sc.scrollHeight - sc.clientHeight;
    var p = max > 0 ? sc.scrollTop / max : 0;
    fill.style.width = (p * 100) + "%";
  }

  function wireReader() {
    var mask = document.getElementById("readerMask");
    if (!mask) return;
    var back = document.getElementById("readerBack");
    if (back) back.onclick = closeReader;
    mask.addEventListener("click", function (e) { if (e.target === mask) closeReader(); });
    var plus = document.getElementById("readerFontUp");
    var minus = document.getElementById("readerFontDown");
    if (plus) plus.onclick = function () { if (readerState.fontSize < 26) { readerState.fontSize++; try { localStorage.setItem("lit.reader.fontSize", readerState.fontSize); } catch (e) {} applyReaderFont(); } };
    if (minus) minus.onclick = function () { if (readerState.fontSize > 14) { readerState.fontSize--; try { localStorage.setItem("lit.reader.fontSize", readerState.fontSize); } catch (e) {} applyReaderFont(); } };
    var theme = document.getElementById("readerTheme");
    if (theme) theme.onclick = function () { readerState.light = !readerState.light; try { localStorage.setItem("lit.reader.light", readerState.light ? "1" : "0"); } catch (e) {} applyReaderTheme(); };
    var zlib = document.getElementById("readerZlib");
    if (zlib) zlib.onclick = openSourceModal;
    var main = document.getElementById("readerMain");
    if (main) main.addEventListener("scroll", updateReaderProgress);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mask.classList.contains("show")) closeReader();
    });
  }

  /* ================= 顶级期刊 ================= */
  function renderJournals() {
    var box = document.getElementById("journalGrid");
    if (!box) return;
    box.innerHTML = JOURNALS.map(function (j) {
      return '<a class="journal-card" href="' + esc(j.url) + '" target="_blank" rel="noopener">' +
        '<div class="journal-head"><span class="journal-name">' + esc(j.name) + '</span>' +
        '<span class="journal-level ' + (j.level === "顶刊" ? "top" : "auth") + '">' + esc(j.level) + '</span></div>' +
        '<div class="journal-org">' + esc(j.org) + '</div>' +
        '<div class="journal-desc">' + esc(j.desc) + '</div>' +
      '</a>';
    }).join("");
  }

  /* ================= 专业书籍 ================= */
  function renderBooks() {
    var box = document.getElementById("bookGrid");
    if (!box) return;
    var fields = [];
    BOOKS.forEach(function (b) { if (fields.indexOf(b.field) < 0) fields.push(b.field); });
    box.innerHTML = fields.map(function (f) {
      var items = BOOKS.filter(function (b) { return b.field === f; });
      return '<div class="book-field">' +
        '<div class="book-field-name">' + esc(f) + '</div>' +
        '<div class="book-field-list">' +
        items.map(function (b) {
          return '<div class="book-card" data-book="' + esc(b.title) + '">' +
            '<div class="book-title">' + esc(b.title) + '</div>' +
            '<div class="book-author">' + esc(b.author) + '</div>' +
            '<div class="book-why">' + esc(b.why) + '</div>' +
            '<div class="book-read">进入沉浸式阅读 →</div>' +
          '</div>';
        }).join("") +
        '</div></div>';
    }).join("");
    box.querySelectorAll(".book-card").forEach(function (card) {
      card.onclick = function () {
        var t = card.dataset.book;
        var b = BOOKS.find(function (x) { return x.title === t; });
        if (b) openReader(b);
      };
    });
  }

  /* ================= 每日知识 ================= */
  var activeCat = "";
  var dailyItem = null;
  function renderKnowledge() {
    checkKnowledgeVersion();
    renderDaily();
    renderCats();
    renderList();
  }
  function renderDaily() {
    var box = document.getElementById("knowledgeDaily");
    if (!box) return;
    if (!dailyItem) {
      var stored = loadDailyPick();
      if (stored) {
        var found = KNOWLEDGE.find(function (k) { return viewedKey(k) === stored.key; });
        if (found) dailyItem = found;
      }
      if (!dailyItem) {
        dailyItem = pickDaily(null);
        saveDailyPick(viewedKey(dailyItem));
      }
    }
    var item = dailyItem;
    if (!item) return;
    box.innerHTML =
      '<div class="knowledge-daily-card">' +
        '<div class="knowledge-daily-img"><img src="' + imgFor(item.c + "-" + item.t) + '" alt="' + esc(item.t) + '" loading="lazy">' + (isViewed(item) ? '<div class="knowledge-viewed-flag">✓ 已看</div>' : '') + '</div>' +
        '<div class="knowledge-daily-body">' +
          '<div class="knowledge-daily-top"><span class="knowledge-daily-badge">今日一知</span><span class="knowledge-daily-cat">' + esc(catName(item.c)) + '</span>' + (isViewed(item) ? '<span class="knowledge-viewed-badge">✓ 已看</span>' : '') + '</div>' +
          '<div class="knowledge-daily-title">' + esc(item.t) + '</div>' +
          '<div class="knowledge-daily-reason">✦ 为你推荐 · ' + esc(dailyReason()) + '</div>' +
          '<div class="knowledge-daily-text">' + esc(item.d) + '</div>' +
          '<div class="knowledge-daily-actions">' +
            '<button class="btn btn-ghost btn-sm" id="btnKnoNext">↻ 换一条</button>' +
            '<button class="btn btn-ghost btn-sm" id="btnKnoOpen">⛶ 沉浸式画面</button>' +
          '</div>' +
          '<div class="knowledge-open-hint">点击卡片任意处，进入全屏沉浸画面</div>' +
        '</div>' +
      '</div>';
    var next = document.getElementById("btnKnoNext");
    if (next) next.onclick = function (e) {
      e.stopPropagation();
      var ni = pickDaily(item);
      if (ni) { dailyItem = ni; saveDailyPick(viewedKey(ni)); }
      renderDaily();
    };
    var openBtn = document.getElementById("btnKnoOpen");
    if (openBtn) openBtn.onclick = function (e) { e.stopPropagation(); openKnowledge(item, true); };
    var card = box.querySelector(".knowledge-daily-card");
    if (card) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "进入沉浸式画面：" + item.t);
      card.title = "点击进入沉浸式画面";
      card.classList.add("kno-openable");
      card.onclick = function () { openKnowledge(item, true); };
      card.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openKnowledge(item, true); } };
    }
  }
  function renderCats() {
    var box = document.getElementById("knowledgeCats");
    if (!box) return;
    box.innerHTML = '<button class="chip' + (activeCat === "" ? " active" : "") + '" data-cat="">全部</button>' +
      CATS.map(function (c) {
        return '<button class="chip' + (activeCat === c.key ? " active" : "") + '" data-cat="' + c.key + '">' + esc(c.name) + '</button>';
      }).join("");
    box.querySelectorAll("[data-cat]").forEach(function (b) {
      b.onclick = function () {
        activeCat = b.dataset.cat;
        renderCats();
        renderList();
      };
    });
  }
  function renderList() {
    var box = document.getElementById("knowledgeList");
    if (!box) return;
    var items = activeCat ? KNOWLEDGE.filter(function (k) { return k.c === activeCat; }) : KNOWLEDGE;
    box.innerHTML = items.map(function (k) {
      return '<div class="knowledge-card kno-openable" role="button" tabindex="0" title="点击进入沉浸式画面" aria-label="进入沉浸式画面：' + esc(k.t) + '">' +
        '<div class="knowledge-img"><img src="' + imgFor(k.c + "-" + k.t) + '" alt="' + esc(k.t) + '" loading="lazy">' + (isViewed(k) ? '<div class="knowledge-viewed-flag">✓ 已看</div>' : '') + '</div>' +
        '<div class="knowledge-body">' +
          '<div class="knowledge-card-cat">' + esc(catName(k.c)) + '</div>' +
          '<div class="knowledge-card-title">' + esc(k.t) + '</div>' +
          '<div class="knowledge-card-text">' + esc(k.d) + '</div>' +
          '<div class="knowledge-open-hint">点击进入沉浸式画面 →</div>' +
        '</div>' +
      '</div>';
    }).join("");
    box.querySelectorAll(".knowledge-card").forEach(function (card, i) {
      var k = items[i];
      if (!k) return;
      card.onclick = function () { openKnowledge(k, false); };
      card.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openKnowledge(k, false); }
      };
    });
  }

  /* ================= 沉浸式知识画面（切换 + 已看标记） ================= */
  var knoSceneOpen = false;
  var knoNavList = [];
  var knoNavIndex = 0;
  var knoFromDaily = false;

  /* 已看状态：本地持久化，按「分类::标题」记录 */
  var KNOWLEDGE_VERSION = "road-bridge-v2";
  function checkKnowledgeVersion() {
    try {
      if (localStorage.getItem("lit.knowledge.version") !== KNOWLEDGE_VERSION) {
        localStorage.removeItem("lit.knowledge.viewed");
        localStorage.removeItem("lit.knowledge.history");
        localStorage.removeItem("lit.knowledge.dailyPick");
        localStorage.removeItem("lit.knowledge.dailyPicks");
        localStorage.setItem("lit.knowledge.version", KNOWLEDGE_VERSION);
        viewedCache = null;
      }
    } catch (e) {}
  }
  function viewedKey(k) { return (k.c || "") + "::" + (k.t || ""); }
  var viewedCache = null;
  function viewedSet() {
    if (viewedCache === null) {
      viewedCache = {};
      try {
        var raw = JSON.parse(localStorage.getItem("lit.knowledge.viewed") || "[]");
        if (Object.prototype.toString.call(raw) === "[object Array]") raw.forEach(function (k) { viewedCache[k] = true; });
      } catch (e) {}
    }
    return viewedCache;
  }
  function isViewed(k) { return !!(k && viewedSet()[viewedKey(k)]); }
  function markViewed(k, yes) {
    var s = viewedSet();
    var key = viewedKey(k);
    if (yes) s[key] = true; else delete s[key];
    try { localStorage.setItem("lit.knowledge.viewed", JSON.stringify(Object.keys(s))); } catch (e) {}
    if (yes) logRead(k);
  }

  /* 阅读历史：用于个性化推送 */
  function readHistory() {
    try { var h = JSON.parse(localStorage.getItem("lit.knowledge.history") || "[]"); return h; } catch (e) { return []; }
  }
  function logRead(k) {
    try {
      var h = readHistory();
      h.push({ key: viewedKey(k), c: k.c || "", ts: Date.now() });
      if (h.length > 500) h = h.slice(-500);
      localStorage.setItem("lit.knowledge.history", JSON.stringify(h));
    } catch (e) {}
  }
  function categoryAffinity() {
    var h = readHistory();
    var now = Date.now();
    var counts = {};
    h.forEach(function (e) {
      var days = (now - e.ts) / 86400000;
      var w = 1 / (1 + days * 0.35);
      counts[e.c] = (counts[e.c] || 0) + w;
    });
    return counts;
  }
  function lastReadTs(k) {
    var h = readHistory();
    var key = viewedKey(k);
    var last = 0;
    for (var i = h.length - 1; i >= 0; i--) { if (h[i].key === key) { last = h[i].ts; break; } }
    return last;
  }
  function knowledgeScore(k, aff) {
    var s = 0;
    if (!isViewed(k)) s += 1000;                              // 未读优先
    s += (aff[k.c] || 0) * 30;                                // 常读领域加权
    if (isViewed(k)) s += (Date.now() - lastReadTs(k)) / 86400000; // 全部读过时，优先许久未读的
    return s;
  }
  function topReadCat() {
    var aff = categoryAffinity();
    var best = null;
    Object.keys(aff).forEach(function (c) { if (best === null || aff[c] > aff[best]) best = c; });
    return best ? catName(best) : "";
  }
  function dailyReason() {
    var top = topReadCat();
    return top ? "常读「" + top + "」" : "根据你的阅读偏好";
  }
  function loadDailyPicks() { try { return JSON.parse(localStorage.getItem("lit.knowledge.dailyPicks") || "[]"); } catch (e) { return []; } }
  function saveDailyPicks(p) { try { localStorage.setItem("lit.knowledge.dailyPicks", JSON.stringify(p)); } catch (e) {} }
  function todayStr() { var n = new Date(); return n.getFullYear() + "-" + (n.getMonth() + 1) + "-" + n.getDate(); }
  function loadDailyPick() {
    try {
      var o = JSON.parse(localStorage.getItem("lit.knowledge.dailyPick") || "null");
      if (o && o.date === todayStr()) return o;
    } catch (e) {}
    return null;
  }
  function saveDailyPick(key) { try { localStorage.setItem("lit.knowledge.dailyPick", JSON.stringify({ date: todayStr(), key: key })); } catch (e) {} }
  function pickDaily(exclude) {
    var aff = categoryAffinity();
    var picks = loadDailyPicks();
    var list = KNOWLEDGE.filter(function (k) {
      var key = viewedKey(k);
      if (exclude && k === exclude) return false;
      if (picks.indexOf(key) >= 0) return false;
      return true;
    });
    if (!list.length) list = KNOWLEDGE.slice();
    list.sort(function (a, b) { return knowledgeScore(b, aff) - knowledgeScore(a, aff); });
    var now = new Date();
    var seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    var top = list.slice(0, Math.min(5, list.length));
    var item = top[seed % top.length];
    var key = viewedKey(item);
    if (picks.indexOf(key) < 0) picks.push(key);
    if (picks.length > 60) picks = picks.slice(-60);
    saveDailyPicks(picks);
    return item;
  }

  function knoNavItems() {
    if (knoFromDaily) return KNOWLEDGE.slice();
    return activeCat ? KNOWLEDGE.filter(function (k) { return k.c === activeCat; }) : KNOWLEDGE.slice();
  }

  function renderKnoScene() {
    var scene = document.getElementById("knoImmersive");
    var item = knoNavList[knoNavIndex] || null;
    if (!scene || !item) return;
    var bg = document.getElementById("knoImmersiveBg");
    var catEl = document.getElementById("knoImmersiveCat");
    var eye = document.getElementById("knoImmersiveEyebrow");
    var pos = document.getElementById("knoImmersivePos");
    var title = document.getElementById("knoImmersiveTitle");
    var text = document.getElementById("knoImmersiveText");
    if (bg) bg.style.backgroundImage = "url('" + imgFor(item.c + "-" + item.t) + "')";
    if (catEl) catEl.textContent = catName(item.c);
    if (eye) eye.textContent = knoFromDaily ? "今日推荐 · 为你精选" : "知识阅览 · KNOWLEDGE";
    if (pos) pos.textContent = (knoNavIndex + 1) + " / " + knoNavList.length;
    if (title) title.textContent = item.t;
    if (text) text.textContent = item.d;
    scene.setAttribute("data-cat", item.c);
    updateKnoViewedBtn();
  }

  function updateKnoViewedBtn() {
    var btn = document.getElementById("knoImmersiveViewed");
    var item = knoNavList[knoNavIndex];
    if (!btn) return;
    var v = isViewed(item);
    btn.classList.toggle("active", v);
    btn.textContent = v ? "✓ 已看" : "○ 标记已看";
    btn.setAttribute("aria-pressed", v ? "true" : "false");
  }

  function openKnowledge(item, isDaily) {
    var scene = document.getElementById("knoImmersive");
    if (!scene || !item) return;
    knoFromDaily = !!isDaily;
    knoNavList = knoNavItems();
    knoNavIndex = -1;
    for (var i = 0; i < knoNavList.length; i++) { if (knoNavList[i] === item) { knoNavIndex = i; break; } }
    if (knoNavIndex < 0) knoNavIndex = 0;
    markViewed(item, true);
    renderKnowledge();
    renderKnoScene();
    scene.classList.remove("closing");
    scene.classList.add("show");
    scene.setAttribute("aria-hidden", "false");
    document.body.classList.add("kno-open");
    knoSceneOpen = true;
    var back = document.getElementById("knoImmersiveBack");
    if (back) setTimeout(function () { back.focus({ preventScroll: true }); }, 80);
  }
  function closeKnowledge() {
    var scene = document.getElementById("knoImmersive");
    if (!scene || !scene.classList.contains("show")) return;
    scene.classList.add("closing");
    setTimeout(function () {
      scene.classList.remove("show", "closing");
      scene.setAttribute("aria-hidden", "true");
      document.body.classList.remove("kno-open");
      knoSceneOpen = false;
    }, 230);
  }
  function knoPrev() {
    if (!knoNavList.length) return;
    knoNavIndex = (knoNavIndex - 1 + knoNavList.length) % knoNavList.length;
    markViewed(knoNavList[knoNavIndex], true);
    renderKnowledge();
    renderKnoScene();
  }
  function knoNext() {
    if (!knoNavList.length) return;
    knoNavIndex = (knoNavIndex + 1) % knoNavList.length;
    markViewed(knoNavList[knoNavIndex], true);
    renderKnowledge();
    renderKnoScene();
  }
  function toggleViewed() {
    var item = knoNavList[knoNavIndex];
    if (!item) return;
    markViewed(item, !isViewed(item));
    updateKnoViewedBtn();
    renderKnowledge();
  }
  function wireKnoImmersive() {
    var scene = document.getElementById("knoImmersive");
    if (!scene) return;
    var back = document.getElementById("knoImmersiveBack");
    if (back) back.onclick = closeKnowledge;
    var prev = document.getElementById("knoImmersivePrev");
    var next = document.getElementById("knoImmersiveNext");
    var viewedBtn = document.getElementById("knoImmersiveViewed");
    if (prev) prev.onclick = knoPrev;
    if (next) next.onclick = knoNext;
    if (viewedBtn) viewedBtn.onclick = toggleViewed;
    scene.addEventListener("click", function (e) { if (e.target === scene) closeKnowledge(); });
    document.addEventListener("keydown", function (e) {
      if (!knoSceneOpen) return;
      if (e.key === "Escape") { closeKnowledge(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); knoPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); knoNext(); }
    });
  }

  window.Knowledge = {
    renderBooks: renderBooks,
    renderDaily: renderDaily,
    renderKnowledge: renderKnowledge,
    renderJournals: renderJournals,
    openKnowledge: openKnowledge,
    closeKnowledge: closeKnowledge
  };
  window.Reader = { open: openReader, close: closeReader };

  wireReader();
  wireEbook();
  wireKnoImmersive();
})();
