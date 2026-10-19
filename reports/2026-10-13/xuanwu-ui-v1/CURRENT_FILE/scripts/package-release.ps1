[CmdletBinding()]
param(
  [string]$OutputDirectory,
  [switch]$DirectoryOnly
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $root 'dist'
}
$out = (Resolve-Path $OutputDirectory -ErrorAction SilentlyContinue)
if (-not $out) {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $out = Resolve-Path $OutputDirectory
}

$staging = Join-Path ([IO.Path]::GetTempPath()) ('cat-mouse-release-' + [guid]::NewGuid().ToString('N'))
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$resolvedStaging = [IO.Path]::GetFullPath($staging)
if (-not $resolvedStaging.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedStaging -Leaf) -notmatch '^cat-mouse-release-[0-9a-f]{32}$') {
  throw "Unexpected staging path: $resolvedStaging"
}
$miniStage = Join-Path $staging 'miniprogram'
$serverStage = Join-Path $staging 'cat-mouse-server'
New-Item -ItemType Directory -Path $miniStage,$serverStage -Force | Out-Null

try {
  # 只复制首发闭环所需的小程序文件；实验页和后端不会混入小程序压缩包。
  $miniFiles = @('app.js','app.json','project.config.json','sitemap.json','utils\config.js','utils\v2.js','utils\location-v2.js','utils\snapshot-v2.js','utils\dev-preview.js','utils\pixel-theme.wxss','utils\presentation.js','utils\pixel-font.wxss','utils\pixel-art-ratios.wxss','utils\venue-camera.js','assets\markers-v1','assets\pixel-v1','assets\maps','components','pages\index','pages\room','pages\map','pages\qrcode','pages\dev','pages\venue')
  foreach ($item in $miniFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $item))) {
      throw "Required miniprogram source is missing: $item"
    }
    $destination = Join-Path $miniStage $item
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $item) -Destination $destination -Recurse -Force
  }
  # The licensed subset is already embedded in pixel-font.wxss. Keep its source
  # in the repository, not duplicated in the mobile upload package.
  $embeddedFontSource = Join-Path $miniStage 'assets\pixel-v1\ui-variable.woff'
  if (Test-Path -LiteralPath $embeddedFontSource) { Remove-Item -LiteralPath $embeddedFontSource -Force }
  # Keep unused reference slices in the source library, not in the shipped UI.
  foreach ($name in @('button-create-minus.png','button-create-plus.png','rules-icon-capture.png')) {
    $unusedSlice = Join-Path $miniStage ('assets\pixel-v1\' + $name)
    if (Test-Path -LiteralPath $unusedSlice) { Remove-Item -LiteralPath $unusedSlice -Force }
  }

  # Historical faithful-v2 assets and styles stay in the repository but are not
  # part of the current pixel-v1 runtime file list.
  foreach ($item in $miniFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $miniStage $item))) {
      throw "Required miniprogram staged entry is missing: $item"
    }
  }

  if ($DirectoryOnly) {
    $directoryTarget = Join-Path $out.Path 'MODIFIED_FILE'
    if (Test-Path -LiteralPath $directoryTarget) {
      $targetEntry = Get-Item -LiteralPath $directoryTarget -Force
      if (-not $targetEntry.PSIsContainer -or ($targetEntry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Directory-only output must be an ordinary directory: $directoryTarget"
      }
      if (@(Get-ChildItem -LiteralPath $directoryTarget -Force).Count -gt 0) {
        throw "Directory-only output already exists and is not empty: $directoryTarget"
      }
    } else {
      New-Item -ItemType Directory -Path $directoryTarget | Out-Null
    }
    foreach ($entry in (Get-ChildItem -LiteralPath $miniStage -Force)) {
      Copy-Item -LiteralPath $entry.FullName -Destination $directoryTarget -Recurse -Force
    }
    foreach ($item in $miniFiles) {
      if (-not (Test-Path -LiteralPath (Join-Path $directoryTarget $item))) {
        throw "Required directory-only output entry is missing: $item"
      }
    }
    Write-Output "Created directory: $directoryTarget"
    return
  }

  # 后端镜像只需要运行文件和锁文件，不包含题库、旧文档或 Git 历史。
  $serverFiles = @('package.json','package-lock.json','Dockerfile','.dockerignore','.env.example','v2')
  foreach ($item in $serverFiles) {
    Copy-Item -LiteralPath (Join-Path (Join-Path $root 'cat-mouse-server') $item) -Destination (Join-Path $serverStage $item) -Recurse -Force
  }

  $miniZip = Join-Path $out 'cat-mouse-miniprogram-mvp.zip'
  $serverZip = Join-Path $out 'cat-mouse-server.zip'
  if (Test-Path $miniZip) { Remove-Item -LiteralPath $miniZip -Force }
  if (Test-Path $serverZip) { Remove-Item -LiteralPath $serverZip -Force }
  Compress-Archive -Path (Join-Path $miniStage '*') -DestinationPath $miniZip -CompressionLevel Optimal
  Compress-Archive -Path (Join-Path $serverStage '*') -DestinationPath $serverZip -CompressionLevel Optimal

  Write-Output "Created: $miniZip"
  Write-Output "Created: $serverZip"
} finally {
  if (Test-Path -LiteralPath $resolvedStaging) { Remove-Item -LiteralPath $resolvedStaging -Recurse -Force }
}

