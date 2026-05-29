import { access, chmod, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { EngineInfo, RuntimeOption } from "./types.js";

const APP_ROOT = process.cwd();
const DEFAULT_IMM_REPO_DIR = path.resolve(APP_ROOT, "../../crates/imm-native");
const DEFAULT_INSTALLER_RELEASES_URL =
  "https://api.github.com/repos/susu3304/InsaneMarmotMatrixLanguage/releases?per_page=20";
const RUNTIME_CACHE_DIR = path.join(APP_ROOT, ".runtime-cache");

let cachedLocalBinary: string | null = null;
const cachedReleaseBinaries = new Map<string, string>();
const cachedInfo = new Map<string, EngineInfo>();
let cachedRuntimeOptions: { at: number; values: RuntimeOption[] } | null = null;

async function isExecutable(file: string): Promise<boolean> {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function runProcess(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs ?? 120_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function buildImmNative(repoDir: string): Promise<string> {
  const manifest = path.join(repoDir, "Cargo.toml");
  await access(manifest, constants.R_OK);
  const result = await runProcess(
    "cargo",
    ["build", "--manifest-path", manifest, "--bin", "imm-native"],
    {
      cwd: repoDir,
      timeoutMs: 180_000,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: path.join(repoDir, "target")
      }
    }
  );
  if (result.code !== 0) {
    throw new Error(`imm-native build failed:\n${result.stderr || result.stdout}`);
  }
  return path.join(repoDir, "target", "debug", process.platform === "win32" ? "imm-native.exe" : "imm-native");
}

async function resolveLocalImmBinary(): Promise<string> {
  if (cachedLocalBinary) {
    return cachedLocalBinary;
  }

  const repoDir = process.env.IMM_REPO_DIR
    ? path.resolve(process.env.IMM_REPO_DIR)
    : DEFAULT_IMM_REPO_DIR;

  const candidates = [
    process.env.IMM_NATIVE_BIN ? path.resolve(process.env.IMM_NATIVE_BIN) : null,
    path.join(repoDir, "target", "release", process.platform === "win32" ? "imm-native.exe" : "imm-native"),
    path.join(repoDir, "target", "debug", process.platform === "win32" ? "imm-native.exe" : "imm-native")
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      cachedLocalBinary = await realpath(candidate);
      return cachedLocalBinary;
    }
  }

  if (!process.env.IMM_NATIVE_BIN) {
    const built = await buildImmNative(repoDir);
    if (await isExecutable(built)) {
      cachedLocalBinary = await realpath(built);
      return cachedLocalBinary;
    }
  }

  cachedLocalBinary = "imm-native";
  return cachedLocalBinary;
}

async function fetchInstallerReleases(): Promise<RuntimeOption[]> {
  const url = process.env.IMM_INSTALLER_RELEASES_URL || DEFAULT_INSTALLER_RELEASES_URL;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "imm-web-runner"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: ${response.status}`);
  }
  const releases = (await response.json()) as Array<{
    tag_name: string;
    name?: string;
    html_url?: string;
    body?: string;
    published_at?: string;
    assets?: Array<{ name: string; browser_download_url: string }>;
  }>;

  return releases.map((release) => {
    const asset = selectPlatformAsset(release.assets ?? []);
    const commit = release.body?.match(/@([0-9a-f]{12,40})/)?.[1];
    return {
      id: `release:${release.tag_name}`,
      label: release.name || release.tag_name,
      kind: "release",
      version: release.tag_name,
      available: Boolean(asset),
      releaseUrl: release.html_url,
      assetName: asset?.name,
      assetUrl: asset?.browser_download_url,
      commit,
      publishedAt: release.published_at,
      notes: asset ? undefined : "No runnable asset for this OS/CPU."
    } satisfies RuntimeOption;
  });
}

function selectPlatformAsset(assets: Array<{ name: string; browser_download_url: string }>) {
  const arch = os.arch();
  const platform = os.platform();
  const wanted =
    platform === "darwin"
      ? arch === "arm64"
        ? "imm-macos-arm64.tar.gz"
        : "imm-macos-x64.tar.gz"
      : platform === "linux" && arch === "x64"
        ? "imm-linux-x64.tar.gz"
        : null;

  if (!wanted) {
    return undefined;
  }
  return assets.find((asset) => asset.name === wanted);
}

async function findExecutable(dir: string): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true });
  const preferred: string[] = [];
  const fallback: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findExecutable(fullPath);
      if (nested) {
        fallback.push(nested);
      }
      continue;
    }
    if (!entry.isFile() || !(await isExecutable(fullPath))) {
      continue;
    }
    if (entry.name === "imm" || entry.name === "imm-native") {
      preferred.push(fullPath);
    } else {
      fallback.push(fullPath);
    }
  }
  return preferred[0] ?? fallback[0] ?? null;
}

function safeCacheName(id: string): string {
  return id.replace(/[^A-Za-z0-9_.-]+/g, "_");
}

async function resolveReleaseBinary(runtimeId: string): Promise<string> {
  const cached = cachedReleaseBinaries.get(runtimeId);
  if (cached && (await isExecutable(cached))) {
    return cached;
  }

  const runtime = (await listRuntimes()).find((item) => item.id === runtimeId);
  if (!runtime || runtime.kind !== "release") {
    throw new Error(`Unknown runtime: ${runtimeId}`);
  }
  if (!runtime.assetUrl || !runtime.available) {
    throw new Error(runtime.notes || `Runtime is not available on ${os.platform()} ${os.arch()}.`);
  }

  await mkdir(RUNTIME_CACHE_DIR, { recursive: true, mode: 0o700 });
  const runtimeDir = path.join(RUNTIME_CACHE_DIR, safeCacheName(runtime.id));
  const existing = await findExecutable(runtimeDir).catch(() => null);
  if (existing) {
    cachedReleaseBinaries.set(runtimeId, existing);
    return existing;
  }

  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  const tmpDir = await mkdtemp(path.join(RUNTIME_CACHE_DIR, "download-"));
  try {
    const assetPath = path.join(tmpDir, runtime.assetName || "runtime.tar.gz");
    const response = await fetch(runtime.assetUrl, {
      headers: { "User-Agent": "imm-web-runner" }
    });
    if (!response.ok) {
      throw new Error(`Runtime download failed: ${response.status}`);
    }
    await writeFile(assetPath, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });

    if (assetPath.endsWith(".tar.gz")) {
      const result = await runProcess("tar", ["-xzf", assetPath, "-C", runtimeDir], { timeoutMs: 30_000 });
      if (result.code !== 0) {
        throw new Error(result.stderr || "Runtime archive extraction failed.");
      }
    } else {
      throw new Error(`Unsupported runtime asset: ${runtime.assetName}`);
    }

    const binary = await findExecutable(runtimeDir);
    if (!binary) {
      throw new Error("Runtime archive did not contain an executable.");
    }
    await chmod(binary, 0o700);
    cachedReleaseBinaries.set(runtimeId, binary);
    return binary;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function listRuntimes(refresh = false): Promise<RuntimeOption[]> {
  if (!refresh && cachedRuntimeOptions && Date.now() - cachedRuntimeOptions.at < 5 * 60_000) {
    return cachedRuntimeOptions.values;
  }

  const repoDir = process.env.IMM_REPO_DIR
    ? path.resolve(process.env.IMM_REPO_DIR)
    : DEFAULT_IMM_REPO_DIR;
  const localBinary = await resolveLocalImmBinary();
  const localVersion = await readBinaryVersion(localBinary).catch(() => "local imm-native");
  const local: RuntimeOption = {
    id: "local",
    label: "Local development runtime",
    kind: "local",
    version: localVersion,
    available: true,
    current: true,
    binary: localBinary,
    repoDir
  };

  let remote: RuntimeOption[] = [];
  try {
    remote = await fetchInstallerReleases();
  } catch (error) {
    remote = [
      {
        id: "release-unavailable",
        label: "GitHub Releases unavailable",
        kind: "release",
        version: "unknown",
        available: false,
        notes: error instanceof Error ? error.message : String(error)
      }
    ];
  }

  cachedRuntimeOptions = { at: Date.now(), values: [local, ...remote] };
  return cachedRuntimeOptions.values;
}

async function readBinaryVersion(binary: string): Promise<string> {
  const result = await runProcess(binary, ["--version"], { timeoutMs: 10_000 });
  if (result.code !== 0) {
    throw new Error(result.stderr || "imm-native --version failed");
  }
  return result.stdout.trim();
}

export async function resolveImmBinary(runtimeId = "local"): Promise<string> {
  if (!runtimeId || runtimeId === "local") {
    return resolveLocalImmBinary();
  }
  if (runtimeId.startsWith("release:")) {
    return resolveReleaseBinary(runtimeId);
  }
  throw new Error(`Unknown runtime: ${runtimeId}`);
}

export async function getEngineInfo(runtimeId = "local"): Promise<EngineInfo> {
  const cached = cachedInfo.get(runtimeId);
  if (cached) {
    return cached;
  }
  const binary = await resolveImmBinary(runtimeId);
  const version = await readBinaryVersion(binary);
  const runtime = (await listRuntimes()).find((item) => item.id === runtimeId);
  const info = {
    runtimeId,
    label: runtime?.label ?? runtimeId,
    binary,
    version,
    repoDir: runtime?.repoDir ?? null
  };
  cachedInfo.set(runtimeId, info);
  return info;
}
