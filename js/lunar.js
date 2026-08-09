/* ============================================================
   lunar.js — 农历转换 + 节日查询（含 24 节气）
   数据来源：经典农历算法（1900-2100 数据表）
   ============================================================ */
const Lunar = (() => {

  /* ---------- 农历数据表（1900-2100） ---------- */
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
    0x0d520
  ];

  /* ---------- 节气数据 ---------- */
  const TERM_INFO = [0,21208,42467,63836,85337,107014,128867,150921,173149,195551,218072,240693,263343,285989,308563,331033,353350,375494,397447,419210,440795,462224,483532,504758];
  const TERM_NAME = ["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"];

  /* ---------- 农历节日（农历月-日 → 名称） ---------- */
  const LUNAR_FEST = {
    "1-1": "春节", "1-5": "破五", "1-15": "元宵节",
    "2-2": "龙抬头", "3-3": "上巳节",
    "5-5": "端午节", "7-7": "七夕节", "7-15": "中元节",
    "8-15": "中秋节", "9-9": "重阳节", "10-1": "寒衣节",
    "10-15": "下元节", "12-8": "腊八节", "12-23": "北方小年", "12-24": "南方小年"
  };

  /* ---------- 公历节日（月-日 → 名称） ---------- */
  const SOLAR_FEST = {
    "1-1": "元旦", "2-14": "情人节", "3-8": "妇女节", "3-12": "植树节", "3-14": "白色情人节",
    "4-1": "愚人节", "4-22": "世界地球日", "5-1": "劳动节", "5-4": "青年节", "5-12": "护士节",
    "6-1": "儿童节", "7-1": "建党节", "8-1": "建军节", "8-8": "爸爸节", "9-10": "教师节",
    "10-1": "国庆节", "10-24": "程序员节", "12-24": "平安夜", "12-25": "圣诞节", "12-31": "跨年夜"
  };

  /* ---------- 动态节日（第几个星期几） ---------- */
  const WEEK_FEST = [
    { month: 5, week: 2, day: 0, name: "母亲节" },
    { month: 6, week: 3, day: 0, name: "父亲节" },
    { month: 11, week: 4, day: 4, name: "感恩节" }
  ];

  const nStr1 = ["日", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const nStr2 = ["初", "十", "廿", "三"];

  /* ---------- 基础农历计算 ---------- */
  function lYearDays(y) {
    let i, sum = 348;
    for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + leapDays(y);
  }
  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
  function leapDays(y) {
    if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }
  function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

  /* ---------- 公历 → 农历 ---------- */
  function toLunar(date) {
    const baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - baseDate) / 86400000);
    let i, temp = 0, lY = 1900, lM = 1, lD = 1, leap = 0, isLeap = false;

    for (i = 1900; i < 2101 && offset > 0; i++) {
      temp = lYearDays(i);
      offset -= temp;
    }
    if (offset < 0) { offset += temp; i--; }
    lY = i;
    leap = leapMonth(lY);
    isLeap = false;
    for (i = 1; i < 13 && offset > 0; i++) {
      if (leap > 0 && i === (leap + 1) && isLeap === false) {
        --i; isLeap = true; temp = leapDays(lY);
      } else {
        temp = monthDays(lY, i);
      }
      if (isLeap === true && i === (leap + 1)) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && i === leap + 1) {
      if (isLeap) isLeap = false;
      else { isLeap = true; --i; }
    }
    if (offset < 0) { offset += temp; --i; }
    lM = i;
    lD = offset + 1;
    return { lYear: lY, lMonth: lM, lDay: lD, isLeap };
  }

  /* ---------- 节气 ---------- */
  function sTermDate(y, n) {
    const offDate = new Date((31556925974.7 * (y - 1900) + TERM_INFO[n] * 60000) + Date.UTC(1900, 0, 6, 2, 5));
    return offDate.getUTCDate();
  }
  function getTerm(y, m, d) {
    // TERM_NAME 每两个一组：0小寒 1大寒 2立春...（序号从 0 开始，n 为 2*m 附近）
    const n = 2 * (m - 1) + (d > 15 ? 1 : 0);
    const termDay = sTermDate(y, n);
    return d === termDay ? TERM_NAME[n] : "";
  }

  /* ---------- 农历文本 ---------- */
  function lunarMonthName(m) {
    if (m === 1) return "正月";
    if (m === 11) return "冬月";
    if (m === 12) return "腊月";
    return nStr1[m] + "月";
  }
  function lunarDayName(d) {
    let s;
    if (d === 10) s = "初十";
    else if (d === 20) s = "二十";
    else if (d === 30) s = "三十";
    else {
      s = nStr2[Math.floor(d / 10)];
      s += nStr1[d % 10];
      if (d < 10) s = "初" + nStr1[d];
    }
    return s;
  }

  /* ---------- 判断某天节日 ---------- */
  function getFestivals(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const l = toLunar(date);
    const list = [];

    // 1. 农历节日
    const lKey = l.lMonth + "-" + l.lDay;
    if (LUNAR_FEST[lKey]) list.push({ name: LUNAR_FEST[lKey], type: "lunar", emoji: "🧧" });
    // 除夕：腊月最后一天
    if (l.lMonth === 12 && l.lDay === monthDays(l.lYear, 12)) list.push({ name: "除夕", type: "lunar", emoji: "🧨" });

    // 2. 公历节日
    const sKey = m + "-" + d;
    if (SOLAR_FEST[sKey]) list.push({ name: SOLAR_FEST[sKey], type: "solar", emoji: "🎉" });

    // 3. 动态节日（第几个星期几）
    const dayOfWeek = date.getDay();
    const weekOfMonth = Math.floor((d - 1) / 7) + 1;
    WEEK_FEST.forEach(wf => {
      if (wf.month === m && wf.day === dayOfWeek && weekOfMonth === wf.week) {
        list.push({ name: wf.name, type: "week", emoji: "💐" });
      }
    });

    // 4. 节气
    const term = getTerm(y, m, d);
    if (term) list.push({ name: term, type: "term", emoji: "🌤" });

    // 优先级：农历 > 公历 > 动态 > 节气
    const order = { lunar: 0, solar: 1, week: 2, term: 3 };
    list.sort((a, b) => order[a.type] - order[b.type]);
    return list;
  }

  /* ---------- 下一个节日 ---------- */
  function getNextFestival(date, maxDays = 180) {
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    for (let i = 1; i <= maxDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const fs = getFestivals(d);
      if (fs.length) {
        return { days: i, festival: fs[0], date: d };
      }
    }
    return null;
  }

  /* ---------- 今日信息汇总（供 UI 使用） ---------- */
  function getTodayInfo(date) {
    const l = toLunar(date);
    const fests = getFestivals(date);
    return {
      lunarText: (l.isLeap ? "闰" : "") + lunarMonthName(l.lMonth) + lunarDayName(l.lDay),
      lunarYear: l.lYear,
      festivals: fests,
      main: fests[0] || null,
      next: getNextFestival(date)
    };
  }

  return { toLunar, getFestivals, getNextFestival, getTodayInfo, lunarMonthName, lunarDayName };
})();
