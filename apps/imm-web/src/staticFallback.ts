import type { ApiHealth, DownloadsInfo, RuntimeOption, VscodeExtensionInfo } from "./api.js";

const latestInstallerRelease = {
  tag: "v0.2.1",
  name: "IMM 0.2.1",
  publishedAt: "2026-05-29T00:00:00Z"
};

const releaseBase =
  "https://github.com/susu3304/InsaneMarmotMatrixLanguage/releases/download/v0.2.1";
const aptBase = "https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt";

export const staticHealth: ApiHealth = {
  ok: true,
  runnerAvailable: false,
  engine: {
    runtimeId: "static",
    label: "Cloudflare static site",
    binary: "",
    version: "Execution API disabled",
    repoDir: null
  },
  sandbox: {
    macOsSandboxRequested: false,
    maxSourceBytes: 0,
    maxTimeoutMs: 0
  }
};

export const staticRuntimes: RuntimeOption[] = [
  {
    id: "static",
    label: "Static site mode",
    kind: "local",
    version: "Execution disabled",
    available: true,
    current: true,
    notes: "This Cloudflare build publishes the site only. Web execution is disabled."
  },
  {
    id: `release:${latestInstallerRelease.tag}`,
    label: latestInstallerRelease.name,
    kind: "release",
    version: latestInstallerRelease.tag,
    available: false,
    assetName: "imm-macos-arm64.tar.gz",
    assetUrl: `${releaseBase}/imm-macos-arm64.tar.gz`,
    publishedAt: latestInstallerRelease.publishedAt,
    notes: "Available for download; not executable in static site mode."
  }
];

export const staticDownloads: DownloadsInfo = {
  ok: true,
  release: latestInstallerRelease,
  installers: [
    {
      platform: "macOS Homebrew",
      label: "Recommended macOS install",
      command: "brew tap susu3304/imm\nbrew install imm\nimm --version"
    },
    {
      platform: "macOS arm64 tarball",
      label: "Apple Silicon direct archive",
      command: `curl -L -o imm-macos-arm64.tar.gz ${releaseBase}/imm-macos-arm64.tar.gz`,
      assetName: "imm-macos-arm64.tar.gz",
      directUrl: `${releaseBase}/imm-macos-arm64.tar.gz`
    },
    {
      platform: "macOS x64 tarball",
      label: "Intel Mac direct archive",
      command: `curl -L -o imm-macos-x64.tar.gz ${releaseBase}/imm-macos-x64.tar.gz`,
      assetName: "imm-macos-x64.tar.gz",
      directUrl: `${releaseBase}/imm-macos-x64.tar.gz`
    },
    {
      platform: "Windows x64",
      label: "MSI installer",
      command: "Download and run imm-windows-x64.msi",
      assetName: "imm-windows-x64.msi",
      directUrl: `${releaseBase}/imm-windows-x64.msi`
    },
    {
      platform: "Ubuntu amd64",
      label: "Debian package",
      command: `curl -L -o imm.deb ${releaseBase}/imm_0.2.1_amd64.deb\nsudo apt install ./imm.deb\nimm --version`,
      assetName: "imm_0.2.1_amd64.deb",
      directUrl: `${releaseBase}/imm_0.2.1_amd64.deb`
    },
    {
      platform: "Ubuntu APT",
      label: "Repository install",
      command: [
        "sudo install -d -m 0755 /etc/apt/keyrings",
        `curl -fsSL ${aptBase}/imm.asc | sudo tee /etc/apt/keyrings/imm.asc >/dev/null`,
        `echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/imm.asc] ${aptBase} stable main" | sudo tee /etc/apt/sources.list.d/imm.list`,
        "sudo apt update",
        "sudo apt install imm",
        "imm --version"
      ].join("\n")
    }
  ]
};

export const staticVscodeExtension: VscodeExtensionInfo = {
  ok: true,
  version: "0.2.1",
  fileName: "imm-vscode-0.2.1.vsix",
  downloadUrl: `${releaseBase}/imm-vscode-0.2.1.vsix`,
  directUrl: `${releaseBase}/imm-vscode-0.2.1.vsix`,
  installCommand: "code --install-extension imm-vscode-0.2.1.vsix"
};
