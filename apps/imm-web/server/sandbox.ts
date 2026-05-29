import { constants } from "node:fs";
import { access, chmod, copyFile, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveImmBinary } from "./immBinary.js";
import type { ImmExecutionRequest, ImmExecutionResult, SandboxKind } from "./types.js";

const MAX_SOURCE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 3_000;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 8_000;
const STDOUT_LIMIT_BYTES = 64 * 1024;
const STDERR_LIMIT_BYTES = 64 * 1024;

export function clampTimeoutMs(timeoutMs?: number): number {
  if (!Number.isFinite(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.trunc(timeoutMs as number)));
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

async function canUseMacSandbox(): Promise<boolean> {
  if (process.platform !== "darwin" || process.env.IMM_WEB_DISABLE_OS_SANDBOX === "1") {
    return false;
  }
  try {
    await access("/usr/bin/sandbox-exec", constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function profileString(value: string): string {
  return JSON.stringify(value);
}

function macSandboxProfile(tempDir: string): string {
  const homeDir = os.homedir();
  return [
    "(version 1)",
    "(deny default)",
    "(allow process-exec)",
    "(allow process-fork)",
    "(allow signal)",
    "(allow sysctl-read)",
    "(allow mach-lookup)",
    "(allow file-read*)",
    `(deny file-read* (subpath ${profileString(homeDir)}))`,
    `(deny file-read* (subpath ${profileString("/Users")}))`,
    `(allow file-read* (subpath ${profileString(tempDir)}))`,
    "(allow file-write*",
    `  (subpath ${profileString(tempDir)})`,
    ")",
    "(deny network*)",
    ""
  ].join("\n");
}

function killChildTree(child: ReturnType<typeof spawn>) {
  if (!child.pid) {
    return;
  }
  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, "SIGKILL");
      return;
    }
  } catch {
    // Fall back to killing the direct child below.
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // The process may already have exited.
  }
}

function appendLimited(current: string, chunk: Buffer | string, limit: number) {
  const next = current + chunk.toString();
  if (byteLength(next) <= limit) {
    return { text: next, truncated: false };
  }
  return { text: next.slice(0, limit), truncated: true };
}

export async function executeImm(request: ImmExecutionRequest): Promise<ImmExecutionResult> {
  if (typeof request.source !== "string" || request.source.trim().length === 0) {
    throw new Error("IMM source is required.");
  }
  if (byteLength(request.source) > MAX_SOURCE_BYTES) {
    throw new Error(`IMM source must be ${MAX_SOURCE_BYTES} bytes or less.`);
  }
  if (request.mode !== "run" && request.mode !== "check") {
    throw new Error("mode must be run or check.");
  }

  const timeoutMs = clampTimeoutMs(request.timeoutMs);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imm-web-runner-"));
  await chmod(tempDir, 0o700);

  const startedAt = performance.now();
  let timedOut = false;
  let outputTruncated = false;
  let sandboxKind: SandboxKind = "process-boundary";

  try {
    const sourcePath = path.join(tempDir, "main.imm");
    await writeFile(sourcePath, request.source, { encoding: "utf8", mode: 0o600 });

    const binary = await resolveImmBinary(request.runtimeId);
    const realBinary = binary === "imm-native" ? binary : await realpath(binary);
    const realTempDir = await realpath(tempDir);
    const baseArgs = [request.mode, sourcePath];
    if (request.mode === "run" && request.trace) {
      baseArgs.push("--trace");
    }

    let command = realBinary;
    let args = baseArgs;
    const osSandbox = await canUseMacSandbox();
    if (osSandbox && realBinary !== "imm-native") {
      sandboxKind = "macos-sandbox-exec";
      const sandboxBinary = path.join(tempDir, process.platform === "win32" ? "imm-native.exe" : "imm-native");
      await copyFile(realBinary, sandboxBinary);
      await chmod(sandboxBinary, 0o700);
      const profilePath = path.join(tempDir, "sandbox.sb");
      await writeFile(profilePath, macSandboxProfile(realTempDir), {
        encoding: "utf8",
        mode: 0o600
      });
      command = "/usr/bin/sandbox-exec";
      args = ["-f", profilePath, sandboxBinary, ...baseArgs];
    }

    const childEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH ?? "",
      HOME: tempDir,
      TMPDIR: tempDir,
      TEMP: tempDir,
      TMP: tempDir,
      NO_COLOR: "1",
      RUST_BACKTRACE: "0",
      IMM_WEB_SANDBOX: "1"
    };

    const child = spawn(command, args, {
      cwd: tempDir,
      env: childEnv,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      timedOut = true;
      killChildTree(child);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const updated = appendLimited(stdout, chunk, STDOUT_LIMIT_BYTES);
      stdout = updated.text;
      outputTruncated ||= updated.truncated;
      if (updated.truncated) {
        killChildTree(child);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const updated = appendLimited(stderr, chunk, STDERR_LIMIT_BYTES);
      stderr = updated.text;
      outputTruncated ||= updated.truncated;
      if (updated.truncated) {
        killChildTree(child);
      }
    });

    const { code, signal } = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code, signal) => resolve({ code, signal }));
      }
    );
    clearTimeout(timer);

    return {
      ok: code === 0 && !timedOut && !outputTruncated,
      exitCode: code,
      signal,
      stdout,
      stderr,
      durationMs: Math.round(performance.now() - startedAt),
      timedOut,
      outputTruncated,
      sandbox: {
        kind: sandboxKind,
        osSandbox: sandboxKind === "macos-sandbox-exec",
        tempDirIsolated: true,
        networkDeniedByOs: sandboxKind === "macos-sandbox-exec",
        timeoutMs,
        stdoutLimitBytes: STDOUT_LIMIT_BYTES,
        stderrLimitBytes: STDERR_LIMIT_BYTES
      }
    };
  } finally {
    if (process.env.IMM_WEB_KEEP_SANDBOX !== "1") {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
