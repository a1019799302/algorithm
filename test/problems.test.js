import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { analyze } from "../src/complexity.js";
import { dateAt, todayProblem, problems, visibleProblem } from "../src/problems.js";
import { budgetSolutions, javascriptSolutions } from "../src/reference.js";

test("每日题按上海自然日固定轮换，跨月和轮回顺序保持一致", () => {
  assert.equal(dateAt(new Date("2026-11-17T15:59:59Z"), "Asia/Shanghai"), "2026-11-17");
  assert.equal(dateAt(new Date("2026-11-17T16:00:00Z"), "Asia/Shanghai"), "2026-11-18");
  assert.equal(todayProblem("2026-11-18"), problems[0]);
  assert.equal(todayProblem("2026-11-19"), problems[1]);
  assert.equal(todayProblem("2026-11-25"), problems[0]);
  assert.equal(todayProblem("2026-11-17"), problems.at(-1));
});

test("参考解能通过所有题目的公开及隐藏用例，题面未包含隐藏用例", () => {
  for (const problem of problems) {
    const solve = runInNewContext(javascriptSolutions[problem.id] + "\nsolve");
    for (const example of [...problem.examples, ...problem.hidden]) {
      assert.equal(solve(...example.args), example.expected, problem.id);
    }
    const visible = visibleProblem(problem);
    assert.equal(visible.hidden, undefined);
    assert.equal(visible.reference, undefined);
    assert.ok(visible.starters.java.includes("static long solve"));
  }
});

test("复杂度分析支持三种语言的单调窗口，并对递归保留判断", () => {
  const problem = problems[0];
  for (const [language, source] of Object.entries(budgetSolutions)) {
    const report = analyze(source.replaceAll("left", "begin"), language, problem.reference, problem.id);
    assert.equal(report.time, "O(n)", language);
    assert.equal(report.space, "O(1)", language);
    assert.equal(report.comparison.time, "与参考同阶");
  }
  const unknown = analyze("def solve(nums, budget):\n    return solve(nums[1:], budget)", "python", problem.reference, problem.id);
  assert.equal(unknown.time, null);
  assert.equal(unknown.space, null);
});

test("首批参考解的常见算法模式产出与参考同阶的复杂度", () => {
  for (const problem of problems) {
    const report = analyze(javascriptSolutions[problem.id], "javascript", problem.reference, problem.id);
    assert.equal(report.time, problem.reference.time, problem.id);
    assert.equal(report.space, problem.reference.space, problem.id);
  }
});
