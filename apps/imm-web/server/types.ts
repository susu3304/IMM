export type ImmMode = "run" | "check";

export type SandboxKind = "macos-sandbox-exec" | "process-boundary";

export interface ImmExecutionRequest {
  source: string;
  mode: ImmMode;
  runtimeId?: string;
  stdin?: string;
  trace?: boolean;
  timeoutMs?: number;
}

export interface ImmExecutionResult {
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
  sandbox: {
    kind: SandboxKind;
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

export interface EngineInfo {
  runtimeId: string;
  label: string;
  binary: string;
  version: string;
  repoDir: string | null;
}
