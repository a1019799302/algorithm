function stripIgnored(source, language) {
  const pattern = language === "python"
    ? /("""[\s\S]*?"""|'''[\s\S]*?'''|(['"])(?:\\.|(?!\2)[^\\\n])*\2|#[^\n]*)/g
    : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|(['"`])(?:\\[\s\S]|(?!\2)[^\\])*?\2)/g;
  return source.replace(pattern, fragment => fragment.replace(/[^\n]/g, " "));
}

function scanLoops(code, language) {
  const loops = [];
  if (language === "python") {
    const stack = [];
    for (const line of code.split("\n")) {
      if (!line.trim()) continue;
      const depth = line.match(/^\s*/)[0].replaceAll("\t", "        ").length;
      while (stack.length && depth <= stack.at(-1)) stack.pop();
      if (/^\s*(?:for|while)\s/.test(line)) {
        loops.push({ level: stack.length, header: line.trim() });
        stack.push(depth);
      }
    }
  } else {
    let depth = 0;
    const stack = [];
    for (const item of code.matchAll(/\b(?:for|while)\s*\(|[{}]/g)) {
      if (item[0] === "{") depth++;
      else if (item[0] === "}") depth--;
      else {
        while (stack.length && stack.at(-1) >= depth) stack.pop();
        const start = item.index + item[0].length;
        let end = start;
        let parens = 1;
        for (; end < code.length && parens; end++) {
          if (code[end] === "(") parens++;
          if (code[end] === ")") parens--;
        }
        loops.push({ level: stack.length, header: code.slice(item.index, end) });
        if (code.slice(end).trimStart().startsWith("{")) stack.push(depth);
      }
    }
  }
  return loops;
}

export function analyze(source, language, reference, problemId) {
  const code = stripIgnored(source, language);
  const loops = scanLoops(code, language);
  const nested = loops.some(loop => loop.level > 0);
  const ordered = /\.sort\s*\(|\bsorted\s*\(|\b(?:Arrays|Collections)\.sort\s*\(/.test(code);
  const halfway = /(?:\/\/|\/)\s*2\b|>>\s*1\b/.test(code);
  const collection = /\bnew\s+(?:Map|Set|HashMap|HashSet|ArrayList|ArrayDeque|TreeMap|TreeSet)\b|\b(?:dict|set|list|deque)\s*\(|\[.*\bfor\b|\.slice\s*\(|\.map\s*\(|\.filter\s*\(|\.append\s*\(|\.push\s*\(|\.copyOf\s*\(|\bnew\s+\w+\s*\[[^\d\]\s]|=\s*\{\s*\}/.test(code);
  const scanningCall = /\.includes\s*\(|\.indexOf\s*\(|\bsum\s*\(|\.shift\s*\(|\bif\s+[^\n]+\bin\s+nums\b/.test(code);
  const recursion = (code.match(/\bsolve\s*\(/g) || []).length > 1;
  const helper = (code.match(/\bfunction\s+\w+\s*\(|\bdef\s+\w+\s*\(|\b(?:int|long|void|boolean)\s+\w+\s*\([^{};]*\)\s*\{/g) || []).length > 1;
  const simpleWalk = loops.length && loops.every(({ header }) => /^for\b/.test(header));
  const sliding = [...code.matchAll(/-=\s*nums\s*\[\s*([\w$]+)\s*(\+\+)?\s*\]/g)].some(([, pointer, inline]) => {
    const escaped = pointer.replaceAll("$", "\\$");
    return inline || new RegExp(`(?:^|[^\\w$])${escaped}\\s*(?:\\+\\+|\\+=\\s*1\\b|=\\s*${escaped}\\s*\\+\\s*1\\b)`).test(code);
  });
  let time = null;
  let space = null;
  const reasons = [];

  if (recursion || helper) {
    reasons.push("检测到递归或辅助函数，暂时无法可靠推导调用次数及栈深度。");
  } else if (problemId === "budget-window" && nested && sliding && !ordered && !scanningCall) {
    time = "O(n)";
    reasons.push("检测到外层遍历和内层单向递增的左边界。如果左边界不重置，两层循环的总步数与 n 成正比。");
  } else if (problemId === "next-reading" && nested && /\.pop\s*\(/.test(code) && /\.(?:push|append)\s*\(/.test(code)) {
    time = "O(n)";
    reasons.push("检测到入栈与出栈操作。如果每个下标各进出栈至多一次，内层循环可按均摊线性计算。");
  } else if (problemId === "batch-capacity" && nested && halfway && !ordered) {
    time = "O(n log(S + 1))";
    reasons.push("检测到折半更新与嵌套遍历。如果外层在容量区间二分，每轮扫描 n 项，S 为总工作量。");
  } else if (problemId === "first-stable-reading" && loops.length === 1 && halfway && !ordered) {
    time = "O(log(n + 1))";
    reasons.push("检测到单个循环和折半表达式。如果每轮都缩小约一半的搜索区间，循环次数为对数级。");
  } else if (problemId === "consecutive-versions" && nested && /\.has\s*\(|\bin\s+\w+\s*:|\.contains\s*\(/.test(code) && /continue\b/.test(code)) {
    time = "O(n)";
    reasons.push("检测到集合查询与跳过分支。如果只从每个连续段的开头扩展，散列表下的总遍历成本平均为线性。");
  } else if (ordered && !nested && !scanningCall && (!loops.length || simpleWalk)) {
    time = "O(n log n)";
    reasons.push("检测到排序调用。假设对 n 个元素使用常见比较排序，且只执行固定次数，排序成本主导。");
  } else if (simpleWalk && !nested && !scanningCall && !/\.stream\s*\(|\.(?:map|filter|reduce)\s*\(/.test(code)) {
    time = "O(n)";
    reasons.push("检测到非嵌套的 for 遍历。如果每轮操作为常数且每轮遍历至多 n 个元素，总时间为线性。");
  } else if (nested && simpleWalk && !ordered && !scanningCall) {
    const depth = 1 + Math.max(...loops.map(loop => loop.level));
    time = depth === 2 ? "O(n²)" : `O(n^${depth})`;
    reasons.push("检测到嵌套 for 循环。如果每层都由 n 约束且循环体为常数操作，循环成本按层相乘。");
  } else if (!loops.length && /^\s*(?:function\s+solve|def\s+solve|class\s+Solution)/.test(code) && /\breturn\s+-?\d+\s*;?\s*\}*\s*\}?\s*$/.test(code) && !ordered && !scanningCall && !collection) {
    reasons.push("只有常量返回值特征，缺少足够依据判断完整实现的复杂度。");
  } else {
    reasons.push("循环次数或库调用成本取决于代码行为，目前无法可靠估计时间复杂度。");
  }

  if (!recursion && !helper && collection && !/\bnew\s+(?:TreeMap|TreeSet)\b/.test(code)) {
    space = "O(n)";
    reasons.push("检测到可增长的集合或数组操作。以这些结构合计最多保留与 n 成正比的数据为假设。");
  } else if (!recursion && !helper && time && !ordered && !scanningCall && !/=\s*[\[{]|\bnew\s|\.split\s*\(|\.concat\s*\(/.test(code)) {
    space = "O(1)";
    reasons.push("未检测到随输入规模增长的显式容器，按固定数量的局部状态估算额外空间。");
  }
  if (!space) reasons.push("额外空间暂无法可靠估计，特别是库调用、复制或调用栈的开销。");
  return {
    time, space, reasons, reference,
    comparison: {
      time: time ? (time === reference.time ? "与参考同阶" : "与参考不同") : "待确认",
      space: space ? (space === reference.space ? "与参考同阶" : "与参考不同") : "待确认",
    },
  };
}
