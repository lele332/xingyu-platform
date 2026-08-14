/* knowledge.js — 文献资料页：专业书籍 + 每日知识推送 */
(function () {
  "use strict";

  /* ---------- 专业书籍（按领域） ---------- */
  var BOOKS = [
    { field: "学习方法", title: "如何阅读一本书", author: "莫提默·艾德勒 / 查尔斯·范多伦", why: "读书方法论经典，教你如何把书读透、读深。" },
    { field: "学习方法", title: "刻意练习", author: "安德斯·艾利克森", why: "解释天才背后的训练方法，人人都可掌握。" },
    { field: "学习方法", title: "认知天性", author: "彼得·布朗", why: "用记忆与学习科学提升学习效率。" },
    { field: "计算机 / 编程", title: "代码大全", author: "史蒂夫·迈克康奈尔", why: "软件构建领域圣经，适合系统打基础。" },
    { field: "计算机 / 编程", title: "算法图解", author: "阿蒂特·巴加拉", why: "用图解讲算法，入门友好不枯燥。" },
    { field: "历史社科", title: "万历十五年", author: "黄仁宇", why: "以小见大剖析晚明社会，中国历史经典。" },
    { field: "历史社科", title: "人类简史", author: "尤瓦尔·赫拉利", why: "从认知革命到科技革命，重新认识人类。" },
    { field: "文学", title: "活着", author: "余华", why: "用最朴素的文字写尽人生坚韧，直击心灵。" },
    { field: "文学", title: "百年孤独", author: "加西亚·马尔克斯", why: "魔幻现实主义巅峰，想象力的盛宴。" },
    { field: "经济商业", title: "国富论", author: "亚当·斯密", why: "现代经济学奠基之作，理解市场与财富。" },
    { field: "经济商业", title: "穷查理宝典", author: "查理·芒格", why: "多元思维模型，投资与人生的智慧。" },
    { field: "科普", title: "时间简史", author: "史蒂芬·霍金", why: "用易懂语言讲宇宙起源与黑洞，科普经典。" },
    { field: "科普", title: "自私的基因", author: "理查德·道金斯", why: "从基因视角理解生命演化，颠覆认知。" },
    { field: "心理成长", title: "思考，快与慢", author: "丹尼尔·卡尼曼", why: "诺贝尔奖得主讲决策偏差，看清思考本质。" },
    { field: "心理成长", title: "被讨厌的勇气", author: "岸见一郎 / 古贺史健", why: "用对话体讲阿德勒心理学，活得轻松自在。" },
    { field: "考公申论", title: "申论的规矩", author: "李永新 (中公)", why: "申论分题型讲解答题套路，备考实用。" },
    { field: "考公申论", title: "半月谈", author: "半月谈编辑部", why: "权威时政读物，积累热点与规范表达。" },
    { field: "健康生活", title: "我们为什么要睡觉", author: "马修·沃克", why: "讲透睡眠科学，帮你睡出高效与健康。" }
  ];

  /* ---------- 每日知识分类 ---------- */
  var CATS = [
    { key: "life", name: "生活科普", icon: "🐝" },
    { key: "tech", name: "科技公司", icon: "🚀" },
    { key: "mineral", name: "矿物岩石", icon: "💎" },
    { key: "exam", name: "考公申论", icon: "📝" },
    { key: "car", name: "汽车品牌", icon: "🚗" },
    { key: "history", name: "历史人物", icon: "👑" },
    { key: "geo", name: "世界地理", icon: "🌍" },
    { key: "food", name: "中华美食", icon: "🍜" },
    { key: "fun", name: "冷知识", icon: "✨" },
    { key: "health", name: "健康养生", icon: "💪" }
  ];

  /* ---------- 知识条目 ---------- */
  var KNOWLEDGE = [
    /* 生活科普 */
    { c: "life", t: "怎么养蜜蜂（入门）", d: "养蜂先要有蜂箱与蜂群，放在向阳、有蜜源的安静处。要点：定期检查蜂群是否分蜂、有无病虫害；注意气温，冬季做好保温；摇蜜要留足口粮，不能一次取光。新手建议先买一箱强群跟本地养蜂人学习。" },
    { c: "life", t: "天空为什么是蓝色的", d: "阳光中蓝光的波长最短，被大气中的空气分子散射得最厉害（瑞利散射），我们抬头看到的四面八方都是被散射的蓝光，所以天空呈蓝色；日落时阳光斜穿大气层，蓝光散射殆尽，只剩红橙光，天边就红了。" },
    { c: "life", t: "西红柿是水果还是蔬菜", d: "植物学上西红柿是果实（水果）；但法律上，1893年美国最高法院裁定西红柿属于「蔬菜」，因为餐桌上当菜用。所以答案取决于你问的是植物学家还是厨师。" },
    { c: "life", t: "盐为什么能化雪", d: "盐能降低水的冰点。冰盐混合后，融点降到约零下几度甚至更低，所以撒盐后雪在低于0℃时也能融化，形成盐水不容易再结冰。" },
    { c: "life", t: "洋葱为什么切着流泪", d: "切洋葱时细胞破裂，释放出含硫化合物「丙硫醛-S-氧化物」，挥发后刺激眼睛的神经，让泪腺分泌泪水来冲刷。把洋葱先冷藏、或切时蘸水，能减少挥发减轻刺激。" },
    { c: "life", t: "为什么热水结冰有时比冷水快", d: "这就是「姆潘巴现象」：在某些条件下热水会先结冰。原因尚在争论，可能与蒸发、溶氧、对流等因素有关，并非所有情况都成立，但确实存在。" },

    /* 科技公司 */
    { c: "tech", t: "谷歌公司简介", d: "Google 由拉里·佩奇和谢尔盖·布林于1998年创立，因搜索引擎起家。如今是 Alphabet 旗下的科技巨头，产品覆盖搜索、安卓、YouTube、云计算、人工智能（如 Gemini）等，是全球访问量最大的网站之一。" },
    { c: "tech", t: "苹果公司简介", d: "苹果由史蒂夫·乔布斯、史蒂夫·沃兹尼亚克和罗恩·韦恩于1976年创立。以 Mac、iPhone、iPad、Apple Watch 等产品闻名，凭借软硬件一体化和设计美学成为全球市值最高的公司之一。" },
    { c: "tech", t: "华为公司简介", d: "华为1987年创立于深圳，从通信设备起家，现为全球领先的 ICT 解决方案提供商，业务涵盖运营商网络、企业业务、消费者终端（手机、鸿蒙系统）和云计算，高度重视自主研发。" },
    { c: "tech", t: "特斯拉公司简介", d: "特斯拉由马丁·艾伯哈德和马克·塔彭宁创立，2004年埃隆·马斯克加入并主导。主营电动汽车、储能与太阳能，Model 3 / Model Y 推动电动车普及，是新能源汽车行业标杆。" },
    { c: "tech", t: "字节跳动公司简介", d: "字节跳动2012年创立于北京，以算法推荐起家，旗下抖音、TikTok、今日头条等风靡全球。凭借内容推荐算法成为成长最快的互联网公司之一。" },
    { c: "tech", t: "微软公司简介", d: "微软由比尔·盖茨和保罗·艾伦于1975年创立，以 Windows 操作系统和 Office 办公软件闻名，如今在云计算（Azure）、人工智能（OpenAI 投资）占据重要地位。" },

    /* 矿物岩石 */
    { c: "mineral", t: "钻石是什么", d: "钻石是碳元素在高温高压下形成的晶体，是自然界最硬的天然矿物（莫氏硬度10）。它由约30亿年前地球深部形成，随火山岩浆带到地表，又被称「金刚石」。" },
    { c: "mineral", t: "黄金为什么这么贵", d: "黄金是贵金属，化学性质稳定、不生锈不腐蚀，且储量稀少、开采成本高。它既是饰品和储值工具，也是电子工业的导电材料，所以自古被视为财富象征。" },
    { c: "mineral", t: "石墨和金刚石是兄弟", d: "石墨和金刚石成分都是纯碳，只是碳原子排列方式不同：金刚石是正四面体紧密结构，极硬；石墨是层状结构，很软可做铅笔芯。同一个元素，两种身份。" },
    { c: "mineral", t: "石英是地壳最常见的矿物之一", d: "石英成分是二氧化硅，透明者为水晶。它遍布地壳，沙子、玻璃、时间与芯片里都有它的身影——石英晶体具有压电效应，是手表和许多电子设备的核心。" },
    { c: "mineral", t: "翡翠与和田玉的区别", d: "翡翠是硬玉（钠铝硅酸盐），主产缅甸，以绿为贵；和田玉是软玉（钙镁硅酸盐），主产新疆和田，以温润细腻著称。两者硬度、光泽、产地和文化地位都不同。" },

    /* 考公申论 */
    { c: "exam", t: "什么是申论", d: "申论是公务员考试科目，模拟机关工作场景，给定材料后要求归纳概括、综合分析、提出对策、贯彻执行并完成大作文。考察阅读理解、归纳概括、解决问题与文字表达四类能力。" },
    { c: "exam", t: "申论大作文的搭法", d: "常见结构：开头点题亮观点，中间用两三个分论点论证（每个分论点=观点+论据+分析），结尾升华回扣主题。分论点可围绕「是什么-为什么-怎么办」或「个人-社会-国家」展开。" },
    { c: "exam", t: "公文写作常用格式", d: "通知、请示、报告、函等公文一般有标题、主送机关、正文、落款（发文机关+日期）。正文常用「为……特……现将有关事宜通知如下」开头，分条列项，结尾用「特此通知/请遵照执行」。" },
    { c: "exam", t: "申论时政怎么积累", d: "每天看权威媒体（人民日报、半月谈）的重点评论，关注社会治理、乡村振兴、科技创新、民生保障等主题；把好词好句和规范表述摘抄成自己的素材库，按主题分类复习。" },
    { c: "exam", t: "申论卷面很重要", d: "阅卷时间有限，卷面整洁、条理清晰能显著提分。字迹工整、分条作答、首句亮要点，避免一大段糊在一起，让阅卷人快速找到得分点。" },

    /* 汽车品牌 */
    { c: "car", t: "保时捷品牌", d: "保时捷1931年由费迪南德·保时捷创立，总部在德国斯图加特。以跑车和性能车闻名，如经典的 911、Cayenne、Taycan 等，兼顾赛道性能与日常驾驶。" },
    { c: "car", t: "劳斯莱斯品牌", d: "劳斯莱斯1906年成立于英国，是顶级豪华车代表，以「每辆车都经过手工精心打造」著称，标志是「欢庆女神」立标。幻影、古斯特等车型象征身份与极致工艺。" },
    { c: "car", t: "丰田品牌", d: "丰田1937年创立于日本，是全球销量最大的汽车制造商之一。以可靠性、经济耐用著称，凯美瑞、卡罗拉畅销全球，并开创了精益生产（丰田生产方式）管理理念。" },
    { c: "car", t: "比亚迪品牌", d: "比亚迪1995年以电池起家，总部在深圳，现已成为全球新能源汽车销量领先者。刀片电池、DM 混动等技术突出，王朝、海洋系列车型广受欢迎。" },
    { c: "car", t: "法拉利品牌", d: "法拉利1947年由恩佐·法拉利创立，意大利超级跑车品牌，以红色赛车和跃马标志闻名。专注高性能跑车，F1 车队历史战绩辉煌，是速度与激情的象征。" },

    /* 历史人物 */
    { c: "history", t: "苏轼", d: "北宋大文豪，字子瞻，号东坡居士。诗词文赋书画皆精，与父苏洵、弟苏辙并称「三苏」。一生命运坎坷、屡遭贬谪，却始终保持豁达，写下「一蓑烟雨任平生」。" },
    { c: "history", t: "王阳明", d: "明代思想家、军事家，心学集大成者，提出「致良知」「知行合一」。他一生立德立功立言，平定宁王之乱，其思想影响东亚数百年，至今被广泛推崇。" },
    { c: "history", t: "拿破仑", d: "法国军事家、政治家，法兰西第一帝国皇帝。以卓越军事才能横扫欧洲，编纂《拿破仑法典》影响深远。1815年滑铁卢战败后流放，结束传奇一生。" },
    { c: "history", t: "武则天", d: "中国历史上唯一正统女皇帝。690年称帝改国号为周，在位期间上承贞观、下启开元，重用人才、整顿吏治，是一位有雄才大略且争议并存的统治者。" },
    { c: "history", t: "爱因斯坦", d: "现代物理学奠基人，1905年提出狭义相对论，1915年提出广义相对论，这一理论改写了人类对时空、引力和宇宙的理解。1921年获诺贝尔物理学奖，被誉为20世纪最伟大的科学家之一。" },

    /* 世界地理 */
    { c: "geo", t: "喜马拉雅山为什么还在长高", d: "印度板块正以每年约5厘米的速度撞向欧亚板块，两大板块碰撞挤压，使喜马拉雅山不断抬升，珠穆朗玛峰每年仍缓慢增高。它还在「生长」，是地球最年轻的高山之一。" },
    { c: "geo", t: "死海为什么叫「死海」", d: "死海是世界陆地最低点，湖面低于海平面约430米。因为含盐量极高（约34%），普通生物无法生存，故称「死海」；也正因为密度大，人可以轻松漂在水面上。" },
    { c: "geo", t: "撒哈拉沙漠", d: "撒哈拉位于北非，面积约900多万平方公里，接近中国国土面积，是世界最大的热沙漠。它不只有沙丘，还有石漠、戈壁和绿洲，历史上曾是一片较湿润的土地。" },
    { c: "geo", t: "亚马逊雨林", d: "亚马逊雨林位于南美洲，是世界最大的热带雨林，被称为「地球之肺」，对全球气候和氧气循环至关重要。它拥有地球上约十分之一的已知物种，生物多样性冠绝全球。" },
    { c: "geo", t: "马里亚纳海沟", d: "马里亚纳海沟位于西太平洋，最深处「挑战者深渊」约11000米，是地球海洋最深点。这里的压力极大、一片漆黑，却仍有生命存在，是科学探索的终极之地。" },

    /* 中华美食 */
    { c: "food", t: "火锅的起源", d: "火锅历史悠久，早在商周就有「鼎」煮食的雏形，有人认为重庆火锅与码头纤夫、船工用牛油麻辣汤底涮煮内脏有关。如今火锅成国民美食，麻辣、清汤、菌汤百花齐放。" },
    { c: "food", t: "饺子的来历", d: "相传饺子由东汉医圣张仲景创制，为治百姓冻耳，用面皮包羊肉等驱寒食材，形似耳朵，称「娇耳」。北方有「冬至吃饺子」的习俗，寓意和和美美、更岁交子。" },
    { c: "food", t: "豆腐的发明", d: "相传豆腐由西汉淮南王刘安在炼丹时偶然制成，用豆浆加石膏或盐卤点化而成。豆腐廉价且富含蛋白质，千百年来成为中国人重要的植物蛋白来源，做法千变万化。" },
    { c: "food", t: "中国茶文化", d: "茶源于中国，传说神农尝百草发现茶。按发酵程度分为绿茶、红茶、乌龙、白茶、黑茶、黄茶六大类。中国有句俗话「柴米油盐酱醋茶」，茶早已融入日常生活与待客之道。" },
    { c: "food", t: "月饼为什么在中秋吃", d: "月饼象征团圆，与中秋赏月习俗相伴。传说元末朱元璋用月饼藏纸条传递起义消息，后流传开来。小小月饼，承载着「但愿人长久，千里共婵娟」的美好祝愿。" },

    /* 冷知识 */
    { c: "fun", t: "蜜蜂之间如何交流", d: "蜜蜂用「舞蹈」传递信息：圆形舞表示食物近，摇摆舞的摆动方向与时长则指示方向和距离。它们靠太阳为参照，还能感知偏振光，堪称天生的导航专家。" },
    { c: "fun", t: "太空有多冷", d: "太空接近绝对零度，约零下270℃。但太空几乎真空，没有物质传导热量，所以受阳光直射的一面会很烫，背阴面则极冷，航天器靠多层隔热和热控系统维持温度。" },
    { c: "fun", t: "海洋占地球多少", d: "地球表面约71%被海洋覆盖，海洋平均深度约3700米。人类已探索的海底不足5%，广袤深海仍是未知世界，可能有数百万种未被发现的生物。" },
    { c: "fun", t: "人体有多少细胞", d: "人体大约有37万亿个细胞，每天有数十亿细胞更新。我们每分钟大约有3亿个细胞死亡和再生，七年左右体内大部分细胞会完成一轮更新。" },
    { c: "fun", t: "π 为什么永远算不完", d: "π（圆周率）是无理数，小数位无限且不循环。人类已用计算机算到数十万亿位，但仍只能无限逼近，这本身就是数学之美和计算能力的体现。" },

    /* 健康养生 */
    { c: "health", t: "睡眠的重要性", d: "成年人建议每晚睡7-9小时。睡眠时大脑会整理记忆、清除代谢废物，长期睡眠不足会损害记忆、免疫和情绪。规律作息、睡前少看屏幕，是提升睡眠质量最简单的方法。" },
    { c: "health", t: "怎么护眼", d: "遵循「20-20-20」法则：每看屏幕20分钟，抬头看6米（20英尺）外至少20秒。保持充足光线、屏幕略低于视线，多眨眼，能有效缓解视疲劳，预防近视加深。" },
    { c: "health", t: "颈椎保护", d: "长时间低头看手机、伏案会让颈椎受压。建议把屏幕垫高到视线水平，每45分钟起来活动肩颈，做点头、转颈、扩胸等拉伸，避免久坐低头造成颈椎劳损。" },
    { c: "health", t: "喝水的正确方式", d: "每天建议饮水1500-1700毫升，少量多次、小口慢饮，不要等口渴才喝。晨起一杯温水、饭前适量饮水都有好处，避免一次猛灌大量水增加肾脏负担。" },
    { c: "health", t: "久坐的风险与对策", d: "久坐会提高代谢、心血管和颈腰椎问题风险。每坐1小时起身活动2-3分钟，站着打电话、走楼梯、做简单拉伸，都能显著降低久坐带来的健康隐患。" }
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
  function catIcon(key) {
    var c = CATS.find(function (x) { return x.key === key; });
    return c ? c.icon : "•";
  }

  /* ---------- 专业书籍 ---------- */
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
          return '<div class="book-card">' +
            '<div class="book-title">' + esc(b.title) + '</div>' +
            '<div class="book-author">' + esc(b.author) + '</div>' +
            '<div class="book-why">' + esc(b.why) + '</div>' +
          '</div>';
        }).join("") +
        '</div></div>';
    }).join("");
  }

  var activeCat = "";
  function renderKnowledge() {
    renderDaily();
    renderCats();
    renderList();
  }
  function renderDaily() {
    var box = document.getElementById("knowledgeDaily");
    if (!box) return;
    var now = new Date();
    var seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    var item = KNOWLEDGE[seed % KNOWLEDGE.length];
    if (!item) return;
    box.innerHTML =
      '<div class="knowledge-daily-card">' +
        '<div class="knowledge-daily-top"><span class="knowledge-daily-badge">今日一知</span><span class="knowledge-daily-cat">' + catIcon(item.c) + ' ' + esc(catName(item.c)) + '</span></div>' +
        '<div class="knowledge-daily-title">' + esc(item.t) + '</div>' +
        '<div class="knowledge-daily-text">' + esc(item.d) + '</div>' +
        '<div class="knowledge-daily-actions">' +
          '<button class="btn btn-ghost btn-sm" id="btnKnoNext">↻ 换一条</button>' +
        '</div>' +
      '</div>';
    var next = document.getElementById("btnKnoNext");
    if (next) next.onclick = function () {
      var i = KNOWLEDGE.indexOf(item);
      var ni = (i + 1 + Math.floor(Math.random() * (KNOWLEDGE.length - 1))) % KNOWLEDGE.length;
      item = KNOWLEDGE[ni];
      renderDaily();
    };
  }
  function renderCats() {
    var box = document.getElementById("knowledgeCats");
    if (!box) return;
    box.innerHTML = '<button class="chip' + (activeCat === "" ? " active" : "") + '" data-cat="">全部</button>' +
      CATS.map(function (c) {
        return '<button class="chip' + (activeCat === c.key ? " active" : "") + '" data-cat="' + c.key + '">' + c.icon + ' ' + esc(c.name) + '</button>';
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
      return '<div class="knowledge-card">' +
        '<div class="knowledge-card-head"><span class="knowledge-card-cat">' + catIcon(k.c) + '</span><span class="knowledge-card-title">' + esc(k.t) + '</span></div>' +
        '<div class="knowledge-card-text">' + esc(k.d) + '</div>' +
      '</div>';
    }).join("");
  }

  window.Knowledge = {
    renderBooks: renderBooks,
    renderDaily: renderDaily,
    renderKnowledge: renderKnowledge
  };
})();
