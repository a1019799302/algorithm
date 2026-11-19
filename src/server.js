import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { dateAt, findProblem, languages, problems, todayProblem, visibleProblem } from "./problems.js";
import { javascriptSolutions } from "./reference.js";
import { analyze } from "./complexity.js";
import { JudgeUnavailable, runJudge } from "./judge.js";
import { seedLibrary, types } from "./library.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const timeZone = process.env.APP_TIME_ZONE || "Asia/Shanghai";
dateAt(new Date(), timeZone);
const allowedOrigin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : null;
const dataPath = process.env.DATA_PATH || fileURLToPath(new URL("../data/algorithms.sqlite", import.meta.url));
await mkdir(dirname(dataPath), { recursive: true });
const db = new DatabaseSync(dataPath);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA busy_timeout=4000;
  CREATE TABLE IF NOT EXISTS library (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS relations (
    a TEXT REFERENCES library(id), b TEXT REFERENCES library(id), PRIMARY KEY(a, b), CHECK(a < b)
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, created_at TEXT NOT NULL, problem_id TEXT NOT NULL,
    language TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, report TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS submissions_created ON submissions(created_at DESC);
  CREATE TABLE IF NOT EXISTS checkins (
    date TEXT PRIMARY KEY, problem_id TEXT NOT NULL, submission_id TEXT NOT NULL REFERENCES submissions(id)
  );
`);
seedLibrary(db);

const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/lessons.js", ["lessons.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);
const applicationPage = /^\/(?:(?:problems|history)|(?:learn|library)(?:\/[a-z0-9-]+)?|problem\/[a-z0-9-]+)?$/;
let activeJudges = 0;
const maxJudges = 2;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function reply(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function input(request) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") {
    throw new HttpError(415, "请发送 JSON 请求。");
  }
  const pieces = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 96_000) throw new HttpError(413, "请求内容太长。");
    pieces.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(pieces).toString());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "请求内容格式有误。");
  }
}

function summary() {
  const date = dateAt(new Date(), timeZone);
  return {
    date, timeZone, dailyId: todayProblem(date).id, languages, types,
    problems: problems.map(visibleProblem),
    library: db.prepare("SELECT payload FROM library ORDER BY rowid").all().map(row => JSON.parse(row.payload)),
    relations: db.prepare("SELECT a, b FROM relations").all(),
    checkins: db.prepare("SELECT date, problem_id AS problemId FROM checkins ORDER BY date DESC").all(),
    submissions: db.prepare(`SELECT id, date, created_at AS createdAt, problem_id AS problemId, language, status
      FROM submissions ORDER BY created_at DESC`).all(),
  };
}

function saveEntry(body, id) {
  const existing = id && db.prepare("SELECT payload FROM library WHERE id = ?").get(id);
  if (id && !existing) throw new HttpError(404, "找不到该条目。");
  const previous = existing && JSON.parse(existing.payload);
  if (!Object.hasOwn(types, body.type)) throw new HttpError(400, "请选择有效的条目类型。");
  if (previous?.problemId && body.type !== "problem") throw new HttpError(400, "题库关联条目的类型需保持为练习题。");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 80) throw new HttpError(400, "标题长度应为 1–80 个字符。");
  const related = Array.isArray(body.related) ? [...new Set(body.related)] : [];
  if (related.some(n => typeof n !== "string" || n === id || !db.prepare("SELECT 1 FROM library WHERE id = ?").get(n))) {
    throw new HttpError(400, "关联条目已失效，请重新选择。");
  }
  const entry = {
    id: id || randomUUID(), title, type: body.type,
    tags: Array.isArray(body.tags) ? [...new Set(body.tags.filter(tag => typeof tag === "string").map(tag => tag.trim().slice(0, 28)).filter(Boolean))].slice(0, 15) : [],
    body: typeof body.body === "string" ? body.body.trim().slice(0, 12_000) : "",
  };
  if (previous?.problemId) entry.problemId = previous.problemId;
  if (entry.type === "implementation") {
    if (!Object.hasOwn(languages, body.language)) throw new HttpError(400, "请选择代码实现的语言。");
    entry.language = body.language;
    entry.source = typeof body.source === "string" ? body.source.slice(0, 20_000) : "";
  }
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO library(id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload").run(entry.id, JSON.stringify(entry));
    db.prepare("DELETE FROM relations WHERE a = ? OR b = ?").run(entry.id, entry.id);
    const link = db.prepare("INSERT INTO relations(a, b) VALUES (?, ?)");
    for (const other of related) link.run(...[entry.id, other].sort());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return entry;
}

const max = (rows, key) => {
  const values = rows.map(row => row[key]).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
};

async function evaluate(body, submit) {
  const problem = findProblem(body.problemId);
  if (!problem) throw new HttpError(404, "找不到该题目。");
  const { language, source } = body;
  if (!Object.hasOwn(languages, language)) throw new HttpError(400, "请选择支持的语言。");
  if (typeof source !== "string" || !source.trim() || source.length > 20_000) {
    throw new HttpError(400, "请输入 1–20,000 个字符的代码。");
  }
  if (activeJudges >= maxJudges) throw new HttpError(429, "评测正在运行，请稍后再试。");
  const requestedAt = new Date();
  const date = dateAt(requestedAt, timeZone);
  const cases = submit ? [...problem.examples, ...problem.hidden] : problem.examples;
  let result;
  activeJudges++;
  try {
    result = await runJudge({ language, source, cases });
  } finally {
    activeJudges--;
  }
  const report = {
    status: result.status,
    message: result.message,
    total: cases.length,
    passed: result.cases.filter(row => row.status === "passed").length,
    durationMs: max(result.cases, "durationMs"),
    memoryKiB: max(result.cases, "memoryKiB"),
    cases: result.cases.map((row, index) => {
      if (index >= problem.examples.length) return { status: row.status, hidden: true };
      return { ...row, expected: cases[index].expected, args: cases[index].args };
    }),
  };
  if (!submit) return report;
  const id = randomUUID();
  report.date = date;
  report.complexity = ["compile_error", "runtime_error"].includes(report.status) ? null
    : analyze(source, language, problem.reference, problem.id);
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO submissions VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, date, requestedAt.toISOString(), problem.id, language, source, report.status, JSON.stringify(report),
    );
    if (report.status === "passed" && problem.id === todayProblem(date).id) {
      report.checkedIn = true;
      db.prepare("INSERT OR IGNORE INTO checkins VALUES (?, ?, ?)").run(date, problem.id, id);
      db.prepare("UPDATE submissions SET report = ? WHERE id = ?").run(JSON.stringify(report), id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ...report, id };
}

const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const origin = request.headers.origin;
    const requestHost = request.headers.host;
    const listeningPort = server.address().port;
    const localHost = ["127.0.0.1", "localhost", "[::1]"].some(loopback =>
      requestHost === loopback + ":" + listeningPort || (listeningPort === 80 && requestHost === loopback));
    if (!localHost && (!allowedOrigin || new URL(allowedOrigin).host !== requestHost)) {
      throw new HttpError(403, "访问地址未配置。");
    }
    const method = request.method;
    if (method !== "GET" && (request.headers["sec-fetch-site"] === "cross-site" || (origin && origin !== allowedOrigin && origin !== "http://" + requestHost))) {
      throw new HttpError(403, "请从工作台打开此页面。");
    }
    const { pathname } = new URL(request.url, "http://localhost");
    const asset = assets.get(pathname) || (applicationPage.test(pathname) ? assets.get("/") : null);
    if (method === "GET" && asset) {
      const [file, type] = asset;
      const content = await readFile(new URL("../public/" + file, import.meta.url));
      response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      return response.end(content);
    }
    if (method === "GET" && pathname === "/api/workspace") return reply(response, 200, summary());
    if (method === "GET" && pathname.startsWith("/api/reference/")) {
      const problem = findProblem(pathname.split("/").at(-1));
      if (!problem) throw new HttpError(404, "找不到参考解法。");
      return reply(response, 200, { ...problem.reference, source: javascriptSolutions[problem.id] });
    }
    if (method === "GET" && pathname.startsWith("/api/submissions/")) {
      const id = pathname.split("/").at(-1);
      const row = db.prepare("SELECT source, report, language, date, problem_id AS problemId FROM submissions WHERE id = ?").get(id);
      if (!row) throw new HttpError(404, "找不到该提交。");
      return reply(response, 200, { ...row, report: { ...JSON.parse(row.report), id, date: row.date } });
    }
    if (method === "POST" && pathname === "/api/library") return reply(response, 201, saveEntry(await input(request)));
    if (method === "PUT" && pathname.startsWith("/api/library/")) {
      return reply(response, 200, saveEntry(await input(request), pathname.split("/").at(-1)));
    }
    if (method === "POST" && ["/api/run", "/api/submit"].includes(pathname)) {
      return reply(response, 200, await evaluate(await input(request), pathname === "/api/submit"));
    }
    throw new HttpError(404, "找不到该页面。");
  } catch (error) {
    if (error instanceof HttpError) return reply(response, error.status, { error: error.message });
    if (error instanceof JudgeUnavailable) {
      console.error("[judge]", error.message);
      return reply(response, 503, { error: "评测环境不可用。请确认 Docker 已启动，并运行 npm run judge:build。" });
    }
    console.error(error);
    if (!response.headersSent) reply(response, 500, { error: "服务暂时无法处理请求。" });
  }
});

server.on("error", error => {
  console.error("无法启动算法手记", error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`算法手记 · http://${host}:${server.address().port}`));
