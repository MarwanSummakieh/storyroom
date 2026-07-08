# Builds StoryroomSetup.exe — a native Windows installer for Storyroom.
#
#   powershell -ExecutionPolicy Bypass -File installer\build-installer.ps1
#
# No prerequisites beyond Windows + internet: the script downloads a portable
# Node.js runtime (used to build and also bundled into the install) and Inno
# Setup (used to compile the installer) if they are not already present.
#
# Output: installer\dist\StoryroomSetup.exe

$ErrorActionPreference = "Stop"

$NodeVersion = "22.23.1"

$installerDir = $PSScriptRoot
$repoRoot = Split-Path $installerDir -Parent
$cacheDir = Join-Path $installerDir ".cache"
$stageDir = Join-Path $installerDir "stage"
$nodeDir = Join-Path $cacheDir "node"

New-Item -ItemType Directory -Force $cacheDir | Out-Null

# --- 1. Portable Node.js (build toolchain + bundled runtime) -----------------
if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) {
    Write-Host "Downloading portable Node.js v$NodeVersion..."
    $zip = Join-Path $cacheDir "node-v$NodeVersion-win-x64.zip"
    if (-not (Test-Path $zip)) {
        Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $zip
    }
    Expand-Archive $zip -DestinationPath $cacheDir -Force
    if (Test-Path $nodeDir) { Remove-Item -Recurse -Force $nodeDir }
    Rename-Item (Join-Path $cacheDir "node-v$NodeVersion-win-x64") "node"
}
$env:PATH = "$nodeDir;$env:PATH"
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = "0"
Write-Host "Using Node $(node --version)"

# --- 2. Install dependencies and build ---------------------------------------
Set-Location $repoRoot
Write-Host "Installing dependencies..."
corepack pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

Write-Host "Building Next.js app (standalone)..."
corepack pnpm build
if ($LASTEXITCODE -ne 0) { throw "next build failed" }

Write-Host "Bundling realtime server..."
corepack pnpm build:realtime
if ($LASTEXITCODE -ne 0) { throw "realtime bundle failed" }

# --- 3. Assemble the staging directory ---------------------------------------
Write-Host "Assembling staging directory..."
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Force $stageDir | Out-Null

# Next.js standalone server (server.js + minimal node_modules + .next), plus
# the static assets and public files it does not copy on its own.
#
# The standalone node_modules mirrors pnpm's symlink layout: top-level packages
# are links into .pnpm, and their dependencies resolve as *siblings inside*
# .pnpm via Node's realpath resolution. Symlinks don't survive Copy-Item or an
# installer, so flatten every real package out of .pnpm into a plain npm-style
# node_modules instead.
$standalone = Join-Path $repoRoot ".next\standalone"
Copy-Item $standalone (Join-Path $stageDir "app") -Recurse -Exclude ".pnpm"
$stageModules = Join-Path $stageDir "app\node_modules"
if (Test-Path (Join-Path $stageModules ".pnpm")) {
    Remove-Item -Recurse -Force (Join-Path $stageModules ".pnpm")
}

function Copy-RealPackage($sourceDir, $destDir) {
    if (Test-Path $destDir) { return }
    New-Item -ItemType Directory -Force (Split-Path $destDir -Parent) | Out-Null
    Copy-Item $sourceDir $destDir -Recurse
}

$pnpmDir = Join-Path $standalone "node_modules\.pnpm"
foreach ($entry in Get-ChildItem $pnpmDir -Directory) {
    $entryModules = Join-Path $entry.FullName "node_modules"
    if (-not (Test-Path $entryModules)) { continue }
    foreach ($item in Get-ChildItem $entryModules) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if ($item.Name -like "@*") {
            foreach ($sub in Get-ChildItem $item.FullName) {
                if ($sub.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
                Copy-RealPackage $sub.FullName (Join-Path $stageModules "$($item.Name)\$($sub.Name)")
            }
        }
        else {
            Copy-RealPackage $item.FullName (Join-Path $stageModules $item.Name)
        }
    }
}

Copy-Item (Join-Path $repoRoot ".next\static") (Join-Path $stageDir "app\.next\static") -Recurse -Force
if (Test-Path (Join-Path $repoRoot "public")) {
    Copy-Item (Join-Path $repoRoot "public") (Join-Path $stageDir "app\public") -Recurse -Force
}

# Bundled realtime server (single file, no node_modules needed).
New-Item -ItemType Directory -Force (Join-Path $stageDir "realtime") | Out-Null
Copy-Item (Join-Path $repoRoot "dist\realtime.cjs") (Join-Path $stageDir "realtime\realtime.cjs")

# Runtime: node.exe alone is enough for both servers and the launcher.
New-Item -ItemType Directory -Force (Join-Path $stageDir "node") | Out-Null
Copy-Item (Join-Path $nodeDir "node.exe") (Join-Path $stageDir "node\node.exe")

# Launcher, stop script, hidden-window shims, icon.
Copy-Item (Join-Path $installerDir "launcher.js") $stageDir
Copy-Item (Join-Path $installerDir "stop.js") $stageDir
Copy-Item (Join-Path $installerDir "start-storyroom.vbs") $stageDir
Copy-Item (Join-Path $installerDir "stop-storyroom.vbs") $stageDir
Copy-Item (Join-Path $repoRoot "src\app\favicon.ico") (Join-Path $stageDir "storyroom.ico")

# --- 4. Compile the installer with Inno Setup --------------------------------
function Find-Iscc {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    return $null
}

$iscc = Find-Iscc
if (-not $iscc) {
    Write-Host "Inno Setup not found; installing per-user via winget..."
    winget install --id JRSoftware.InnoSetup --scope user --accept-source-agreements --accept-package-agreements --silent | Out-Null
    $iscc = Find-Iscc
}
if (-not $iscc) {
    Write-Host "winget install did not yield ISCC; downloading Inno Setup directly..."
    $isSetup = Join-Path $cacheDir "innosetup.exe"
    Invoke-WebRequest "https://jrsoftware.org/download.php/is.exe" -OutFile $isSetup
    Start-Process $isSetup -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/CURRENTUSER", "/NORESTART" -Wait
    $iscc = Find-Iscc
}
if (-not $iscc) { throw "Could not install Inno Setup. Install it from https://jrsoftware.org/isinfo.php and re-run." }

Write-Host "Compiling installer with $iscc..."
& $iscc (Join-Path $installerDir "storyroom.iss")
if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }

$out = Join-Path $installerDir "dist\StoryroomSetup.exe"
Write-Host ""
Write-Host "Done: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)"
