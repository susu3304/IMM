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
  const response = await fetch(`/api/runtimes${refresh ? "?refresh=1" : ""}`);
  const payload = await readJson<{ ok: boolean; runtimes: RuntimeOption[] }>(response, "Runtime list request failed.");
  return payload.runtimes;
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
  const response = await fetch("/api/health");
  return readJson<ApiHealth>(response, "Runner API is not available.");
}

export async function execute(
  endpoint: "run" | "check",
  source: string,
  trace: boolean,
  runtimeId: string
): Promise<ApiExecutionResult> {
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, trace, runtimeId, timeoutMs: 3000 })
  });
  const payload = await response.json();
  if (!response.ok && payload?.stdout === undefined) {
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }
  return payload;
}
