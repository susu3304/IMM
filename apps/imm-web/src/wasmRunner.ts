import type { ApiExecutionResult } from "./api.js";

const DEFAULT_TIMEOUT_MS = 3000;

interface WasmWorkerResponse {
  id: number;
  ok: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

let nextRequestId = 1;

export function executeWasm(
  endpoint: "run" | "check",
  source: string,
  trace: boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ApiExecutionResult> {
  const id = nextRequestId++;
  const started = performance.now();
  const worker = new Worker(new URL("./wasmRunner.worker.ts", import.meta.url), { type: "module" });

  return new Promise((resolve) => {
    const finish = (result: ApiExecutionResult) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    };

    const timeout = window.setTimeout(() => {
      finish(resultPayload(false, "", "WASM execution timed out.", Math.round(performance.now() - started), true));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<WasmWorkerResponse>) => {
      if (event.data.id !== id) {
        return;
      }
      finish(resultPayload(event.data.ok, event.data.stdout, event.data.stderr, event.data.durationMs, false));
    };

    worker.onerror = (event) => {
      finish(resultPayload(false, "", event.message || "WASM worker failed.", Math.round(performance.now() - started), false));
    };

    worker.postMessage({ id, endpoint, source, trace });
  });
}

function resultPayload(
  ok: boolean,
  stdout: string,
  stderr: string,
  durationMs: number,
  timedOut: boolean
): ApiExecutionResult {
  return {
    ok,
    exitCode: ok ? 0 : 1,
    signal: null,
    stdout,
    stderr,
    durationMs,
    timedOut,
    outputTruncated: false,
    sandbox: {
      kind: "browser-wasm",
      osSandbox: false,
      tempDirIsolated: true,
      networkDeniedByOs: true,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      stdoutLimitBytes: 0,
      stderrLimitBytes: 0
    }
  };
}
