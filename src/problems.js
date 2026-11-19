export const languages = {
  javascript: { name: "JavaScript", extension: "js" },
  python: { name: "Python", extension: "py" },
  java: { name: "Java", extension: "java" },
};

function test(nums, expected, k) {
  return { args: k === undefined ? [nums] : [nums, k], expected };
}

export const problems = [
  {
    id: "budget-window", title: "连续预算", difficulty: "简单", algorithm: "window", parameter: "budget",
    description: "一组连续时段的请求会产生不同的成本。给定每个时段的非负成本 nums 和总预算 budget，找出总成本不超过预算的最长连续时段，返回它包含的时段数。如果任何单个时段都超出预算，返回 0。",
    constraints: ["0 ≤ nums.length ≤ 100,000", "0 ≤ nums[i] ≤ 10,000", "0 ≤ budget ≤ 10⁹"],
    examples: [test([2, 1, 3, 2, 1], 3, 6), test([4, 5], 0, 3)],
    hidden: [test([], 0, 0), test([0, 0, 1, 0], 2, 0), test([3, 0, 0, 1, 1, 3], 4, 2), test(Array(10_000).fill(1), 253, 253)],
    reference: { time: "O(n)", space: "O(1)", explanation: "用左右指针维护区间和。超出预算时向右移动左指针，两个指针各自最多移动 n 次。只需要记录指针、区间和与最大长度。" },
  },
  {
    id: "balanced-signal", title: "目标读数区间", difficulty: "中等", algorithm: "prefix", parameter: "target",
    description: "nums 是连续采样的读数变化量，可能为负数。计算有多少个非空连续区间的变化量之和恰好等于 target。区间按起止下标区分。",
    constraints: ["0 ≤ nums.length ≤ 100,000", "−10,000 ≤ nums[i] ≤ 10,000", "−10⁹ ≤ target ≤ 10⁹"],
    examples: [test([1, -1, 1], 3, 1), test([2, 0, 2], 4, 2)],
    hidden: [test([], 0, 0), test([0, 0, 0], 6, 0), test([-2, 3, -1, -2], 3, -2), test(Array(70_000).fill(0), 2450035000, 0)],
    reference: { time: "O(n)", space: "O(n)", explanation: "从左到右统计前缀和出现的次数。遇到前缀和 s 时，答案增加此前 s − target 的出现次数。哈希表平均查询和更新为常数时间，最多保存 n + 1 个前缀和。" },
  },
  {
    id: "batch-capacity", title: "最小处理容量", difficulty: "中等", algorithm: "binary", parameter: "days",
    description: "工作队列中每项任务都有一个正整数工作量。每天只能按原顺序处理连续的若干任务，且任务不能拆开。求能在 days 天内完成所有任务的最小单日容量。",
    constraints: ["1 ≤ nums.length ≤ 100,000", "1 ≤ nums[i] ≤ 10,000", "1 ≤ days ≤ nums.length"],
    examples: [test([4, 2, 3, 5], 8, 2), test([2, 8, 3], 8, 3)],
    hidden: [test([9], 9, 1), test([1, 2, 3], 6, 1), test([7, 1, 6, 2, 8], 8, 3), test(Array(10_000).fill(10_000), 10_000_000, 10)],
    reference: { time: "O(n log(S + 1))", space: "O(1)", explanation: "在最大单项工作量到总工作量 S 之间二分容量。每次贪心地按顺序装满当天任务，用一次遍历判断天数是否足够。" },
  },
  {
    id: "cooldown-jobs", title: "冷却后的任务", difficulty: "简单", algorithm: "dp",
    description: "每个时段各有一项可选任务，nums[i] 表示收益。执行某项任务后，下一个时段必须休息。你可以跳过任意任务，求最大总收益。",
    constraints: ["0 ≤ nums.length ≤ 100,000", "−10,000 ≤ nums[i] ≤ 10,000"],
    examples: [test([4, 7, 2, 9], 16), test([-1, -2], 0)],
    hidden: [test([], 0), test([9], 9), test([9, 10, 9], 18), test(Array(20_000).fill(5), 50_000)],
    reference: { time: "O(n)", space: "O(1)", explanation: "处理当前位置时，取跳过当前任务和接下当前任务两个选项的较大值。接下任务需加上前两个时段的最优收益，因此只保留两项状态即可。" },
  },
  {
    id: "next-reading", title: "更高的读数", difficulty: "中等", algorithm: "stack",
    description: "对每个读数，找出它右侧第一个严格更高的读数。若找到，记下两个位置的下标差，否则记为 0。返回所有下标差的总和。",
    constraints: ["0 ≤ nums.length ≤ 100,000", "−10,000 ≤ nums[i] ≤ 10,000"],
    examples: [test([4, 2, 2, 5], 6), test([3, 3, 1], 0)],
    hidden: [test([], 0), test([-3, -2, -1], 2), test([3, 1, 4, 2, 5], 6), test([...Array(20_000).fill(1), 2], 200010000)],
    reference: { time: "O(n)", space: "O(n)", explanation: "用单调栈保存仍在等候更高读数的下标。遇到更高读数时逐个弹出并累加距离。每个下标最多进栈和出栈各一次。" },
  },
  {
    id: "consecutive-versions", title: "连续版本号", difficulty: "中等", algorithm: "hash",
    description: "日志里的版本号可能重复，也可能乱序。求最长连续整数段的长度。连续整数段里的每个整数都必须在 nums 中出现。",
    constraints: ["0 ≤ nums.length ≤ 100,000", "−10⁹ ≤ nums[i] ≤ 10⁹"],
    examples: [test([8, 4, 2, 3, 4, 9], 3), test([-2, 0, -1, 1], 4)],
    hidden: [test([], 0), test([7, 7, 7], 1), test([0, 2, 5, 6], 2), test(Array.from({ length: 15_000 }, (_, i) => 15_000 - i), 15_000)],
    reference: { time: "O(n)", space: "O(n)", explanation: "把版本号放入哈希集合。只从前一个整数不存在的版本号开始向后扩展，避免重复遍历同一段。集合平均查找为常数时间。" },
  },
  {
    id: "first-stable-reading", title: "首个稳定读数", difficulty: "简单", algorithm: "binary", parameter: "threshold",
    description: "nums 是一组按非降序排列的读数。返回第一个大于或等于 threshold 的读数下标，下标从 0 开始。如果所有读数都小于 threshold，返回 −1。",
    constraints: ["0 ≤ nums.length ≤ 100,000", "−10⁹ ≤ nums[i], threshold ≤ 10⁹"],
    examples: [test([1, 3, 3, 8], 1, 3), test([1, 2], -1, 5)],
    hidden: [test([], -1, 0), test([2, 2, 2], 0, 2), test([-4, -1, 2], 0, -5), test(Array.from({ length: 20_000 }, (_, i) => i), 12_345, 12_345)],
    reference: { time: "O(log(n + 1))", space: "O(1)", explanation: "二分查找第一个满足条件的下标。当前读数达标时保留左半区间，否则排除中点和其左侧，每次缩小约一半。" },
  },
];

const byId = new Map(problems.map(problem => [problem.id, problem]));
export const findProblem = id => byId.get(id);

export function visibleProblem({ hidden, reference, ...problem }) {
  return { ...problem, starters: starters(problem) };
}

function starters(problem) {
  const arg = problem.parameter;
  return {
    javascript: `function solve(nums${arg ? `, ${arg}` : ""}) {
  // 在这里实现解法
  return 0;
}
`,
    python: `def solve(nums${arg ? `, ${arg}` : ""}):
    # 在这里实现解法
    return 0
`,
    java: `class Solution {
    static long solve(long[] nums${arg ? `, long ${arg}` : ""}) {
        // 在这里实现解法
        return 0;
    }
}
`,
  };
}

export function dateAt(now, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function todayProblem(date, bank = problems) {
  const day = Date.parse(date + "T00:00:00Z") / 86_400_000;
  const first = Date.parse("2026-11-18T00:00:00Z") / 86_400_000;
  return bank[((day - first) % bank.length + bank.length) % bank.length];
}
