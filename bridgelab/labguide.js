/*
 * 星屿 桥梁实验室 · 实验引导（labguide）
 * 步骤引擎 + 校验器 + 分层提示 + 选择题 + AI 苏格拉底式问答（经父页 js/ai.js 的 AI 对象）。
 * 纯前端、零依赖；进度存 localStorage。加实验 = 在 EXPERIMENTS 里加数据。
 */
(function (root) {
  'use strict';

  /* ============ 实验目录（数据驱动） ============ */
  var EXPERIMENTS = [
    {
      id: 'th-walkthrough',
      title: '时程分析五步走',
      module: 'modal3d',
      minutes: 8,
      intro: '从选波到读结果完整走一遍线性时程分析，最后用「时程×反应谱对照卡」验证两种方法互洽。',
      steps: [
        {
          title: '进入时程分析',
          text: '① 切到「3D 模态」模块；② 分析类型选「时程分析」；③ 地震波来源保持「程序合成波」，合成波类型选「Ricker 脉冲」。设好点「检查本步」。',
          hints: [
            '顶部导航栏最右边是「3D 模态」，分析类型在左侧面板第一组。',
            '波类型下拉在「地震波来源」下方，选 Ricker 脉冲（宽频带，适合入门）。'
          ],
          check: function (ctx) {
            if (ctx.mod() !== 'modal3d') return { ok: false, msg: '还没切到「3D 模态」模块' };
            if (ctx.val('m3dAnalysis') !== 'timehistory') return { ok: false, msg: '分析类型要选「时程分析」' };
            if (ctx.val('m3dWaveSource') !== 'builtin') return { ok: false, msg: '地震波来源保持「程序合成波」即可' };
            if (ctx.val('m3dBuiltinWave') !== 'ricker') return { ok: false, msg: '合成波类型选「Ricker 脉冲」' };
            return { ok: true, msg: '配置正确，可以进行下一步' };
          }
        },
        {
          title: '调幅到 0.2g 并运行',
          text: '把「目标 PGA 调幅」拉到 0.20（约 8 度多遇地震量级），然后点参数面板底部的「计算」运行。',
          hints: [
            '调幅滑块在「地震波来源」下方；0.20 对应约 1.96 m/s²。',
            '运行后右侧计算书会出现「时程分析结果」区块，顶部提示条也会更新。'
          ],
          check: function (ctx) {
            var pga = parseFloat(ctx.val('m3dPga'));
            if (!isFinite(pga) || Math.abs(pga - 0.2) > 0.011) return { ok: false, msg: 'PGA 调幅应为 0.20（当前 ' + ctx.val('m3dPga') + '）' };
            var th = ctx.th();
            if (!th) return { ok: false, msg: '还没有结果——点「计算」跑一次时程分析' };
            if (th.kind !== 'timehistory') return { ok: false, msg: '当前结果不是时程类型，确认分析类型选的是「时程分析」' };
            return { ok: true, msg: '运行成功：' + th.waveMeta.steps + ' 步 · dt=' + th.waveMeta.dt.toFixed(3) + ' s' };
          }
        },
        {
          title: '读出峰值位移',
          text: '看计算书或顶部提示条：峰值位移是多少毫米？出现在哪个节点、什么时刻？先自己写下答案，再继续。',
          hints: [
            '提示条格式：「X 向时程 · 峰值 X.XX mm @ N12」。',
            '计算书「时程分析结果」里有「最大位移」一行，带节点号和时间。'
          ],
          check: function (ctx) {
            var th = ctx.th();
            if (!th) return { ok: false, msg: '先完成上一步运行' };
            var pk = th.peak.value * 1000;
            if (!(pk > 0)) return { ok: false, msg: '峰值应为正，结果异常' };
            return { ok: true, msg: '峰值 ' + pk.toFixed(2) + ' mm @ ' + th.peak.nodeId + '，t=' + th.peak.time.toFixed(2) + ' s——和你读的比对' };
          }
        },
        {
          title: '换横向 Z 向再跑一次',
          text: '把「地震输入方向」改成「横向 Z」再运行。观察峰值怎么变——想想为什么（提示：横向刚度通常远大于纵向）。',
          hints: [
            '方向下拉在「调幅系数」下方。',
            '把 X 向和 Z 向两个峰值都记下来，待会儿算比值。'
          ],
          check: function (ctx) {
            var th = ctx.th();
            if (!th) return { ok: false, msg: '先运行' };
            if (th.direction !== 'z') return { ok: false, msg: '当前是 ' + th.direction.toUpperCase() + ' 向——先切成「横向 Z」再运行' };
            ctx.note('zpeak', Math.abs(th.peak.value) * 1000);
            return { ok: true, msg: 'Z 向峰值 ' + (th.peak.value * 1000).toFixed(2) + ' mm；和 X 向的比值是多少？' };
          }
        },
        {
          title: '用对照卡验证两种方法',
          text: '滚到「时程 × 反应谱 峰值对照」卡片：程序已自动把同一地震波换算成反应谱并做了一次谱分析。看「时程/谱」比值是否落在 0.87~1.15。',
          hints: [
            '对照卡在位移时程曲线图下方。',
            '偏出橙色区也不一定错：时程取全时段绝对峰值，谱取模态组合包络，口径本有差异（卡面有注明）。'
          ],
          check: function (ctx) {
            var th = ctx.th();
            if (!th) return { ok: false, msg: '先运行' };
            if (!th.compare) return { ok: false, msg: '对照数据缺失' + (th.compareError ? '：' + th.compareError : '') };
            var r = th.compare.rows[0].ratio;
            if (r === null || !isFinite(r)) return { ok: false, msg: '谱峰值为 0，无法对比' };
            return { ok: true, msg: '位移比值 ' + r.toFixed(2) + '，剪力比值 ' + th.compare.rows[1].ratio.toFixed(2) + (r > 0.87 && r < 1.15 ? '——两种方法互洽 ✓' : '——读一下卡面口径说明再下结论') };
          }
        }
      ]
    },
    {
      id: 'beam-scaling',
      title: '跨度四次方定律',
      module: 'beam',
      minutes: 6,
      intro: '简支梁跨中挠度 δ = 5qL⁴/(384EI)。亲手验证「跨度翻倍、挠度变 16 倍」这个反直觉结论。',
      steps: [
        {
          title: '基准：单跨 30 m',
          text: '切到「梁桥」模块，跨度设为 30（m），其他保持默认，点「计算」。',
          hints: ['跨度输入框在参数面板「跨径布置」一组。'],
          check: function (ctx) {
            if (ctx.mod() !== 'beam') return { ok: false, msg: '先切到「梁桥」模块' };
            if ((ctx.val('pSpans') || '').trim() !== '30') return { ok: false, msg: '跨度先设成 30（当前：' + ctx.val('pSpans') + '）' };
            if (!ctx.last()) return { ok: false, msg: '点「计算」运行一次' };
            ctx.note('defl0', Math.abs(ctx.last().C.defl.worst));
            return { ok: true, msg: '基准完成，挠度已记录' };
          }
        },
        {
          title: '跨度翻倍到 60 m',
          text: '只改跨度为 60，再计算。预言：挠度变几倍？（先写答案再跑）',
          hints: ['δ ∝ L⁴，2⁴ = 16。'],
          check: function (ctx) {
            var d0 = ctx.note('defl0');
            if (!(d0 > 0)) return { ok: false, msg: '先完成上一步基准' };
            if ((ctx.val('pSpans') || '').trim() !== '60') return { ok: false, msg: '跨度应为 60（当前：' + ctx.val('pSpans') + '）' };
            if (!ctx.last()) return { ok: false, msg: '点「计算」运行' };
            var ratio = Math.abs(ctx.last().C.defl.worst) / d0;
            if (ratio > 14 && ratio < 18) return { ok: true, msg: '挠度比 ' + ratio.toFixed(1) + ' ≈ 16——L⁴ 定律验证成功' };
            return { ok: false, msg: '挠度比 ' + ratio.toFixed(1) + ' 不在 14~18 预期带：确认跨度 60、其他参数未动' };
          }
        },
        {
          title: '概念题：为什么不是 2 倍',
          text: 'q 不变、跨度翻倍，总荷载只变 2 倍，挠度为什么变 16 倍？先答选择题，再点「问 AI」让它苏格拉底式带你理清弯矩与刚度两条线。',
          hints: ['δ = 5qL⁴/(384EI)：分子是荷载 qL 再乘 L³（力臂效应），EI 不变。'],
          quiz: { q: '跨度翻倍、q 不变，跨中挠度变为几倍？', options: ['2 倍', '4 倍', '8 倍', '16 倍'], answer: 3 },
          check: function (ctx) { return { ok: true, msg: '思考完成，继续' }; }
        }
      ]
    }
  ];

  /* ============ 引擎核心（纯函数，可单测） ============ */
  function getExp(id) {
    for (var i = 0; i < EXPERIMENTS.length; i++) if (EXPERIMENTS[i].id === id) return EXPERIMENTS[i];
    return null;
  }
  function newRunState(expId) {
    return { expId: expId, step: 0, done: false, quiz: {}, hints: {}, notes: {} };
  }
  function checkStep(st, exp, ctx) {
    var step = exp.steps[st.step];
    if (!step) return { ok: false, msg: '步骤越界' };
    if (step.quiz && st.quiz[st.step] !== true) return { ok: false, msg: '先回答本步选择题' };
    try {
      return step.check(ctx);
    } catch (e) {
      return { ok: false, msg: '检查器异常：' + (e && e.message ? e.message : e) };
    }
  }

  /* ============ 浏览器 UI 部分 ============ */
  var hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
  var ui = { run: null, exp: null };
  var floatEl = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function storeKey() { return 'bl-guide-v1'; }
  function loadProgress() {
    try { return JSON.parse(root.localStorage.getItem(storeKey()) || '{}'); } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { root.localStorage.setItem(storeKey(), JSON.stringify(p)); } catch (e) { }
  }

  function appState() { return root.BL_STATE || null; }
  function collectCtx(st) {
    var S = appState();
    var notes = st.notes;
    return {
      mod: function () { return S ? S.mod : null; },
      val: function (id) { var el = $(id); return el ? el.value : null; },
      th: function () { return S ? S.lastTh : null; },
      last: function () { return S ? (S.last || null) : null; },
      note: function (k, v) {
        if (arguments.length === 1) return notes[k];
        notes[k] = v; return v;
      }
    };
  }

  function renderList() {
    var prog = loadProgress();
    var html = '';
    EXPERIMENTS.forEach(function (exp) {
      var p = prog[exp.id];
      var done = p && p.done;
      var step = p ? (p.step || 0) : 0;
      var total = exp.steps.length;
      var pct = done ? 100 : Math.round(step / total * 100);
      html += '<div class="guide-exp' + (done ? ' done' : '') + '" data-exp="' + exp.id + '">' +
        '<div class="guide-exp-head"><b>' + esc(exp.title) + '</b><span>' + exp.minutes + ' 分钟 · ' + total + ' 步</span></div>' +
        '<div class="guide-exp-intro">' + esc(exp.intro) + '</div>' +
        '<div class="guide-progress"><i style="width:' + pct + '%"></i></div>' +
        '<button class="btn sm guide-start" data-exp="' + exp.id + '">' + (done ? '再做一遍' : (step > 0 ? '继续第 ' + (step + 1) + ' 步' : '开始实验')) + '</button>' +
        '</div>';
    });
    $('guideList').innerHTML = html;
    var btns = $('guideList').querySelectorAll('.guide-start');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { startExp(this.getAttribute('data-exp')); });
    }
  }

  function startExp(expId) {
    var prog = loadProgress();
    var st = newRunState(expId);
    if (prog[expId] && !prog[expId].done) {
      st.step = Math.min(prog[expId].step || 0, getExp(expId).steps.length - 1);
      st.quiz = prog[expId].quiz || {};
      st.hints = prog[expId].hints || {};
    }
    ui.run = st; ui.exp = getExp(expId);
    renderStep();
  }

  function persist() {
    if (!ui.run) return;
    var prog = loadProgress();
    prog[ui.run.expId] = { step: ui.run.step, done: ui.run.done, quiz: ui.run.quiz, hints: ui.run.hints };
    saveProgress(prog);
  }

  function renderStep() {
    var st = ui.run, exp = ui.exp;
    if (!st || !exp || !floatEl) { if (floatEl) floatEl.style.display = 'none'; return; }
    if (aiBusy) aiResetBusy(null);   // 步骤切换重建 DOM，释放 AI 锁与新按钮
    var step = exp.steps[st.step];
    floatEl.style.display = '';
    floatEl.classList.remove('min');
    var hintLevel = st.hints[st.step] || 0;
    var hintsHtml = '';
    for (var h = 0; h < hintLevel && h < step.hints.length; h++) {
      hintsHtml += '<div class="guide-hint">提示 ' + (h + 1) + '：' + esc(step.hints[h]) + '</div>';
    }
    var quizHtml = '';
    if (step.quiz) {
      var answered = st.quiz[st.step] === true;
      quizHtml = '<div class="guide-quiz"><div class="guide-quiz-q">' + esc(step.quiz.q) + '</div>';
      step.quiz.options.forEach(function (opt, oi) {
        quizHtml += '<button class="guide-quiz-opt' + (answered ? ' off' : '') + '" data-oi="' + oi + '">' + esc(opt) + '</button>';
      });
      quizHtml += '<div class="guide-quiz-msg" id="guideQuizMsg">' + (answered ? '✓ 已答对' : '') + '</div></div>';
    }
    var done = st.done;
    floatEl.innerHTML =
      '<div class="guide-float-head"><b>' + esc(exp.title) + '</b><span class="guide-float-ctl"><button class="guide-min" id="guideMin" type="button" title="收起/展开">—</button><button class="guide-min" id="guideClose" type="button" title="退出实验">×</button></span></div>' +
      '<div class="guide-step-head"><span class="guide-step-no">第 ' + (st.step + 1) + ' / ' + exp.steps.length + ' 步</span><b>' + esc(step.title) + '</b></div>' +
      '<div class="guide-step-text">' + esc(step.text) + '</div>' +
      quizHtml +
      '<div class="guide-actions">' +
      '<button class="btn sm" id="guideCheck"' + (done ? ' disabled' : '') + '>检查本步</button>' +
      '<button class="btn sm ghost" id="guideHint"' + (done || hintLevel >= step.hints.length ? ' disabled' : '') + '>要点提示</button>' +
      '<button class="btn sm ghost" id="guideAI">问 AI</button>' +
      '<button class="btn sm ghost" id="guideBack">← 实验列表</button>' +
      '</div>' +
      '<div class="guide-msg" id="guideMsg"></div>' +
      '<div id="guideHints">' + hintsHtml + '</div>' +
      '<div id="guideAiBox"></div>' +
      (done ? '<div class="guide-done">🎉 实验完成！回到列表可重跑，或换个实验。</div>' : '');
    $('guideClose').addEventListener('click', function () { ui.run = null; ui.exp = null; floatEl.style.display = 'none'; renderList(); });
    $('guideMin').addEventListener('click', function () { floatEl.classList.toggle('min'); });
    $('guideCheck').addEventListener('click', onCheck);
    $('guideHint').addEventListener('click', onHint);
    $('guideAI').addEventListener('click', onAskAI);
    if (step.quiz && !done) {
      var opts = $('guideStep').querySelectorAll('.guide-quiz-opt');
      for (var q = 0; q < opts.length; q++) {
        opts[q].addEventListener('click', function () { onQuiz(this.getAttribute('data-oi'), this); });
      }
    }
    persist();
  }

  function onQuiz(oiStr, btn) {
    var st = ui.run, step = ui.exp.steps[st.step];
    var oi = Number(oiStr);
    var msg = $('guideQuizMsg');
    if (oi === step.quiz.answer) {
      st.quiz[st.step] = true;
      if (msg) msg.textContent = '✓ 答对了';
      var sibs = $('guideStep').querySelectorAll('.guide-quiz-opt');
      for (var i = 0; i < sibs.length; i++) sibs[i].classList.add('off');
      btn.classList.add('right');
      persist();
    } else {
      if (msg) msg.textContent = '再想想——可以点「要点提示」。';
      btn.classList.add('wrong');
    }
  }

  function onHint() {
    var st = ui.run, step = ui.exp.steps[st.step];
    var lv = (st.hints[st.step] || 0) + 1;
    if (lv > step.hints.length) return;
    st.hints[st.step] = lv;
    renderStep();
  }

  function onCheck() {
    var st = ui.run;
    var r = checkStep(st, ui.exp, collectCtx(st));
    var box = $('guideMsg');
    box.className = 'guide-msg ' + (r.ok ? 'ok' : 'bad');
    box.textContent = (r.ok ? '✓ ' : '✗ ') + r.msg;
    if (r.ok && !st.done) {
      if (st.step < ui.exp.steps.length - 1) {
        st.step += 1;
        setTimeout(renderStep, 900);
      } else {
        st.done = true;
        persist();
        setTimeout(renderStep, 900);
      }
    }
  }

  /* ---- AI 桥：父页 js/ai.js 的 const AI 在全局词法作用域，用父 realm Function 取 ---- */
  function parentAI() {
    try {
      var w = root.parent;
      if (!w || w === root) return null;
      if (w.AI && typeof w.AI.chat === 'function') return w.AI;
      var fn = new w.Function('try { return (typeof AI !== "undefined" && AI && typeof AI.chat === "function") ? AI : null; } catch (e) { return null; }');
      return fn();
    } catch (e) { return null; }
  }

  function buildPrompt() {
    var st = ui.run, exp = ui.exp, S = appState();
    var step = exp.steps[st.step];
    var lines = [
      '你是桥梁工程实验助教，带学生做「' + exp.title + '」实验（第 ' + (st.step + 1) + ' 步：' + step.title + '）。',
      '要求：苏格拉底式引导，不直接给最终答案；用提问帮学生自己发现；≤150 字；可结合下面的实测数据提问。',
      '',
      '【本步任务】' + step.text,
      '【当前模块】' + (S ? S.mod : '未知')
    ];
    try {
      if (S && S.mod === 'modal3d') {
        lines.push('【当前输入】分析类型=' + ($('m3dAnalysis') || {}).value + '，波=' + ($('m3dBuiltinWave') || {}).value + '，PGA=' + ($('m3dPga') || {}).value + '，方向=' + ($('m3dThDirection') || {}).value);
        var th = S.lastTh;
        if (th) lines.push('【最新时程结果】峰值 ' + (th.peak.value * 1000).toFixed(2) + ' mm @ ' + th.peak.nodeId + '，t=' + th.peak.time.toFixed(2) + ' s，' + th.waveMeta.steps + ' 步，PGA ' + th.waveMeta.pga.toFixed(3) + ' m/s²');
        if (th && th.compare) lines.push('【对照卡】位移时程/谱比值 ' + th.compare.rows[0].ratio.toFixed(2) + '，剪力比值 ' + th.compare.rows[1].ratio.toFixed(2));
      }
      if (S && S.mod === 'beam' && S.last) {
        lines.push('【当前跨度】' + ($('pSpans') || {}).value + ' m');
        lines.push('【最新梁结果】最大挠度 ' + (Math.abs(S.last.C.defl.worst) * 1000).toFixed(2) + ' mm，截面 I=' + S.last.R.sec.I.toFixed(4) + ' m⁴');
      }
    } catch (e) { }
    lines.push('【学生已用提示数】' + (st.hints[st.step] || 0));
    return lines.join('\n');
  }

  /* ---- AI 问答状态机：busy 锁 + 分阶段反馈 + 重试/复制，杜绝「点了没反应」 ---- */
  var aiBusy = false;
  var aiLastPrompt = null;
  var aiWaitTimer = null;

  function copyText(t) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { }, function () { fallbackCopy(t); });
        return;
      }
    } catch (e) { }
    fallbackCopy(t);
  }
  function fallbackCopy(t) {
    try {
      var ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { }
  }

  function aiThinkingHTML() {
    return '<div class="guide-ai-thinking"><span class="guide-ai-spinner"></span><span id="guideAiStage">正在连接 AI…</span></div>';
  }

  function onAskAI() {
    var box = $('guideAiBox');
    var btn = $('guideAI');
    if (!box) return;
    if (aiBusy) return;                       // 请求中防重复点击
    var prompt = buildPrompt();
    aiLastPrompt = prompt;
    var ai = parentAI();
    if (!ai) {
      box.innerHTML = '<div class="guide-ai-fallback">父页 AI 助手未就绪（需在平台「设置」里配置 API Key 或开启本地 AI 代理）。可手动复制下面问题去问：</div>' +
        '<pre class="guide-ai-pre">' + esc(prompt) + '</pre>' +
        '<div class="guide-ai-actions"><button class="btn sm ghost" id="guideAiCopy" type="button">复制问题</button></div>';
      $('guideAiCopy').addEventListener('click', function () { copyText(prompt); this.textContent = '已复制 ✓'; });
      return;
    }
    aiBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = 'AI 响应中…'; }
    box.innerHTML = aiThinkingHTML();
    // 分阶段反馈：2 秒后换成「生成中 + 已等待秒数」，让用户知道没卡死
    var waited = 0;
    aiWaitTimer = setInterval(function () {
      waited += 1;
      var stage = $('guideAiStage');
      if (!stage) { clearInterval(aiWaitTimer); aiWaitTimer = null; return; }
      if (waited >= 2) stage.textContent = 'AI 正在生成回答…（已等待 ' + waited + ' 秒，最长约 30 秒）';
    }, 1000);

    ai.chat([{ role: 'user', content: prompt }], { temperature: 0.5 }).then(function (reply) {
      aiResetBusy(btn);
      var text = String(reply == null ? '' : reply);
      box.innerHTML = '<div class="guide-ai-answer">' + esc(text).replace(/\n/g, '<br>') + '</div>' +
        '<div class="guide-ai-actions"><button class="btn sm ghost" id="guideAiCopy" type="button">复制回答</button><button class="btn sm ghost" id="guideAiAgain" type="button">再问一次</button></div>';
      $('guideAiCopy').addEventListener('click', function () { copyText(text); this.textContent = '已复制 ✓'; });
      $('guideAiAgain').addEventListener('click', function () { box.innerHTML = ''; onAskAI(); });
    }).catch(function (e) {
      aiResetBusy(btn);
      var msg = e && e.message ? e.message : String(e);
      box.innerHTML = '<div class="guide-ai-fallback">调用失败：' + esc(msg) + '</div>' +
        '<div class="guide-ai-actions"><button class="btn sm" id="guideAiRetry" type="button">重试</button><button class="btn sm ghost" id="guideAiCopy" type="button">复制问题</button></div>' +
        '<pre class="guide-ai-pre">' + esc(prompt) + '</pre>';
      $('guideAiRetry').addEventListener('click', function () { box.innerHTML = ''; onAskAI(); });
      $('guideAiCopy').addEventListener('click', function () { copyText(prompt); this.textContent = '已复制 ✓'; });
    });
  }

  function aiResetBusy(btn) {
    aiBusy = false;
    if (aiWaitTimer) { clearInterval(aiWaitTimer); aiWaitTimer = null; }
    if (btn) { btn.disabled = false; btn.textContent = '问 AI'; }
  }

  function init() {
    if (!$('modGuide') || !$('guideList')) return;
    var demoBtnTimer = setInterval(function () {
      var runBtn = $('m3dPlay') || $('m3dReset') || $('m3dAnalysis');
      if (runBtn && !$('m3dDemo')) {
        clearInterval(demoBtnTimer);
        var d = document.createElement('button');
        d.id = 'm3dDemo'; d.className = 'btn sm'; d.type = 'button';
        d.textContent = '\u25b6 AI \u6f14\u793a';
        d.title = '\u81ea\u52a8\u6f14\u793a\uff1aAI \u66ff\u4f60\u64cd\u4f5c\u5b8c\u6574\u65f6\u7a0b\u5b9e\u9a8c';
        d.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;font-weight:700;box-shadow:0 2px 12px rgba(124,58,237,.5);animation:demoPulse 2.2s ease-in-out infinite;margin-right:8px;';
        runBtn.parentNode.insertBefore(d, runBtn);
        demoBtnEl = d;
        d.addEventListener('click', function () {
          if (demoRun.busy) { demoRun.stop = true; if (demoBtnEl) demoBtnEl.textContent = '\u25b6 AI \u6f14\u793a'; return; }
          runDemo('demo-th');
        });
      }
    }, 1000);
    if (!document.getElementById('demoPulseStyle')) {
      var st = document.createElement('style');
      st.id = 'demoPulseStyle';
      st.textContent = '@keyframes demoPulse{0%,100%{box-shadow:0 2px 12px rgba(124,58,237,.5)}50%{box-shadow:0 2px 20px rgba(37,99,235,.85)}}'
        + '@keyframes guideFloatIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}';
      document.head.appendChild(st);
    }
    floatEl = document.createElement('div');
    floatEl.id = 'guideFloat';
    floatEl.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;max-width:min(430px,92vw);display:none;';
    floatEl.style.display = 'none';
    document.body.appendChild(floatEl);
    renderList();
  }


  /* ============ 自动演示（AI 替你操作 + 讲解） ============ */
  var DEMOS = [
    {
      id: 'demo-th',
      title: '\u65f6\u7a0b\u5206\u6790\u5b8c\u6574\u6f14\u793a',
      steps: [
        { act: 'say', text: '\u6f14\u793a\u5f00\u59cb\u3002\u8fd9\u4e00\u96c6\u7528\u4e09\u8de8\u8fde\u7eed\u6881\u6865\u6a21\u578b\uff0c\u5b8c\u6574\u8d70\u4e00\u904d\u5730\u9707\u65f6\u7a0b\u5206\u6790\uff1a\u9009\u5730\u9707\u6ce2\u3001\u8bbe\u53c2\u6570\u3001Newmark-\u03b2 \u9010\u6b65\u79ef\u5206\u6c42\u89e3\uff0c\u518d\u548c\u53cd\u5e94\u8c31\u6cd5\u4ea4\u53c9\u9a8c\u8bc1\uff0c\u6700\u540e\u6362\u6a2a\u5411\u5bf9\u6bd4\u521a\u5ea6\u5dee\u5f02\u3002\u5168\u7a0b\u81ea\u52a8\u64cd\u4f5c\uff0c\u53f3\u4e0b\u89d2\u53ef\u968f\u65f6\u505c\u6b62\u3002' },
        { act: 'set', id: 'm3dAnalysis', value: 'timehistory', say: '\u7b2c\u4e00\u6b65\uff0c\u5206\u6790\u7c7b\u578b\u5207\u6210\u300c\u65f6\u7a0b\u5206\u6790\u300d\u3002\u5b83\u548c\u53cd\u5e94\u8c31\u7684\u672c\u8d28\u533a\u522b\uff1a\u65f6\u7a0b\u5206\u6790\u76f4\u63a5\u79ef\u5206\u8fd0\u52a8\u65b9\u7a0b\uff0c\u8f93\u51fa\u6bcf\u4e00\u65f6\u523b\u7684\u771f\u5b9e\u54cd\u5e94\u8fc7\u7a0b\uff1b\u53cd\u5e94\u8c31\u53ea\u7ed9\u5305\u7edc\u5cf0\u503c\u3002\u89c4\u8303\u8981\u6c42\u91cd\u8981\u3001\u5927\u8de8\u6865\u6882\u7528\u65f6\u7a0b\u8865\u5145\u9a8c\u7b97\uff0c\u5c31\u662f\u4e3a\u6b64\u3002' },
        { act: 'set', id: 'm3dThDamping', value: '5', say: '\u963b\u5c3c\u6bd4\u4fdd\u6301\u9ed8\u8ba4 5%\u3002\u5b83\u523b\u753b\u7ed3\u6784\u8017\u80fd\uff1a\u963b\u5c3c\u8d8a\u5c0f\uff0c\u5171\u632f\u5cf0\u8d8a\u5c16\uff0c\u5cf0\u503c\u8d8a\u5927\u3002\u505a\u5b8c\u53ef\u4ee5\u6539\u6210 2% \u5bf9\u6bd4\u5cf0\u503c\u53d8\u5316\u2014\u2014\u8fd9\u662f\u5b9e\u9a8c\u5f15\u5bfc\u6a21\u5757\u7684\u7b2c\u4e00\u8bfe\u3002' },
        { act: 'set', id: 'm3dBuiltinWave', value: 'ricker', say: '\u5730\u9707\u6ce2\u9009 Ricker \u8109\u51b2\u6ce2\u3002\u5b83\u662f\u5de5\u7a0b\u5e38\u7528\u5408\u6210\u6ce2\uff1a\u65f6\u7a0b\u77ed\u3001\u9891\u5bbd\u5e26\uff0c\u5353\u8d8a\u9891\u7387\u9644\u8fd1\u80fd\u91cf\u96c6\u4e2d\uff0c\u9002\u5408\u89c2\u5bdf\u51b2\u51fb\u578b\u54cd\u5e94\u3002\u4e5f\u53ef\u4ee5\u6362\u6b63\u5f26\u62cd\u6ce2\uff0c\u6216\u5bfc\u5165 PEER \u771f\u5b9e\u5730\u9707\u6ce2\u6587\u4ef6\u3002' },
        { act: 'set', id: 'm3dPga', value: '0.2', say: '\u5cf0\u503c\u52a0\u901f\u5ea6\u8c03\u5e45\u5230 0.2g\uff0c\u5927\u7ea6\u76f8\u5f53\u4e8e 8 \u5ea6\u533a\u591a\u9047\u5730\u9707\u6c34\u5e73\u3002\u8c03\u5e45\u53ea\u7f29\u653e\u6ce2\u7684\u5e45\u503c\uff0c\u4e0d\u6539\u53d8\u6ce2\u5f62\u548c\u9891\u8c31\u6210\u5206\u2014\u2014\u76f8\u5f53\u4e8e\u628a\u540c\u4e00\u6b21\u5730\u9707\u653e\u5230\u66f4\u70c8\u6216\u66f4\u8f7b\u7684\u573a\u5730\u4e0a\u3002' },
        { act: 'run', say: '\u70b9\u51fb\u8ba1\u7b97\u3002\u5f15\u64ce\u7528 Newmark-\u03b2 \u5e73\u5747\u52a0\u901f\u5ea6\u6cd5\u9010\u6b65\u79ef\u5206\uff1a\u6bcf\u4e2a\u65f6\u95f4\u6b65\u8054\u7acb\u6c42\u89e3\u8fd0\u52a8\u65b9\u7a0b\uff0c\u65e0\u6761\u4ef6\u7a33\u5b9a\uff0c\u6b65\u957f\u81ea\u52a8\u8ddf\u968f\u5730\u9707\u6ce2\u7684\u91c7\u6837\u95f4\u9694\u3002\u73b0\u5728\u7b49\u5f85\u79ef\u5206\u5b8c\u6210\u3002' },
        { act: 'waitResult' },
        { act: 'sayResult' },
        { act: 'scroll', target: 'thChartCard', say: '\u8fd9\u662f\u5cf0\u503c\u8282\u70b9\u7684\u4f4d\u79fb\u65f6\u7a0b\u66f2\u7ebf\u3002\u6ce8\u610f\u66f2\u7ebf\u5f62\u6001\uff1aRicker \u51b2\u51fb\u540e\u7ed3\u6784\u81ea\u7531\u8870\u51cf\uff0c\u5305\u7edc\u968f\u963b\u5c3c\u6307\u6570\u8870\u51cf\u3002\u62d6\u52a8\u4e0b\u65b9\u65f6\u95f4\u8f74\uff0c3D \u6a21\u578b\u4f1a\u5b9a\u683c\u5230\u5bf9\u5e94\u65f6\u523b\u7684\u53d8\u5f62\u72b6\u6001\uff0c\u76f4\u89c2\u770b\u5230\u632f\u578b\u53c2\u4e0e\u3002' },
        { act: 'scroll', target: 'thExtraCard', say: '\u8fd9\u5f20\u300c\u65f6\u7a0b \u00d7 \u53cd\u5e94\u8c31\u300d\u5bf9\u7167\u5361\u505a\u4ea4\u53c9\u9a8c\u8bc1\uff1a\u628a\u540c\u4e00\u6761\u5730\u9707\u6ce2\u6362\u7b97\u6210\u53cd\u5e94\u8c31\uff0c\u518d\u6309\u8c31\u7b97\u4e00\u904d\u3002\u4e24\u79cd\u72ec\u7acb\u65b9\u6cd5\u7684\u7ed3\u679c\u6bd4\u5728 0.87 \u5230 1.15 \u4e4b\u95f4\uff0c\u8bf4\u660e\u79ef\u5206\u6b63\u786e\u3001\u6a21\u578b\u81ea\u5951\u2014\u2014\u8fd9\u662f\u9a8c\u6536\u65f6\u7a0b\u7b97\u6cd5\u7684\u91d1\u6807\u51c6\u3002' },
        { act: 'set', id: 'm3dThDirection', value: 'z', say: '\u628a\u5730\u9707\u65b9\u5411\u6362\u6210\u6a2a\u5411 Z \u518d\u7b97\u4e00\u6b21\u3002\u7eb5\u6865\u5411\u548c\u6a2a\u6865\u5411\u7684\u521a\u5ea6\u901a\u5e38\u5dee\u5f88\u591a\uff1a\u6881\u6865\u7684\u6a2a\u5411\u7531\u58a9\u67f1\u548c\u652f\u5ea7\u63d0\u4f9b\uff0c\u5f80\u6bd4\u7eb5\u5411\u67d4\uff0c\u6240\u4ee5\u6a2a\u5411\u54cd\u5e94\u53ef\u80fd\u53cd\u800c\u66f4\u5927\u3002' },
        { act: 'run' },
        { act: 'waitResult' },
        { act: 'sayDirection' },
        { act: 'say', text: '\u6f14\u793a\u7ed3\u675f\u3002\u5efa\u8bae\u81ea\u5df1\u52a8\u624b\uff1a\u628a\u963b\u5c3c\u6bd4\u6539\u6210 2%\u3001\u6362\u6b63\u5f26\u62cd\u6ce2\u3001\u6216\u5bfc\u5165 El Centro \u6ce2\uff0c\u89c2\u5bdf\u5cf0\u503c\u548c\u5bf9\u7167\u5361\u6bd4\u503c\u600e\u4e48\u53d8\u3002\u60f3\u7cfb\u7edf\u7ec3\u4e60\uff0c\u5230\u300c\u5b9e\u9a8c\u5f15\u5bfc\u300d\u6a21\u5757\u505a\u95ef\u5173\u5f0f\u5b9e\u9a8c\u3002' }
      ]
    }
  ];

  var demoRun = { stop: false, busy: false, xPeak: null };
  var demoBtnEl = null;

  function demoSleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function demoHighlight(el) {
    if (!el) return;
    el.classList.add('guide-hl');
    setTimeout(function () { el.classList.remove('guide-hl'); }, 1700);
  }
  function demoSetVal(id, value) {
    var el = $(id);
    if (!el) return;
    demoHighlight(el);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function demoNarrate(html) {
    if (floatEl) { floatEl.style.animation = 'none'; void floatEl.offsetWidth; floatEl.style.animation = 'guideFloatIn .35s ease-out'; }
    try {
      root.__demoLog = root.__demoLog || [];
      root.__demoLog.push({ t: Math.round(performance.now()), html: String(html) });
    } catch (e) { }
    if (!floatEl) return;
    floatEl.style.display = '';
    floatEl.classList.remove('min');
    floatEl.innerHTML = '<div class="guide-float-head"><b>▶ 时程分析演示</b>' +
      '<span class="guide-float-ctl"><button class="guide-min" id="guideDemoStop" type="button" title="停止演示">×</button></span></div>' +
      '<div class="guide-demo-say">' + html + '</div>';
    $('guideDemoStop').addEventListener('click', function () { demoRun.stop = true; });
  }
  function demoSpeakTime(text) {
    var n = String(text || '').replace(/<[^>]*>/g, '').length;
    return Math.max(1600, Math.min(26000, 700 + n * 260));
  }

  function demoResultSummary() {
    var S = appState();
    if (!S || !S.lastTh) return '（无结果）';
    var th = S.lastTh;
    return '峰值位移 <b>' + (th.peak.value * 1000).toFixed(2) + ' mm</b> @ ' + th.peak.nodeId +
      '（t=' + th.peak.time.toFixed(2) + ' s）· 基底剪力峰值 ' + Math.abs(th.peakBaseShear).toFixed(1) +
      ' kN · ' + th.waveMeta.steps + ' 步 dt=' + th.waveMeta.dt.toFixed(3) + ' s';
  }
  function runDemo(demoId) {
    if (demoRun.busy) return;
    var demo = null;
    for (var i = 0; i < DEMOS.length; i++) if (DEMOS[i].id === demoId) demo = DEMOS[i];
    if (!demo || !floatEl) return;
    demoRun.busy = true; demoRun.stop = false; demoRun.xPeak = null;
    if (demoBtnEl) { demoBtnEl.textContent = '\u23f8 \u6f14\u793a\u8fd0\u884c\u4e2d\u2026\u518d\u70b9\u505c\u6b62'; demoBtnEl.style.opacity = '.8'; }
    try { var navBtn = document.querySelector('button[data-m="' + (demo.module || 'modal3d') + '"]'); if (navBtn) navBtn.click(); } catch (e) { }
    (async function () {
      try {
      for (var si = 0; si < demo.steps.length; si++) {
        if (demoRun.stop) break;
        var stp = demo.steps[si];
        try {
          if (stp.act === 'say') {
            demoNarrate(esc(stp.text));
            await demoSleep(stp.ms || demoSpeakTime(stp.text));
          } else if (stp.act === 'set') {
            if (stp.say) { demoNarrate(esc(stp.say)); await demoSleep(demoSpeakTime(stp.say)); }
            if (demoRun.stop) break;
            demoSetVal(stp.id, stp.value);
            await demoSleep(900);
          } else if (stp.act === 'run') {
            if (stp.say) { demoNarrate(esc(stp.say)); await demoSleep(demoSpeakTime(stp.say)); }
            var btn = $('m3dRun');
            demoHighlight(btn);
            if (btn) btn.click();
            await demoSleep(600);
          } else if (stp.act === 'waitResult') {
            demoNarrate(demoNarrate.lastHtml || '计算中…');
            var S = appState();
            var before = S && S.lastTh ? S.lastTh.steps : -1;
            for (var w = 0; w < 240; w++) {
              await demoSleep(250);
              if (demoRun.stop) break;
              var S2 = appState();
              if (S2 && S2.lastTh && S2.lastTh.steps !== before) break;
            }
            var S3 = appState();
            if (S3 && S3.lastTh && S3.lastTh.direction === 'x' && demoRun.xPeak === null) {
              demoRun.xPeak = Math.abs(S3.lastTh.peak.value) * 1000;
            }
            await demoSleep(600);
          } else if (stp.act === 'sayResult') {
            var resHtml = '✓ 计算完成（纵向 X）：' + demoResultSummary();
            demoNarrate(resHtml);
            await demoSleep(demoSpeakTime(resHtml));
          } else if (stp.act === 'scroll') {
            var el = $(stp.target);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); demoHighlight(el); }
            if (stp.say) { demoNarrate(esc(stp.say)); await demoSleep(demoSpeakTime(stp.say)); }
            else { await demoSleep(4200); }
          } else if (stp.act === 'sayDirection') {
            var dirHtml = '';
            var S4 = appState();
            if (S4 && S4.lastTh && demoRun.xPeak !== null) {
              var z = Math.abs(S4.lastTh.peak.value) * 1000;
              var ratio = demoRun.xPeak > 0 ? (z / demoRun.xPeak) : null;
              dirHtml = '✓ 横向 Z 峰值 <b>' + z.toFixed(2) + ' mm</b>，约为纵向的 ' +
                (ratio === null ? '—' : (ratio * 100).toFixed(0) + '%') +
                '——横向刚度大，响应更小。';
              demoNarrate(dirHtml);
            }
            await demoSleep(dirHtml ? demoSpeakTime(dirHtml) : 4200);
          }
        } catch (e) { }
      }
      if (!demoRun.stop) demoNarrate('\u6f14\u793a\u7ed3\u675f \u2713 \u81ea\u5df1\u6539\u6539\u53c2\u6570\u518d\u8dd7\u8dd7\u770b\uff1b\u60f3\u7cfb\u7edf\u7ec3\u4e60\u53ef\u5230\u300c\u5b9e\u9a8c\u5f15\u5bfc\u300d\u6a21\u5757\u3002');
      else demoNarrate('\u5df2\u505c\u6b62\u6f14\u793a\u3002');
      } finally {
        demoRun.busy = false;
        if (demoBtnEl) { demoBtnEl.textContent = '\u25b6 AI \u6f14\u793a'; demoBtnEl.style.opacity = '1'; }
      }
    })();
  }

  var api = {
    EXPERIMENTS: EXPERIMENTS,
    getExp: getExp,
    newRunState: newRunState,
    checkStep: checkStep,
    DEMOS: DEMOS,
    runDemo: hasDom ? runDemo : null,
    init: hasDom ? init : null
  };
  root.LABGUIDE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (hasDom) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);