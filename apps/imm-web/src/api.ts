import { executeWasm } from "./wasmRunner.js";

export const BROWSER_WASM_RUNTIME_ID = "browser-wasm";

export interface ApiExecutionResult {
  ok: boolean;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  sandbox: {
    kind: string;
    osSandbox: boolean;
    tempDirIsolated: boolean;
    networkDeniedByOs: boolean;
    timeoutMs: number;
    stdoutLimitBytes: number;
    stderrLimitBytes: number;
  };
}

const browserWasmRuntime: RuntimeOption = {
  id: BROWSER_WASM_RUNTIME_ID,
  label: "Browser WASM",
  kind: "local",
  version: "0.2.1",
  available: true,
  current: true,
  notes: "Runs check and JS-hosted run locally in your browser with fetch and stdin support."
};

export interface RuntimeOption {
  id: string;
  label: string;
  kind: "local" | "release";
  version: string;
  available: boolean;
  current?: boolean;
  binary?: string;
  repoDir?: string | null;
  releaseUrl?: string;
  assetName?: string;
  assetUrl?: string;
  commit?: string;
  publishedAt?: string;
  notes?: string;
}

export interface InstallerDownload {
  platform: string;
  label: string;
  command: string;
  assetName?: string;
  directUrl?: string;
  sizeBytes?: number;
  digest?: string;
}

export interface DownloadsInfo {
  ok: boolean;
  release?: {
    tag: string;
    name: string;
    publishedAt?: string;
  };
  installers: InstallerDownload[];
  error?: string;
}

export interface VscodeExtensionInfo {
  ok: boolean;
  version?: string;
  fileName?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  directUrl?: string;
  installCommand?: string;
  error?: string;
}

export interface ApiHealth {
  ok: boolean;
  runnerAvailable?: boolean;
  engine?: {
    runtimeId: string;
    label: string;
    binary: string;
    version: string;
    repoDir: string | null;
  };
  runtimes?: RuntimeOption[];
  sandbox?: {
    macOsSandboxRequested: boolean;
    maxSourceBytes: number;
    maxTimeoutMs: number;
  };
  error?: string;
}

export async function fetchRuntimes(refresh = false): Promise<RuntimeOption[]> {
  try {
    const response = await fetch(`/api/runtimes${refresh ? "?refresh=1" : ""}`);
    const payload = await readJson<{ ok: boolean; runtimes: RuntimeOption[] }>(response, "Runtime list request failed.");
    return withBrowserWasmRuntime(payload.runtimes);
  } catch {
    return withBrowserWasmRuntime([]);
  }
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }
  if (!response.ok || (typeof payload === "object" && payload && "ok" in payload && payload.ok === false)) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : fallbackMessage
    );
  }
  return payload as T;
}

export async function fetchDownloads(refresh = false): Promise<DownloadsInfo> {
  const response = await fetch(`/api/downloads${refresh ? "?refresh=1" : ""}`);
  return readJson<DownloadsInfo>(response, "Download list request failed.");
}

export async function fetchVscodeExtension(refresh = false): Promise<VscodeExtensionInfo> {
  const response = await fetch(`/api/vscode-extension${refresh ? "?refresh=1" : ""}`);
  return readJson<VscodeExtensionInfo>(response, "VS Code extension lookup failed.");
}

export async function fetchHealth(): Promise<ApiHealth> {
  try {
    const response = await fetch("/api/health");
    return withBrowserWasmHealth(await readJson<ApiHealth>(response, "Runner API is not available."));
  } catch {
    return withBrowserWasmHealth({
      ok: true,
      runnerAvailable: true,
      engine: {
        runtimeId: BROWSER_WASM_RUNTIME_ID,
        label: "Browser WASM",
        binary: "",
        version: browserWasmRuntime.version,
        repoDir: null
      },
      runtimes: [],
      sandbox: {
        macOsSandboxRequested: false,
        maxSourceBytes: 64 * 1024,
        maxTimeoutMs: 3000
      }
    });
  }
}

export async function execute(
  endpoint: "run" | "check",
  source: string,
  trace: boolean,
  runtimeId: string,
  stdin: string
): Promise<ApiExecutionResult> {
  if (runtimeId === BROWSER_WASM_RUNTIME_ID) {
    return executeWasm(endpoint, source, trace, stdin);
  }
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, trace, runtimeId, stdin, timeoutMs: 3000 })
  });
  const payload = await response.json();
  if (!response.ok && payload?.stdout === undefined) {
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  return payload;
}

function withBrowserWasmRuntime(runtimes: RuntimeOption[]): RuntimeOption[] {
  const filtered = runtimes
    .filter((runtime) => runtime.id !== BROWSER_WASM_RUNTIME_ID)
    .map((runtime) => ({
      ...runtime,
      current: false,
      available:
        runtime.id === "static" || runtime.id === "cloudflare-static" ? false : runtime.available
    }));
  return [browserWasmRuntime, ...filtered];
}

function withBrowserWasmHealth(health: ApiHealth): ApiHealth {
  return {
    ...health,
    runnerAvailable: true,
    engine: health.engine ?? {
      runtimeId: BROWSER_WASM_RUNTIME_ID,
      label: "Browser WASM",
      binary: "",
      version: browserWasmRuntime.version,
      repoDir: null
    },
    runtimes: withBrowserWasmRuntime(health.runtimes ?? []),
    sandbox: health.sandbox ?? {
      macOsSandboxRequested: false,
      maxSourceBytes: 64 * 1024,
      maxTimeoutMs: 3000
    }
  };
}
