export const javascriptSolutions = {
  "budget-window": `function solve(nums, budget) {
  let left = 0, total = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    total += nums[right];
    while (total > budget) {
      total -= nums[left++];
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}`,
  "balanced-signal": `function solve(nums, target) {
  const counts = new Map([[0, 1]]);
  let prefix = 0, total = 0;
  for (const value of nums) {
    prefix += value;
    total += counts.get(prefix - target) ?? 0;
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return total;
}`,
  "batch-capacity": `function solve(nums, days) {
  let low = 0, high = 0;
  for (const weight of nums) {
    low = Math.max(low, weight);
    high += weight;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    let used = 1, load = 0;
    for (const weight of nums) {
      if (load + weight > mid) {
        used++;
        load = 0;
      }
      load += weight;
    }
    if (used <= days) high = mid;
    else low = mid + 1;
  }
  return low;
}`,
  "cooldown-jobs": `function solve(nums) {
  let twoBack = 0, previous = 0;
  for (const value of nums) {
    const best = Math.max(previous, twoBack + value);
    twoBack = previous;
    previous = best;
  }
  return previous;
}`,
  "next-reading": `function solve(nums) {
  const stack = [];
  let distance = 0;
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack.at(-1)] < nums[i]) {
      distance += i - stack.pop();
    }
    stack.push(i);
  }
  return distance;
}`,
  "consecutive-versions": `function solve(nums) {
  const values = new Set(nums);
  let best = 0;
  for (const value of values) {
    if (values.has(value - 1)) continue;
    let end = value + 1;
    while (values.has(end)) {
      end++;
    }
    best = Math.max(best, end - value);
  }
  return best;
}`,
  "first-stable-reading": `function solve(nums, threshold) {
  let low = 0, high = nums.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (nums[mid] < threshold) low = mid + 1;
    else high = mid;
  }
  return low < nums.length ? low : -1;
}`,
};

export const budgetSolutions = {
  javascript: javascriptSolutions["budget-window"],
  python: `def solve(nums, budget):
    left = total = best = 0
    for right, cost in enumerate(nums):
        total += cost
        while total > budget:
            total -= nums[left]
            left += 1
        best = max(best, right - left + 1)
    return best`,
  java: `class Solution {
    static long solve(long[] nums, long budget) {
        int left = 0, best = 0;
        long total = 0;
        for (int right = 0; right < nums.length; right++) {
            total += nums[right];
            while (total > budget) {
                total -= nums[left++];
            }
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}`,
};
