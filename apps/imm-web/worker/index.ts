interface Env {
  ASSETS: Fetcher;
}

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

const INSTALLER_LATEST_URL = "https://api.github.com/repos/susu3304/InsaneMarmotMatrixLanguage/releases/latest";
const APT_BASE_URL = "https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        runnerAvailable: false,
        engine: {
          runtimeId: "cloudflare-static",
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
      });
    }

    if (url.pathname === "/api/downloads") {
      try {
        return json(await downloadsPayload(isRefresh(url)));
      } catch (error) {
        return json({ ok: false, installers: [], error: errorMessage(error) }, { status: 503 });
      }
    }

    if (url.pathname === "/api/vscode-extension") {
      try {
        return json(await vscodePayload(isRefresh(url)));
      } catch (error) {
        return json({ ok: false, error: errorMessage(error) }, { status: 503 });
      }
    }

    if (url.pathname === "/api/runtimes") {
      try {
        return json(await runtimesPayload(isRefresh(url)));
      } catch (error) {
        return json({ ok: false, runtimes: [], error: errorMessage(error) }, { status: 503 });
      }
    }

    if (url.pathname === "/api/run" || url.pathname === "/api/check") {
      return json(
        {
          ok: false,
          error: "Web execution is disabled on the Cloudflare static deployment."
        },
        { status: 501 }
      );
    }

    if (url.pathname === "/downloads/vscode/latest.vsix") {
      try {
        const release = await latestInstallerRelease(isRefresh(url));
        const asset = vscodeAsset(release);
        if (!asset) {
          return new Response("No imm-vscode VSIX asset found in latest IMM release.", { status: 404 });
        }
        return Response.redirect(asset.browser_download_url, 302);
      } catch (error) {
        return new Response(errorMessage(error), { status: 503 });
      }
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;

async function downloadsPayload(refresh = false) {
  const release = await latestInstallerRelease(refresh);
  const assets = release.assets ?? [];
  const deb = assets.find((asset) => asset.name.endsWith("_amd64.deb"));
  return {
    ok: true,
    release: releaseSummary(release),
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
        deb
      ),
      installer(
        "Ubuntu APT",
        "Repository install",
        [
          "sudo install -d -m 0755 /etc/apt/keyrings",
          `curl -fsSL ${APT_BASE_URL}/imm.asc | sudo tee /etc/apt/keyrings/imm.asc >/dev/null`,
          `echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/imm.asc] ${APT_BASE_URL} stable main" | sudo tee /etc/apt/sources.list.d/imm.list`,
          "sudo apt update",
          "sudo apt install imm",
          "imm --version"
        ].join("\n")
      )
    ]
  };
}

async function vscodePayload(refresh = false) {
  const release = await latestInstallerRelease(refresh);
  const asset = vscodeAsset(release);
  if (!asset) {
    return {
      ok: false,
      error: "No imm-vscode VSIX asset found in latest IMM release."
    };
  }
  const version = asset.name.match(/^imm-vscode-(.+)\.vsix$/)?.[1];
  return {
    ok: true,
    version,
    fileName: asset.name,
    sizeBytes: asset.size,
    downloadUrl: "/downloads/vscode/latest.vsix",
    directUrl: asset.browser_download_url,
    installCommand: `code --install-extension ${asset.name}`
  };
}

async function runtimesPayload(refresh = false) {
  const release = await latestInstallerRelease(refresh);
  const assets = release.assets ?? [];
  const runtimeAsset = findAsset(assets, "imm-macos-arm64.tar.gz") ?? findAsset(assets, "imm-macos-x64.tar.gz");
  return {
    ok: true,
    runtimes: [
      {
        id: "cloudflare-static",
        label: "Cloudflare static site",
        kind: "local",
        version: "Execution disabled",
        available: true,
        current: true,
        notes: "This Cloudflare build publishes the site only. Web execution is disabled."
      },
      {
        id: `release:${release.tag_name}`,
        label: release.name || release.tag_name,
        kind: "release",
        version: release.tag_name,
        available: false,
        assetName: runtimeAsset?.name,
        assetUrl: runtimeAsset?.browser_download_url,
        publishedAt: release.published_at,
        notes: "Available for download; not executable in static site mode."
      }
    ]
  };
}

async function latestInstallerRelease(refresh = false): Promise<GitHubRelease> {
  const requestUrl = new URL(INSTALLER_LATEST_URL);
  if (refresh) {
    requestUrl.searchParams.set("_", Date.now().toString());
  }

  const response = await fetch(requestUrl.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "imm-web-runner"
    },
    cf: refresh
      ? { cacheTtl: 0, cacheEverything: false }
      : {
          cacheTtl: 300,
          cacheEverything: true
        }
  });
  if (!response.ok) {
    throw new Error(`Installer release lookup failed: ${response.status}`);
  }
  return response.json();
}

function isRefresh(url: URL): boolean {
  return url.searchParams.get("refresh") === "1" || url.searchParams.get("refresh") === "true";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function releaseSummary(release: GitHubRelease) {
  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    publishedAt: release.published_at
  };
}

function vscodeAsset(release: GitHubRelease): GitHubAsset | undefined {
  return (release.assets ?? []).find((asset) => /^imm-vscode-.+\.vsix$/.test(asset.name));
}

function findAsset(assets: GitHubAsset[], name: string): GitHubAsset | undefined {
  return assets.find((asset) => asset.name === name);
}

function installer(platform: string, label: string, command: string, asset?: GitHubAsset) {
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

function json(payload: unknown, init: ResponseInit = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      "Cache-Control": "public, max-age=300",
      ...init.headers
    }
  });
}
