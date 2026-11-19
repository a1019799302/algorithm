import { problems } from "./problems.js";
import { budgetSolutions } from "./reference.js";

export const types = {
  algorithm: "算法",
  case: "开发案例",
  problem: "练习题",
  implementation: "代码实现",
};

const algorithms = [
  ["window", "滑动窗口", ["数组", "双指针"], "用两个下标维护连续区间，在加入新元素或移除旧元素时增量更新区间状态。适合可以通过单向移动边界恢复约束的连续区间问题。"],
  ["prefix", "前缀和", ["数组", "哈希表"], "前缀和把连续区间的累计值转换成两个前缀值的差。区间查询可用预处理数组；统计目标和的区间时，可以维护前缀和的出现次数。"],
  ["binary", "二分查找", ["搜索", "有序性"], "在有序数据或单调的可行性条件下，根据中点结果排除一半候选区间。先写清查找下界、上界还是某个值，再确定区间端点的约定。"],
  ["dp", "动态规划", ["状态转移", "数组"], "用子问题的结果推导当前最优解。明确状态含义、初始值和计算顺序，再考虑是否能把历史状态压缩到几个变量。"],
  ["stack", "单调栈", ["栈", "数组"], "按单调顺序保存待处理元素。遇到打破顺序的新元素时，依次弹出并结算旧元素。常用于找左右最近的更大或更小元素。"],
  ["hash", "哈希集合", ["哈希表", "去重"], "只关注元素是否出现时，用集合去重和查找。平均查询成本为常数，适合处理重复日志和建立候选值索引。"],
];

const library = [
  ...algorithms.map(([id, title, tags, body]) => ({ id, title, tags, body, type: "algorithm" })),
  { id: "request-cost", type: "case", title: "请求成本的滚动统计", tags: ["监控", "双指针"], body: "监控面板收到按时间排序的请求成本。右边界跟随新日志，左边界丢弃超出预算的旧时段。只更新离开和加入窗口的成本，避免每次重新汇总。" },
  { id: "release-log", type: "case", title: "发布日志的下界查询", tags: ["搜索", "有序性"], body: "按发布时间排列的发布日志里，经常需要定位某个时刻之后的第一条记录。用二分查找下界，先定位起始下标，再读取后续记录。" },
  ...problems.map(problem => ({
    id: "problem-" + problem.id, type: "problem", title: problem.title,
    tags: [problem.difficulty], body: problem.description, problemId: problem.id,
  })),
  ...Object.entries(budgetSolutions).map(([language, source]) => ({
    id: "window-" + language, title: "滑动窗口 · " + ({ javascript: "JavaScript", python: "Python", java: "Java" })[language],
    type: "implementation", tags: ["双指针"], body: "连续预算的参考实现。窗口超过预算时收缩左边界，期间维护区间和与最长长度。", language, source,
  })),
];

const relations = [
  ["window", "prefix"], ["window", "request-cost"], ["prefix", "hash"], ["binary", "release-log"],
  ...problems.map(problem => [problem.algorithm, "problem-" + problem.id]),
  ...Object.keys(budgetSolutions).flatMap(language => [
    ["window", "window-" + language],
    ["problem-budget-window", "window-" + language],
  ]),
];

export function seedLibrary(db) {
  const seed = db.prepare("INSERT INTO library(id, payload) VALUES (?, ?)");
  const link = db.prepare("INSERT INTO relations(a, b) VALUES (?, ?)");
  db.exec("BEGIN");
  try {
    if (!db.prepare("SELECT id FROM library LIMIT 1").get()) {
      for (const item of library) seed.run(item.id, JSON.stringify(item));
      for (const pair of relations) link.run(...pair.sort());
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
