/* ============================================================
   quotes.js — 每日一言（励志 / 热梗 / 毒鸡汤）
   每天按日期轮换一句，同一天内固定；支持「换一句」。
   ============================================================ */
const QUOTES = {
  motivation: [
    "种一棵树最好的时间是十年前，其次是现在。",
    "你背单词的时候，阿拉斯加的鳕鱼正跃出水面。",
    "星光不问赶路人，时光不负有心人。",
    "未来的你，一定会感谢现在拼命的自己。",
    "把每一天当成一次救赎，把每次复习当成一次通关。",
    "读书不是为了压倒别人，而是为了不被世界轻易定义。",
    "自律给我自由。",
    "低谷时沉淀，顶峰时清醒。",
    "今天多学一分钟，明天少说一句求人的话。",
    "你只管努力，剩下的交给时间——时间不会辜负认真的人。",
    "半山腰总是最挤的，你得去山顶看看。",
    "慢慢来，比较快。"
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
    "你只管努力，剩下的交给天意——天意说：你不行。",
    "小时候以为自己是主角，长大后发现自己连群演都不是。",
    "本来想靠颜值，结果没天赋；只能靠才华，结果才华也没用。",
    "只要坚持，就没有过不去的坎——但过了坎，可能还有坎。",
    "每天告诉自己：我很棒。然后看看别人，算了。"
  ]
};

(function () {
  const CATS = ["motivation", "memes", "poison"];
  const KEY = "zero_quote";

  function dayIndex() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  function pick(idx) {
    const cat = CATS[((idx % CATS.length) + CATS.length) % CATS.length];
    const list = QUOTES[cat];
    return { text: list[((idx % list.length) + list.length) % list.length], cat };
  }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function write(v) { localStorage.setItem(KEY, JSON.stringify(v)); }

  // 今天的句子（同一天内固定；跨天自动换）
  function getDailyQuote() {
    const d = dayIndex();
    const saved = read();
    if (saved && saved.day === d) return pick(saved.idx);
    const idx = Math.floor(Math.random() * 1e6);
    write({ day: d, idx });
    return pick(idx);
  }

  // 「换一句」：跳到下一条，并记住（当天不再回退）
  function nextQuote() {
    const d = dayIndex();
    const saved = read();
    const base = saved && saved.day === d ? saved.idx : Math.floor(Math.random() * 1e6);
    write({ day: d, idx: base + 1 });
    return pick(base + 1);
  }

  window.getDailyQuote = getDailyQuote;
  window.nextQuote = nextQuote;
})();
