[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $SourceDir,

    [Parameter(Mandatory = $true)]
    [string] $ProductVersion,

    [string] $OutDir = "dist"
)

$ErrorActionPreference = "Stop"

$SourceDir = (Resolve-Path $SourceDir).Path
$OutDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$WxsPath = Join-Path $RepoRoot "packaging\wix\Product.wxs"
$StageDir = Join-Path $OutDir "msi-input"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $StageDir) {
    Remove-Item -Recurse -Force $StageDir
}
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

$env:CARGO_TARGET_DIR = Join-Path $SourceDir "target"

cargo build --release --locked --manifest-path (Join-Path $SourceDir "Cargo.toml")

$BuiltExe = Join-Path $SourceDir "target\release\imm-native.exe"
if (!(Test-Path $BuiltExe)) {
    throw "expected binary not found: $BuiltExe"
}

Copy-Item $BuiltExe (Join-Path $StageDir "imm.exe")

if (!(Get-Command wix -ErrorAction SilentlyContinue)) {
    dotnet tool install --global wix --version 5.0.2
    $DotnetTools = Join-Path $HOME ".dotnet\tools"
    $env:PATH = "$DotnetTools;$env:PATH"
}

$MsiPath = Join-Path $OutDir "imm-windows-x64.msi"
wix build $WxsPath `
    -arch x64 `
    -d "SourceDir=$StageDir" `
    -d "ProductVersion=$ProductVersion" `
    -out $MsiPath

Write-Host "MSI written to $MsiPath"
