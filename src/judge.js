import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export class JudgeUnavailable extends Error {}

export function runJudge({ language, source, cases }) {
  return new Promise((resolve, reject) => {
    const name = "algo-judge-" + randomUUID();
    const image = process.env.JUDGE_IMAGE || "algorithm-notebook-judge:1";
    const args = [
      "run", "--rm", "--pull=never", "--name", name, "--network", "none",
      "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m,mode=1777",
      "--user", "65534:65534", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--memory", "384m", "--memory-swap", "384m", "--cpus", "1", "--pids-limit", "64",
      "--ulimit", "core=0", "-i", image,
    ];
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      const cleanup = spawn("docker", ["rm", "-f", name], { stdio: "ignore" });
      cleanup.on("error", () => {});
      child.kill("SIGKILL");
    }, 32_000);
    child.stdout.setEncoding("utf8").on("data", chunk => {
      if (stdout.length < 64_000) stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", chunk => {
      if (stderr.length < 5_000) stderr += chunk;
    });
    child.stdin.on("error", () => {});
    child.on("error", error => {
      clearTimeout(timer);
      reject(new JudgeUnavailable(error.message));
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (timedOut) return reject(new JudgeUnavailable("评测容器响应超时"));
      if (code !== 0) return reject(new JudgeUnavailable(stderr.trim() || "评测容器异常退出"));
      try {
        const result = JSON.parse(stdout);
        if (!["passed", "wrong_answer", "timeout", "compile_error", "runtime_error"].includes(result.status) || !Array.isArray(result.cases)) {
          throw new Error("invalid report");
        }
        resolve(result);
      } catch {
        reject(new JudgeUnavailable("评测容器返回了无效结果"));
      }
    });
    child.stdin.end(JSON.stringify({ language, source, cases }));
  });
}
