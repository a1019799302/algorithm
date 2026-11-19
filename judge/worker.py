import json
import os
import resource
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

MARKER = "RESULT>"
LIMIT = 48 * 1024

JS = """
(() => {
    const fs = require("node:fs");
    const input = JSON.parse(fs.readFileSync(0, "utf8"));
    const result = solve(...input);
    if (!Number.isSafeInteger(result)) throw new Error("solve 必须返回一个安全整数");
    process.stdout.write("\\nRESULT>" + result + "\\n");
})();
"""

PY = """
def _run_algorithm_notebook():
    import json, sys
    result = solve(*json.loads(sys.stdin.read()))
    if type(result) is not int:
        raise TypeError("solve 必须返回整数")
    print("\\nRESULT>" + str(result))

_run_algorithm_notebook()
"""

JAVA = """
import java.io.BufferedReader;
import java.io.InputStreamReader;

class JudgeMain {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        String[] parts = line.isEmpty() ? new String[0] : line.split(" ");
        long[] nums = new long[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Long.parseLong(parts[i]);
        long result = Solution.solve(nums%s);
        System.out.println("\\nRESULT>" + result);
    }
}
"""

def limit_output():
    resource.setrlimit(resource.RLIMIT_FSIZE, (LIMIT, LIMIT))

def run(command, data="", timeout=2):
    started = time.monotonic()
    with tempfile.TemporaryFile() as stdin, open("stdout.txt", "wb") as stdout, open("stderr.txt", "wb") as stderr:
        stdin.write(data.encode())
        stdin.seek(0)
        with subprocess.Popen(
            command, stdin=stdin, stdout=stdout, stderr=stderr,
            preexec_fn=limit_output, start_new_session=True,
        ) as process:
            while True:
                pid, status, usage = os.wait4(process.pid, os.WNOHANG)
                if pid:
                    process.returncode = os.waitstatus_to_exitcode(status)
                    break
                if time.monotonic() - started >= timeout:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                    return "timeout", "", "", {}
                time.sleep(0.003)
    output = Path("stdout.txt").read_text(errors="replace")
    errors = Path("stderr.txt").read_text(errors="replace")
    metrics = {"durationMs": round((time.monotonic() - started) * 1000), "memoryKiB": usage.ru_maxrss}
    return ("ok" if process.returncode == 0 else "error"), output, errors, metrics

def prepare(language, source, has_parameter):
    if language == "javascript":
        Path("solution.cjs").write_text(source + "\n;\n" + JS)
        checked, _, errors, _ = run(["node", "--check", "solution.cjs"])
        return ["node", "--max-old-space-size=128", "solution.cjs"], checked, errors
    if language == "python":
        Path("solution.py").write_text(source + "\n\n" + PY)
        checked, _, errors, _ = run(["python3", "-Im", "py_compile", "solution.py"])
        return ["python3", "-I", "solution.py"], checked, errors

    Path("Solution.java").write_text(source)
    extra = ", Long.parseLong(reader.readLine())" if has_parameter else ""
    Path("JudgeMain.java").write_text(JAVA % extra)
    checked, _, errors, _ = run(
        ["javac", "-J-Xmx160m", "-J-XX:ActiveProcessorCount=1", "Solution.java", "JudgeMain.java"],
        timeout=8,
    )
    return ["java", "-Xmx128m", "-XX:ActiveProcessorCount=1", "JudgeMain"], checked, errors

def evaluate(payload):
    language = payload["language"]
    cases = payload["cases"]
    command, status, errors = prepare(language, payload["source"], len(cases[0]["args"]) == 2)
    if status != "ok":
        return {"status": "compile_error", "message": "编译超时" if status == "timeout" else errors[:3000], "cases": []}
    results = []
    for case in cases:
        args = case["args"]
        if language == "java":
            data = " ".join(map(str, args[0])) + "\n"
            if len(args) == 2:
                data += str(args[1]) + "\n"
        else:
            data = json.dumps(args)
        status, stdout, stderr, metrics = run(command, data)
        row = {"status": status}
        if status == "ok":
            output = stdout.rpartition("\n" + MARKER)[2].strip()
            try:
                actual = int(output)
            except ValueError:
                actual = None
            row.update(status="passed" if actual == case["expected"] else "wrong_answer", actual=actual, **metrics)
        elif status == "error":
            row.update(status="runtime_error", message=stderr[:1500])
        results.append(row)

    failed = next((row for row in results if row["status"] != "passed"), None)
    return {"status": failed["status"] if failed else "passed", "cases": results}

def main():
    payload = json.load(sys.stdin)
    with tempfile.TemporaryDirectory(dir="/tmp") as temp:
        os.chdir(temp)
        report = evaluate(payload)
        os.chdir("/tmp")
    print(json.dumps(report))

if __name__ == "__main__":
    main()
