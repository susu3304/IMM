import init, { check as wasmCheck, run as wasmRun } from "./wasm/pkg/imm_wasm.js";

interface WasmWorkerRequest {
  id: number;
  endpoint: "run" | "check";
  source: string;
  trace: boolean;
}

interface WasmCoreResult {
  ok?: boolean;
  stdout?: string;
  stderr?: string;
}

let initPromise: Promise<unknown> | null = null;

function ensureInitialized() {
  initPromise ??= init();
  return initPromise;
}

self.onmessage = async (event: MessageEvent<WasmWorkerRequest>) => {
  const started = performance.now();
  const { id, endpoint, source, trace } = event.data;

  try {
    await ensureInitialized();
    const result = (endpoint === "run" ? wasmRun(source, trace) : wasmCheck(source)) as WasmCoreResult;
    self.postMessage({
      id,
      ok: result.ok ?? true,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      durationMs: Math.round(performance.now() - started)
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(performance.now() - started)
    });
  }
};
