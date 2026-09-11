/* ============================================================
   quotes.js — 每日一言（中英双语 / 励志 / 热梗 / 毒鸡汤）
   同一天固定；刷新跨天自动换；支持「换一句」。
   ============================================================ */
const QUOTES = {
  zh: {
    motivation: [
      "种一棵树最好的时间是十年前，其次是现在。",
      "星光不问赶路人，时光不负有心人。",
      "未来的你，一定会感谢现在拼命的自己。",
      "把每一天当成一次救赎，把每次复习当成一次通关。",
      "读书不是为了压倒别人，而是为了不被世界轻易定义。",
      "自律给我自由。",
      "低谷时沉淀，顶峰时清醒。",
      "今天多学一分钟，明天少说一句求人的话。",
      "半山腰总是最挤的，你得去山顶看看。",
      "慢慢来，比较快。",
      "不是因为看见希望才坚持，而是坚持了才看见希望。",
      "你现在的努力，是未来最踏实的底气。"
    ],
    memes: [
      "人在图书馆，心在天涯。",
      "主打一个陪伴。",
      "Duck 不必。",
      "我真的会谢。",
      "格局打开！",
      "尊嘟假嘟？",
      "听我说，谢谢你。",
      "咱就是说，一整个大无语。",
      "拴 Q 了家人们。",
      "你礼貌吗？",
      "歪歪滴艾斯。",
      "人生无常，大肠包小肠。"
    ],
    poison: [
      "你不努力一下，怎么知道自己真的不行？",
      "努力不一定会成功，但不努力一定会很轻松。",
      "今天的事不要拖到明天，明天还不一定有空。",
      "别灰心，人生就是这样起起落落落落落落的。",
      "你以为是你不努力，其实是你没天赋。",
      "咸鱼翻身还是咸鱼，但至少翻过身了。",
      "时间是把杀猪刀，专杀你的发际线。",
      "小时候以为自己是主角，长大后发现自己连群演都不是。",
      "本来想靠颜值，结果没天赋；只能靠才华，结果才华也没用。",
      "只要坚持，就没有过不去的坎——但过了坎，可能还有坎。",
      "每天告诉自己：我很棒。然后看看别人，算了。",
      "别问我为什么还在学，问就是热爱循环播放。"
    ]
  },
  en: {
    motivation: [
      "The best time to plant a tree was ten years ago. The second best time is now.",
      "Discipline is choosing what you want most over what you want now.",
      "Small steps every day beat huge plans you never start.",
      "You do not have to be perfect today. Just be present.",
      "Focus is a superpower. Protect it.",
      "Progress is quiet. Keep going until it is loud.",
      "Your future self is watching. Make them proud.",
      "A page read is still a page read. Momentum matters.",
      "You are not behind. You are becoming.",
      "Difficult chapters make strong stories.",
      "Do the hard thing while it is still small.",
      "Study now, shine later.",
      "You are not late. You are learning at your own pace.",
      "One focused hour can rescue a whole day.",
      "Make it simple. Make it honest. Make it done.",
      "You do not need more pressure. You need a smaller first step.",
      "Clarity comes after action, not before it.",
      "Show up again. That is the whole secret."
    ],
    memes: [
      "Brain: full. Heart: tired. Deadlines: thriving.",
      "I am not procrastinating. I am marinating.",
      "My study playlist has one song. It is panic.",
      "Productive? No. Present? Also no. Hilarious? Yes.",
      "One more video. Sure. One more hour.",
      "I work best under pressure, which is concerning.",
      "My brain said rest. My syllabus laughed.",
      "Not all who wander are lost. Some are looking for the library.",
      "Today's mood: 20% caffeine, 80% denial.",
      "I am becoming a scholar. Slowly. Very slowly.",
      "Nothing is impossible. Some things are just unhinged.",
      "Life update: still buffering."
    ],
    poison: [
      "Hard work does not guarantee success, but resting definitely does not help.",
      "You are not lazy. You are just passionately inactive.",
      "Future you is not coming to save you. Future you is just you, later.",
      "Maybe the talent was the excuses we made along the way.",
      "Do not worry about failing. Worry about failing twice.",
      "You have unlimited potential. Unfortunately, also unlimited distractions.",
      "Every all-nighter builds character. And dark circles.",
      "You cannot pour from an empty cup, but you can still cram from one.",
      "It gets easier. That is a lie, but it sounds nice.",
      "Some people learn from mistakes. You collect them.",
      "There is no shortcut. There is only the scenic route through panic.",
      "You will be fine. Probably. Sort of. Eventually."
    ]
  }
};

(function () {
  const CATS = ["motivation", "memes", "poison"];
  const KEY = "zero_quote";

  function dayIndex() {
    const d = new Date();
    return d.getFullYear() * 366 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  }

  function pick(idx) {
    const lang = document.documentElement.dataset.lang === "en" ? "en" : "zh";
    const book = QUOTES[lang] || QUOTES.zh;
    const cat = CATS[((idx % CATS.length) + CATS.length) % CATS.length];
    const list = book[cat];
    return { text: list[((idx % list.length) + list.length) % list.length], cat };
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function write(v) { localStorage.setItem(KEY, JSON.stringify(v)); }

  function getDailyQuote() {
    const d = dayIndex();
    const saved = read();
    if (saved && saved.day === d) return pick(saved.idx);
    const idx = (d * 17 + 11) % 9973;
    write({ day: d, idx });
    return pick(idx);
  }

  function nextQuote() {
    const d = dayIndex();
    const saved = read();
    const base = saved && saved.day === d ? saved.idx : (d * 17 + 11) % 9973;
    write({ day: d, idx: base + 1 });
    return pick(base + 1);
  }

  window.getDailyQuote = getDailyQuote;
  window.nextQuote = nextQuote;
})();
