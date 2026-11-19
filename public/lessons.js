// The lesson and its example share the same implementation.
function convexHull(points) {
  const sorted = [...points].sort(([x, y], [u, v]) => x - u || y - v);
  const unique = sorted.filter(([x, y], i) =>
    i === 0 || x !== sorted[i - 1][0] || y !== sorted[i - 1][1]);
  if (unique.length < 3) return unique;

  function half(sequence) {
    const chain = [];
    for (const p of sequence) {
      while (chain.length >= 2) {
        const [a, b] = chain.slice(-2);
        const cross = (b[0] - a[0]) * (p[1] - a[1])
          - (b[1] - a[1]) * (p[0] - a[0]);
        if (cross > 0) break;
        chain.pop();
      }
      chain.push(p);
    }
    return chain.slice(0, -1);
  }
  return [...half(unique), ...half([...unique].reverse())];
}

function lowerBound(offsets, scrollTop) {
  let low = 0, high = offsets.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] < scrollTop) low = mid + 1;
    else high = mid;
  }
  return low;
}

function mergeRanges(ranges) {
  const result = [];
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}

function breadcrumbs(tree, target) {
  const path = [];
  function visit(node) {
    path.push(node.name);
    if (node.name === target || (node.children || []).some(visit)) return true;
    path.pop();
    return false;
  }
  return visit(tree) ? path : [];
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function visibleWindow(times, now, duration) {
  // times 已按时间升序排列，且都在 now 或之前。
  let start = 0;
  while (start < times.length && times[start] < now - duration) start++;
  return times.slice(start);
}

export const lessons = [
  { id: "convex-hull", title: "凸包算法", aliases: "Convex Hull Andrew 单调链", category: "计算几何", definition: "包含给定点集的最小凸集称为凸包。对平面上不共线的有限点集，它的边界是由最外层顶点组成的凸多边形。", scene: "Canvas 画布多选图形时，可以收集所有选中图形的角点，画出包住它们的紧凑凸轮廓。", steps: "按横坐标、纵坐标排序并去重。从左到右建立一条边界链，再反向建立另一条。每加入一点，用叉积检查末尾转向，弹出使边界向内弯折或共线的中间点。拼接时各去掉一个重复端点。", note: "示例中的 [1,1] 位于内部。返回值只含外圈顶点，绘制时连接首尾即可。全部共线时只保留两端。", cost: "时间 O(n log n)，额外空间 O(n)", fn: convexHull, args: [[[0,0],[2,0],[1,1],[2,2],[0,2],[0,0]]] },
  { id: "binary-search", title: "二分查找", aliases: "Binary Search lower bound", category: "列表渲染", definition: "在有序序列中比较中点，每次排除约一半候选位置。下界查找返回第一个大于或等于目标值的位置。", scene: "虚拟列表已缓存每行顶部的位置。滚动后，快速找到顶部位于视口起点或其下方的第一行。", steps: "维护左闭右开区间。中点偏小时移动左端，否则收紧右端。两端相遇即得到插入位置。", note: "滚动到 55 像素时，下一行顶部是 72 像素，下标为 3。", cost: "时间 O(log n)，额外空间 O(1)", fn: lowerBound, args: [[0,24,48,72,96],55] },
  { id: "merge-ranges", title: "区间合并", aliases: "Merge Intervals", category: "媒体播放", definition: "把相交或相接的区间合并，使结果覆盖相同范围，并且各段彼此分离。", scene: "播放器进度条将多个缓冲片段绘制成连续色带。", steps: "按起点排序。下一段起点仍在当前段内时延长终点，否则新增一段。", note: "第 1 秒到第 5 秒与第 4 秒到第 8 秒相交，渲染时可以合成一段。", cost: "时间 O(n log n)，额外空间 O(n)", fn: mergeRanges, args: [[[4,8],[10,12],[1,5]]] },
  { id: "tree-search", title: "深度优先搜索", aliases: "DFS Depth First Search 树遍历", category: "导航菜单", definition: "沿当前分支一直访问子节点，再回溯到最近一个仍有未访问分支的节点。", scene: "从树形导航中找到当前页面，生成从根菜单到页面的面包屑。", steps: "进入节点时把名称加入路径。找到目标立即返回，整棵子树都没找到时弹出节点再探索兄弟分支。", note: "示例使用唯一的菜单名称定位节点。有重名页面时可以改为匹配路由 ID。", cost: "时间 O(n)，额外空间 O(h)，h 为树高", fn: breadcrumbs, args: [{name:"首页",children:[{name:"工作台"},{name:"设置",children:[{name:"主题"}]}]},"主题"] },
  { id: "deduplicate", title: "哈希去重", aliases: "Set Hash Deduplication", category: "数据处理", definition: "用集合记录已出现的键，并按首次出现的顺序保留记录。", scene: "无限滚动列表合并分页响应时，相邻两页可能返回同一条内容。", steps: "逐条读取 ID。首次遇到就加入集合并保留记录，再次遇到则跳过。", note: "两次出现 ID 7 时，列表保留第一次取得的记录。", cost: "平均时间 O(n)，额外空间 O(n)", fn: uniqueById, args: [[{id:7},{id:3},{id:7}]] },
  { id: "time-window", title: "滑动时间窗口", aliases: "Sliding Window", category: "性能监控", definition: "让窗口边界随时间向前移动，只保留当前时间范围内的事件。", scene: "性能面板统计最近几秒内触发的交互事件。", steps: "用当前时刻减去窗口宽度得到下界。跳过早于下界的事件，返回余下的有序事件。流式更新时可以保留左指针接着移动。", note: "当前时刻为 10，窗口宽度为 4。边界 6 上的事件也计入结果。", cost: "本次查询时间 O(n)，返回数组最多占 O(n) 空间", fn: visibleWindow, args: [[1,3,6,8,10],10,4] },
];
