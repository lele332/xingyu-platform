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
    { key: "debate", name: "观点对峙" },
    { key: "magazine", name: "杂志精选" },
    { key: "life", name: "生活科普" },
    { key: "tech", name: "科技公司" },
    { key: "mineral", name: "矿物岩石" },
    { key: "exam", name: "考公申论" },
    { key: "car", name: "汽车品牌" },
    { key: "history", name: "历史人物" },
    { key: "geo", name: "世界地理" },
    { key: "food", name: "中华美食" },
    { key: "fun", name: "冷知识" },
    { key: "health", name: "健康养生" }
  ];

  /* ================= 知识条目（图文并茂） ================= */
  var KNOWLEDGE = [
    /* 观点对峙 */
    { c: "debate", t: "人工智能会不会取代人类", d: "正方：AI 正在接管翻译、编程、设计等岗位，未来多数重复性智力劳动都难逃被替代。反方：AI 只是强大的工具，它没有欲望、没有价值观，真正稀缺的是'提出问题、承担责任、创造意义'的人类能力。与其焦虑被取代，不如想想如何与 AI 分工协作。" },
    { c: "debate", t: "该不该全面禁烟", d: "正方：烟草每年夺走数百万生命，二手烟伤害无辜，全面禁烟是公共卫生的必要之举。反方：成年人有权选择自己的生活方式，全面禁止会催生黑市，且收效甚微。真正的共识是'控烟'：公共场所禁烟、提高税收、加强科普。" },
    { c: "debate", t: "在线教育能否取代线下", d: "正方：在线教育打破地域限制、价格更低、资源更丰富，还能回放复习。反方：教育不止是'知识的传递'，还有师生互动、同伴氛围与即时反馈，线下学习的专注与仪式感难以复制。未来很可能是'线上资源 + 线下深度互动'的混合模式。" },
    { c: "debate", t: "短视频是毒药还是营养", d: "正方：算法投喂让人上瘾、碎片化吞噬专注力，是'精神鸦片'。反方：短视频是信息平权的新载体，让普通人也能学到知识、看到世界。关键不在媒介，而在'谁在使用、如何使用'——用好了是工具，用滥了是陷阱。" },
    { c: "debate", t: "定居城市好还是田园生活好", d: "正方：城市提供机会、医疗、教育与圈层，是向上生长的跳板。反方：城市节奏快、压力大、房价高，田园生活更接近人的本真。没有标准答案，只有'适合'——有人爱效率，有人爱慢生活，关键是听从自己。" },
    { c: "debate", t: "人类应不应该殖民火星", d: "正方：火星是人类的'第二家园备胎'，探索它推动科技、激发生存韧性与浪漫。反方：火星环境极端残酷，成本天文数字，眼前的海洋污染、气候危机更值得先解决。先管好地球，再谈星辰大海。" },

    /* 杂志精选 */
    { c: "magazine", t: "[国家地理] 亚马逊雨林：地球之肺", d: "亚马逊雨林面积约 550 万平方公里，占地球热带雨林的一半，被称为'地球之肺'。它每年吸收巨量二氧化碳，承载着地球上约十分之一的已知物种。但森林砍伐与干旱正在威胁这片绿色心脏，保护它，就是保护全人类。" },
    { c: "magazine", t: "[经济学人] 为什么自由贸易总被争论", d: "经济学人认为，自由贸易的整体收益大于损失，但收益与代价的分配并不均等——有人因进口竞争失业，有人因出口扩张受益。争论的焦点从来不是'开放与否'，而是如何补偿受损者、让贸易的红利更公平地流动。" },
    { c: "magazine", t: "[科学美国人] 基因编辑革命", d: "CRISPR 技术让'编辑基因'像改文档一样简单，有望治愈遗传病、改良作物。但随之而来的伦理问题同样尖锐：基因增强会否制造新的不平等？编辑人类胚胎该划在哪条线？科学美国人呼吁在热情中保持冷静的伦理审视。" },
    { c: "magazine", t: "[IEEE Spectrum] 从 5G 到 6G", d: "5G 刚落地，全球已开始想象 6G：更低的时延、更高的带宽、把通信与感知融为一体。6G 或许能让'数字孪生''全息通信'成为日常。IEEE 纵览提醒，关键在于算力、能耗与频谱的协同，技术愿景需要扎实的工程支撑。" },
    { c: "magazine", t: "[读者] 时间管理的三个误区", d: "误区一：把日程排满就是高效，其实留白才能思考；误区二：一边做一边被打断还硬撑，其实保护'整块时间'更重要；误区三：只管理时间不管理精力，其实状态好时一小时胜过困倦时三小时。管理时间，本质是管理精力与优先级。" },
    { c: "magazine", t: "[三联生活周刊] 现代人的睡眠困境", d: "屏幕蓝光、加班文化、报复性熬夜，让'睡个好觉'成了奢侈品。三联周刊指出，睡眠不足正在透支健康与创造力。改善不必靠极端手段：固定作息、睡前一小时远离屏幕、卧室保持黑暗凉爽，就是最好的'安眠药'。" },
    { c: "magazine", t: "[博物] 地球上最特别的动物", d: "水熊虫能在真空与极寒中休眠数年后复活；鮟鱇鱼在无光深海自带'钓竿'发光诱捕猎物；裸鼹鼠几乎不患癌、寿命远超同类。博物杂志提醒我们：生命的适应力远超想象，地球上每一种'怪异'，都是亿万年的生存智慧。" },
    { c: "magazine", t: "[中国国家地理] 中国的三级阶梯", d: "中国地势西高东低，像三级大台阶：第一级青藏高原平均海拔 4000 米以上，第二级是高原与盆地，第三级是广阔的平原丘陵。这种地势让大河自西向东奔流、形成丰富的气候与地貌，也塑造了中国人'一山有四季，十里不同天'的多样生活。" },

    /* 生活科普 */
    { c: "life", t: "怎么养蜜蜂（入门）", d: "养蜂先要有蜂箱与蜂群，放在向阳、有蜜源的安静处。要点：定期检查蜂群是否分蜂、有无病虫害；注意气温，冬季做好保温；摇蜜要留足口粮，不能一次取光。新手建议先买一箱强群，跟本地养蜂人学习。" },
    { c: "life", t: "天空为什么是蓝色的", d: "阳光中蓝光的波长最短，被大气中的空气分子散射得最厉害（瑞利散射），我们抬头看到的四面八方都是被散射的蓝光，所以天空呈蓝色；日落时阳光斜穿大气层，蓝光散射殆尽，只剩红橙光，天边就红了。" },
    { c: "life", t: "西红柿是水果还是蔬菜", d: "植物学上西红柿是果实（水果）；但法律上，1893 年美国最高法院裁定西红柿属于'蔬菜'，因为餐桌上当菜用。所以答案取决于你问的是植物学家还是厨师。" },
    { c: "life", t: "盐为什么能化雪", d: "盐能降低水的冰点。冰盐混合后，融点降到约零下几度甚至更低，所以撒盐后雪在低于 0℃ 时也能融化，形成的盐水不容易再结冰。" },
    { c: "life", t: "洋葱为什么切着流泪", d: "切洋葱时细胞破裂，释放出含硫化合物'丙硫醛-S-氧化物'，挥发后刺激眼睛的神经，让泪腺分泌泪水来冲刷。把洋葱先放冰箱冻一会儿或浸水再切，就能少流泪。" },

    /* 科技公司 */
    { c: "tech", t: "谷歌公司简介", d: "谷歌创立于 1998 年，因搜索引擎起家，如今拥有 Android、YouTube、谷歌云、Waymo 无人车等庞大生态。它的使命是'整合全球信息，使人人皆可访问并从中受益'，也是全球 AI 研究最前沿的公司之一。" },
    { c: "tech", t: "苹果的商业逻辑", d: "苹果不靠低价取胜，而是'软硬一体'：设计、系统、App Store 与服务（Apple Music、iCloud）互相咬合，用户黏性极高。它证明了在消费电子里，'极致体验 + 生态锁定'比单纯堆参数更能创造价值。" },
    { c: "tech", t: "特斯拉为什么重视电池", d: "电动车成本的大头与性能的瓶颈都在电池。特斯拉一边自研电池（4680 大圆柱），一边建超级工厂压缩成本，还布局 AI 自动驾驶与储能。它想同时做'能源公司'与'AI 公司'，而不只是车企。" },
    { c: "tech", t: "微软的转型之路", d: "微软曾是 PC 时代的霸主，靠 Windows 与 Office 赚钱。移动时代它一度掉队，却在云时代靠 Azure 与 OpenAI 的合作重回巅峰。微软的启示：一家大公司能否'二次创业'，取决于是否敢于自我颠覆。" },
    { c: "tech", t: "字节跳动的算法生意", d: "今日头条、抖音、TikTok 的共同底层是'推荐算法'：猜你喜欢、持续投喂。字节用数据驱动与赛马机制，把内容分发做成了一门全球化生意。它提醒我们：流量时代的核心资产，是'懂用户'的算法与组织效率。" },

    /* 矿物岩石 */
    { c: "mineral", t: "钻石为什么最硬", d: "钻石是金刚石，碳原子以最紧密的四面体结构排列，形成极强的共价键网，所以硬度天然最高。但钻石也'怕热'——高温下会氧化成二氧化碳，'恒久远'更多是营销话术。" },
    { c: "mineral", t: "黄金为什么这么贵", d: "黄金是贵金属，化学性质稳定、不锈不蚀，且全球储量有限、开采成本高。它既是首饰、又是电子与航天材料，还是几百年的'价值储藏'。稀缺 + 稳定 + 共识，让黄金一直硬通货。" },
    { c: "mineral", t: "水晶与玻璃的区别", d: "水晶是天然或人工培育的晶体，内部原子有序排列，硬度高；玻璃是非晶态，原子排列无序，相对易碎。市面上很多'水晶饰品'其实是玻璃，用偏光镜或看内部气泡、硬度划痕可大致区分。" },
    { c: "mineral", t: "大理石为什么怕酸雨", d: "大理石主要成分是碳酸钙，遇酸会反应生成气体与可溶盐，被'腐蚀'。酸雨落在石雕、墓碑上，会慢慢磨平花纹与字迹。所以户外古迹要涂防护层，避免直接接触酸性雨水。" },
    { c: "mineral", t: "煤是怎么形成的", d: "亿万年前，茂密植物倒在沼泽中，被层层泥沙掩埋，在缺氧、高温高压下慢慢'碳化'成煤。所以煤是'远古太阳能'的化石形态，也正因如此，烧煤会释放远古封存的碳，加剧温室效应。" },

    /* 考公申论 */
    { c: "exam", t: "申论怎么找分论点", d: "材料为王。先通读材料，勾画政府的做法、问题、原因与对策；然后按'背景—问题—原因—对策—意义'梳理逻辑。分论点通常藏在'怎么做'里，从不同主体（政府/企业/个人）或不同层面（制度/技术/文化）切入，最有层次。" },
    { c: "exam", t: "大作文的开头怎么写", d: "开头要短、准、有力度：先用一句背景或名言破题，再快速点出中心论点。忌绕弯、忌大段抄材料。常见公式：现象/背景 → 转折 → 亮明观点。控制在 100 字左右，让阅卷者一眼看到你的立意。" },
    { c: "exam", t: "规范表达的常用句式", d: "多用四字词与对仗：'多措并举''落地见效''标本兼治''惠民生、暖民心、顺民意'。提对策时用'一是…二是…三是…'或'从…入手、在…发力、向…延伸'。平时多读人民日报评论、半月谈，积累固定搭配。" },
    { c: "exam", t: "热点素材怎么积累", d: "别贪多，每周精读 2-3 篇时政评论，记下'一个金句 + 一个案例 + 一个角度'。重点领域：乡村振兴、数字经济、基层治理、生态文明、科技创新。素材在精不在多，能用在多个主题下的'万能案例'最值钱。" },
    { c: "exam", t: "申论时间怎么分配", d: "建议总分拨 10% 时间先通读材料、划重点；归纳概括、综合分析、对策题每道控制在总时间的 50%-60%；大作文留足 30%-35%，先列提纲再动笔。大作文宁可短而完整，也不要头重脚轻写不完。" },

    /* 汽车品牌 */
    { c: "car", t: "保时捷为什么是跑车标杆", d: "保时捷从 911 到 Taycan，坚持'后置引擎 + 极致操控'的基因，把性能与日常驾驶平衡到极致。它不算最激进，却把'平衡'做成了艺术，是绕不开的跑车标杆。" },
    { c: "car", t: "奔驰的百年豪华", d: "奔驰是汽车的发明者（卡尔·本茨 1886 年造出第一辆汽车），也是'豪华'的代名词。从 S 级到迈巴赫，它用舒适、安全与工艺，定义了高端轿车的标准，至今仍是商务与地位的一种象征。" },
    { c: "car", t: "丰田的混动与省油", d: "丰田的 THS 混动系统把电机与引擎巧妙结合，在城市工况下大幅省油，可靠性极高。从普锐斯到卡罗拉双擎，丰田证明了'理性造车'也能赢下市场，是'省心耐用'的代名词。" },
    { c: "car", t: "比亚迪与新能源", d: "比亚迪从电池起家，如今是全球新能源车龙头，自研刀片电池、DM-i 混动与云辇底盘。它用'垂直整合'把成本压下来，也让中国品牌第一次在新能源赛道上站上世界舞台。" },
    { c: "car", t: "法拉利为什么贵", d: "法拉利不仅造车，更造'稀缺与激情'：限量发售、手工工艺、赛道血统，让它的收藏价值远超代步工具。它提醒我们，顶级品牌卖的不是参数，而是身份认同与情感溢价。" },

    /* 历史人物 */
    { c: "history", t: "诸葛亮：鞠躬尽瘁的智慧", d: "诸葛亮以'隆中对'为刘备规划三分天下，辅佐两代君主，六出祁山。他不仅是军事家、政治家，还是发明家（木牛流马、连弩）。'鞠躬尽瘁，死而后已'，是他一生最好的注脚。" },
    { c: "history", t: "苏东坡：把苦难活成豁达", d: "苏东坡一生三起三落，被贬黄州、惠州、儋州，却在逆境中写下《赤壁赋》、发明东坡肉。他教会我们：真正的豁达不是没有烦恼，而是把穷途末路过成诗意人生。'一蓑烟雨任平生'。" },
    { c: "history", t: "王阳明：知行合一的心学", d: "王阳明在龙场悟道，提出'知行合一''致良知'。他既是思想家又是军事家，平定叛乱却在功名之外。心学告诉我们：知道与做到本是一体，真正的力量来自内心的良知与行动。" },
    { c: "history", t: "乔布斯：完美主义的倔强", d: "乔布斯被自己创立的公司赶走，又回归救活苹果，推出 iMac、iPhone。他对'简洁与极致'近乎偏执，相信'产品自己会说话'。他的经历告诉我们：伟大的创造，往往来自不肯妥协的坚持。" },
    { c: "history", t: "庄子：逍遥游的哲学", d: "庄子讲'逍遥游'，追求精神的绝对自由。他嘲笑世俗的功名利禄，主张顺应自然、齐同万物。'子非鱼，安知鱼之乐'，提醒我们放下执念，用更广阔的视角看待成败得失。" },

    /* 世界地理 */
    { c: "geo", t: "死海为什么淹不死人", d: "死海位于约旦与以色列交界，盐度高达 30% 以上，是普通海水的近 10 倍。水的密度因此极大，浮力惊人，人可以轻松漂在水面上。也因为盐度超高，水中几乎没有生物，所以叫'死海'。" },
    { c: "geo", t: "撒哈拉沙漠", d: "撒哈拉位于北非，面积约 900 多万平方公里，接近中国国土面积，是世界最大的热沙漠。它不只有沙丘，还有石漠、戈壁与绿洲，历史上曾是一片较湿润的土地。" },
    { c: "geo", t: "亚马逊雨林", d: "亚马逊雨林位于南美洲，是世界最大的热带雨林，被称为'地球之肺'，对全球气候与氧气循环至关重要。它拥有地球上约十分之一的已知物种，生物多样性冠绝全球。" },
    { c: "geo", t: "马里亚纳海沟", d: "马里亚纳海沟位于西太平洋，最深处'挑战者深渊'约 11000 米，是地球海洋最深点。那里的压力极大、一片漆黑，却仍有生命存在，是人类科学探索的终极之地。" },

    /* 中华美食 */
    { c: "food", t: "火锅的起源", d: "火锅历史悠久，早在商周就有'鼎'煮食的雏形，有人认为重庆火锅与码头纤夫、船工用牛油麻辣汤底涮煮内脏有关。如今火锅成国民美食，麻辣、清汤、菌汤百花齐放。" },
    { c: "food", t: "饺子的来历", d: "相传饺子由东汉医圣张仲景创制，为治百姓冻耳，用面皮包羊肉等驱寒食材，形似耳朵，称'娇耳'。北方有'冬至吃饺子'的习俗，寓意和和美美、更岁交子。" },
    { c: "food", t: "豆腐的发明", d: "相传豆腐由西汉淮南王刘安在炼丹时偶然制成，用豆浆加石膏或盐卤点化而成。豆腐廉价且富含蛋白质，千百年来成为中国人重要的植物蛋白来源，做法千变万化。" },
    { c: "food", t: "中国茶文化", d: "茶源于中国，传说神农尝百草发现茶。按发酵程度分为绿茶、红茶、乌龙、白茶、黑茶、黄茶六大类。中国有句俗话'柴米油盐酱醋茶'，茶早已融入日常生活与待客之道。" },
    { c: "food", t: "月饼为什么在中秋吃", d: "月饼象征团圆，与中秋赏月习俗相伴。传说元末朱元璋用月饼藏纸条传递起义消息，后流传开来。小小月饼，承载着'但愿人长久，千里共婵娟'的美好祝愿。" },

    /* 冷知识 */
    { c: "fun", t: "蜜蜂之间如何交流", d: "蜜蜂用'舞蹈'传递信息：圆形舞表示食物近，摇摆舞的摆动方向与时长则指示方位与距离。它们以太阳为参照，还能感知偏振光，堪称天生的导航专家。" },
    { c: "fun", t: "太空有多冷", d: "太空接近绝对零度，约零下 270℃。但太空几乎真空，没有物质传导热量，所以受阳光直射的一面会很烫，背阴面则极冷，航天器靠多层隔热与热控系统维持温度。" },
    { c: "fun", t: "海洋占地球多少", d: "地球表面约 71% 被海洋覆盖，海洋平均深度约 3700 米。人类已探索的海底不足 5%，广袤深海仍是未知世界，可能藏着数百万种未被发现的生物。" },
    { c: "fun", t: "人体有多少细胞", d: "人体大约有 37 万亿个细胞，每天有数十亿细胞更新。我们每分钟约 3 亿个细胞死亡和再生，约七年左右体内大部分细胞会完成一轮更新。" },
    { c: "fun", t: "π 为什么永远算不完", d: "π（圆周率）是无理数，小数位无限且不循环。人类已用计算机算到数十万亿位，但仍只能无限逼近，这本身就是数学之美与计算能力的体现。" },

    /* 健康养生 */
    { c: "health", t: "睡眠的重要性", d: "成年人建议每晚睡 7-9 小时。睡眠时大脑会整理记忆、清除代谢废物，长期睡眠不足会损害记忆、免疫与情绪。规律作息、睡前少看屏幕，是提升睡眠质量最简单的方法。" },
    { c: "health", t: "怎么护眼", d: "遵循'20-20-20'法则：每看屏幕 20 分钟，抬头看 6 米外至少 20 秒。保持充足光线、屏幕略低于视线，多眨眼，能有效缓解视疲劳，预防近视加深。" },
    { c: "health", t: "颈椎保护", d: "长时间低头看手机、伏案会让颈椎受压。建议把屏幕垫高到视线水平，每 45 分钟起来活动肩颈，做点头、转颈、扩胸等拉伸，避免久坐低头造成颈椎劳损。" },
    { c: "health", t: "喝水的正确方式", d: "每天建议饮水 1500-1700 毫升，少量多次、小口慢饮，不要等口渴才喝。晨起一杯温水、饭前适量饮水都有好处，避免一次猛灌大量水增加肾脏负担。" },
    { c: "health", t: "久坐的风险与对策", d: "久坐会提高代谢、心血管与颈腰椎问题风险。每坐 1 小时起身活动 2-3 分钟，站着打电话、走楼梯、做简单拉伸，都能显著降低久坐带来的健康隐患。" }
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
  function openSource(src, q) { if (q) window.open(sourceUrl(src, q), "_blank", "noopener"); }
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
