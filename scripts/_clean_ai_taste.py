# -*- coding: utf-8 -*-
"""去 AI 味：清理渐变/发光/微光等装饰"""
import io

p = 'css/style.css'
s = io.open(p, encoding='utf-8').read()
orig = s

# 5. hero-card：去掉微光渐变 + 内阴影
s = s.replace("""/* ---------- 仪表盘 ---------- */
.hero-card {
  position: relative; overflow: hidden;
  background: var(--card); border: none; border-radius: 22px;
  padding: 30px 32px; margin-bottom: 22px;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.06);
}
/* hero 背景微光（精致高级） */
.hero-glow {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(600px 200px at 15% 0%, rgba(10,132,255,0.12), transparent 60%),
    radial-gradient(500px 220px at 85% 100%, rgba(191,90,242,0.10), transparent 60%);
}
.hero-card > * { position: relative; z-index: 1; }""",
"""/* ---------- 仪表盘 ---------- */
.hero-card {
  background: var(--card); border: none; border-radius: 18px;
  padding: 28px 30px; margin-bottom: 20px;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;
  box-shadow: var(--shadow);
}""")

# 6. hstat 毛玻璃+边框 → 纯填充
s = s.replace(""".hstat {
  background: rgba(28,28,30,0.6); border: 1px solid var(--border);
  padding: 13px 20px; border-radius: 16px; text-align: center; min-width: 92px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}""",
""".hstat {
  background: var(--fill);
  padding: 12px 18px; border-radius: 12px; text-align: center; min-width: 90px;
}""")

# 7. card 渐变高光线 + 内阴影 → 纯色
s = s.replace(""".card {
  position: relative;
  background: var(--card); border: none; border-radius: var(--radius);
  padding: 20px; box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.05);
  transition: transform 0.24s var(--ease-spring-card), background 0.22s;
  will-change: transform;
  overflow: hidden;
}
/* 卡片顶部渐变细线（材料高光） */
.card::before {
  content: ""; position: absolute; top: 0; left: 18%; right: 18%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
}""",
""".card {
  background: var(--card); border: none; border-radius: var(--radius);
  padding: 20px; box-shadow: var(--shadow);
  transition: transform 0.24s var(--ease-spring-card), background 0.22s;
  will-change: transform;
}""")

# 8. 搜索框聚焦发光环 → 仅变背景
s = s.replace("""  border-radius: 11px; border: none; background: var(--fill); transition: background 0.18s, box-shadow 0.18s; }
.search-box:focus-within { background: var(--fill-2); box-shadow: 0 0 0 3px rgba(10,132,255,0.15); }""",
"""  border-radius: 11px; border: none; background: var(--fill); transition: background 0.18s; }
.search-box:focus-within { background: var(--fill-2); }""")

# 9. cd-num 发光 → 纯色
s = s.replace("""  background: var(--blue); color: #fff; line-height: 1.1;
}""", """  background: var(--blue); color: #fff; line-height: 1.1;
  box-shadow: none;
}""")

# 10. 其他发光阴影统一清理
s = s.replace("box-shadow: 0 6px 18px rgba(10, 132, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.3);", "box-shadow: none;")
s = s.replace("box-shadow: 0 4px 16px rgba(10,132,255,0.4), inset 0 1px 0 rgba(255,255,255,0.25);", "box-shadow: none;")
s = s.replace("box-shadow: 0 8px 30px rgba(10,132,255,0.18);", "box-shadow: none;")

io.open(p, 'w', encoding='utf-8').write(s)
print("去AI味完成，改动字节数:", len(orig) - len(s))
