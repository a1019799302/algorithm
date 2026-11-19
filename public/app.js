import { lessons } from "/lessons.js";
const main = document.querySelector("main");
const sidebar = document.querySelector("#sidebar");
const topbar = document.querySelector("#topbar");
const dialog = document.querySelector("#dialog");
const notice = document.querySelector("#notice");

const iconPaths = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  graph: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.3-4.6 8.4m7-8.4 4.6 8.4M7.5 18h9"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z"/><path d="M9 8h7m-7 4h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5h2m3 0h2"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12m0-12L6 18"/>',
  play: '<path d="m8 5 12 7-12 7z"/>',
  history: '<path d="M3 12a9 9 0 1 1 2.6 6.4M3 5v7h7m2-5v5l3 2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1m-1 6h1m-1 6h1"/>',
  note: '<path d="M5 3h10l4 4v14H5zM9 12h6m-6 4h6m0-13v5h4"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>',
};

function icon(name, size = 18) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${iconPaths[name] || ""}</svg>`;
}

const typesIcon = { algorithm: "graph", case: "note", problem: "book", implementation: "code" };
const state = { data: null, selection: "window", view: "graph", type: "", tag: "", search: "", zoom: 1, month: null };
const reports = new Map();
const languagesByProblem = new Map();
const drafts = new Map();
let judging = false;
let toastTimer;
let graphObserver;

const labels = {
  passed: "通过", wrong_answer: "答案错误", timeout: "运行超时", compile_error: "编译或语法错误",
  runtime_error: "运行错误", error: "运行错误",
};

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options, headers: options.body ? { "Content-Type": "application/json" } : options.headers,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败，请重试。");
  return payload;
}

function announce(message) {
  notice.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { notice.textContent = ""; }, 4000);
}

const dateObject = date => new Date(date + "T00:00:00Z");
const dateString = date => date.toISOString().slice(0, 10);
const shortDate = date => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(dateObject(date));
const addDays = (date, count) => dateString(new Date(dateObject(date).getTime() + count * 86_400_000));
const currentProblem = id => state.data.problems.find(problem => problem.id === id);
const entryById = id => state.data.library.find(entry => entry.id === id);
const relatedIds = id => state.data.relations.flatMap(({ a, b }) => a === id ? [b] : b === id ? [a] : []);
const checkedDates = () => new Set(state.data.checkins.map(row => row.date));
const languageName = key => state.data.languages[key]?.name || key;
const completed = id => state.data.submissions.some(row => row.problemId === id && row.status === "passed");
const problemHref = id => "/problem/" + encodeURIComponent(id);
const statusBadge = status => `<span class="status ${status === "passed" ? "passed" : ""}">${labels[status] || "未评测"}</span>`;
const difficulty = value => `<span class="difficulty ${value === "中等" ? "medium" : ""}">${escape(value)}</span>`;

function route() {
  const [page, id] = location.pathname.slice(1).split("/");
  if (page === "problem") return { page, id, section: "problems", label: "练习题" };
  if (page === "learn") return { page, id, section: page, label: "算法学习" };
  if (page === "library") return { page, id, section: page, label: "知识图谱" };
  if (page === "problems") return { page, section: page, label: "题库" };
  if (page === "history") return { page, section: page, label: "打卡记录" };
  return { page: "home", section: "home", label: "工作台" };
}

function renderChrome(current) {
  sidebar.innerHTML = `
    <a class="brand" href="/" aria-label="算法手记工作台"><img src="/favicon.svg" alt="" width="39" height="39"><strong>算法手记</strong></a>
    <div class="nav-heading">工作区</div>
    <nav class="nav" aria-label="主要导航">
    ${[["home", "home", "工作台"], ["library", "graph", "知识图谱"], ["learn", "note", "算法学习"], ["problems", "book", "题库"], ["history", "calendar", "打卡记录"]]
      .map(([id, symbol, label]) => `<a class="nav-link" href="/${id === "home" ? "" : id}" aria-label="${label}" title="${label}" ${id === current.section ? 'aria-current="page"' : ""}>${icon(symbol)}<span class="nav-text">${label}</span><i class="nav-dot" aria-hidden="true"></i></a>`).join("")}
    </nav>
    <div class="sidebar-foot">${icon("user", 15)}<span>个人工作区</span></div>`;
  topbar.innerHTML = `<div class="crumb"><span>算法手记</span>${icon("chevron", 13)}<strong>${current.label}</strong></div>
    <div class="date-label">${icon("calendar", 15)}<time datetime="${state.data.date}">${shortDate(state.data.date)}</time></div>`;
}

function heading(title, description, action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1>${description ? `<p>${description}</p>` : ""}</div>${action}</div>`;
}

function streak() {
  const dates = checkedDates();
  let cursor = dates.has(state.data.date) ? state.data.date : addDays(state.data.date, -1);
  let total = 0;
  while (dates.has(cursor)) {
    total++;
    cursor = addDays(cursor, -1);
  }
  return total;
}

function week() {
  const { date } = state.data;
  const monday = addDays(date, -((dateObject(date).getUTCDay() + 6) % 7));
  const days = checkedDates();
  return "一二三四五六日".split("").map((label, index) => {
    const day = addDays(monday, index);
    return `<div class="week-day ${day === date ? "today" : ""} ${days.has(day) ? "done" : ""}" title="${day} ${days.has(day) ? "已打卡" : "未打卡"}"><div>${label}</div><span>${days.has(day) ? icon("check", 15) : Number(day.slice(-2))}</span></div>`;
  }).join("");
}

function activity(limit) {
  const rows = state.data.submissions.slice(0, limit);
  if (!rows.length) return `<div class="activity-empty"><span class="check-symbol">${icon("history", 22)}</span><span>提交解法后，评测记录会显示在这里。</span></div>`;
  return `<div class="activity-rows">${rows.map(row => `
    <button type="button" class="activity-row" data-action="submission" data-id="${escape(row.id)}">
      <span><strong>${escape(currentProblem(row.problemId)?.title || row.problemId)}</strong><small>${escape(languageName(row.language))} · ${row.date.slice(5)}</small></span>${statusBadge(row.status)}
    </button>`).join("")}</div>`;
}

function dailyPattern() {
  return `<div class="daily-pattern" aria-hidden="true"><svg class="pattern-graphic" viewBox="0 0 345 255" preserveAspectRatio="xMidYMid meet">
    <path class="visual-edge" d="M23 145 78 111l54 32 72-52 73 35 45-25m-190 42 66 61 79-78m-73-35 36-52 37 87 37 70m-116 8 47 33m-113-94-31 47m103-99 32 74 78 31"/>
    <circle cx="204" cy="91" r="22" fill="none" stroke="#b4dfad" stroke-opacity=".57" stroke-dasharray="2 4"/>
    <circle cx="204" cy="91" r="11" fill="none" stroke="#b4dfad" stroke-opacity=".53"/>
    <circle class="visual-node visual-core" cx="204" cy="91" r="5"/>
    <g class="visual-node"><circle cx="23" cy="145" r="3"/><circle cx="78" cy="111" r="4"/><circle cx="132" cy="143" r="5"/><circle cx="277" cy="126" r="6"/><circle cx="322" cy="101" r="3"/><circle cx="198" cy="204" r="5"/><circle cx="101" cy="190" r="4"/><circle cx="314" cy="196" r="4"/><circle cx="240" cy="39" r="5"/><circle cx="236" cy="165" r="4"/><circle cx="245" cy="237" r="3"/></g>
    <text x="165" y="77">nums</text><text x="251" y="115">solve()</text><text x="207" y="204">test</text>
  </svg></div>`;
}

function renderHome() {
  const daily = currentProblem(state.data.dailyId);
  const done = checkedDates().has(state.data.date);
  const focus = entryById(daily.algorithm);
  main.innerHTML = `
    ${heading("算法工作台", "做完今天的题，把用过的方法留在知识图谱里。")}
    <div class="dashboard-grid">
      <section class="daily" aria-labelledby="daily-title" data-enter>
        ${dailyPattern()}
        <div class="daily-copy"><div class="daily-kicker">${icon("calendar", 16)} 每日一题</div>
          <h2 id="daily-title">${escape(daily.title)}</h2>
          <p>${escape(daily.description.split("。").slice(0, 2).join("。"))}。</p>
        </div>
        <div class="daily-actions">
          <a class="button primary" href="${problemHref(daily.id)}">${done ? "继续练习" : "开始解题"} ${icon("arrow", 16)}</a>
          ${difficulty(daily.difficulty)}
        </div>
      </section>
      <section class="panel check-card" aria-labelledby="check-title">
        <div class="card-head"><h2 id="check-title">打卡进度</h2><a class="inline-link" href="/history" aria-label="查看打卡记录">查看记录 ${icon("chevron", 13)}</a></div>
        <div class="check-state"><span class="check-symbol">${icon(done ? "check" : "calendar", 23)}</span><div><strong>${done ? "今日已打卡" : "今日待打卡"}</strong><p>${done ? "换一种语言再解一次" : "正式提交并通过全部测试"}</p></div></div>
        <div class="week" aria-label="本周打卡">${week()}</div>
        <div class="progress-foot">连续 <strong>${streak()}</strong> 天 <span aria-hidden="true">·</span> 累计 <strong>${state.data.checkins.length}</strong> 天</div>
      </section>
    </div>
    <div class="dashboard-grid">
      <section class="panel graph-preview" aria-labelledby="graph-title">
        <div class="card-head"><h2 id="graph-title">知识图谱</h2><a class="inline-link" href="/library/${escape(focus.id)}">打开图谱 ${icon("arrow", 15)}</a></div>
        ${graphMarkup(focus, relatedIds(focus.id).map(entryById).filter(Boolean).slice(0, 4), true)}
      </section>
      <section class="panel activity-card" aria-labelledby="activity-title">
        <div class="card-head"><h2 id="activity-title">最近提交</h2>${state.data.submissions.length ? '<a class="inline-link" href="/history">全部提交</a>' : ""}</div>
        ${activity(3)}
      </section>
    </div>`;
  connectGraph();
}

function graphMarkup(center, neighbors, preview = false) {
  if (!center) return '<div class="empty">没有匹配的条目。</div>';
  const items = [center, ...neighbors];
  const arranged = items.map((entry, index) => {
    const angle = index === 0 ? 0 : -Math.PI / 2 + (index - 1) * (2 * Math.PI / neighbors.length);
    const rx = preview ? 34 : neighbors.length > 5 ? 35 : 32;
    const ry = preview ? 30 : 34;
    return { entry, x: index === 0 ? 50 : 50 + Math.cos(angle) * rx, y: index === 0 ? 50 : 50 + Math.sin(angle) * ry };
  });
  const indexOf = new Map(arranged.map(({ entry }, index) => [entry.id, index]));
  const selectedEdges = state.data.relations.filter(({ a, b }) => indexOf.has(a) && indexOf.has(b));
  return `<div class="graph-canvas ${preview ? "" : "full"}" aria-label="算法条目关系图">
    <div class="graph-plane" style="transform:scale(${preview ? 1 : state.zoom})">
    <canvas class="graph-edges" data-edges="${selectedEdges.map(({ a, b }) => `${indexOf.get(a)}:${indexOf.get(b)}`).join(",")}" aria-hidden="true"></canvas>
    ${arranged.map(({ entry, x, y }, index) => {
      const body = `${icon(typesIcon[entry.type], 14)}<span>${escape(entry.title)}</span>`;
      const attrs = `class="graph-node ${entry.type}" style="left:${x}%;top:${y}%" data-point="${index}" data-x="${x}" data-y="${y}" title="${escape(entry.title)}" aria-label="${escape(entry.title)}"`;
      return preview
        ? `<a ${attrs} href="/library/${escape(entry.id)}">${body}</a>`
        : `<button ${attrs} type="button" data-action="select-entry" data-id="${escape(entry.id)}" aria-pressed="${index === 0}">${body}</button>`;
    }).join("")}
    </div></div>`;
}

function connectGraph() {
  graphObserver?.disconnect();
  const canvas = main.querySelector(".graph-canvas");
  if (!canvas) return;
  const placeEdges = () => {
    const edges = canvas.querySelector(".graph-edges");
    const ratio = window.devicePixelRatio || 1;
    const { clientWidth: width, clientHeight: height } = canvas;
    edges.width = Math.round(width * ratio);
    edges.height = Math.round(height * ratio);
    const context = edges.getContext("2d");
    if (!context || !edges.dataset.edges) return;
    context.scale(ratio, ratio);
    context.strokeStyle = "#9eb9a5";
    context.beginPath();
    const points = [...canvas.querySelectorAll("[data-point]")];
    for (const edge of edges.dataset.edges.split(",")) {
      const [from, to] = edge.split(":").map(Number);
      const start = points[from].dataset;
      const end = points[to].dataset;
      context.moveTo(start.x * width / 100, start.y * height / 100);
      context.lineTo(end.x * width / 100, end.y * height / 100);
    }
    context.stroke();
  };
  graphObserver = new ResizeObserver(placeEdges);
  graphObserver.observe(canvas);
  placeEdges();
}

function matchingEntries() {
  return state.data.library.filter(entry => (
    (!state.type || entry.type === state.type)
    && (!state.tag || entry.tags.includes(state.tag))
    && [entry.title, entry.body, ...entry.tags, languageName(entry.language)].filter(Boolean).join(" ").toLocaleLowerCase().includes(state.search.trim().toLocaleLowerCase())
  ));
}

function renderLibrary() {
  const tags = [...new Set(state.data.library.flatMap(entry => entry.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  main.innerHTML = `${heading("知识图谱", "沿关联浏览算法、案例、练习题和不同语言的代码。",
    `<button class="button primary" data-action="new-entry">${icon("plus", 15)} 新建条目</button>`)}
    <div class="graph-layout">
      <div class="panel graph-panel">
        <div class="controls">
          <input class="control field-search" id="entry-search" type="search" placeholder="搜索标题、内容或语言" aria-label="搜索知识条目" value="${escape(state.search)}">
          <select class="control" id="entry-type" aria-label="条目类型"><option value="">所有类型</option>${Object.entries(state.data.types).map(([id, label]) => `<option value="${id}" ${state.type === id ? "selected" : ""}>${label}</option>`).join("")}</select>
          <select class="control" id="entry-tag" aria-label="条目标签"><option value="">所有标签</option>${tags.map(tag => `<option ${state.tag === tag ? "selected" : ""}>${escape(tag)}</option>`).join("")}</select>
          <div class="segment" aria-label="浏览方式">${[["graph", "图谱"], ["list", "列表"]].map(([id, label]) => `<button data-action="view" data-id="${id}" aria-pressed="${state.view === id}">${icon(id, 14)}${label}</button>`).join("")}</div>
        </div>
        <div id="graph-content"></div>
      </div>
      <div class="panel detail-panel" id="entry-detail"></div>
    </div>`;
  renderLibraryContent();
}

function renderGraphContent(matches, chosen) {
  if (state.view === "list") {
    return matches.length ? `<div class="graph-list">${matches.map(entry => `<button class="entry-button" data-action="select-entry" data-id="${escape(entry.id)}" aria-pressed="${chosen?.id === entry.id}"><strong>${escape(entry.title)}</strong><small>${state.data.types[entry.type]}${entry.tags.length ? " · " + escape(entry.tags.join(" / ")) : ""}</small></button>`).join("")}</div>` : '<div class="empty">没有匹配的条目。</div>';
  }
  const related = chosen ? relatedIds(chosen.id).map(entryById).filter(Boolean) : [];
  return `
    <div class="controls"><select class="control" id="graph-center" aria-label="图谱中心条目" ${!matches.length ? "disabled" : ""}>${matches.length ? matches.map(entry => `<option value="${escape(entry.id)}" ${chosen?.id === entry.id ? "selected" : ""}>${escape(entry.title)}</option>`).join("") : "<option>没有匹配条目</option>"}</select></div>
    <div class="graph-map">${graphMarkup(chosen, related.slice(0, 8))}
    ${chosen ? '<div class="graph-zoom"><button class="icon-button" data-action="zoom-out" aria-label="缩小图谱">−</button><button class="icon-button" data-action="zoom-in" aria-label="放大图谱">+</button></div>' : ""}</div>
    <div class="legend" aria-label="图谱图例">${Object.entries(state.data.types).map(([id, label]) => `<span><i class="${id}"></i>${label}</span>`).join("")}</div>`;
}

function detail(entry) {
  if (!entry) return '<div class="empty">选择条目后可查看详情。</div>';
  const related = relatedIds(entry.id).map(entryById).filter(Boolean);
  return `<span class="tag">${state.data.types[entry.type]}${entry.language ? " · " + escape(languageName(entry.language)) : ""}</span>
    <h2>${escape(entry.title)}</h2>
    <p>${escape(entry.body)}</p>
    ${entry.source ? `<pre class="code-block"><code>${escape(entry.source)}</code></pre>` : ""}
    ${entry.tags.length ? `<div class="tag-row related">${entry.tags.map(tag => `<span class="tag">${escape(tag)}</span>`).join("")}</div>` : ""}
    ${related.length ? `<div class="related"><h3>关联条目</h3><div class="related-links">${related.map(item => `<button data-action="select-related" data-id="${escape(item.id)}">${escape(item.title)}</button>`).join("")}</div></div>` : ""}
    <div class="detail-actions"><button class="button secondary" data-action="edit-entry" data-id="${escape(entry.id)}">编辑条目</button>
    ${entry.problemId ? `<a class="button primary" href="${problemHref(entry.problemId)}">开始练习 ${icon("arrow", 15)}</a>` : ""}</div>`;
}

function renderLibraryContent() {
  const matches = matchingEntries();
  const chosen = matches.find(entry => entry.id === state.selection) || matches[0];
  if (chosen) state.selection = chosen.id;
  main.querySelector("#graph-content").innerHTML = renderGraphContent(matches, chosen);
  main.querySelector("#entry-detail").innerHTML = detail(chosen);
  connectGraph();
}

function renderProblems() {
  main.innerHTML = `${heading("题库", `共 ${state.data.problems.length} 道原创题，可用 JavaScript、Python 或 Java 练习。`)}
    <div class="panel table-panel">
      <div class="problem-row heading"><span>题目</span><span class="col-label">难度</span><span class="col-label">进度</span></div>
      ${state.data.problems.map(problem => `<a class="problem-row" href="${problemHref(problem.id)}">
        <span class="problem-title">${escape(problem.title)}<small>${problem.id === state.data.dailyId ? "每日一题 · " : ""}${escape(entryById(problem.algorithm)?.title || "")}</small></span>
        <span>${difficulty(problem.difficulty)}</span><span class="col-label">${completed(problem.id) ? statusBadge("passed") : "待通过"}</span>
      </a>`).join("")}
    </div>`;
}

function editorKey(problemId, language) {
  return problemId + ":" + language;
}

function getCode(problem, language) {
  const key = editorKey(problem.id, language);
  if (drafts.has(key)) return drafts.get(key);
  try { return localStorage.getItem("algonote:" + key) ?? problem.starters[language]; }
  catch { return problem.starters[language]; }
}

function saveCode(problem, language, code) {
  const key = editorKey(problem.id, language);
  drafts.set(key, code);
  try { localStorage.setItem("algonote:" + key, code); } catch {}
}

function syncLines() {
  const editor = main.querySelector("#source");
  const lines = main.querySelector(".code-line-numbers");
  if (editor && lines) {
    lines.textContent = editor.value.split("\n").map((_, index) => index + 1).join("\n");
    lines.scrollTop = editor.scrollTop;
  }
}

function renderProblem(id) {
  const problem = currentProblem(id);
  if (!problem) {
    main.innerHTML = `${heading("找不到题目", "")}<a class="button secondary" href="/problems">返回题库</a>`;
    return;
  }
  const language = languagesByProblem.get(id) || "javascript";
  const filename = language === "java" ? "Solution.java" : "solution." + state.data.languages[language].extension;
  main.innerHTML = `${heading(escape(problem.title), problem.id === state.data.dailyId ? "每日一题 · 通过全部测试后自动打卡" : "题库练习")}
    <div class="practice-grid"><section class="panel problem-panel" aria-labelledby="statement-title">
      <div class="card-head"><h2 id="statement-title">题目描述</h2>${difficulty(problem.difficulty)}</div>
      <p>${escape(problem.description)}</p>
      <h3>示例</h3>${problem.examples.map(({ args, expected }, index) => `<pre class="sample">示例 ${index + 1}\nnums = ${escape(JSON.stringify(args[0]))}${problem.parameter ? "\n" + problem.parameter + " = " + args[1] : ""}\n输出 ${expected}</pre>`).join("")}
      <h3>输入范围</h3><ul>${problem.constraints.map(text => `<li>${escape(text)}</li>`).join("")}</ul>
      <div class="detail-actions">
        <a class="button secondary" href="/library/${escape(problem.algorithm)}">查看关联算法</a>
        <button class="button secondary" data-action="reference" data-id="${escape(id)}">查看参考解法</button>
      </div>
    </section><div>
      <section class="panel editor" aria-label="代码编辑器">
        <div class="editor-top"><span class="editor-file">${icon("code", 16)} ${filename}</span>
          <select class="control" id="editor-language" aria-label="编程语言" ${judging ? "disabled" : ""}>${Object.entries(state.data.languages).map(([key, item]) => `<option value="${key}" ${key === language ? "selected" : ""}>${item.name}</option>`).join("")}</select>
        </div>
        <div class="code-editor"><pre class="code-line-numbers" aria-hidden="true"></pre><textarea id="source" aria-label="解法代码" aria-describedby="editor-note" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="20000"></textarea></div>
        <div class="editor-actions"><span class="editor-note" id="editor-note" title="按 Tab 缩进。先按 Esc 再按 Tab 可离开编辑器。">草稿自动保存在当前浏览器</span>
          <button class="button secondary" data-action="run" ${judging ? "disabled" : ""}>${icon("play", 14)} 运行示例</button>
          <button class="button primary" data-action="submit" ${judging ? "disabled" : ""}>${icon("check", 15)} 提交评测</button>
        </div>
      </section>
      <section class="panel report-panel" id="report" aria-live="polite" aria-label="评测结果"></section>
    </div></div>`;
  const editor = main.querySelector("#source");
  editor.value = getCode(problem, language);
  editor.addEventListener("scroll", syncLines);
  syncLines();
  const previous = reports.get(editorKey(id, language));
  if (previous) main.querySelector("#report").innerHTML = renderReport(previous, previous.kind);
}

function renderReport(data, kind) {
  if (data.error) return `<div class="card-head"><h2>评测未完成</h2></div><p>${escape(data.error)}</p>`;
  if (data.pending) return `<div class="card-head"><h2>${kind === "run" ? "正在运行示例" : "正在提交评测"}…</h2></div>`;
  const complexity = data.complexity;
  const metric = (label, value) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
  return `
    <div class="card-head"><h2>${kind === "run" ? "示例结果" : "评测结果"}</h2>${statusBadge(data.status)}</div>
    <div class="metrics">
      ${metric("通过用例", data.passed + " / " + data.total)}
      ${metric("最高耗时", data.durationMs == null ? "—" : data.durationMs + " ms")}
      ${metric("峰值内存", data.memoryKiB == null ? "—" : (data.memoryKiB / 1024).toFixed(1) + " MiB")}
    </div>
    ${data.checkedIn ? `<p>${data.date === state.data.date ? "今日打卡已完成。" : escape(data.date) + " 已打卡。"}</p>` : ""}
    ${data.durationMs != null ? "<p>实测数据包含语言运行时的启动开销。</p>" : ""}
    ${data.message ? `<pre class="code-block">${escape(data.message)}</pre>` : ""}
    ${data.cases.length ? `<details ${data.status !== "passed" ? "open" : ""}><summary>查看用例结果</summary><ul>${data.cases.map((row, index) =>
      `<li>${row.hidden ? "隐藏用例" : "示例"} ${index + 1} · ${labels[row.status] || "异常"}${!row.hidden && row.status === "wrong_answer" ? "。期望 " + escape(row.expected) + "，返回 " + escape(row.actual ?? "无有效整数") : ""}${row.message ? "。 " + escape(row.message) : ""}</li>`).join("")}</ul></details>` : ""}
    ${complexity ? `<details open><summary>代码复杂度 · 自动估算</summary>
       <div class="metrics">${metric("时间", escape(complexity.time || "待确认"))}${metric("额外空间", escape(complexity.space || "待确认"))}</div>
       <p>参考解法 ${escape(complexity.reference.time)} 时间 · ${escape(complexity.reference.space)} 空间</p>
       <p>时间${escape(complexity.comparison.time)} · 空间${escape(complexity.comparison.space)}</p>
       <ul>${complexity.reasons.map(reason => `<li>${escape(reason)}</li>`).join("")}</ul>
    </details>` : ""}`;
}

function calendar() {
  const month = state.month || state.data.date.slice(0, 7);
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5));
  const first = dateObject(month + "-01");
  const gap = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const checked = checkedDates();
  const weekdays = [..."一二三四五六日"].map(day => `<div class="cal-cell head">${day}</div>`).join("");
  const blanks = '<div class="cal-cell blank" aria-hidden="true"></div>'.repeat(gap);
  const cells = Array.from({ length: days }, (_, index) => {
    const date = addDays(month + "-01", index);
    return `<div class="cal-cell ${checked.has(date) ? "done" : ""} ${date === state.data.date ? "today" : ""}" aria-label="${date} ${checked.has(date) ? "已打卡" : "未打卡"}" title="${date} ${checked.has(date) ? "已打卡" : "未打卡"}">${index + 1}</div>`;
  }).join("");
  return `<div class="card-head"><h2>${year} 年 ${number} 月</h2><div class="calendar-controls">
      <button class="icon-button" data-action="month-back" aria-label="上个月">${icon("left", 15)}</button>
      <button class="icon-button" data-action="month-next" aria-label="下个月">${icon("chevron", 15)}</button>
    </div></div><div class="calendar">${weekdays}${blanks}${cells}</div>
    <div class="progress-foot">连续 <strong>${streak()}</strong> 天 · 累计 <strong>${state.data.checkins.length}</strong> 天</div>`;
}

function renderHistory() {
  main.innerHTML = `${heading("打卡记录", "回顾每天的练习，以及不同语言的提交结果。")}
    <div class="history-grid"><section class="panel history-panel" id="cal-panel" aria-label="打卡日历">${calendar()}</section>
    <section class="panel history-panel" aria-labelledby="submissions-title"><div class="card-head"><h2 id="submissions-title">提交历史</h2></div>${activity(Infinity)}</section>
    </div>`;
}

function render() {
  if (!state.data) return;
  graphObserver?.disconnect();
  const current = route();
  renderChrome(current);
  if (current.page === "learn") return renderLearning(current.id);
  if (current.page === "library") {
    if (current.id && entryById(current.id)) {
      state.selection = current.id;
      state.search = state.tag = state.type = "";
    }
    renderLibrary();
  } else if (current.page === "problem") renderProblem(current.id);
  else if (current.page === "problems") renderProblems();
  else if (current.page === "history") renderHistory();
  else renderHome();
}

function showDialog(title, body) {
  dialog.setAttribute("aria-label", title);
  dialog.innerHTML = `<div class="card-head"><h2>${escape(title)}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭">${icon("close", 17)}</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
}

function editEntry(entry) {
  const type = entry?.type || "algorithm";
  const related = new Set(entry ? relatedIds(entry.id) : []);
  showDialog(entry ? "编辑条目" : "新建条目", `
    <form class="entry-form" data-id="${escape(entry?.id)}">
      <label>标题<input required autofocus class="control" name="title" maxlength="80" value="${escape(entry?.title)}"></label>
      <div class="form-grid">
        <label>类型<select class="control" name="type" id="form-type" ${entry?.problemId ? "disabled" : ""}>
          ${Object.entries(state.data.types).map(([key, label]) => `<option value="${key}" ${type === key ? "selected" : ""}>${label}</option>`).join("")}
        </select></label>
        <label>标签<input class="control" name="tags" placeholder="用逗号分隔" value="${escape(entry?.tags.join(", "))}"></label>
      </div>
      <label>内容<textarea class="control" name="body" rows="4" maxlength="12000" placeholder="记录思路、开发场景或实现细节">${escape(entry?.body)}</textarea></label>
      <label class="implementation-field" ${type === "implementation" ? "" : "hidden"}>语言<select class="control" name="language">
        ${Object.entries(state.data.languages).map(([key, item]) => `<option value="${key}" ${entry?.language === key ? "selected" : ""}>${item.name}</option>`).join("")}
      </select></label>
      <label class="implementation-field" ${type === "implementation" ? "" : "hidden"}>代码<textarea class="control entry-code" name="source" rows="5" maxlength="20000" spellcheck="false">${escape(entry?.source)}</textarea></label>
      <fieldset><legend>关联条目</legend><div class="checklist">
        ${state.data.library.filter(item => item.id !== entry?.id).map(item =>
          `<label><input type="checkbox" name="related" value="${escape(item.id)}" ${related.has(item.id) ? "checked" : ""}>${escape(item.title)}</label>`).join("")}
      </div></fieldset>
      <div class="form-error" role="alert"></div>
      <div class="form-actions"><button type="button" class="button secondary" data-action="close-dialog">取消</button><button class="button primary" type="submit">保存条目</button></div>
    </form>`);
  dialog.querySelector("[name=title]").focus();
}

async function persistEntry(event) {
  event.preventDefault();
  const form = event.target;
  const fields = new FormData(form);
  const id = form.dataset.id;
  const body = Object.fromEntries(fields);
  body.type = form.querySelector("[name=type]").value;
  body.tags = body.tags.split(/[,，、]/);
  body.related = fields.getAll("related");
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  try {
    const saved = await api("/api/library" + (id ? "/" + encodeURIComponent(id) : ""), {
      method: id ? "PUT" : "POST", body: JSON.stringify(body),
    });
    dialog.close();
    state.data = await api("/api/workspace");
    state.selection = saved.id;
    state.search = state.tag = state.type = "";
    history.replaceState(null, "", "/library");
    render();
    announce("已保存「" + saved.title + "」");
  } catch (error) {
    if (dialog.open) form.querySelector(".form-error").textContent = error.message;
    else announce(error.message);
  } finally {
    button.disabled = false;
  }
}

async function viewReference(id) {
  try {
    const reference = await api("/api/reference/" + encodeURIComponent(id));
    showDialog("参考解法", `<div class="tag-row"><span class="tag">时间 ${escape(reference.time)}</span><span class="tag">空间 ${escape(reference.space)}</span></div>
      <p style="margin-top:10px">${escape(reference.explanation)}</p><h3 style="margin-top:12px">JavaScript</h3><pre class="code-block"><code>${escape(reference.source)}</code></pre>`);
  } catch (error) { announce(error.message); }
}

async function viewSubmission(id) {
  try {
    const submission = await api("/api/submissions/" + encodeURIComponent(id));
    const problem = currentProblem(submission.problemId);
    showDialog("提交详情", `<p>${escape(problem?.title)} · ${escape(languageName(submission.language))}</p>
      <div class="report-panel">${renderReport(submission.report, "submit")}</div>
      <pre class="code-block"><code>${escape(submission.source)}</code></pre>
      <button class="button secondary" data-action="restore" data-id="${escape(id)}">把这次提交载入编辑器</button>`);
  } catch (error) { announce(error.message); }
}

async function restoreSubmission(id) {
  try {
    const submission = await api("/api/submissions/" + encodeURIComponent(id));
    const problem = currentProblem(submission.problemId);
    if (!problem) throw new Error("找不到对应题目。");
    saveCode(problem, submission.language, submission.source);
    languagesByProblem.set(problem.id, submission.language);
    reports.set(editorKey(problem.id, submission.language), { ...submission.report, kind: "submit" });
    dialog.close();
    if (location.pathname === problemHref(problem.id)) renderProblem(problem.id);
    else navigate(problemHref(problem.id));
    announce("已载入提交代码");
  } catch (error) { announce(error.message); }
}

async function run(kind) {
  if (judging) return;
  const { id } = route();
  const problem = currentProblem(id);
  const language = main.querySelector("#editor-language").value;
  const source = main.querySelector("#source").value;
  const key = editorKey(id, language);
  saveCode(problem, language, source);
  judging = true;
  reports.set(key, { pending: true, kind });
  renderProblem(id);
  try {
    const report = await api("/api/" + kind, {
      method: "POST", body: JSON.stringify({ problemId: id, language, source }),
    });
    reports.set(key, { ...report, kind });
    if (kind === "submit") {
      try { state.data = await api("/api/workspace"); }
      catch { announce("评测已保存，工作台数据可在刷新后查看。"); }
      if (report.checkedIn) announce(`正式评测通过，${report.date === state.data.date ? "今日" : report.date + " "}已打卡。`);
    }
  } catch (error) {
    reports.set(key, { error: error.message, kind });
  } finally {
    judging = false;
    render();
    if (route().page === "problem" && route().id === id) {
      main.querySelector("#report")?.scrollIntoView({ block: "nearest" });
    }
  }
}

function selectEntry(id, clearFilters = false) {
  state.selection = id;
  state.zoom = 1;
  history.replaceState(null, "", "/library");
  if (clearFilters || !matchingEntries().some(entry => entry.id === id)) {
    state.search = state.tag = state.type = "";
    renderLibrary();
  } else {
    renderLibraryContent();
  }
  main.querySelector(`[data-action=select-entry][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}

function shiftMonth(direction) {
  const month = state.month || state.data.date.slice(0, 7);
  const date = dateObject(month + "-01");
  date.setUTCMonth(date.getUTCMonth() + direction);
  state.month = dateString(date).slice(0, 7);
  main.querySelector("#cal-panel").innerHTML = calendar();
  main.querySelector(`[data-action="month-${direction === 1 ? "next" : "back"}"]`)?.focus();
}

document.addEventListener("click", event => {
  const link = event.target.closest("a[href^='/']");
  if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    navigate(link.pathname);
    return;
  }
  const control = event.target.closest("[data-action]");
  if (!control || control.disabled) return;
  const { action, id } = control.dataset;
  switch (action) {
    case "view":
      state.view = id;
      main.querySelectorAll("[data-action=view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.id === id)));
      renderLibraryContent();
      break;
    case "select-entry": selectEntry(id); break;
    case "select-related": selectEntry(id, true); break;
    case "zoom-out":
    case "zoom-in": {
      state.zoom = Math.min(1.2, Math.max(.7, state.zoom + (action === "zoom-in" ? .1 : -.1)));
      main.querySelector(".graph-plane").style.transform = `scale(${state.zoom})`;
      break;
    }
    case "new-entry": editEntry(); break;
    case "edit-entry": editEntry(entryById(id)); break;
    case "close-dialog": dialog.close(); break;
    case "reference": void viewReference(id); break;
    case "submission": void viewSubmission(id); break;
    case "restore": void restoreSubmission(id); break;
    case "run":
    case "submit": void run(action); break;
    case "month-back": shiftMonth(-1); break;
    case "month-next": shiftMonth(1); break;
  }
});

document.addEventListener("input", event => {
  const target = event.target;
  if (target.id === "entry-search") {
    state.search = target.value;
    renderLibraryContent();
  } else if (target.id === "source") {
    const problem = currentProblem(route().id);
    saveCode(problem, main.querySelector("#editor-language").value, target.value);
    syncLines();
  }
});

document.addEventListener("change", event => {
  const { id, value } = event.target;
  if (id === "entry-type" || id === "entry-tag") {
    state[id === "entry-type" ? "type" : "tag"] = value;
    renderLibraryContent();
  } else if (id === "graph-center") {
    selectEntry(value);
  } else if (id === "editor-language") {
    const problemId = route().id;
    languagesByProblem.set(problemId, value);
    renderProblem(problemId);
    main.querySelector("#editor-language").focus();
  } else if (id === "form-type") {
    dialog.querySelectorAll(".implementation-field").forEach(field => { field.hidden = value !== "implementation"; });
  }
});

document.addEventListener("keydown", event => {
  const target = event.target;
  if (target.id !== "source" || event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  if (target.value.length + 4 > target.maxLength) return;
  if (target.dataset.escapeTab === "true") {
    delete target.dataset.escapeTab;
    return;
  }
  event.preventDefault();
  target.setRangeText("    ", target.selectionStart, target.selectionEnd, "end");
  target.dispatchEvent(new Event("input", { bubbles: true }));
});

main.addEventListener("keydown", event => {
  if (event.target.id === "source" && event.key === "Escape") event.target.dataset.escapeTab = "true";
});

document.querySelector(".skip").addEventListener("click", event => {
  event.preventDefault();
  main.focus();
});
dialog.addEventListener("submit", event => { void persistEntry(event); });
function showRoute() {
  render();
  window.scrollTo(0, 0);
}

function navigate(path) {
  if (location.pathname !== path) history.pushState(null, "", path);
  showRoute();
}

window.addEventListener("popstate", showRoute);

async function refreshDate() {
  try {
    const latest = await api("/api/workspace");
    if (!state.data || latest.date !== state.data.date) {
      state.data = latest;
      render();
    }
  } catch (error) {
    if (!state.data) main.innerHTML = `<div class="empty">${escape(error.message)}，请刷新页面重试。</div>`;
  }
}

void refreshDate();
window.addEventListener("focus", () => { void refreshDate(); });
setInterval(refreshDate, 60_000);

function renderLearning(id) {
  if (id) {
    const lesson = lessons.find(item => item.id === id);
    if (!lesson) {
      main.innerHTML = heading("找不到这篇算法讲解", "") + '<a class="button secondary" href="/learn">返回算法学习</a>';
      return;
    }
    const call = lesson.fn.name + "(" + lesson.args.map(arg => JSON.stringify(arg)).join(", ") + ")";
    main.innerHTML = heading(escape(lesson.title), escape(lesson.aliases), '<a class="button secondary" href="/learn">全部算法</a>') +
      `<article class="panel problem-panel"><span class="tag">${escape(lesson.category)}</span>
      <h3>定义</h3><p>${escape(lesson.definition)}</p><h3>前端应用</h3><p>${escape(lesson.scene)}</p>
      <h3>算法步骤</h3><p>${escape(lesson.steps)}</p><h3>JavaScript 示例</h3>
      <pre class="code-block"><code>${escape(lesson.fn.toString())}</code></pre>
      <pre class="sample">${escape(call)}\n→ ${escape(JSON.stringify(lesson.fn(...lesson.args)))}</pre>
      <p>${escape(lesson.note)}</p><h3>复杂度</h3><p>${escape(lesson.cost)}</p></article>`;
    return;
  }
  main.innerHTML = heading("算法学习", "按算法名称、定义或前端场景查找讲解。") +
    '<section class="panel graph-panel"><div class="controls"><input class="control field-search" type="search" aria-label="搜索算法" placeholder="搜索凸包、Canvas、虚拟列表…" id="lesson-search"></div><div id="lesson-list"></div></section>';
  const search = main.querySelector("#lesson-search");
  function filter() {
    const query = search.value.trim().toLowerCase();
    const matches = lessons.filter(item => [item.title, item.aliases, item.category, item.definition, item.scene, item.steps, item.note].join(" ").toLowerCase().includes(query));
    main.querySelector("#lesson-list").innerHTML = matches.map(item =>
      `<a href="/learn/${item.id}" class="activity-row"><span><strong>${escape(item.title)}</strong><small>${escape(item.scene)}</small></span>${icon("chevron", 16)}</a>`).join("") || '<p class="empty">没有找到匹配的算法，试试其他名称或场景。</p>';
  }
  search.addEventListener("input", filter);
  filter();
}
