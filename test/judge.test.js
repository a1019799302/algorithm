import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { once } from "node:events";
import { runJudge } from "../src/judge.js";
import { findProblem } from "../src/problems.js";
import { budgetSolutions, javascriptSolutions } from "../src/reference.js";

const skip = process.env.JUDGE_INTEGRATION !== "1";

async function start(t) {
  const dir = await mkdtemp(join(tmpdir(), "algonote-test-"));
  const child = spawn(process.execPath, ["src/server.js"], {
    env: { ...process.env, DATA_PATH: join(dir, "test.sqlite"), HOST: "127.0.0.1", PORT: "0" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const stopped = once(child, "close");
  t.after(async () => {
    child.kill();
    await stopped;
    await rm(dir, { recursive: true, force: true });
  });
  const [chunk] = await once(child.stdout, "data");
  const base = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  return async (url, body, method = "POST") => {
    const response = await fetch(base + url, body ? {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    } : undefined);
    const payload = await response.json();
    assert.ok(response.ok, JSON.stringify(payload));
    return payload;
  };
}

test("Docker 在三种语言中执行正式用例", { skip, timeout: 45_000 }, async () => {
  const problem = findProblem("budget-window");
  for (const [language, source] of Object.entries(budgetSolutions)) {
    const report = await runJudge({ language, source, cases: [...problem.examples, ...problem.hidden] });
    assert.equal(report.status, "passed", JSON.stringify(report));
    assert.ok(report.cases.every(row => row.durationMs >= 0 && row.memoryKiB > 0));
  }
});

test("评测区分语法错误和超时", { skip, timeout: 15_000 }, async () => {
  const cases = findProblem("budget-window").examples.slice(0, 1);
  const invalid = await runJudge({ language: "python", source: "def solve(", cases });
  assert.equal(invalid.status, "compile_error");
  const timed = await runJudge({ language: "javascript", source: "function solve() { for (;;) {} }", cases });
  assert.equal(timed.status, "timeout");
});

test("正式评测、复杂度报告、隐藏测试和打卡贯通，知识条目可新增与更新", { skip, timeout: 45_000 }, async t => {
  const api = await start(t);
  const initial = await api("/api/workspace");
  const problemId = initial.dailyId;
  const source = javascriptSolutions[problemId];
  const body = { language: "javascript", problemId, source };
  const preview = await api("/api/run", body);
  assert.equal(preview.status, "passed");
  assert.equal((await api("/api/workspace")).checkins.length, 0);
  const wrong = await api("/api/submit", { ...body, source: "function solve() { return -100; }" });
  assert.equal(wrong.status, "wrong_answer");
  assert.equal((await api("/api/workspace")).checkins.length, 0);
  assert.deepEqual(Object.keys(wrong.cases.find(row => row.hidden)).sort(), ["hidden", "status"]);
  const [report, repeated] = await Promise.all([api("/api/submit", body), api("/api/submit", body)]);
  assert.equal(report.status, "passed");
  assert.equal(report.checkedIn, true);
  assert.equal(report.date, initial.date);
  assert.ok(report.complexity.reference.time);
  assert.equal(repeated.checkedIn, true);
  assert.equal((await api("/api/workspace")).checkins.length, 1);
  const record = await api("/api/submissions/" + report.id);
  assert.equal(record.source, source);
  const draft = { type: "implementation", title: "手写实现", language: "python", source: "def solve(nums): return 0", tags: ["记录"], related: ["window"], body: "案例说明" };
  const item = await api("/api/library", draft);
  await api("/api/library/" + item.id, { ...draft, title: "更新标题", related: ["prefix"] }, "PUT");
  const final = await api("/api/workspace");
  assert.equal(final.library.find(row => row.id === item.id).title, "更新标题");
  assert.deepEqual(final.relations.filter(({ a, b }) => a === item.id || b === item.id).map(({ a, b }) => a === item.id ? b : a), ["prefix"]);
});
