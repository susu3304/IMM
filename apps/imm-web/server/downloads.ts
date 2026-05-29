const DEFAULT_INSTALLER_LATEST_URL = "https://api.github.com/repos/susu3304/InsaneMarmotMatrixLanguage/releases/latest";
const DEFAULT_APT_BASE_URL = "https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size?: number;
  digest?: string;
}

interface GitHubRelease {
  tag_name: string;
  name?: string;
  published_at?: string;
  assets?: GitHubAsset[];
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

let cachedDownloads: { at: number; value: DownloadsInfo } | null = null;
let cachedVscode: { at: number; value: VscodeExtensionInfo; directUrl?: string } | null = null;

export async function listDownloads(refresh = false): Promise<DownloadsInfo> {
  if (!refresh && cachedDownloads && Date.now() - cachedDownloads.at < 5 * 60_000) {
    return cachedDownloads.value;
  }

  try {
    const latest = await fetchLatestInstallerRelease();
    const assets = latest.assets ?? [];
    const value: DownloadsInfo = {
      ok: true,
      release: {
        tag: latest.tag_name,
        name: latest.name || latest.tag_name,
        publishedAt: latest.published_at
      },
      installers: [
        installer("macOS Homebrew", "Recommended macOS install", "brew tap susu3304/imm\nbrew install imm\nimm --version"),
        installer(
          "macOS arm64 tarball",
          "Apple Silicon direct archive",
          "curl -L -o imm-macos-arm64.tar.gz <direct-download-url>",
          findAsset(assets, "imm-macos-arm64.tar.gz")
        ),
        installer(
          "macOS x64 tarball",
          "Intel Mac direct archive",
          "curl -L -o imm-macos-x64.tar.gz <direct-download-url>",
          findAsset(assets, "imm-macos-x64.tar.gz")
        ),
        installer(
          "Windows x64",
          "MSI installer",
          "Download and run imm-windows-x64.msi",
          findAsset(assets, "imm-windows-x64.msi")
        ),
        installer(
          "Ubuntu amd64",
          "Debian package",
          "curl -L -o imm.deb <direct-download-url>\nsudo apt install ./imm.deb\nimm --version",
          assets.find((asset) => asset.name.endsWith("_amd64.deb"))
        ),
        installer(
          "Ubuntu APT",
          "Repository install",
          [
            "sudo install -d -m 0755 /etc/apt/keyrings",
            `curl -fsSL ${aptBaseUrl()}/imm.asc | sudo tee /etc/apt/keyrings/imm.asc >/dev/null`,
            `echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/imm.asc] ${aptBaseUrl()} stable main" | sudo tee /etc/apt/sources.list.d/imm.list`,
            "sudo apt update",
            "sudo apt install imm",
            "imm --version"
          ].join("\n")
        )
      ]
    };
    cachedDownloads = { at: Date.now(), value };
    return value;
  } catch (error) {
    const value = {
      ok: false,
      installers: [],
      error: error instanceof Error ? error.message : String(error)
    };
    cachedDownloads = { at: Date.now(), value };
    return value;
  }
}

export async function getVscodeExtensionInfo(refresh = false): Promise<VscodeExtensionInfo> {
  if (!refresh && cachedVscode && Date.now() - cachedVscode.at < 30_000) {
    return cachedVscode.value;
  }

  try {
    const latest = await fetchLatestInstallerRelease();
    const asset = vscodeAsset(latest);
    if (!asset) {
      throw new Error("No imm-vscode VSIX asset found in latest IMM release.");
    }
    const fileName = asset.name;
    const version = fileName.match(/imm-vscode-(.+)\.vsix$/)?.[1];
    const value = {
      ok: true,
      version,
      fileName,
      sizeBytes: asset.size,
      downloadUrl: "/downloads/vscode/latest.vsix",
      directUrl: asset.browser_download_url,
      installCommand: `code --install-extension ${fileName}`
    };
    cachedVscode = { at: Date.now(), value, directUrl: asset.browser_download_url };
    return value;
  } catch (error) {
    const value = {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
    cachedVscode = { at: Date.now(), value };
    return value;
  }
}

export async function getVscodeExtensionDownloadUrl(): Promise<string> {
  await getVscodeExtensionInfo(true);
  if (!cachedVscode?.directUrl) {
    throw new Error(cachedVscode?.value.error || "VS Code extension package is unavailable.");
  }
  return cachedVscode.directUrl;
}

async function fetchLatestInstallerRelease(): Promise<GitHubRelease> {
  const url = process.env.IMM_INSTALLER_LATEST_URL || DEFAULT_INSTALLER_LATEST_URL;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "imm-web-runner"
    }
  });
  if (!response.ok) {
    throw new Error(`Installer release lookup failed: ${response.status}`);
  }
  return (await response.json()) as GitHubRelease;
}

function aptBaseUrl(): string {
  return (process.env.IMM_APT_BASE_URL || DEFAULT_APT_BASE_URL).replace(/\/+$/u, "");
}

function findAsset(assets: GitHubAsset[], name: string): GitHubAsset | undefined {
  return assets.find((asset) => asset.name === name);
}

function installer(platform: string, label: string, command: string, asset?: GitHubAsset): InstallerDownload {
  return {
    platform,
    label,
    command: asset?.browser_download_url ? command.replace("<direct-download-url>", asset.browser_download_url) : command,
    assetName: asset?.name,
    directUrl: asset?.browser_download_url,
    sizeBytes: asset?.size,
    digest: asset?.digest
  };
}

function vscodeAsset(release: GitHubRelease): GitHubAsset | undefined {
  return (release.assets ?? []).find((asset) => /^imm-vscode-.+\.vsix$/.test(asset.name));
}
